export type EventType = 'CROSS_IN' | 'CROSS_OUT' | 'OCCUPY';

export interface EventLogEntry {
  Frame_ID: number;
  Track_ID: number;
  BBox_Center_X: number;
  BBox_Center_Y: number;
  Event_Type: EventType;
  Timestamp: string;
}

export interface TripwireConfig {
  id: string;
  name: string;
  start: [number, number];
  end: [number, number];
  direction_vector?: [number, number];
  in_label: string;
  out_label: string;
}

export interface OccupancyZoneConfig {
  id: string;
  name: string;
  polygon: Array<[number, number]>;
  label: string;
}

export interface CameraZonesConfig {
  camera_id: string;
  resolution: {
    width: number;
    height: number;
  };
  tripwires: TripwireConfig[];
  occupancy_zones: OccupancyZoneConfig[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentFrame: number;
  fps: number;
}
