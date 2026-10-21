import pytest

from src.evaluation.evaluate import evaluate_events, load_ground_truth


def pred(event_id, frame, event_type="CROSS_IN", track=1, line="L1"):
    return {"Event_ID": event_id, "Frame_ID": frame, "Track_ID": track, "Line_ID": line, "Event_Type": event_type}


def gt(frame, event_type="CROSS_IN", person="1", line="L1"):
    return {"Clip_ID": "c", "Frame_ID": frame, "GT_Person_ID": person, "Line_ID": line, "Event_Type": event_type, "Notes": ""}


def test_perfect_match():
    r = evaluate_events([pred(1, 10), pred(2, 50, "CROSS_OUT")], [gt(12), gt(49, "CROSS_OUT")], ["L1"], 5)
    assert (r["overall"]["tp"], r["overall"]["fp"], r["overall"]["fn"]) == (2, 0, 0)
    assert r["overall"]["f1"] == 1.0
    assert r["overall"]["mean_abs_frame_offset"] == 1.5


def test_tolerance_is_inclusive():
    assert evaluate_events([pred(1, 15)], [gt(10)], ["L1"], 5)["overall"]["tp"] == 1
    assert evaluate_events([pred(1, 16)], [gt(10)], ["L1"], 5)["overall"]["tp"] == 0


def test_direction_must_agree():
    r = evaluate_events([pred(1, 10, "CROSS_OUT")], [gt(10, "CROSS_IN")], ["L1"], 5)
    assert (r["overall"]["fp"], r["overall"]["fn"]) == (1, 1)


def test_duplicate_is_false_positive_even_when_closest_frame_wins():
    r = evaluate_events([pred(1, 20, track=7), pred(2, 27, track=8)], [gt(20)], ["L1"], 15)
    assert r["overall"]["tp"] == 1
    assert [fp["Track_ID"] for fp in r["false_positives"]] == [8]


def test_cancelling_errors_give_zero_count_error_but_imperfect_f1():
    r = evaluate_events([pred(1, 10), pred(2, 100)], [gt(12), gt(300)], ["L1"], 15)
    assert r["overall"]["count_error"] == 0
    assert (r["overall"]["fp"], r["overall"]["fn"]) == (1, 1)
    assert r["overall"]["f1"] == 0.5


def test_missing_line_id_defaults_to_single_line_and_unknown_lines_fail():
    r = evaluate_events([pred(1, 10)], [gt(10, line="")], ["L1"], 5)
    assert r["overall"]["tp"] == 1
    with pytest.raises(ValueError):
        evaluate_events([], [gt(10, line="")], ["L1", "L2"], 5)
    with pytest.raises(ValueError):
        evaluate_events([], [gt(10, line="L9")], ["L1"], 5)


def test_empty_ground_truth_reports_undefined_recall():
    r = evaluate_events([pred(1, 10)], [], ["L1"], 5)
    assert r["overall"]["recall"] is None and r["overall"]["precision"] == 0.0


def test_load_ground_truth_validates(tmp_path):
    good = tmp_path / "gt.csv"
    good.write_text("Clip_ID,Frame_ID,GT_Person_ID,Line_ID,Event_Type,Notes\nc,5,1,L1,cross_in,ok\n", encoding="utf-8")
    assert load_ground_truth(good)[0]["Event_Type"] == "CROSS_IN"
    bad = tmp_path / "bad.csv"
    bad.write_text("Frame_ID,Event_Type\n5,OCCUPY\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_ground_truth(bad)
