"""
Directional line-crossing counter.

Each track keeps a small finite state machine per counting line:

* its *confirmed side* of the line (+1 / -1, or 0 when it was first seen inside the
  deadband), which only changes once the anchor is more than `hysteresis_buffer`
  pixels away from the line;
* the most recent raw crossing of the line (frame and whether it fell inside the
  A-B segment).

A crossing event is emitted when the confirmed side flips. The event is dated to
the frame where the anchor actually crossed the line, so it can be compared with
human annotations. Jitter inside the deadband never flips the confirmed side, and
a person who steps over and back again clears the pending crossing, so neither
produces an event. One track ID can legitimately produce several events (enter,
leave, re-enter), limited only by the per-track cooldown.
"""
from dataclasses import dataclass
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.analytics.geometry import Point, crossing_parameter, orientation, point_to_line_distance

CROSS_IN = "CROSS_IN"
CROSS_OUT = "CROSS_OUT"
_LINE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@dataclass(frozen=True)
class CountingLine:
    """A virtual counting line A->B with an explicit IN direction."""

    line_id: str
    name: str
    start: Point
    end: Point
    in_direction: Tuple[float, float]

    def __post_init__(self):
        if not _LINE_ID_PATTERN.match(self.line_id):
            raise ValueError(f"Invalid line id '{self.line_id}' (letters, digits, '_' and '-' only)")
        if self.start == self.end:
            raise ValueError(f"Line '{self.line_id}' has identical endpoints")
        if self.in_sign == 0:
            raise ValueError(f"Line '{self.line_id}': in_direction must not be parallel to the line")

    @property
    def normal(self) -> Tuple[float, float]:
        return (-(self.end.y - self.start.y), self.end.x - self.start.x)

    @property
    def in_sign(self) -> int:
        """+1 if IN means moving to the positive-orientation side, -1 otherwise."""
        nx, ny = self.normal
        dot = nx * self.in_direction[0] + ny * self.in_direction[1]
        return 0 if dot == 0 else (1 if dot > 0 else -1)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CountingLine":
        start = Point(*map(float, data["start"]))
        end = Point(*map(float, data["end"]))
        direction = data.get("in_direction")
        if direction is None:
            direction = (-(end.y - start.y), end.x - start.x)
        return cls(
            line_id=str(data["id"]),
            name=str(data.get("name") or data["id"]),
            start=start,
            end=end,
            in_direction=(float(direction[0]), float(direction[1])),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.line_id,
            "name": self.name,
            "start": [self.start.x, self.start.y],
            "end": [self.end.x, self.end.y],
            "in_direction": list(self.in_direction),
        }


@dataclass(frozen=True)
class CrossingEvent:
    frame_id: int  # frame where the anchor crossed the line
    confirmed_frame: int  # frame where it cleared the deadband on the other side
    track_id: int
    line_id: str
    event_type: str  # CROSS_IN or CROSS_OUT
    position: Point  # anchor at frame_id


@dataclass
class _PendingCrossing:
    frame_id: int
    within_segment: bool
    position: Point


@dataclass
class _TrackState:
    confirmed_side: int
    last_seen: int
    ref_position: Optional[Point]  # last position strictly off the line
    ref_sign: int
    pending: Optional[_PendingCrossing] = None
    last_event_frame: Optional[int] = None


class LineCrossingCounter:
    def __init__(self, line: CountingLine, hysteresis_buffer: float = 10.0, min_frames_between_events: int = 15):
        self.line = line
        self.hysteresis_buffer = float(hysteresis_buffer)
        self.min_frames_between_events = int(min_frames_between_events)
        self._states: Dict[int, _TrackState] = {}
        self.total_in = 0
        self.total_out = 0
        self.suppressed_by_cooldown = 0
        self.tracks_started_in_deadband = 0

    def side_of(self, point: Point) -> int:
        """Confirmed-side reading: 0 inside the deadband, otherwise +1 / -1."""
        dist = point_to_line_distance(point, self.line.start, self.line.end)
        if abs(dist) < self.hysteresis_buffer:
            return 0
        return 1 if dist > 0 else -1

    def update(self, frame_id: int, track_id: int, position: Point) -> Optional[CrossingEvent]:
        raw = orientation(self.line.start, self.line.end, position)
        raw_sign = 0 if raw == 0 else (1 if raw > 0 else -1)
        side = self.side_of(position)

        state = self._states.get(track_id)
        if state is None:
            self._states[track_id] = _TrackState(
                confirmed_side=side,
                last_seen=frame_id,
                ref_position=position if raw_sign else None,
                ref_sign=raw_sign,
            )
            if side == 0:
                self.tracks_started_in_deadband += 1
            return None

        state.last_seen = frame_id
        if raw_sign != 0:
            if state.ref_sign != 0 and raw_sign != state.ref_sign and state.ref_position is not None:
                t = crossing_parameter(state.ref_position, position, self.line.start, self.line.end)
                state.pending = _PendingCrossing(frame_id, t is not None and 0.0 <= t <= 1.0, position)
            state.ref_position, state.ref_sign = position, raw_sign

        if side == 0:
            return None
        if side == state.confirmed_side:
            # Back on the confirmed side: a step over and back is not a crossing.
            state.pending = None
            return None

        event = None
        if state.confirmed_side != 0 and state.pending is not None and state.pending.within_segment:
            crossed_at = state.pending.frame_id
            if state.last_event_frame is not None and crossed_at - state.last_event_frame < self.min_frames_between_events:
                self.suppressed_by_cooldown += 1
            else:
                event_type = CROSS_IN if side == self.line.in_sign else CROSS_OUT
                if event_type == CROSS_IN:
                    self.total_in += 1
                else:
                    self.total_out += 1
                state.last_event_frame = crossed_at
                event = CrossingEvent(
                    frame_id=crossed_at,
                    confirmed_frame=frame_id,
                    track_id=track_id,
                    line_id=self.line.line_id,
                    event_type=event_type,
                    position=state.pending.position,
                )
        state.confirmed_side = side
        state.pending = None
        return event

    def forget_stale(self, frame_id: int, max_age_frames: int) -> None:
        """Drops state for tracks not seen for more than max_age_frames, keeping memory bounded."""
        stale = [tid for tid, s in self._states.items() if frame_id - s.last_seen > max_age_frames]
        for tid in stale:
            del self._states[tid]


def lines_from_dicts(items: Sequence[Dict[str, Any]]) -> List[CountingLine]:
    lines = [CountingLine.from_dict(item) for item in items]
    ids = [line.line_id for line in lines]
    if len(ids) != len(set(ids)):
        raise ValueError("Counting line ids must be unique")
    if not lines:
        raise ValueError("At least one counting line is required")
    return lines
