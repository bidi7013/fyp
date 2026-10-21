import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { countsAt, trackLengths } from '../../lib/tracks';
import { fmtDuration, fmtSigned } from '../../lib/format';
import { CumulativeChart, TrackLengthHistogram } from '../../components/charts';
import { Loading, Panel } from '../../components/ui';
import type { Counts } from '../../types';
import type { RunData } from './RunPage';

const same = (a: Counts, b: Counts) => a.in === b.in && a.out === b.out;
const fmtCounts = (c: Counts) => `${c.in} in, ${c.out} out`;

function Agreement({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 text-good font-medium"><CheckCircle2 className="w-4 h-4" aria-hidden /> Agrees</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-critical font-medium"><XCircle className="w-4 h-4" aria-hidden /> Differs</span>
  );
}

export function SummaryTab({ data }: { data: RunData }) {
  const { detail, events, tracks, index } = data;
  const m = detail.manifest;
  const total = m.counts.total;
  const lastFrame = m.video.frame_count - 1;

  // Three independent routes to the same numbers: the pipeline's own totals,
  // a recount of events.csv, and the rule the Review panel uses at the last frame.
  const checks = useMemo(() => {
    let inCsv = 0;
    let outCsv = 0;
    for (const e of events) {
      if (e.Event_Type === 'CROSS_IN') inCsv++;
      else outCsv++;
    }
    const recount = { in: inCsv, out: outCsv, net: inCsv - outCsv };
    const review = countsAt(events, lastFrame);
    let supported: number | null = null;
    if (tracks && index) {
      supported = 0;
      for (const e of events) {
        const rows = index.byFrame.get(e.Frame_ID) ?? [];
        if (rows.some((r) => tracks.Track_ID[r] === e.Track_ID && Math.abs(tracks.Anchor_X[r] - e.Anchor_X) < 0.2 && Math.abs(tracks.Anchor_Y[r] - e.Anchor_Y) < 0.2)) {
          supported++;
        }
      }
    }
    const perLine = m.lines.map((l) => ({
      id: l.id,
      manifest: m.counts.by_line[l.id] ?? { in: 0, out: 0, net: 0 },
      recount: countsAt(events, lastFrame, l.id),
    }));
    return { recount, review, supported, perLine };
  }, [events, tracks, index, lastFrame, m]);

  const lengths = useMemo(() => (index ? trackLengths(index) : []), [index]);
  const perf = m.performance;

  const tiles = [
    { label: 'Crossed in', value: String(total.in), accent: 'var(--in)' },
    { label: 'Crossed out', value: String(total.out), accent: 'var(--out)' },
    { label: 'Net flow', value: fmtSigned(total.net) },
    { label: 'Tracks', value: String(m.tracking.unique_tracks), note: `${m.tracking.short_tracks} shorter than 1 s` },
    {
      label: 'Processing speed',
      value: perf.processing_fps != null ? `${perf.processing_fps.toFixed(1)} fps` : '–',
      note: perf.realtime_factor != null ? `${perf.realtime_factor}× real time on ${perf.device}` : perf.device,
    },
    { label: 'Clip length', value: fmtDuration(m.video.duration_s), note: `${m.video.frame_count} frames at ${m.video.fps} fps` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="bg-rule border border-rule rounded-lg overflow-hidden grid gap-px grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="bg-panel px-4 py-3.5 min-w-0">
            <dt className="text-[13px] text-ink-2 flex items-center gap-1.5">
              {t.accent && <span className="w-2 h-2 rounded-full" style={{ background: t.accent }} aria-hidden />}
              {t.label}
            </dt>
            <dd className="text-2xl font-semibold tnum mt-0.5">{t.value}</dd>
            {t.note && <dd className="text-xs text-ink-3 mt-0.5 truncate" title={t.note}>{t.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Panel title="Crossings over time" description="Cumulative count of each direction across the clip.">
          <CumulativeChart events={events} duration={m.video.duration_s} fps={m.video.fps} />
        </Panel>
        <Panel title="How long tracks lasted" description="Many short tracks usually mean occlusion or identity switches.">
          {index ? (
            lengths.length ? (
              <TrackLengthHistogram lengths={lengths} fps={m.video.fps} threshold={m.tracking.short_track_threshold_frames} />
            ) : (
              <p className="text-ink-2 text-[13px]">No people were tracked in this clip.</p>
            )
          ) : (
            <Loading label="Loading trajectories" />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Do the exports agree?"
          description="The dashboard, the event log and the run totals must describe the same events. Each row checks one link."
          bodyClassName=""
        >
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-rule">
                <td className="px-4 py-2.5">
                  Run totals in manifest.json
                  <div className="text-ink-3 tnum">{fmtCounts(total)}</div>
                </td>
                <td className="px-4 py-2.5 text-ink-2">vs recount of events.csv <div className="text-ink-3 tnum">{fmtCounts(checks.recount)}</div></td>
                <td className="px-4 py-2.5 text-right"><Agreement ok={same(total, checks.recount)} /></td>
              </tr>
              <tr className="border-b border-rule">
                <td className="px-4 py-2.5">
                  Review panel at the last frame
                  <div className="text-ink-3 tnum">{fmtCounts(checks.review)}</div>
                </td>
                <td className="px-4 py-2.5 text-ink-2">vs recount of events.csv <div className="text-ink-3 tnum">{fmtCounts(checks.recount)}</div></td>
                <td className="px-4 py-2.5 text-right"><Agreement ok={same(checks.review, checks.recount)} /></td>
              </tr>
              <tr className={m.lines.length > 1 ? 'border-b border-rule' : ''}>
                <td className="px-4 py-2.5">
                  Events backed by a trajectory point
                  <div className="text-ink-3 tnum">
                    {checks.supported == null ? 'Loading tracks.csv' : `${checks.supported} of ${events.length}`}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-ink-2">same track, frame and anchor in tracks.csv</td>
                <td className="px-4 py-2.5 text-right">{checks.supported != null && <Agreement ok={checks.supported === events.length} />}</td>
              </tr>
              {m.lines.length > 1 &&
                checks.perLine.map((l) => (
                  <tr key={l.id} className="border-b border-rule last:border-0">
                    <td className="px-4 py-2.5">{l.id} in manifest <div className="text-ink-3 tnum">{fmtCounts(l.manifest)}</div></td>
                    <td className="px-4 py-2.5 text-ink-2">vs events.csv <div className="text-ink-3 tnum">{fmtCounts(l.recount)}</div></td>
                    <td className="px-4 py-2.5 text-right"><Agreement ok={same(l.manifest, l.recount)} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Tracking diagnostics" description="Signals that point at counting errors, available without labels." bodyClassName="">
          <dl className="text-[13px]">
            {[
              {
                label: 'Tracks first seen inside the deadband',
                value: m.diagnostics.tracks_started_in_deadband,
                note: 'Their first crossing cannot be counted. Several near the line usually means identity switches there.',
              },
              {
                label: 'Events blocked by the cooldown',
                value: m.diagnostics.suppressed_by_cooldown,
                note: `A track reversed across the line within ${m.config.counting.min_frames_between_events} frames of its last event.`,
              },
              {
                label: 'Short tracks',
                value: `${m.tracking.short_tracks} of ${m.tracking.unique_tracks}`,
                note: `Visible for fewer than ${m.tracking.short_track_threshold_frames} frames.`,
              },
              {
                label: 'Median track length',
                value: `${m.tracking.median_track_length_frames} frames`,
                note: `Mean ${m.tracking.mean_track_length_frames} frames.`,
              },
            ].map((d) => (
              <div key={d.label} className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-b border-rule last:border-0">
                <dt className="font-medium text-ink">{d.label}</dt>
                <dd className="tnum font-semibold text-right">{d.value}</dd>
                <dd className="col-span-2 text-ink-3">{d.note}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
