import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { CountingLine } from '../types';
import { withPoints } from '../lib/lines';
import { LineGlyph } from './LineGlyph';

type Drag = { id: string; part: 'start' | 'end' | 'body'; origin: [number, number]; line: CountingLine };

/**
 * Counting-line editor on top of a still frame. Drag an endpoint to move it, drag
 * the line to move both ends; endpoints can also be nudged with the arrow keys.
 */
export function LineEditor({
  imageUrl,
  width,
  height,
  lines,
  selectedId,
  onSelect,
  onChange,
}: {
  imageUrl: string;
  width: number;
  height: number;
  lines: CountingLine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (lines: CountingLine[]) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [imageError, setImageError] = useState(false);
  const scale = Math.max(width, height) / 720;

  const toVideo = (e: PointerEvent): [number, number] => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return [Math.round(p.x), Math.round(p.y)];
  };

  const clamp = (p: [number, number]): [number, number] => [
    Math.min(width, Math.max(0, p[0])),
    Math.min(height, Math.max(0, p[1])),
  ];

  const replace = (line: CountingLine) => onChange(lines.map((l) => (l.id === line.id ? line : l)));

  const begin = (e: PointerEvent, line: CountingLine, part: Drag['part']) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect(line.id);
    setDrag({ id: line.id, part, origin: toVideo(e), line });
  };

  const move = (e: PointerEvent) => {
    if (!drag) return;
    const p = toVideo(e);
    const l = drag.line;
    if (drag.part === 'start') replace(withPoints(l, clamp(p), l.end));
    else if (drag.part === 'end') replace(withPoints(l, l.start, clamp(p)));
    else {
      const dx = p[0] - drag.origin[0];
      const dy = p[1] - drag.origin[1];
      replace(withPoints(l, clamp([l.start[0] + dx, l.start[1] + dy]), clamp([l.end[0] + dx, l.end[1] + dy])));
    }
  };

  const nudge = (e: KeyboardEvent, line: CountingLine, part: 'start' | 'end') => {
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    const p = line[part];
    const next = clamp([p[0] + delta[0], p[1] + delta[1]]);
    replace(part === 'start' ? withPoints(line, next, line.end) : withPoints(line, line.start, next));
  };

  const r = 9 * scale;

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-stage select-none" style={{ aspectRatio: `${width} / ${height}` }}>
      {imageError ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70 p-6 text-center">
          The first frame could not be loaded. The line can still be placed using the frame size.
        </div>
      ) : (
        <img src={imageUrl} alt="First frame of the selected video" className="absolute inset-0 w-full h-full" draggable={false} onError={() => setImageError(true)} />
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full touch-none"
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {lines.map((line) => {
          const selected = line.id === selectedId;
          return (
            <g key={line.id}>
              <line
                x1={line.start[0]} y1={line.start[1]} x2={line.end[0]} y2={line.end[1]}
                stroke="transparent" strokeWidth={24 * scale}
                className="cursor-move"
                onPointerDown={(e) => begin(e, line, 'body')}
              />
              <g pointerEvents="none">
                <LineGlyph line={line} scale={scale} selected={selected} />
              </g>
              {(['start', 'end'] as const).map((part) => (
                <circle
                  key={part}
                  cx={line[part][0]} cy={line[part][1]} r={r}
                  fill={selected ? 'var(--mark)' : '#ffffff'} stroke="rgba(0,0,0,0.7)" strokeWidth={2 * scale}
                  className="cursor-grab focus:outline-none"
                  tabIndex={0}
                  role="slider"
                  aria-label={`${line.name} ${part === 'start' ? 'start point' : 'end point'}, use arrow keys to move`}
                  aria-valuetext={`x ${line[part][0]}, y ${line[part][1]}`}
                  onPointerDown={(e) => begin(e, line, part)}
                  onKeyDown={(e) => nudge(e, line, part)}
                  onFocus={() => onSelect(line.id)}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
