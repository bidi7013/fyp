import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { CrossingEvent, EventType } from '../types';
import { fmtClock } from '../lib/format';

export interface GtMarker {
  frame: number;
  type: EventType;
  matched: boolean;
}

const H = 132;
const AXIS = 62;
const TICK = 34;
const PAD_X = 10;

/**
 * The run at a glance: every crossing on one time axis, IN rising above it and OUT
 * dropping below it. Ground-truth crossings (when evaluated) sit as rings at the
 * ends of the same lanes, so misses and duplicates show up as unpaired marks.
 * Click or drag anywhere to seek.
 */
export function CrossingTimeline({
  frameCount,
  fps,
  events,
  gt,
  frame,
  onSeek,
}: {
  frameCount: number;
  fps: number;
  events: CrossingEvent[];
  gt?: GtMarker[];
  frame: number;
  onSeek: (frame: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ x: number; label: string } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const x = (f: number) => PAD_X + (f / Math.max(1, frameCount - 1)) * (width - 2 * PAD_X);
  const toFrame = (px: number) =>
    Math.round(Math.min(1, Math.max(0, (px - PAD_X) / (width - 2 * PAD_X))) * (frameCount - 1));

  const ticks = useMemo(() => {
    const duration = frameCount / fps;
    const target = Math.max(2, Math.floor(width / 90));
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = steps.find((s) => duration / s <= target) ?? 1200;
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += step) out.push(t);
    return out;
  }, [frameCount, fps, width]);

  const localX = (e: PointerEvent) => e.clientX - (e.currentTarget as Element).getBoundingClientRect().left;

  const onMove = (e: PointerEvent) => {
    const px = localX(e);
    if (dragging.current) onSeek(toFrame(px));
    let best: CrossingEvent | null = null;
    let bestD = 7;
    for (const ev of events) {
      const d = Math.abs(x(ev.Frame_ID) - px);
      if (d < bestD) {
        best = ev;
        bestD = d;
      }
    }
    const f = toFrame(px);
    setHover({
      x: px,
      label: best
        ? `${best.Event_Type === 'CROSS_IN' ? 'Crossed in' : 'Crossed out'}, track #${best.Track_ID}, frame ${best.Frame_ID}`
        : `Frame ${f}, ${fmtClock(f / fps)}`,
    });
  };

  const inCount = events.filter((e) => e.Event_Type === 'CROSS_IN').length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2 mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="12" aria-hidden><line x1="5" y1="12" x2="5" y2="3" stroke="var(--in)" strokeWidth="2" /><circle cx="5" cy="3" r="2.5" fill="var(--in)" /></svg>
          Crossed in <span className="tnum text-ink">{inCount}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="12" aria-hidden><line x1="5" y1="0" x2="5" y2="9" stroke="var(--out)" strokeWidth="2" /><circle cx="5" cy="9" r="2.5" fill="var(--out)" /></svg>
          Crossed out <span className="tnum text-ink">{events.length - inCount}</span>
        </span>
        {gt && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" /></svg>
            Labelled crossing
            <svg width="12" height="12" aria-hidden className="ml-2"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--critical)" strokeWidth="1.5" strokeDasharray="2 1.5" /></svg>
            Missed
          </span>
        )}
      </div>
      <div ref={wrap} className="relative">
        <svg
          width={width}
          height={H}
          className="block touch-none cursor-crosshair"
          role="slider"
          aria-label="Crossing timeline"
          aria-valuemin={0}
          aria-valuemax={frameCount - 1}
          aria-valuenow={frame}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onSeek(Math.max(0, frame - (e.shiftKey ? Math.round(fps) : 1)));
            if (e.key === 'ArrowRight') onSeek(Math.min(frameCount - 1, frame + (e.shiftKey ? Math.round(fps) : 1)));
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            onSeek(toFrame(localX(e)));
          }}
          onPointerMove={onMove}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => setHover(null)}
        >
          <rect x={PAD_X} y={AXIS - TICK - 14} width={width - 2 * PAD_X} height={TICK + 14} fill="var(--in-soft)" opacity={0.5} />
          <rect x={PAD_X} y={AXIS} width={width - 2 * PAD_X} height={TICK + 14} fill="var(--out-soft)" opacity={0.5} />
          <line x1={PAD_X} x2={width - PAD_X} y1={AXIS} y2={AXIS} stroke="var(--rule-strong)" strokeWidth={1} />
          {ticks.map((t) => {
            const tx = x(t * fps);
            return (
              <g key={t}>
                <line x1={tx} x2={tx} y1={AXIS + TICK + 14} y2={AXIS + TICK + 18} stroke="var(--rule-strong)" />
                <text x={tx} y={H - 2} fontSize={11} fill="var(--ink-3)" textAnchor="middle" className="tnum">
                  {fmtClock(t).replace(/\.00$/, '')}
                </text>
              </g>
            );
          })}
          {gt?.map((g, i) => {
            const isIn = g.type === 'CROSS_IN';
            return (
              <circle
                key={`gt${i}`}
                cx={x(g.frame)}
                cy={isIn ? AXIS - TICK - 7 : AXIS + TICK + 7}
                r={4.5}
                fill="var(--panel)"
                stroke={g.matched ? 'var(--ink-2)' : 'var(--critical)'}
                strokeWidth={1.5}
                strokeDasharray={g.matched ? undefined : '2 1.5'}
              />
            );
          })}
          {events.map((e) => {
            const isIn = e.Event_Type === 'CROSS_IN';
            const ex = x(e.Frame_ID);
            const tip = isIn ? AXIS - TICK + 4 : AXIS + TICK - 4;
            const passed = e.Frame_ID <= frame;
            return (
              <g key={e.Event_ID} opacity={passed ? 1 : 0.55}>
                <line x1={ex} x2={ex} y1={AXIS} y2={tip} stroke={isIn ? 'var(--in)' : 'var(--out)'} strokeWidth={2} />
                <circle cx={ex} cy={tip} r={4} fill={isIn ? 'var(--in)' : 'var(--out)'} stroke="var(--panel)" strokeWidth={2} />
              </g>
            );
          })}
          <line x1={x(frame)} x2={x(frame)} y1={4} y2={AXIS + TICK + 14} stroke="var(--ink)" strokeWidth={1.5} />
          <path d={`M ${x(frame) - 5} 2 L ${x(frame) + 5} 2 L ${x(frame)} 9 Z`} fill="var(--mark)" stroke="var(--ink)" strokeWidth={1} />
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded bg-ink text-panel text-xs px-2 py-1 tnum"
            style={{ left: Math.min(Math.max(0, hover.x - 80), width - 200) }}
          >
            {hover.label}
          </div>
        )}
      </div>
    </div>
  );
}
