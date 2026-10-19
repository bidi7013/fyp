"""
ASPIRE-Vision Exporter Module.
Handles CSV logging conforming strictly to the project Data Dictionary schema.
"""
import csv
from pathlib import Path
from typing import Optional, Union
from src.analytics.primitives import Point


class CSVEventLogger:
    """
    Standardized CSV logger logging trajectory points and discrete counting events.
    Fields: Frame_ID, Track_ID, BBox_Center_X, BBox_Center_Y, Event_Type, Timestamp
    """
    FIELDNAMES = [
        "Frame_ID",
        "Track_ID",
        "BBox_Center_X",
        "BBox_Center_Y",
        "Event_Type",
        "Timestamp"
    ]

    def __init__(self, output_path: Union[str, Path]):
        self.output_path = Path(output_path)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self._file = None
        self._writer = None
        self.total_rows_logged = 0
        self.open()

    def open(self):
        self._file = open(self.output_path, mode="w", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._file, fieldnames=self.FIELDNAMES)
        self._writer.writeheader()
        self._file.flush()

    def log_event(
        self,
        frame_id: int,
        track_id: int,
        bbox_center_x: float,
        bbox_center_y: float,
        event_type: str,
        timestamp: str
    ):
        if self._writer is None:
            raise RuntimeError("CSV logger is not open.")

        row = {
            "Frame_ID": int(frame_id),
            "Track_ID": int(track_id),
            "BBox_Center_X": round(float(bbox_center_x), 2),
            "BBox_Center_Y": round(float(bbox_center_y), 2),
            "Event_Type": str(event_type),
            "Timestamp": str(timestamp)
        }
        self._writer.writerow(row)
        self.total_rows_logged += 1

    def flush(self):
        if self._file:
            self._file.flush()

    def close(self):
        if self._file:
            self._file.flush()
            self._file.close()
            self._file = None
            self._writer = None
