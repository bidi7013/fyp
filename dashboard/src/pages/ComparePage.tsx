import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';
import { useJobs } from '../lib/jobs';
import { fmtDate, fmtRate, fmtSigned, trackerLabel } from '../lib/format';
import { EmptyState, Loading, Notice, PageHeader, SplitBadge } from '../components/ui';
import type { Manifest } from '../types';

type Row = { label: string; group: string; value: (m: Manifest) => string };

const ROWS: Row[] = [
  { group: 'Counting', label: 'Crossed in', value: (m) => String(m.counts.total.in) },
  { group: 'Counting', label: 'Crossed out', value: (m) => String(m.counts.total.out) },
  { group: 'Counting', label: 'Net flow', value: (m) => fmtSigned(m.counts.total.net) },
  { group: 'Accuracy vs labels', label: 'Precision', value: (m) => fmtRate(m.evaluation_summary?.precision) },
  { group: 'Accuracy vs labels', label: 'Recall', value: (m) => fmtRate(m.evaluation_summary?.recall) },
  { group: 'Accuracy vs labels', label: 'F1', value: (m) => fmtRate(m.evaluation_summary?.f1) },
  { group: 'Accuracy vs labels', label: 'Extra counts', value: (m) => (m.evaluation_summary ? String(m.evaluation_summary.fp) : '–') },
  { group: 'Accuracy vs labels', label: 'Missed crossings', value: (m) => (m.evaluation_summary ? String(m.evaluation_summary.fn) : '–') },
  { group: 'Accuracy vs labels', label: 'Count error', value: (m) => (m.evaluation_summary ? fmtSigned(m.evaluation_summary.count_error) : '–') },
  { group: 'Tracking (no labels needed)', label: 'Tracks', value: (m) => String(m.tracking.unique_tracks) },
  { group: 'Tracking (no labels needed)', label: 'Median track length', value: (m) => `${m.tracking.median_track_length_frames} frames` },
  { group: 'Tracking (no labels needed)', label: 'Short tracks', value: (m) => String(m.tracking.short_tracks) },
  { group: 'Tracking (no labels needed)', label: 'Tracks born in deadband', value: (m) => String(m.diagnostics.tracks_started_in_deadband) },
  { group: 'Cost', label: 'Processing speed', value: (m) => (m.performance.processing_fps != null ? `${m.performance.processing_fps.toFixed(1)} fps` : '–') },
];

export function ComparePage() {
  const { runsVersion } = useJobs();
  const runs = useAsync(() => api.runs(), String(runsVersion));
  const [params, setParams] = useSearchParams();
  const selected = useMemo(() => (params.get('runs') ?? '').split(',').filter(Boolean), [params]);
  const chosen = (runs.data ?? []).filter((r) => selected.includes(r.run_id));
  const clips = new Set(chosen.map((r) => r.video.name));

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id].slice(-4);
    setParams(next.length ? { runs: next.join(',') } : {}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Compare runs"
        description="Put tracker configurations side by side on the same clip. Tracking quality and counting accuracy are listed separately: better tracks do not by themselves mean better counts."
      />
      {runs.loading && !runs.data ? (
        <Loading label="Loading runs" />
      ) : runs.error ? (
        <Notice tone="error">{runs.error.message}</Notice>
      ) : !runs.data?.length ? (
        <EmptyState title="Nothing to compare yet" actions={<Link to="/new" className="underline">Start a run</Link>}>
          Process the same clip with ByteTrack and with BoT-SORT, then compare them here.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <fieldset className="bg-panel border border-rule rounded-lg self-start">
            <legend className="sr-only">Runs to compare</legend>
            <p className="px-4 pt-3 pb-2 text-[13px] text-ink-3">Choose up to four runs.</p>
            <ul className="max-h-[560px] overflow-y-auto">
              {runs.data.map((r) => (
                <li key={r.run_id} className="border-t border-rule">
                  <label className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-panel-2">
                    <input type="checkbox" className="mt-1 accent-[var(--ink)]" checked={selected.includes(r.run_id)} onChange={() => toggle(r.run_id)} />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{r.video.name}</span>
                      <span className="block text-xs text-ink-3">{trackerLabel(r.tracking.tracker)}, {fmtDate(r.created_at)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="min-w-0 flex flex-col gap-3">
            {clips.size > 1 && <Notice>These runs use different clips. Compare configurations on the same clip to isolate the tracker’s effect.</Notice>}
            {chosen.length < 2 ? (
              <EmptyState title="Select at least two runs">Their counts, accuracy and tracking diagnostics appear here side by side.</EmptyState>
            ) : (
              <div className="bg-panel border border-rule rounded-lg overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-rule align-bottom">
                      <th className="px-4 py-3 text-left font-medium text-ink-3"><span className="sr-only">Measure</span></th>
                      {chosen.map((r) => (
                        <th key={r.run_id} className="px-4 py-3 text-right font-medium min-w-[150px]">
                          <Link to={`/runs/${encodeURIComponent(r.run_id)}/summary`} className="hover:underline underline-offset-2 block">
                            {trackerLabel(r.tracking.tracker)}
                          </Link>
                          <span className="block text-xs text-ink-3 font-normal truncate">{r.video.name}</span>
                          <span className="inline-block mt-1"><SplitBadge split={r.video.split} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, i) => (
                      <tr key={row.label} className="border-b border-rule last:border-0">
                        <th scope="row" className="px-4 py-2 text-left font-normal text-ink-2">
                          {(i === 0 || ROWS[i - 1].group !== row.group) && (
                            <span className="block text-xs font-semibold text-ink mt-2 mb-1">{row.group}</span>
                          )}
                          {row.label}
                        </th>
                        {chosen.map((r) => (
                          <td key={r.run_id} className="px-4 py-2 text-right tnum align-bottom">{row.value(r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
