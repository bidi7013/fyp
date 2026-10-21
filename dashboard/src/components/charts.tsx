import { useMemo, useState } from 'react';
import type { CrossingEvent } from '../types';
import { fmtClock } from '../lib/format';
import { niceStep, useWidth } from '../lib/useWidth';

const M = { top: 16, right: 64, bottom: 28, left: 36 };

/** Cumulative IN and OUT counts over clip time, as step lines with a hover crosshair. */
export function CumulativeChart({ events, duration, fps }: { events: CrossingEvent[]; duration: number; fps: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 240;
  const [hoverT, setHoverT] = useState<number | null>(null);

  const series = useMemo(() => {
    const build = (type: string) => {
      const pts: [number, number][] = [[0, 0]];
      let n = 0;
      for (const e of events) {
        if (e.Event_Type !== type) continue;
        pts.push([e.Frame_ID / fps, n]);
        n += 1;
        pts.push([e.Frame_ID / fps, n]);
      }
      pts.push([duration, n]);
      return { pts, total: n };
    };
    return { in: build('CROSS_IN'), out: build('CROSS_OUT') };
  }, [events, duration, fps]);

  const maxY = Math.max(1, series.in.total, series.out.total);
  const yStep = Math.max(1, niceStep(maxY, 4));
  const yMax = Math.ceil(maxY / yStep) * yStep;
  const iw = width - M.left - M.right;
  const ih = height - M.top - M.bottom;
  const x = (t: number) => M.left + (t / Math.max(duration, 1e-6)) * iw;
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const path = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const xStep = niceStep(duration, Math.max(2, Math.floor(iw / 90)));
  const xTicks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += xStep) xTicks.push(t);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

  const countAt = (type: string, t: number) => events.filter((e) => e.Event_Type === type && e.Frame_ID / fps <= t).length;

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <div className="flex gap-4 text-[13px] text-ink-2 mb-1" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-in inline-block" /> Crossed in</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-out inline-block" /> Crossed out</span>
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Cumulative crossings: ${series.in.total} in and ${series.out.total} out over ${fmtClock(duration)}`}
        onPointerMove={(e) => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          const t = ((px - M.left) / iw) * duration;
          setHoverT(t >= 0 && t <= duration ? t : null);
        }}
        onPointerLeave={() => setHoverT(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={M.left - 8} y={y(v)} fontSize={11} fill="var(--ink-3)" textAnchor="end" dominantBaseline="middle" className="tnum">{v}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 8} fontSize={11} fill="var(--ink-3)" textAnchor="middle" className="tnum">
            {fmtClock(t).replace(/\.00$/, '')}
          </text>
        ))}
        <path d={path(series.out.pts)} fill="none" stroke="var(--out)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path(series.in.pts)} fill="none" stroke="var(--in)" strokeWidth={2} strokeLinejoin="round" />
        {(() => {
          // Direct labels at the line ends, nudged apart when the totals are close.
          let yi = y(series.in.total);
          let yo = y(series.out.total);
          if (Math.abs(yi - yo) < 14) {
            const mid = (yi + yo) / 2;
            const up = series.in.total >= series.out.total;
            yi = mid + (up ? -7 : 7);
            yo = mid + (up ? 7 : -7);
          }
          return (
            <>
              <text x={M.left + iw + 6} y={yi} fontSize={12} fill="var(--ink)" dominantBaseline="middle" className="tnum">In {series.in.total}</text>
              <text x={M.left + iw + 6} y={yo} fontSize={12} fill="var(--ink)" dominantBaseline="middle" className="tnum">Out {series.out.total}</text>
            </>
          );
        })()}
        {hoverT != null && (
          <line x1={x(hoverT)} x2={x(hoverT)} y1={M.top} y2={M.top + ih} stroke="var(--ink-3)" strokeDasharray="3 3" />
        )}
      </svg>
      {hoverT != null && (
        <div
          className="pointer-events-none absolute top-6 rounded-md bg-panel border border-rule shadow-sm px-2.5 py-1.5 text-xs tnum"
          style={{ left: Math.min(x(hoverT) + 10, width - 130) }}
        >
          <div className="text-ink-3">{fmtClock(hoverT)}</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-in" /> In {countAt('CROSS_IN', hoverT)}</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-out" /> Out {countAt('CROSS_OUT', hoverT)}</div>
        </div>
      )}
    </div>
  );
}

/** Distribution of how long each track was visible, with the short-track threshold marked. */
export function TrackLengthHistogram({ lengths, fps, threshold }: { lengths: number[]; fps: number; threshold: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 220;
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 14, right: 12, bottom: 30, left: 36 };

  const { bins, binW } = useMemo(() => {
    const secs = lengths.map((n) => n / fps);
    const max = Math.max(1, ...secs);
    const w = niceStep(max, 12);
    const count = Math.max(1, Math.ceil(max / w + 1e-9));
    const b = new Array<number>(count).fill(0);
    for (const s of secs) b[Math.min(count - 1, Math.floor(s / w))]++;
    return { bins: b, binW: w };
  }, [lengths, fps]);

  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const maxN = Math.max(1, ...bins);
  const yStep = Math.max(1, niceStep(maxN, 4));
  const yMax = Math.ceil(maxN / yStep) * yStep;
  const bw = iw / bins.length;
  const y = (v: number) => m.top + ih - (v / yMax) * ih;
  const thresholdX = m.left + (threshold / fps / (binW * bins.length)) * iw;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);
  const labelEvery = Math.ceil(bins.length / Math.max(2, Math.floor(iw / 60)));

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={width} height={height} role="img" aria-label={`Track lengths for ${lengths.length} tracks`} onPointerLeave={() => setHover(null)}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={m.left + iw} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={m.left - 8} y={y(v)} fontSize={11} fill="var(--ink-3)" textAnchor="end" dominantBaseline="middle" className="tnum">{v}</text>
          </g>
        ))}
        {bins.map((n, i) => {
          const bx = m.left + i * bw + 1;
          const bwid = Math.max(1, bw - 2);
          const top = y(n);
          const h = m.top + ih - top;
          const r = Math.min(4, bwid / 2, h);
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={m.left + i * bw} y={m.top} width={bw} height={ih} fill="transparent" />
              {n > 0 && (
                <path
                  d={`M${bx},${m.top + ih} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + bwid - r} Q${bx + bwid},${top} ${bx + bwid},${top + r} V${m.top + ih} Z`}
                  fill={hover === i ? 'var(--ink)' : 'var(--ink-3)'}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={m.left + i * bw} y={height - 10} fontSize={11} fill="var(--ink-3)" textAnchor="middle" className="tnum">
                  {+(i * binW).toFixed(2)}s
                </text>
              )}
            </g>
          );
        })}
        <line x1={thresholdX} x2={thresholdX} y1={m.top} y2={m.top + ih} stroke="var(--critical)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={thresholdX + 5} y={m.top + 10} fontSize={11} fill="var(--ink-2)">short-track limit</text>
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-2 rounded-md bg-panel border border-rule shadow-sm px-2.5 py-1.5 text-xs tnum"
          style={{ left: Math.min(m.left + (hover + 1) * bw + 6, width - 170) }}>
          {bins[hover]} {bins[hover] === 1 ? 'track' : 'tracks'} visible {+(hover * binW).toFixed(2)}–{+((hover + 1) * binW).toFixed(2)} s
        </div>
      )}
    </div>
  );
}
