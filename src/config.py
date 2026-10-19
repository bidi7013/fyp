"""
Configuration Loader for ASPIRE-Vision.
Handles default fallbacks and parses camera zone configurations.
"""
from dataclasses import dataclass, field
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError:
    yaml = None


@dataclass
class VideoConfig:
    source_path: str = "data/samples/pilot_clip.mp4"
    start_timestamp: str = "2026-10-20T08:00:00"
    target_fps: Optional[float] = None
    display_preview: bool = True
    save_annotated_video: bool = True
    annotated_output_path: str = "data/exports/annotated_output.mp4"


@dataclass
class DetectionConfig:
    model_weights: str = "yolov8n.pt"
    confidence_threshold: float = 0.35
    iou_threshold: float = 0.50
    classes: List[int] = field(default_factory=lambda: [0])


@dataclass
class TrackingConfig:
    tracker_type: str = "bytetrack"
    track_high_thresh: float = 0.5
    track_low_thresh: float = 0.1
    new_track_thresh: float = 0.6
    track_buffer: int = 30
    match_thresh: float = 0.8


@dataclass
class SpatialConfig:
    zones_config_file: str = "configs/camera_zones.json"
    anchor_point: str = "bottom_center"
    hysteresis_buffer_pixels: float = 15.0


@dataclass
class ExportConfig:
    output_csv_path: str = "data/exports/events_log.csv"
    write_frequency_frames: int = 1


@dataclass
class AppConfig:
    system: Dict[str, Any] = field(default_factory=lambda: {"device": "cuda", "seed": 42})
    video: VideoConfig = field(default_factory=VideoConfig)
    detection: DetectionConfig = field(default_factory=DetectionConfig)
    tracking: TrackingConfig = field(default_factory=TrackingConfig)
    spatial: SpatialConfig = field(default_factory=SpatialConfig)
    export: ExportConfig = field(default_factory=ExportConfig)

    @classmethod
    def load(cls, config_path: str = "configs/default_config.yaml") -> "AppConfig":
        path = Path(config_path)
        if not path.exists() or yaml is None:
            return cls()

        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}

        return cls(
            system=raw.get("system", {"device": "cuda", "seed": 42}),
            video=VideoConfig(**raw.get("video", {})),
            detection=DetectionConfig(**raw.get("detection", {})),
            tracking=TrackingConfig(**raw.get("tracking", {})),
            spatial=SpatialConfig(**raw.get("spatial", {})),
            export=ExportConfig(**raw.get("export", {})),
        )


def load_zones_config(json_path: str) -> Dict[str, Any]:
    path = Path(json_path)
    if not path.exists():
        raise FileNotFoundError(f"Camera zones configuration not found at {json_path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
