import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { api } from '../../api';
import { useAsync } from '../../lib/useAsync';
import { buildTrackIndex, type TrackIndex } from '../../lib/tracks';
import { fmtDate, trackerLabel } from '../../lib/format';
import { Badge, Button, Loading, Notice, SplitBadge } from '../../components/ui';
import type { CrossingEvent, Evaluation, RunDetail, TracksColumns } from '../../types';
import { ReviewTab } from './ReviewTab';
import { SummaryTab } from './SummaryTab';
import { EvaluationTab } from './EvaluationTab';
import { DetailsTab } from './DetailsTab';

export interface RunData {
  detail: RunDetail;
  events: CrossingEvent[];
  tracks: TracksColumns | undefined;
  index: TrackIndex | undefined;
  setEvaluation: (e: Evaluation) => void;
}

const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'details', label: 'Details' },
] as const;

export function RunPage() {
  const { runId = '', tab = 'review' } = useParams();
  const navigate = useNavigate();
  const base = useAsync(() => Promise.all([api.run(runId), api.events(runId)]), runId);
  const [loadedTracks, setLoadedTracks] = useState<{ runId: string; tracks?: TracksColumns; error?: string }>();
  const [newEvaluation, setNewEvaluation] = useState<{ runId: string; evaluation: Evaluation }>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .tracks(runId)
      .then((t) => alive && setLoadedTracks({ runId, tracks: t }))
      .catch((e: Error) => alive && setLoadedTracks({ runId, error: e.message }));
    return () => {
      alive = false;
    };
  }, [runId]);

  const tracks = loadedTracks?.runId === runId ? loadedTracks.tracks : undefined;
  const tracksError = loadedTracks?.runId === runId ? loadedTracks.error : undefined;
  const evaluation =
    newEvaluation?.runId === runId ? newEvaluation.evaluation : (base.data?.[0].evaluation ?? null);
  const setEvaluation = (e: Evaluation) => setNewEvaluation({ runId, evaluation: e });

  const index = useMemo(
    () => (tracks && base.data ? buildTrackIndex(tracks, base.data[0].manifest.video.frame_count) : undefined),
    [tracks, base.data],
  );

  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/runs/${encodeURIComponent(runId)}/review`} replace />;
  if (base.loading && !base.data) return <Loading label="Loading run" />;
  if (base.error || !base.data) {
    return (
      <Notice tone="error" action={<Link to="/" className="text-[13px] underline">Back to runs</Link>}>
        {base.error?.message ?? 'Run not found'}
      </Notice>
    );
  }

  const [detailRaw, events] = base.data;
  const detail = { ...detailRaw, evaluation };
  const m = detail.manifest;
  const data: RunData = { detail, events, tracks, index, setEvaluation };

  const remove = async () => {
    if (!window.confirm(`Delete run ${m.run_id}? Its events, tracks, video copy and evaluation are removed from outputs/runs. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteRun(m.run_id);
      navigate('/');
    } catch (e) {
      window.alert((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <>
      <Link to="/" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink mb-3">
        <ChevronLeft className="w-4 h-4" aria-hidden /> Runs
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold break-all">{m.video.name}</h1>
            <SplitBadge split={m.video.split} />
            {m.source === 'simulation' && <Badge>Synthetic scene</Badge>}
          </div>
          <p className="text-[13px] text-ink-2 mt-1">
            {trackerLabel(m.tracking.tracker)}, processed {fmtDate(m.created_at)}
            <span className="font-mono text-xs text-ink-3 ml-2 break-all">{m.run_id}</span>
          </p>
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={remove} disabled={deleting}>
          Delete run
        </Button>
      </div>

      <nav className="flex gap-1 border-b border-rule mb-5 overflow-x-auto" aria-label="Run sections">
        {TABS.map((t) => (
          <NavLink
            key={t.id}
            to={`/runs/${encodeURIComponent(runId)}/${t.id}`}
            className={({ isActive }) =>
              `px-3 h-10 inline-flex items-center text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                isActive ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`
            }
          >
            {t.label}
            {t.id === 'evaluation' && evaluation && (
              <span className="ml-1.5 text-xs text-ink-3 tnum">F1 {evaluation.overall.f1 != null ? (evaluation.overall.f1 * 100).toFixed(0) + '%' : '–'}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {tracksError && <div className="mb-4"><Notice tone="error">Trajectories could not be loaded: {tracksError}</Notice></div>}
      {tab === 'review' && <ReviewTab data={data} />}
      {tab === 'summary' && <SummaryTab data={data} />}
      {tab === 'evaluation' && <EvaluationTab data={data} />}
      {tab === 'details' && <DetailsTab data={data} />}
    </>
  );
}
