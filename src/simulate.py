"""
Synthetic demo scene.

Generates a short 1280x720 clip with scripted pedestrians and scripted track IDs,
then runs it through the same `run_pipeline` used for real video. No model weights
or footage are needed, so the full workflow (process -> review -> evaluate) can be
demonstrated and tested anywhere.

The scene deliberately contains the failure modes discussed in supervision:

    P1  enters (IN), lingers, then leaves (OUT)      -> two legitimate events, one ID
    P2  enters (IN)                                  -> one event
    P3  loiters on the line inside the deadband      -> no event
    P4  crosses the infinite line beyond its end      -> no event
    P5  leaves, but its ID switches inside deadband   -> missed OUT (false negative)
    P6  enters, then a re-spawned ID appears on the
        original side and crosses again               -> duplicate IN (false positive)

Ground truth is derived from each person's true path, never from track IDs.
"""
import csv
from dataclasses import dataclass, field
import math
from pathlib import Path
import random
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np

from src.analytics.line_counter import CROSS_IN, CROSS_OUT, CountingLine
from src.config import AppConfig
from src.evaluation.evaluate import GT_FIELDS, evaluate_run
from src.export.run_bundle import new_run_id
from src.processing import CancelCheck, ProgressCallback, VideoInfo, run_pipeline
from src.tracking.tracker import BaseTracker, TrackedObject

WIDTH, HEIGHT, FPS, FRAMES = 1280, 720, 30.0, 300
LINE_Y = 400.0
LINE_X = (200.0, 1080.0)
CLIP_NAME = "synthetic_demo"
GT_CLEARANCE_PX = 30.0  # annotator rule: the person must be clearly on the other side

LINE = CountingLine.from_dict({
    "id": "LINE_1",
    "name": "Doorway line",
    "start": [LINE_X[0], LINE_Y],
    "end": [LINE_X[1], LINE_Y],
    "in_direction": [0, 1],
})


@dataclass
class Person:
    label: str
    colour: Tuple[int, int, int]
    # frame -> true ground-contact point
    path: Dict[int, Tuple[float, float]] = field(default_factory=dict)
    # frame -> track id reported by the (scripted) tracker
    ids: Dict[int, int] = field(default_factory=dict)
    # frame -> (dx, dy) error added to the reported anchor (e.g. occlusion)
    anchor_error: Dict[int, Tuple[float, float]] = field(default_factory=dict)


def _walk(person: Person, frames: range, fn: Callable[[int], Tuple[float, float]], track_id: int) -> None:
    for f in frames:
        person.path[f] = fn(f)
        person.ids[f] = track_id


def build_scene() -> List[Person]:
    p1 = Person("P1 enters, lingers, leaves", (70, 110, 200))
    _walk(p1, range(0, 81), lambda f: (420 + 0.5 * f, 182 + 4.0 * f), 1)
    _walk(p1, range(81, 111), lambda f: (460 + 0.2 * (f - 80), 502 + 0.5 * (f - 80)), 1)
    _walk(p1, range(111, 231), lambda f: (466 - 0.3 * (f - 110), 517 - 4.0 * (f - 110)), 1)

    p2 = Person("P2 enters", (60, 160, 90))
    _walk(p2, range(30, 191), lambda f: (760 - 0.6 * (f - 30), 122 + 3.5 * (f - 30)), 2)

    p3 = Person("P3 loiters on the line", (150, 90, 160))
    _walk(p3, range(60, 91), lambda f: (600 + 1.2 * (f - 60), 330 + 2.1 * (f - 60)), 3)
    _walk(p3, range(91, 171), lambda f: (636 + 1.2 * (f - 90), 397 + 7.0 * math.sin((f - 90) / 4.0)), 3)
    _walk(p3, range(171, 201), lambda f: (732 + 1.2 * (f - 170), 397 - 2.2 * (f - 170)), 3)

    p4 = Person("P4 passes beyond the line end", (120, 120, 120))
    _walk(p4, range(120, 221), lambda f: (1180.0, 250 + 3.5 * (f - 120)), 4)

    p5 = Person("P5 leaves; ID switch in deadband", (40, 140, 200))
    _walk(p5, range(150, 211), lambda f: (300 + 0.8 * (f - 150), 650 - 4.0 * (f - 150)), 5)
    _walk(p5, range(211, 276), lambda f: (300 + 0.8 * (f - 150), 650 - 4.0 * (f - 150)), 6)

    p6 = Person("P6 enters; ID re-spawns on wrong side", (200, 120, 60))
    _walk(p6, range(180, 237), lambda f: (900 - 0.5 * (f - 180), 198 + 4.0 * (f - 180)), 7)
    _walk(p6, range(237, 300), lambda f: (900 - 0.5 * (f - 180), 198 + 4.0 * (f - 180)), 8)
    p6.anchor_error[237] = (0.0, -40.0)  # occluded first box of the new ID is too short

    return [p1, p2, p3, p4, p5, p6]


def ground_truth(people: List[Person]) -> List[Dict[str, Any]]:
    """True crossings of LINE: the first frame past the line, provided the person goes on to be
    clearly (GT_CLEARANCE_PX) on the other side before turning back, and crosses within the segment."""
    rows = []
    for person_id, person in enumerate(people, start=1):
        frames = sorted(person.path)
        side = None
        crossing: Optional[Tuple[int, float]] = None
        for f in frames:
            x, y = person.path[f]
            offset = y - LINE_Y
            if side is None:
                if abs(offset) >= GT_CLEARANCE_PX:
                    side = 1 if offset > 0 else -1
                continue
            if offset * side < 0 and crossing is None:
                crossing = (f, x)
            elif offset * side > 0:
                crossing = None  # stepped back before committing
            if crossing is not None and offset * -side >= GT_CLEARANCE_PX:
                cf, cx = crossing
                if LINE_X[0] <= cx <= LINE_X[1]:
                    rows.append({
                        "Clip_ID": CLIP_NAME,
                        "Frame_ID": cf,
                        "GT_Person_ID": person_id,
                        "Line_ID": LINE.line_id,
                        "Event_Type": CROSS_IN if -side > 0 else CROSS_OUT,
                        "Notes": person.label,
                    })
                side, crossing = -side, None
    rows.sort(key=lambda r: r["Frame_ID"])
    return rows


def _box(x: float, y: float) -> Tuple[float, float, float, float]:
    h = 70 + 0.22 * y  # simple perspective: people further down the image look taller
    w = 0.38 * h
    return (x - w / 2, y - h, x + w / 2, y)


class SyntheticTracker(BaseTracker):
    """Replays the scripted track IDs instead of running a detector."""

    def __init__(self, people: List[Person], seed: int = 7):
        rng = random.Random(seed)
        self._frames: Dict[int, List[TrackedObject]] = {}
        for person in people:
            for f, (x, y) in person.path.items():
                dx, dy = person.anchor_error.get(f, (0.0, 0.0))
                jx, jy = rng.uniform(-1, 1), rng.uniform(-1, 1)
                obj = TrackedObject(person.ids[f], _box(x + dx + jx, y + dy + jy), round(rng.uniform(0.55, 0.92), 3))
                self._frames.setdefault(f, []).append(obj)

    def update(self, frame: np.ndarray, frame_id: int) -> List[TrackedObject]:
        return self._frames.get(frame_id, [])

    @property
    def device(self) -> str:
        return "cpu (scripted tracker)"


def _background() -> np.ndarray:
    img = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for y in range(HEIGHT):
        shade = int(150 + 50 * y / HEIGHT)
        img[y, :] = (shade - 6, shade - 2, shade)
    for y in range(120, HEIGHT, 70):  # floor tiles
        cv2.line(img, (0, y), (WIDTH, y), (135, 140, 145), 1)
    for x in range(-400, WIDTH + 400, 160):
        cv2.line(img, (WIDTH // 2 + (x - WIDTH // 2) // 3, 0), (x, HEIGHT), (135, 140, 145), 1)
    cv2.rectangle(img, (int(LINE_X[0]) - 30, 0), (int(LINE_X[1]) + 30, 60), (95, 100, 108), -1)  # building facade
    cv2.putText(img, "SYNTHETIC SCENE - scripted pedestrians", (16, HEIGHT - 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (70, 70, 70), 1, cv2.LINE_AA)
    return img


def _frames(people: List[Person]):
    background = _background()
    for f in range(FRAMES):
        frame = background.copy()
        visible = [(p, p.path[f]) for p in people if f in p.path]
        for person, (x, y) in sorted(visible, key=lambda item: item[1][1]):
            x1, y1, x2, y2 = _box(x, y)
            w, h = x2 - x1, y2 - y1
            cv2.ellipse(frame, (int(x), int(y)), (int(w * 0.45), int(h * 0.06)), 0, 0, 360, (110, 112, 116), -1)
            cv2.ellipse(frame, (int(x), int(y1 + h * 0.55)), (int(w * 0.42), int(h * 0.36)), 0, 0, 360, person.colour, -1)
            cv2.circle(frame, (int(x), int(y1 + h * 0.13)), int(w * 0.24), (150, 175, 205), -1)
        yield frame


def simulate(
    runs_dir: Path,
    annotations_dir: Path,
    config: Optional[AppConfig] = None,
    progress: Optional[ProgressCallback] = None,
    should_cancel: Optional[CancelCheck] = None,
    evaluate: bool = True,
) -> Dict[str, Any]:
    config = (config or AppConfig()).with_overrides(output={"write_review_video": True})
    people = build_scene()
    video = VideoInfo(name=CLIP_NAME, split="dev", fps=FPS, width=WIDTH, height=HEIGHT, frame_count=FRAMES)
    runs_dir.mkdir(parents=True, exist_ok=True)
    run_dir = runs_dir / new_run_id(runs_dir, CLIP_NAME, "synthetic")
    manifest = run_pipeline(
        _frames(people), video, SyntheticTracker(people), "synthetic (scripted IDs)", [LINE], config, run_dir,
        source="simulation", tracker_parameters={"type": "scripted", "note": "IDs replayed from the scene script"},
        progress=progress, should_cancel=should_cancel,
    )
    annotations_dir.mkdir(parents=True, exist_ok=True)
    gt_path = annotations_dir / f"{CLIP_NAME}_gt.csv"
    with open(gt_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GT_FIELDS)
        writer.writeheader()
        writer.writerows(ground_truth(people))
    if evaluate:
        evaluate_run(run_dir, gt_path)
    return manifest
