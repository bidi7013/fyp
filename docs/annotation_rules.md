# ASPIRE-Vision: Ground-Truth Annotation Rules

To evaluate the system on two independent axes (**tracking quality** and **functional counting error**), human annotations must follow a strict, standardized protocol.

---

## 1. Objective of Annotations
The manual ground-truth data serves as the baseline to evaluate:
1. **Counting Error Rate**:
   $$\text{Error}_{\text{count}} = \frac{|\text{Count}_{\text{pred}} - \text{Count}_{\text{GT}}|}{\text{Count}_{\text{GT}}} \times 100\%$$
2. **Precision & Recall on Discrete Crossing Events**:
   $$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}, \quad \text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

---

## 2. Event Labeling Rules

### 2.1 Crossing Event Trigger Frame
* **Definition**: A crossing event (`CROSS_IN` or `CROSS_OUT`) occurs at the **exact frame** where the pedestrian's ground contact point (the point between both feet on the pavement/floor) traverses across the defined line vector $\overline{\mathbf{A}\mathbf{B}}$.
* **Striding / Stance**: If one foot is on side A and the second foot has stepped across to side B, the crossing frame is declared when the midpoint of the base of support crosses the virtual line.

### 2.2 Directional Classification
* Label as **`CROSS_IN`** if the subject moves in the positive normal direction (e.g., street into building).
* Label as **`CROSS_OUT`** if the subject moves in the negative normal direction (e.g., building out to street).

### 2.3 Handling Edge Cases
* **Loitering / Wandering Near Line**: If a person walks along the line without their base center traversing it, **NO** crossing event is logged.
* **Groups / Walking in Pairs**: Each person is labeled as an independent ground-truth track with their own crossing timestamp, regardless of physical proximity.
* **Carried Objects & Strollers**: The bounding anchor is the human feet contact point; bags, carts, or umbrellas must not be counted as separate pedestrian entities.
* **Turnarounds**: If a person approaches the line, steps one foot over, changes their mind, and retreats, **DO NOT** count unless the full center of stance crossed the hysteresis boundary.

---

## 3. Ground Truth Annotation Schema (`gt_events.csv`)

Ground truth event records must be stored in `data/annotations/` using the following schema:

```csv
Clip_ID,Frame_ID,GT_Pedestrian_ID,Event_Type,Notes
pilot_01.mp4,142,1,CROSS_IN,Clear crossing
pilot_01.mp4,180,2,CROSS_IN,Partial occlusion by pillar
pilot_01.mp4,310,1,CROSS_OUT,Legitimate re-exit of subject 1
```
