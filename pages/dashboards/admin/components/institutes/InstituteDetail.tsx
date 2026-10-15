import React, { useMemo, useState } from 'react';
import { Institute } from '../../../../../types';
import { useData } from '../../../../../contexts/DataContext';
import { useInstituteAnalytics } from '../../../../../hooks/useInstituteAnalytics';
import StudentRoster from '../../../../../components/students/StudentRoster';
import { Svg, ICONS, Card, Chip, Segmented, InstituteAvatar, secondaryBtn } from '../../../../../components/ui/admin';

// Admin → Partner institutes → one school: overview, students (full management), classes, tests.

type Tab = 'overview' | 'students' | 'classes' | 'tests';

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const tone = (v: number) => (v >= 75 ? 'text-emerald-300' : v >= 50 ? 'text-amber-300' : 'text-rose-300');

const Bar: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const InstituteDetail: React.FC<{ institute: Institute; onBack: () => void; onEdit: () => void }> = ({ institute, onBack, onEdit }) => {
  const { classes: allClasses } = useData();
  const { analytics: a, loading, refresh } = useInstituteAnalytics(institute.id);
  const [tab, setTab] = useState<Tab>('overview');
  const classes = useMemo(
    () => allClasses.filter(c => c.institute_id === institute.id).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true })),
    [allClasses, institute.id]
  );

  const classRows = useMemo(() => {
    const students = a?.students ?? [];
    const rows = classes.map(c => {
      const members = students.filter(s => s.classId === c.id);
      const active = members.filter(s => s.testsTaken > 0);
      return { id: c.id, name: c.name, students: members.length, active: active.length, average: active.length ? active.reduce((n, s) => n + s.averageScore, 0) / active.length : null, subjects: c.subjects || [] };
    });
    const unassigned = students.filter(s => !s.classId);
    if (unassigned.length) {
      const active = unassigned.filter(s => s.testsTaken > 0);
      rows.push({ id: '__none', name: 'No class', students: unassigned.length, active: active.length, average: active.length ? active.reduce((n, s) => n + s.averageScore, 0) / active.length : null, subjects: [] });
    }
    return rows;
  }, [a, classes]);

  const kpis: [string, React.ReactNode, string][] = [
    ['Students', a?.studentCount ?? '…', ICONS.building],
    ['Classes', a?.classCount ?? '…', ICONS.book],
    ['Tests taken', a?.testsWithAttempts ?? '…', ICONS.doc],
    ['Attempts', a?.totalAttempts ?? '…', ICONS.check],
    ['Average score', a ? (a.totalAttempts ? `${Math.round(a.campusAverage)}%` : '—') : '…', ICONS.sparkles],
    ['Flagged attempts', a?.flaggedAttempts ?? '…', ICONS.flag],
  ];

  return (
    <div className="space-y-6 text-white animate-rise-in">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 transition hover:text-white">
        <Svg d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /> All institutes
      </button>

      <div className="flex flex-wrap items-center gap-5 rounded-3xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 p-6 ring-1 ring-inset ring-white/[0.07] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]">
        <InstituteAvatar name={institute.name} logoUrl={institute.logo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Partner institute</p>
          <h2 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{institute.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
            <span className="inline-flex items-center gap-1.5"><Svg d={ICONS.mail} className="h-3.5 w-3.5" /> {institute.email}</span>
            <Chip><span className="font-mono">{institute.id.slice(0, 8)}</span></Chip>
          </p>
        </div>
        <button onClick={onEdit} className={`${secondaryBtn} h-10 px-4 text-sm`}><Svg d={ICONS.edit} /> Edit institute</button>
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'students', label: `Students${a ? ` · ${a.studentCount}` : ''}` },
          { value: 'classes', label: `Classes${a ? ` · ${a.classCount}` : ''}` },
          { value: 'tests', label: 'Tests' },
        ]}
      />

      {tab === 'overview' && (
        <div key="overview" className="space-y-5 animate-rise-in">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map(([label, value, icon], i) => (
              <div key={label} style={{ animationDelay: `${i * 40}ms` }} className="rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 p-4 ring-1 ring-inset ring-white/[0.07] animate-rise-in">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500"><Svg d={icon} className="h-3.5 w-3.5" /> {label}</p>
                <p className="mt-2 text-2xl font-black tabular-nums">{loading ? '…' : value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card icon={ICONS.sparkles} title="Recent tests" subtitle="Average and top score per test">
              {!a || a.trend.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{loading ? 'Loading…' : 'No tests taken yet.'}</p> : (
                <ul className="space-y-3">
                  {[...a.trend].reverse().slice(0, 6).map(t => (
                    <li key={t.title + t.date} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.title}</p>
                        <p className="text-xs text-gray-500">{fmtDate(t.date)} · top {t.top}%</p>
                      </div>
                      <div className="flex w-40 items-center gap-2"><Bar value={t.average} /><span className={`w-10 text-right text-sm font-bold tabular-nums ${tone(t.average)}`}>{Math.round(t.average)}%</span></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card icon={ICONS.book} title="Accuracy by subject" subtitle="All attempts by this institute's students">
              {!a || a.subjectAccuracy.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{loading ? 'Loading…' : 'No answers yet.'}</p> : (
                <div className="space-y-3">
                  {a.subjectAccuracy.map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-28 truncate text-sm text-gray-300">{s.label}</span>
                      <Bar value={s.percent} />
                      <span className={`w-24 text-right text-xs tabular-nums ${tone(s.percent)}`}>{s.percent}% · {s.correct}/{s.total}</span>
                    </div>
                  ))}
                  {a.weakestConcepts.length > 0 && (
                    <div className="mt-4 border-t border-white/[0.06] pt-4">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Weakest topics</p>
                      <div className="flex flex-wrap gap-1.5">{a.weakestConcepts.map(c => <Chip key={c.label} tone="rose">{c.label} · {c.percent}%</Chip>)}</div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <Card icon={ICONS.check} title="Top students" subtitle="By average score" bodyClassName="p-0">
            {!a || a.students.filter(s => s.testsTaken > 0).length === 0 ? <p className="py-8 text-center text-sm text-gray-500">{loading ? 'Loading…' : 'No results yet.'}</p> : (
              <ul className="divide-y divide-white/[0.04]">
                {a.students.filter(s => s.testsTaken > 0).slice(0, 5).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-4 px-6 py-3">
                    <span className="w-6 text-sm font-black text-gray-500">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name} <span className="text-xs font-normal text-gray-500">{s.className || 'No class'}</span></span>
                    <span className="text-xs text-gray-500">{s.testsTaken} test{s.testsTaken === 1 ? '' : 's'}</span>
                    <span className={`w-12 text-right font-black tabular-nums ${tone(s.averageScore)}`}>{Math.round(s.averageScore)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'students' && (
        <div key="students" className="animate-rise-in">
          <StudentRoster instituteId={institute.id} analytics={a} loading={loading} onChanged={refresh} />
        </div>
      )}

      {tab === 'classes' && (
        <Card key="classes" icon={ICONS.book} title="Classes" subtitle="Students and performance per class" className="animate-rise-in" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                <tr><th className="px-6 py-3">Class</th><th className="px-6 py-3">Subjects</th><th className="px-6 py-3 text-right">Students</th><th className="px-6 py-3 text-right">Active</th><th className="px-6 py-3">Average</th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {classRows.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3 font-semibold">{c.name}</td>
                    <td className="px-6 py-3"><div className="flex flex-wrap gap-1">{c.subjects.length ? c.subjects.map(s => <Chip key={s}>{s}</Chip>) : <span className="text-xs text-gray-600">—</span>}</div></td>
                    <td className="px-6 py-3 text-right tabular-nums">{c.students}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-gray-400">{c.active}</td>
                    <td className="px-6 py-3">{c.average === null ? <span className="text-gray-600">—</span> : <div className="flex w-40 items-center gap-2"><Bar value={c.average} /><span className={`w-10 text-right text-sm font-bold tabular-nums ${tone(c.average)}`}>{Math.round(c.average)}%</span></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {classRows.length === 0 && <p className="py-12 text-center text-sm text-gray-500">{loading ? 'Loading…' : 'This institute has no classes yet.'}</p>}
          </div>
        </Card>
      )}

      {tab === 'tests' && (
        <Card key="tests" icon={ICONS.doc} title="Online tests" subtitle="Tests owned by or assigned to this institute" className="animate-rise-in" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                <tr><th className="px-6 py-3">Test</th><th className="px-6 py-3 text-right">Questions</th><th className="px-6 py-3 text-right">Attempts</th><th className="px-6 py-3">Participation</th><th className="px-6 py-3">Average</th><th className="px-6 py-3 text-right">Top / low</th><th className="px-6 py-3 text-right">Flagged</th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(a?.tests ?? []).map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3"><p className="font-semibold">{t.title}</p><p className="text-xs text-gray-500">{fmtDate(t.date)}</p></td>
                    <td className="px-6 py-3 text-right tabular-nums text-gray-400">{t.questionCount}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{t.attempts.length}</td>
                    <td className="px-6 py-3"><div className="flex w-32 items-center gap-2"><Bar value={t.participation} /><span className="w-10 text-right text-xs tabular-nums text-gray-400">{t.participation}%</span></div></td>
                    <td className={`px-6 py-3 font-bold tabular-nums ${t.attempts.length ? tone(t.averageScore) : 'text-gray-600'}`}>{t.attempts.length ? `${Math.round(t.averageScore)}%` : '—'}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-gray-400">{t.attempts.length ? `${t.topScore}% / ${t.lowestScore}%` : '—'}</td>
                    <td className="px-6 py-3 text-right">{t.flaggedCount ? <Chip tone="amber">{t.flaggedCount}</Chip> : <span className="text-gray-600">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(a?.tests ?? []).length === 0 && <p className="py-12 text-center text-sm text-gray-500">{loading ? 'Loading…' : 'No online tests for this institute yet.'}</p>}
          </div>
        </Card>
      )}
    </div>
  );
};

export default InstituteDetail;
