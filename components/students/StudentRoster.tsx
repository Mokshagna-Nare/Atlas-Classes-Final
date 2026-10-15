import React, { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { InstituteAnalytics, InstituteStudentRow } from '../../hooks/useInstituteAnalytics';
import SelectMenu from '../ui/SelectMenu';
import {
  Svg, ICONS, Card, Field, Chip, AdminModal, IconButton, inputCls, primaryBtn, secondaryBtn, dangerBtn,
} from '../ui/admin';
import { generatePassword } from '../../utils/uploadInstituteLogo';

// One institute's students: search, filters, sorting, performance, a profile drawer with
// every attempt, and management (add, edit, move class, reset password, remove).
// Used by the institute panel (its own students) and by the admin panel (any institute).

type SortKey = 'name' | 'roll' | 'average' | 'tests' | 'recent';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'roll', label: 'Roll number' },
  { value: 'average', label: 'Highest average' },
  { value: 'tests', label: 'Most tests taken' },
  { value: 'recent', label: 'Recently active' },
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const scoreTone = (v: number) => (v >= 75 ? 'text-emerald-300' : v >= 50 ? 'text-amber-300' : 'text-rose-300');

const ScoreBar: React.FC<{ value: number | null; muted?: boolean }> = ({ value, muted }) => (
  <div className="flex items-center gap-2.5">
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full transition-[width] duration-700 ${muted ? 'bg-white/20' : 'bg-gradient-to-r from-emerald-500 to-emerald-300'}`} style={{ width: `${value ?? 0}%` }} />
    </div>
    <span className={`w-10 text-sm font-bold tabular-nums ${value === null ? 'text-gray-600' : scoreTone(value)}`}>{value === null ? '—' : `${Math.round(value)}%`}</span>
  </div>
);

const Avatar: React.FC<{ name: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/25 to-emerald-600/10 font-black text-emerald-200 ring-1 ring-inset ring-emerald-400/30 ${size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs'}`}>
    {name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
  </span>
);

// ── Credentials shown once ─────────────────────────────────────────────────
const CredentialsModal: React.FC<{ title: string; name: string; email: string; password: string; onClose: () => void }> = ({ title, name, email, password, onClose }) => {
  const [copied, setCopied] = useState(false);
  const text = `Atlas Classes login for ${name}\nEmail: ${email}\nPassword: ${password}\nSign in at ${window.location.origin}/#/login/student`;
  return (
    <AdminModal
      title={title}
      subtitle="Share these with the student now — the password isn't stored and can't be shown again."
      icon={ICONS.key}
      width="max-w-md"
      onClose={onClose}
      footer={
        <>
          <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* manual copy */ } }} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>
            <Svg d={copied ? ICONS.check : ICONS.doc} /> {copied ? 'Copied' : 'Copy login'}
          </button>
          <button onClick={onClose} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Done</button>
        </>
      }
    >
      <dl className="space-y-3 rounded-2xl bg-black/30 p-4 ring-1 ring-inset ring-white/10">
        {[['Student', name], ['Email', email], ['Password', password]].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{k}</dt>
            <dd className={`truncate text-sm text-white ${k === 'Password' ? 'font-mono text-emerald-200' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </AdminModal>
  );
};

// ── Add / edit ──────────────────────────────────────────────────────────────
const StudentFormModal: React.FC<{
  instituteId: string;
  classes: { id: string; name: string }[];
  student?: InstituteStudentRow | null;
  onClose: () => void;
  onCreated: (creds: { name: string; email: string; password: string }) => void;
  onSaved: () => void;
}> = ({ instituteId, classes, student, onClose, onCreated, onSaved }) => {
  const { createStudent, updateStudent } = useData();
  const isEdit = Boolean(student);
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [rollNo, setRollNo] = useState(student?.rollNo || '');
  const [classId, setClassId] = useState(student?.classId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await updateStudent(student!.id, { name: name.trim(), roll_no: rollNo.trim() || null, class_id: classId || null });
        onSaved();
        onClose();
      } else {
        const password = generatePassword(10);
        await createStudent({ name: name.trim(), email: email.trim().toLowerCase(), password, institute_id: instituteId, class_id: classId || null, roll_no: rollNo.trim() || null });
        onSaved();
        onCreated({ name: name.trim(), email: email.trim().toLowerCase(), password });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Could not save the student.');
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? `Edit ${student!.name}` : 'Add a student'}
      subtitle={isEdit ? 'Name, roll number and class. Use “Reset password” for a new password.' : 'A secure password is generated and shown once after saving.'}
      icon={isEdit ? ICONS.edit : ICONS.plus}
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Cancel</button>
          <button type="submit" form="student-form" disabled={saving} className={`${primaryBtn} px-6 py-2.5 text-sm`}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add student'}
          </button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Ananya Sharma" className={inputCls} />
        </Field>
        <Field label="Login email" required className="sm:col-span-2" hint={isEdit ? <span className="normal-case tracking-normal font-medium text-gray-600">can't be changed</span> : undefined}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isEdit} placeholder="student@example.com" className={`${inputCls} disabled:opacity-50`} />
        </Field>
        <Field label="Roll number" optional>
          <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. 6A-24" className={inputCls} />
        </Field>
        <Field label="Class">
          <SelectMenu title="Class" value={classId} onChange={setClassId} placeholder="Unassigned" emptyOption={{ value: '', label: 'Unassigned' }} options={classes.map(c => ({ value: c.id, label: c.name }))} />
        </Field>
        {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25">{error}</p>}
      </form>
    </AdminModal>
  );
};

// ── Profile drawer ─────────────────────────────────────────────────────────
const StudentDrawer: React.FC<{
  student: InstituteStudentRow;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReset: () => void;
  onRemove: () => void;
}> = ({ student: s, canManage, onClose, onEdit, onReset, onRemove }) => (
  <AdminModal
    title={s.name}
    subtitle={[s.className || 'No class', s.rollNo ? `Roll ${s.rollNo}` : null, s.email].filter(Boolean).join(' · ')}
    width="max-w-3xl"
    onClose={onClose}
    footer={canManage ? (
      <>
        <button onClick={onRemove} className={`${dangerBtn} mr-auto px-4 py-2.5 text-sm`}><Svg d={ICONS.trash} /> Remove</button>
        <button onClick={onReset} className={`${secondaryBtn} px-4 py-2.5 text-sm`}><Svg d={ICONS.key} /> Reset password</button>
        <button onClick={onEdit} className={`${primaryBtn} px-5 py-2.5 text-sm`}><Svg d={ICONS.edit} /> Edit details</button>
      </>
    ) : undefined}
  >
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Tests taken', s.testsTaken],
          ['Average', s.testsTaken ? `${Math.round(s.averageScore)}%` : '—'],
          ['Best', s.bestScore === null ? '—' : `${s.bestScore}%`],
          ['Change', s.improvement === null ? '—' : `${s.improvement > 0 ? '+' : ''}${Math.round(s.improvement)} pts`],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-black/25 px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{k}</p>
            <p className="mt-1 text-xl font-black tabular-nums text-white">{v}</p>
          </div>
        ))}
      </div>

      {s.subjectAccuracy.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Accuracy by subject</p>
          <div className="space-y-2.5">
            {s.subjectAccuracy.map(a => (
              <div key={a.label} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-gray-300">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${a.percent}%` }} />
                </div>
                <span className={`w-24 text-right text-xs tabular-nums ${scoreTone(a.percent)}`}>{a.percent}% · {a.correct}/{a.total}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Test history</p>
        {s.history.length === 0 ? (
          <p className="rounded-xl bg-black/20 py-8 text-center text-sm text-gray-500 ring-1 ring-inset ring-white/[0.06]">No tests taken yet.</p>
        ) : (
          <ul className="space-y-2">
            {s.history.map(h => (
              <li key={h.attemptId} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-black/20 px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-xs text-gray-500">{fmtDate(h.date)} · {h.correct} correct · {h.wrong} wrong · {h.skipped} skipped</p>
                </div>
                {(h.flagged || h.violations > 0) && (
                  <Chip tone={h.status === 'terminated' ? 'rose' : 'amber'}>
                    <Svg d={ICONS.flag} className="h-3 w-3" /> {h.status === 'terminated' ? 'Closed for violations' : `${h.violations} warning${h.violations === 1 ? '' : 's'}`}
                  </Chip>
                )}
                <span className={`w-14 text-right text-lg font-black tabular-nums ${scoreTone(h.score)}`}>{h.score}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  </AdminModal>
);

// ── Roster ──────────────────────────────────────────────────────────────────
const StudentRoster: React.FC<{
  instituteId: string;
  analytics: InstituteAnalytics | null;
  loading: boolean;
  onChanged: () => void;
  canManage?: boolean;
  onBulkImport?: () => void;
}> = ({ instituteId, analytics, loading, onChanged, canManage = true, onBulkImport }) => {
  const { classes: allClasses, updateStudent, deleteStudent, refreshStudents } = useData();
  const classes = useMemo(() => allClasses.filter(c => c.institute_id === instituteId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })), [allClasses, instituteId]);
  const students = analytics?.students ?? [];

  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<InstituteStudentRow | null>(null);
  const [editing, setEditing] = useState<InstituteStudentRow | null | undefined>(undefined);
  const [credentials, setCredentials] = useState<{ title: string; name: string; email: string; password: string } | null>(null);
  const [removing, setRemoving] = useState<InstituteStudentRow[] | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshAll = async () => {
    await refreshStudents();
    onChanged();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = students.filter(s =>
      (!classFilter || (classFilter === '__none' ? !s.classId : s.classId === classFilter)) &&
      (!q || `${s.name} ${s.email} ${s.rollNo || ''}`.toLowerCase().includes(q))
    );
    const by: Record<SortKey, (a: InstituteStudentRow, b: InstituteStudentRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      roll: (a, b) => (a.rollNo || '~').localeCompare(b.rollNo || '~', undefined, { numeric: true }),
      average: (a, b) => (b.testsTaken ? b.averageScore : -1) - (a.testsTaken ? a.averageScore : -1),
      tests: (a, b) => b.testsTaken - a.testsTaken,
      recent: (a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime(),
    };
    return [...list].sort(by[sort]);
  }, [students, query, classFilter, sort]);

  const active = students.filter(s => s.testsTaken > 0);
  const avgOfActive = active.length ? active.reduce((n, s) => n + s.averageScore, 0) / active.length : null;
  const allVisibleSelected = visible.length > 0 && visible.every(s => selected.has(s.id));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const resetPassword = async (s: InstituteStudentRow) => {
    setBusy(true);
    try {
      const password = generatePassword(10);
      await updateStudent(s.id, { password });
      setViewing(null);
      setCredentials({ title: 'New password set', name: s.name, email: s.email, password });
    } finally {
      setBusy(false);
    }
  };

  const moveSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      for (const id of selected) await updateStudent(id, { class_id: moveTo || null });
      setSelected(new Set());
      await refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      for (const s of removing) await deleteStudent(s.id);
      setSelected(new Set());
      setRemoving(null);
      setViewing(null);
      await refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Name', 'Email', 'Roll number', 'Class', 'Tests taken', 'Average %', 'Best %', 'Latest %', 'Change (pts)', 'Flagged attempts', 'Last active'],
      ...visible.map(s => [s.name, s.email, s.rollNo, s.className, s.testsTaken, s.testsTaken ? Math.round(s.averageScore) : '', s.bestScore ?? '', s.latestScore ?? '', s.improvement ?? '', s.flaggedCount, s.lastActive ? fmtDate(s.lastActive) : '']),
    ];
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Students', students.length, ICONS.building],
          ['Active (took a test)', active.length, ICONS.check],
          ['Average score', avgOfActive === null ? '—' : `${Math.round(avgOfActive)}%`, ICONS.sparkles],
          ['Flagged attempts', students.reduce((n, s) => n + s.flaggedCount, 0), ICONS.flag],
        ].map(([label, value, icon], i) => (
          <div key={label as string} style={{ animationDelay: `${i * 50}ms` }} className="rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 p-4 ring-1 ring-inset ring-white/[0.07] animate-rise-in">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500"><Svg d={icon as string} className="h-3.5 w-3.5" /> {label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums text-white">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <Card
        icon={ICONS.search}
        title="Roster"
        subtitle={`${visible.length} of ${students.length} student${students.length === 1 ? '' : 's'}`}
        raised
        bodyClassName="p-0"
        aside={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={!visible.length} className={`${secondaryBtn} h-10 px-4 text-xs`}><Svg d={ICONS.doc} /> Export CSV</button>
            {canManage && onBulkImport && <button onClick={onBulkImport} className={`${secondaryBtn} h-10 px-4 text-xs`}><Svg d={ICONS.upload} /> Bulk import</button>}
            {canManage && <button onClick={() => setEditing(null)} className={`${primaryBtn} h-10 px-4 text-xs`}><Svg d={ICONS.plus} /> Add student</button>}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 border-b border-white/[0.06] p-4 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Svg d={ICONS.search} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email or roll number…" className={`${inputCls} pl-10`} />
          </div>
          <SelectMenu title="Class" value={classFilter} onChange={setClassFilter} placeholder="All classes" emptyOption={{ value: '', label: 'All classes' }}
            options={[...classes.map(c => ({ value: c.id, label: c.name })), { value: '__none', label: 'No class' }]} />
          <SelectMenu title="Sort by" value={sort} onChange={v => setSort(v as SortKey)} placeholder="Sort" options={SORTS} />
        </div>

        {canManage && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-emerald-400/[0.04] px-4 py-3 animate-fade-in">
            <span className="text-sm font-semibold text-emerald-200">{selected.size} selected</span>
            <div className="w-48"><SelectMenu title="Move to" value={moveTo} onChange={setMoveTo} placeholder="Choose class" emptyOption={{ value: '', label: 'No class' }} options={classes.map(c => ({ value: c.id, label: c.name }))} /></div>
            <button onClick={moveSelected} disabled={busy} className={`${secondaryBtn} h-10 px-4 text-xs`}>Move</button>
            <button onClick={() => setRemoving(students.filter(s => selected.has(s.id)))} disabled={busy} className={`${dangerBtn} h-10 px-4 text-xs`}>Remove</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold text-gray-400 hover:text-white">Clear selection</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              <tr className="border-b border-white/[0.06]">
                {canManage && (
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" aria-label="Select all" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map(s => s.id)))} className="h-4 w-4 accent-emerald-500" />
                  </th>
                )}
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3 text-right">Tests</th>
                <th className="px-4 py-3">Average</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.map(s => (
                <tr key={s.id} className={`group transition-colors hover:bg-white/[0.02] ${selected.has(s.id) ? 'bg-emerald-400/[0.03]' : ''}`}>
                  {canManage && (
                    <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-emerald-500" /></td>
                  )}
                  <td className="px-4 py-3">
                    <button onClick={() => setViewing(s)} className="flex items-center gap-3 text-left">
                      <Avatar name={s.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white group-hover:text-emerald-200">{s.name}</span>
                        <span className="block truncate text-xs text-gray-500">{s.rollNo ? `Roll ${s.rollNo} · ` : ''}{s.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">{s.className ? <Chip tone="emerald">{s.className}</Chip> : <span className="text-xs italic text-gray-600">No class</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-300">{s.testsTaken}</td>
                  <td className="px-4 py-3"><ScoreBar value={s.testsTaken ? s.averageScore : null} /></td>
                  <td className="px-4 py-3 tabular-nums">
                    {s.improvement === null ? <span className="text-gray-600">—</span> : (
                      <span className={s.improvement >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{s.improvement > 0 ? '▲ +' : s.improvement < 0 ? '▼ ' : ''}{Math.round(s.improvement)}</span>
                    )}
                    {s.flaggedCount > 0 && <span className="ml-2 inline-flex"><Chip tone="amber"><Svg d={ICONS.flag} className="h-3 w-3" /> {s.flaggedCount}</Chip></span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(s.lastActive)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <IconButton icon="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" label={`View ${s.name}`} onClick={() => setViewing(s)} />
                      {canManage && <IconButton icon={ICONS.edit} label={`Edit ${s.name}`} onClick={() => setEditing(s)} />}
                      {canManage && <IconButton icon={ICONS.trash} label={`Remove ${s.name}`} tone="danger" onClick={() => setRemoving([s])} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visible.length === 0 && (
            <p className="py-14 text-center text-sm text-gray-500">{students.length ? 'No students match these filters.' : 'No students yet.'}</p>
          )}
          {loading && <p className="py-14 text-center text-sm text-gray-500">Loading students…</p>}
        </div>
      </Card>

      {viewing && (
        <StudentDrawer
          student={viewing}
          canManage={canManage}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onReset={() => resetPassword(viewing)}
          onRemove={() => setRemoving([viewing])}
        />
      )}
      {editing !== undefined && (
        <StudentFormModal
          instituteId={instituteId}
          classes={classes}
          student={editing}
          onClose={() => setEditing(undefined)}
          onSaved={refreshAll}
          onCreated={creds => { setEditing(undefined); setCredentials({ title: 'Student added', ...creds }); }}
        />
      )}
      {credentials && <CredentialsModal {...credentials} onClose={() => setCredentials(null)} />}
      {removing && (
        <AdminModal
          title={removing.length === 1 ? `Remove ${removing[0].name}?` : `Remove ${removing.length} students?`}
          subtitle="Their login is deleted, so they can no longer sign in, and their results stop appearing under their name. This can’t be undone."
          icon={ICONS.trash}
          tone="rose"
          width="max-w-md"
          onClose={() => !busy && setRemoving(null)}
          footer={
            <>
              <button onClick={() => setRemoving(null)} disabled={busy} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Keep</button>
              <button onClick={confirmRemove} disabled={busy} className={`${dangerBtn} px-5 py-2.5 text-sm`}>{busy ? 'Removing…' : 'Remove'}</button>
            </>
          }
        >
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {removing.map(s => <li key={s.id} className="flex items-center gap-3 text-sm text-gray-300"><Avatar name={s.name} /> {s.name} <span className="text-xs text-gray-500">{s.email}</span></li>)}
          </ul>
        </AdminModal>
      )}
    </div>
  );
};

export default StudentRoster;
