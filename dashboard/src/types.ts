// Shapes returned by the local API (src/api/server.py). Field names in events
// and tracks match the CSV columns in docs/data_dictionary.md.

export type EventType = 'CROSS_IN' | 'CROSS_OUT';
export type Split = 'dev' | 'test';
export type TrackerType = 'bytetrack' | 'botsort';

export interface CountingLine {
  id: string;
  name: string;
  start: [number, number];
  end: [number, number];
  in_direction: [number, number];
}

export interface CrossingEvent {
  Event_ID: number;
  Frame_ID: number;
  Time_S: number;
  Timestamp: string;
  Track_ID: number;
  Line_ID: string;
  Event_Type: EventType;
  Anchor_X: number;
  Anchor_Y: number;
}

export interface TracksColumns {
  Frame_ID: number[];
  Track_ID: number[];
  X1: number[];
  Y1: number[];
  X2: number[];
  Y2: number[];
  Confidence: number[];
  Anchor_X: number[];
  Anchor_Y: number[];
}

export interface Counts {
  in: number;
  out: number;
  net: number;
}

export interface Manifest {
  schema_version: number;
  run_id: string;
  created_at: string;
  source: 'video' | 'simulation';
  git_commit: string | null;
  video: {
    name: string;
    path: string | null;
    split: Split;
    fps: number;
    width: number;
    height: number;
    frame_count: number;
    duration_s: number;
  };
  config: {
    detector: { model_weights: string; confidence_threshold: number; iou_threshold: number; image_size: number; device: string | null };
    tracker: { tracker_type: TrackerType };
    counting: {
      anchor_point: string;
      hysteresis_buffer_pixels: number;
      min_frames_between_events: number;
      forget_track_after_frames: number;
    };
    output: { write_review_video: boolean; write_annotated_video: boolean; start_timestamp: string | null };
  };
  tracker_parameters: Record<string, unknown>;
  lines: CountingLine[];
  counts: { total: Counts; by_line: Record<string, Counts> };
  diagnostics: { suppressed_by_cooldown: number; tracks_started_in_deadband: number };
  tracking: {
    tracker: string;
    unique_tracks: number;
    track_points: number;
    mean_track_length_frames: number;
    median_track_length_frames: number;
    short_track_threshold_frames: number;
    short_tracks: number;
  };
  performance: {
    processing_seconds: number;
    processing_fps: number | null;
    realtime_factor: number | null;
    device: string;
  };
  evaluation_summary?: EvalSummary | null;
}

export interface EvalSummary {
  gt_count: number;
  pred_count: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  count_error: number;
  abs_pct_error: number | null;
  net_flow_error?: number;
  mean_abs_frame_offset?: number | null;
}

export interface PredRef {
  Event_ID: number;
  Frame_ID: number;
  Track_ID: number;
  Line_ID: string;
  Event_Type: EventType;
}

export interface GtRef {
  Frame_ID: number;
  GT_Person_ID: string;
  Line_ID: string;
  Event_Type: EventType;
  Notes: string;
}

export interface Evaluation {
  run_id: string;
  clip: string;
  split: Split;
  ground_truth_file: string;
  evaluated_at: string;
  warnings: string[];
  tolerance_frames: number;
  overall: EvalSummary;
  by_direction: Record<EventType, EvalSummary>;
  by_line: (EvalSummary & { line_id: string; event_type: EventType })[];
  matches: { pred: PredRef; gt: GtRef; frame_offset: number }[];
  false_positives: PredRef[];
  false_negatives: GtRef[];
}

export interface RunDetail {
  manifest: Manifest;
  files: string[];
  evaluation: Evaluation | null;
}

export interface VideoEntry {
  name: string;
  split: Split;
  size_bytes: number;
  has_lines: boolean;
  fps?: number | null;
  width?: number;
  height?: number;
  frame_count?: number | null;
  duration_s?: number | null;
  error?: string;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  kind: 'process' | 'demo';
  label: string;
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  frames_done: number;
  frames_total: number | null;
  progress: number | null;
  run_id: string | null;
  error: string | null;
}

export interface Health {
  status: string;
  version: string;
  model_weights: string;
  weights_present: boolean;
}
