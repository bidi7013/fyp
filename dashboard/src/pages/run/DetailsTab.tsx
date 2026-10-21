import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../api';
import { fmtDate, trackerLabel } from '../../lib/format';
import { Panel } from '../../components/ui';
import type { RunData } from './RunPage';

const FILE_NOTES: Record<string, string> = {
  'manifest.json': 'Video metadata, configuration, lines, counts, diagnostics and throughput',
  'events.csv': 'One row per crossing event',
  'tracks.csv': 'One row per tracked person per frame (trajectories)',
  'video.webm': 'Frame-aligned review copy of the clip',
  'annotated.webm': 'Copy with boxes, line and counts drawn in',
  'evaluation.json': 'Matching against the labelled crossings',
  'ground_truth.csv': 'The labels used for the evaluation',
};

const DICTIONARY: { file: string; rows: [string, string][] }[] = [
  {
    file: 'events.csv',
    rows: [
      ['Event_ID', 'Sequential id within the run'],
      ['Frame_ID', 'Frame where the anchor crossed the line (0-based)'],
      ['Time_S', 'Frame_ID ÷ fps, seconds from the start of the clip'],
      ['Timestamp', 'Wall-clock time, only when the clip start time is configured'],
      ['Track_ID', 'Temporary tracker id; not a person identity'],
      ['Line_ID', 'Counting line that was crossed'],
      ['Event_Type', 'CROSS_IN or CROSS_OUT, from the line’s IN direction'],
      ['Anchor_X, Anchor_Y', 'Bottom-centre of the box at Frame_ID, in pixels'],
    ],
  },
  {
    file: 'tracks.csv',
    rows: [
      ['Frame_ID, Track_ID', 'Which tracked person, in which frame'],
      ['X1, Y1, X2, Y2', 'Bounding box corners in pixels'],
      ['Confidence', 'Detector score of the associated box'],
      ['Anchor_X, Anchor_Y', 'Bottom-centre point used for counting'],
    ],
  },
];

function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="text-[13px]">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 px-4 py-2 border-b border-rule last:border-0">
          <dt className="text-ink-2">{k}</dt>
          <dd className="text-ink tnum break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailsTab({ data }: { data: RunData }) {
  const m = data.detail.manifest;
  const c = m.config;
  const trackerParams = Object.entries(m.tracker_parameters).filter(([k]) => k !== 'tracker_type');

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Files" description={`Saved in outputs/runs/${m.run_id}/`} bodyClassName="">
        <ul className="text-[13px]">
          {data.detail.files.map((name) => (
            <li key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-rule last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[12.5px]">{name}</div>
                <div className="text-ink-3">{FILE_NOTES[name]}</div>
              </div>
              <a
                href={api.fileUrl(m.run_id, name, true)}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-rule-strong hover:bg-panel-2 font-medium"
              >
                <Download className="w-4 h-4" aria-hidden /> Download
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Provenance" bodyClassName="">
        <KV
          items={[
            ['Run', <span key="run" className="font-mono text-[12.5px]">{m.run_id}</span>],
            ['Processed', fmtDate(m.created_at)],
            ['Source', m.source === 'simulation' ? 'Synthetic scene (scripted tracks)' : m.video.path ?? m.video.name],
            ['Split', m.video.split === 'test' ? 'Test set' : 'Dev set'],
            ['Video', `${m.video.width}×${m.video.height}, ${m.video.fps} fps, ${m.video.frame_count} frames`],
            ['Code version', m.git_commit ?? 'Not recorded'],
            ['Device', m.performance.device],
            ['Processing time', `${m.performance.processing_seconds} s`],
          ]}
        />
      </Panel>

      <Panel title="Detector and tracker" bodyClassName="">
        <KV
          items={[
            ['Detector weights', c.detector.model_weights],
            ['Detection confidence', c.detector.confidence_threshold],
            ['NMS IoU', c.detector.iou_threshold],
            ['Input size', `${c.detector.image_size} px`],
            ['Tracker', trackerLabel(m.tracking.tracker)],
            ...trackerParams.map(([k, v]) => [k, String(v)] as [string, ReactNode]),
          ]}
        />
      </Panel>

      <Panel title="Counting rule" bodyClassName="">
        <KV
          items={[
            ['Reference point', c.counting.anchor_point === 'bottom_center' ? 'Bottom-centre of the box' : 'Box centre'],
            ['Deadband', `±${c.counting.hysteresis_buffer_pixels} px around each line`],
            ['Cooldown', `${c.counting.min_frames_between_events} frames per track`],
            ['Forget unseen tracks after', `${c.counting.forget_track_after_frames} frames`],
            ...m.lines.map((l) => [
              l.name,
              `${l.id}: (${l.start.join(', ')}) to (${l.end.join(', ')}), IN towards (${l.in_direction.map((v) => +v.toFixed(2)).join(', ')})`,
            ] as [string, ReactNode]),
          ]}
        />
      </Panel>

      <Panel title="Data dictionary" description="Full definitions are in docs/data_dictionary.md." className="lg:col-span-2" bodyClassName="grid gap-0 md:grid-cols-2">
        {DICTIONARY.map((d) => (
          <div key={d.file} className="md:border-r last:border-0 border-rule">
            <h3 className="px-4 pt-3 pb-1 font-mono text-[12.5px]">{d.file}</h3>
            <KV items={d.rows} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
