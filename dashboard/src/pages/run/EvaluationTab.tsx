import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { api } from '../../api';
import { fmtRate, fmtSigned } from '../../lib/format';
import { Button, Direction, Field, Notice, Panel, inputClass } from '../../components/ui';
import type { EvalSummary, EventType } from '../../types';
import type { RunData } from './RunPage';

function downloadTemplate(clip: string, lineId: string) {
  const csv = `Clip_ID,Frame_ID,GT_Person_ID,Line_ID,Event_Type,Notes\n${clip},120,1,${lineId},CROSS_IN,example row - replace\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ground_truth_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function EvaluateForm({ data, compact = false }: { data: RunData; compact?: boolean }) {
  const m = data.detail.manifest;
  const [tolerance, setTolerance] = useState(String(data.detail.evaluation?.tolerance_frames ?? Math.round(m.video.fps / 2)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const f = file.current?.files?.[0];
    if (!f) {
      setError('Choose a ground-truth CSV first.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      data.setEvaluation(await api.evaluate(m.run_id, f, Number(tolerance)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${compact ? '' : 'max-w-[640px]'}`}>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Ground-truth CSV" htmlFor="gt-file" hint="One row per labelled crossing. Columns are listed in docs/annotation_rules.md.">
          <input id="gt-file" ref={file} type="file" accept=".csv,text/csv" className="text-sm file:mr-3 file:h-9 file:px-3 file:rounded-md file:border file:border-rule-strong file:bg-panel file:text-ink file:font-medium" />
        </Field>
        <Field label="Match tolerance (frames)" htmlFor="tol" hint={`±${(Number(tolerance) / m.video.fps || 0).toFixed(2)} s at ${m.video.fps} fps`}>
          <input id="tol" type="number" min={0} max={300} className={inputClass} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
        </Field>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={submit} disabled={busy}>{busy ? 'Evaluating…' : 'Evaluate'}</Button>
        <Button variant="ghost" icon={<Download className="w-4 h-4" />} onClick={() => downloadTemplate(m.video.name, m.lines[0]?.id ?? 'LINE_1')}>
          Template CSV
        </Button>
      </div>
    </div>
  );
}

const ROWS: { key: keyof EvalSummary; label: string; fmt: (v: EvalSummary) => string }[] = [
  { key: 'gt_count', label: 'Labelled crossings', fmt: (v) => String(v.gt_count) },
  { key: 'pred_count', label: 'Counted by the system', fmt: (v) => String(v.pred_count) },
  { key: 'tp', label: 'Matched', fmt: (v) => String(v.tp) },
  { key: 'fp', label: 'Extra counts (false positives)', fmt: (v) => String(v.fp) },
  { key: 'fn', label: 'Missed crossings (false negatives)', fmt: (v) => String(v.fn) },
  { key: 'precision', label: 'Precision', fmt: (v) => fmtRate(v.precision) },
  { key: 'recall', label: 'Recall', fmt: (v) => fmtRate(v.recall) },
  { key: 'f1', label: 'F1', fmt: (v) => fmtRate(v.f1) },
  { key: 'count_error', label: 'Count error (counted − labelled)', fmt: (v) => fmtSigned(v.count_error) },
];

export function EvaluationTab({ data }: { data: RunData }) {
  const ev = data.detail.evaluation;
  const m = data.detail.manifest;
  const runPath = `/runs/${encodeURIComponent(m.run_id)}/review`;

  if (!ev) {
    return (
      <Panel title="Compare with labelled crossings" description="Upload the crossings a person labelled for this clip to measure counting accuracy.">
        <EvaluateForm data={data} />
      </Panel>
    );
  }

  const o = ev.overall;
  const cancelling = o.count_error === 0 && o.fp + o.fn > 0;
  const columns: { id: string; label: ReactNode; s: EvalSummary }[] = [
    { id: 'CROSS_IN', label: <Direction type="CROSS_IN" />, s: ev.by_direction.CROSS_IN },
    { id: 'CROSS_OUT', label: <Direction type="CROSS_OUT" />, s: ev.by_direction.CROSS_OUT },
    { id: 'all', label: 'Both directions', s: o },
  ];

  const failures = [
    ...ev.false_positives.map((p) => ({
      kind: 'extra' as const, frame: p.Frame_ID, type: p.Event_Type, text: `Counted for track #${p.Track_ID} with no matching label`,
    })),
    ...ev.false_negatives.map((g) => ({
      kind: 'missed' as const, frame: g.Frame_ID, type: g.Event_Type,
      text: `Person ${g.GT_Person_ID || '?'} was not counted${g.Notes ? `. Note: ${g.Notes}` : ''}`,
    })),
  ].sort((a, b) => a.frame - b.frame);

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-panel border border-rule rounded-lg p-5">
        <p className="text-lg font-semibold leading-snug max-w-[70ch]">
          {o.tp} of {o.gt_count} labelled crossings were matched within ±{ev.tolerance_frames} frames
          {o.fp || o.fn ? `, with ${o.fp} extra ${o.fp === 1 ? 'count' : 'counts'} and ${o.fn} ${o.fn === 1 ? 'miss' : 'misses'}.` : ', with no errors.'}
        </p>
        <p className="text-[13px] text-ink-3 mt-1">
          Labels from {ev.ground_truth_file}, evaluated {new Date(ev.evaluated_at).toLocaleString()}.
          {ev.split === 'dev' && ' This is a dev-set clip: use it for tuning, not as the reported result.'}
        </p>
        {cancelling && (
          <div className="mt-3">
            <Notice>
              The total count is exactly right only because errors cancel out. Report the event-level precision and recall, not just the count.
            </Notice>
          </div>
        )}
        {ev.warnings.map((w) => <div key={w} className="mt-3"><Notice>{w}</Notice></div>)}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Accuracy by direction" bodyClassName="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 border-b border-rule">
                <th className="text-left font-medium px-4 py-2"><span className="sr-only">Measure</span></th>
                {columns.map((c) => <th key={c.id} className="text-right font-medium px-4 py-2 whitespace-nowrap">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key} className="border-b border-rule last:border-0">
                  <td className="px-4 py-2 text-ink-2">{r.label}</td>
                  {columns.map((c) => (
                    <td key={c.id} className={`px-4 py-2 text-right tnum ${c.id === 'all' ? 'font-semibold' : ''}`}>{r.fmt(c.s)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Errors to review" description={failures.length ? 'Open each one in Review to see what the tracker did.' : undefined} bodyClassName="">
          {failures.length === 0 ? (
            <p className="p-4 text-[13px] text-ink-2">Every labelled crossing was matched and nothing extra was counted.</p>
          ) : (
            <ol className="max-h-[420px] overflow-y-auto">
              {failures.map((f, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-rule last:border-0 text-[13px]">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${f.kind === 'extra' ? 'bg-critical-soft text-critical' : 'bg-panel-2 text-ink border border-dashed border-critical'}`}>
                    {f.kind === 'extra' ? 'Extra' : 'Missed'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><Direction type={f.type as EventType} /> <span className="text-ink-3 tnum">frame {f.frame}</span></div>
                    <p className="text-ink-2">{f.text}</p>
                  </div>
                  <Link className="shrink-0 text-ink underline underline-offset-2 hover:no-underline" to={`${runPath}?frame=${Math.max(0, f.frame - Math.round(m.video.fps / 2))}`}>
                    Open in Review
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Matched crossings" description="Positive offset: the system dated the crossing later than the label." bodyClassName="overflow-x-auto">
        {ev.matches.length ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 border-b border-rule text-left">
                <th className="font-medium px-4 py-2">Direction</th>
                <th className="font-medium px-4 py-2 text-right">Labelled frame</th>
                <th className="font-medium px-4 py-2 text-right">Counted frame</th>
                <th className="font-medium px-4 py-2 text-right">Offset</th>
                <th className="font-medium px-4 py-2">Track</th>
                <th className="font-medium px-4 py-2">Person</th>
              </tr>
            </thead>
            <tbody>
              {ev.matches.map((x) => (
                <tr key={x.pred.Event_ID} className="border-b border-rule last:border-0">
                  <td className="px-4 py-2"><Direction type={x.gt.Event_Type} /></td>
                  <td className="px-4 py-2 text-right tnum">{x.gt.Frame_ID}</td>
                  <td className="px-4 py-2 text-right tnum">{x.pred.Frame_ID}</td>
                  <td className="px-4 py-2 text-right tnum">{fmtSigned(x.frame_offset)}</td>
                  <td className="px-4 py-2 tnum">#{x.pred.Track_ID}</td>
                  <td className="px-4 py-2 text-ink-2">{x.gt.GT_Person_ID}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-ink-2 p-4">No crossings were matched.</p>
        )}
      </Panel>

      <details className="bg-panel border border-rule rounded-lg">
        <summary className="px-4 py-3 text-sm font-medium">Evaluate again with different labels or tolerance</summary>
        <div className="px-4 pb-4"><EvaluateForm data={data} compact /></div>
      </details>
    </div>
  );
}
