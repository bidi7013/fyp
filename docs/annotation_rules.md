# Ground-Truth Annotation Rules

Labels are what counting accuracy is measured against, so they follow a fixed protocol. Label **people and their crossings**, never tracker ids.

---

## 1. File format

One CSV per clip (or one CSV covering several clips) in `data/annotations/`, one row per crossing:

```csv
Clip_ID,Frame_ID,GT_Person_ID,Line_ID,Event_Type,Notes
foyer_am.mp4,142,1,LINE_1,CROSS_IN,clear crossing
foyer_am.mp4,180,2,LINE_1,CROSS_IN,partly hidden by pillar
foyer_am.mp4,310,1,LINE_1,CROSS_OUT,same person leaves again
```

| Column | Required | Rule |
|---|---|---|
| `Clip_ID` | recommended | Clip file name. Rows for other clips are ignored when a run is evaluated |
| `Frame_ID` | yes | 0-based frame index, as shown in the dashboard's frame counter |
| `GT_Person_ID` | recommended | Your own person number within the clip; consistent across that person's crossings |
| `Line_ID` | when the clip has more than one line | Must match a line id in the run |
| `Event_Type` | yes | `CROSS_IN` or `CROSS_OUT`, using the IN arrow shown in the dashboard |
| `Notes` | no | Anything that explains a hard case (occlusion, group, turnaround) |

The **Evaluation** tab offers a template CSV with the right columns.

## 2. When to label a crossing

* **Crossing frame**: the first frame in which the midpoint between the person's feet is past the line. Step through frames in the Review tab (Left/Right keys) to find it.
* **Commitment**: only label a crossing if the person then continues clearly onto the other side (about a body-width). Someone who steps over and turns back is **not** a crossing.
* **Segment**: only crossings between the line's two end points count.
* **Direction**: `CROSS_IN` if they move the way the IN arrow points, otherwise `CROSS_OUT`.

## 3. Edge cases

* **Walking along the line** without their feet clearly crossing: no label.
* **Groups**: every person gets their own row, even when walking side by side.
* **Bags, prams, umbrellas**: not people; never labelled.
* **Re-entry**: label every crossing. The same `GT_Person_ID` may appear several times.
* **Fully occluded crossing**: label it at your best estimate of the frame and add a note. These are expected misses and worth discussing.

## 4. Tolerance

Labels and system events are matched when their frames differ by at most the **tolerance** (default 15 frames, 0.5 s at 30 fps). This absorbs the ambiguity of choosing "the" crossing frame by eye. State the tolerance whenever results are reported.

## 5. Process

1. Label clips **before** looking at the system's output for them, so the system cannot bias the labels.
2. Label test-set clips independently, ideally by a second person, as the plan requires.
3. Keep labels under version control. Never edit labels after seeing a run's errors unless the label itself was wrong; if so, record why in `Notes`.
