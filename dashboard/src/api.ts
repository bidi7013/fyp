import type {
  CountingLine, CrossingEvent, Evaluation, Health, Job, Manifest, RunDetail, Split, TracksColumns, TrackerType, VideoEntry,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The API refuses writes without this header; browsers cannot add it to
// cross-origin requests, so other websites cannot drive the local API.
const CLIENT_HEADER = { 'X-Aspire-Client': 'dashboard' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...CLIENT_HEADER, ...init?.headers } });
  } catch {
    throw new ApiError(0, 'Cannot reach the ASPIRE-Vision API. Start it with: python -m src.cli serve');
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join('; ');
    } catch {
      // keep the status text
    }
    if (res.status === 502 || res.status === 504) {
      message = 'Cannot reach the ASPIRE-Vision API. Start it with: python -m src.cli serve';
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>('/api/health'),
  config: () =>
    request<{ defaults: Manifest['config']; trackers: Record<string, Record<string, unknown>> }>('/api/config'),
  videos: () => request<VideoEntry[]>('/api/videos'),
  uploadVideo: (file: File, split: Split) => {
    const form = new FormData();
    form.append('file', file);
    form.append('split', split);
    return request<VideoEntry>('/api/videos', { method: 'POST', body: form });
  },
  frameUrl: (split: Split, name: string) => `/api/videos/${split}/${enc(name)}/frame`,
  lines: (split: Split, name: string) =>
    request<{ saved: boolean; lines: CountingLine[] }>(`/api/videos/${split}/${enc(name)}/lines`),
  saveLines: (split: Split, name: string, lines: CountingLine[]) =>
    request<{ saved: boolean; lines: CountingLine[] }>(`/api/videos/${split}/${enc(name)}/lines`, {
      ...json({ lines }),
      method: 'PUT',
    }),
  startRun: (body: {
    split: Split;
    video: string;
    tracker: TrackerType;
    confidence_threshold?: number;
    hysteresis_buffer_pixels?: number;
    min_frames_between_events?: number;
    write_annotated_video?: boolean;
  }) => request<Job>('/api/runs', json(body)),
  startDemo: () => request<Job>('/api/demo', { method: 'POST' }),
  jobs: () => request<Job[]>('/api/jobs'),
  cancelJob: (id: string) => request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  runs: () => request<Manifest[]>('/api/runs'),
  run: (id: string) => request<RunDetail>(`/api/runs/${enc(id)}`),
  deleteRun: (id: string) => request<void>(`/api/runs/${enc(id)}`, { method: 'DELETE' }),
  events: (id: string) => request<CrossingEvent[]>(`/api/runs/${enc(id)}/events`),
  tracks: (id: string) => request<TracksColumns>(`/api/runs/${enc(id)}/tracks`),
  fileUrl: (id: string, name: string, download = false) =>
    `/api/runs/${enc(id)}/files/${name}${download ? '?download=true' : ''}`,
  evaluate: (id: string, file: File, toleranceFrames: number) => {
    const form = new FormData();
    form.append('ground_truth', file);
    form.append('tolerance_frames', String(toleranceFrames));
    return request<Evaluation>(`/api/runs/${enc(id)}/evaluation`, { method: 'POST', body: form });
  },
};
