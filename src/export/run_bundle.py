"""
Run bundle reader/writer.

Every processed video produces one self-contained folder under outputs/runs/<run_id>/:

    manifest.json   video metadata, config snapshot, lines, counts, diagnostics, throughput
    events.csv      one row per crossing event (CROSS_IN / CROSS_OUT)
    tracks.csv      one row per track per frame (trajectories)
    video.webm      browser-playable copy used by the dashboard (frame-aligned)
    annotated.webm  optional copy with burned-in overlays
    evaluation.json / ground_truth.csv   written when annotations are compared

Field definitions are in docs/data_dictionary.md.
"""
import csv
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import shutil
import statistics
from typing import Any, Dict, Iterable, List, Optional, Tuple

from src.analytics.geometry import Point
from src.analytics.line_counter import CrossingEvent

SCHEMA_VERSION = 1
MANIFEST = "manifest.json"
EVENTS = "events.csv"
TRACKS = "tracks.csv"
REVIEW_VIDEO = "video.webm"
ANNOTATED_VIDEO = "annotated.webm"
EVALUATION = "evaluation.json"
GROUND_TRUTH = "ground_truth.csv"
BUNDLE_FILES = (MANIFEST, EVENTS, TRACKS, REVIEW_VIDEO, ANNOTATED_VIDEO, EVALUATION, GROUND_TRUTH)

EVENT_FIELDS = ["Event_ID", "Frame_ID", "Time_S", "Timestamp", "Track_ID", "Line_ID", "Event_Type", "Anchor_X", "Anchor_Y"]
TRACK_FIELDS = ["Frame_ID", "Track_ID", "X1", "Y1", "X2", "Y2", "Confidence", "Anchor_X", "Anchor_Y"]

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,120}$")


def new_run_id(runs_dir: Path, video_name: str, tracker: str, now: Optional[datetime] = None) -> str:
    stamp = (now or datetime.now()).strftime("%Y%m%d-%H%M%S")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(video_name).stem).strip("-")[:40] or "video"
    base = f"{stamp}_{stem}_{tracker}"
    run_id, n = base, 2
    while (runs_dir / run_id).exists():
        run_id, n = f"{base}-{n}", n + 1
    return run_id


class RunWriter:
    """Streams trajectories to disk while a video is processed, then writes events and the manifest."""

    def __init__(self, run_dir: Path, fps: float, start_timestamp: Optional[str] = None):
        self.run_dir = Path(run_dir)
        self.run_dir.mkdir(parents=True, exist_ok=False)
        self.fps = fps
        self._start = datetime.fromisoformat(start_timestamp) if start_timestamp else None
        self._tracks_file = open(self.run_dir / TRACKS, "w", newline="", encoding="utf-8")
        self._tracks = csv.writer(self._tracks_file)
        self._tracks.writerow(TRACK_FIELDS)
        self._events: List[CrossingEvent] = []
        self._frames_per_track: Dict[int, int] = {}
        self._track_points = 0

    def time_s(self, frame_id: int) -> float:
        return round(frame_id / self.fps, 3)

    def timestamp(self, frame_id: int) -> str:
        if self._start is None:
            return ""
        return (self._start + timedelta(seconds=frame_id / self.fps)).isoformat(timespec="milliseconds")

    def write_frame(self, frame_id: int, observations: Iterable[Tuple[Any, Point]]) -> None:
        """observations: (TrackedObject, anchor) pairs for this frame."""
        for obj, anchor in observations:
            x1, y1, x2, y2 = obj.bbox
            self._tracks.writerow([
                frame_id, obj.track_id,
                f"{x1:.1f}", f"{y1:.1f}", f"{x2:.1f}", f"{y2:.1f}",
                f"{obj.confidence:.3f}", f"{anchor.x:.1f}", f"{anchor.y:.1f}",
            ])
            self._frames_per_track[obj.track_id] = self._frames_per_track.get(obj.track_id, 0) + 1
            self._track_points += 1

    def add_event(self, event: CrossingEvent) -> None:
        self._events.append(event)

    def tracking_stats(self) -> Dict[str, Any]:
        lengths = list(self._frames_per_track.values())
        short_threshold = max(1, round(self.fps))  # tracks visible for less than ~1 s
        return {
            "unique_tracks": len(lengths),
            "track_points": self._track_points,
            "mean_track_length_frames": round(statistics.fmean(lengths), 1) if lengths else 0.0,
            "median_track_length_frames": statistics.median(lengths) if lengths else 0,
            "short_track_threshold_frames": short_threshold,
            "short_tracks": sum(1 for n in lengths if n < short_threshold),
        }

    def finalize(self, manifest: Dict[str, Any]) -> Dict[str, Any]:
        self._tracks_file.close()
        events = sorted(self._events, key=lambda e: (e.frame_id, e.line_id, e.track_id))
        with open(self.run_dir / EVENTS, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(EVENT_FIELDS)
            for i, ev in enumerate(events, start=1):
                writer.writerow([
                    i, ev.frame_id, f"{self.time_s(ev.frame_id):.3f}", self.timestamp(ev.frame_id),
                    ev.track_id, ev.line_id, ev.event_type, f"{ev.position.x:.1f}", f"{ev.position.y:.1f}",
                ])
        manifest = {"schema_version": SCHEMA_VERSION, **manifest}
        manifest.setdefault("tracking", {}).update(self.tracking_stats())
        write_json(self.run_dir / MANIFEST, manifest)
        return manifest

    def abort(self) -> None:
        if not self._tracks_file.closed:
            self._tracks_file.close()
        shutil.rmtree(self.run_dir, ignore_errors=True)


def write_json(path: Path, data: Dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    tmp.replace(path)


def read_manifest(run_dir: Path) -> Dict[str, Any]:
    with open(Path(run_dir) / MANIFEST, "r", encoding="utf-8") as f:
        return json.load(f)


def read_events(run_dir: Path) -> List[Dict[str, Any]]:
    with open(Path(run_dir) / EVENTS, "r", newline="", encoding="utf-8") as f:
        return [
            {
                "Event_ID": int(row["Event_ID"]),
                "Frame_ID": int(row["Frame_ID"]),
                "Time_S": float(row["Time_S"]),
                "Timestamp": row["Timestamp"],
                "Track_ID": int(row["Track_ID"]),
                "Line_ID": row["Line_ID"],
                "Event_Type": row["Event_Type"],
                "Anchor_X": float(row["Anchor_X"]),
                "Anchor_Y": float(row["Anchor_Y"]),
            }
            for row in csv.DictReader(f)
        ]


def read_tracks_columnar(run_dir: Path) -> Dict[str, List[float]]:
    """Trajectories as parallel arrays, which keeps the JSON payload for the dashboard compact."""
    columns: Dict[str, List[float]] = {name: [] for name in TRACK_FIELDS}
    with open(Path(run_dir) / TRACKS, "r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            for name, value in zip(TRACK_FIELDS, row):
                columns[name].append(int(value) if name in ("Frame_ID", "Track_ID") else float(value))
    return columns


def bundle_files(run_dir: Path) -> List[str]:
    return [name for name in BUNDLE_FILES if (Path(run_dir) / name).is_file()]


def list_runs(runs_dir: Path) -> List[Dict[str, Any]]:
    runs = []
    if not runs_dir.exists():
        return runs
    for run_dir in runs_dir.iterdir():
        if not (run_dir / MANIFEST).is_file():
            continue
        try:
            manifest = read_manifest(run_dir)
        except (OSError, ValueError):
            continue
        evaluation_path = run_dir / EVALUATION
        if evaluation_path.is_file():
            try:
                with open(evaluation_path, "r", encoding="utf-8") as f:
                    manifest["evaluation_summary"] = json.load(f).get("overall")
            except (OSError, ValueError):
                pass
        runs.append(manifest)
    runs.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return runs
