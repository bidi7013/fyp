import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FlaskConical, Plus } from 'lucide-react';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';
import { useJobs } from '../lib/jobs';
import { fmtDate, fmtRate, fmtSigned, trackerLabel } from '../lib/format';
import { Badge, Button, EmptyState, Loading, Notice, PageHeader, SplitBadge } from '../components/ui';

export function RunsPage() {
  const { runsVersion, jobs, refresh } = useJobs();
  const runs = useAsync(() => api.runs(), String(runsVersion));
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();
  const failed = jobs.filter((j) => j.status === 'failed').slice(0, 3);

  const startDemo = async () => {
    setStarting(true);
    setStartError(undefined);
    try {
      await api.startDemo();
      refresh();
    } catch (e) {
      setStartError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const actions = (
    <>
      <Button icon={<FlaskConical className="w-4 h-4" />} onClick={startDemo} disabled={starting}>
        Create demo run
      </Button>
      <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/new')}>
        New run
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Runs"
        description="Each run is one recorded clip processed with one tracker configuration. Open a run to review its crossings against the video."
        actions={actions}
      />
      <div className="flex flex-col gap-3 mb-5 empty:hidden">
        {startError && <Notice tone="error">{startError}</Notice>}
        {failed.map((j) => (
          <Notice key={j.id} tone="error">
            <strong className="font-semibold">{j.label}</strong> failed. {j.error}
          </Notice>
        ))}
      </div>

      {runs.loading && !runs.data ? (
        <Loading label="Loading runs" />
      ) : runs.error ? (
        <Notice tone="error">{runs.error.message}</Notice>
      ) : !runs.data?.length ? (
        <EmptyState title="No runs yet" actions={actions}>
          Process a recorded clip, or create the demo run: a synthetic scene with scripted pedestrians that shows the whole
          workflow, including a missed and a duplicated count, without model weights or footage.
        </EmptyState>
      ) : (
        <div className="bg-panel border border-rule rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-ink-3 border-b border-rule">
                <th className="font-medium px-4 py-2.5">Clip</th>
                <th className="font-medium px-3 py-2.5">Tracker</th>
                <th className="font-medium px-3 py-2.5 text-right">In</th>
                <th className="font-medium px-3 py-2.5 text-right">Out</th>
                <th className="font-medium px-3 py-2.5 text-right">Net</th>
                <th className="font-medium px-3 py-2.5 text-right">F1 vs labels</th>
                <th className="font-medium px-3 py-2.5 text-right">Speed</th>
                <th className="font-medium px-4 py-2.5 text-right">Processed</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((run) => {
                const t = run.counts.total;
                return (
                  <tr key={run.run_id} className="border-b border-rule last:border-0 hover:bg-panel-2">
                    <td className="px-4 py-3 min-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/runs/${encodeURIComponent(run.run_id)}`} className="font-medium text-ink hover:underline underline-offset-2">
                          {run.video.name}
                        </Link>
                        <SplitBadge split={run.video.split} />
                        {run.source === 'simulation' && <Badge>Synthetic</Badge>}
                      </div>
                      <div className="text-xs text-ink-3 mt-0.5 font-mono truncate max-w-[360px]">{run.run_id}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{trackerLabel(run.tracking.tracker)}</td>
                    <td className="px-3 py-3 text-right tnum">{t.in}</td>
                    <td className="px-3 py-3 text-right tnum">{t.out}</td>
                    <td className="px-3 py-3 text-right tnum">{fmtSigned(t.net)}</td>
                    <td className="px-3 py-3 text-right tnum text-ink-2">
                      {run.evaluation_summary ? fmtRate(run.evaluation_summary.f1) : <span className="text-ink-3">Not evaluated</span>}
                    </td>
                    <td className="px-3 py-3 text-right tnum text-ink-2">
                      {run.performance.processing_fps != null ? `${run.performance.processing_fps.toFixed(1)} fps` : '–'}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 whitespace-nowrap">{fmtDate(run.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
