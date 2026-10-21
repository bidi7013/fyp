# Objective → Feature Map

How each part of the FYP plan is met by the system, where the work lives, and what to bring to supervision as evidence.

| Plan objective | Feature | Code / UI | Evidence to show | Target |
|---|---|---|---|---|
| Use an approved recorded video, keeping dev and test separate | Video library with dev/test splits; one split per clip | `data/videos/`, `src/api/server.py`, Videos page | Clip list per split; split recorded in every manifest | 26 Oct |
| Define what is counted | Directional crossing events; occupancy excluded | `docs/counting_semantics.md` | Answer to "occupancy, unique ids or crossings?" | 26 Oct |
| Annotation rules and data fields | Label protocol, data dictionary | `docs/annotation_rules.md`, `docs/data_dictionary.md` | Labelled CSV for a pilot clip | 26 Oct |
| Simple end-to-end interface | Dashboard: runs, review, evaluation | `dashboard/` | Walkthrough of the demo run | 26 Oct |
| Pretrained detector + one tracker | YOLOv8n person detector with ByteTrack | `src/tracking/tracker.py`, `configs/trackers/bytetrack.yaml` | A processed dev clip | 2 Nov |
| Display trajectories and a crossing count | Video overlay with boxes, ids, trails, live counts | Review tab | Screenshots or recording at a crossing | 2 Nov |
| Export a sample record | Run bundle with events, tracks and manifest | `src/export/run_bundle.py`, Details tab | `events.csv`, `tracks.csv`, `manifest.json` | 2 Nov |
| Why an id switch can duplicate a count | Deadband FSM; deadband-birth diagnostic; demo scene | `src/analytics/line_counter.py`, `src/simulate.py` | Demo run: P6 duplicate (FP), P5 miss (FN) | 2 Nov |
| Minimal dashboard connected to exports | Summary tab reads the same bundle files | Summary tab | KPI strip, crossings-over-time chart | 9 Nov |
| Dashboard, event log and exports agree | Consistency check across manifest, `events.csv`, review counter and `tracks.csv` | Summary tab, "Do the exports agree?" | All checks agree | 9 Nov |
| Second tracker configuration | BoT-SORT | `configs/trackers/botsort.yaml`, New run page | Two runs on the same clip | 9 Nov |
| Compare with annotations | Event matching with tolerance; precision, recall, F1, count error | `src/evaluation/evaluate.py`, Evaluation tab | `evaluation.json`, error list | 16 Nov |
| Record failures and throughput | Failure list linking to frames; processing fps and real-time factor | Evaluation tab, manifest `performance` | Failure cases with frames; fps per device | 16 Nov |
| Separate tracking claims from counting claims | Compare page splits tracking diagnostics from counting accuracy | Compare page, `docs/evaluation_protocol.md` | Side-by-side table, ByteTrack vs BoT-SORT | 16 Nov |
| Reproducibility | Config, tracker parameters and code version in every manifest; CLI equals UI | `src/cli.py`, `manifest.json` | Re-run from the CLI with identical counts | ongoing |
| Testing partitions | Unit tests for geometry, FSM, evaluation, bundle and API | `tests/` (`python -m pytest`) | Test report | 16 Nov |

## Intelligent method and why it was chosen

* **YOLOv8n** (pretrained on COCO): a single, lightweight, well-documented person detector that runs on a laptop CPU or GPU. No custom training is needed for the MVP.
* **ByteTrack**: associates high- and low-confidence boxes, which keeps ids through partial occlusion, a common cause of missed crossings. **BoT-SORT** adds camera-motion compensation and is the second configuration to test whether better association changes counting accuracy.
* **Hysteresis line-crossing FSM**: turns noisy per-frame tracks into discrete, dated events, while still allowing legitimate re-entries.

Together these turn raw video into the event log that the dashboard displays and that evaluation scores.
