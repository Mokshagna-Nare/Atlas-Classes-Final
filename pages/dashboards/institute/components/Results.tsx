
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { ChartBarIcon, UserGroupIcon, TrophyIcon, ArrowRightIcon, XIcon, InformationCircleIcon } from '../../../../components/icons';

const Results: React.FC = () => {
    const { tests, results, institutes } = useData();
    const { user } = useAuth()!;
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

    // Tests belonging to this institute
    const instituteTests = tests.filter(t => t.instituteId === user?.id && t.status === 'Completed');

    const TestDetailView = ({ testId }: { testId: string }) => {
        const test = tests.find(t => t.id === testId);
        const testResults = results.filter(r => r.testId === testId);
        
        const avgScore = testResults.length > 0 ? (testResults.reduce((acc, curr) => acc + curr.score, 0) / testResults.length).toFixed(1) : 0;
        const topScore = testResults.length > 0 ? Math.max(...testResults.map(r => r.score)) : 0;

        return (
            <div className="space-y-8 animate-fade-in-up">
                <button onClick={() => setSelectedTestId(null)} className="flex items-center gap-2 text-atlas-primary text-xs font-bold uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
                    ← Back to all tests
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-atlas-primary/10 rounded-2xl"><UserGroupIcon className="h-6 w-6 text-atlas-primary" /></div>
                            <h4 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Participated</h4>
                        </div>
                        <p className="text-3xl font-black text-white">{testResults.length} <span className="text-sm font-medium text-gray-500 uppercase">Students</span></p>
                    </div>
                    <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-atlas-primary/10 rounded-2xl"><ChartBarIcon className="h-6 w-6 text-atlas-primary" /></div>
                            <h4 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Average Score</h4>
                        </div>
                        <p className="text-3xl font-black text-white">{avgScore} <span className="text-sm font-medium text-gray-500 uppercase">Points</span></p>
                    </div>
                    <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-atlas-primary/10 rounded-2xl"><TrophyIcon className="h-6 w-6 text-atlas-primary" /></div>
                            <h4 className="text-gray-400 font-bold text-xs uppercase tracking-widest">Top Score</h4>
                        </div>
                        <p className="text-3xl font-black text-white">{topScore} <span className="text-sm font-medium text-gray-500 uppercase">Points</span></p>
                    </div>
                </div>

                <div className="bg-atlas-dark border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left">
                        <thead className="bg-atlas-black/50 border-b border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                            <tr>
                                <th className="p-6">Student ID</th>
                                <th className="p-6">Score</th>
                                <th className="p-6">Grade</th>
                                <th className="p-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {testResults.map(r => (
                                <tr key={r.studentId} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="p-6">
                                        <p className="text-sm font-bold text-white">{r.studentId}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-lg font-black text-atlas-primary">{r.score}/{r.maxScore}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${r.grade === 'A+' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-400'}`}>{r.grade}</span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <button className="text-gray-600 hover:text-white transition-colors"><InformationCircleIcon className="h-5 w-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    if (selectedTestId) return <TestDetailView testId={selectedTestId} />;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-extrabold text-white">Institute Results</h2>
                <p className="text-atlas-text-muted text-sm font-semibold uppercase tracking-widest mt-1">Select a test to view performance analysis</p>
            </div>

            <div className="grid gap-4">
                {instituteTests.map(test => (
                    <div key={test.id} className="group bg-atlas-dark border border-gray-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-atlas-primary/40 transition-all cursor-pointer shadow-xl" onClick={() => setSelectedTestId(test.id)}>
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-atlas-soft flex items-center justify-center border border-gray-700 group-hover:border-atlas-primary/30 transition-colors">
                                <ChartBarIcon className="h-7 w-7 text-atlas-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{test.title}</h3>
                                <div className="flex items-center gap-4 mt-1">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{test.date}</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                    <span className="text-[10px] font-black text-atlas-primary uppercase tracking-widest">{test.subject}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right px-6 border-r border-gray-800 hidden md:block">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Reports</p>
                                <p className="text-xl font-black text-white">{results.filter(r => r.testId === test.id).length}</p>
                            </div>
                            <ArrowRightIcon className="h-6 w-6 text-gray-600 group-hover:text-atlas-primary group-hover:translate-x-1 transition-all" />
                        </div>
                    </div>
                ))}
                {instituteTests.length === 0 && (
                    <div className="p-20 text-center text-gray-500 font-bold uppercase tracking-widest bg-atlas-soft/40 border border-gray-800 rounded-3xl">
                        No completed tests found for your institute.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Results;
