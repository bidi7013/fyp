import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router';
import { Columns3, Film, ListVideo, Plus, X } from 'lucide-react';
import { api } from '../api';
import { useJobs } from '../lib/jobs';
import { ProgressBar } from './ui';

export function BrandMark({ className = '' }: { className?: string }) {
  // A counting line with the IN arrow crossing it: the one idea the product is about.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      <path d="M6 18 H26" stroke="var(--panel)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 6 V24" stroke="var(--in)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11.5 20 L16 25.5 L20.5 20" fill="none" stroke="var(--in)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const nav = [
  { to: '/', label: 'Runs', icon: ListVideo, end: true },
  { to: '/new', label: 'New run', icon: Plus },
  { to: '/videos', label: 'Videos', icon: Film },
  { to: '/compare', label: 'Compare', icon: Columns3 },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2.5 rounded-md px-2.5 h-9 text-sm font-medium transition-colors ${
    isActive ? 'bg-panel text-ink border border-rule shadow-[0_1px_0_var(--rule)]' : 'text-ink-2 hover:text-ink border border-transparent'
  }`;
}

function ActiveJobs() {
  const { jobs, refresh } = useJobs();
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  if (!active.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {active.map((job) => (
        <div key={job.id} className="text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-ink font-medium" title={job.label}>{job.label}</span>
            <button
              className="text-ink-3 hover:text-critical p-0.5 rounded"
              aria-label={`Cancel ${job.label}`}
              title="Cancel"
              onClick={() => api.cancelJob(job.id).then(refresh)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={job.status === 'queued' ? 0 : job.progress} />
          </div>
          <p className="mt-1 text-xs text-ink-3 tnum">
            {job.status === 'queued'
              ? 'Waiting for the current job'
              : job.frames_total
                ? `Frame ${job.frames_done} of ${job.frames_total}`
                : job.frames_done
                  ? `Frame ${job.frames_done}`
                  : 'Loading model'}
          </p>
        </div>
      ))}
    </div>
  );
}

function ApiStatus() {
  const { online, health } = useJobs();
  const dot = online == null ? 'bg-ink-3' : online ? 'bg-good' : 'bg-critical';
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3">
      <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
      {online == null ? 'Checking the API' : online ? `API connected, v${health?.version ?? ''}` : 'API offline'}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { online } = useJobs();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden lg:flex flex-col gap-6 border-r border-rule px-4 py-5 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-1">
          <BrandMark className="w-7 h-7" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">ASPIRE-Vision</span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="w-4 h-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-5">
          <ActiveJobs />
          <ApiStatus />
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-rule">
        <div className="flex items-center justify-between px-4 h-12">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="w-6 h-6" />
            <span className="font-semibold tracking-tight">ASPIRE-Vision</span>
          </Link>
          <ApiStatus />
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto" aria-label="Main">
          {nav.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="max-w-[1320px] mx-auto">
          {online === false && (
            <div className="mb-5 rounded-md border border-critical/30 bg-critical-soft px-3 py-2.5 text-[13px] text-ink" role="alert">
              The dashboard cannot reach the local API. Start it from the project folder with{' '}
              <code className="font-mono text-[12px] bg-panel px-1 py-0.5 rounded border border-rule">python -m src.cli serve</code>, then
              this page reconnects on its own.
            </div>
          )}
          <div className="lg:hidden mb-4 empty:hidden">
            <ActiveJobs />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
