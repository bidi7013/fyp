"""
Configuration and workspace paths for ASPIRE-Vision.

`AppConfig` holds the tunable parameters of a run (detector, tracker, counting,
output). A full copy is written into every run manifest so results can always be
traced back to the exact settings that produced them.
"""
from dataclasses import asdict, dataclass, field, fields, replace
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "default_config.yaml"
TRACKER_CONFIG_DIR = PROJECT_ROOT / "configs" / "trackers"
SUPPORTED_TRACKERS = ("bytetrack", "botsort")
VIDEO_SPLITS = ("dev", "test")
VIDEO_EXTENSIONS = (".mp4", ".avi", ".mov", ".mkv", ".webm")


@dataclass
class DetectorConfig:
    model_weights: str = "yolov8n.pt"
    # Low on purpose: ByteTrack/BoT-SORT use detections between track_low_thresh and
    # track_high_thresh to recover partially occluded people. New tracks still need
    # new_track_thresh (see configs/trackers/*.yaml).
    confidence_threshold: float = 0.1
    iou_threshold: float = 0.5
    classes: List[int] = field(default_factory=lambda: [0])  # 0 = person (COCO)
    image_size: int = 640
    device: Optional[str] = None  # None lets Ultralytics pick (CUDA when available)


@dataclass
class TrackerConfig:
    tracker_type: str = "bytetrack"  # 'bytetrack' or 'botsort'

    def config_path(self) -> Path:
        if self.tracker_type not in SUPPORTED_TRACKERS:
            raise ValueError(f"Unknown tracker '{self.tracker_type}'. Use one of {SUPPORTED_TRACKERS}.")
        return TRACKER_CONFIG_DIR / f"{self.tracker_type}.yaml"


@dataclass
class CountingConfig:
    anchor_point: str = "bottom_center"  # 'bottom_center' (ground contact) or 'center'
    hysteresis_buffer_pixels: float = 10.0
    min_frames_between_events: int = 15  # per-track cooldown between two events on one line
    forget_track_after_frames: int = 60  # drop FSM state for tracks unseen this long


@dataclass
class OutputConfig:
    write_review_video: bool = True
    write_annotated_video: bool = False
    start_timestamp: Optional[str] = None  # ISO wall-clock time of frame 0, when known


@dataclass
class AppConfig:
    detector: DetectorConfig = field(default_factory=DetectorConfig)
    tracker: TrackerConfig = field(default_factory=TrackerConfig)
    counting: CountingConfig = field(default_factory=CountingConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "AppConfig":
        path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        if not path.exists():
            return cls()
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        return cls.from_dict(raw)

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "AppConfig":
        return cls(
            detector=_build(DetectorConfig, raw.get("detector")),
            tracker=_build(TrackerConfig, raw.get("tracker")),
            counting=_build(CountingConfig, raw.get("counting")),
            output=_build(OutputConfig, raw.get("output")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def with_overrides(self, **sections: Dict[str, Any]) -> "AppConfig":
        """Returns a copy with selected fields replaced, e.g. with_overrides(tracker={"tracker_type": "botsort"})."""
        updated = self
        for section, values in sections.items():
            if not values:
                continue
            current = getattr(updated, section)
            updated = replace(updated, **{section: replace(current, **values)})
        return updated


def _build(dc_type, values: Optional[Dict[str, Any]]):
    values = values or {}
    known = {f.name for f in fields(dc_type)}
    unknown = set(values) - known
    if unknown:
        raise ValueError(f"Unknown {dc_type.__name__} keys: {sorted(unknown)}")
    return dc_type(**values)


@dataclass(frozen=True)
class Workspace:
    """Folder layout for inputs and outputs. Tests point this at a temporary directory."""

    root: Path

    @classmethod
    def default(cls) -> "Workspace":
        return cls(PROJECT_ROOT)

    @property
    def videos_dir(self) -> Path:
        return self.root / "data" / "videos"

    @property
    def annotations_dir(self) -> Path:
        return self.root / "data" / "annotations"

    @property
    def lines_dir(self) -> Path:
        return self.root / "configs" / "lines"

    @property
    def runs_dir(self) -> Path:
        return self.root / "outputs" / "runs"

    def video_path(self, split: str, name: str) -> Path:
        if split not in VIDEO_SPLITS:
            raise ValueError(f"Split must be one of {VIDEO_SPLITS}")
        return self.videos_dir / split / name

    def lines_path(self, split: str, video_name: str) -> Path:
        return self.lines_dir / f"{split}__{Path(video_name).stem}.json"

    def ensure(self) -> None:
        for split in VIDEO_SPLITS:
            (self.videos_dir / split).mkdir(parents=True, exist_ok=True)
        for path in (self.annotations_dir, self.lines_dir, self.runs_dir):
            path.mkdir(parents=True, exist_ok=True)
