# ASPIRE-Vision: Pedestrian Crossing Counts from Recorded Video

**Major Project (CAT405 Intelligent Computing)**
* **Student**: Adam Zafry Bin Zaharin
* **Supervisor**: Dr. Fadratul Hafinaz Hassan

ASPIRE-Vision counts pedestrians crossing a virtual line in **recorded single-camera video**, shows every crossing against the footage, and measures counting accuracy against human labels. It covers the plan's minimum complete workflow:

> load an approved video → detect and track pedestrians → count crossings → display counts and trajectories → save/export a record → compare with annotations

Out of scope by design: live CCTV, cross-camera identity matching, occupancy/density claims (no ground-plane calibration), automated facility control and alerts.

---

## 1. Architecture

```
 data/videos/{dev,test}/clip.mp4
            │
            ▼
 ┌─────────────────────────┐   configs/default_config.yaml
 │ Tracking                │   configs/trackers/{bytetrack,botsort}.yaml
 │ YOLOv8 (person) +       │
 │ ByteTrack or BoT-SORT   │   src/tracking/tracker.py
 └───────────┬─────────────┘
             │ per frame: track id, box, confidence
             ▼
 ┌─────────────────────────┐   configs/lines/<split>__<clip>.json
 │ Line counting           │
 │ bottom-centre anchor →  │   src/analytics/geometry.py
 │ hysteresis FSM per line │   src/analytics/line_counter.py
 └───────────┬─────────────┘
             ▼
 ┌─────────────────────────┐
 │ Run bundle              │   src/export/run_bundle.py
 │ manifest.json           │   outputs/runs/<run_id>/
 │ events.csv  tracks.csv  │
 │ video.webm              │
 └───────────┬─────────────┘
             ├──────────────► Evaluation vs labels  (src/evaluation/evaluate.py)
             ▼
 ┌─────────────────────────┐
 │ Local API (FastAPI)     │   src/api/server.py   ◄── dashboard/ (React)
 └─────────────────────────┘
```

`src/processing.py` runs the loop. The CLI (`src/cli.py`) and the API call the same functions, so every result in the dashboard can be reproduced from the command line.

## 2. Folder layout

```
configs/
  default_config.yaml        detector, tracker, counting and output settings
  trackers/                  ByteTrack and BoT-SORT parameters (versioned copies)
  lines/                     counting lines per clip (written by the dashboard)
data/
  videos/dev/                clips used for tuning
  videos/test/               held-out clips used for reported results
  annotations/               ground-truth crossing labels (CSV)
outputs/runs/<run_id>/       one folder per processed clip + configuration
docs/                        semantics, data dictionary, annotation and evaluation protocol
src/                         Python pipeline, evaluation, API and CLI
tests/                       pytest suite
dashboard/                   React + TypeScript + Tailwind dashboard
```

## 3. Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cd dashboard && npm install
```

The first real run downloads the YOLOv8n weights (`yolov8n.pt`, about 6 MB) from Ultralytics.

## 4. Running

Two processes during development:

```bash
python -m src.cli serve               # API on http://127.0.0.1:8000
npm --prefix dashboard run dev        # dashboard on http://localhost:5173
```

Or build the dashboard once (`npm --prefix dashboard run build`) and `python -m src.cli serve` alone serves both at http://127.0.0.1:8000.

In the dashboard: **Videos** → upload a clip to the dev or test set → **New run** → drag the counting line onto the first frame and set the IN direction → choose ByteTrack or BoT-SORT → **Start processing**. Open the run to review crossings, then upload labels on the **Evaluation** tab.

No footage yet? **Create demo run** renders a synthetic scene with scripted pedestrians, including one missed and one duplicated count, and evaluates it against its true crossings.

### Command line

```bash
python -m src.cli run --video data/videos/dev/clip.mp4 [--tracker botsort] [--lines lines.json] [--annotated]
python -m src.cli evaluate --run <run_id> --gt data/annotations/clip_gt.csv [--tolerance 15]
python -m src.cli simulate
python -m pytest
```

## 5. Outputs

Each run folder contains `manifest.json` (config snapshot, counts, diagnostics, throughput, code version), `events.csv` (crossings only) and `tracks.csv` (trajectories). Field definitions: [docs/data_dictionary.md](docs/data_dictionary.md).

## 6. Documentation

| Document | Contents |
|---|---|
| [docs/objective_feature_map.md](docs/objective_feature_map.md) | Objectives → features → code → evidence → weekly target |
| [docs/counting_semantics.md](docs/counting_semantics.md) | What is counted, the line-crossing FSM, ID-switch failure modes |
| [docs/data_dictionary.md](docs/data_dictionary.md) | Every exported file and field |
| [docs/annotation_rules.md](docs/annotation_rules.md) | How to label ground-truth crossings |
| [docs/evaluation_protocol.md](docs/evaluation_protocol.md) | Dev/test discipline, matching rule, metrics and their limits |
| [docs/interface_sketch.md](docs/interface_sketch.md) | Dashboard structure and the purpose of each view |
