import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { getCorrectOptionIndex } from '../utils/mcqAnswer';
import { MCQ } from '../types';

export interface StudentResultQuestion {
    id: string;
    question: string;
    options: string[];
    inline_images?: string[];
    option_inline_images?: string[][];
    subject: string;
    topic: string;
    sub_topic: string;
    difficulty: string;
    skill_type: string;
    marks?: number;
    selectedIndex: number | null;
    correctIndex: number | null;
    isCorrect: boolean;
}

export interface StudentResult {
    testId: string;
    attemptId: string;
    title: string;
    date: string;
    primarySubject: string;
    score: number;
    maxScore: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    rank: number;
    totalStudents: number;
    subjectBreakdown: Record<string, { score: number; maxScore: number }>;
    topicBreakdown: BucketStat[];
    difficultyBreakdown: BucketStat[];
    skillBreakdown: BucketStat[];
    questions: StudentResultQuestion[];
    tabSwitchCount: number;
    fullscreenExitCount: number;
    flagged: boolean;
}

export interface BucketStat {
    label: string;
    correct: number;
    total: number;
    percent: number;
}

export interface StudentAnalytics {
    overall: {
        totalTests: number;
        averageScore: number;
        bestScore: number;
        worstScore: number;
        totalCorrect: number;
        totalWrong: number;
        totalUnattempted: number;
        accuracyPercent: number; // correct / (correct + wrong), ignores unattempted
    };
    growthSeries: { testId: string; title: string; date: string; score: number; rank: number; totalStudents: number }[];
    latestVsPrevious: {
        latest: StudentResult;
        previous: StudentResult;
        scoreDelta: number;
        rankDelta: number; // positive = rank improved (moved up, lower number)
        subjectDeltas: Record<string, number>; // percent-point change per subject
        sameFormat: boolean; // previous test covers the same subject mix as the latest
        format: string[]; // subjects of the latest test
    } | null;
    subjectWise: BucketStat[];
    topicWise: { strongest: BucketStat[]; weakest: BucketStat[]; all: BucketStat[] };
    difficultyWise: BucketStat[];
    skillWise: BucketStat[];
    rankHistory: { testId: string; title: string; date: string; rank: number; totalStudents: number; percentile: number }[];
    integrity: { flaggedCount: number; totalTabSwitches: number; totalFullscreenExits: number };
}

type Tally = Record<string, { correct: number; total: number }>;

const toBucketStats = (map: Tally, excludeEmpty = false): BucketStat[] => {
    return Object.entries(map)
        .filter(([label]) => !excludeEmpty || label !== 'Uncategorized')
        .map(([label, v]) => ({ label, correct: v.correct, total: v.total, percent: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
};

// Buckets questions by subject/topic/difficulty/skill. Tests don't share the same
// concepts, so every dimension is built from whatever each question actually carries.
const tallyQuestions = (questions: StudentResultQuestion[]) => {
    const subject: Tally = {}, topic: Tally = {}, difficulty: Tally = {}, skill: Tally = {};
    const bump = (map: Tally, key: string, isCorrect: boolean) => {
        if (!map[key]) map[key] = { correct: 0, total: 0 };
        map[key].total += 1;
        if (isCorrect) map[key].correct += 1;
    };
    questions.forEach(q => {
        bump(subject, q.subject || 'General', q.isCorrect);
        bump(topic, q.topic?.trim() || 'Uncategorized', q.isCorrect);
        bump(difficulty, q.difficulty?.trim() || 'Unspecified', q.isCorrect);
        bump(skill, q.skill_type?.trim() || 'Unclassified', q.isCorrect);
    });
    return { subject, topic, difficulty, skill };
};

export const computeAnalytics = (results: StudentResult[]): StudentAnalytics | null => {
    if (results.length === 0) return null;

    // results is sorted newest-first (from the query); build an ascending-by-date copy for trend work.
    const ascending = results.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalCorrect = results.reduce((acc, r) => acc + r.correctCount, 0);
    const totalWrong = results.reduce((acc, r) => acc + r.wrongCount, 0);
    const totalUnattempted = results.reduce((acc, r) => acc + r.unattemptedCount, 0);
    const scores = results.map(r => r.score);

    const overall = {
        totalTests: results.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        bestScore: Math.max(...scores),
        worstScore: Math.min(...scores),
        totalCorrect,
        totalWrong,
        totalUnattempted,
        accuracyPercent: (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0,
    };

    const growthSeries = ascending.map(r => ({ testId: r.testId, title: r.title, date: r.date, score: r.score, rank: r.rank, totalStudents: r.totalStudents }));

    const rankHistory = ascending.map(r => ({
        testId: r.testId, title: r.title, date: r.date, rank: r.rank, totalStudents: r.totalStudents,
        percentile: r.totalStudents > 0 ? Math.round(((r.totalStudents - r.rank + 1) / r.totalStudents) * 100) : 0,
    }));

    let latestVsPrevious: StudentAnalytics['latestVsPrevious'] = null;
    if (ascending.length >= 2) {
        const latest = ascending[ascending.length - 1];
        // Compare like with like: prefer the most recent earlier test with the same subject mix
        // (e.g. NEET-pattern vs NEET-pattern), falling back to the immediately previous test.
        const formatOf = (r: StudentResult) => Object.keys(r.subjectBreakdown).sort().join('|');
        const earlier = ascending.slice(0, -1);
        const sameFormatPrev = [...earlier].reverse().find(r => formatOf(r) === formatOf(latest));
        const previous = sameFormatPrev || earlier[earlier.length - 1];
        const subjectDeltas: Record<string, number> = {};
        const subjects = new Set([...Object.keys(latest.subjectBreakdown), ...Object.keys(previous.subjectBreakdown)]);
        subjects.forEach(sub => {
            const l = latest.subjectBreakdown[sub];
            const p = previous.subjectBreakdown[sub];
            // Skip subjects with too few questions in either test — a 1-question swing isn't a trend.
            const lPct = l && l.maxScore >= 3 ? (l.score / l.maxScore) * 100 : null;
            const pPct = p && p.maxScore >= 3 ? (p.score / p.maxScore) * 100 : null;
            if (lPct !== null && pPct !== null) subjectDeltas[sub] = Math.round(lPct - pPct);
        });
        latestVsPrevious = {
            latest, previous,
            scoreDelta: latest.score - previous.score,
            rankDelta: previous.rank - latest.rank, // positive = improved
            sameFormat: !!sameFormatPrev,
            format: Object.keys(latest.subjectBreakdown).sort(),
            subjectDeltas,
        };
    }

    // Cross-attempt aggregation for subject/topic/difficulty/skill, built from real per-question data.
    const { subject: subjectAgg, topic: topicAgg, difficulty: difficultyAgg, skill: skillAgg } =
        tallyQuestions(results.flatMap(r => r.questions));

    const topicStatsAll = toBucketStats(topicAgg, true); // exclude "Uncategorized" from ranked call-outs
    const topicStatsRankable = topicStatsAll.filter(t => t.total >= 2); // avoid noisy single-question "weak topics"
    const weakest = topicStatsRankable.slice().sort((a, b) => a.percent - b.percent || b.total - a.total).slice(0, 5);
    const strongest = topicStatsRankable.slice().sort((a, b) => b.percent - a.percent || b.total - a.total).slice(0, 5);

    const integrity = {
        flaggedCount: results.filter(r => r.flagged).length,
        totalTabSwitches: results.reduce((acc, r) => acc + r.tabSwitchCount, 0),
        totalFullscreenExits: results.reduce((acc, r) => acc + r.fullscreenExitCount, 0),
    };

    return {
        overall,
        growthSeries,
        latestVsPrevious,
        subjectWise: toBucketStats(subjectAgg),
        topicWise: { strongest, weakest, all: toBucketStats(topicAgg) },
        difficultyWise: toBucketStats(difficultyAgg),
        skillWise: toBucketStats(skillAgg),
        rankHistory,
        integrity,
    };
};

// Builds the same "TestResult"-shaped data the premium Results/Profile UI expects,
// but computed live from real test_attempts + tests + mcqs instead of mock state.
export function useStudentResults(studentId?: string | null) {
    const [results, setResults] = useState<StudentResult[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!studentId) { setResults([]); setLoading(false); return; }
        setLoading(true);
        try {
            const { data: attempts } = await supabase
                .from('test_attempts')
                .select('id, test_id, score, total_correct, total_wrong, answers, end_time, tab_switch_count, fullscreen_exit_count, flagged')
                .eq('student_id', studentId)
                .order('end_time', { ascending: false });

            if (!attempts || attempts.length === 0) {
                setResults([]);
                return;
            }

            const testIds = Array.from(new Set(attempts.map(a => a.test_id)));
            const { data: testsData } = await supabase.from('tests').select('id, title, question_ids').in('id', testIds);
            const testsById = new Map((testsData || []).map((t: any) => [t.id, t]));

            const allQuestionIds = Array.from(new Set((testsData || []).flatMap((t: any) => t.question_ids || [])));
            const { data: mcqData } = allQuestionIds.length
                ? await supabase.from('mcqs').select('*').in('id', allQuestionIds)
                : { data: [] as MCQ[] };
            const mcqsById = new Map((mcqData || []).map((m: any) => [m.id, m]));

            // Rank among enrolled students, computed once per distinct test involved.
            const rankByTest = new Map<string, { rank: number; total: number }>();
            await Promise.all(testIds.map(async (testId) => {
                const { data: allAttempts } = await supabase.from('test_attempts').select('student_id, score').eq('test_id', testId).not('student_id', 'is', null);
                const scored = allAttempts || [];
                const mine = scored.find((a: any) => a.student_id === studentId);
                // Competition ranking: tied scores share a rank, so the result can't flip between loads.
                const rank = mine ? 1 + scored.filter((a: any) => a.score > mine.score).length : scored.length + 1;
                rankByTest.set(testId, { rank, total: scored.length || 1 });
            }));

            const computed: StudentResult[] = attempts.map((attempt: any) => {
                const test = testsById.get(attempt.test_id);
                const questionIds: string[] = test?.question_ids || [];
                const subjectAgg: Record<string, { score: number; maxScore: number }> = {};
                let unattempted = 0;

                const questions: StudentResultQuestion[] = questionIds
                    .map((qid) => {
                        const mcq = mcqsById.get(qid);
                        if (!mcq) return null;
                        const selectedIndex = attempt.answers?.[qid] ?? null;
                        const correctIndex = getCorrectOptionIndex(mcq as MCQ);
                        const isCorrect = selectedIndex !== null && selectedIndex !== undefined && correctIndex !== null && selectedIndex === correctIndex;
                        if (selectedIndex === null || selectedIndex === undefined) unattempted++;

                        const subject = mcq.subject || 'General';
                        if (!subjectAgg[subject]) subjectAgg[subject] = { score: 0, maxScore: 0 };
                        subjectAgg[subject].maxScore += 1;
                        if (isCorrect) subjectAgg[subject].score += 1;

                        let opts = mcq.options;
                        if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = []; } }

                        return {
                            id: qid,
                            question: mcq.question,
                            options: opts || [],
                            inline_images: mcq.inline_images,
                            option_inline_images: mcq.option_inline_images,
                            subject,
                            topic: mcq.topic || '',
                            sub_topic: mcq.sub_topic || '',
                            difficulty: mcq.difficulty || '',
                            skill_type: mcq.skill_type || '',
                            marks: mcq.marks,
                            selectedIndex: selectedIndex ?? null,
                            correctIndex,
                            isCorrect,
                        } as StudentResultQuestion;
                    })
                    .filter((q): q is StudentResultQuestion => q !== null);

                const rankInfo = rankByTest.get(attempt.test_id) || { rank: 1, total: 1 };
                const subjectEntries = Object.entries(subjectAgg);
                const primarySubject = subjectEntries.sort((a, b) => b[1].maxScore - a[1].maxScore)[0]?.[0] || 'General';
                const perTest = tallyQuestions(questions);

                return {
                    testId: attempt.test_id,
                    attemptId: attempt.id,
                    title: test?.title || 'Untitled Test',
                    date: attempt.end_time,
                    primarySubject,
                    score: attempt.score,
                    maxScore: 100,
                    correctCount: attempt.total_correct,
                    wrongCount: attempt.total_wrong,
                    unattemptedCount: unattempted,
                    rank: rankInfo.rank,
                    totalStudents: rankInfo.total,
                    subjectBreakdown: subjectAgg,
                    topicBreakdown: toBucketStats(perTest.topic),
                    difficultyBreakdown: toBucketStats(perTest.difficulty),
                    skillBreakdown: toBucketStats(perTest.skill),
                    questions,
                    tabSwitchCount: attempt.tab_switch_count || 0,
                    fullscreenExitCount: attempt.fullscreen_exit_count || 0,
                    flagged: !!attempt.flagged,
                };
            });

            setResults(computed);
        } catch (e) {
            console.warn('Failed to load student results', e);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => { refresh(); }, [refresh]);

    const analytics = useMemo(() => computeAnalytics(results), [results]);

    return { results, loading, refresh, analytics };
}
