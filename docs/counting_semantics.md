# Counting Semantics

What ASPIRE-Vision counts, and exactly when a count happens. Implementation: `src/analytics/geometry.py`, `src/analytics/line_counter.py`.

---

## 1. What is measured

ASPIRE-Vision measures **directional line crossings**: discrete events, each with a frame, a direction and the tracker id that produced it.

| Quantity | Kind | Reported? |
|---|---|---|
| Crossings IN / OUT per line | Events (flow) | Yes, the primary output |
| Net flow (IN − OUT) | Derived from events | Yes |
| Unique track ids | Tracker artefact | Only as a diagnostic. An id is not a person |
| Occupancy / density | State (stock) | **No.** Out of scope; needs ground-plane calibration |

**One person can contribute several legitimate events.** Someone who enters, leaves and re-enters produces IN, OUT, IN. Counting "unique ids that crossed" would be wrong both ways: it undercounts re-entries and overcounts people whose id changed.

## 2. Reference point

Each box `[x1, y1, x2, y2]` is reduced to its **bottom-centre** `p = ((x1 + x2) / 2, y2)`, an approximation of where the person touches the ground. Using the feet rather than the box centre keeps the trigger independent of the person's height and of the camera tilt.

## 3. Line, sides and direction

A line runs from **A** to **B**. For a point **P**:

    orient(A, B, P) = (Bx − Ax)(Py − Ay) − (By − Ay)(Px − Ax)
    d(P) = orient(A, B, P) / |AB|          (signed distance in pixels)

The sign of `d` says which side of the line P is on. Each line also stores an **`in_direction`** vector, set in the dashboard by flipping the arrow. Moving to the side that `in_direction` points to is `CROSS_IN`; the opposite is `CROSS_OUT`.

## 4. The crossing rule (finite state machine with hysteresis)

Each (track, line) pair keeps:

* **confirmed side**: +1 or −1, or 0 if the track was first seen inside the deadband;
* **pending crossing**: the latest frame where the anchor changed sides, and whether that crossing point lies **within segment AB**;
* **last event frame**, for the cooldown.

The rule each frame:

1. Compute `d(p)`. If `|d| < hysteresis_buffer_pixels`, the anchor is in the **deadband** and the confirmed side does not change.
2. If the anchor changed sides since the last off-line position, record a pending crossing: its frame, and whether the crossing point projects inside A–B.
3. When the anchor is outside the deadband **on the opposite side** from the confirmed side:
   * if there is a pending crossing inside the segment, emit an event **dated to the crossing frame**;
   * unless the same track produced an event less than `min_frames_between_events` frames earlier (cooldown), in which case the event is suppressed and counted in `diagnostics.suppressed_by_cooldown`;
   * in either case the confirmed side flips.
4. When the anchor is back outside the deadband on the **same** side, any pending crossing is discarded. A step over and back is not a crossing.

Consequences:

| Situation | Result |
|---|---|
| Walks straight across | 1 event at the frame the feet crossed the line |
| Jitters within ±buffer of the line | No event |
| Steps over, turns back | No event |
| Crosses beyond A or B | No event (side flips silently) |
| Enters, leaves, re-enters | 3 events from one id |
| Reverses within the cooldown | Second event suppressed |
| Lost for a few frames, then found again with the same id | State kept for `forget_track_after_frames` |

Defaults (`configs/default_config.yaml`): buffer 10 px, cooldown 15 frames, forget after 60 frames.

## 5. Identity switches near the line (week 2 question)

The FSM works per **track id**. When the tracker swaps or re-creates an id close to the line, the per-id state is wrong, and the count can be wrong in either direction:

* **Missed count.** The new id is born **inside the deadband**, so it has no confirmed side, and its first crossing is not counted. `diagnostics.tracks_started_in_deadband` counts these births.
* **Duplicate count.** The old id has already been counted. The new id appears on the **original** side, for example because an occluded, shorter box puts its feet back above the line, and then "crosses" again. One person produces two events with different ids.

Both cases are reproduced in the synthetic demo scene (`src/simulate.py`, people P5 and P6) and show up in its evaluation as one false negative and one false positive. In that run the total count error is zero, because the two errors cancel. This is why event-level matching is reported alongside the count error.

Mitigations to evaluate on dev clips: a wider deadband (fewer births inside it, but later confirmation), a longer tracker `track_buffer` (fewer re-created ids), placing the line away from occluders, and comparing ByteTrack with BoT-SORT.

## 6. Known limits

* Pixel-space only: no speed or density claims without calibration.
* A track first seen inside the deadband is never counted on its first crossing (conservative choice).
* Crossings during long occlusions depend entirely on the tracker keeping the id.
