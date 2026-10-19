"""
Regional Occupancy Analytics.
Calculates instantaneous crowd density within designated polygon regions of interest.
"""
from typing import Dict, List, Tuple
from src.analytics.primitives import Point, point_in_polygon


class OccupancyEvent:
    def __init__(self, frame_id: int, track_id: int, position: Point, event_type: str, timestamp: str):
        self.frame_id = frame_id
        self.track_id = track_id
        self.position = position
        self.event_type = event_type  # "OCCUPY"
        self.timestamp = timestamp


class ZoneOccupancyTracker:
    def __init__(self, zone_id: str, polygon_vertices: List[Tuple[float, float]], label: str = "OCCUPY"):
        self.zone_id = zone_id
        self.polygon = polygon_vertices
        self.label = label
        self.current_occupants: List[int] = []

    def update(
        self,
        frame_id: int,
        tracks: Dict[int, Point],
        timestamp: str
    ) -> Tuple[int, List[OccupancyEvent]]:
        """
        Calculates instantaneous occupancy at frame_id.
        Returns:
            occupancy_count: Total pedestrians inside the polygon.
            events: List of OccupancyEvents for each person currently inside.
        """
        occupants = []
        events = []

        for track_id, pos in tracks.items():
            if point_in_polygon(pos, self.polygon):
                occupants.append(track_id)
                events.append(
                    OccupancyEvent(
                        frame_id=frame_id,
                        track_id=track_id,
                        position=pos,
                        event_type=self.label,
                        timestamp=timestamp
                    )
                )

        self.current_occupants = occupants
        return len(occupants), events
