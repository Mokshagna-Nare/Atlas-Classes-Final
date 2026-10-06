
import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { useAuth } from '../../../../contexts/AuthContext';
import { useStudentResults } from '../../../../hooks/useStudentResults';
import { XIcon, InformationCircleIcon, ChartBarIcon, SparklesIcon, CheckCircleIcon, TrophyIcon, ShieldCheckIcon } from '../../../../components/icons';
import ModalPortal from '../../../../components/ModalPortal';
import { replacePlaceholdersWithImages } from '../../../../utils/imagePlaceholder';

interface ResultsProps {
    initialSelectedTestId?: string | null;
    onClearSelection?: () => void;
}

const Results: React.FC<ResultsProps> = ({ initialSelectedTestId, onClearSelection }) => {
    const { user } = useAuth()!;
    const { results: studentResults, loading } = useStudentResults(user?.id);
    const [reviewingTestId, setReviewingTestId] = useState<string | null>(null);

    useEffect(() => {
        if (initialSelectedTestId) {
            setReviewingTestId(initialSelectedTestId);
        }
    }, [initialSelectedTestId]);

    const handleCloseModal = () => {
        setReviewingTestId(null);
        if (onClearSelection) onClearSelection();
    };

    const ReviewModal = ({ testId }: { testId: string }) => {
        const result = studentResults.find(r => r.testId === testId);
        if (!result) return null;

        // Data for Subject Marks Distribution Pie Chart
        const pieData = Object.entries(result.subjectBreakdown || {}).map(([subject, data]) => ({
            name: subject,
            value: data.score
        }));

        const COLORS = ['#10B981', '#34D399', '#059669', '#6EE7B7', '#A7F3D0'];

        // Analysis and Improvement Criteria Logic
        const getInsight = (percentage: number) => {
            if (percentage >= 90) return {
                label: 'Very good, keep it up!',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/30'
            };
            if (percentage >= 80) return {
                label: 'Good criteria but can be improved.',
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
                border: 'border-yellow-500/30'
            };
            return {
                label: 'Plan to spend more hours on this subject to score better.',
                color: 'text-atlas-primary',
                bg: 'bg-atlas-primary/10',
                border: 'border-atlas-primary/30'
            };
        };

        return (
            <ModalPortal>
            <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-8 animate-scale-in">
                <div className="bg-atlas-soft border border-gray-800 w-full max-w-6xl max-h-[95vh] rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col">
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-atlas-dark/50">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-atlas-primary/10 rounded-2xl border border-atlas-primary/20 shadow-glow">
                                <TrophyIcon className="h-8 w-8 text-atlas-primary" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white">{result.title}</h3>
                                <p className="text-atlas-text-muted text-xs uppercase tracking-[0.2em] font-black mt-1">
                                    Class rank: <span className="text-atlas-primary font-black">#{result.rank}/{result.totalStudents}</span>
                                </p>
                            </div>
                        </div>
                        <button onClick={handleCloseModal} className="p-4 bg-gray-800 hover:bg-gray-700 rounded-2xl transition-all text-white active:scale-90">
                            <XIcon className="h-7 w-7" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar">

                        {result.flagged && (
                            <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                                <ShieldCheckIcon className="h-6 w-6 text-amber-400 shrink-0" />
                                <p className="text-sm text-amber-200/90">
                                    This attempt was flagged by proctoring — {result.tabSwitchCount} tab switch{result.tabSwitchCount === 1 ? '' : 'es'} and {result.fullscreenExitCount} fullscreen exit{result.fullscreenExitCount === 1 ? '' : 's'} were recorded.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Interactive Subject Distribution Pie Chart */}
                            <div className="lg:col-span-5 bg-atlas-dark p-10 rounded-[2rem] border border-gray-800 shadow-2xl relative">
                                <h4 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                    <SparklesIcon className="h-6 w-6 text-atlas-primary" />
                                    Marks Contribution
                                </h4>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={8}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '15px', padding: '12px' }}
                                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                                labelStyle={{ color: '#10B981', fontWeight: 'bold' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', color: '#9CA3AF', textTransform: 'uppercase', fontSize: '10px', fontWeight: 'bold' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-12">
                                    <div className="text-center">
                                        <p className="text-4xl font-black text-white">{result.score}%</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Score</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Subject Analysis & Area to Improved */}
                            <div className="lg:col-span-7 space-y-6">
                                <h4 className="text-xl font-bold text-white flex items-center gap-3 mb-2">
                                    <InformationCircleIcon className="h-6 w-6 text-atlas-primary" />
                                    Subject-wise Improvement Guide
                                </h4>
                                {Object.entries(result.subjectBreakdown || {}).map(([subject, data]) => {
                                    const perc = (data.score / data.maxScore) * 100;
                                    const insight = getInsight(perc);
                                    return (
                                        <div key={subject} className={`p-6 rounded-2xl border ${insight.border} ${insight.bg} transition-all hover:scale-[1.02] group`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-white font-black text-lg uppercase tracking-wide">{subject}</p>
                                                    <p className="text-gray-400 text-xs font-bold mt-0.5">Score: {data.score}/{data.maxScore}</p>
                                                </div>
                                                <span className={`text-2xl font-black ${insight.color}`}>{perc.toFixed(0)}%</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                                                    <SparklesIcon className={`h-4 w-4 ${insight.color}`} />
                                                </div>
                                                <p className={`text-sm font-bold ${insight.color}`}>{insight.label}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <hr className="border-gray-800" />

                        {/* Traditional Question List */}
                        <section className="space-y-8">
                            <h4 className="text-2xl font-black text-white flex items-center gap-4">
                                <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                                Question-wise Breakdown
                            </h4>
                            <div className="space-y-6">
                                {result.questions.map((q, idx) => {
                                    const isUnanswered = q.selectedIndex === null || q.selectedIndex === undefined;
                                    const selectedText = !isUnanswered ? q.options[q.selectedIndex as number] : null;
                                    const correctText = q.correctIndex !== null ? q.options[q.correctIndex] : null;

                                    return (
                                        <div key={q.id} className={`p-8 rounded-3xl border-2 transition-all ${q.isCorrect ? 'bg-emerald-500/5 border-emerald-500/10' : isUnanswered ? 'bg-gray-800/10 border-gray-800' : 'bg-atlas-primary/5 border-atlas-primary/10'}`}>
                                            <div className="flex gap-6">
                                                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl ${q.isCorrect ? 'bg-emerald-500 text-white' : isUnanswered ? 'bg-gray-700 text-gray-400' : 'bg-atlas-primary text-white'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-xl font-bold text-white mb-6 leading-relaxed prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: replacePlaceholdersWithImages(q.question, q.inline_images) }} />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className={`p-5 rounded-2xl border ${q.isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-atlas-dark border-gray-800'}`}>
                                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Student Response</p>
                                                            <p className={`text-lg font-black ${q.isCorrect ? 'text-emerald-400' : 'text-atlas-primary'}`}>{selectedText || 'Not Attempted'}</p>
                                                        </div>
                                                        {!q.isCorrect && (
                                                            <div className="p-5 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 shadow-glow">
                                                                <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2">Correct Solution</p>
                                                                <p className="text-lg font-black text-emerald-400 prose prose-invert max-w-none">{correctText || 'N/A'}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
            </ModalPortal>
        );
    };

    return (
        <div className="space-y-8">
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-3xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.07)_50%,rgba(255,255,255,0.03)_100%)] bg-[length:800px_100%] animate-shimmer" />)}
                </div>
            ) : studentResults.length === 0 ? (
                <div className="p-16 rounded-3xl border border-dashed border-white/10 text-center">
                    <InformationCircleIcon className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-300">No results yet</p>
                    <p className="text-xs text-gray-500 mt-2">Once you finish an assigned test, its full review will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {studentResults.map(result => {
                        const tone = result.score >= 75 ? 'text-emerald-400' : result.score >= 50 ? 'text-amber-400' : 'text-red-400';
                        return (
                            <button
                                key={result.attemptId}
                                onClick={() => setReviewingTestId(result.testId)}
                                className="group w-full text-left bg-atlas-dark border border-white/5 rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:border-atlas-primary/30 hover:bg-atlas-primary/[0.02]"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="text-xs font-semibold text-gray-500">
                                                {new Date(result.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="px-2 py-0.5 bg-atlas-primary/10 text-atlas-primary text-[10px] font-bold uppercase tracking-wider rounded-md">{result.primarySubject}</span>
                                            {result.flagged && (
                                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-md inline-flex items-center gap-1">
                                                    <ShieldCheckIcon className="h-3 w-3" /> Flagged
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-white truncate group-hover:text-emerald-200 transition-colors">{result.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{result.correctCount} correct · {result.wrongCount} wrong · {result.unattemptedCount} skipped</p>
                                    </div>

                                    <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Score</p>
                                            <p className={`text-2xl font-black ${tone}`}>{result.score}%</p>
                                        </div>
                                        <div className="h-10 w-px bg-white/5" />
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Class rank</p>
                                            <p className="text-2xl font-black text-white whitespace-nowrap">#{result.rank}<span className="text-xs text-gray-600 font-bold ml-1">/ {result.totalStudents}</span></p>
                                        </div>
                                        <span className="hidden sm:inline-flex items-center gap-2 pl-2 text-xs font-bold text-atlas-primary">
                                            Review
                                            <span className="transition-transform group-hover:translate-x-1">→</span>
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
            {reviewingTestId && <ReviewModal testId={reviewingTestId} />}
        </div>
    );
};

export default Results;
