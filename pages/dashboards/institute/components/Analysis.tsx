import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, Legend } from 'recharts';
import { useAuth } from '../../../../contexts/AuthContext';
import { useInstituteAnalytics, InstituteStudentRow } from '../../../../hooks/useInstituteAnalytics';
import { Card, StatTile, EmptyNote, Skeleton, AccuracyBars, tooltipStyle, perfText, shortDate } from '../../../../components/analytics/AnalyticsUI';
import { UserGroupIcon, ClipboardDocumentListIcon, ChartPieIcon, ShieldCheckIcon, ChartBarIcon, AcademicCapIcon, SparklesIcon, TrophyIcon, InformationCircleIcon, ChevronUpIcon } from '../../../../components/icons';

const BAND_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#34D399', '#10B981'];

const StudentList: React.FC<{ rows: InstituteStudentRow[]; empty: string; metric: (s: InstituteStudentRow) => React.ReactNode }> = ({ rows, empty, metric }) =>
  rows.length === 0 ? <EmptyNote text={empty} /> : (
    <div className="divide-y divide-white/5 -my-2">
      {rows.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 py-3">
          <span className="w-6 text-xs font-black text-gray-600 text-right">{i + 1}</span>
          <div className="h-9 w-9 shrink-0 rounded-xl bg-atlas-primary/10 border border-atlas-primary/20 flex items-center justify-center text-sm font-black text-atlas-primary">{s.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{s.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{[s.className, s.rollNo && `Roll ${s.rollNo}`, `${s.testsTaken} test${s.testsTaken === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="shrink-0 text-right">{metric(s)}</div>
        </div>
      ))}
    </div>
  );

const Analysis: React.FC = () => {
  const { user } = useAuth()!;
  const { analytics: a, loading, error } = useInstituteAnalytics(user?.id);

  const header = (
    <div>
      <h2 className="text-3xl font-black text-white">Campus-Wide Analytics</h2>
      <p className="text-sm text-gray-500 mt-1">How every student and class is doing across all online tests.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !a) {
    return (
      <div className="space-y-6">
        {header}
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-4">{error || 'Analytics are unavailable right now.'}</p>
      </div>
    );
  }

  const tested = a.students.filter(s => s.testsTaken > 0);
  const notStarted = a.students.length - tested.length;
  const top = tested.slice(0, 5);
  const attention = tested.filter(s => s.averageScore < 60).sort((x, y) => x.averageScore - y.averageScore).slice(0, 5);
  const improved = tested.filter(s => (s.improvement ?? 0) > 0).sort((x, y) => (y.improvement ?? 0) - (x.improvement ?? 0)).slice(0, 5);
  const first = a.trend[0];
  const last = a.trend[a.trend.length - 1];
  const weakestSubject = a.subjectAccuracy.filter(s => s.total >= 20).sort((x, y) => x.percent - y.percent)[0];

  const insights: string[] = [];
  if (a.trend.length >= 2) insights.push(`Class average moved from ${first.average}% on “${first.title}” to ${last.average}% on “${last.title}”.`);
  if (weakestSubject) insights.push(`${weakestSubject.label} is the weakest subject campus-wide at ${weakestSubject.percent}% accuracy.`);
  if (a.weakestConcepts[0]) insights.push(`“${a.weakestConcepts[0].label}” is the concept students struggle with most (${a.weakestConcepts[0].percent}% accuracy).`);
  if (improved[0]) insights.push(`${improved[0].name} has improved the most — up ${improved[0].improvement} points since their first test.`);
  if (notStarted > 0) insights.push(`${notStarted} enrolled student${notStarted === 1 ? " hasn't" : "s haven't"} attempted any test yet.`);
  if (a.flaggedAttempts > 0) insights.push(`${a.flaggedAttempts} attempt${a.flaggedAttempts === 1 ? ' was' : 's were'} flagged by proctoring for tab switches or leaving fullscreen.`);

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <StatTile icon={<UserGroupIcon className="h-4 w-4" />} label="Students" value={String(a.studentCount)} hint={`Across ${a.classCount} class${a.classCount === 1 ? '' : 'es'}`} />
        <StatTile icon={<ClipboardDocumentListIcon className="h-4 w-4" />} label="Tests completed" value={String(a.testsWithAttempts)} hint={`${a.totalAttempts} student attempts`} />
        <StatTile icon={<ChartPieIcon className="h-4 w-4" />} label="Campus average" value={a.totalAttempts ? `${a.campusAverage}%` : '—'} valueClass={a.totalAttempts ? perfText(a.campusAverage) : ''} hint="Mean score across all attempts" />
        <StatTile icon={<ShieldCheckIcon className="h-4 w-4" />} label="Flagged attempts" value={String(a.flaggedAttempts)} valueClass={a.flaggedAttempts ? 'text-amber-400' : ''} hint="Proctoring violations" />
      </div>

      {a.totalAttempts === 0 ? (
        <div className="p-16 rounded-[1.75rem] bg-atlas-dark border border-dashed border-white/10 text-center">
          <ChartBarIcon className="h-10 w-10 text-gray-700 mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-300">No test results yet</p>
          <p className="text-xs text-gray-500 mt-2">Analytics appear as soon as your students complete their first assigned online test.</p>
        </div>
      ) : (
        <>
          {insights.length > 0 && (
            <Card title="Key insights" caption="Computed from your students' real results." icon={<SparklesIcon className="h-5 w-5" />}>
              <ul className="space-y-3">
                {insights.map(text => (
                  <li key={text} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-atlas-primary shrink-0" />{text}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Performance over time" caption="Class average and top score on every test, oldest to newest." icon={<ChartBarIcon className="h-5 w-5" />}>
            {a.trend.length >= 2 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#10B981', fontWeight: 800 }}
                      labelFormatter={(_l: any, p: any) => p?.[0]?.payload.title || ''} formatter={(v: any, n: any) => [`${v}%`, n]} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Line type="monotone" name="Class average" dataKey="average" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} animationDuration={1100} />
                    <Line type="monotone" name="Top score" dataKey="top" stroke="#6EE7B7" strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={1100} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyNote text="The trend line appears once your students have completed two tests." />}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Score distribution" caption="How many attempts fall in each score band." icon={<ChartPieIcon className="h-5 w-5" />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis dataKey="band" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={b => `${b}%`} />
                    <YAxis allowDecimals={false} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(v: any) => [v, 'Attempts']} labelFormatter={(l: any) => `${l}%`} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={900}>
                      {a.distribution.map((_, i) => <Cell key={i} fill={BAND_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Subject accuracy" caption="Share of questions answered correctly, per subject." icon={<AcademicCapIcon className="h-5 w-5" />}>
              <AccuracyBars data={a.subjectAccuracy} emptyText="No subject data yet." />
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Top performers" caption="Highest average score across all tests taken." icon={<TrophyIcon className="h-5 w-5" />}>
              <StudentList rows={top} empty="No results yet." metric={s => <p className={`text-lg font-black ${perfText(s.averageScore)}`}>{s.averageScore}%</p>} />
            </Card>
            <Card title="Needs attention" caption="Students averaging below 60% — a good place to focus support." icon={<InformationCircleIcon className="h-5 w-5" />}>
              <StudentList rows={attention} empty="Every student is averaging 60% or above." metric={s => <p className={`text-lg font-black ${perfText(s.averageScore)}`}>{s.averageScore}%</p>} />
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Most improved" caption="Biggest gain from a student's first test to their latest." icon={<ChevronUpIcon className="h-5 w-5" />}>
              <StudentList rows={improved} empty="Improvement shows once students have taken at least two tests." metric={s => (
                <p className="text-sm font-black text-emerald-400 whitespace-nowrap">+{s.improvement} pts<span className="block text-[11px] font-semibold text-gray-500">{s.firstScore}% → {s.latestScore}%</span></p>
              )} />
            </Card>
            <Card title="Weakest concepts" caption="Concepts with the lowest accuracy (at least 10 answers)." icon={<SparklesIcon className="h-5 w-5" />}>
              <AccuracyBars data={a.weakestConcepts} emptyText="Not enough answers per concept yet." />
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Analysis;
