
import React from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { SparklesIcon, InformationCircleIcon, ChartBarIcon, TrophyIcon, ClipboardCheckIcon } from '../../../../components/icons';

const Analytics: React.FC = () => {
    const { results, tests } = useData();
    const { user } = useAuth()!;

    const studentResults = results.filter(r => r.studentId === user?.id);

    if (studentResults.length === 0) {
        return (
            <div className="p-24 text-center flex flex-col items-center animate-fade-in-up">
                 <div className="bg-atlas-dark p-10 rounded-full mb-8 border border-gray-800 shadow-inner">
                    <InformationCircleIcon className="h-16 w-16 text-gray-700" />
                 </div>
                 <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-sm">Analytics Engine calibrating</p>
                 <p className="text-gray-600 text-sm mt-4 max-w-sm mx-auto">Please complete your upcoming <span className="text-atlas-primary font-bold">{user?.batch}</span> assessments to generate performance insights.</p>
            </div>
        );
    }

    // 1. Line Chart Data (Performance Over Time)
    const trendData = studentResults.map(res => {
        const test = tests.find(t => t.id === res.testId);
        return {
            name: test?.date || 'Unknown',
            score: Math.round((res.score / res.maxScore) * 100),
            rank: res.rank,
            testTitle: test?.title || 'Test'
        };
    }).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

    // 2. Radar Data (Overall Subject Proficiency)
    const subjectsMap: Record<string, { total: number; max: number }> = {};
    studentResults.forEach(res => {
        if (res.subjectBreakdown) {
            Object.entries(res.subjectBreakdown).forEach(([sub, data]) => {
                if (!subjectsMap[sub]) subjectsMap[sub] = { total: 0, max: 0 };
                subjectsMap[sub].total += data.score;
                subjectsMap[sub].max += data.maxScore;
            });
        }
    });

    const radarData = Object.entries(subjectsMap).map(([subject, data]) => ({
        subject,
        proficiency: Math.round((data.total / data.max) * 100),
        fullMark: 100
    }));

    // 3. Accuracy Pie Data
    const totals = studentResults.reduce((acc, curr) => ({
        correct: acc.correct + curr.correctCount,
        wrong: acc.wrong + curr.wrongCount,
        unattempted: acc.unattempted + curr.unattemptedCount
    }), { correct: 0, wrong: 0, unattempted: 0 });

    const pieData = [
        { name: 'Correct Questions', value: totals.correct, color: '#10B981' },
        { name: 'Wrong Attempts', value: totals.wrong, color: '#EF4444' },
        { name: 'Not Attempted', value: totals.unattempted, color: '#374151' }
    ];

    const tooltipStyle = {
        backgroundColor: '#111827',
        borderColor: '#374151',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.05)'
    };

    const weakSubjects = [...radarData]
        .sort((a, b) => a.proficiency - b.proficiency)
        .slice(0, 2);

    return (
        <div className="space-y-12 animate-fade-in-up pb-16">
            <header>
                <h2 className="text-4xl font-black text-white">Batch Analysis</h2>
                <p className="text-atlas-text-muted text-sm font-bold uppercase tracking-[0.2em] mt-2">Personalized Performance Visualizer</p>
            </header>

            {/* Performance Progress History Area Chart */}
            <div className="bg-atlas-dark p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-10 opacity-5">
                    <ChartBarIcon className="h-40 w-40 text-atlas-primary" />
                 </div>
                <h3 className="text-xl font-bold text-white mb-10 flex items-center gap-4 relative z-10">
                    <SparklesIcon className="h-6 w-6 text-atlas-primary" /> Learning Trajectory (%)
                </h3>
                <div className="h-96 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                            <XAxis dataKey="name" stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} dy={15} />
                            <YAxis stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} dx={-10} />
                            <Tooltip 
                                contentStyle={tooltipStyle}
                                labelStyle={{ color: '#10B981', fontWeight: '900', marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase' }}
                                itemStyle={{ color: '#fff', fontSize: '15px', padding: '4px 0' }}
                            />
                            <Area type="monotone" name="Percentage Score" dataKey="score" stroke="#10B981" strokeWidth={5} fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Subject Proficiency Radar */}
                <div className="bg-atlas-dark p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-10 flex items-center gap-4">
                        <TrophyIcon className="h-6 w-6 text-atlas-primary" /> Academic Profile
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#374151" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: '900' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#4B5563' }} />
                                <Radar
                                    name="Proficiency"
                                    dataKey="proficiency"
                                    stroke="#10B981"
                                    fill="#10B981"
                                    fillOpacity={0.4}
                                />
                                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#10B981' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Accuracy Pie Chart */}
                <div className="bg-atlas-dark p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-10 flex items-center gap-4">
                        <ClipboardCheckIcon className="h-6 w-6 text-atlas-primary" /> Accuracy Statistics
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={10}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={tooltipStyle} 
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Test-wise Comparative Analysis Table */}
            <div className="bg-atlas-dark border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-10 border-b border-gray-800 flex justify-between items-center bg-atlas-black/50">
                    <div className="flex items-center gap-4">
                        <TrophyIcon className="h-8 w-8 text-atlas-primary" />
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest">Campus Benchmarking</h3>
                    </div>
                    <div className="hidden md:block">
                        <span className="bg-atlas-primary text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-glow">
                             Enrolled Batch: {user?.batch}
                        </span>
                    </div>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-atlas-black/30 border-b border-gray-800">
                        <tr>
                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Assessment Title</th>
                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center">Your Score</th>
                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center">Percentile</th>
                            <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Campus Rank</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {studentResults.sort((a,b) => new Date(tests.find(t=>t.id===b.testId)?.date || '').getTime() - new Date(tests.find(t=>t.id===a.testId)?.date || '').getTime()).map(res => {
                            const test = tests.find(t => t.id === res.testId);
                            const perc = Math.round((res.score / res.maxScore) * 100);
                            return (
                                <tr key={res.testId} className="hover:bg-white/[0.03] transition-all group">
                                    <td className="p-8">
                                        <p className="text-lg font-black text-white group-hover:text-atlas-primary transition-colors">{test?.title}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{test?.date} • {test?.subject}</p>
                                    </td>
                                    <td className="p-8 text-center">
                                        <div className="inline-flex items-center gap-3">
                                            <span className="text-xl font-black text-white">{res.score}/{res.maxScore}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${res.grade === 'A+' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-atlas-primary/10 text-atlas-primary'}`}>{res.grade}</span>
                                        </div>
                                    </td>
                                    <td className="p-8 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl font-black text-white">{perc}%</span>
                                            <div className="w-16 h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                                <div className="h-full bg-atlas-primary rounded-full" style={{ width: `${perc}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-8 text-right">
                                        <div className="inline-flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-atlas-primary/10 border border-atlas-primary/20 flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform">
                                                <span className="text-lg font-black text-atlas-primary">#{res.rank}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] whitespace-nowrap">Global Rank</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* AI Insights & Learning Paths */}
            <div className="bg-atlas-primary/5 border border-atlas-primary/20 p-12 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-30 transition-opacity pointer-events-none">
                    <SparklesIcon className="h-32 w-32 text-atlas-primary" />
                </div>
                <div className="flex flex-col md:flex-row items-start gap-10 relative z-10">
                    <div className="p-6 bg-atlas-primary/10 rounded-[2rem] shadow-glow border border-atlas-primary/20">
                        <InformationCircleIcon className="h-10 w-10 text-atlas-primary" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-3xl font-black text-white mb-10 uppercase tracking-widest">Growth Engine Analysis</h4>
                        <div className="grid md:grid-cols-2 gap-10">
                            {weakSubjects.length > 0 ? weakSubjects.map((sub, idx) => (
                                <div key={idx} className="bg-atlas-dark/80 p-8 rounded-[2rem] border border-gray-800 shadow-xl hover:border-atlas-primary transition-all">
                                    <p className="text-atlas-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">Critical Focus: {sub.subject}</p>
                                    <p className="text-white font-black text-xl mb-4">Improvement Target</p>
                                    <p className="text-gray-400 text-sm leading-relaxed font-medium">
                                        Current proficiency in <span className="text-white font-bold">{sub.subject}</span> is <span className="text-atlas-primary font-black">{sub.proficiency}%</span>. 
                                        Based on your <span className="text-white">{user?.batch}</span> performance index, we recommend allocating <span className="text-white">12+ additional hours</span> to this subject's fundamental concepts before the next cumulative test.
                                    </p>
                                </div>
                            )) : (
                                <p className="text-gray-500 italic font-black uppercase tracking-widest text-xs">Awaiting data points to generate path...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
