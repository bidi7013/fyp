# Data Dictionary: ASPIRE-Vision System Outputs

A crucial component of the MVP is the structured data export. The system generates CSV files logging both trajectory points and discrete counting events, strictly utilizing image-space coordinates (pixels) unless ground-plane calibration is performed.

---

## 1. Output Schema Specification

| Field Name | Data Type | Constraint / Format | Description & Usage |
| :--- | :--- | :--- | :--- |
| **`Frame_ID`** | `Integer` | $\ge 0$, sequential | The sequential frame index from the processed video source. Essential for frame-accurate temporal synchronization. |
| **`Track_ID`** | `Integer` | $\ge 1$, local ID | Temporary technical identifier assigned by the MOT algorithm (e.g., ByteTrack/DeepSORT). Not persistent across different videos. |
| **`BBox_Center_X`** | `Float` | $[0.0, W_{frame}]$ | Pixel X-coordinate of the pedestrian's base center ($x_{min} + \frac{w}{2}$), used for ground-plane boundary logic. |
| **`BBox_Center_Y`** | `Float` | $[0.0, H_{frame}]$ | Pixel Y-coordinate of the pedestrian's base center ($y_{min} + h = y_{max}$), anchoring the pedestrian to the floor. |
| **`Event_Type`** | `String` | Categorical | Discrete trigger classification: `CROSS_IN`, `CROSS_OUT`, or `OCCUPY`. |
| **`Timestamp`** | `DateTime` | `YYYY-MM-DDTHH:MM:SS.sss` | Derived real-world timestamp computed as: $T_0 + \frac{\text{Frame\_ID}}{\text{FPS}}$. |

---

## 2. Event Types & Semantics

* **`CROSS_IN`**: Emitted on the exact frame when a track trajectory intersects a designated virtual tripwire in the defined positive direction (e.g., entering a corridor or building).
* **`CROSS_OUT`**: Emitted on the exact frame when a track trajectory intersects the tripwire in the negative / opposite direction (e.g., leaving the area).
* **`OCCUPY`**: Emitted periodically (or logged per tracked pedestrian per frame) indicating presence within a designated polygon Region of Interest (ROI).

---

## 3. Sample CSV Row Output

```csv
Frame_ID,Track_ID,BBox_Center_X,BBox_Center_Y,Event_Type,Timestamp
124,3,640.5,702.1,CROSS_IN,2026-10-20T08:00:04.133
125,3,642.0,705.8,OCCUPY,2026-10-20T08:00:04.166
125,4,912.4,540.2,OCCUPY,2026-10-20T08:00:04.166
188,3,710.2,698.4,CROSS_OUT,2026-10-20T08:00:06.266
```
