
import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { XIcon, InformationCircleIcon, ChartBarIcon, SparklesIcon, CheckCircleIcon, TrophyIcon } from '../../../../components/icons';

interface ResultsProps {
    initialSelectedTestId?: string | null;
    onClearSelection?: () => void;
}

const Results: React.FC<ResultsProps> = ({ initialSelectedTestId, onClearSelection }) => {
    const { tests, results } = useData();
    const { user } = useAuth()!;
    const [reviewingTestId, setReviewingTestId] = useState<string | null>(null);

    useEffect(() => {
        if (initialSelectedTestId) {
            setReviewingTestId(initialSelectedTestId);
        }
    }, [initialSelectedTestId]);

    const studentResults = results.filter(r => r.studentId === user?.id);

    const handleCloseModal = () => {
        setReviewingTestId(null);
        if (onClearSelection) onClearSelection();
    };

    const ReviewModal = ({ testId }: { testId: string }) => {
        const test = tests.find(t => t.id === testId);
        const result = studentResults.find(r => r.testId === testId);
        if (!test || !result) return null;

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
            <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-8 animate-scale-in">
                <div className="bg-atlas-soft border border-gray-800 w-full max-w-6xl max-h-[95vh] rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col">
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-atlas-dark/50">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-atlas-primary/10 rounded-2xl border border-atlas-primary/20 shadow-glow">
                                <TrophyIcon className="h-8 w-8 text-atlas-primary" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white">{test.title}</h3>
                                <p className="text-atlas-text-muted text-xs uppercase tracking-[0.2em] font-black mt-1">
                                    Analysis Dashboard • Campus Rank: <span className="text-atlas-primary font-black">#{result.rank}/{result.totalStudents}</span>
                                </p>
                            </div>
                        </div>
                        <button onClick={handleCloseModal} className="p-4 bg-gray-800 hover:bg-gray-700 rounded-2xl transition-all text-white active:scale-90">
                            <XIcon className="h-7 w-7" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar">
                        
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
                                        <p className="text-4xl font-black text-white">{result.score}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Pts</p>
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
                                {test.questions?.map((q, idx) => {
                                    const userAnswer = result.studentAnswers?.[idx.toString()];
                                    const isCorrect = userAnswer === q.answer;
                                    const isUnanswered = !userAnswer;

                                    return (
                                        <div key={idx} className={`p-8 rounded-3xl border-2 transition-all ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/10' : isUnanswered ? 'bg-gray-800/10 border-gray-800' : 'bg-atlas-primary/5 border-atlas-primary/10'}`}>
                                            <div className="flex gap-6">
                                                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl ${isCorrect ? 'bg-emerald-500 text-white' : isUnanswered ? 'bg-gray-700 text-gray-400' : 'bg-atlas-primary text-white'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xl font-bold text-white mb-6 leading-relaxed">{q.question}</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className={`p-5 rounded-2xl border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-atlas-dark border-gray-800'}`}>
                                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Student Response</p>
                                                            <p className={`text-lg font-black ${isCorrect ? 'text-emerald-400' : 'text-atlas-primary'}`}>{userAnswer || 'Not Attempted'}</p>
                                                        </div>
                                                        {!isCorrect && (
                                                            <div className="p-5 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 shadow-glow">
                                                                <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2">Correct Solution</p>
                                                                <p className="text-lg font-black text-emerald-400">{q.answer}</p>
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
        );
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-white">Performance Records</h2>
                    <p className="text-atlas-text-muted text-sm font-bold uppercase tracking-[0.2em] mt-2">Comprehensive Test History & Analysis</p>
                </div>
            </div>

            {studentResults.length === 0 ? (
                <div className="bg-atlas-soft/40 border border-gray-800 p-24 rounded-[3rem] text-center shadow-inner">
                    <InformationCircleIcon className="h-16 w-16 text-gray-700 mx-auto mb-6" />
                    <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-xs">Awaiting examination data</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {studentResults.sort((a,b) => new Date(tests.find(t=>t.id===b.testId)?.date || '').getTime() - new Date(tests.find(t=>t.id===a.testId)?.date || '').getTime()).map(result => {
                        const test = tests.find(t => t.id === result.testId);
                        return (
                            <div key={result.testId} className="group bg-atlas-dark border border-gray-800 rounded-[2rem] overflow-hidden transition-all hover:border-atlas-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                <div className="p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-atlas-primary/10 text-atlas-primary text-[10px] font-black uppercase tracking-widest rounded-lg border border-atlas-primary/20">
                                                {test?.batch}
                                            </span>
                                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                                {test?.date}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-black text-white group-hover:text-atlas-primary transition-colors">{test?.title}</h3>
                                        <p className="text-sm font-bold text-gray-500 mt-1">Module: <span className="text-gray-400">{test?.subject}</span></p>
                                    </div>
                                    
                                    <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
                                        <div className="text-center px-8 border-x border-gray-800/50">
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Score</p>
                                            <p className="text-3xl font-black text-atlas-primary">{result.score}<span className="text-sm text-gray-600">/{result.maxScore}</span></p>
                                        </div>
                                        <div className="text-center px-8 border-r border-gray-800/50">
                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Campus Rank</p>
                                            <p className="text-3xl font-black text-white">#{result.rank}<span className="text-xs text-gray-600 font-bold ml-1">/ {result.totalStudents}</span></p>
                                        </div>
                                        <button 
                                            onClick={() => setReviewingTestId(result.testId)}
                                            className="px-8 py-5 bg-atlas-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-glow active:scale-95 group-hover:translate-x-1"
                                        >
                                            Review Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {reviewingTestId && <ReviewModal testId={reviewingTestId} />}
        </div>
    );
};

export default Results;
