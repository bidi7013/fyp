# Dashboard Structure

The dashboard (`dashboard/`, React + TypeScript + Tailwind) is a review tool for processed runs. It talks only to the local API (`python -m src.cli serve`) and reads the same run bundle files that are exported, so what it shows is what was saved.

## Navigation

Values in these sketches are illustrative only, not results.

```
┌────────────┬──────────────────────────────────────────────────────┐
│ ASPIRE-    │  Runs                       [Create demo run] [New run]│
│ Vision     │  ┌───────────────────────────────────────────────────┐ │
│            │  │ Clip        Tracker   In  Out  Net  F1   Speed    │ │
│ Runs       │  │ foyer_am    ByteTrack 41  37   +4   86%  22 fps   │ │
│ New run    │  │ foyer_am    BoT-SORT  42  37   +5   88%  15 fps   │ │
│ Videos     │  └───────────────────────────────────────────────────┘ │
│ Compare    │                                                        │
│            │                                                        │
│ ▓▓▓░ job   │                                                        │
│ ● API      │                                                        │
└────────────┴──────────────────────────────────────────────────────┘
```

| Page | Purpose |
|---|---|
| **Runs** | Every processed clip and configuration, job progress, demo run |
| **New run** | 1. pick or upload a clip; 2. drag the counting line onto the first frame and set the IN arrow; 3. choose tracker and settings |
| **Videos** | Dev and test clip lists, upload, which clips already have a line |
| **Compare** | Up to four runs side by side, with counting, accuracy and tracking diagnostics kept separate |

## Run page

```
┌──────────────────────────────────────────────┬──────────────────────┐
│  video with overlay: line + IN arrow,        │ Counted up to frame  │
│  boxes, ids, 2 s trails, crossing flashes    │  In 3  Out 1  Net +2 │
│                                              ├──────────────────────┤
│                                              │ Track #7 (selected)  │
├──────────────────────────────────────────────┤ seen frames 180–236  │
│ |◀ ◁ ▶ ▷ ▶| Frame 231 of 299   0.25× … 2×    ├──────────────────────┤
├──────────────────────────────────────────────┤ Crossing events      │
│ ▲ ○   ▲      ○ ▲▲        IN lane             │ ▲ In  #1   0:01.83   │
│ ────────────────┼──────────────── time  ▼    │ ▲ In  #2   0:03.67   │
│        ▼          ◌     OUT lane             │ ▼ Out #1   0:04.67   │
└──────────────────────────────────────────────┴──────────────────────┘
```

* **Review**: the video is synced to the frame index using `requestVideoFrameCallback` and the run's own fps. The overlay is drawn from `tracks.csv` and `events.csv`, so it can be switched on and off. The crossing timeline puts IN events above the axis and OUT events below; labelled crossings appear as rings, and missed ones as dashed rings. Click or drag the timeline, or click an event, to seek. Keys: Space play/pause, ←/→ one frame, Shift+←/→ one second.
* **Summary**: totals, throughput, crossings over time, track-length distribution, the **"Do the exports agree?"** check (manifest vs `events.csv` vs the review counter vs `tracks.csv`) and label-free tracking diagnostics.
* **Evaluation**: upload labels and set the tolerance, then see precision, recall, F1 and count error by direction, and a list of every extra or missed count that links to its frame in Review.
* **Details**: downloads of every bundle file, provenance (code version, device), detector, tracker and counting settings, and the data dictionary.

## Visual rules

* IN is always blue and OUT always orange (a colour-blind-safe pair), and both always carry a ▲/▼ shape or a word, so colour is never the only cue.
* Highlighter yellow marks only "what you selected": the current event or the selected track.
* Light and dark themes follow the system setting. Layouts work down to phone width.
