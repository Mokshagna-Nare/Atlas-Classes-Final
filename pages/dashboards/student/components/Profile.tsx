import React, { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { useAuth } from '../../../../contexts/AuthContext';
import { useStudentResults } from '../../../../hooks/useStudentResults';
import { supabase } from '../../../../services/supabase';
import {
    TrophyIcon, SignalIcon, IdentificationIcon, AcademicCapIcon, ShieldCheckIcon,
    ClipboardCheckIcon, ChartPieIcon, DocumentTextIcon, ArrowRightIcon, ChevronUpIcon
} from '../../../../components/icons';
import type { DashboardView } from '../StudentDashboard';

const scoreColor = (p: number) => (p >= 85 ? 'text-emerald-400' : p >= 65 ? 'text-atlas-primary' : p >= 45 ? 'text-yellow-400' : 'text-red-400');

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`rounded-2xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.07)_50%,rgba(255,255,255,0.03)_100%)] bg-[length:800px_100%] animate-shimmer ${className}`} />
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; subtext?: string; valueClass?: string }> = ({ icon, label, value, subtext, valueClass }) => (
    <div className="group bg-atlas-dark p-5 sm:p-6 rounded-3xl border border-white/5 hover:border-atlas-primary/30 hover:-translate-y-0.5 transition-all duration-300 min-w-0">
        <div className="flex items-center gap-2.5 mb-4 min-w-0">
            <div className="p-2 rounded-xl bg-atlas-primary/10 text-atlas-primary shrink-0 group-hover:scale-110 transition-transform">{icon}</div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 truncate">{label}</p>
        </div>
        <p className={`text-3xl sm:text-4xl font-black tracking-tight ${valueClass || 'text-white'}`}>{value}</p>
        {subtext && <p className="text-gray-500 text-xs mt-2 truncate" title={subtext}>{subtext}</p>}
    </div>
);

const QuickAction: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void }> = ({ icon, title, description, onClick }) => (
    <button onClick={onClick} className="group text-left bg-atlas-dark p-6 rounded-3xl border border-white/5 hover:border-atlas-primary/40 hover:bg-atlas-primary/[0.03] transition-all duration-300">
        <div className="flex items-start justify-between mb-6">
            <div className="p-3 rounded-2xl bg-atlas-primary/10 text-atlas-primary">{icon}</div>
            <ArrowRightIcon className="h-5 w-5 text-gray-600 group-hover:text-atlas-primary group-hover:translate-x-1 transition-all" />
        </div>
        <p className="font-black text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
);

const Profile: React.FC<{ onNavigate?: (view: DashboardView) => void }> = ({ onNavigate }) => {
    const { user } = useAuth()!;
    const { results, loading, analytics } = useStudentResults(user?.id);
    const [className, setClassName] = useState<string | null>(null);

    useEffect(() => {
        const fetchClass = async () => {
            if (!user?.class_id) { setClassName(null); return; }
            const { data } = await supabase.from('classes').select('name').eq('id', user.class_id).maybeSingle();
            setClassName(data?.name || null);
        };
        fetchClass();
    }, [user?.class_id]);

    const latest = results[0] || null;
    const delta = analytics?.latestVsPrevious?.scoreDelta ?? null;
    const go = (view: DashboardView) => onNavigate?.(view);

    return (
        <div className="space-y-8">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-br from-atlas-dark via-atlas-dark to-atlas-primary/[0.08] p-8">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-atlas-primary/10 blur-3xl" />
                <div className="relative grid grid-cols-1 xl:grid-cols-5 gap-8 items-center">
                    <div className="xl:col-span-2 flex items-center gap-5 min-w-0">
                        <div className="h-20 w-20 shrink-0 rounded-3xl bg-gradient-to-br from-emerald-300 to-atlas-primary flex items-center justify-center shadow-[0_0_40px_-8px_rgba(16,185,129,0.6)]">
                            <span className="text-atlas-black font-black text-3xl">{user?.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Welcome back</p>
                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight break-words">{user?.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                {className && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-xs font-bold text-gray-300 whitespace-nowrap">
                                        <AcademicCapIcon className="h-3.5 w-3.5 text-atlas-primary" /> {className}
                                    </span>
                                )}
                                {user?.roll_no && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-xs font-bold text-gray-300 whitespace-nowrap">
                                        <IdentificationIcon className="h-3.5 w-3.5 text-atlas-primary" /> Roll {user.roll_no}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-3 rounded-3xl bg-atlas-black/40 border border-white/5 p-6">
                        <div className="flex items-end justify-between mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Score trend</p>
                                <p className="text-sm text-gray-400 mt-1">{analytics ? `${analytics.overall.totalTests} tests so far` : 'No tests yet'}</p>
                            </div>
                            {latest && (
                                <div className="text-right">
                                    <p className={`text-3xl font-black ${scoreColor(latest.score)}`}>{latest.score}%</p>
                                    {delta !== null && delta !== 0 && (
                                        <p className={`inline-flex items-center gap-1 text-xs font-bold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            <ChevronUpIcon className={`h-3 w-3 ${delta > 0 ? '' : 'rotate-180'}`} />
                                            {Math.abs(delta)} pts vs previous
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="h-24">
                            {loading ? <Skeleton className="h-full w-full" /> : analytics && analytics.growthSeries.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.growthSeries} margin={{ top: 8, bottom: 0, left: 0, right: 0 }}>
                                        <defs>
                                            <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <YAxis hide domain={[0, 100]} />
                                        <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} fill="url(#heroSpark)" isAnimationActive />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-gray-600">Your trend line appears after two tests.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)
                ) : (
                    <>
                        <StatCard icon={<SignalIcon className="h-5 w-5" />} label="Average Score" value={analytics ? `${analytics.overall.averageScore}%` : '—'} valueClass={analytics ? scoreColor(analytics.overall.averageScore) : ''} subtext={analytics ? `Best ${analytics.overall.bestScore}%` : 'Take a test to begin'} />
                        <StatCard icon={<TrophyIcon className="h-5 w-5" />} label="Latest Rank" value={latest ? `#${latest.rank}` : '—'} subtext={latest ? `of ${latest.totalStudents} · ${latest.title}` : 'No tests yet'} />
                        <StatCard icon={<ClipboardCheckIcon className="h-5 w-5" />} label="Accuracy" value={analytics ? `${analytics.overall.accuracyPercent}%` : '—'} subtext={analytics ? `${analytics.overall.totalCorrect} correct answers` : ''} />
                        <StatCard icon={<ShieldCheckIcon className="h-5 w-5" />} label="Integrity" value={analytics ? String(analytics.integrity.flaggedCount) : '0'} valueClass={analytics && analytics.integrity.flaggedCount > 0 ? 'text-amber-400' : 'text-white'} subtext={analytics && analytics.integrity.flaggedCount > 0 ? 'Attempts flagged for review' : 'Clean record'} />
                    </>
                )}
            </section>

            {/* Quick actions */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <QuickAction icon={<ClipboardCheckIcon className="h-6 w-6" />} title="Take a test" description="See what's assigned to your class" onClick={() => go('tests')} />
                <QuickAction icon={<DocumentTextIcon className="h-6 w-6" />} title="Review results" description="Question-by-question breakdowns" onClick={() => go('results')} />
                <QuickAction icon={<ChartPieIcon className="h-6 w-6" />} title="Open analytics" description="Subjects, concepts, rank & growth" onClick={() => go('analytics')} />
            </section>

            {/* Recent activity */}
            <section className="bg-atlas-dark border border-white/5 rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-black text-white">Recent activity</h3>
                    {results.length > 0 && (
                        <button onClick={() => go('results')} className="text-xs font-bold text-atlas-primary hover:text-emerald-300 transition-colors inline-flex items-center gap-1">
                            View all <ArrowRightIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {loading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : results.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-sm text-gray-400 font-semibold">No tests completed yet.</p>
                        <button onClick={() => go('tests')} className="mt-4 px-5 py-2.5 rounded-xl bg-atlas-primary text-atlas-black text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors">
                            Browse my tests
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {results.slice(0, 5).map(r => (
                            <button key={r.attemptId} onClick={() => go('results')} className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors">
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{r.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · Rank #{r.rank} of {r.totalStudents}</p>
                                </div>
                                <span className={`text-lg font-black shrink-0 ${scoreColor(r.score)}`}>{r.score}%</span>
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Profile;
