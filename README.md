# ASPIRE-Vision: Intelligent Pedestrian Analytics & Counting System

**Major Project (CAT405 Intelligent Computing)**  
* **Student**: Adam Zafry Bin Zaharin  
* **Supervisor**: Dr. Fadratul Hafinaz Hassan  

ASPIRE-Vision is an intelligent single-camera pedestrian detection, tracking, and spatial analytics system developed using an iterative **Minimum Viable Product (MVP)** approach.

---

## 1. System Architecture

The system operates strictly on recorded offline video through three sequential modules:

```
[Offline Video] 
      │
      ▼
1. Processing Module  ──> YOLOv8 Detection + ByteTrack/DeepSORT
      │
      ▼
2. Spatial Analytics  ──> Line-Crossing Logic (FSM) + Regional Occupancy Math
      │
      ▼
3. UI & Export        ──> React/Tailwind Dashboard + Data Dictionary CSV Logs
```

---

## 2. Directory Layout

```
fyp/
├── configs/
│   ├── default_config.yaml       # Primary pipeline hyperparameters & paths
│   └── camera_zones.json         # Tripwire lines & polygon ROI coordinates
├── data/
│   ├── raw/
│   │   ├── dev/                  # Development videos (for algorithm tuning)
│   │   └── test/                 # Held-out test videos (for reporting)
│   ├── annotations/              # Manual ground truth evaluation logs
│   ├── exports/                  # Standardized CSV output event logs
│   └── samples/                  # Pilot test clips
├── docs/
│   ├── counting_semantics.md     # Mathematical formulation & FSM logic
│   ├── annotation_rules.md       # Ground-truth manual labeling protocol
│   ├── data_dictionary.md        # CSV output schema specification
│   ├── interface_sketch.md       # Dashboard wireframe & UI layout
│   └── sprint_logs/              # Weekly supervision meeting records
├── src/
│   ├── analytics/                # Pure geometry, FSM line counter, and polygon occupancy
│   ├── detection/                # YOLOv8 detector adapters
│   ├── tracking/                 # ByteTrack/DeepSORT tracker adapters
│   ├── exporter/                 # CSV event logger conforming to Data Dictionary
│   ├── config.py                 # Configuration loader
│   └── pipeline.py               # Main execution runner & self-verification suite
├── dashboard/                    # React + Tailwind offline dashboard (Week 3)
└── requirements.txt              # Python dependencies
```

---

## 3. Quickstart & Verification

### Running the Mathematical & Spatial Verification Suite
To immediately verify the spatial math, line-crossing Finite State Machine, hysteresis deadband rejection, and CSV logging:

```bash
python -m src.pipeline --verify
```

### Running Full Video Processing (Once models/video are loaded)
```bash
python -m src.pipeline --config configs/default_config.yaml
```

---

## 4. Standard Data Output Schema

All outputs conform to the project Data Dictionary:
`Frame_ID,Track_ID,BBox_Center_X,BBox_Center_Y,Event_Type,Timestamp`
