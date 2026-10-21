"""
Event-level evaluation of predicted crossings against human annotations.

Predicted and ground-truth events are matched one-to-one within each
(line, direction) group when their frames differ by at most `tolerance_frames`.
Closest pairs are matched first. From the matching we report TP / FP / FN,
precision, recall and F1, plus the plain count error (predicted - true).

Both views are needed: a run can have the right *count* while still making
errors that cancel out (one duplicate + one miss), which only the event-level
matching reveals. Identity metrics (MOTA, IDF1) are not computed here because
they require box-level reference labels; see docs/evaluation_protocol.md.
"""
import csv
from datetime import datetime
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional, Tuple

from src.analytics.line_counter import CROSS_IN, CROSS_OUT
from src.export.run_bundle import EVALUATION, GROUND_TRUTH, read_events, read_manifest, write_json

GT_FIELDS = ["Clip_ID", "Frame_ID", "GT_Person_ID", "Line_ID", "Event_Type", "Notes"]
DEFAULT_TOLERANCE_FRAMES = 15
EVENT_TYPES = (CROSS_IN, CROSS_OUT)


def load_ground_truth(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = {"Frame_ID", "Event_Type"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Ground-truth CSV is missing columns: {sorted(missing)}. Expected {GT_FIELDS}.")
        rows = []
        for line_no, row in enumerate(reader, start=2):
            event_type = (row.get("Event_Type") or "").strip().upper()
            if event_type not in EVENT_TYPES:
                raise ValueError(f"Line {line_no}: Event_Type must be CROSS_IN or CROSS_OUT, got '{row.get('Event_Type')}'")
            try:
                frame_id = int(float(row["Frame_ID"]))
            except (TypeError, ValueError):
                raise ValueError(f"Line {line_no}: Frame_ID must be an integer") from None
            rows.append({
                "Clip_ID": (row.get("Clip_ID") or "").strip(),
                "Frame_ID": frame_id,
                "GT_Person_ID": (row.get("GT_Person_ID") or "").strip(),
                "Line_ID": (row.get("Line_ID") or "").strip(),
                "Event_Type": event_type,
                "Notes": (row.get("Notes") or "").strip(),
            })
    return rows


def _rates(tp: int, fp: int, fn: int) -> Dict[str, Optional[float]]:
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    if precision is None or recall is None:
        f1 = None
    elif precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * precision * recall / (precision + recall)
    return {
        "precision": None if precision is None else round(precision, 4),
        "recall": None if recall is None else round(recall, 4),
        "f1": None if f1 is None else round(f1, 4),
    }


def _summary(gt: int, pred: int, tp: int) -> Dict[str, Any]:
    fp, fn = pred - tp, gt - tp
    return {
        "gt_count": gt,
        "pred_count": pred,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        **_rates(tp, fp, fn),
        "count_error": pred - gt,
        "abs_pct_error": round(abs(pred - gt) / gt * 100, 2) if gt else None,
    }


def match_events(
    predicted: List[Dict[str, Any]], ground_truth: List[Dict[str, Any]], tolerance_frames: int
) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """Greedy one-to-one matching (closest frames first) inside each (line, direction) group.
    Returns (matched index pairs, unmatched predicted indices, unmatched ground-truth indices)."""
    candidates = []
    for pi, p in enumerate(predicted):
        for gi, g in enumerate(ground_truth):
            if p["Line_ID"] != g["Line_ID"] or p["Event_Type"] != g["Event_Type"]:
                continue
            delta = abs(p["Frame_ID"] - g["Frame_ID"])
            if delta <= tolerance_frames:
                candidates.append((delta, p["Frame_ID"], pi, gi))
    candidates.sort()
    used_p, used_g, pairs = set(), set(), []
    for _, _, pi, gi in candidates:
        if pi in used_p or gi in used_g:
            continue
        used_p.add(pi)
        used_g.add(gi)
        pairs.append((pi, gi))
    unmatched_p = [i for i in range(len(predicted)) if i not in used_p]
    unmatched_g = [i for i in range(len(ground_truth)) if i not in used_g]
    return pairs, unmatched_p, unmatched_g


def evaluate_events(
    predicted: List[Dict[str, Any]],
    ground_truth: List[Dict[str, Any]],
    line_ids: List[str],
    tolerance_frames: int = DEFAULT_TOLERANCE_FRAMES,
) -> Dict[str, Any]:
    if tolerance_frames < 0:
        raise ValueError("tolerance_frames must be >= 0")
    ground_truth = [dict(g) for g in ground_truth]
    for g in ground_truth:
        if not g["Line_ID"]:
            if len(line_ids) != 1:
                raise ValueError("Ground truth rows need a Line_ID when the run has more than one line")
            g["Line_ID"] = line_ids[0]
    unknown = sorted({g["Line_ID"] for g in ground_truth} - set(line_ids))
    if unknown:
        raise ValueError(f"Ground truth refers to unknown line ids {unknown}; run lines are {line_ids}")

    pairs, unmatched_p, unmatched_g = match_events(predicted, ground_truth, tolerance_frames)
    matched_p = {pi for pi, _ in pairs}

    by_group: Dict[str, Dict[str, Any]] = {}
    for line_id in line_ids:
        for event_type in EVENT_TYPES:
            gt_n = sum(1 for g in ground_truth if g["Line_ID"] == line_id and g["Event_Type"] == event_type)
            idx = [i for i, p in enumerate(predicted) if p["Line_ID"] == line_id and p["Event_Type"] == event_type]
            tp = sum(1 for i in idx if i in matched_p)
            by_group[f"{line_id}:{event_type}"] = {"line_id": line_id, "event_type": event_type, **_summary(gt_n, len(idx), tp)}

    by_direction = {}
    for event_type in EVENT_TYPES:
        groups = [g for g in by_group.values() if g["event_type"] == event_type]
        by_direction[event_type] = _summary(
            sum(g["gt_count"] for g in groups), sum(g["pred_count"] for g in groups), sum(g["tp"] for g in groups)
        )

    overall = _summary(len(ground_truth), len(predicted), len(pairs))
    gt_net = by_direction[CROSS_IN]["gt_count"] - by_direction[CROSS_OUT]["gt_count"]
    pred_net = by_direction[CROSS_IN]["pred_count"] - by_direction[CROSS_OUT]["pred_count"]
    overall["net_flow_error"] = pred_net - gt_net
    overall["mean_abs_frame_offset"] = (
        round(sum(abs(predicted[pi]["Frame_ID"] - ground_truth[gi]["Frame_ID"]) for pi, gi in pairs) / len(pairs), 2)
        if pairs else None
    )

    def pred_ref(p):
        return {k: p[k] for k in ("Event_ID", "Frame_ID", "Track_ID", "Line_ID", "Event_Type")}

    def gt_ref(g):
        return {k: g[k] for k in ("Frame_ID", "GT_Person_ID", "Line_ID", "Event_Type", "Notes")}

    return {
        "tolerance_frames": tolerance_frames,
        "overall": overall,
        "by_direction": by_direction,
        "by_line": list(by_group.values()),
        "matches": sorted(
            [
                {"pred": pred_ref(predicted[pi]), "gt": gt_ref(ground_truth[gi]),
                 "frame_offset": predicted[pi]["Frame_ID"] - ground_truth[gi]["Frame_ID"]}
                for pi, gi in pairs
            ],
            key=lambda m: m["gt"]["Frame_ID"],
        ),
        "false_positives": sorted((pred_ref(predicted[i]) for i in unmatched_p), key=lambda r: r["Frame_ID"]),
        "false_negatives": sorted((gt_ref(ground_truth[i]) for i in unmatched_g), key=lambda r: r["Frame_ID"]),
    }


def evaluate_run(run_dir: Path, gt_path: Path, tolerance_frames: int = DEFAULT_TOLERANCE_FRAMES) -> Dict[str, Any]:
    """Evaluates a run bundle against a ground-truth CSV and stores evaluation.json + a copy of the CSV."""
    run_dir = Path(run_dir)
    manifest = read_manifest(run_dir)
    clip = manifest["video"]["name"]
    ground_truth = load_ground_truth(gt_path)
    clip_ids = {g["Clip_ID"] for g in ground_truth if g["Clip_ID"]}
    warnings = []
    if clip_ids:
        accepted = {clip, Path(clip).stem}
        selected = [g for g in ground_truth if g["Clip_ID"] in accepted or Path(g["Clip_ID"]).stem in accepted]
        if not selected:
            raise ValueError(f"No ground-truth rows have Clip_ID '{clip}' (found {sorted(clip_ids)})")
        if len(selected) < len(ground_truth):
            warnings.append(f"Used {len(selected)} of {len(ground_truth)} rows (Clip_ID = {clip})")
        ground_truth = selected
    if not ground_truth:
        warnings.append("The ground-truth file has no crossing events")

    result = evaluate_events(
        read_events(run_dir), ground_truth, [line["id"] for line in manifest["lines"]], tolerance_frames
    )
    result = {
        "run_id": manifest["run_id"],
        "clip": clip,
        "split": manifest["video"].get("split"),
        "ground_truth_file": Path(gt_path).name,
        "evaluated_at": datetime.now().isoformat(timespec="seconds"),
        "warnings": warnings,
        **result,
    }
    if Path(gt_path).resolve() != (run_dir / GROUND_TRUTH).resolve():
        shutil.copyfile(gt_path, run_dir / GROUND_TRUTH)
    write_json(run_dir / EVALUATION, result)
    return result
