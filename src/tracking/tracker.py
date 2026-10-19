"""
ASPIRE-Vision Tracking Module.
Provides multi-object tracking abstraction for ByteTrack and DeepSORT.
"""
from abc import ABC, abstractmethod
from typing import List, Tuple
import numpy as np


class BaseTracker(ABC):
    @abstractmethod
    def update(
        self,
        detections: List[Tuple[float, float, float, float, float, int]],
        frame: np.ndarray
    ) -> List[Tuple[int, float, float, float, float]]:
        """
        Updates tracking state with new detections.
        Returns:
            List of tuples: (track_id, x1, y1, x2, y2)
        """
        pass


class ByteTrackAdapter(BaseTracker):
    """
    Adapter for ByteTrack using Ultralytics or Supervision tracker.
    """
    def __init__(self, track_thresh: float = 0.5, track_buffer: int = 30, match_thresh: float = 0.8):
        self.track_thresh = track_thresh
        self.track_buffer = track_buffer
        self.match_thresh = match_thresh
        self._tracker = None

    def update(
        self,
        detections: List[Tuple[float, float, float, float, float, int]],
        frame: np.ndarray
    ) -> List[Tuple[int, float, float, float, float]]:
        # Placeholder for ByteTrack integration
        # In Sprint 2, this interfaces directly with Ultralytics tracker or ByteTrack C++/Python bindings
        tracked_objects = []
        for i, det in enumerate(detections):
            track_id = i + 1
            x1, y1, x2, y2 = det[:4]
            tracked_objects.append((track_id, x1, y1, x2, y2))
        return tracked_objects
