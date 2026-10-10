import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../services/supabase';
import { InformationCircleIcon, UserGroupIcon } from '../../../../components/icons';
import { RichMathText } from '../../../../utils/renderMath';
import MultiSelectDropdown, { FilterOption } from '../../../../components/ui/MultiSelectDropdown';
import SelectMenu from '../../../../components/ui/SelectMenu';
import DateTimePicker from '../../../../components/ui/DateTimePicker';
import ModalPortal from '../../../../components/ModalPortal';

// ---------------------------------------------------------------------------
// Question pool facets
// ---------------------------------------------------------------------------

type Dim = 'grade' | 'subject' | 'topic' | 'sub_topic' | 'difficulty';

interface PoolRow {
  id: string;
  grade: string | null;
  subject: string | null;
  topic: string | null;
  sub_topic: string | null;
  difficulty: string | null;
}

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

const SUBJECT_ORDER = ['physics', 'chemistry', 'biology', 'mathematics'];
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
const SUBJECT_DOTS: Record<string, string> = {
  physics: 'bg-sky-400', chemistry: 'bg-amber-400', biology: 'bg-emerald-400', mathematics: 'bg-violet-400',
};
const DIFFICULTY_DOTS: Record<string, string> = { easy: 'bg-emerald-400', medium: 'bg-amber-400', hard: 'bg-rose-400' };

const byOrder = (order: string[]) => (a: FilterOption, b: FilterOption) => {
  const ia = order.indexOf(a.value), ib = order.indexOf(b.value);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.label.localeCompare(b.label);
};

const DIMS: { key: Dim; title: string; label: string; fixed?: string[]; sort?: (a: FilterOption, b: FilterOption) => number; dot?: (v: string) => string | undefined; single?: (o: FilterOption) => string; icon: string }[] = [
  {
    key: 'grade', title: 'Grades', label: 'Grade', fixed: ['10', '11', '12'],
    sort: (a, b) => (parseFloat(a.value) || 0) - (parseFloat(b.value) || 0), single: o => `Grade ${o.label}`,
    icon: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342',
  },
  {
    key: 'subject', title: 'Subjects', label: 'Subject', fixed: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
    sort: byOrder(SUBJECT_ORDER), dot: v => SUBJECT_DOTS[v],
    icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  },
  {
    key: 'topic', title: 'Topics', label: 'Topic',
    icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  },
  {
    key: 'sub_topic', title: 'Sub-topics', label: 'Sub-topic',
    icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  },
  {
    key: 'difficulty', title: 'Difficulty', label: 'Difficulty', fixed: ['Easy', 'Medium', 'Hard'],
    sort: byOrder(DIFFICULTY_ORDER), dot: v => DIFFICULTY_DOTS[v],
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  },
];

const EMPTY: Record<Dim, string[]> = { grade: [], subject: [], topic: [], sub_topic: [], difficulty: [] };

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Local "YYYY-MM-DDTHH:mm" (the DateTimePicker / datetime-local format). */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** A start this far in the past (the form was left open a while) is moved up to "now" on publish. */
const START_GRACE_MS = 5 * 60 * 1000;

const evenSplit = (total: number, keys: string[]) => {
  const base = Math.floor(total / keys.length);
  const extra = total % keys.length;
  return Object.fromEntries(keys.map((k, i) => [k, base + (i < extra ? 1 : 0)]));
};

const Svg: React.FC<{ d: string; className?: string }> = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

const Card: React.FC<{ step: number; title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode; raised?: boolean }> = ({
  step, title, subtitle, aside, children, raised,
}) => (
  <section
    className={`relative rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-1 ring-inset ring-white/[0.07] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)] ${raised ? 'z-10' : ''}`}
  >
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 sm:px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-sm font-black text-emerald-300 ring-1 ring-inset ring-emerald-400/30">{step}</span>
        <div>
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {aside}
    </header>
    <div className="p-5 sm:p-6">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-2">
    <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
      <span>{label} {required && <span className="text-rose-400">*</span>}</span>
      {hint}
    </span>
    {children}
  </div>
);

const inputCls =
  'h-11 w-full rounded-xl bg-black/25 px-4 text-sm text-white placeholder-gray-500 ring-1 ring-inset ring-white/10 outline-none transition-all duration-200 hover:ring-white/20 focus:bg-black/35 focus:ring-emerald-400/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)]';

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none';

/** An institute's own logo on a white tile; falls back to its initials if there's no logo or it fails to load. */
const InstituteAvatar: React.FC<{ name: string; logoUrl?: string | null }> = ({ name, logoUrl }) => {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (logoUrl && !failed) {
    return (
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-white/20">
        {/* keep-original-colors: styles.css otherwise hue-shifts any img whose URL contains "logo". */}
        <img src={logoUrl} alt="" className="keep-original-colors h-full w-full object-contain" onError={() => setFailed(true)} loading="lazy" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 text-[10px] font-black text-emerald-100 ring-1 ring-inset ring-emerald-400/30">
      {initials || '?'}
    </span>
  );
};

const PublicLinkBadge: React.FC = () => (
  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-gray-400 ring-1 ring-inset ring-white/10">
    <Svg d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </span>
);

interface PublishedTest {
  id: string;
  title: string;
  questions: number;
  duration: number;
  startAt: Date;
  endAt: Date;
  /** null = public, link-only test. */
  institute: { name: string; logoUrl: string | null } | null;
  classNames: string[];
}

const IN_DATE = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/** "Wed, 7 Oct 2026 · 1:17 PM" */
const formatWhen = (d: Date) => {
  const p = Object.fromEntries(IN_DATE.formatToParts(d).map(x => [x.type, x.value]));
  const h = d.getHours();
  return `${p.weekday}, ${p.day} ${p.month} ${p.year} · ${h % 12 || 12}:${pad2(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
};

const PublishedModal: React.FC<{ test: PublishedTest; onClose: () => void }> = ({ test, onClose }) => {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/#/test/${test.id}`;
  const liveNow = test.startAt.getTime() <= Date.now();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the test link:', link);
    }
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Starts', value: formatWhen(test.startAt) },
    { label: 'Active till', value: formatWhen(test.endAt) },
    { label: 'Duration', value: `${test.duration} min · ${test.questions} questions` },
    {
      label: 'Access',
      value: test.institute ? (
        <span className="inline-flex items-center justify-end gap-2">
          <InstituteAvatar name={test.institute.name} logoUrl={test.institute.logoUrl} />
          <span className="text-right">
            <span className="block">{test.institute.name}</span>
            <span className="block text-[11px] font-normal text-gray-500">
              {test.classNames.length ? test.classNames.join(', ') : 'No classes — link only'}
            </span>
          </span>
        </span>
      ) : (
        'Public link'
      ),
    },
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="published-title"
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-[#111a24] to-[#0b1118] p-7 text-center ring-1 ring-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] animate-success-pop"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden="true" />

          {/* Animated tick: circle draws, then the check, with a soft halo */}
          <div className="relative mx-auto h-20 w-20">
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-halo" aria-hidden="true" />
            <svg viewBox="0 0 80 80" className="relative h-20 w-20" aria-hidden="true">
              <circle cx="40" cy="40" r="36" className="fill-emerald-400/10" />
              <circle
                cx="40" cy="40" r="36" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round"
                pathLength={1} strokeDasharray="1" className="animate-draw-circle" transform="rotate(-90 40 40)"
              />
              <path
                d="M25 41.5l10 10 20-22" fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                pathLength={1} strokeDasharray="1" className="animate-draw-check"
              />
            </svg>
          </div>

          <h2 id="published-title" className="relative mt-5 text-2xl font-black tracking-tight">Test published</h2>
          <p className="relative mt-1 truncate text-sm text-gray-400" title={test.title}>{test.title}</p>
          <span
            className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 ring-inset ${
              liveNow ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30' : 'bg-sky-400/10 text-sky-300 ring-sky-400/30'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${liveNow ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
            {liveNow ? 'Live now' : 'Scheduled'}
          </span>

          <dl className="relative mt-6 divide-y divide-white/[0.06] rounded-2xl bg-black/25 px-4 text-left ring-1 ring-inset ring-white/[0.07]">
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{row.label}</dt>
                <dd className="text-right text-sm font-semibold text-white">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-3 text-sm font-bold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.1] active:scale-[0.98]"
            >
              <Svg d={copied ? 'M4.5 12.75l6 6 9-13.5' : 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244'} className={`h-4 w-4 ${copied ? 'text-emerald-300' : ''}`} />
              {copied ? 'Link copied' : 'Copy test link'}
            </button>
            <button type="button" onClick={onClose} autoFocus className={`${primaryBtn} py-3 text-sm`}>
              Done
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// ---------------------------------------------------------------------------

const CreateTest: React.FC = () => {
  // --- 1. Test settings ---
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number | string>(60);
  const [startWindow, setStartWindow] = useState('');
  const [endWindow, setEndWindow] = useState('');

  // Ticking clock so the pickers never offer a moment that has already passed.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  const earliest = useMemo(() => {
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return toLocalInput(d);
  }, [now]);
  // Expiry: at least a minute after the start (and never in the past).
  const expiryMin = useMemo(() => {
    if (!startWindow) return earliest;
    const afterStart = new Date(startWindow);
    afterStart.setMinutes(afterStart.getMinutes() + 1);
    const candidate = toLocalInput(afterStart);
    return candidate > earliest ? candidate : earliest;
  }, [startWindow, earliest]);

  const [finalQuestionIds, setFinalQuestionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'custom' | 'existing'>('existing');

  // --- 3. Assignment (which institute/classes this test is released to) ---
  const [institutes, setInstitutes] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);
  const [assignInstituteId, setAssignInstituteId] = useState('');
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('institutes').select('id, name, logo_url').order('name').then(({ data }) => data && setInstitutes(data));
  }, []);

  useEffect(() => {
    setSelectedClassIds([]);
    if (!assignInstituteId) {
      setAvailableClasses([]);
      return;
    }
    supabase.from('classes').select('id, name').eq('institute_id', assignInstituteId).order('name').then(({ data }) => data && setAvailableClasses(data));
  }, [assignInstituteId]);

  const toggleClassSelection = (classId: string) => {
    setSelectedClassIds(prev => (prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]));
  };

  // --- 2a. Existing paper ---
  const [offlinePapers, setOfflinePapers] = useState<any[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState('');

  useEffect(() => {
    supabase.from('offline_papers').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setOfflinePapers(data));
  }, []);

  // --- 2b. Auto-generate from bank ---
  const [pool, setPool] = useState<PoolRow[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [filters, setFilters] = useState<Record<Dim, string[]>>(EMPTY);
  const [numberOfQuestions, setNumberOfQuestions] = useState<number | string>(20);
  const [subjectSplit, setSubjectSplit] = useState<Record<string, number>>({});

  const [useDistribution, setUseDistribution] = useState(false);
  const [easyPercent, setEasyPercent] = useState(50);
  const [mediumPercent, setMediumPercent] = useState(30);
  const [hardPercent, setHardPercent] = useState(20);
  const distributionTotal = easyPercent + mediumPercent + hardPercent;
  const isDistributionValid = distributionTotal === 100;

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [published, setPublished] = useState<PublishedTest | null>(null);

  // Every unflagged question's filterable columns, paged past PostgREST's 1000-row cap.
  useEffect(() => {
    const load = async () => {
      const rows: PoolRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('mcqs')
          .select('id, grade, subject, topic, sub_topic, difficulty, isFlagged')
          .order('id')
          .range(from, from + 999);
        if (error || !data) break;
        rows.push(...(data as any[]).filter(r => !r.isFlagged));
        if (data.length < 1000) break;
      }
      setPool(rows);
      setPoolLoading(false);
    };
    load();
  }, []);

  /** normalized key -> display label (most common spelling) per dimension. */
  const labels = useMemo(() => {
    const out = {} as Record<Dim, Map<string, string>>;
    for (const dim of DIMS) {
      const tally = new Map<string, Map<string, number>>();
      for (const f of dim.fixed ?? []) tally.set(normalize(f), new Map([[f, 0]]));
      for (const r of pool) {
        const raw = String(r[dim.key] ?? '').trim();
        if (!raw) continue;
        const key = normalize(raw);
        const m = tally.get(key) ?? new Map<string, number>();
        m.set(raw, (m.get(raw) ?? 0) + 1);
        tally.set(key, m);
      }
      out[dim.key] = new Map([...tally].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
    }
    return out;
  }, [pool]);

  const matches = (r: PoolRow, except?: Dim) =>
    DIMS.every(d => {
      if (d.key === except) return true;
      if (d.key === 'difficulty' && useDistribution) return true; // distribution decides difficulty
      const sel = filters[d.key];
      return sel.length === 0 || sel.includes(normalize(r[d.key]));
    });

  const optionsFor = (dim: Dim): FilterOption[] => {
    const cfg = DIMS.find(d => d.key === dim)!;
    const counts = new Map<string, number>();
    for (const r of pool) {
      if (!matches(r, dim)) continue;
      const key = normalize(r[dim]);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const opts: FilterOption[] = [];
    for (const [key, label] of labels[dim] ?? []) {
      const count = counts.get(key) ?? 0;
      const fixed = (cfg.fixed ?? []).some(f => normalize(f) === key);
      if (count > 0 || fixed || filters[dim].includes(key)) opts.push({ value: key, label, count });
    }
    return opts.sort(cfg.sort ?? ((a, b) => a.label.localeCompare(b.label)));
  };

  const setFilter = (dim: Dim, values: string[]) => setFilters(prev => ({ ...prev, [dim]: values }));

  // Drop topic / sub-topic picks that no longer exist under the chosen grades & subjects.
  useEffect(() => {
    if (pool.length === 0) return;
    const alive = (dim: Dim, parents: Dim[]) =>
      new Set(pool.filter(r => parents.every(p => filters[p].length === 0 || filters[p].includes(normalize(r[p])))).map(r => normalize(r[dim])));
    const topics = filters.topic.filter(t => alive('topic', ['grade', 'subject']).has(t));
    const subs = filters.sub_topic.filter(t => alive('sub_topic', ['grade', 'subject', 'topic']).has(t));
    if (topics.length !== filters.topic.length || subs.length !== filters.sub_topic.length) {
      setFilters(prev => ({ ...prev, topic: topics, sub_topic: subs }));
    }
  }, [pool, filters]);

  const orderedSubjects = useMemo(
    () => [...filters.subject].sort((a, b) => (SUBJECT_ORDER.indexOf(a) + 1 || 99) - (SUBJECT_ORDER.indexOf(b) + 1 || 99)),
    [filters.subject]
  );
  const multiSubject = orderedSubjects.length >= 2;

  // Re-split evenly whenever the subject set or the total changes.
  useEffect(() => {
    if (orderedSubjects.length >= 2) setSubjectSplit(evenSplit(Math.max(0, Number(numberOfQuestions) || 0), orderedSubjects));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSubjects.join('|')]);

  const setTotal = (raw: string) => {
    setNumberOfQuestions(raw);
    if (multiSubject) setSubjectSplit(evenSplit(Math.max(0, Number(raw) || 0), orderedSubjects));
  };

  const setSplit = (subject: string, raw: string) => {
    const next = { ...subjectSplit, [subject]: Math.max(0, Math.floor(Number(raw) || 0)) };
    setSubjectSplit(next);
    setNumberOfQuestions(Object.values(next).reduce((a, b) => a + b, 0));
  };

  const matchingCount = useMemo(() => pool.filter(r => matches(r)).length, [pool, filters, useDistribution]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaperSelection = async (paperId: string) => {
    setSelectedPaperId(paperId);
    setMessage(null);
    if (!paperId) {
      setFinalQuestionIds([]);
      setPreviewQuestions([]);
      return;
    }
    const paper = offlinePapers.find(p => p.id === paperId);
    if (paper) {
      const ids = paper.question_ids || paper.questionids || [];
      setFinalQuestionIds(ids);
      const { data } = await supabase.from('mcqs').select('*').in('id', ids);
      if (data) setPreviewQuestions(data);
    }
  };

  /** Picks `count` ids from `rows`, honouring the difficulty distribution when it's on. */
  const pick = (rows: PoolRow[], count: number, scope: string): { ids: string[]; error?: string; short?: number } => {
    if (!useDistribution) {
      const ids = shuffle(rows).slice(0, count).map(r => r.id);
      return { ids, short: count - ids.length };
    }
    const easy = Math.round((easyPercent / 100) * count);
    const medium = Math.round((mediumPercent / 100) * count);
    const hard = Math.max(0, count - easy - medium);
    const by = (d: string) => rows.filter(r => normalize(r.difficulty) === d);
    const [e, m, h] = [by('easy'), by('medium'), by('hard')];
    if (e.length < easy || m.length < medium || h.length < hard) {
      return {
        ids: [],
        error: `${scope}: needs Easy ${easy}, Medium ${medium}, Hard ${hard} — available Easy ${e.length}, Medium ${m.length}, Hard ${h.length}.`,
      };
    }
    return { ids: shuffle([...shuffle(e).slice(0, easy), ...shuffle(m).slice(0, medium), ...shuffle(h).slice(0, hard)].map(r => r.id)) };
  };

  const handleAutoSelect = async () => {
    setMessage(null);
    const target = Number(numberOfQuestions);
    if (!target || target < 1) return setMessage({ type: 'error', text: 'Enter a valid number of questions.' });
    if (useDistribution && !isDistributionValid) return setMessage({ type: 'error', text: 'Difficulty percentages must add up to 100%.' });

    setIsGenerating(true);
    try {
      const candidates = pool.filter(r => matches(r));
      if (candidates.length === 0) return setMessage({ type: 'error', text: 'No questions match your filters.' });

      // Multiple subjects: fill each subject's quota from its own pool, in section order,
      // so a large subject (e.g. Biology) can't crowd out the others.
      const groups = multiSubject
        ? orderedSubjects.map(s => ({ scope: labels.subject.get(s) ?? s, rows: candidates.filter(r => normalize(r.subject) === s), count: subjectSplit[s] ?? 0 }))
        : [{ scope: 'Selection', rows: candidates, count: target }];

      const ids: string[] = [];
      const shortfalls: string[] = [];
      for (const g of groups) {
        if (g.count === 0) continue;
        const result = pick(g.rows, g.count, g.scope);
        if (result.error) return setMessage({ type: 'error', text: result.error });
        ids.push(...result.ids);
        if (result.short) shortfalls.push(`${g.scope} has only ${g.rows.length}`);
      }
      if (ids.length === 0) return setMessage({ type: 'error', text: 'No questions could be selected.' });

      const rows: any[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('mcqs').select('*').in('id', ids.slice(i, i + 100));
        if (error) throw error;
        rows.push(...(data || []));
      }
      const position = new Map(ids.map((id, i) => [id, i]));
      rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

      setPreviewQuestions(rows);
      setFinalQuestionIds(rows.map(q => q.id));
      setMessage({
        type: 'success',
        text: shortfalls.length
          ? `Selected ${rows.length} questions — fewer than requested (${shortfalls.join('; ')}).`
          : `Selected ${rows.length} questions.`,
      });
    } catch {
      setMessage({ type: 'error', text: 'Failed to fetch questions.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const windowInvalid = Boolean(startWindow && endWindow && endWindow <= startWindow);
  const startPast = Boolean(startWindow && new Date(startWindow).getTime() < now.getTime() - START_GRACE_MS);
  const endPast = Boolean(endWindow && new Date(endWindow).getTime() <= now.getTime());

  const handleCreateTest = async () => {
    setMessage(null);
    if (!title.trim()) return setMessage({ type: 'error', text: 'Test title is required.' });
    if (!Number(duration) || Number(duration) < 1) return setMessage({ type: 'error', text: 'Enter a valid duration.' });
    if (!startWindow || !endWindow) return setMessage({ type: 'error', text: 'Start and expiry date & time are required.' });
    const current = Date.now();
    if (new Date(endWindow).getTime() <= current) return setMessage({ type: 'error', text: 'The expiry time has already passed. Choose a later expiry.' });
    if (new Date(startWindow).getTime() < current - START_GRACE_MS) return setMessage({ type: 'error', text: 'The start time has already passed. Choose a start from now onwards.' });
    if (windowInvalid) return setMessage({ type: 'error', text: 'The expiry must be after the start.' });
    // A start a few minutes in the past (form left open) simply opens the test now.
    const startAt = new Date(Math.max(new Date(startWindow).getTime(), current));
    if (finalQuestionIds.length === 0) return setMessage({ type: 'error', text: 'Select or generate questions first.' });

    setIsSubmitting(true);
    try {
      const { data: insertedTest, error } = await supabase
        .from('tests')
        .insert({
          title: title.trim(),
          duration_minutes: Number(duration),
          start_window: startAt.toISOString(),
          end_window: new Date(endWindow).toISOString(),
          status: 'Upcoming',
          question_ids: finalQuestionIds,
          ...(assignInstituteId ? { institute_id: assignInstituteId } : {}),
        })
        .select()
        .single();
      if (error) throw error;

      if (assignInstituteId && selectedClassIds.length > 0) {
        const { error: assignError } = await supabase.from('test_assignments').insert(
          selectedClassIds.map(classId => ({
            test_id: insertedTest.id,
            class_id: classId,
            opens_at: startAt.toISOString(),
            closes_at: new Date(endWindow).toISOString(),
          }))
        );
        if (assignError) throw new Error(`Test was created, but assigning classes failed: ${assignError.message}`);
      }

      const institute = institutes.find(i => i.id === assignInstituteId);
      setPublished({
        id: insertedTest.id,
        title: title.trim(),
        questions: finalQuestionIds.length,
        duration: Number(duration),
        startAt,
        endAt: new Date(endWindow),
        institute: institute ? { name: institute.name, logoUrl: institute.logo_url } : null,
        classNames: availableClasses.filter(c => selectedClassIds.includes(c.id)).map(c => c.name),
      });
      setMessage(null);

      setTitle('');
      setStartWindow('');
      setEndWindow('');
      setFinalQuestionIds([]);
      setPreviewQuestions([]);
      setSelectedPaperId('');
      setAssignInstituteId('');
      setSelectedClassIds([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create test.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewBySubject = useMemo(() => {
    const m = new Map<string, number>();
    previewQuestions.forEach(q => m.set(q.subject || 'Other', (m.get(q.subject || 'Other') ?? 0) + 1));
    return [...m];
  }, [previewQuestions]);

  return (
    <div className="space-y-6 text-white pb-20">
      {published && <PublishedModal test={published} onClose={() => setPublished(null)} />}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Create Online Test</h2>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-gray-400">
          <InformationCircleIcon className="h-4 w-4" />
          Configure the test, build its question pool, and choose who can take it.
        </p>
      </div>

      {/* ── 1. Settings ── */}
      <Card step={1} title="Test settings" subtitle="Name, duration and the window in which the test can be taken.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <Field label="Test title" required>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NEET Mock — Week 3" className={inputCls} />
          </Field>
          <Field label="Duration" required hint={<span className="normal-case tracking-normal text-gray-500">minutes</span>}>
            <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} className={inputCls} />
          </Field>
          <Field
            label="Starts"
            required
            hint={startPast ? <span className="normal-case tracking-normal text-rose-400">Already passed</span> : undefined}
          >
            <DateTimePicker value={startWindow} onChange={setStartWindow} min={earliest} placeholder="Choose start" label="Test start date and time" invalid={startPast} />
          </Field>
          <Field
            label="Expires"
            required
            hint={
              endPast ? <span className="normal-case tracking-normal text-rose-400">Already passed</span>
                : windowInvalid ? <span className="normal-case tracking-normal text-rose-400">Must be after start</span>
                : undefined
            }
          >
            <DateTimePicker value={endWindow} onChange={setEndWindow} min={expiryMin} placeholder="Choose expiry" label="Test expiry date and time" invalid={windowInvalid || endPast} />
          </Field>
        </div>
      </Card>

      {/* ── 2. Questions ── */}
      <Card
        step={2}
        title="Select questions"
        subtitle="Reuse a saved paper or draw a fresh set from the question bank."
        raised
        aside={
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${finalQuestionIds.length ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30' : 'bg-white/[0.04] text-gray-400 ring-white/10'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${finalQuestionIds.length ? 'bg-emerald-400' : 'bg-gray-500'}`} />
            {finalQuestionIds.length} questions ready
          </span>
        }
      >
        {/* Segmented control */}
        <div className="inline-flex rounded-xl bg-black/30 p-1 ring-1 ring-inset ring-white/10" role="tablist">
          {([
            ['existing', 'Load saved paper', 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'],
            ['custom', 'Auto-generate from bank', 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z'],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                activeTab === key
                  ? 'bg-gradient-to-b from-white/[0.12] to-white/[0.06] text-white shadow-[0_4px_14px_-6px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-inset ring-white/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Svg d={icon} className={`h-4 w-4 ${activeTab === key ? 'text-emerald-300' : ''}`} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'existing' && (
          <div className="mt-6 max-w-xl animate-fade-in">
            <Field label="Saved paper">
              <SelectMenu
                title="Saved papers"
                value={selectedPaperId}
                onChange={handlePaperSelection}
                placeholder={offlinePapers.length ? 'Choose a paper' : 'No saved papers yet'}
                options={offlinePapers.map(p => ({
                  value: p.id,
                  label: p.title,
                  hint: [p.subject, `${(p.question_ids || p.questionids || []).length} questions`].filter(Boolean).join(' · '),
                }))}
                icon={<Svg d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />}
              />
            </Field>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pr-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Filters</span>
              {DIMS.map(dim => (
                <MultiSelectDropdown
                  key={dim.key}
                  title={dim.title}
                  label={dim.label}
                  icon={<Svg d={dim.icon} />}
                  options={optionsFor(dim.key)}
                  selectedValues={filters[dim.key]}
                  onChange={v => setFilter(dim.key, v)}
                  singleLabel={dim.single}
                  dotFor={dim.dot}
                  disabled={(dim.key === 'difficulty' && useDistribution) || poolLoading}
                  disabledHint={dim.key === 'difficulty' && useDistribution ? 'Difficulty is set by the distribution below' : 'Loading question bank…'}
                />
              ))}
              <span className="ml-auto text-xs text-gray-500">
                {poolLoading ? 'Loading question bank…' : <><span className="font-bold tabular-nums text-gray-200">{matchingCount.toLocaleString()}</span> matching questions</>}
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <Field label="Total questions" required>
                <input type="number" min={1} max={200} value={numberOfQuestions} onChange={e => setTotal(e.target.value)} className={inputCls} />
              </Field>

              {multiSubject ? (
                <Field
                  label="Questions per subject"
                  hint={<span className="normal-case tracking-normal text-gray-500">Split evenly — adjust any subject</span>}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {orderedSubjects.map(s => {
                      const available = pool.filter(r => normalize(r.subject) === s && matches(r, 'subject')).length;
                      const over = (subjectSplit[s] ?? 0) > available;
                      return (
                        <label key={s} className={`flex h-11 items-center gap-2 rounded-xl bg-black/25 pl-3 pr-1.5 ring-1 ring-inset ${over ? 'ring-rose-400/60' : 'ring-white/10 focus-within:ring-emerald-400/60'}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${SUBJECT_DOTS[s] ?? 'bg-gray-400'}`} />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-300" title={`${available} available`}>{labels.subject.get(s) ?? s}</span>
                          <input
                            type="number"
                            min={0}
                            value={subjectSplit[s] ?? 0}
                            onChange={e => setSplit(s, e.target.value)}
                            aria-label={`${labels.subject.get(s) ?? s} questions`}
                            className="h-8 w-14 rounded-lg bg-white/[0.06] text-center text-sm font-bold tabular-nums text-white outline-none"
                          />
                        </label>
                      );
                    })}
                  </div>
                </Field>
              ) : (
                <p className="self-end pb-3 text-xs text-gray-500">
                  Tip: pick two or more subjects to set how many questions each one gets. Each subject becomes its own section in the test.
                </p>
              )}
            </div>

            {/* Difficulty distribution */}
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.07]">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useDistribution}
                  onClick={() => setUseDistribution(v => !v)}
                  className="flex items-center gap-3"
                >
                  <span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${useDistribution ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${useDistribution ? 'translate-x-5' : ''}`} />
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-bold">Difficulty distribution</span>
                    <span className="block text-xs text-gray-500">Mix Easy, Medium and Hard by percentage{multiSubject ? ' — applied within each subject' : ''}.</span>
                  </span>
                </button>
                {useDistribution && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${isDistributionValid ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30' : 'bg-rose-500/10 text-rose-300 ring-rose-400/40'}`}>
                    {distributionTotal}% {isDistributionValid ? '' : '— must be 100%'}
                  </span>
                )}
              </div>

              {useDistribution && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="bg-emerald-400 transition-all" style={{ width: `${Math.min(100, easyPercent)}%` }} />
                    <span className="bg-amber-400 transition-all" style={{ width: `${Math.min(100 - Math.min(100, easyPercent), mediumPercent)}%` }} />
                    <span className="bg-rose-400 transition-all" style={{ width: `${Math.max(0, Math.min(100 - easyPercent - mediumPercent, hardPercent))}%` }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                      ['Easy', easyPercent, setEasyPercent, 'accent-emerald-400', 'text-emerald-300'],
                      ['Medium', mediumPercent, setMediumPercent, 'accent-amber-400', 'text-amber-300'],
                      ['Hard', hardPercent, setHardPercent, 'accent-rose-400', 'text-rose-300'],
                    ] as const).map(([label, value, set, accent, text]) => (
                      <label key={label} className="flex flex-col gap-2">
                        <span className={`flex justify-between text-xs font-bold uppercase tracking-wider ${text}`}>
                          <span>{label}</span>
                          <span className="tabular-nums">{value}%</span>
                        </span>
                        <input type="range" min={0} max={100} step={5} value={value} onChange={e => set(parseInt(e.target.value, 10))} className={`w-full ${accent}`} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={handleAutoSelect} disabled={isGenerating || poolLoading || (useDistribution && !isDistributionValid)} className={`${primaryBtn} px-5 py-2.5 text-sm`}>
                <Svg d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                {isGenerating ? 'Selecting…' : previewQuestions.length && activeTab === 'custom' ? 'Re-generate questions' : 'Generate questions'}
              </button>
            </div>
          </div>
        )}

        {previewQuestions.length > 0 && (
          <div className="mt-8 animate-fade-in">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h4 className="mr-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Preview · {previewQuestions.length} questions</h4>
              {previewBySubject.map(([subject, count]) => (
                <span key={subject} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-white/10">
                  <span className={`h-1.5 w-1.5 rounded-full ${SUBJECT_DOTS[normalize(subject)] ?? 'bg-gray-400'}`} />
                  {subject} <span className="tabular-nums text-gray-400">{count}</span>
                </span>
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto rounded-2xl ring-1 ring-inset ring-white/[0.07] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur">
                  <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    <th className="w-12 p-3 text-center">#</th>
                    <th className="p-3">Question</th>
                    <th className="p-3 text-right">Subject · Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {previewQuestions.map((q, index) => (
                    <tr key={q.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="p-3 text-center font-mono text-xs text-gray-500">{index + 1}</td>
                      <td className="p-3 text-sm text-gray-200">{q.question?.trim() ? <RichMathText text={q.question} /> : <span className="italic text-gray-500">[Image question]</span>}</td>
                      <td className="whitespace-nowrap p-3 text-right text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${SUBJECT_DOTS[normalize(q.subject)] ?? 'bg-gray-400'}`} />
                          {q.subject} · {q.difficulty}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* ── 3. Assignment ── */}
      <Card
        step={3}
        title="Assign to"
        subtitle="Optional — leave the institute empty to publish a public, link-only test."
        aside={<span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500"><UserGroupIcon className="h-4 w-4" /> Students see assigned tests in their portal</span>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Institute">
            <SelectMenu
              title="Institutes"
              value={assignInstituteId}
              onChange={setAssignInstituteId}
              placeholder="No institute (public link only)"
              emptyOption={{ value: '', label: 'No institute', hint: 'Public, link-only test', media: <PublicLinkBadge /> }}
              options={institutes.map(i => ({ value: i.id, label: i.name, media: <InstituteAvatar name={i.name} logoUrl={i.logo_url} /> }))}
              icon={<Svg d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />}
            />
          </Field>
          <Field label="Classes" hint={selectedClassIds.length > 0 ? <span className="normal-case tracking-normal text-emerald-300">{selectedClassIds.length} selected</span> : undefined}>
            <div className={`flex min-h-[44px] flex-wrap items-center gap-2 ${!assignInstituteId ? 'opacity-50' : ''}`}>
              {!assignInstituteId && <span className="text-xs text-gray-500">Choose an institute to see its classes.</span>}
              {assignInstituteId && availableClasses.length === 0 && <span className="text-xs text-gray-500">This institute has no classes yet.</span>}
              {availableClasses.map(cls => {
                const on = selectedClassIds.includes(cls.id);
                return (
                  <button
                    type="button"
                    key={cls.id}
                    onClick={() => toggleClassSelection(cls.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ring-1 ring-inset transition-all active:scale-[0.97] ${
                      on
                        ? 'bg-gradient-to-b from-emerald-400/[0.18] to-emerald-500/[0.08] text-emerald-100 ring-emerald-400/50 shadow-[0_6px_18px_-8px_rgba(16,185,129,0.6)]'
                        : 'bg-white/[0.03] text-gray-300 ring-white/10 hover:ring-white/20 hover:text-white'
                    }`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] ${on ? 'bg-emerald-400 text-gray-950' : 'ring-1 ring-inset ring-white/20'}`}>
                      {on && <Svg d="M4.5 12.75l6 6 9-13.5" className="h-3 w-3" />}
                    </span>
                    {cls.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      {/* ── Publish ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.07]">
        <div className="min-w-0 flex-1" aria-live="polite">
          {message ? (
            <p className={`flex items-start gap-2 text-sm font-semibold ${message.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
              <Svg d={message.type === 'error' ? 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' : 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} className="mt-0.5 h-4 w-4 shrink-0" />
              {message.text}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {finalQuestionIds.length
                ? `${finalQuestionIds.length} questions · ${assignInstituteId ? `${selectedClassIds.length} class${selectedClassIds.length === 1 ? '' : 'es'} assigned` : 'public link'}`
                : 'Add questions to publish this test.'}
            </p>
          )}
        </div>
        <button onClick={handleCreateTest} disabled={isSubmitting || finalQuestionIds.length === 0} className={`${primaryBtn} w-full md:w-auto px-8 py-3 text-base`}>
          {isSubmitting ? 'Publishing…' : 'Publish online test'}
        </button>
      </div>
    </div>
  );
};

export default CreateTest;
