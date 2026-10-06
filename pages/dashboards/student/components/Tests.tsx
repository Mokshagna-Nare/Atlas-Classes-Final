import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../services/supabase';
import { ClipboardCheckIcon, InformationCircleIcon, CheckCircleIcon } from '../../../../components/icons';

type AssignmentStatus = 'available' | 'upcoming' | 'expired' | 'completed';

interface AssignedTest {
    assignmentId: string;
    testId: string;
    title: string;
    questionCount: number;
    opensAt: string | null;
    closesAt: string | null;
    status: AssignmentStatus;
    score?: number;
}

const statusMeta: Record<AssignmentStatus, { label: string; classes: string }> = {
    available: { label: 'Available Now', classes: 'bg-atlas-primary/10 text-atlas-primary border-atlas-primary/30' },
    upcoming: { label: 'Upcoming', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    expired: { label: 'Missed', classes: 'bg-red-500/10 text-red-400 border-red-500/30' },
    completed: { label: 'Completed', classes: 'bg-gray-700/40 text-gray-400 border-gray-600/40' },
};

const TAB_ORDER: AssignmentStatus[] = ['available', 'upcoming', 'completed', 'expired'];

const fmtWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const EMPTY_TEXT: Record<AssignmentStatus, string> = {
    available: "Nothing to take right now — you're all caught up.",
    upcoming: 'No tests scheduled yet.',
    completed: "You haven't completed any tests yet.",
    expired: 'No missed tests. Keep it up!',
};

const Tests: React.FC = () => {
    const { user } = useAuth()!;
    const navigate = useNavigate();
    const [assignedTests, setAssignedTests] = useState<AssignedTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<AssignmentStatus>('available');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            if (!user?.class_id) { setLoading(false); return; }

            const { data: assignments } = await supabase
                .from('test_assignments')
                .select('id, test_id, opens_at, closes_at, tests(title, question_ids)')
                .eq('class_id', user.class_id);

            const { data: attempts } = await supabase
                .from('test_attempts')
                .select('test_id, score')
                .eq('student_id', user.id);

            const attemptByTest = new Map((attempts || []).map(a => [a.test_id, a]));
            const now = Date.now();

            const rows: AssignedTest[] = (assignments || []).map((a: any) => {
                const attempt = attemptByTest.get(a.test_id);
                let status: AssignmentStatus;
                if (attempt) status = 'completed';
                else if (a.opens_at && now < new Date(a.opens_at).getTime()) status = 'upcoming';
                else if (a.closes_at && now > new Date(a.closes_at).getTime()) status = 'expired';
                else status = 'available';

                return {
                    assignmentId: a.id,
                    testId: a.test_id,
                    title: a.tests?.title || 'Untitled Test',
                    questionCount: a.tests?.question_ids?.length || 0,
                    opensAt: a.opens_at,
                    closesAt: a.closes_at,
                    status,
                    score: attempt?.score,
                };
            });

            // Newest first within every tab.
            rows.sort((x, y) => new Date(y.opensAt || 0).getTime() - new Date(x.opensAt || 0).getTime());
            setAssignedTests(rows);
            // Open on the first tab that actually has something in it, rather than an empty one.
            const firstNonEmpty = TAB_ORDER.find(s => rows.some(r => r.status === s));
            if (firstNonEmpty) setActiveTab(firstNonEmpty);
            setLoading(false);
        };
        load();
    }, [user?.class_id, user?.id]);

    const filtered = assignedTests.filter(t => t.status === activeTab);
    const counts = TAB_ORDER
        .reduce((acc, s) => ({ ...acc, [s]: assignedTests.filter(t => t.status === s).length }), {} as Record<AssignmentStatus, number>);

    return (
        <div className="space-y-8">
            {!user?.class_id && !loading && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <InformationCircleIcon className="h-6 w-6 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-200/80">
                        You haven't been assigned to a class yet. Ask your institute to set your class in the Students panel — tests are released class-by-class.
                    </p>
                </div>
            )}

            {user?.class_id && (
                <>
                    <div className="flex gap-1 bg-atlas-dark p-1.5 rounded-2xl border border-white/5 w-full sm:w-fit overflow-x-auto">
                        {TAB_ORDER.map(s => (
                            <button key={s} onClick={() => setActiveTab(s)} aria-pressed={activeTab === s}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === s ? 'bg-atlas-primary/15 text-white ring-1 ring-atlas-primary/30' : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'}`}>
                                {statusMeta[s].label}
                                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[11px] font-black ${activeTab === s ? 'bg-atlas-primary text-atlas-black' : 'bg-white/5 text-gray-400'}`}>{counts[s] || 0}</span>
                            </button>
                        ))}
                    </div>

                    <div key={activeTab} className="space-y-3 animate-view-in">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.07)_50%,rgba(255,255,255,0.03)_100%)] bg-[length:800px_100%] animate-shimmer" />)
                        ) : filtered.length === 0 ? (
                            <div className="p-14 text-center border border-dashed border-white/10 rounded-3xl flex flex-col items-center gap-3">
                                <ClipboardCheckIcon className="h-8 w-8 text-gray-700" />
                                <p className="text-sm font-semibold text-gray-400">{EMPTY_TEXT[activeTab]}</p>
                            </div>
                        ) : (
                            filtered.map(t => (
                                <div key={t.assignmentId} className="bg-atlas-dark border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-atlas-primary/30 transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-bold text-base sm:text-lg text-white truncate">{t.title}</p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {t.questionCount} questions
                                            {t.status === 'available' && t.closesAt && ` · Closes ${fmtWhen(t.closesAt)}`}
                                            {t.status === 'upcoming' && t.opensAt && ` · Opens ${fmtWhen(t.opensAt)}`}
                                            {(t.status === 'completed' || t.status === 'expired') && t.opensAt && ` · ${fmtWhen(t.opensAt)}`}
                                        </p>
                                    </div>
                                    {t.status === 'available' && (
                                        <button onClick={() => navigate(`/test/${t.testId}`)}
                                            className="bg-atlas-primary text-white font-black py-3 px-8 rounded-xl hover:bg-emerald-600 transition-all hover:-translate-y-0.5 active:scale-95 text-xs uppercase tracking-widest shrink-0">
                                            Start Test
                                        </button>
                                    )}
                                    {t.status === 'completed' && (
                                        <div className="flex items-center gap-2 text-atlas-primary font-black shrink-0">
                                            <CheckCircleIcon className="h-5 w-5" /> Scored {t.score}%
                                        </div>
                                    )}
                                    {t.status === 'expired' && (
                                        <span className="text-xs font-bold text-red-400/80 shrink-0">Not attempted</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Tests;
