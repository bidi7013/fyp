"""
Spatial Primitives and Geometry Utilities.
Implements ground-plane anchor calculations, 2D orientation tests,
segment intersection, and Point-in-Polygon (PIP) ray casting.
"""
from dataclasses import dataclass
import math
from typing import List, Optional, Tuple


@dataclass
class Point:
    x: float
    y: float

    def as_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)


def compute_ground_anchor(bbox: Tuple[float, float, float, float], method: str = "bottom_center") -> Point:
    """
    Computes pedestrian ground contact point from bounding box [x1, y1, x2, y2].
    Using bottom-center decouples spatial triggers from torso/head height variations.
    """
    x1, y1, x2, y2 = bbox
    center_x = (x1 + x2) / 2.0
    if method == "bottom_center":
        return Point(x=center_x, y=float(y2))
    elif method == "center":
        return Point(x=center_x, y=(y1 + y2) / 2.0)
    else:
        raise ValueError(f"Unknown anchor method: {method}")


def orientation(a: Point, b: Point, c: Point) -> float:
    """
    Computes the 2D cross-product orientation of triplet (a, b, c).
    > 0: Counter-clockwise (Left of directed vector AB)
    < 0: Clockwise (Right of directed vector AB)
    = 0: Collinear
    """
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)


def segments_intersect(p1: Point, p2: Point, q1: Point, q2: Point) -> bool:
    """
    Determines whether line segment p1-p2 intersects segment q1-q2.
    """
    o1 = orientation(p1, p2, q1)
    o2 = orientation(p1, p2, q2)
    o3 = orientation(q1, q2, p1)
    o4 = orientation(q1, q2, p2)

    # General intersection condition: segments straddle each other
    if ((o1 > 0 and o2 < 0) or (o1 < 0 and o2 > 0)) and \
       ((o3 > 0 and o4 < 0) or (o3 < 0 and o4 > 0)):
        return True

    return False


def point_in_polygon(point: Point, polygon: List[Tuple[float, float]]) -> bool:
    """
    Point-in-Polygon test using the Ray Casting (Jordan Curve) algorithm.
    polygon: list of (x, y) tuples in clockwise or counter-clockwise order.
    """
    n = len(polygon)
    inside = False
    x, y = point.x, point.y

    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if min(p1y, p2y) < y <= max(p1y, p2y):
            if x <= max(p1x, p2x):
                if p1y != p2y:
                    x_inters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                if p1x == p2x or x <= x_inters:
                    inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def point_to_line_distance(point: Point, line_start: Point, line_end: Point) -> float:
    """
    Signed perpendicular distance from point to line passing through line_start and line_end.
    Directly aligns with orientation(line_start, line_end, point) for consistent sign semantics.
    """
    dx = line_end.x - line_start.x
    dy = line_end.y - line_start.y
    length = math.hypot(dx, dy)
    if length == 0:
        return math.hypot(point.x - line_start.x, point.y - line_start.y)
    
    return orientation(line_start, line_end, point) / length

