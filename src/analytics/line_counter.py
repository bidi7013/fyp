"""
Directional Line Crossing Counter.
Implements a Finite State Machine (FSM) with spatial hysteresis deadbands
to prevent line-jitter duplicate counts while correctly registering legitimate re-entries.
"""
from enum import Enum
from typing import Dict, List, Optional, Tuple
from src.analytics.primitives import Point, orientation, point_to_line_distance, segments_intersect


class TrackLineState(Enum):
    UNKNOWN = "UNKNOWN"
    SIDE_A = "SIDE_A"  # Typically "OUTSIDE"
    SIDE_B = "SIDE_B"  # Typically "INSIDE"
    DEADBAND = "DEADBAND"  # Within hysteresis boundary


class CrossingEvent:
    def __init__(self, frame_id: int, track_id: int, position: Point, event_type: str, timestamp: str):
        self.frame_id = frame_id
        self.track_id = track_id
        self.position = position
        self.event_type = event_type  # "CROSS_IN" or "CROSS_OUT"
        self.timestamp = timestamp


class LineCrossingTracker:
    def __init__(
        self,
        line_id: str,
        start_pt: Tuple[float, float],
        end_pt: Tuple[float, float],
        in_label: str = "CROSS_IN",
        out_label: str = "CROSS_OUT",
        hysteresis_buffer: float = 15.0,
    ):
        self.line_id = line_id
        self.start = Point(start_pt[0], start_pt[1])
        self.end = Point(end_pt[0], end_pt[1])
        self.in_label = in_label
        self.out_label = out_label
        self.hysteresis_buffer = hysteresis_buffer

        # Track history: track_id -> previous Point
        self.track_history: Dict[int, Point] = {}
        # Track confirmed side: track_id -> TrackLineState
        self.track_states: Dict[int, TrackLineState] = {}
        # Cumulative metrics
        self.total_in = 0
        self.total_out = 0

    def get_side(self, point: Point) -> Tuple[TrackLineState, float]:
        """
        Determines which side of the line a point lies on, and its signed distance.
        """
        dist = point_to_line_distance(point, self.start, self.end)
        if abs(dist) < self.hysteresis_buffer:
            return TrackLineState.DEADBAND, dist
        elif dist > 0:
            return TrackLineState.SIDE_A, dist
        else:
            return TrackLineState.SIDE_B, dist

    def update(
        self,
        frame_id: int,
        track_id: int,
        current_pos: Point,
        timestamp: str
    ) -> Optional[CrossingEvent]:
        """
        Evaluates track position against virtual tripwire.
        Returns a CrossingEvent if a valid directional crossing occurred, else None.
        """
        current_state, dist = self.get_side(current_pos)

        # If track has no prior history, initialize state and history
        if track_id not in self.track_history:
            self.track_history[track_id] = current_pos
            if current_state != TrackLineState.DEADBAND:
                self.track_states[track_id] = current_state
            else:
                self.track_states[track_id] = TrackLineState.UNKNOWN
            return None

        prev_pos = self.track_history[track_id]
        prev_confirmed_state = self.track_states.get(track_id, TrackLineState.UNKNOWN)

        event = None

        # Check trajectory intersection with tripwire
        if segments_intersect(prev_pos, current_pos, self.start, self.end):
            # Evaluate transition direction using 2D cross-product
            orient_prev = orientation(self.start, self.end, prev_pos)
            orient_curr = orientation(self.start, self.end, current_pos)

            if orient_prev < 0 and orient_curr > 0:
                # Transitioned from SIDE_B to SIDE_A -> "CROSS_IN"
                # Strictly requires track to have been confirmed on SIDE_B
                if prev_confirmed_state == TrackLineState.SIDE_B:
                    self.total_in += 1
                    event = CrossingEvent(frame_id, track_id, current_pos, self.in_label, timestamp)
                    self.track_states[track_id] = TrackLineState.DEADBAND  # Lock in deadband until cleared
            elif orient_prev > 0 and orient_curr < 0:
                # Transitioned from SIDE_A to SIDE_B -> "CROSS_OUT"
                # Strictly requires track to have been confirmed on SIDE_A
                if prev_confirmed_state == TrackLineState.SIDE_A:
                    self.total_out += 1
                    event = CrossingEvent(frame_id, track_id, current_pos, self.out_label, timestamp)
                    self.track_states[track_id] = TrackLineState.DEADBAND  # Lock in deadband until cleared

        # Update confirmed state ONLY once track clears the hysteresis deadband
        if current_state in (TrackLineState.SIDE_A, TrackLineState.SIDE_B):
            self.track_states[track_id] = current_state

        # Update history
        self.track_history[track_id] = current_pos
        return event

    def cleanup_inactive_tracks(self, active_track_ids: List[int]):
        """Remove tracks that have left the scene to keep memory bounded."""
        active_set = set(active_track_ids)
        to_delete = [tid for tid in self.track_history if tid not in active_set]
        for tid in to_delete:
            del self.track_history[tid]
            self.track_states.pop(tid, None)
