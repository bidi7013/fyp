# Sprint 1 Log: Setup & Definitions
**Submission Target**: Monday, 26 October 2026  
**Student**: Adam Zafry Bin Zaharin  
**Supervisor**: Dr. Fadratul Hafinaz Hassan  

---

## 1. Sprint Deliverables Checklist
- [x] Project architecture and directory structure initialized.
- [x] Defined Data Dictionary conforming to system requirements.
- [x] Defined spatial analytics semantics and mathematical formulations.
- [x] Established ground-truth annotation protocol.
- [x] End-to-end interface sketch / wireframe designed.
- [ ] Sample pilot clip ingested and baseline pipeline runnable.

---

## 2. Supervisor Reasoning Question Focus

### Question: Differentiating Occupancy vs. Directional Crossings
* **Response Summary**:
  * *Occupancy* represents an instantaneous state measurement ($N(t)$ individuals inside polygon $\mathcal{P}$ at time $t$). It is memoryless and self-correcting; if a tracker drops an ID for a few frames inside the zone and reacquires it, the occupancy metric corrects itself.
  * *Directional Crossing* represents a cumulative flux / event counter ($C_{\text{in}}, C_{\text{out}}$ across boundary line $\overline{\mathbf{A}\mathbf{B}}$). It is discrete and irreversible; any misclassified crossing or duplicate count creates permanent drift in cumulative pedestrian counts.
  * Separating these two metrics ensures capacity monitoring (occupancy) is not corrupted by boundary crossing errors, and throughput flow (crossings) is measured with high temporal precision.

### Question: Handling Multiple Legitimate Events from One ID
* **Response Summary**:
  * A naive filter (`ignore if track_id already counted`) fails whenever a pedestrian enters, exits, and returns later in the same video.
  * ASPIRE-Vision employs a **Finite State Machine with Spatial Hysteresis**:
    1. A spatial buffer zone ($\pm d_{\text{buffer}}$) surrounds the counting tripwire.
    2. An event triggers upon line intersection and transitions the ID to a pending buffer state.
    3. The crossing event is only finalized once the person clears the hysteresis deadband into the opposite zone.
    4. An inverse crossing is only permitted if the ID was confirmed in the opposite zone for a minimum cooldown duration, filtering tracking jitter while accommodating real-world pedestrian re-entries.
