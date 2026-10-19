# ASPIRE-Vision: Counting Semantics & Spatial Mathematics

This document formalizes the mathematical and algorithmic foundations of pedestrian spatial analytics in ASPIRE-Vision, addressing the Week 1 reasoning focus:
1. **Differentiating occupancy vs. directional crossings**
2. **Handling multiple legitimate events from one ID**

---

## 1. Pedestrian Spatial Representation: Ground-Plane Anchor Point

In single-camera monocular vision, perspective projection causes the bounding box height and center to shift depending on camera tilt and person height.
The **pedestrian base center (bottom-center)** represents the contact point between the pedestrian and the ground plane:

$$\mathbf{p}(t) = \begin{bmatrix} x_{\text{base}}(t) \\ y_{\text{base}}(t) \end{bmatrix} = \begin{bmatrix} x_{\min}(t) + \frac{w(t)}{2} \\ y_{\min}(t) + h(t) \end{bmatrix}$$

* **Advantage**: Decouples boundary triggering from torso height variations, head movements, and camera pitch tilt.

---

## 2. Directional Line-Crossing Analytics

### 2.1 Virtual Tripwire Definition
A virtual line $\mathcal{L}$ is defined by two endpoints $\mathbf{A} = (A_x, A_y)$ and $\mathbf{B} = (B_x, B_y)$ in pixel coordinates:
$$\vec{\mathbf{v}}_{AB} = \mathbf{B} - \mathbf{A}$$

The normal direction vector defining the **"IN"** direction is chosen orthogonal to $\vec{\mathbf{v}}_{AB}$:
$$\vec{\mathbf{n}} = \begin{bmatrix} -(B_y - A_y) \\ B_x - A_x \end{bmatrix}$$

### 2.2 Trajectory Segment Intersection
For a tracked pedestrian $\text{ID}_k$, let their position at frame $t-1$ be $\mathbf{P}_{t-1}$ and at frame $t$ be $\mathbf{P}_t$.
A crossing event requires that the line segment $\overline{\mathbf{P}_{t-1}\mathbf{P}_t}$ intersects the tripwire segment $\overline{\mathbf{A}\mathbf{B}}$.

Using 2D cross-products:
$$\text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}) = (B_x - A_x)(P_y - A_y) - (B_y - A_y)(P_x - A_x)$$

An intersection occurs if and only if:
1. $\text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_{t-1}) \times \text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_t) < 0$
2. $\text{Orient}(\mathbf{P}_{t-1}, \mathbf{P}_t, \mathbf{A}) \times \text{Orient}(\mathbf{P}_{t-1}, \mathbf{P}_t, \mathbf{B}) < 0$

### 2.3 Direction Determination
The transition sign determines the event classification:
* **`CROSS_IN`**: $\text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_{t-1}) < 0 \land \text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_t) > 0$
* **`CROSS_OUT`**: $\text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_{t-1}) > 0 \land \text{Orient}(\mathbf{A}, \mathbf{B}, \mathbf{P}_t) < 0$

---

## 3. Regional Occupancy Analytics

### 3.1 Polygon Region of Interest (ROI)
A region $\mathcal{R}$ is defined by an ordered set of $N$ polygon vertices:
$$\mathcal{P} = \{ \mathbf{V}_1, \mathbf{V}_2, \dots, \mathbf{V}_N \}, \quad \mathbf{V}_i \in \mathbb{R}^2$$

### 3.2 Point-in-Polygon (PIP) Formulation
At frame $t$, the regional occupancy count $O_{\mathcal{R}}(t)$ is the instantaneous sum of active tracked objects whose anchor point resides inside $\mathcal{P}$:

$$O_{\mathcal{R}}(t) = \sum_{k \in \mathcal{T}(t)} \mathbb{I}\left( \mathbf{p}_k(t) \in \mathcal{P} \right)$$

where $\mathbb{I}(\cdot)$ is the indicator function evaluated using the Jordan Curve (Ray-Casting) Theorem or Winding Number algorithm.

---

## 4. Differentiating Occupancy vs. Directional Crossings

| Dimension | Regional Occupancy (`OCCUPY`) | Directional Crossing (`CROSS_IN` / `CROSS_OUT`) |
| :--- | :--- | :--- |
| **Mathematical Nature** | **State Variable (Stock)**: Evaluated at an instantaneous point in time $t$. | **Flux / Event Variable (Flow)**: Line integral of velocity across a boundary over interval $\Delta t$. |
| **Temporal Persistence** | Continuous: logged or updated every frame while the subject remains inside. | Discrete impulse: emitted at the single frame boundary transition. |
| **Error Propagation** | Self-correcting: if a track is temporarily lost and recovered inside, occupancy updates back to ground truth. | Cumulative: a missed crossing or duplicate count permanently offsets total counts unless manually adjusted. |
| **Use Case** | Crowd density monitoring, room capacity limits, dwell-time estimation. | Turnstile throughput, net flow calculation: $\Delta N = \sum \text{CROSS\_IN} - \sum \text{CROSS\_OUT}$. |

---

## 5. Handling Multiple Legitimate Events from One ID

A naive system might simply maintain a set of counted IDs: `if track_id in counted: ignore`.
**This fails in real campus environments**, where a student may legitimately enter a building, leave 10 minutes later, and re-enter.

### 5.1 Finite State Machine (FSM) with Spatial Hysteresis
To prevent **line chattering** (rapid bouncing back and forth across the line due to tracking jitter or wandering near the threshold) while allowing **legitimate re-entries**, each track maintains an internal state:

```
               [Distance > +d_hysteresis]
                    +--------------------+
                    |                    |
                    v                    |
            +---------------+    CROSS_IN   +--------------+
            |  ZONE_OUTSIDE | ------------> |  ZONE_INSIDE |
            +---------------+               +--------------+
                    |                               |
                    |           CROSS_OUT           |
                    +-------------------------------+
                       [Distance < -d_hysteresis]
```

### 5.2 State Machine Rules
1. **Hysteresis Deadband**: A buffer zone of $\pm d_{\text{hysteresis}}$ pixels (e.g., 15–25 px depending on camera resolution) flanks the virtual tripwire.
2. **State Transition Requirements**:
   * A track in `ZONE_OUTSIDE` crossing the line emits `CROSS_IN` and enters `PENDING_INSIDE`.
   * The event is locked, and the track is only transitioned to `ZONE_INSIDE` once its anchor point clears $+d_{\text{hysteresis}}$ pixels away from the line.
   * While within the buffer, no new crossing events can be triggered by this ID.
   * A subsequent `CROSS_OUT` is only permitted if the ID was confirmed in `ZONE_INSIDE`.
3. **Temporal Cooldown**: A minimal threshold $\Delta t_{\min}$ (e.g., 30 frames / 1 second) must elapse before an inverse crossing is accepted, eliminating camera occlusion flicker.
