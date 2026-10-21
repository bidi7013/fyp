import pytest

from src.analytics.geometry import Point, compute_ground_anchor, crossing_parameter, orientation, point_to_line_distance


def test_bottom_center_anchor_is_ground_contact_point():
    assert compute_ground_anchor((100, 50, 140, 250)) == Point(120, 250)
    assert compute_ground_anchor((100, 50, 140, 250), "center") == Point(120, 150)
    with pytest.raises(ValueError):
        compute_ground_anchor((0, 0, 1, 1), "top")


def test_orientation_and_signed_distance_share_sign():
    a, b = Point(0, 0), Point(10, 0)
    below, above = Point(5, 3), Point(5, -3)
    assert orientation(a, b, below) > 0 > orientation(a, b, above)
    assert point_to_line_distance(below, a, b) == pytest.approx(3)
    assert point_to_line_distance(above, a, b) == pytest.approx(-3)


def test_crossing_parameter_locates_hit_along_segment():
    a, b = Point(0, 100), Point(200, 100)
    assert crossing_parameter(Point(50, 90), Point(50, 110), a, b) == pytest.approx(0.25)
    assert crossing_parameter(Point(300, 90), Point(300, 110), a, b) == pytest.approx(1.5)  # beyond B
    assert crossing_parameter(Point(50, 90), Point(60, 95), a, b) is None  # same side
