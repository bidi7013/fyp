"""
ASPIRE-Vision Detection Module.
Provides object detection abstraction and YOLOv8 adapter.
"""
from abc import ABC, abstractmethod
from typing import List, Tuple
import numpy as np


class BaseDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray) -> List[Tuple[float, float, float, float, float, int]]:
        """
        Runs object detection on a single frame.
        Returns:
            List of tuples: (x1, y1, x2, y2, confidence, class_id)
        """
        pass


class YOLOv8Detector(BaseDetector):
    def __init__(self, weights_path: str = "yolov8n.pt", confidence: float = 0.35, iou: float = 0.5):
        self.weights_path = weights_path
        self.confidence = confidence
        self.iou = iou
        self._model = None

    def _load_model(self):
        if self._model is None:
            from ultralytics import YOLO
            self._model = YOLO(self.weights_path)

    def detect(self, frame: np.ndarray) -> List[Tuple[float, float, float, float, float, int]]:
        self._load_model()
        results = self._model.predict(
            source=frame,
            conf=self.confidence,
            iou=self.iou,
            classes=[0],  # Person class
            verbose=False
        )
        detections = []
        for box in results[0].boxes:
            coords = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0].cpu().numpy())
            cls_id = int(box.cls[0].cpu().numpy())
            detections.append((coords[0], coords[1], coords[2], coords[3], conf, cls_id))
        return detections
