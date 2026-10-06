import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import { ShieldCheckIcon, InformationCircleIcon, TrashIcon, CheckCircleIcon } from '../../../../components/icons';

interface FlaggedAttempt {
    id: string;
    test_id: string;
    student_id: string | null;
    score: number;
    total_correct: number;
    total_wrong: number;
    tab_switch_count: number;
    fullscreen_exit_count: number;
    end_time: string;
    tests?: { title: string } | null;
    users?: { name: string; email: string } | null;
}

const FlaggedAttempts: React.FC = () => {
    const [attempts, setAttempts] = useState<FlaggedAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [actingOn, setActingOn] = useState<string | null>(null);

    const fetchFlagged = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('test_attempts')
            .select('id, test_id, student_id, score, total_correct, total_wrong, tab_switch_count, fullscreen_exit_count, end_time, tests(title), users(name, email)')
            .eq('flagged', true)
            .order('end_time', { ascending: false });
        if (!error && data) setAttempts(data as any);
        setLoading(false);
    };

    useEffect(() => { fetchFlagged(); }, []);

    const clearFlag = async (id: string) => {
        setActingOn(id);
        await supabase.from('test_attempts').update({ flagged: false }).eq('id', id);
        setAttempts(prev => prev.filter(a => a.id !== id));
        setActingOn(null);
    };

    const deleteAttempt = async (attempt: FlaggedAttempt) => {
        if (!window.confirm(`Delete this attempt by ${attempt.users?.name || 'this student'}? This permanently removes their score and lets them retake the test.`)) return;
        setActingOn(attempt.id);
        await supabase.from('test_attempts').delete().eq('id', attempt.id);
        setAttempts(prev => prev.filter(a => a.id !== attempt.id));
        setActingOn(null);
    };

    return (
        <div className="space-y-6 text-white">
            <div>
                <h2 className="text-3xl font-extrabold mb-1 flex items-center gap-3">
                    <ShieldCheckIcon className="h-7 w-7 text-amber-400" /> Flagged Attempts
                </h2>
                <p className="text-sm text-gray-400 flex items-center gap-2">
                    <InformationCircleIcon className="h-4 w-4" />
                    Attempts auto-flagged by proctoring (3+ tab switches or fullscreen exits). Review and clear, or delete to allow a retake.
                </p>
            </div>

            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Student</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Test</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Score</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Tab Switches</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Fullscreen Exits</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Completed</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {loading ? (
                            <tr><td colSpan={7} className="p-10 text-center text-gray-500">Loading flagged attempts...</td></tr>
                        ) : attempts.length === 0 ? (
                            <tr><td colSpan={7} className="p-16 text-center text-gray-600">
                                <div className="flex flex-col items-center gap-3">
                                    <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                                    <p className="font-bold uppercase tracking-widest text-xs">No flagged attempts — clean record.</p>
                                </div>
                            </td></tr>
                        ) : (
                            attempts.map(a => (
                                <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-5">
                                        <p className="text-sm font-bold text-white">{a.users?.name || 'Unknown Student'}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{a.users?.email}</p>
                                    </td>
                                    <td className="p-5 text-sm text-gray-300">{a.tests?.title || 'Unknown Test'}</td>
                                    <td className="p-5 text-center">
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold ${a.score >= 50 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{a.score}%</span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`font-mono text-sm font-bold ${a.tab_switch_count >= 3 ? 'text-amber-400' : 'text-gray-400'}`}>{a.tab_switch_count}</span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`font-mono text-sm font-bold ${a.fullscreen_exit_count >= 3 ? 'text-amber-400' : 'text-gray-400'}`}>{a.fullscreen_exit_count}</span>
                                    </td>
                                    <td className="p-5 text-xs text-gray-500">{new Date(a.end_time).toLocaleString()}</td>
                                    <td className="p-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => clearFlag(a.id)}
                                                disabled={actingOn === a.id}
                                                className="px-3 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                                            >
                                                Clear Flag
                                            </button>
                                            <button
                                                onClick={() => deleteAttempt(a)}
                                                disabled={actingOn === a.id}
                                                className="p-2 text-red-500 hover:text-white hover:bg-red-500/80 rounded-lg transition disabled:opacity-50"
                                                title="Delete attempt (allows retake)"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FlaggedAttempts;
