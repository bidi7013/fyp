"""
ASPIRE-Vision Execution Pipeline.
Orchestrates video capture, pedestrian detection, multi-object tracking,
spatial analytics (crossing + occupancy), and CSV event export.
"""
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import numpy as np
except ImportError:
    np = None

from src.analytics.line_counter import LineCrossingTracker
from src.analytics.primitives import Point, compute_ground_anchor
from src.analytics.zone_occupancy import ZoneOccupancyTracker
from src.config import AppConfig, load_zones_config
from src.exporter.csv_logger import CSVEventLogger


class VisionPipeline:
    def __init__(self, config: AppConfig):
        self.config = config
        self.logger = CSVEventLogger(self.config.export.output_csv_path)

        # Load zones
        self.zones_data = load_zones_config(self.config.spatial.zones_config_file)
        self.line_counters: List[LineCrossingTracker] = []
        for line in self.zones_data.get("tripwires", []):
            self.line_counters.append(
                LineCrossingTracker(
                    line_id=line["id"],
                    start_pt=tuple(line["start"]),
                    end_pt=tuple(line["end"]),
                    in_label=line.get("in_label", "CROSS_IN"),
                    out_label=line.get("out_label", "CROSS_OUT"),
                    hysteresis_buffer=self.config.spatial.hysteresis_buffer_pixels,
                )
            )

        self.occupancy_counters: List[ZoneOccupancyTracker] = []
        for zone in self.zones_data.get("occupancy_zones", []):
            self.occupancy_counters.append(
                ZoneOccupancyTracker(
                    zone_id=zone["id"],
                    polygon_vertices=[tuple(p) for p in zone["polygon"]],
                    label=zone.get("label", "OCCUPY"),
                )
            )

    def calculate_timestamp(self, frame_idx: int, fps: float) -> str:
        """Derives real-world ISO timestamp based on start timestamp and elapsed frames."""
        try:
            start_dt = datetime.fromisoformat(self.config.video.start_timestamp)
        except Exception:
            start_dt = datetime.now()
        seconds_elapsed = frame_idx / max(fps, 1.0)
        current_dt = start_dt + timedelta(seconds=seconds_elapsed)
        return current_dt.isoformat(timespec="milliseconds")

    def process_frame_tracks(
        self,
        frame_idx: int,
        tracks: List[Dict[str, any]],
        timestamp: str
    ):
        """
        Processes tracked bounding boxes through spatial analytics and logs output.
        tracks: List of dicts with keys: 'track_id', 'bbox' [x1, y1, x2, y2]
        """
        active_track_points: Dict[int, Point] = {}

        for trk in tracks:
            track_id = trk["track_id"]
            bbox = trk["bbox"]
            anchor = compute_ground_anchor(bbox, method=self.config.spatial.anchor_point)
            active_track_points[track_id] = anchor

            # Evaluate against each tripwire
            for line_counter in self.line_counters:
                event = line_counter.update(
                    frame_id=frame_idx,
                    track_id=track_id,
                    current_pos=anchor,
                    timestamp=timestamp
                )
                if event:
                    self.logger.log_event(
                        frame_id=frame_idx,
                        track_id=track_id,
                        bbox_center_x=anchor.x,
                        bbox_center_y=anchor.y,
                        event_type=event.event_type,
                        timestamp=timestamp
                    )

        # Evaluate regional occupancy
        for occ_counter in self.occupancy_counters:
            count, occ_events = occ_counter.update(
                frame_id=frame_idx,
                tracks=active_track_points,
                timestamp=timestamp
            )
            for event in occ_events:
                self.logger.log_event(
                    frame_id=frame_idx,
                    track_id=event.track_id,
                    bbox_center_x=event.position.x,
                    bbox_center_y=event.position.y,
                    event_type=event.event_type,
                    timestamp=timestamp
                )

        # Cleanup lost tracks in line counters
        for line_counter in self.line_counters:
            line_counter.cleanup_inactive_tracks(list(active_track_points.keys()))

    def run_simulation(self, total_frames: int = 150, width: int = 1280, height: int = 720, fps: float = 30.0):
        """
        Executes a multi-pedestrian spatial simulation across 150 frames.
        Demonstrates line crossing, deadband rejection, re-entry, and regional occupancy.
        Renders an annotated video (if OpenCV is present) and exports events to CSV.
        """
        print(f"\n[Simulation] Initializing {total_frames}-frame simulation ({width}x{height} @ {fps} fps)...")
        output_video_path = Path("data/exports/simulation_demo.mp4")
        writer = None
        if cv2 is not None and np is not None:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))

        peak_occupancy = 0

        for frame_idx in range(1, total_frames + 1):
            timestamp = self.calculate_timestamp(frame_idx, fps)
            tracks = []

            # Pedestrian 1: Enters from top (y:150->700), crosses line at y=700 around frame 60,
            # lingers in polygon, then walks back north crossing out around frame 115
            if frame_idx <= 135:
                if frame_idx < 85:
                    y1 = 350.0 + (frame_idx * 4.5)  # crosses y=700 around frame 77
                else:
                    y1 = 735.0 - ((frame_idx - 85) * 5.0)  # crosses back across y=700 around frame 92
                x1 = 600.0 + (frame_idx * 0.4)
                tracks.append({"track_id": 1, "bbox": [x1 - 25, y1 - 100, x1 + 25, y1]})

            # Pedestrian 2: Enters from top right, crosses line at y=700, stays in zone
            if frame_idx >= 30:
                y2 = 380.0 + ((frame_idx - 30) * 4.2)
                x2 = 1000.0 - ((frame_idx - 30) * 0.8)
                tracks.append({"track_id": 2, "bbox": [x2 - 25, y2 - 100, x2 + 25, y2]})

            # Pedestrian 3: Loiters near the counting line (jitter test between y:694 and y:706)
            # Demonstrates spatial hysteresis: NO duplicate counting events triggered!
            if 40 <= frame_idx <= 110:
                y3 = 700.0 + (6.0 if (frame_idx // 6) % 2 == 0 else -6.0)
                x3 = 800.0 + (frame_idx - 40) * 1.5
                tracks.append({"track_id": 3, "bbox": [x3 - 20, y3 - 90, x3 + 20, y3]})

            # Process through spatial analytics engine
            self.process_frame_tracks(frame_idx, tracks, timestamp)

            # Record peak occupancy
            current_occ = sum(len(occ.current_occupants) for occ in self.occupancy_counters)
            if current_occ > peak_occupancy:
                peak_occupancy = current_occ

            # Optional visual rendering if OpenCV & NumPy are present
            if writer is not None:
                frame = np.zeros((height, width, 3), dtype=np.uint8)
                frame[:] = (20, 24, 30)  # Dark theme canvas

                # Draw Occupancy Zones
                for occ in self.occupancy_counters:
                    pts = np.array(occ.polygon, dtype=np.int32).reshape((-1, 1, 2))
                    overlay = frame.copy()
                    cv2.fillPoly(overlay, [pts], (30, 60, 40))
                    cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
                    cv2.polylines(frame, [pts], isClosed=True, color=(74, 222, 128), thickness=2)
                    cv2.putText(frame, f"ROI: {occ.zone_id} (Count: {len(occ.current_occupants)})",
                                (int(occ.polygon[0][0]) + 15, int(occ.polygon[0][1]) + 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (74, 222, 128), 2)

                # Draw Tripwires
                for line in self.line_counters:
                    pt1 = (int(line.start.x), int(line.start.y))
                    pt2 = (int(line.end.x), int(line.end.y))
                    cv2.line(frame, pt1, pt2, (244, 114, 182), 3)
                    cv2.putText(frame, f"Tripwire: {line.line_id} [IN: {line.total_in} | OUT: {line.total_out}]",
                                (pt1[0], pt1[1] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (244, 114, 182), 2)

                # Draw Tracked Pedestrians
                for trk in tracks:
                    tid = trk["track_id"]
                    bx1, by1, bx2, by2 = [int(v) for v in trk["bbox"]]
                    anchor = compute_ground_anchor(trk["bbox"], method=self.config.spatial.anchor_point)
                    cv2.rectangle(frame, (bx1, by1), (bx2, by2), (56, 189, 248), 2)
                    cv2.rectangle(frame, (bx1, by1 - 22), (bx1 + 65, by1), (56, 189, 248), -1)
                    cv2.putText(frame, f"ID:{tid}", (bx1 + 4, by1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
                    cv2.circle(frame, (int(anchor.x), int(anchor.y)), 6, (0, 255, 255), -1)

                # Top Status Bar
                cv2.rectangle(frame, (0, 0), (width, 50), (10, 15, 20), -1)
                hud = f"Frame: {frame_idx:04d} | Time: {timestamp[11:23]} | Occ: {current_occ} | Total IN: {self.line_counters[0].total_in} | Total OUT: {self.line_counters[0].total_out}"
                cv2.putText(frame, hud, (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

                writer.write(frame)

        if writer is not None:
            writer.release()
            print(f"[Simulation] Annotated video generated: {output_video_path}")

        print(f"\n[Simulation Results]")
        print(f"  Frames Executed: {total_frames}")
        for line in self.line_counters:
            print(f"  Tripwire '{line.line_id}': {line.total_in} CROSS_IN, {line.total_out} CROSS_OUT")
        for occ in self.occupancy_counters:
            print(f"  Occupancy Zone '{occ.zone_id}': Peak Density = {peak_occupancy} occupants")
        print(f"  CSV Events Exported: {self.logger.total_rows_logged} rows logged to {self.config.export.output_csv_path}")

    def close(self):
        self.logger.close()



def run_spatial_verification():
    """
    Executes a mathematical sanity check demonstrating directional line-crossing,
    spatial hysteresis deadband, and multiple legitimate events from one ID.
    Can be run immediately without requiring full video or heavy model weights.
    """
    print("=" * 60)
    print("ASPIRE-Vision: Spatial Mathematics Verification (Sprint 1)")
    print("=" * 60)

    # Define tripwire from (100, 500) to (900, 500) - horizontal line at y = 500
    line_tracker = LineCrossingTracker(
        line_id="TEST_LINE",
        start_pt=(100, 500),
        end_pt=(900, 500),
        hysteresis_buffer=10.0
    )

    # Test Track 1: Moving DOWN across line (from y=480 to y=520) -> should trigger CROSS_IN
    print("\n[Test 1] Simulating Track ID 1 crossing IN (y: 480 -> 520)...")
    event_f1 = line_tracker.update(frame_id=1, track_id=1, current_pos=Point(500, 480), timestamp="2026-10-20T08:00:00.000")
    event_f2 = line_tracker.update(frame_id=2, track_id=1, current_pos=Point(500, 520), timestamp="2026-10-20T08:00:00.033")
    print(f"Frame 1 Event: {event_f1}")
    print(f"Frame 2 Event: {event_f2.event_type if event_f2 else None} (Expected: CROSS_IN)")
    assert event_f2 is not None and event_f2.event_type == "CROSS_IN", "Test 1 Failed!"

    # Test 2: Simulating jitter within hysteresis deadband (y: 520 -> 505 -> 515) -> NO duplicate event
    print("\n[Test 2] Simulating jitter within deadband (y: 520 -> 505 -> 515)...")
    event_f3 = line_tracker.update(frame_id=3, track_id=1, current_pos=Point(500, 505), timestamp="2026-10-20T08:00:00.066")
    event_f4 = line_tracker.update(frame_id=4, track_id=1, current_pos=Point(500, 515), timestamp="2026-10-20T08:00:00.100")
    print(f"Frame 3 Event: {event_f3} (Expected: None)")
    print(f"Frame 4 Event: {event_f4} (Expected: None)")
    assert event_f3 is None and event_f4 is None, "Test 2 Failed!"

    # Test 3: Multiple legitimate events from one ID: Pedestrian turns around and leaves (y: 540 -> 470) -> should trigger CROSS_OUT
    print("\n[Test 3] Simulating multiple legitimate events: Track ID 1 crossing OUT (y: 540 -> 470)...")
    _ = line_tracker.update(frame_id=10, track_id=1, current_pos=Point(500, 540), timestamp="2026-10-20T08:00:00.333")
    event_f11 = line_tracker.update(frame_id=11, track_id=1, current_pos=Point(500, 470), timestamp="2026-10-20T08:00:00.366")
    print(f"Frame 11 Event: {event_f11.event_type if event_f11 else None} (Expected: CROSS_OUT)")
    assert event_f11 is not None and event_f11.event_type == "CROSS_OUT", "Test 3 Failed!"

    # Test 4: Point-in-Polygon Regional Occupancy
    print("\n[Test 4] Testing Regional Polygon Occupancy...")
    foyer_zone = ZoneOccupancyTracker(
        zone_id="FOYER",
        polygon_vertices=[(300, 300), (700, 300), (700, 700), (300, 700)]
    )
    p_inside = Point(500, 500)
    p_outside = Point(800, 500)
    count, events = foyer_zone.update(
        frame_id=20,
        tracks={1: p_inside, 2: p_outside},
        timestamp="2026-10-20T08:00:00.666"
    )
    print(f"Occupancy Count: {count} (Expected: 1, Track 1)")
    assert count == 1 and events[0].track_id == 1, "Test 4 Failed!"

    # Test 5: CSV Log output format
    print("\n[Test 5] Verifying Data Dictionary CSV Export...")
    test_csv = Path("data/exports/test_verification_events.csv")
    logger = CSVEventLogger(test_csv)
    logger.log_event(1, 1, 500.0, 480.0, "OCCUPY", "2026-10-20T08:00:00.000")
    logger.log_event(2, 1, 500.0, 520.0, "CROSS_IN", "2026-10-20T08:00:00.033")
    logger.log_event(11, 1, 500.0, 470.0, "CROSS_OUT", "2026-10-20T08:00:00.366")
    logger.close()
    with open(test_csv, "r") as f:
        print("Generated CSV Header & Content:")
        for line in f.readlines():
            print("  " + line.strip())

    print("\nALL SPRINT 1 MATHEMATICAL & SPATIAL VERIFICATION TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ASPIRE-Vision Pipeline Runner")
    parser.add_argument("--verify", action="store_true", help="Run spatial and mathematical verification tests")
    parser.add_argument("--simulate", action="store_true", help="Run multi-pedestrian 150-frame simulation")
    parser.add_argument("--frames", type=int, default=150, help="Number of simulation frames")
    parser.add_argument("--config", type=str, default="configs/default_config.yaml", help="Path to YAML config")
    args = parser.parse_args()

    if args.simulate:
        cfg = AppConfig.load(args.config)
        pipeline = VisionPipeline(cfg)
        pipeline.run_simulation(total_frames=args.frames)
        pipeline.close()
    elif args.verify or len(sys.argv) == 1:
        run_spatial_verification()
    else:
        cfg = AppConfig.load(args.config)
        pipeline = VisionPipeline(cfg)
        pipeline.run_simulation(total_frames=args.frames)
        pipeline.close()

