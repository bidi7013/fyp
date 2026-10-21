import pytest

from src.analytics.geometry import Point
from src.analytics.line_counter import CROSS_IN, CROSS_OUT, CountingLine, LineCrossingCounter, lines_from_dicts

LINE = {"id": "L1", "start": [100, 500], "end": [900, 500], "in_direction": [0, 1]}  # IN = moving down


def feed(counter, track_id, ys, x=500, start_frame=0):
    events = []
    for i, y in enumerate(ys):
        ev = counter.update(start_frame + i, track_id, Point(x, y))
        if ev:
            events.append(ev)
    return events


def make(buffer=10.0, cooldown=0, line=LINE):
    return LineCrossingCounter(CountingLine.from_dict(line), buffer, cooldown)


def test_crossing_down_is_in_and_dated_to_the_crossing_frame():
    counter = make()
    events = feed(counter, 1, [470, 490, 505, 515])
    assert [e.event_type for e in events] == [CROSS_IN]
    assert events[0].frame_id == 2 and events[0].confirmed_frame == 3
    assert (counter.total_in, counter.total_out) == (1, 0)


def test_flipping_in_direction_swaps_labels():
    counter = make(line={**LINE, "in_direction": [0, -1]})
    assert [e.event_type for e in feed(counter, 1, [470, 520])] == [CROSS_OUT]


def test_jitter_inside_deadband_never_counts():
    counter = make()
    events = feed(counter, 1, [480] + [494, 506] * 20)
    assert events == []


def test_step_over_and_back_is_not_a_crossing():
    counter = make()
    assert feed(counter, 1, [470, 505, 490, 470]) == []


def test_legitimate_reentry_by_same_id_counts_each_time():
    counter = make()
    events = feed(counter, 7, [470, 530, 560, 470, 440, 530])
    assert [e.event_type for e in events] == [CROSS_IN, CROSS_OUT, CROSS_IN]


def test_cooldown_suppresses_rapid_reversal():
    counter = make(cooldown=15)
    events = feed(counter, 1, [470, 530, 470])
    assert [e.event_type for e in events] == [CROSS_IN]
    assert counter.suppressed_by_cooldown == 1


def test_anchor_exactly_on_line_is_still_counted():
    counter = make()
    assert [e.frame_id for e in feed(counter, 1, [480, 500, 520])] == [2]


def test_crossing_beyond_segment_end_is_ignored():
    counter = make()
    assert feed(counter, 1, [470, 530], x=950) == []


def test_track_born_in_deadband_is_not_counted_on_first_crossing():
    counter = make()
    assert feed(counter, 1, [505, 495, 480]) == []
    assert counter.tracks_started_in_deadband == 1


def test_stale_tracks_are_forgotten_but_brief_dropouts_are_not():
    counter = make()
    feed(counter, 1, [470])
    counter.forget_stale(30, max_age_frames=60)
    assert [e.event_type for e in feed(counter, 1, [530], start_frame=31)] == [CROSS_IN]
    counter.forget_stale(200, max_age_frames=60)
    assert feed(counter, 1, [470], start_frame=201) == []  # state was reset, so no OUT


def test_line_validation():
    with pytest.raises(ValueError):
        CountingLine.from_dict({**LINE, "in_direction": [1, 0]})  # parallel to the line
    with pytest.raises(ValueError):
        CountingLine.from_dict({**LINE, "end": LINE["start"]})
    with pytest.raises(ValueError):
        lines_from_dicts([LINE, LINE])
    default = CountingLine.from_dict({k: v for k, v in LINE.items() if k != "in_direction"})
    assert default.in_sign == 1
