# Evaluation Protocol

How results are produced so that they support the claims made about them. Implementation: `src/evaluation/evaluate.py`.

---

## 1. Development and test separation

* Clips live in `data/videos/dev/` or `data/videos/test/`, never both. The API refuses to add a clip to both sets.
* **Tune on dev only**: line position, deadband, cooldown, detector confidence and tracker choice.
* **Report on test**: process test clips once, with the settings frozen from dev. Every manifest records the split, the full configuration and the code version, so this can be checked afterwards.
* Use complete recordings. Do not cut the "good" parts out of a clip.

## 2. Event matching

For each line and direction separately, predicted events and labelled crossings are paired **one-to-one** when `|frame_pred − frame_label| ≤ tolerance`. Closest pairs are matched first.

* matched pair → **TP**
* predicted event with no label → **FP** (extra count, e.g. a duplicate after an id switch)
* label with no predicted event → **FN** (missed crossing)

## 3. Metrics

| Metric | Formula | Answers |
|---|---|---|
| Precision | TP / (TP + FP) | How many counted events were real? |
| Recall | TP / (TP + FN) | How many real crossings were counted? |
| F1 | 2PR / (P + R) | Single summary of event accuracy |
| Count error | predicted − labelled | How far off is the total? |
| Absolute % error | \|count error\| / labelled × 100 | The same, relative |
| Net flow error | (IN − OUT)pred − (IN − OUT)label | Error in the derived net flow |
| Mean frame offset | mean \|Δframe\| over matches | Timing accuracy of matched events |

**Always report both event-level and count-level results.** A run can have zero count error while still making one duplicate and one miss that cancel out. The demo run shows exactly this.

## 4. Tracking quality vs counting quality

Tracking diagnostics in the manifest (unique tracks, short tracks, tracks born in the deadband) are computed **without labels**. They indicate fragmentation but are not accuracy measures.

* **MOTA, IDF1 and other identity metrics are not reported** unless box-level, identity-consistent reference labels exist for the clip (for example MOT-format annotations). Crossing labels alone cannot support them.
* If tracking diagnostics improve (fewer, longer tracks) but counting precision and recall do not, the supported claim is only that the tracker produced more stable tracks on those clips. It is not a claim that counting improved. Compare runs on the **same clip** on the Compare page.

## 5. Throughput

`performance.processing_fps` is frames processed per second for the whole pipeline (decode, detection, tracking, counting, export, review video encode) on the recorded `device`. `realtime_factor` = processing fps / clip fps. Report the device alongside the number.

## 6. What the results do not support

* Physical speed, distance or density: no ground-plane calibration is done.
* Generalisation beyond the recorded camera views and conditions in the test set.
* Person re-identification across clips or cameras.

## 7. `evaluation.json`

| Key | Contents |
|---|---|
| `run_id`, `clip`, `split`, `ground_truth_file`, `evaluated_at`, `tolerance_frames`, `warnings` | Context |
| `overall` | gt/pred counts, TP/FP/FN, precision, recall, F1, count error, abs % error, net flow error, mean frame offset |
| `by_direction` | Same metrics for `CROSS_IN` and `CROSS_OUT` |
| `by_line` | Same metrics per line and direction |
| `matches` | Matched pairs with frame offsets |
| `false_positives`, `false_negatives` | Every error, with frames, for failure-case review |
