# ASPIRE-Vision: End-to-End Interface Specification & Wireframe

This document outlines the user interface architecture and visual wireframe for the ASPIRE-Vision client dashboard, scheduled for implementation in Week 3 using **React** and **Tailwind CSS**.

---

## 1. Visual Layout Wireframe

```
+---------------------------------------------------------------------------------------------------------+
| [LOGO] ASPIRE-Vision Pedestrian Analytics Dashboard           [Cam: Main Foyer v] [FPS: 29.8] [Offline]  |
+---------------------------------------------------------------------------------------------------------+
|                                                      |  KPI METRICS & SPATIAL GAUGES                     |
|  VIDEO PLAYBACK & SPATIAL OVERLAY CANVAS             |  +-----------------------+---------------------+  |
|                                                      |  | CURRENT OCCUPANCY     | NET FLOW (IN - OUT) |  |
|  +------------------------------------------------+  |  |      18 Persons       |       +34           |  |
|  | [Frame: 0142 | 00:04.733]                      |  |  |  (Zone Capacity: 50)  | (In: 58 | Out: 24)  |  |
|  |                                                |  |  +-----------------------+---------------------+  |
|  |      o-------o [ID: 3]                         |  |                                                   |
|  |      | Person|                                 |  |  HOURLY / TEMPORAL FLOW CHART                     |
|  |      o---*---o (Ground Anchor)                 |  |  +---------------------------------------------+  |
|  |          |                                     |  |  | [||]   [||] [||]     [||]             [||]  |  |
|  |  - - - - v - - - - - - - - - - - - - - - - -   |  |  | 08:00  08:15 08:30   08:45           09:00 |  |
|  |  ==== LINE_MAIN_ENTRANCE (Tripwire) ========   |  |  +---------------------------------------------+  |
|  |                                                |  |                                                   |
|  |  +------------------------------------------+  |  |  EVENT TRIGGER CONTROLS & OVERLAYS                |
|  |  | ZONE_FOYER (Regional Occupancy Polygon)  |  |  |  [x] Show Bounding Boxes   [x] Show Trajectories  |
|  |  | Density: 0.12 persons/m²                 |  |  |  [x] Show Counting Lines   [x] Show Occupancy ROI |
|  |  +------------------------------------------+  |  |                                                   |
|  +------------------------------------------------+  |  EXPORT ACTIONS                                   |
|  [> Play] [|| Pause] [<< -5s] [>> +5s]  [Timeline===] |  [Download CSV Log]    [Load Custom Log File]     |
+---------------------------------------------------------------------------------------------------------+
| REAL-TIME EVENT STREAM & CSV LOG VIEWER                                                                 |
| +----------+----------+-----------------+-----------------+---------------+---------------------------+ |
| | Frame_ID | Track_ID | BBox_Center_X   | BBox_Center_Y   | Event_Type    | Timestamp                 | |
| +----------+----------+-----------------+-----------------+---------------+---------------------------+ |
| | 124      | 3        | 640.50 px       | 702.10 px       | CROSS_IN      | 2026-10-20T08:00:04.133   | |
| | 125      | 3        | 642.00 px       | 705.80 px       | OCCUPY        | 2026-10-20T08:00:04.166   | |
| | 125      | 4        | 912.40 px       | 540.20 px       | OCCUPY        | 2026-10-20T08:00:04.166   | |
| | 188      | 3        | 710.20 px       | 698.40 px       | CROSS_OUT     | 2026-10-20T08:00:06.266   | |
| +----------+----------+-----------------+-----------------+---------------+---------------------------+ |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Component Hierarchy

1. **`Navbar`**:
   * System status pill (Offline / Processing / Completed).
   * Video source selector.
   * Frame rate and processing throughput indicator.
2. **`VideoCanvas`**:
   * Renders the processed video stream or annotated frame sequences.
   * SVG overlay layer rendering dynamic tripwires, polygon zones, pedestrian anchor points, and trajectory trails.
3. **`MetricCards`**:
   * **Real-Time Occupancy**: Displays instantaneous count inside the active polygon ROI.
   * **Directional Crossings**: Dual counters displaying cumulative `CROSS_IN` vs. `CROSS_OUT`.
   * **Net Accumulation**: Instant differential flow ($\Delta N = \text{In} - \text{Out}$).
4. **`EventLogTable`**:
   * Virtualized table displaying real-time events synced with the video scrubber.
   * Strictly adheres to the **Data Dictionary schema**.
   * One-click "Export CSV" button saving to local storage.

---

## 3. Offline Architecture Rationale
As mandated by the implementation plan, live CCTV integration is excluded. The dashboard operates entirely on the client side:
* **Zero Backend Dependency**: Can load pre-exported CSV files and video files directly via the browser File System Access API or local static assets.
* **Synchronized Playback**: Video playback timestamp strictly drives the active row highlight in the event log table.
