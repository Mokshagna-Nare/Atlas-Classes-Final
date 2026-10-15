import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../../services/supabase';
import SelectMenu from '../../../../../components/ui/SelectMenu';
import { Svg, ICONS, Card, Chip, inputCls, secondaryBtn } from '../../../../../components/ui/admin';

// Admin → Partner institutes → Public candidates: everyone who took a test through a public
// link without a student account (name + email typed at the start).

interface GuestRow {
  id: string;
  name: string;
  email: string;
  testId: string;
  testTitle: string;
  date: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  violations: number;
  status: string | null;
  flagged: boolean;
  /** The test was meant for an institute — this guest got in before link access was locked down. */
  restricted: boolean;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const tone = (v: number) => (v >= 75 ? 'text-emerald-300' : v >= 50 ? 'text-amber-300' : 'text-rose-300');

async function fetchAll<T>(table: string, columns: string, apply?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

const PublicCandidates: React.FC = () => {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [testFilter, setTestFilter] = useState('');

  useEffect(() => {
    (async () => {
      const [attempts, tests, assignments] = await Promise.all([
        fetchAll<any>('test_attempts', 'id, test_id, guest_name, guest_email, score, total_correct, answers, end_time, flagged, status, violation_count, tab_switch_count, fullscreen_exit_count', q => q.is('student_id', null).not('guest_email', 'is', null)),
        fetchAll<any>('tests', 'id, title, institute_id, question_ids'),
        fetchAll<any>('test_assignments', 'test_id'),
      ]);
      const testById = new Map(tests.map(t => [t.id, t]));
      const assigned = new Set(assignments.map(a => a.test_id));
      setRows(
        attempts
          .map(a => {
            const t = testById.get(a.test_id);
            const total = (t?.question_ids || []).length;
            const answered = Object.values(a.answers || {}).filter(v => v !== null && v !== undefined).length;
            const correct = a.total_correct ?? 0;
            return {
              id: a.id, name: a.guest_name || 'Unnamed', email: a.guest_email, testId: a.test_id, testTitle: t?.title || 'Deleted test',
              date: a.end_time, score: a.score ?? 0, correct, wrong: Math.max(0, answered - correct), skipped: Math.max(0, total - answered),
              violations: a.violation_count ?? (a.tab_switch_count || 0) + (a.fullscreen_exit_count || 0),
              status: a.status ?? null, flagged: !!a.flagged,
              restricted: Boolean(t && (t.institute_id || assigned.has(t.id))),
            } as GuestRow;
          })
          .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
      );
      setLoading(false);
    })();
  }, []);

  const tests = useMemo(() => {
    const m = new Map<string, { title: string; count: number }>();
    for (const r of rows) m.set(r.testId, { title: r.testTitle, count: (m.get(r.testId)?.count ?? 0) + 1 });
    return [...m].map(([value, v]) => ({ value, label: v.title, hint: `${v.count} attempt${v.count === 1 ? '' : 's'}` })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => (!testFilter || r.testId === testFilter) && (!q || `${r.name} ${r.email} ${r.testTitle}`.toLowerCase().includes(q)));
  }, [rows, query, testFilter]);

  const people = new Set(rows.map(r => r.email.toLowerCase())).size;
  const average = rows.length ? rows.reduce((n, r) => n + r.score, 0) / rows.length : null;
  const restrictedCount = rows.filter(r => r.restricted).length;

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Name', 'Email', 'Test', 'Date', 'Score %', 'Correct', 'Wrong', 'Skipped', 'Warnings', 'Status', 'Restricted test'],
      ...visible.map(r => [r.name, r.email, r.testTitle, fmtDate(r.date), r.score, r.correct, r.wrong, r.skipped, r.violations, r.status || '', r.restricted ? 'yes' : 'no']),
    ].map(r => r.map(esc).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `public-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5 animate-rise-in">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['People', people, ICONS.mail],
          ['Attempts', rows.length, ICONS.doc],
          ['Average score', average === null ? '—' : `${Math.round(average)}%`, ICONS.sparkles],
          ['On restricted tests', restrictedCount, ICONS.warning],
        ].map(([label, value, icon], i) => (
          <div key={label as string} style={{ animationDelay: `${i * 50}ms` }} className={`rounded-2xl p-4 ring-1 ring-inset animate-rise-in ${label === 'On restricted tests' && restrictedCount ? 'bg-amber-400/[0.06] ring-amber-400/25' : 'bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-white/[0.07]'}`}>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500"><Svg d={icon as string} className="h-3.5 w-3.5" /> {label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      {restrictedCount > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-400/[0.06] p-4 text-sm text-amber-200/90 ring-1 ring-inset ring-amber-400/25">
          <Svg d={ICONS.warning} className="mt-0.5 h-4 w-4 shrink-0" />
          {restrictedCount} attempt{restrictedCount === 1 ? ' was' : 's were'} made through the link of a test meant only for an institute's students, before link access was locked down. New attempts like these are now refused.
        </p>
      )}

      <Card
        icon={ICONS.search}
        title="Public-link candidates"
        subtitle="People who took a test with just a name and email"
        bodyClassName="p-0"
        aside={<button onClick={exportCsv} disabled={!visible.length} className={`${secondaryBtn} h-10 px-4 text-xs`}><Svg d={ICONS.doc} /> Export CSV</button>}
      >
        <div className="grid grid-cols-1 gap-3 border-b border-white/[0.06] p-4 md:grid-cols-[1fr_280px]">
          <div className="relative">
            <Svg d={ICONS.search} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email or test…" className={`${inputCls} pl-10`} />
          </div>
          <SelectMenu title="Test" value={testFilter} onChange={setTestFilter} placeholder="All tests" emptyOption={{ value: '', label: 'All tests' }} options={tests} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              <tr><th className="px-5 py-3">Candidate</th><th className="px-5 py-3">Test</th><th className="px-5 py-3">Taken</th><th className="px-5 py-3">Answers</th><th className="px-5 py-3">Proctoring</th><th className="px-5 py-3 text-right">Score</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3"><p className="font-semibold text-white">{r.name}</p><p className="text-xs text-gray-500">{r.email}</p></td>
                  <td className="px-5 py-3">
                    <p className="max-w-[260px] truncate text-gray-200" title={r.testTitle}>{r.testTitle}</p>
                    {r.restricted && <span className="mt-1 inline-flex"><Chip tone="amber"><Svg d={ICONS.warning} className="h-3 w-3" /> Institute-only test</Chip></span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{fmtDate(r.date)}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{r.correct} correct · {r.wrong} wrong · {r.skipped} skipped</td>
                  <td className="px-5 py-3">
                    {r.status === 'terminated' ? <Chip tone="rose">Closed for violations</Chip> : r.violations > 0 ? <Chip tone="amber">{r.violations} warning{r.violations === 1 ? '' : 's'}</Chip> : <span className="text-xs text-gray-600">Clean</span>}
                  </td>
                  <td className={`px-5 py-3 text-right text-lg font-black tabular-nums ${tone(r.score)}`}>{r.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visible.length === 0 && <p className="py-14 text-center text-sm text-gray-500">{rows.length ? 'No candidates match these filters.' : 'Nobody has taken a public-link test yet.'}</p>}
          {loading && <p className="py-14 text-center text-sm text-gray-500">Loading…</p>}
        </div>
      </Card>
    </div>
  );
};

export default PublicCandidates;
