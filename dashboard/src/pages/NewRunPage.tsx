import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeftRight, Play, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';
import { useJobs } from '../lib/jobs';
import { flip, newLine } from '../lib/lines';
import { fmtDuration } from '../lib/format';
import { LineEditor } from '../components/LineEditor';
import { Button, EmptyState, Field, Loading, Notice, PageHeader, Segmented, SplitBadge, inputClass } from '../components/ui';
import { VideoUpload } from './VideosPage';
import type { CountingLine, TrackerType, VideoEntry } from '../types';

function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[200px_1fr] py-7 border-t border-rule first:border-0 first:pt-0">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full border border-rule-strong text-[13px] font-semibold flex items-center justify-center tnum" aria-hidden>
            {n}
          </span>
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        {aside && <div className="text-[13px] text-ink-3 mt-2 lg:pr-4">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const TRACKERS: { value: TrackerType; label: string; note: string }[] = [
  { value: 'bytetrack', label: 'ByteTrack', note: 'Motion and box overlap only. Fast; the baseline configuration.' },
  { value: 'botsort', label: 'BoT-SORT', note: 'Adds camera-motion compensation. Slower; the second configuration to compare.' },
];

export function NewRunPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { health, refresh } = useJobs();
  const videos = useAsync(() => api.videos(), 'videos');
  const config = useAsync(() => api.config(), 'config');

  const selectedKey = params.get('video') ? `${params.get('split')}/${params.get('video')}` : null;
  const video = useMemo(
    () => videos.data?.find((v) => `${v.split}/${v.name}` === selectedKey) ?? null,
    [videos.data, selectedKey],
  );

  const [lines, setLines] = useState<CountingLine[]>([]);
  const [linesSaved, setLinesSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string>();

  const [tracker, setTracker] = useState<TrackerType>('bytetrack');
  // null = untouched, so the field shows the server default from configs/default_config.yaml
  const [confidenceInput, setConfidence] = useState<string | null>(null);
  const [bufferInput, setBuffer] = useState<string | null>(null);
  const [cooldownInput, setCooldown] = useState<string | null>(null);
  const [annotated, setAnnotated] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();

  const defaults = config.data?.defaults;
  const confidence = confidenceInput ?? (defaults ? String(defaults.detector.confidence_threshold) : '');
  const buffer = bufferInput ?? (defaults ? String(defaults.counting.hysteresis_buffer_pixels) : '');
  const cooldown = cooldownInput ?? (defaults ? String(defaults.counting.min_frames_between_events) : '');

  useEffect(() => {
    if (!video) return;
    let alive = true;
    api
      .lines(video.split, video.name)
      .then((r) => {
        if (!alive) return;
        setLineError(undefined);
        setLines(r.lines);
        setLinesSaved(r.saved);
        setDirty(false);
        setSelectedLine(r.lines[0]?.id ?? null);
      })
      .catch((e: Error) => alive && setLineError(e.message));
    return () => {
      alive = false;
    };
  }, [video]);

  const choose = (v: VideoEntry) => setParams({ split: v.split, video: v.name }, { replace: true });

  const editLines = (next: CountingLine[]) => {
    setLines(next);
    setDirty(true);
  };

  const saveLines = async () => {
    if (!video) return false;
    try {
      const r = await api.saveLines(video.split, video.name, lines);
      setLines(r.lines);
      setLinesSaved(true);
      setDirty(false);
      setLineError(undefined);
      return true;
    } catch (e) {
      setLineError((e as Error).message);
      return false;
    }
  };

  const start = async () => {
    if (!video) return;
    setStarting(true);
    setStartError(undefined);
    try {
      if ((dirty || !linesSaved) && !(await saveLines())) return;
      await api.startRun({
        split: video.split,
        video: video.name,
        tracker,
        confidence_threshold: confidence ? Number(confidence) : undefined,
        hysteresis_buffer_pixels: buffer ? Number(buffer) : undefined,
        min_frames_between_events: cooldown ? Number(cooldown) : undefined,
        write_annotated_video: annotated,
      });
      refresh();
      navigate('/');
    } catch (e) {
      setStartError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const current = lines.find((l) => l.id === selectedLine) ?? null;
  const updateCurrent = (patch: Partial<CountingLine>) =>
    current && editLines(lines.map((l) => (l.id === current.id ? { ...l, ...patch } : l)));

  return (
    <>
      <PageHeader
        title="New run"
        description="Choose a recorded clip, place the counting line on its first frame, then process it with one tracker configuration."
      />

      <div className="bg-panel border border-rule rounded-lg p-5 sm:p-6">
        <Step n={1} title="Video" aside="Clips come from data/videos/dev and data/videos/test.">
          {videos.loading && !videos.data ? (
            <Loading label="Loading videos" />
          ) : videos.error ? (
            <Notice tone="error">{videos.error.message}</Notice>
          ) : (
            <div className="flex flex-col gap-4">
              {videos.data?.length ? (
                <div role="radiogroup" aria-label="Video" className="grid gap-2 sm:grid-cols-2">
                  {videos.data.map((v) => {
                    const active = video?.name === v.name && video.split === v.split;
                    return (
                      <button
                        key={`${v.split}/${v.name}`}
                        role="radio"
                        aria-checked={active}
                        disabled={!!v.error}
                        onClick={() => choose(v)}
                        className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                          active ? 'border-ink bg-panel-2 ring-1 ring-ink' : 'border-rule hover:border-rule-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{v.name}</span>
                          <SplitBadge split={v.split} />
                        </div>
                        <div className="text-xs text-ink-3 mt-0.5 tnum">
                          {v.error ?? `${v.width}×${v.height}, ${v.fps} fps, ${fmtDuration(v.duration_s)}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No videos yet">Upload a clip to the dev set to get started.</EmptyState>
              )}
              <VideoUpload
                onUploaded={(v) => {
                  videos.reload();
                  choose(v);
                }}
              />
            </div>
          )}
        </Step>

        <Step
          n={2}
          title="Counting line"
          aside="Drag the end points, or the line itself. The blue arrow shows which way counts as IN. Lines are saved per video."
        >
          {!video ? (
            <p className="text-ink-3">Choose a video first.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <LineEditor
                imageUrl={api.frameUrl(video.split, video.name)}
                width={video.width ?? 1280}
                height={video.height ?? 720}
                lines={lines}
                selectedId={selectedLine}
                onSelect={setSelectedLine}
                onChange={editLines}
              />
              {lineError && <Notice tone="error">{lineError}</Notice>}
              <div className="flex flex-wrap items-end gap-2">
                {lines.length > 1 && (
                  <Segmented
                    label="Line to edit"
                    value={selectedLine ?? lines[0].id}
                    onChange={setSelectedLine}
                    options={lines.map((l) => ({ value: l.id, label: l.name }))}
                  />
                )}
                {current && (
                  <>
                    <div className="w-48">
                      <Field label="Line name" htmlFor="line-name">
                        <input id="line-name" className={inputClass} value={current.name} maxLength={40}
                          onChange={(e) => updateCurrent({ name: e.target.value })} />
                      </Field>
                    </div>
                    <Button icon={<ArrowLeftRight className="w-4 h-4" />} onClick={() => editLines(lines.map((l) => (l.id === current.id ? flip(l) : l)))}>
                      Flip IN direction
                    </Button>
                    {lines.length > 1 && (
                      <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={() => {
                        const rest = lines.filter((l) => l.id !== current.id);
                        editLines(rest);
                        setSelectedLine(rest[0].id);
                      }}>
                        Remove line
                      </Button>
                    )}
                  </>
                )}
                {lines.length < 4 && (
                  <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => {
                    const l = newLine(video.width ?? 1280, video.height ?? 720, lines);
                    editLines([...lines, l]);
                    setSelectedLine(l.id);
                  }}>
                    Add line
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[13px] text-ink-3">
                    {dirty ? 'Unsaved changes' : linesSaved ? 'Saved' : 'Default position, not saved yet'}
                  </span>
                  <Button onClick={saveLines} disabled={!dirty && linesSaved}>Save line</Button>
                </div>
              </div>
            </div>
          )}
        </Step>

        <Step n={3} title="Settings" aside="Every setting is stored in the run manifest, so results can be traced back to them.">
          <div className="flex flex-col gap-5 max-w-[720px]">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tracker">
              {TRACKERS.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={tracker === t.value}
                  onClick={() => setTracker(t.value)}
                  className={`text-left rounded-md border px-3 py-2.5 ${
                    tracker === t.value ? 'border-ink bg-panel-2 ring-1 ring-ink' : 'border-rule hover:border-rule-strong'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-ink-3 mt-0.5">{t.note}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Detection confidence" htmlFor="conf" hint="Kept low so the tracker can use weak boxes to bridge occlusions.">
                <input id="conf" type="number" min={0.01} max={0.95} step={0.01} className={inputClass} value={confidence} onChange={(e) => setConfidence(e.target.value)} />
              </Field>
              <Field label="Deadband (px)" htmlFor="buffer" hint="A crossing counts once the person is this far past the line.">
                <input id="buffer" type="number" min={0} max={200} step={1} className={inputClass} value={buffer} onChange={(e) => setBuffer(e.target.value)} />
              </Field>
              <Field label="Cooldown (frames)" htmlFor="cooldown" hint="Minimum gap between two events from the same track.">
                <input id="cooldown" type="number" min={0} max={10000} step={1} className={inputClass} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--ink)]" checked={annotated} onChange={(e) => setAnnotated(e.target.checked)} />
              <span>
                Also save a video with boxes and counts drawn in
                <span className="block text-xs text-ink-3">Useful for reports. The dashboard draws its own overlay either way.</span>
              </span>
            </label>
            {health && !health.weights_present && (
              <Notice>
                The detector weights ({health.model_weights}) are not in the project yet. Ultralytics downloads them on the first run.
              </Notice>
            )}
            {video?.split === 'test' && (
              <Notice>
                This is a test-set clip. Use settings you already fixed on dev clips, so the result stays a fair estimate.
              </Notice>
            )}
            {startError && <Notice tone="error">{startError}</Notice>}
            <div>
              <Button variant="primary" icon={<Play className="w-4 h-4" />} disabled={!video || starting || !lines.length} onClick={start}>
                {starting ? 'Starting…' : 'Start processing'}
              </Button>
            </div>
          </div>
        </Step>
      </div>
    </>
  );
}
