import React, { useEffect, useState } from 'react';
import ModalPortal from '../ModalPortal';

// Shared look for the admin console's forms and panels (Create Online Test, question editor,
// bulk upload, Manage Institutes): layered dark cards, emerald accents, soft rings and
// press feedback. Keep new admin screens on these so they stay consistent.

export const Svg: React.FC<{ d: string; className?: string }> = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const ICONS = {
  check: 'M4.5 12.75l6 6 9-13.5',
  close: 'M6 18L18 6M6 6l12 12',
  edit: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  trash: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  photo: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  flag: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  undo: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  building: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
} as const;

/** Section card. With `step` it shows a numbered badge (wizard-style forms); `icon` shows an icon badge instead. */
export const Card: React.FC<{
  step?: number;
  icon?: string;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  raised?: boolean;
  className?: string;
  bodyClassName?: string;
}> = ({ step, icon, title, subtitle, aside, children, raised, className = '', bodyClassName = 'p-5 sm:p-6' }) => (
  <section
    className={`relative rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-1 ring-inset ring-white/[0.07] shadow-[0_20px_50px_-24px_rgb(var(--shadow-rgb)/calc(0.9*var(--shadow-k))),inset_0_1px_0_rgba(255,255,255,0.04)] light:rounded-[1.25rem] light:from-paper light:to-paper light:ring-gray-700 light:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.10)] ${raised ? 'z-10' : ''} ${className}`}
  >
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] light:border-gray-700 px-5 sm:px-6 py-4">
      <div className="flex items-center gap-3">
        {step !== undefined ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-sm font-black text-emerald-300 ring-1 ring-inset ring-emerald-400/30 light:bg-brand-pale light:text-brand-deep light:ring-brand-line">{step}</span>
        ) : icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30 light:bg-brand-pale light:text-brand-deep light:ring-brand-line"><Svg d={icon} /></span>
        ) : null}
        <div>
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {aside}
    </header>
    <div className={bodyClassName}>{children}</div>
  </section>
);

export const Field: React.FC<{ label: string; required?: boolean; optional?: boolean; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  label, required, optional, hint, children, className = '',
}) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    <span className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
      <span>
        {label} {required && <span className="text-rose-400">*</span>}
        {optional && <span className="ml-1 normal-case tracking-normal font-medium text-gray-600">optional</span>}
      </span>
      {hint}
    </span>
    {children}
  </div>
);

const fieldBase =
  'w-full rounded-xl bg-black/25 px-4 text-sm text-white placeholder-gray-500 ring-1 ring-inset ring-white/10 outline-none transition-all duration-200 hover:ring-white/20 focus:bg-black/35 focus:ring-emerald-400/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)] light:bg-paper light:ring-field-line/40 light:shadow-[0_1px_2px_rgba(16,24,40,0.04)] light:hover:ring-field-line/70 light:focus:bg-paper light:focus:ring-atlas-primary/70 light:focus:shadow-[0_0_0_4px_rgba(21,128,90,0.12)]';

export const inputCls = `h-11 ${fieldBase}`;
export const textareaCls = `py-3 leading-relaxed resize-y ${fieldBase}`;

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none light:from-atlas-primary light:to-atlas-primary light:text-on-accent light:shadow-[0_1px_2px_rgba(16,24,40,0.08),0_8px_20px_-8px_rgba(21,128,90,0.55)] light:hover:from-brand-deep light:hover:to-brand-deep light:hover:brightness-100';

export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] font-semibold text-gray-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:text-white hover:ring-white/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 light:bg-paper light:ring-gray-700 light:text-gray-200 light:shadow-[0_1px_2px_rgba(16,24,40,0.05)] light:hover:bg-gray-800 light:hover:ring-gray-700';

export const dangerBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 font-semibold text-rose-300 ring-1 ring-inset ring-rose-400/30 transition hover:bg-rose-500/20 hover:text-rose-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40';

/** Square icon button for row actions. */
export const IconButton: React.FC<{ icon: string; label: string; onClick: () => void; tone?: 'default' | 'danger' | 'accent'; disabled?: boolean }> = ({
  icon, label, onClick, tone = 'default', disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition-all active:scale-95 disabled:opacity-40 ${
      tone === 'danger'
        ? 'text-gray-400 ring-white/10 hover:bg-rose-500/10 hover:text-rose-300 hover:ring-rose-400/30'
        : tone === 'accent'
          ? 'text-emerald-300 ring-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20'
          : 'text-gray-400 ring-white/10 hover:bg-white/[0.06] hover:text-white hover:ring-white/20'
    }`}
  >
    <Svg d={icon} />
  </button>
);

/** iOS-style switch. */
export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; tone?: 'emerald' | 'rose' }> = ({ checked, onChange, label, tone = 'emerald' }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group inline-flex items-center gap-3 text-sm font-semibold text-gray-300 hover:text-white">
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${checked ? (tone === 'rose' ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </span>
    {label}
  </button>
);

/** Segmented control with a gliding highlight. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  return (
    <div className="relative inline-grid rounded-xl bg-black/30 p-1 ring-1 ring-inset ring-white/10 light:bg-gray-800 light:ring-gray-700" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-b from-emerald-400/25 to-emerald-500/10 ring-1 ring-inset ring-emerald-400/40 light:from-gray-100 light:to-gray-100 light:ring-transparent light:shadow-[0_4px_12px_-4px_rgba(16,24,40,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 px-4 py-2 text-sm font-bold transition-colors ${o.value === value ? 'text-white light:text-on-accent' : 'text-gray-500 hover:text-gray-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small coloured tag (subject, difficulty, source…). */
export const Chip: React.FC<{ children: React.ReactNode; tone?: 'gray' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'cyan' | 'teal'; className?: string; title?: string }> = ({
  children, tone = 'gray', className = '', title,
}) => {
  const tones: Record<string, string> = {
    gray: 'bg-white/[0.05] text-gray-300 ring-white/10',
    emerald: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    sky: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    rose: 'bg-rose-400/10 text-rose-300 ring-rose-400/25',
    violet: 'bg-violet-400/10 text-violet-300 ring-violet-400/25',
    cyan: 'bg-cyan-400/10 text-cyan-300 ring-cyan-400/25',
    teal: 'bg-teal-400/10 text-teal-300 ring-teal-400/25',
  };
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 truncate rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

export const SUBJECT_TONE: Record<string, 'sky' | 'amber' | 'emerald' | 'violet'> = {
  physics: 'sky', chemistry: 'amber', biology: 'emerald', mathematics: 'violet',
};
export const DIFFICULTY_TONE: Record<string, 'emerald' | 'amber' | 'rose'> = { easy: 'emerald', medium: 'amber', hard: 'rose' };

/** Page title row used at the top of admin sections. */
export const PageHeader: React.FC<{ eyebrow?: string; title: string; subtitle?: string; aside?: React.ReactNode }> = ({ eyebrow, title, subtitle, aside }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
    <div>
      {eyebrow && <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">{eyebrow}</p>}
      <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-gray-400">{subtitle}</p>}
    </div>
    {aside}
  </div>
);

/**
 * Premium dialog: blurred backdrop, raised panel that pops in, sticky header and footer,
 * Escape / backdrop click to close.
 */
export const AdminModal: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  tone?: 'emerald' | 'rose' | 'amber';
}> = ({ title, subtitle, icon, onClose, footer, children, width = 'max-w-2xl', tone = 'emerald' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const toneRing = tone === 'rose' ? 'bg-rose-400/10 text-rose-300 ring-rose-400/30' : tone === 'amber' ? 'bg-amber-400/10 text-amber-300 ring-amber-400/30' : 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
  const glow = tone === 'rose' ? 'via-rose-400/50' : tone === 'amber' ? 'via-amber-400/50' : 'via-emerald-400/50';
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim/70 p-4 backdrop-blur-md animate-fade-in" onMouseDown={e => e.target === e.currentTarget && onClose()}>
        <div
          role="dialog"
          aria-modal="true"
          className={`relative flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-atlas-raised to-atlas-dark text-white ring-1 ring-white/10 light:from-paper light:to-paper light:ring-gray-700 shadow-[0_40px_100px_-20px_rgb(var(--shadow-rgb)/calc(0.95*var(--shadow-k)))] animate-success-pop`}
        >
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${glow} to-transparent`} />
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] light:border-gray-700 px-6 py-5">
            <div className="flex items-center gap-3 min-w-0">
              {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${toneRing}`}><Svg d={icon} className="h-5 w-5" /></span>}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold tracking-tight">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white">
              <Svg d={ICONS.close} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] bg-black/20 light:border-gray-700 light:bg-gray-950 px-6 py-4">{footer}</footer>}
        </div>
      </div>
    </ModalPortal>
  );
};

/** An institute's own logo on a white tile; falls back to its initials if there's no logo or it fails to load. */
export const InstituteAvatar: React.FC<{ name: string; logoUrl?: string | null; size?: 'sm' | 'lg' }> = ({ name, logoUrl, size = 'sm' }) => {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const box = `shrink-0 ${size === 'lg' ? 'h-14 w-14 rounded-2xl text-base' : 'h-7 w-7 rounded-lg text-[10px]'}`;
  if (logoUrl && !failed) {
    return (
      <span className={`flex ${box} items-center justify-center overflow-hidden bg-paper p-0.5 ring-1 ring-white/20`}>
        {/* keep-original-colors: styles.css otherwise hue-shifts any img whose URL contains "logo". */}
        <img src={logoUrl} alt="" className="keep-original-colors h-full w-full object-contain" onError={() => setFailed(true)} loading="lazy" />
      </span>
    );
  }
  return (
    <span className={`flex ${box} items-center justify-center bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 font-black text-emerald-100 ring-1 ring-inset ring-emerald-400/30`}>
      {initials || '?'}
    </span>
  );
};
