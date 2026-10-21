"""
ASPIRE-Vision processing pipeline.

    recorded video -> tracker (YOLOv8 + ByteTrack/BoT-SORT) -> ground anchors
                   -> line-crossing FSM -> run bundle (manifest, events, tracks, review video)

`run_pipeline` is shared by real videos (`process_video`) and the synthetic demo
(`src/simulate.py`), so both exercise exactly the same counting and export code.
"""
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import subprocess
import time
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

import cv2
import numpy as np
import yaml

from src.analytics.geometry import Point, compute_ground_anchor
from src.analytics.line_counter import CountingLine, CrossingEvent, LineCrossingCounter
from src.config import PROJECT_ROOT, AppConfig, CountingConfig
from src.export.run_bundle import ANNOTATED_VIDEO, REVIEW_VIDEO, RunWriter, new_run_id
from src.tracking.tracker import BaseTracker, TrackedObject

ProgressCallback = Callable[[int, Optional[int]], None]  # (frames_done, frames_total or None)
CancelCheck = Callable[[], bool]

# BGR colours shared with the dashboard: IN = blue, OUT = orange.
IN_BGR = (235, 99, 37)
OUT_BGR = (12, 88, 234)
LINE_BGR = (255, 255, 255)
BOX_BGR = (200, 200, 200)


class RunCancelled(Exception):
    pass


@dataclass
class VideoInfo:
    name: str
    split: str
    fps: float
    width: int
    height: int
    frame_count: Optional[int]
    path: Optional[str] = None


def probe_video(path: Path) -> Dict[str, Any]:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {path.name}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        info = {
            "fps": round(fps, 3) if fps and fps > 0 else None,
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "frame_count": frames if frames > 0 else None,
        }
    finally:
        cap.release()
    info["duration_s"] = round(info["frame_count"] / info["fps"], 2) if info["fps"] and info["frame_count"] else None
    return info


def read_frame(path: Path, index: int = 0) -> np.ndarray:
    cap = cv2.VideoCapture(str(path))
    try:
        if index:
            cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
    finally:
        cap.release()
    if not ok:
        raise ValueError(f"Cannot read frame {index} of {path.name}")
    return frame


class CountingEngine:
    """Applies every counting line to the tracks of one frame."""

    def __init__(self, lines: Sequence[CountingLine], counting: CountingConfig):
        self.counting = counting
        self.counters = [
            LineCrossingCounter(line, counting.hysteresis_buffer_pixels, counting.min_frames_between_events)
            for line in lines
        ]

    def step(self, frame_id: int, objects: Iterable[TrackedObject]) -> Tuple[List[CrossingEvent], List[Tuple[TrackedObject, Point]]]:
        events: List[CrossingEvent] = []
        observations = []
        for obj in objects:
            anchor = compute_ground_anchor(obj.bbox, self.counting.anchor_point)
            observations.append((obj, anchor))
            for counter in self.counters:
                event = counter.update(frame_id, obj.track_id, anchor)
                if event is not None:
                    events.append(event)
        for counter in self.counters:
            counter.forget_stale(frame_id, self.counting.forget_track_after_frames)
        return events, observations

    def counts(self) -> Dict[str, Any]:
        by_line = {
            c.line.line_id: {"in": c.total_in, "out": c.total_out, "net": c.total_in - c.total_out}
            for c in self.counters
        }
        total_in = sum(v["in"] for v in by_line.values())
        total_out = sum(v["out"] for v in by_line.values())
        return {"total": {"in": total_in, "out": total_out, "net": total_in - total_out}, "by_line": by_line}

    def diagnostics(self) -> Dict[str, int]:
        return {
            "suppressed_by_cooldown": sum(c.suppressed_by_cooldown for c in self.counters),
            "tracks_started_in_deadband": sum(c.tracks_started_in_deadband for c in self.counters),
        }


def _open_webm(path: Path, fps: float, width: int, height: int) -> "cv2.VideoWriter":
    # VP8/WebM plays natively in browsers; OpenCV's mp4v codec does not.
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"VP80"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not open a VP8 (WebM) encoder for the review video")
    return writer


def draw_overlay(frame: np.ndarray, frame_id: int, observations, lines: Sequence[CountingLine], counts: Dict[str, Any]) -> np.ndarray:
    for line in lines:
        a = (int(line.start.x), int(line.start.y))
        b = (int(line.end.x), int(line.end.y))
        cv2.line(frame, a, b, LINE_BGR, 2, cv2.LINE_AA)
        mid = ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)
        dx, dy = line.in_direction
        norm = max((dx * dx + dy * dy) ** 0.5, 1e-6)
        tip = (int(mid[0] + 40 * dx / norm), int(mid[1] + 40 * dy / norm))
        cv2.arrowedLine(frame, mid, tip, IN_BGR, 2, cv2.LINE_AA, tipLength=0.35)
        cv2.putText(frame, line.name, (a[0], a[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, LINE_BGR, 2, cv2.LINE_AA)
    for obj, anchor in observations:
        x1, y1, x2, y2 = (int(v) for v in obj.bbox)
        cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_BGR, 2)
        cv2.putText(frame, f"#{obj.track_id}", (x1, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, BOX_BGR, 2, cv2.LINE_AA)
        cv2.circle(frame, (int(anchor.x), int(anchor.y)), 4, (0, 220, 255), -1)
    total = counts["total"]
    hud = f"frame {frame_id}   IN {total['in']}   OUT {total['out']}   NET {total['net']:+d}"
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 34), (20, 20, 20), -1)
    cv2.putText(frame, hud, (12, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)
    return frame


def git_commit() -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=5
        )
        commit = out.stdout.strip()
        if not commit:
            return None
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=5)
        return commit + ("-dirty" if dirty.stdout.strip() else "")
    except (OSError, subprocess.SubprocessError):
        return None


def run_pipeline(
    frames: Iterable[np.ndarray],
    video: VideoInfo,
    tracker: BaseTracker,
    tracker_label: str,
    lines: Sequence[CountingLine],
    config: AppConfig,
    run_dir: Path,
    source: str = "video",
    tracker_parameters: Optional[Dict[str, Any]] = None,
    progress: Optional[ProgressCallback] = None,
    should_cancel: Optional[CancelCheck] = None,
) -> Dict[str, Any]:
    writer = RunWriter(run_dir, video.fps, config.output.start_timestamp)
    engine = CountingEngine(lines, config.counting)
    review = annotated = None
    frames_done = 0
    try:
        if config.output.write_review_video:
            review = _open_webm(run_dir / REVIEW_VIDEO, video.fps, video.width, video.height)
        if config.output.write_annotated_video:
            annotated = _open_webm(run_dir / ANNOTATED_VIDEO, video.fps, video.width, video.height)

        started = time.perf_counter()
        for frame_id, frame in enumerate(frames):
            if should_cancel is not None and should_cancel():
                raise RunCancelled()
            objects = tracker.update(frame, frame_id)
            events, observations = engine.step(frame_id, objects)
            writer.write_frame(frame_id, observations)
            for event in events:
                writer.add_event(event)
            if review is not None:
                review.write(frame)
            if annotated is not None:
                annotated.write(draw_overlay(frame.copy(), frame_id, observations, lines, engine.counts()))
            frames_done = frame_id + 1
            if progress is not None and frames_done % 5 == 0:
                progress(frames_done, video.frame_count)
        elapsed = time.perf_counter() - started
    except BaseException:
        for vw in (review, annotated):
            if vw is not None:
                vw.release()
        writer.abort()
        raise
    for vw in (review, annotated):
        if vw is not None:
            vw.release()
    if frames_done == 0:
        writer.abort()
        raise ValueError(f"No frames could be read from {video.name}")
    if progress is not None:
        progress(frames_done, frames_done)

    manifest = {
        "run_id": run_dir.name,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source": source,
        "git_commit": git_commit(),
        "video": {
            "name": video.name,
            "path": video.path,
            "split": video.split,
            "fps": video.fps,
            "width": video.width,
            "height": video.height,
            "frame_count": frames_done,
            "duration_s": round(frames_done / video.fps, 3),
        },
        "config": config.to_dict(),
        "tracker_parameters": tracker_parameters or {},
        "lines": [line.to_dict() for line in lines],
        "counts": engine.counts(),
        "diagnostics": engine.diagnostics(),
        "tracking": {"tracker": tracker_label},
        "performance": {
            "processing_seconds": round(elapsed, 2),
            "processing_fps": round(frames_done / elapsed, 2) if elapsed > 0 else None,
            "realtime_factor": round((frames_done / elapsed) / video.fps, 2) if elapsed > 0 else None,
            "device": tracker.device,
        },
    }
    return writer.finalize(manifest)


def _iter_frames(cap: "cv2.VideoCapture") -> Iterator[np.ndarray]:
    while True:
        ok, frame = cap.read()
        if not ok:
            return
        yield frame


def _relative_to_root(path: Path) -> str:
    try:
        return path.resolve().relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.name


def process_video(
    video_path: Path,
    split: str,
    lines: Sequence[CountingLine],
    config: AppConfig,
    runs_dir: Path,
    tracker: Optional[BaseTracker] = None,
    run_id: Optional[str] = None,
    progress: Optional[ProgressCallback] = None,
    should_cancel: Optional[CancelCheck] = None,
) -> Dict[str, Any]:
    """Processes one recorded video into a run bundle and returns its manifest."""
    video_path = Path(video_path)
    meta = probe_video(video_path)
    if not meta["fps"]:
        raise ValueError(f"{video_path.name} does not report a frame rate")
    video = VideoInfo(
        name=video_path.name,
        split=split,
        fps=meta["fps"],
        width=meta["width"],
        height=meta["height"],
        frame_count=meta["frame_count"],
        path=_relative_to_root(video_path),
    )
    tracker_name = config.tracker.tracker_type
    with open(config.tracker.config_path(), "r", encoding="utf-8") as f:
        tracker_parameters = yaml.safe_load(f)
    if tracker is None:
        from src.tracking.tracker import UltralyticsTracker

        tracker = UltralyticsTracker(config.detector, config.tracker)

    runs_dir.mkdir(parents=True, exist_ok=True)
    run_dir = runs_dir / (run_id or new_run_id(runs_dir, video.name, tracker_name))
    cap = cv2.VideoCapture(str(video_path))
    try:
        return run_pipeline(
            _iter_frames(cap), video, tracker, tracker_name, lines, config, run_dir,
            source="video", tracker_parameters=tracker_parameters,
            progress=progress, should_cancel=should_cancel,
        )
    finally:
        cap.release()


def default_lines(width: int, height: int) -> List[Dict[str, Any]]:
    """A single horizontal line across the middle of the frame; IN points down the image."""
    y = round(height * 0.55)
    return [{
        "id": "LINE_1",
        "name": "Counting line",
        "start": [round(width * 0.1), y],
        "end": [round(width * 0.9), y],
        "in_direction": [0, 1],
    }]

