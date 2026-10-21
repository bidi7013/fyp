"""
Spatial primitives for line counting.
Implements the ground-plane anchor, 2D orientation test and signed distance to a line.
All coordinates are image pixels; no ground-plane calibration is assumed.
"""
from dataclasses import dataclass
import math
from typing import Optional, Sequence, Tuple


@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def as_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)


def compute_ground_anchor(bbox: Sequence[float], method: str = "bottom_center") -> Point:
    """
    Computes the pedestrian reference point from a bounding box [x1, y1, x2, y2].
    Bottom-centre approximates the ground contact point, which keeps the counting
    trigger independent of a person's height and the camera's tilt.
    """
    x1, y1, x2, y2 = bbox
    center_x = (x1 + x2) / 2.0
    if method == "bottom_center":
        return Point(x=float(center_x), y=float(y2))
    if method == "center":
        return Point(x=float(center_x), y=(y1 + y2) / 2.0)
    raise ValueError(f"Unknown anchor method: {method}")


def orientation(a: Point, b: Point, c: Point) -> float:
    """
    2D cross product of (b - a) and (c - a).
    > 0: c is on the side the normal n = (-(b.y - a.y), b.x - a.x) points to
    < 0: c is on the opposite side
    = 0: collinear
    """
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)


def point_to_line_distance(point: Point, line_start: Point, line_end: Point) -> float:
    """Signed perpendicular distance, with the same sign convention as orientation()."""
    length = math.hypot(line_end.x - line_start.x, line_end.y - line_start.y)
    if length == 0:
        raise ValueError("Line endpoints must differ")
    return orientation(line_start, line_end, point) / length


def crossing_parameter(p_prev: Point, p_curr: Point, line_start: Point, line_end: Point) -> Optional[float]:
    """
    Where the step p_prev -> p_curr meets the infinite line through line_start/line_end,
    expressed as a fraction along the segment (0 at line_start, 1 at line_end).
    Returns None when the step does not change sides.
    """
    d_prev = orientation(line_start, line_end, p_prev)
    d_curr = orientation(line_start, line_end, p_curr)
    if d_prev == 0 or d_curr == 0 or (d_prev > 0) == (d_curr > 0):
        return None
    t = d_prev / (d_prev - d_curr)
    hit = Point(p_prev.x + t * (p_curr.x - p_prev.x), p_prev.y + t * (p_curr.y - p_prev.y))
    dx, dy = line_end.x - line_start.x, line_end.y - line_start.y
    return ((hit.x - line_start.x) * dx + (hit.y - line_start.y) * dy) / (dx * dx + dy * dy)
