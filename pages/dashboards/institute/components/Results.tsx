import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAuth } from '../../../../contexts/AuthContext';
import { useInstituteAnalytics, InstituteTestStat } from '../../../../hooks/useInstituteAnalytics';
import { Card, StatTile, EmptyNote, Skeleton, AccuracyBars, tooltipStyle, perfText } from '../../../../components/analytics/AnalyticsUI';
import { ArrowLeftIcon, ArrowRightIcon, UserGroupIcon, ChartBarIcon, TrophyIcon, ShieldCheckIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, DocumentTextIcon, AcademicCapIcon } from '../../../../components/icons';

const BAND_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#34D399', '#10B981'];
const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

const exportCsv = (test: InstituteTestStat) => {
  const header = ['Rank', 'Student', 'Roll no', 'Class', 'Score (%)', 'Correct', 'Wrong', 'Flagged', 'Tab switches', 'Fullscreen exits', 'Submitted at'];
  const rows = test.attempts.map(r => [r.rank, r.studentName, r.rollNo || '', r.className || '', r.score, r.correct, r.wrong, r.flagged ? 'Yes' : 'No', r.tabSwitches, r.fullscreenExits, new Date(r.endTime).toLocaleString()]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${test.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'test'}_results.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const TestDetail: React.FC<{ test: InstituteTestStat; onBack: () => void }> = ({ test, onBack }) => {
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => test.attempts.filter(r => `${r.studentName} ${r.rollNo || ''}`.toLowerCase().includes(query.toLowerCase())), [test, query]);

  // Opening a test from far down the list shouldn't leave you mid-page.
  useEffect(() => { rootRef.current?.scrollIntoView({ block: 'start' }); }, [test.id]);

  return (
    <div ref={rootRef} className="space-y-6 animate-view-in scroll-mt-28">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">
        <ArrowLeftIcon className="h-4 w-4" /> All results
      </button>

      <section className="rounded-[1.75rem] border border-white/5 bg-gradient-to-br from-atlas-dark to-atlas-primary/[0.06] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atlas-primary mb-2">{longDate(test.date)}</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{test.title}</h2>
          <p className="text-sm text-gray-500 mt-2">{test.questionCount} questions · {test.attempts.length} students attempted · {test.participation}% participation</p>
        </div>
        <button onClick={() => exportCsv(test)} disabled={test.attempts.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-atlas-black bg-atlas-primary hover:bg-emerald-400 transition-colors disabled:opacity-40 shrink-0">
          <ArrowUpTrayIcon className="h-4 w-4 rotate-180" /> Export CSV
        </button>
      </section>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <StatTile icon={<ChartBarIcon className="h-4 w-4" />} label="Class average" value={`${test.averageScore}%`} valueClass={perfText(test.averageScore)} />
        <StatTile icon={<TrophyIcon className="h-4 w-4" />} label="Top score" value={`${test.topScore}%`} hint={`Lowest ${test.lowestScore}%`} />
        <StatTile icon={<UserGroupIcon className="h-4 w-4" />} label="Participation" value={`${test.participation}%`} hint={`${test.attempts.length} attempts`} />
        <StatTile icon={<ShieldCheckIcon className="h-4 w-4" />} label="Flagged" value={String(test.flaggedCount)} valueClass={test.flaggedCount ? 'text-amber-400' : ''} hint="Proctoring violations" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Score distribution" icon={<ChartBarIcon className="h-5 w-5" />}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={test.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="band" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={b => `${b}%`} />
                <YAxis allowDecimals={false} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(v: any) => [v, 'Students']} labelFormatter={(l: any) => `${l}%`} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>{test.distribution.map((_, i) => <Cell key={i} fill={BAND_COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Subject accuracy" caption="Across every student's answers in this test." icon={<AcademicCapIcon className="h-5 w-5" />}>
          <AccuracyBars data={test.subjectAccuracy} emptyText="No answers recorded for this test." />
        </Card>
      </div>

      <Card title="Class results" caption="Students with the same score share a rank." icon={<UserGroupIcon className="h-5 w-5" />}
        action={test.attempts.length > 6 ? (
          <div className="relative w-44 sm:w-56 shrink-0">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a student…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-atlas-black/60 border border-white/10 text-sm text-white outline-none focus:border-atlas-primary/50" />
          </div>
        ) : undefined}>
        {test.attempts.length === 0 ? <EmptyNote text="No students have attempted this test yet." /> : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left min-w-[620px]">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  <th className="px-2 pb-3 w-12">Rank</th><th className="px-2 pb-3">Student</th><th className="px-2 pb-3">Class</th>
                  <th className="px-2 pb-3 text-center">Score</th><th className="px-2 pb-3 text-center">Correct / Wrong</th><th className="px-2 pb-3 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(r => (
                  <tr key={r.attemptId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-2 py-3 text-sm font-black text-gray-400">#{r.rank}</td>
                    <td className="px-2 py-3">
                      <p className="text-sm font-bold text-white">{r.studentName}</p>
                      {r.rollNo && <p className="text-[11px] text-gray-500">Roll {r.rollNo}</p>}
                    </td>
                    <td className="px-2 py-3 text-xs text-gray-400">{r.className || '—'}</td>
                    <td className={`px-2 py-3 text-center text-base font-black ${perfText(r.score)}`}>{r.score}%</td>
                    <td className="px-2 py-3 text-center text-sm font-mono"><span className="text-emerald-400">{r.correct}</span><span className="text-gray-600"> / </span><span className="text-red-400">{r.wrong}</span></td>
                    <td className="px-2 py-3 text-right">
                      {r.flagged
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider" title={`${r.tabSwitches} tab switches · ${r.fullscreenExits} fullscreen exits`}><ShieldCheckIcon className="h-3 w-3" /> Flagged</span>
                        : <span className="text-[11px] text-gray-600">Clean</span>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-8 text-center text-sm text-gray-500">No student matches “{query}”.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

const Results: React.FC = () => {
  const { user } = useAuth()!;
  const { analytics, loading, error } = useInstituteAnalytics(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const header = (
    <div>
      <h2 className="text-3xl font-extrabold text-white">Results</h2>
      <p className="text-sm text-gray-500 mt-1">Every online test your students have taken, with full class results.</p>
    </div>
  );

  if (loading) return <div className="space-y-6">{header}<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;
  if (error || !analytics) return <div className="space-y-6">{header}<p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-4">{error || 'Results are unavailable right now.'}</p></div>;

  const selected = analytics.tests.find(t => t.id === selectedId);
  if (selected) return <TestDetail test={selected} onBack={() => setSelectedId(null)} />;

  return (
    <div className="space-y-6">
      {header}
      {analytics.tests.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl">
          <DocumentTextIcon className="h-10 w-10 text-gray-700 mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-300">No online tests yet</p>
          <p className="text-xs text-gray-500 mt-1">Results appear here once Atlas assigns a test to your classes and students take it.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-view-in">
          {analytics.tests.map(t => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className="group w-full text-left bg-atlas-dark border border-white/5 rounded-3xl p-5 sm:p-6 hover:border-atlas-primary/30 hover:bg-atlas-primary/[0.02] transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{longDate(t.date)} · {t.questionCount} questions</p>
                  <h3 className="text-lg font-black text-white truncate group-hover:text-emerald-200 transition-colors">{t.title}</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 w-40 max-w-full rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-atlas-primary" style={{ width: `${t.participation}%` }} /></div>
                    <span className="text-[11px] text-gray-500">{t.participation}% participation · {t.attempts.length} attempts{t.flaggedCount ? ` · ${t.flaggedCount} flagged` : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Average</p>
                    <p className={`text-2xl font-black ${t.attempts.length ? perfText(t.averageScore) : 'text-gray-600'}`}>{t.attempts.length ? `${t.averageScore}%` : '—'}</p>
                  </div>
                  <div className="h-10 w-px bg-white/5" />
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Top</p>
                    <p className="text-2xl font-black text-white">{t.attempts.length ? `${t.topScore}%` : '—'}</p>
                  </div>
                  <ArrowRightIcon className="hidden sm:block h-5 w-5 text-gray-600 group-hover:text-atlas-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Results;
