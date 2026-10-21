# Data Dictionary: ASPIRE-Vision Outputs

Every processed clip produces one run folder, `outputs/runs/<run_id>/`. All coordinates are **image pixels** with the origin at the top-left of the frame. No ground-plane calibration is applied, so no field is a physical distance, speed or density.

`<run_id>` = `<YYYYMMDD-HHMMSS>_<clip>_<tracker>`, e.g. `20261102-141503_foyer_am_bytetrack`.

| File | Written | Purpose |
|---|---|---|
| `manifest.json` | always | What was run, with which settings, and the totals |
| `events.csv` | always | One row per crossing event |
| `tracks.csv` | always | One row per tracked person per frame |
| `video.webm` | default | Frame-aligned VP8 copy of the clip used by the dashboard |
| `annotated.webm` | optional | Copy with boxes, line and counts drawn in |
| `evaluation.json` | after evaluation | Matching against labels (see evaluation_protocol.md) |
| `ground_truth.csv` | after evaluation | Copy of the labels that were used |

---

## 1. `events.csv`: crossing events

Crossings only. Occupancy and per-frame presence are **not** events and are not logged here.

| Field | Type | Description |
|---|---|---|
| `Event_ID` | int ≥ 1 | Sequential id within the run, ordered by frame |
| `Frame_ID` | int ≥ 0 | Frame where the anchor crossed the line (0-based decode order) |
| `Time_S` | float | `Frame_ID / fps`, seconds from the start of the clip |
| `Timestamp` | ISO 8601 or empty | Wall-clock time, only when `output.start_timestamp` is set |
| `Track_ID` | int ≥ 1 | Temporary tracker id. **Not a person identity**: one person can have several ids, and one id can produce several legitimate events |
| `Line_ID` | string | Counting line that was crossed |
| `Event_Type` | `CROSS_IN` / `CROSS_OUT` | Direction relative to the line's `in_direction` |
| `Anchor_X`, `Anchor_Y` | float px | Bottom-centre of the box at `Frame_ID` |

```csv
Event_ID,Frame_ID,Time_S,Timestamp,Track_ID,Line_ID,Event_Type,Anchor_X,Anchor_Y
1,55,1.833,,1,LINE_1,CROSS_IN,448.0,402.1
2,110,3.667,,2,LINE_1,CROSS_IN,712.9,401.4
3,140,4.667,,1,LINE_1,CROSS_OUT,456.6,396.7
```

## 2. `tracks.csv`: trajectories

| Field | Type | Description |
|---|---|---|
| `Frame_ID` | int ≥ 0 | Frame index |
| `Track_ID` | int ≥ 1 | Tracker id |
| `X1`, `Y1`, `X2`, `Y2` | float px | Box corners (top-left, bottom-right) |
| `Confidence` | float 0–1 | Detector score of the box the tracker associated |
| `Anchor_X`, `Anchor_Y` | float px | Bottom-centre `((X1+X2)/2, Y2)`, the point used for counting |

Every event has a matching `tracks.csv` row (same `Track_ID`, `Frame_ID` and anchor). The dashboard's Summary tab checks this.

## 3. `manifest.json`

| Key | Contents |
|---|---|
| `schema_version`, `run_id`, `created_at`, `source` | Identification; `source` is `video` or `simulation` |
| `git_commit` | Code version (`-dirty` when there were uncommitted changes) |
| `video` | `name`, `path`, `split` (`dev`/`test`), `fps`, `width`, `height`, `frame_count`, `duration_s` |
| `config` | Full effective `AppConfig`: detector, tracker type, counting rule, output options |
| `tracker_parameters` | Contents of the tracker YAML used |
| `lines` | Counting lines: `id`, `name`, `start`, `end`, `in_direction` |
| `counts` | `total` and `by_line`, each `{in, out, net}` |
| `diagnostics` | `tracks_started_in_deadband`, `suppressed_by_cooldown` |
| `tracking` | `tracker`, `unique_tracks`, `track_points`, mean/median track length, `short_tracks` (< 1 s) |
| `performance` | `processing_seconds`, `processing_fps`, `realtime_factor`, `device` |

## 4. Counting line files: `configs/lines/<split>__<clip>.json`

```json
{
  "video": "foyer_am.mp4",
  "split": "dev",
  "lines": [
    { "id": "LINE_1", "name": "Doorway", "start": [200, 400], "end": [1080, 400], "in_direction": [0, 1] }
  ]
}
```

`in_direction` is any vector not parallel to the line; crossing towards the side it points to is `CROSS_IN`.

## 5. Ground truth and evaluation

The label format is in [annotation_rules.md](annotation_rules.md); `evaluation.json` is described in [evaluation_protocol.md](evaluation_protocol.md).
