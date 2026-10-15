import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { Institute } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import { InstituteFormModal } from './EditInstituteModal';
import SharePaperModal from './SharePaperModal';
import InstituteDetail from './institutes/InstituteDetail';
import PublicCandidates from './institutes/PublicCandidates';
import {
  Svg, ICONS, Card, PageHeader, Segmented, IconButton, AdminModal, InstituteAvatar, Chip, primaryBtn, secondaryBtn, dangerBtn, inputCls,
} from '../../../../components/ui/admin';

// Partner institutes: a directory of school cards (with real student / test / score figures)
// and a network overview ranking schools by their students' average score.

interface InstituteStats {
  students: number;
  tests: number;
  attempts: number;
  /** Average share of questions answered correctly, 0–100; null when nobody has taken a test. */
  avgScore: number | null;
}

const EMPTY_STATS: InstituteStats = { students: 0, tests: 0, attempts: 0, avgScore: null };

async function fetchAll<T>(table: string, columns: string, apply?: (q: any) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(columns).range(from, from + 999);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error || !data) break;
    rows.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return rows;
}

/** Students, tests and average score per institute, from the live tables. */
function useInstituteStats(refreshKey: number) {
  const [stats, setStats] = useState<Record<string, InstituteStats>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [students, tests, attempts] = await Promise.all([
        fetchAll<{ institute_id: string | null }>('users', 'institute_id', q => q.eq('role', 'student')),
        fetchAll<{ id: string; institute_id: string | null; question_ids: string[] | null }>('tests', 'id, institute_id, question_ids'),
        fetchAll<{ test_id: string; total_correct: number | null }>('test_attempts', 'test_id, total_correct'),
      ]);
      const out: Record<string, InstituteStats & { scoreSum: number; scored: number }> = {};
      const get = (id: string) => (out[id] ??= { ...EMPTY_STATS, scoreSum: 0, scored: 0 });
      for (const s of students) if (s.institute_id) get(s.institute_id).students++;
      const testInfo = new Map(tests.map(t => [t.id, t]));
      for (const t of tests) if (t.institute_id) get(t.institute_id).tests++;
      for (const a of attempts) {
        const t = testInfo.get(a.test_id);
        if (!t?.institute_id) continue;
        const entry = get(t.institute_id);
        entry.attempts++;
        const total = t.question_ids?.length || 0;
        if (total > 0 && a.total_correct !== null && a.total_correct !== undefined) {
          entry.scoreSum += Math.min(100, (a.total_correct / total) * 100);
          entry.scored++;
        }
      }
      if (cancelled) return;
      setStats(Object.fromEntries(Object.entries(out).map(([id, e]) => [id, { students: e.students, tests: e.tests, attempts: e.attempts, avgScore: e.scored ? e.scoreSum / e.scored : null }])));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);
  return { stats, loading };
}

const StatTile: React.FC<{ icon: string; label: string; value: React.ReactNode; accent?: boolean; delay?: number }> = ({ icon, label, value, accent, delay = 0 }) => (
  <div
    style={{ animationDelay: `${delay}ms` }}
    className={`relative overflow-hidden rounded-2xl p-5 ring-1 ring-inset animate-rise-in ${accent ? 'bg-gradient-to-b from-emerald-400/[0.12] to-emerald-500/[0.03] ring-emerald-400/30' : 'bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-white/[0.07]'}`}
  >
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
      <Svg d={icon} className={`h-4 w-4 ${accent ? 'text-emerald-300' : 'text-gray-500'}`} /> {label}
    </div>
    <p className={`mt-3 text-3xl font-black tabular-nums ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
  </div>
);

const ScoreBar: React.FC<{ value: number | null }> = ({ value }) => (
  <div className="flex items-center gap-3">
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-700" style={{ width: `${value ?? 0}%` }} />
    </div>
    <span className="w-14 text-sm font-bold tabular-nums text-white">{value === null ? '—' : `${value.toFixed(1)}%`}</span>
  </div>
);

const ManageInstitutes: React.FC = () => {
  const { institutes, deleteInstitute, refreshInstitutes } = useData();
  const [tab, setTab] = useState<'directory' | 'overview' | 'candidates'>('directory');
  const [openInstitute, setOpenInstitute] = useState<Institute | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Institute | null>(null);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState<Institute | null>(null);
  const [deleting, setDeleting] = useState<Institute | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { stats, loading } = useInstituteStats(refreshKey);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...institutes]
      .filter(i => !q || `${i.name} ${i.email}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [institutes, query]);

  const totals = useMemo(() => {
    const values = Object.values(stats);
    const scored = values.filter(v => v.avgScore !== null);
    return {
      students: values.reduce((n, v) => n + v.students, 0),
      tests: values.reduce((n, v) => n + v.tests, 0),
      attempts: values.reduce((n, v) => n + v.attempts, 0),
      avg: scored.length ? scored.reduce((n, v) => n + (v.avgScore as number), 0) / scored.length : null,
    };
  }, [stats]);

  const ranking = useMemo(
    () => [...institutes].map(i => ({ inst: i, s: stats[i.id] ?? EMPTY_STATS })).sort((a, b) => (b.s.avgScore ?? -1) - (a.s.avgScore ?? -1) || b.s.attempts - a.s.attempts),
    [institutes, stats]
  );

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteInstitute(deleting.id);
      await refreshInstitutes();
      setRefreshKey(k => k + 1);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const fmt = (n: number) => (loading ? '…' : n.toLocaleString('en-IN'));

  if (openInstitute) {
    const current = institutes.find(i => i.id === openInstitute.id) || openInstitute;
    return (
      <>
        <InstituteDetail institute={current} onBack={() => { setOpenInstitute(null); setRefreshKey(k => k + 1); }} onEdit={() => setEditing(current)} />
        {editing && <InstituteFormModal institute={editing} onClose={() => setEditing(null)} onSaved={() => setRefreshKey(k => k + 1)} />}
      </>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        eyebrow="Network"
        title="Partner institutes"
        subtitle="Schools on Atlas Classes, their logins and how their students are doing."
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<'directory' | 'overview' | 'candidates'> value={tab} onChange={setTab} options={[{ value: 'directory', label: 'Directory' }, { value: 'overview', label: 'Overview' }, { value: 'candidates', label: 'Public candidates' }]} />
            <button onClick={() => setAdding(true)} className={`${primaryBtn} h-11 px-5 text-sm`}><Svg d={ICONS.plus} /> Add institute</button>
          </div>
        }
      />

      {tab !== 'candidates' && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ICONS.building} label="Institutes" value={institutes.length} />
        <StatTile icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" label="Students" value={fmt(totals.students)} delay={60} />
        <StatTile icon={ICONS.doc} label="Tests assigned" value={fmt(totals.tests)} delay={120} />
        <StatTile icon={ICONS.sparkles} label="Average score" value={loading ? '…' : totals.avg === null ? '—' : `${totals.avg.toFixed(1)}%`} accent delay={180} />
      </div>}

      {tab === 'directory' ? (
        <div key="directory" className="space-y-4 animate-rise-in">
          {institutes.length > 4 && (
            <div className="relative max-w-sm">
              <Svg d={ICONS.search} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search institutes…" className={`${inputCls} pl-10`} />
            </div>
          )}

          {visible.length === 0 ? (
            <Card icon={ICONS.building} title={institutes.length ? 'No matches' : 'No institutes yet'}>
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm text-gray-400">{institutes.length ? `Nothing matches “${query}”.` : 'Add your first partner school to give it a login.'}</p>
                {!institutes.length && <button onClick={() => setAdding(true)} className={`${primaryBtn} mt-5 px-5 py-2.5 text-sm`}><Svg d={ICONS.plus} /> Add institute</button>}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((inst, i) => {
                const s = stats[inst.id] ?? EMPTY_STATS;
                return (
                  <article
                    key={inst.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenInstitute(inst)}
                    onKeyDown={e => { if (e.key === 'Enter') setOpenInstitute(inst); }}
                    style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}
                    className="group relative flex cursor-pointer flex-col rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 p-5 outline-none focus-visible:ring-emerald-400/60 ring-1 ring-inset ring-white/[0.07] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)] transition-all duration-300 animate-rise-in hover:-translate-y-1 hover:ring-emerald-400/25 hover:shadow-[0_28px_60px_-28px_rgba(16,185,129,0.35)]"
                  >
                    <div className="flex items-start gap-4">
                      <InstituteAvatar name={inst.name} logoUrl={inst.logo_url} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold text-white" title={inst.name}>{inst.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500"><Svg d={ICONS.mail} className="h-3.5 w-3.5 shrink-0" /> {inst.email}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                        ['Students', loading ? '…' : s.students],
                        ['Tests', loading ? '…' : s.tests],
                        ['Avg score', loading ? '…' : s.avgScore === null ? '—' : `${Math.round(s.avgScore)}%`],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{label}</p>
                          <p className="mt-1 text-lg font-black tabular-nums text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300/80 transition-colors group-hover:text-emerald-200">
                        View details <Svg d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <IconButton icon={ICONS.doc} label={`Share papers with ${inst.name}`} onClick={() => setSharing(inst)} />
                        <IconButton icon={ICONS.edit} label={`Edit ${inst.name}`} onClick={() => setEditing(inst)} />
                        <IconButton icon={ICONS.trash} label={`Delete ${inst.name}`} tone="danger" onClick={() => setDeleting(inst)} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'candidates' ? (
        <PublicCandidates key="candidates" />
      ) : (
        <Card key="overview" icon={ICONS.sparkles} title="Performance by institute" subtitle="Average share of questions answered correctly across all of a school's test attempts." className="animate-rise-in" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Institute</th>
                  <th className="px-6 py-4 text-right">Students</th>
                  <th className="px-6 py-4 text-right">Tests</th>
                  <th className="px-6 py-4 text-right">Attempts</th>
                  <th className="px-6 py-4">Average score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ranking.map(({ inst, s }, i) => (
                  <tr key={inst.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-black tabular-nums text-gray-500">{s.avgScore === null ? '—' : i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <InstituteAvatar name={inst.name} logoUrl={inst.logo_url} />
                        <span className="min-w-[160px] font-semibold text-white">{inst.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-300">{loading ? '…' : s.students}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-300">{loading ? '…' : s.tests}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-gray-300">{loading ? '…' : s.attempts}</td>
                    <td className="px-6 py-4"><ScoreBar value={loading ? null : s.avgScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {institutes.length === 0 && <p className="py-12 text-center text-sm text-gray-500">No institutes yet.</p>}
          </div>
        </Card>
      )}

      {adding && <InstituteFormModal onClose={() => setAdding(false)} onSaved={() => setRefreshKey(k => k + 1)} />}
      {editing && <InstituteFormModal institute={editing} onClose={() => setEditing(null)} onSaved={() => setRefreshKey(k => k + 1)} />}
      {sharing && <SharePaperModal institute={sharing} onClose={() => setSharing(null)} />}
      {deleting && (
        <AdminModal
          title={`Delete ${deleting.name}?`}
          subtitle="This can't be undone."
          icon={ICONS.trash}
          tone="rose"
          width="max-w-md"
          onClose={() => !deleteBusy && setDeleting(null)}
          footer={
            <>
              <button onClick={() => setDeleting(null)} disabled={deleteBusy} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Keep it</button>
              <button onClick={confirmDelete} disabled={deleteBusy} className={`${dangerBtn} px-5 py-2.5 text-sm`}>
                {deleteBusy ? <><span className="h-4 w-4 rounded-full border-2 border-rose-300/30 border-t-rose-300 animate-spin" /> Deleting…</> : 'Delete institute'}
              </button>
            </>
          }
        >
          <div className="flex items-center gap-4 rounded-2xl bg-black/25 p-4 ring-1 ring-inset ring-white/[0.07]">
            <InstituteAvatar name={deleting.name} logoUrl={deleting.logo_url} size="lg" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-white">{deleting.name}</p>
              <p className="truncate text-gray-500">{deleting.email}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-400">The school's profile and its institute login are removed, so it can no longer sign in.</p>
        </AdminModal>
      )}
    </div>
  );
};

export default ManageInstitutes;
