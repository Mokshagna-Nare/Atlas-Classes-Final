import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ALL_RESULTS, INSTITUTE_STUDENTS, STUDENT_TESTS } from '../../../../constants';
import { getPerformanceAnalysis } from '../../../../services/geminiService';
import { UserGroupIcon, ClipboardDocumentListIcon, ChartPieIcon } from '../../../../components/icons';

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; }> = ({ icon, label, value }) => (
    <div className="bg-atlas-black p-6 rounded-lg flex items-center space-x-4 border border-gray-800 hover:border-atlas-primary/50 transition-colors duration-300">
        <div className="bg-atlas-gray p-3 rounded-md">
            {icon}
        </div>
        <div>
            <h3 className="text-gray-400 text-sm">{label}</h3>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    </div>
);


const Analysis: React.FC = () => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const chartData = STUDENT_TESTS.filter(t => t.status === 'Completed').map(test => {
        const resultsForTest = ALL_RESULTS.filter(r => r.testId === test.id);
        const average = resultsForTest.reduce((acc, r) => acc + r.score, 0) / resultsForTest.length;
        const topScore = Math.max(...resultsForTest.map(r => r.score));
        return {
            name: test.title,
            averageScore: average,
            topScore: topScore,
        };
    });

    const handleAnalyze = async () => {
        setIsLoading(true);
        setAnalysis('');
        const results = await getPerformanceAnalysis(ALL_RESULTS);
        setAnalysis(results);
        setIsLoading(false);
    };
    
    useEffect(() => {
        handleAnalyze();
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-atlas-primary">Performance Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard icon={<UserGroupIcon className="h-6 w-6 text-atlas-primary" />} label="Total Students" value={INSTITUTE_STUDENTS.length} />
                <StatCard icon={<ClipboardDocumentListIcon className="h-6 w-6 text-atlas-primary" />} label="Tests Conducted" value={STUDENT_TESTS.filter(t => t.status === 'Completed').length} />
                <StatCard icon={<ChartPieIcon className="h-6 w-6 text-atlas-primary" />} label="Overall Average" value={`${(ALL_RESULTS.reduce((acc, r) => acc + r.score, 0) / ALL_RESULTS.length).toFixed(2)}%`} />
            </div>

            <h3 className="text-xl font-bold mb-4">Test Performance Trends</h3>
            <div className="h-80 bg-atlas-black p-4 rounded-lg border border-gray-800 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}/>
                        <Legend />
                        <Bar dataKey="averageScore" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="topScore" fill="#34D399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            <h3 className="text-xl font-bold mb-4">AI-Powered Insights</h3>
            <div className="bg-atlas-black p-4 rounded-lg border border-gray-800">
                <button 
                    onClick={handleAnalyze} 
                    disabled={isLoading}
                    className="bg-atlas-primary text-white font-bold py-2 px-4 rounded-md hover:bg-emerald-600 transition disabled:bg-gray-500 mb-4"
                >
                    {isLoading ? 'Analyzing...' : 'Re-analyze with Gemini'}
                </button>
                {isLoading && <p className="text-center text-gray-400">Generating insights...</p>}
                {analysis && (
                    <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap font-sans">
                        {analysis}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analysis;