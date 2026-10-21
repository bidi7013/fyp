import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload } from 'lucide-react';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';
import { fmtBytes, fmtDuration } from '../lib/format';
import { Badge, Button, EmptyState, Loading, Notice, PageHeader, Segmented } from '../components/ui';
import type { Split, VideoEntry } from '../types';

export function VideoUpload({ onUploaded, defaultSplit = 'dev' }: { onUploaded: (v: VideoEntry) => void; defaultSplit?: Split }) {
  const [split, setSplit] = useState<Split>(defaultSplit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(undefined);
    try {
      onUploaded(await api.uploadVideo(file, split));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Add to split"
          value={split}
          onChange={setSplit}
          options={[
            { value: 'dev', label: 'Dev set' },
            { value: 'test', label: 'Test set' },
          ]}
        />
        <Button icon={<Upload className="w-4 h-4" />} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : 'Upload video'}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".mp4,.avi,.mov,.mkv,.webm,video/*"
          className="sr-only"
          aria-label="Video file"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function VideoRow({ v }: { v: VideoEntry }) {
  const navigate = useNavigate();
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-rule last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink truncate">{v.name}</div>
        <div className="text-xs text-ink-3 mt-0.5 tnum">
          {v.error
            ? v.error
            : [`${v.width}×${v.height}`, v.fps ? `${v.fps} fps` : null, fmtDuration(v.duration_s), fmtBytes(v.size_bytes)]
                .filter(Boolean)
                .join(', ')}
        </div>
      </div>
      {v.has_lines ? <Badge tone="good">Line drawn</Badge> : <Badge>No line yet</Badge>}
      <Button size="sm" disabled={!!v.error} onClick={() => navigate(`/new?split=${v.split}&video=${encodeURIComponent(v.name)}`)}>
        Set up run
      </Button>
    </li>
  );
}

export function VideosPage() {
  const videos = useAsync(() => api.videos(), 'videos');
  const groups: { split: Split; title: string; note: string }[] = [
    { split: 'dev', title: 'Dev set', note: 'Use these clips to tune the line position, deadband and tracker settings.' },
    { split: 'test', title: 'Test set', note: 'Held out. Process with settings fixed on the dev set and report these results.' },
  ];

  return (
    <>
      <PageHeader
        title="Videos"
        description="Recorded single-camera clips, kept in separate development and test sets. A clip lives in one set only."
        actions={<VideoUpload onUploaded={videos.reload} />}
      />
      {videos.loading && !videos.data ? (
        <Loading label="Loading videos" />
      ) : videos.error ? (
        <Notice tone="error">{videos.error.message}</Notice>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((g) => {
            const items = (videos.data ?? []).filter((v) => v.split === g.split);
            return (
              <section key={g.split}>
                <h2 className="text-[15px] font-semibold">{g.title}</h2>
                <p className="text-[13px] text-ink-3 mb-3">{g.note}</p>
                {items.length ? (
                  <ul className="bg-panel border border-rule rounded-lg">{items.map((v) => <VideoRow key={v.name} v={v} />)}</ul>
                ) : (
                  <EmptyState title={`No ${g.split} clips`}>
                    Upload a clip here, or copy files into <code className="font-mono text-[12px]">data/videos/{g.split}/</code>.
                  </EmptyState>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
