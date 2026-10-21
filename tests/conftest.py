from typing import Callable, Dict, List, Tuple

import pytest

from src.tracking.tracker import BaseTracker, TrackedObject


class ScriptedTracker(BaseTracker):
    """Returns pre-defined tracks per frame; stands in for YOLO + ByteTrack in tests."""

    def __init__(self, script: Dict[int, List[TrackedObject]]):
        self.script = script

    def update(self, frame, frame_id):
        return self.script.get(frame_id, [])


def walker(track_id: int, x: float, y_of: Callable[[int], float], frames: range) -> Dict[int, List[TrackedObject]]:
    """A person whose ground anchor is (x, y_of(frame))."""
    return {f: [TrackedObject(track_id, (x - 10, y_of(f) - 40, x + 10, y_of(f)), 0.9)] for f in frames}


@pytest.fixture
def scripted_tracker():
    return ScriptedTracker
