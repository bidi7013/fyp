import type { CountingLine } from '../types';
import { inArrow } from '../lib/lines';

/** Draws a counting line with its IN arrow, in video pixel coordinates. */
export function LineGlyph({ line, scale, selected = false }: { line: CountingLine; scale: number; selected?: boolean }) {
  const { from, to } = inArrow(line, 46 * scale);
  const ux = (to[0] - from[0]) / (46 * scale);
  const uy = (to[1] - from[1]) / (46 * scale);
  const head = 10 * scale;
  const left: [number, number] = [to[0] - ux * head - uy * head * 0.7, to[1] - uy * head + ux * head * 0.7];
  const right: [number, number] = [to[0] - ux * head + uy * head * 0.7, to[1] - uy * head - ux * head * 0.7];
  const sw = 2.5 * scale;
  const labelX = to[0] + ux * 14 * scale;
  const labelY = to[1] + uy * 14 * scale;
  return (
    <g>
      <line x1={line.start[0]} y1={line.start[1]} x2={line.end[0]} y2={line.end[1]} stroke="rgba(0,0,0,0.55)" strokeWidth={sw + 3 * scale} strokeLinecap="round" />
      <line
        x1={line.start[0]} y1={line.start[1]} x2={line.end[0]} y2={line.end[1]}
        stroke={selected ? 'var(--mark)' : '#ffffff'} strokeWidth={sw} strokeLinecap="round"
      />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--in)" strokeWidth={sw} strokeLinecap="round" />
      <polygon points={`${to[0]},${to[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`} fill="var(--in)" />
      <text
        x={labelX} y={labelY} fontSize={13 * scale} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="middle"
        stroke="rgba(0,0,0,0.6)" strokeWidth={3 * scale} paintOrder="stroke"
      >
        IN
      </text>
      <text
        x={line.start[0]} y={line.start[1] - 10 * scale} fontSize={13 * scale} fontWeight={600} fill="#fff"
        stroke="rgba(0,0,0,0.6)" strokeWidth={3 * scale} paintOrder="stroke"
      >
        {line.name}
      </text>
    </g>
  );
}
