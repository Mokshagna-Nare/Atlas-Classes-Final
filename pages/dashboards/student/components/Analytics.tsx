import React, { useMemo, useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  ReferenceLine
} from 'recharts';
import { useAuth } from '../../../../contexts/AuthContext';
import { useStudentResults, computeAnalytics, StudentResult, StudentAnalytics, BucketStat } from '../../../../hooks/useStudentResults';
import {
  SparklesIcon, InformationCircleIcon, ChartBarIcon, TrophyIcon, ClipboardCheckIcon,
  ShieldCheckIcon, AcademicCapIcon, MagnifyingGlassIcon, SignalIcon
} from '../../../../components/icons';

import { tooltipStyle, perfColor, perfText, shortDate, percentileOf, topPercentOf, Card, StatTile, DeltaChip, EmptyNote, Skeleton, AccuracyBars } from '../../../../components/analytics/AnalyticsUI';


const ConceptRow: React.FC<{ stat: BucketStat; tone: 'good' | 'bad' }> = ({ stat, tone }) => (
  <div>
    <div className="flex items-center justify-between gap-3 mb-1.5">
      <p className="text-sm font-semibold text-gray-200 truncate">{stat.label}</p>
      <p className={`text-sm font-black shrink-0 ${tone === 'good' ? 'text-emerald-400' : perfText(stat.percent)}`}>{stat.percent}%</p>
    </div>
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stat.percent}%`, backgroundColor: tone === 'good' ? '#10B981' : perfColor(stat.percent) }} />
    </div>
    <p className="text-[11px] text-gray-600 mt-1">{stat.correct} of {stat.total} questions correct</p>
  </div>
);

const ConceptTable: React.FC<{ data: BucketStat[] }> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'weakest' | 'strongest' | 'most'>('weakest');
  const rows = useMemo(() => {
    const filtered = data.filter(d => d.label.toLowerCase().includes(query.toLowerCase()));
    if (sortBy === 'weakest') return filtered.sort((a, b) => a.percent - b.percent || b.total - a.total);
    if (sortBy === 'strongest') return filtered.sort((a, b) => b.percent - a.percent || b.total - a.total);
    return filtered.sort((a, b) => b.total - a.total);
  }, [data, query, sortBy]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a concept..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-atlas-black/60 border border-white/5 text-sm text-white outline-none focus:border-atlas-primary/50 transition-colors" />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-atlas-black/60 border border-white/5">
          {(['weakest', 'strongest', 'most'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${sortBy === s ? 'bg-atlas-primary/15 text-atlas-primary' : 'text-gray-500 hover:text-white'}`}>
              {s === 'most' ? 'Most practiced' : s}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 divide-y divide-white/5">
        {rows.length === 0 ? <p className="p-6 text-center text-xs text-gray-500">No concept matches "{query}".</p> : rows.map(r => (
          <div key={r.label} className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
            <p className="flex-1 min-w-0 text-sm text-gray-200 truncate">{r.label}</p>
            <div className="hidden sm:block w-32 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${r.percent}%`, backgroundColor: perfColor(r.percent) }} />
            </div>
            <p className="w-20 text-right text-xs text-gray-500">{r.correct}/{r.total}</p>
            <p className={`w-12 text-right text-sm font-black ${perfText(r.percent)}`}>{r.percent}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard', 'Unspecified'];

// Untagged questions aren't a skill — chart only the tagged ones and say how many were left out.
const SkillBreakdown: React.FC<{ data: BucketStat[]; scope: string }> = ({ data, scope }) => {
  const tagged = data.filter(s => s.label !== 'Unclassified');
  const untagged = data.find(s => s.label === 'Unclassified')?.total || 0;
  if (tagged.length === 0) return <EmptyNote text={`Questions in ${scope} haven't been tagged with a thinking skill yet, so this breakdown isn't available.`} />;
  return (
    <div>
      <AccuracyBars data={tagged} emptyText="" />
      {untagged > 0 && <p className="text-[11px] text-gray-600 mt-2">{untagged} question{untagged === 1 ? '' : 's'} in {scope} {untagged === 1 ? "isn't" : "aren't"} tagged with a skill and {untagged === 1 ? 'is' : 'are'} not shown.</p>}
    </div>
  );
};

// ─── Overall (also reused for any date range) ────────────────────────────────

const OverallView: React.FC<{ results: StudentResult[]; analytics: StudentAnalytics }> = ({ results, analytics }) => {
  const { overall, growthSeries, latestVsPrevious, subjectWise, topicWise, difficultyWise, skillWise, rankHistory, integrity } = analytics;
  const hasTrend = growthSeries.length >= 2;
  const first = growthSeries[0];
  const last = growthSeries[growthSeries.length - 1];
  const growth = hasTrend ? last.score - first.score : 0;

  const pieData = [
    { name: 'Correct', value: overall.totalCorrect, color: '#10B981' },
    { name: 'Wrong', value: overall.totalWrong, color: '#EF4444' },
    { name: 'Skipped', value: overall.totalUnattempted, color: '#374151' },
  ].filter(p => p.value > 0);
  const totalQs = overall.totalCorrect + overall.totalWrong + overall.totalUnattempted;
  const showRadar = subjectWise.filter(s => s.total >= 10).length >= 3;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <StatTile icon={<SignalIcon className="h-4 w-4" />} label="Average score" value={`${overall.averageScore}%`} valueClass={perfText(overall.averageScore)} hint={`Across ${overall.totalTests} test${overall.totalTests === 1 ? '' : 's'}`} />
        <StatTile icon={<TrophyIcon className="h-4 w-4" />} label="Best score" value={`${overall.bestScore}%`} hint={`Lowest ${overall.worstScore}%`} />
        <StatTile icon={<ClipboardCheckIcon className="h-4 w-4" />} label="Accuracy" value={`${overall.accuracyPercent}%`} hint="Of the questions you answered" />
        <StatTile icon={<ChartBarIcon className="h-4 w-4" />} label="Overall growth" value={hasTrend ? `${growth > 0 ? '+' : ''}${growth} pts` : '—'} valueClass={hasTrend ? (growth >= 0 ? 'text-emerald-400' : 'text-red-400') : ''} hint={hasTrend ? 'First test → latest test' : 'Needs 2+ tests'} />
      </div>

      {latestVsPrevious ? (
        <Card title="Latest vs previous test" icon={<SparklesIcon className="h-5 w-5" />}
          caption={latestVsPrevious.sameFormat
            ? `Your latest test compared with your previous ${latestVsPrevious.format.join(' · ')} test, so the comparison is like for like.`
            : 'How your most recent test compares to the one before it. They cover different subjects, so read the change with that in mind.'}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-2xl bg-atlas-black/50 border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Score</p>
              <div className="flex items-center gap-3"><span className="text-3xl font-black text-white">{latestVsPrevious.latest.score}%</span><DeltaChip value={latestVsPrevious.scoreDelta} suffix=" pts" /></div>
              <p className="text-xs text-gray-600 mt-2">Previously {latestVsPrevious.previous.score}%</p>
            </div>
            <div className="p-5 rounded-2xl bg-atlas-black/50 border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Class rank</p>
              <div className="flex items-center gap-3"><span className="text-3xl font-black text-white">#{latestVsPrevious.latest.rank}</span><DeltaChip value={latestVsPrevious.rankDelta} suffix={Math.abs(latestVsPrevious.rankDelta) === 1 ? ' place' : ' places'} /></div>
              <p className="text-xs text-gray-600 mt-2">Previously #{latestVsPrevious.previous.rank} of {latestVsPrevious.previous.totalStudents}</p>
            </div>
            <div className="p-5 rounded-2xl bg-atlas-black/50 border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Compared</p>
              <p className="text-sm font-bold text-white truncate">{latestVsPrevious.previous.title}</p>
              <p className="text-xs text-gray-500 truncate mt-1">→ {latestVsPrevious.latest.title}</p>
            </div>
          </div>
          {Object.keys(latestVsPrevious.subjectDeltas).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(latestVsPrevious.subjectDeltas).map(([sub, d]) => (
                <span key={sub} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-atlas-black/50 border border-white/5 text-xs font-bold text-gray-300">{sub} <DeltaChip value={d} suffix="%" /></span>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <EmptyNote text="Take one more test in this period to unlock the latest-vs-previous comparison." />
      )}

      <Card title="Growth journey" caption="Your score on every test, oldest to newest. An upward line means you're improving." icon={<ChartBarIcon className="h-5 w-5" />}
        action={hasTrend ? <DeltaChip value={growth} suffix=" pts overall" /> : undefined}>
        {hasTrend ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <ReferenceLine y={overall.averageScore} stroke="#6B7280" strokeDasharray="4 4" label={{ value: `Avg ${overall.averageScore}%`, fill: '#6B7280', fontSize: 10, position: 'insideTopRight' }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#10B981', fontWeight: 800 }}
                  labelFormatter={(_l: any, p: any) => p?.[0] ? `${p[0].payload.title} · ${shortDate(p[0].payload.date)}` : ''} formatter={(v: any) => [`${v}%`, 'Score']} />
                <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} fill="url(#growthFill)" dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 6 }} animationDuration={1100} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyNote text="Your growth line appears once you've taken at least two tests." />}
      </Card>

      <Card title="Class rank over time" caption="Your position in class on each test. Higher on this chart is better — #1 is at the top." icon={<TrophyIcon className="h-5 w-5" />}>
        {rankHistory.length >= 2 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rankHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} reversed allowDecimals={false} domain={[1, 'dataMax']} tickFormatter={v => `#${v}`} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#10B981', fontWeight: 800 }}
                  labelFormatter={(_l: any, p: any) => p?.[0]?.payload.title || ''}
                  formatter={(v: any, _n: any, p: any) => [`#${v} of ${p.payload.totalStudents} · top ${topPercentOf(v, p.payload.totalStudents)}%`, 'Rank']} />
                <Line type="monotone" dataKey="rank" stroke="#34D399" strokeWidth={3} dot={{ r: 4, fill: '#34D399', strokeWidth: 0 }} activeDot={{ r: 6 }} animationDuration={1100} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyNote text="Rank history appears once you've taken at least two tests." />}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Subject strength" icon={<AcademicCapIcon className="h-5 w-5" />}
          caption={showRadar ? 'Accuracy per subject. The further out the shape reaches, the stronger you are.' : 'Accuracy per subject, with how many questions each is based on.'}>
          {showRadar ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={subjectWise.map(s => ({ subject: s.label, value: s.percent }))}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#10B981" fill="#10B981" fillOpacity={0.35} animationDuration={1000} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(v: any) => [`${v}%`, 'Accuracy']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // A radar only means something with 3+ well-sampled subjects; otherwise bars with counts are honest.
            <AccuracyBars data={subjectWise} emptyText="No subject data yet." />
          )}
        </Card>

        <Card title="Answer breakdown" caption="Every question you've faced, split by outcome." icon={<ClipboardCheckIcon className="h-5 w-5" />}>
          {totalQs > 0 ? (
            <div className="relative h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={104} paddingAngle={4} dataKey="value" stroke="none" animationDuration={900}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff', fontWeight: 700 }} formatter={(v: any, n: any) => [`${v} (${Math.round((v / totalQs) * 100)}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-black text-white">{totalQs}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Questions</p>
              </div>
              <div className="flex justify-center gap-5 -mt-2">
                {pieData.map(p => (
                  <span key={p.name} className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name} · {p.value}</span>
                ))}
              </div>
            </div>
          ) : <EmptyNote text="No answered questions yet." />}
        </Card>
      </div>

      <Card title="Concept mastery" caption="Tests cover different concepts, so this combines every concept you've been tested on. Concepts with fewer than 2 questions are left out of the call-outs." icon={<SparklesIcon className="h-5 w-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4">Your strongest concepts</p>
            <div className="space-y-4">{topicWise.strongest.length ? topicWise.strongest.map(s => <ConceptRow key={s.label} stat={s} tone="good" />) : <p className="text-xs text-gray-500">Not enough data yet.</p>}</div>
          </div>
          <div className="p-5 rounded-2xl bg-red-500/[0.04] border border-red-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-4">Needs attention</p>
            <div className="space-y-4">{topicWise.weakest.length ? topicWise.weakest.map(s => <ConceptRow key={s.label} stat={s} tone="bad" />) : <p className="text-xs text-gray-500">Not enough data yet.</p>}</div>
          </div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">All concepts ({topicWise.all.length})</p>
        <ConceptTable data={topicWise.all} />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="By difficulty" caption="How you perform on easy, medium, and hard questions." icon={<ChartBarIcon className="h-5 w-5" />}>
          <AccuracyBars data={difficultyWise} order={DIFFICULTY_ORDER} emptyText="No difficulty data yet." />
        </Card>
        <Card title="By thinking skill" caption="Knowledge = recall · Understanding = explain · Application = use it · Analytical = reason through it." icon={<TrophyIcon className="h-5 w-5" />}>
          <SkillBreakdown data={skillWise} scope="these tests" />
        </Card>
      </div>

      <Card title="Test-by-test summary" caption="Percentile = the share of your class you scored at or above." icon={<ClipboardCheckIcon className="h-5 w-5" />}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                <th className="px-2 pb-3">Test</th><th className="px-2 pb-3 text-center">Score</th><th className="px-2 pb-3 text-center">Rank</th><th className="px-2 pb-3 text-right">Percentile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map(r => {
                const pct = percentileOf(r.rank, r.totalStudents);
                return (
                  <tr key={r.attemptId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-2 py-4">
                      <p className="text-sm font-bold text-white">{r.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{shortDate(r.date)} · {r.primarySubject}{r.flagged ? ' · flagged' : ''}</p>
                    </td>
                    <td className={`px-2 py-4 text-center text-lg font-black ${perfText(r.score)}`}>{r.score}%</td>
                    <td className="px-2 py-4 text-center text-sm font-bold text-gray-300 whitespace-nowrap">#{r.rank}<span className="text-gray-600"> / {r.totalStudents}</span></td>
                    <td className="px-2 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-atlas-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="w-10 text-right text-sm font-black text-white">{pct}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-atlas-dark border border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-atlas-primary/10 text-atlas-primary"><ShieldCheckIcon className="h-5 w-5" /></div>
          <div><p className="font-black text-white">Test integrity</p><p className="text-xs text-gray-500">Proctoring events recorded during these tests</p></div>
        </div>
        <div className="flex gap-8">
          {[['Flagged', integrity.flaggedCount, integrity.flaggedCount > 0], ['Tab switches', integrity.totalTabSwitches, false], ['Fullscreen exits', integrity.totalFullscreenExits, false]].map(([label, val, warn]) => (
            <div key={label as string} className="text-center">
              <p className={`text-2xl font-black ${warn ? 'text-amber-400' : 'text-white'}`}>{val as number}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">{label as string}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Test-wise ────────────────────────────────────────────────────────────────

const TestWiseView: React.FC<{ results: StudentResult[] }> = ({ results }) => {
  const [selectedId, setSelectedId] = useState(results[0]?.attemptId);
  const chronological = useMemo(() => results.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [results]);
  const test = results.find(r => r.attemptId === selectedId) || results[0];
  const idx = chronological.findIndex(r => r.attemptId === test.attemptId);
  const previous = idx > 0 ? chronological[idx - 1] : null;
  const answered = test.correctCount + test.wrongCount;
  const accuracy = answered > 0 ? Math.round((test.correctCount / answered) * 100) : 0;
  const subjectStats: BucketStat[] = Object.entries(test.subjectBreakdown).map(([label, v]) => ({ label, correct: v.score, total: v.maxScore, percent: v.maxScore ? Math.round((v.score / v.maxScore) * 100) : 0 }));
  const outcome = [
    { name: 'Correct', value: test.correctCount, color: '#10B981' },
    { name: 'Wrong', value: test.wrongCount, color: '#EF4444' },
    { name: 'Skipped', value: test.unattemptedCount, color: '#374151' },
  ].filter(o => o.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {results.map(r => {
          const active = r.attemptId === test.attemptId;
          return (
            <button key={r.attemptId} onClick={() => setSelectedId(r.attemptId)}
              className={`snap-start shrink-0 w-52 text-left p-4 rounded-2xl border transition-all duration-300 ${active ? 'bg-atlas-primary/10 border-atlas-primary/40 shadow-[0_0_30px_-12px_rgba(16,185,129,0.6)]' : 'bg-atlas-dark border-white/5 hover:border-white/15'}`}>
              <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-gray-300'}`}>{r.title}</p>
              <div className="flex items-end justify-between mt-3">
                <p className="text-[11px] text-gray-500">{shortDate(r.date)}</p>
                <p className={`text-xl font-black ${perfText(r.score)}`}>{r.score}%</p>
              </div>
            </button>
          );
        })}
      </div>

      <div key={test.attemptId} className="space-y-6 animate-view-in">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-gradient-to-br from-atlas-dark to-atlas-primary/[0.06] p-6 sm:p-8">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-atlas-primary mb-2">{new Date(test.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{test.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-xs font-bold text-gray-300">{test.questions.length} questions</span>
                <span className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-xs font-bold text-gray-300">{test.primarySubject}</span>
                {test.topicBreakdown.filter(t => t.label !== 'Uncategorized').slice(0, 4).map(t => (
                  <span key={t.label} className="px-3 py-1 rounded-lg bg-atlas-primary/[0.06] border border-atlas-primary/15 text-xs font-semibold text-emerald-200/80">{t.label}</span>
                ))}
                {test.flagged && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400"><ShieldCheckIcon className="h-3.5 w-3.5" /> Flagged by proctoring</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
              {[
                ['Score', `${test.score}%`, perfText(test.score), previous ? <DeltaChip key="d" value={test.score - previous.score} suffix=" pts" /> : null],
                ['Class rank', `#${test.rank}`, 'text-white', <span key="r" className="text-[11px] text-gray-500">of {test.totalStudents}</span>],
                ['Standing', `Top ${topPercentOf(test.rank, test.totalStudents)}%`, 'text-white', <span key="p" className="text-[11px] text-gray-500">of your class</span>],
              ].map(([label, value, cls, sub]) => (
                <div key={label as string} className="p-4 rounded-2xl bg-atlas-black/50 border border-white/5 text-center min-w-[92px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label as string}</p>
                  <p className={`text-2xl font-black mt-1 whitespace-nowrap ${cls as string}`}>{value as string}</p>
                  <div className="mt-1 flex justify-center">{sub as React.ReactNode}</div>
                </div>
              ))}
            </div>
          </div>
          {!previous && <p className="text-xs text-gray-500 mt-4">This was your first test, so there's nothing earlier to compare it with.</p>}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Answer breakdown" caption={`${accuracy}% of the questions you answered were correct.`} icon={<ClipboardCheckIcon className="h-5 w-5" />}>
            <div className="relative h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outcome} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none" animationDuration={800}>
                    {outcome.map((o, i) => <Cell key={i} fill={o.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff', fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-black text-white">{test.correctCount}<span className="text-lg text-gray-500">/{test.questions.length}</span></p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Correct</p>
              </div>
            </div>
            <div className="flex justify-center gap-5 mt-2">
              {outcome.map(o => <span key={o.name} className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />{o.name} · {o.value}</span>)}
            </div>
          </Card>
          <Card title="By subject" caption="Accuracy per subject in this test only." icon={<AcademicCapIcon className="h-5 w-5" />}>
            <AccuracyBars data={subjectStats} emptyText="No subject data for this test." />
          </Card>
        </div>

        <Card title="Concepts in this test" caption="Every concept this test covered, and how you did on each." icon={<SparklesIcon className="h-5 w-5" />}>
          <AccuracyBars data={test.topicBreakdown} emptyText="Questions in this test weren't tagged with concepts." />
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="By difficulty" icon={<ChartBarIcon className="h-5 w-5" />}>
            <AccuracyBars data={test.difficultyBreakdown} order={DIFFICULTY_ORDER} emptyText="No difficulty data for this test." />
          </Card>
          <Card title="By thinking skill" icon={<TrophyIcon className="h-5 w-5" />}>
            <SkillBreakdown data={test.skillBreakdown} scope="this test" />
          </Card>
        </div>

        {(test.tabSwitchCount > 0 || test.fullscreenExitCount > 0) && (
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20">
            <ShieldCheckIcon className="h-5 w-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-100/80">During this test, {test.tabSwitchCount} tab switch{test.tabSwitchCount === 1 ? '' : 'es'} and {test.fullscreenExitCount} fullscreen exit{test.fullscreenExitCount === 1 ? '' : 's'} were recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Date range ───────────────────────────────────────────────────────────────

const toInputDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
// "YYYY-MM-DD" alone parses as UTC midnight; anchor it to local midnight so the label never shifts a day.
const fmtLocal = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const DateRangeView: React.FC<{ results: StudentResult[] }> = ({ results }) => {
  const dates = results.map(r => new Date(r.date).getTime());
  const earliest = new Date(Math.min(...dates));
  const today = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(toInputDate(today));
  const [preset, setPreset] = useState<string>('30d');

  const presets: { id: string; label: string; days: number | null }[] = [
    { id: '7d', label: 'Last 7 days', days: 7 },
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 3 months', days: 90 },
    { id: 'all', label: 'All time', days: null },
  ];

  const applyPreset = (p: typeof presets[number]) => {
    setPreset(p.id);
    setTo(toInputDate(today));
    setFrom(toInputDate(p.days === null ? earliest : new Date(today.getTime() - p.days * 86400000)));
  };

  const inRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59`).getTime();
    return results.filter(r => { const t = new Date(r.date).getTime(); return t >= start && t <= end; });
  }, [results, from, to]);

  const rangeAnalytics = useMemo(() => computeAnalytics(inRange), [inRange]);
  const invalid = from > to;

  return (
    <div className="space-y-6">
      <section className="bg-atlas-dark rounded-[1.75rem] border border-white/5 p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-end gap-5">
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.id} onClick={() => applyPreset(p)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${preset === p.id ? 'bg-atlas-primary text-atlas-black shadow-[0_0_24px_-8px_rgba(16,185,129,0.8)]' : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:text-white hover:border-white/15'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col sm:flex-row gap-3 xl:justify-end">
            <label className="flex-1 sm:flex-none">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1.5">From</span>
              <input type="date" value={from} max={to} onChange={e => { setFrom(e.target.value); setPreset('custom'); }}
                className="w-full px-4 py-2.5 rounded-xl bg-atlas-black/60 border border-white/10 text-sm text-white outline-none focus:border-atlas-primary/50 [color-scheme:dark]" />
            </label>
            <label className="flex-1 sm:flex-none">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1.5">To</span>
              <input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setPreset('custom'); }}
                className="w-full px-4 py-2.5 rounded-xl bg-atlas-black/60 border border-white/10 text-sm text-white outline-none focus:border-atlas-primary/50 [color-scheme:dark]" />
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          {invalid ? 'The start date must be before the end date.' : `Showing ${inRange.length} of ${results.length} tests between ${fmtLocal(from)} and ${fmtLocal(to)}.`}
        </p>
      </section>

      <div key={`${from}-${to}`} className="animate-view-in">
        {!invalid && rangeAnalytics ? (
          <OverallView results={inRange} analytics={rangeAnalytics} />
        ) : (
          <div className="p-16 rounded-[1.75rem] bg-atlas-dark border border-dashed border-white/10 text-center">
            <InformationCircleIcon className="h-10 w-10 text-gray-700 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-300">No tests in this period</p>
            <p className="text-xs text-gray-500 mt-2">Try a wider range, or pick "All time".</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = 'overall' | 'test' | 'range';
const MODES: { id: Mode; label: string; description: string }[] = [
  { id: 'overall', label: 'Overall', description: 'Everything, all tests combined' },
  { id: 'test', label: 'Test-wise', description: 'Deep-dive into one test' },
  { id: 'range', label: 'Date range', description: 'Any period you choose' },
];

const Analytics: React.FC = () => {
  const { user } = useAuth()!;
  const { results, loading, analytics } = useStudentResults(user?.id);
  const [mode, setMode] = useState<Mode>('overall');
  const modeIndex = MODES.findIndex(m => m.id === mode);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="py-24 text-center flex flex-col items-center">
        <div className="p-8 rounded-full bg-atlas-dark border border-white/5 mb-8"><ChartBarIcon className="h-14 w-14 text-gray-700" /></div>
        <p className="text-lg font-black text-white">Your analytics will appear here</p>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">Complete your first assigned test and we'll start charting your scores, concepts, and class rank.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="relative grid grid-cols-3 p-1.5 rounded-2xl bg-atlas-dark border border-white/5">
        <span className="absolute top-1.5 bottom-1.5 left-1.5 rounded-xl bg-atlas-primary/15 border border-atlas-primary/30 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: 'calc((100% - 0.75rem) / 3)', transform: `translateX(${modeIndex * 100}%)` }} />
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id} aria-label={`${m.label}: ${m.description}`}
            className="relative z-10 px-2 py-3 rounded-xl text-center transition-colors">
            <span className={`block text-sm font-black ${mode === m.id ? 'text-white' : 'text-gray-500'}`}>{m.label}</span>
            <span className={`hidden sm:block text-[11px] mt-0.5 ${mode === m.id ? 'text-atlas-primary' : 'text-gray-600'}`}>{m.description}</span>
          </button>
        ))}
      </div>

      <div key={mode} className="animate-view-in">
        {mode === 'overall' && <OverallView results={results} analytics={analytics} />}
        {mode === 'test' && <TestWiseView results={results} />}
        {mode === 'range' && <DateRangeView results={results} />}
      </div>
    </div>
  );
};

export default Analytics;
