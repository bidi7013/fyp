"""
ASPIRE-Vision tracking module.

One pretrained detector (YOLOv8, COCO person class) is associated over time by an
Ultralytics multi-object tracker. ByteTrack and BoT-SORT are the two supported
configurations; their parameters live in configs/trackers/*.yaml.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

from src.config import DetectorConfig, TrackerConfig


@dataclass(frozen=True)
class TrackedObject:
    track_id: int
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2 in pixels
    confidence: float


class BaseTracker(ABC):
    @abstractmethod
    def update(self, frame: np.ndarray, frame_id: int) -> List[TrackedObject]:
        """Returns the tracks visible in this frame. Must be called once per frame, in order."""

    @property
    def device(self) -> str:
        return "cpu"


class UltralyticsTracker(BaseTracker):
    def __init__(self, detector: DetectorConfig, tracker: TrackerConfig):
        from ultralytics import YOLO  # heavy import, only needed for real video

        self.detector = detector
        self.tracker_config_path: Path = tracker.config_path()
        self._model = YOLO(detector.model_weights)

    def update(self, frame: np.ndarray, frame_id: int) -> List[TrackedObject]:
        results = self._model.track(
            source=frame,
            persist=True,
            tracker=str(self.tracker_config_path),
            conf=self.detector.confidence_threshold,
            iou=self.detector.iou_threshold,
            classes=self.detector.classes,
            imgsz=self.detector.image_size,
            device=self.detector.device,
            verbose=False,
        )
        boxes = results[0].boxes
        if boxes is None or boxes.id is None:
            return []
        xyxy = boxes.xyxy.cpu().numpy()
        ids = boxes.id.int().cpu().tolist()
        confs = boxes.conf.cpu().numpy()
        return [
            TrackedObject(track_id=int(tid), bbox=tuple(float(v) for v in box), confidence=float(conf))
            for tid, box, conf in zip(ids, xyxy, confs)
        ]

    @property
    def device(self) -> str:
        device: Optional[object] = getattr(self._model, "device", None)
        return str(device) if device is not None else "unknown"
