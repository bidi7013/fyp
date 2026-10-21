import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { EventType, Split } from '../types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-panel hover:opacity-90 border border-ink',
  secondary: 'bg-panel text-ink border border-rule-strong hover:bg-panel-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-panel-2 border border-transparent',
  danger: 'bg-panel text-critical border border-rule-strong hover:bg-critical-soft',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  const sizing = size === 'sm' ? 'h-8 px-2.5 text-[13px] gap-1.5' : 'h-9 px-3.5 text-sm gap-2';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

type Tone = 'neutral' | 'in' | 'out' | 'good' | 'critical' | 'mark';

const tones: Record<Tone, string> = {
  neutral: 'bg-panel-2 text-ink-2 border-rule',
  in: 'bg-in-soft text-ink border-transparent',
  out: 'bg-out-soft text-ink border-transparent',
  good: 'bg-good-soft text-good border-transparent',
  critical: 'bg-critical-soft text-critical border-transparent',
  mark: 'bg-mark-soft text-ink border-transparent',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium border ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function SplitBadge({ split }: { split: Split }) {
  return (
    <Badge tone={split === 'test' ? 'mark' : 'neutral'}>
      {split === 'test' ? 'Test set' : 'Dev set'}
    </Badge>
  );
}

/** Direction marker: colour swatch + word, so direction is never colour alone. */
export function Direction({ type, short = false }: { type: EventType; short?: boolean }) {
  const isIn = type === 'CROSS_IN';
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={isIn ? 'text-in' : 'text-out'}>
        {isIn ? <path d="M5 1 L9 8 H1 Z" fill="currentColor" /> : <path d="M5 9 L9 2 H1 Z" fill="currentColor" />}
      </svg>
      {short ? (isIn ? 'In' : 'Out') : isIn ? 'Crossed in' : 'Crossed out'}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-ink-2 max-w-[68ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 bg-panel border border-rule rounded-lg ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-rule">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="text-[13px] text-ink-3 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'error' | 'good'; children: ReactNode; action?: ReactNode }) {
  const style =
    tone === 'error'
      ? 'bg-critical-soft border-critical/30 text-ink'
      : tone === 'good'
        ? 'bg-good-soft border-good/30 text-ink'
        : 'bg-panel-2 border-rule text-ink-2';
  const Icon = tone === 'error' ? AlertCircle : tone === 'good' ? CheckCircle2 : Info;
  const iconTone = tone === 'error' ? 'text-critical' : tone === 'good' ? 'text-good' : 'text-ink-3';
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${style}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconTone}`} aria-hidden />
      <div className="flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm py-10 justify-center" role="status">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule-strong rounded-lg px-6 py-12 text-center bg-panel">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mt-1.5 text-ink-2 max-w-[56ch] mx-auto">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-rule-strong bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 px-2.5 rounded text-[13px] font-medium tnum transition-colors ${
            value === o.value ? 'bg-ink text-panel' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'h-9 rounded-md border border-rule-strong bg-panel px-2.5 text-sm text-ink tnum focus:outline-none focus:border-in w-full';

export function ProgressBar({ value }: { value: number | null }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-panel-2 border border-rule overflow-hidden" role="progressbar"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value == null ? undefined : Math.round(value * 100)}>
      <div
        className={`h-full bg-ink rounded-full ${value == null ? 'w-1/3 animate-pulse' : ''}`}
        style={value == null ? undefined : { width: `${Math.max(2, value * 100)}%` }}
      />
    </div>
  );
}
