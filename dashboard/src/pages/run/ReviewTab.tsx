import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronFirst, ChevronLast, Pause, Play, StepBack, StepForward, X } from 'lucide-react';
import { api } from '../../api';
import { countsAt, trail } from '../../lib/tracks';
import { fmtClock, fmtSigned } from '../../lib/format';
import { LineGlyph } from '../../components/LineGlyph';
import { CrossingTimeline, type GtMarker } from '../../components/CrossingTimeline';
import { Button, Direction, Notice, Segmented } from '../../components/ui';
import type { RunData } from './RunPage';

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (h: number) => void;
};

const SPEEDS = ['0.25', '0.5', '1', '2'] as const;

export function ReviewTab({ data }: { data: RunData }) {
  const { detail, events, tracks, index } = data;
  const m = detail.manifest;
  const { fps, width, height, frame_count: frameCount } = m.video;
  const scale = Math.max(width, height) / 720; // overlay sizes relative to the frame, not the screen
  const hasVideo = detail.files.includes('video.webm');

  const [params, setParams] = useSearchParams();
  const [frame, setFrame] = useState(() => Math.min(frameCount - 1, Math.max(0, Number(params.get('frame')) || 0)));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>('1');
  const [layers, setLayers] = useState({ boxes: true, trails: true, lines: true });
  const [selected, setSelected] = useState<number | null>(null);
  const video = useRef<VideoWithRVFC>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // WebM stores timestamps in whole milliseconds, so frame n can report a time a
  // fraction of a millisecond before n / fps. The small epsilon absorbs that.
  const toFrame = useCallback(
    (t: number) => Math.min(frameCount - 1, Math.max(0, Math.floor(t * fps + 0.02))),
    [fps, frameCount],
  );

  const seek = useCallback(
    (f: number) => {
      const target = Math.min(frameCount - 1, Math.max(0, f));
      setFrame(target);
      if (video.current) video.current.currentTime = (target + 0.5) / fps;
    },
    [fps, frameCount],
  );

  // Initial ?frame= deep link (from the Evaluation tab); applied once the video can seek.
  const initialFrame = useRef(frame);
  const onLoaded = () => {
    if (initialFrame.current > 0) seek(initialFrame.current);
    initialFrame.current = 0;
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let handle = 0;
    const rvfc = typeof v.requestVideoFrameCallback === 'function';
    const onFrame = (_now: number, meta: { mediaTime: number }) => {
      setFrame(toFrame(meta.mediaTime));
      handle = v.requestVideoFrameCallback!(onFrame);
    };
    if (rvfc) handle = v.requestVideoFrameCallback!(onFrame);
    const onTime = () => !rvfc && setFrame(toFrame(v.currentTime));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      if (rvfc && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [toFrame]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = Number(speed);
  }, [speed]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const step = useCallback(
    (delta: number) => {
      video.current?.pause();
      seek(frame + delta);
    },
    [frame, seek],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="slider"]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? Math.round(fps) : 1);
        step(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, step, fps]);

  // Keep the shareable ?frame= in sync while paused.
  useEffect(() => {
    if (playing) return;
    const id = window.setTimeout(() => setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('frame', String(frame));
      return next;
    }, { replace: true }), 300);
    return () => window.clearTimeout(id);
  }, [frame, playing, setParams]);

  const counts = useMemo(() => countsAt(events, frame), [events, frame]);
  const lastPassed = useMemo(() => {
    let id = -1;
    for (const e of events) if (e.Frame_ID <= frame) id = e.Event_ID;
    return id;
  }, [events, frame]);

  useEffect(() => {
    if (!playing || lastPassed < 0) return;
    listRef.current?.querySelector(`[data-event="${lastPassed}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [lastPassed, playing]);

  const gt: GtMarker[] | undefined = useMemo(() => {
    const ev = detail.evaluation;
    if (!ev) return undefined;
    return [
      ...ev.matches.map((x) => ({ frame: x.gt.Frame_ID, type: x.gt.Event_Type, matched: true })),
      ...ev.false_negatives.map((x) => ({ frame: x.Frame_ID, type: x.Event_Type, matched: false })),
    ];
  }, [detail.evaluation]);
  const falsePositiveIds = useMemo(
    () => new Set(detail.evaluation?.false_positives.map((p) => p.Event_ID) ?? []),
    [detail.evaluation],
  );

  const rows = (tracks && index?.byFrame.get(frame)) || [];
  const selectedRows = selected != null ? index?.byTrack.get(selected) : undefined;
  const selectedEvents = selected != null ? events.filter((e) => e.Track_ID === selected) : [];
  const flashes = events.filter((e) => e.Frame_ID <= frame && frame - e.Frame_ID < fps);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 flex flex-col gap-4">
        <div className="bg-panel border border-rule rounded-lg overflow-hidden">
          <div className="relative bg-stage" style={{ aspectRatio: `${width} / ${height}` }}>
            {hasVideo ? (
              <video
                ref={video}
                src={api.fileUrl(m.run_id, 'video.webm')}
                className="absolute inset-0 w-full h-full"
                muted
                playsInline
                preload="auto"
                onLoadedData={onLoaded}
                onClick={toggle}
              />
            ) : null}
            <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full pointer-events-none">
              {layers.lines && m.lines.map((l) => <LineGlyph key={l.id} line={l} scale={scale} />)}
              {tracks && selectedRows && (
                <polyline
                  points={selectedRows.map((r) => `${tracks.Anchor_X[r]},${tracks.Anchor_Y[r]}`).join(' ')}
                  fill="none" stroke="var(--mark)" strokeWidth={2 * scale} strokeDasharray={`${6 * scale} ${4 * scale}`} opacity={0.9}
                />
              )}
              {tracks && layers.trails && index &&
                rows.map((r) => {
                  const id = tracks.Track_ID[r];
                  const pts = trail(tracks, index.byTrack.get(id)!, frame, Math.round(fps * 2));
                  return (
                    <polyline key={`t${id}`} points={pts.map((p) => p.join(',')).join(' ')} fill="none"
                      stroke={id === selected ? 'var(--mark)' : '#ffffff'} strokeOpacity={0.75} strokeWidth={2 * scale}
                      strokeLinecap="round" strokeLinejoin="round" />
                  );
                })}
              {tracks && layers.boxes &&
                rows.map((r) => {
                  const id = tracks.Track_ID[r];
                  const sel = id === selected;
                  const x1 = tracks.X1[r];
                  const y1 = tracks.Y1[r];
                  const label = `#${id}`;
                  return (
                    <g key={`b${id}`} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelected(sel ? null : id); }}>
                      <rect x={x1} y={y1} width={tracks.X2[r] - x1} height={tracks.Y2[r] - y1} fill="transparent"
                        stroke={sel ? 'var(--mark)' : '#ffffff'} strokeWidth={(sel ? 3 : 1.75) * scale} />
                      <rect x={x1} y={y1 - 20 * scale} width={(label.length * 8 + 10) * scale} height={18 * scale} rx={3 * scale}
                        fill={sel ? 'var(--mark)' : 'rgba(0,0,0,0.65)'} />
                      <text x={x1 + 5 * scale} y={y1 - 7 * scale} fontSize={12.5 * scale} fontWeight={700} fill={sel ? '#14181d' : '#ffffff'}>
                        {label}
                      </text>
                      <circle cx={tracks.Anchor_X[r]} cy={tracks.Anchor_Y[r]} r={3.5 * scale} fill={sel ? 'var(--mark)' : '#ffffff'} stroke="rgba(0,0,0,0.6)" strokeWidth={scale} />
                    </g>
                  );
                })}
              {flashes.map((e) => {
                const age = (frame - e.Frame_ID) / fps;
                const isIn = e.Event_Type === 'CROSS_IN';
                return (
                  <g key={`f${e.Event_ID}`} opacity={1 - age * 0.8}>
                    <circle cx={e.Anchor_X} cy={e.Anchor_Y} r={(14 + age * 18) * scale} fill="none" stroke={isIn ? 'var(--in)' : 'var(--out)'} strokeWidth={3 * scale} />
                    <text x={e.Anchor_X + 20 * scale} y={e.Anchor_Y + 28 * scale} fontSize={15 * scale} fontWeight={700} fill="#fff"
                      stroke="rgba(0,0,0,0.65)" strokeWidth={3 * scale} paintOrder="stroke">
                      {isIn ? 'IN' : 'OUT'} #{e.Track_ID}
                    </text>
                  </g>
                );
              })}
            </svg>
            {!hasVideo && (
              <p className="absolute bottom-3 left-3 right-3 text-xs text-white/70">
                No review video was saved for this run, so only the overlay is shown.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 border-t border-rule">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Back one second" title="Back 1 s (Shift + Left)" onClick={() => step(-Math.round(fps))} icon={<ChevronFirst className="w-4 h-4" />} />
              <Button size="sm" variant="ghost" aria-label="Previous frame" title="Previous frame (Left)" onClick={() => step(-1)} icon={<StepBack className="w-4 h-4" />} />
              <Button size="sm" variant="primary" aria-label={playing ? 'Pause' : 'Play'} title="Play or pause (Space)" onClick={toggle} disabled={!hasVideo}
                icon={playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} className="w-10" />
              <Button size="sm" variant="ghost" aria-label="Next frame" title="Next frame (Right)" onClick={() => step(1)} icon={<StepForward className="w-4 h-4" />} />
              <Button size="sm" variant="ghost" aria-label="Forward one second" title="Forward 1 s (Shift + Right)" onClick={() => step(Math.round(fps))} icon={<ChevronLast className="w-4 h-4" />} />
            </div>
            <div className="tnum text-[13px] text-ink-2">
              Frame <span className="text-ink font-medium">{frame}</span> of {frameCount - 1}
              <span className="text-ink-3 ml-3">{fmtClock(frame / fps)} / {fmtClock(frameCount / fps)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <Segmented label="Playback speed" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} />
              <div className="flex items-center gap-3 text-[13px] text-ink-2">
                {(['boxes', 'trails', 'lines'] as const).map((k) => (
                  <label key={k} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" className="accent-[var(--ink)]" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
                    {k === 'boxes' ? 'Boxes' : k === 'trails' ? 'Trails' : 'Lines'}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-panel border border-rule rounded-lg px-4 pt-3 pb-2">
          <CrossingTimeline frameCount={frameCount} fps={fps} events={events} gt={gt} frame={frame} onSeek={(f) => { video.current?.pause(); seek(f); }} />
        </div>
        {!tracks && <Notice>Trajectories are still loading; counts and the timeline are already live.</Notice>}
      </div>

      <aside className="flex flex-col gap-4 min-w-0">
        <section className="bg-panel border border-rule rounded-lg p-4" aria-live="polite">
          <h2 className="text-[13px] text-ink-3">Counted up to frame {frame}</h2>
          <dl className="mt-2 grid grid-cols-3 gap-3">
            {[
              { label: 'In', value: String(counts.in), color: 'var(--in)' },
              { label: 'Out', value: String(counts.out), color: 'var(--out)' },
              { label: 'Net', value: fmtSigned(counts.net), color: 'var(--ink-3)' },
            ].map((c) => (
              <div key={c.label} className="border-l-2 pl-2.5" style={{ borderColor: c.color }}>
                <dt className="text-[13px] text-ink-2">{c.label}</dt>
                <dd className="text-[28px] leading-tight font-semibold tnum">{c.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-3 mt-2 tnum">{rows.length} {rows.length === 1 ? 'person' : 'people'} tracked in this frame</p>
        </section>

        {selected != null && (
          <section className="bg-mark-soft border border-mark/60 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Track #{selected}</h2>
              <Button size="sm" variant="ghost" aria-label="Clear selected track" onClick={() => setSelected(null)} icon={<X className="w-4 h-4" />} />
            </div>
            {tracks && selectedRows && (
              <p className="text-[13px] text-ink-2 tnum mt-1">
                Seen in {selectedRows.length} frames, {tracks.Frame_ID[selectedRows[0]]} to {tracks.Frame_ID[selectedRows[selectedRows.length - 1]]}
              </p>
            )}
            {selectedEvents.length ? (
              <ul className="mt-2 flex flex-col gap-1 text-[13px]">
                {selectedEvents.map((e) => (
                  <li key={e.Event_ID}>
                    <button className="hover:underline underline-offset-2 inline-flex gap-2" onClick={() => seek(e.Frame_ID)}>
                      <Direction type={e.Event_Type} /> <span className="tnum text-ink-2">frame {e.Frame_ID}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-2 mt-2">This track produced no crossing.</p>
            )}
          </section>
        )}

        <section className="bg-panel border border-rule rounded-lg flex flex-col min-h-0">
          <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Crossing events</h2>
            <span className="text-[13px] text-ink-3 tnum">{events.length}</span>
          </header>
          {events.length === 0 ? (
            <p className="p-4 text-[13px] text-ink-2">No one crossed a counting line in this run.</p>
          ) : (
            <ol ref={listRef} className="overflow-y-auto max-h-[420px]">
              {events.map((e) => {
                const passed = e.Frame_ID <= frame;
                const current = e.Event_ID === lastPassed;
                return (
                  <li key={e.Event_ID} data-event={e.Event_ID}>
                    <button
                      onClick={() => {
                        video.current?.pause();
                        seek(e.Frame_ID);
                        setSelected(e.Track_ID);
                      }}
                      className={`w-full text-left grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2 border-b border-rule text-[13px] ${
                        current ? 'bg-mark-soft' : 'hover:bg-panel-2'
                      } ${passed ? '' : 'text-ink-3'}`}
                    >
                      <span className="flex items-center gap-2">
                        <Direction type={e.Event_Type} />
                        <span className="text-ink-2">track #{e.Track_ID}</span>
                        {falsePositiveIds.has(e.Event_ID) && <span className="text-critical text-xs font-medium">extra</span>}
                      </span>
                      <span className="tnum text-ink-2 text-right">{fmtClock(e.Time_S)}</span>
                      <span className="text-xs text-ink-3 tnum col-span-2">
                        frame {e.Frame_ID}{m.lines.length > 1 ? `, ${e.Line_ID}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <p className="text-xs text-ink-3">
          Space plays or pauses. Left and right step one frame; hold Shift for one second. Click a box to follow that track.
        </p>
      </aside>
    </div>
  );
}
