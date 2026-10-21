import csv
import json

import numpy as np
import pytest

from src.analytics.line_counter import lines_from_dicts
from src.config import AppConfig
from src.export.run_bundle import read_events, read_manifest, read_tracks_columnar
from src.processing import RunCancelled, VideoInfo, run_pipeline
from src.simulate import simulate
from tests.conftest import ScriptedTracker, walker

LINES = lines_from_dicts([{"id": "L1", "start": [20, 120], "end": [300, 120], "in_direction": [0, 1]}])
NO_VIDEO = AppConfig().with_overrides(output={"write_review_video": False})


def blank_frames(n, w=320, h=240):
    for _ in range(n):
        yield np.zeros((h, w, 3), dtype=np.uint8)


def video(n=40):
    return VideoInfo(name="clip.mp4", split="dev", fps=20.0, width=320, height=240, frame_count=n)


def test_run_bundle_round_trip(tmp_path):
    script = walker(1, 160, lambda f: 60 + 6 * f, range(0, 30))
    for f, objs in walker(2, 200, lambda f: 200 - 6 * (f - 10), range(10, 40)).items():
        script.setdefault(f, []).extend(objs)
    manifest = run_pipeline(blank_frames(40), video(), ScriptedTracker(script), "scripted", LINES, NO_VIDEO, tmp_path / "run")

    assert manifest["counts"]["total"] == {"in": 1, "out": 1, "net": 0}
    assert manifest["video"]["frame_count"] == 40 and manifest["video"]["duration_s"] == 2.0
    assert manifest["tracking"]["unique_tracks"] == 2
    assert read_manifest(tmp_path / "run") == manifest

    events = read_events(tmp_path / "run")
    assert [(e["Track_ID"], e["Event_Type"]) for e in events] == [(1, "CROSS_IN"), (2, "CROSS_OUT")]
    assert events[0]["Time_S"] == pytest.approx(events[0]["Frame_ID"] / 20.0, abs=1e-3)

    tracks = read_tracks_columnar(tmp_path / "run")
    assert len(tracks["Frame_ID"]) == 60
    assert tracks["Anchor_Y"][0] == 60.0  # bottom-centre of the first box


def test_cancel_removes_partial_run(tmp_path):
    calls = {"n": 0}

    def cancel():
        calls["n"] += 1
        return calls["n"] > 3

    with pytest.raises(RunCancelled):
        run_pipeline(blank_frames(40), video(), ScriptedTracker({}), "scripted", LINES, NO_VIDEO,
                     tmp_path / "run", should_cancel=cancel)
    assert not (tmp_path / "run").exists()


def test_simulation_reproduces_the_designed_failure_cases(tmp_path):
    manifest = simulate(tmp_path / "runs", tmp_path / "annotations")
    run_dir = tmp_path / "runs" / manifest["run_id"]
    assert (run_dir / "video.webm").stat().st_size > 0
    assert manifest["counts"]["total"] == {"in": 4, "out": 1, "net": 3}

    with open(tmp_path / "annotations" / "synthetic_demo_gt.csv", newline="") as f:
        gt = list(csv.DictReader(f))
    assert [(r["Frame_ID"], r["Event_Type"]) for r in gt] == [
        ("55", "CROSS_IN"), ("110", "CROSS_IN"), ("140", "CROSS_OUT"), ("213", "CROSS_OUT"), ("231", "CROSS_IN"),
    ]

    evaluation = json.loads((run_dir / "evaluation.json").read_text())
    overall = evaluation["overall"]
    assert (overall["tp"], overall["fp"], overall["fn"], overall["count_error"]) == (4, 1, 1, 0)
    assert evaluation["false_positives"][0]["Track_ID"] == 8  # re-spawned ID -> duplicate
    assert evaluation["false_negatives"][0]["Frame_ID"] == 213  # ID switch in deadband -> miss
