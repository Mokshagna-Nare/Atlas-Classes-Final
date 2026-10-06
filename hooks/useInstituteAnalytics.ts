import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getCorrectOptionIndex } from '../utils/mcqAnswer';
import { MCQ } from '../types';

export interface Accuracy { label: string; correct: number; total: number; percent: number }

export interface InstituteStudentRow {
  id: string;
  name: string;
  rollNo: string | null;
  className: string | null;
  testsTaken: number;
  averageScore: number;
  firstScore: number | null;
  latestScore: number | null;
  improvement: number | null; // latest − first, when 2+ tests taken
  flaggedCount: number;
}

export interface InstituteAttemptRow {
  attemptId: string;
  studentId: string;
  studentName: string;
  rollNo: string | null;
  className: string | null;
  score: number;
  correct: number;
  wrong: number;
  rank: number;
  flagged: boolean;
  tabSwitches: number;
  fullscreenExits: number;
  endTime: string;
}

export interface InstituteTestStat {
  id: string;
  title: string;
  date: string;
  questionCount: number;
  attempts: InstituteAttemptRow[];
  averageScore: number;
  topScore: number;
  lowestScore: number;
  participation: number; // % of enrolled students in the assigned classes who attempted
  flaggedCount: number;
  subjectAccuracy: Accuracy[];
  distribution: { band: string; count: number }[];
}

export interface InstituteAnalytics {
  studentCount: number;
  classCount: number;
  testsWithAttempts: number;
  totalAttempts: number;
  campusAverage: number;
  flaggedAttempts: number;
  tests: InstituteTestStat[];          // newest first
  trend: { title: string; date: string; average: number; top: number }[]; // oldest first
  distribution: { band: string; count: number }[];
  subjectAccuracy: Accuracy[];
  weakestConcepts: Accuracy[];
  students: InstituteStudentRow[];     // sorted by average desc
}

export const SCORE_BANDS: { band: string; min: number; max: number }[] = [
  { band: '0–39', min: 0, max: 39 },
  { band: '40–59', min: 40, max: 59 },
  { band: '60–74', min: 60, max: 74 },
  { band: '75–89', min: 75, max: 89 },
  { band: '90–100', min: 90, max: 100 },
];

const distributionOf = (scores: number[]) =>
  SCORE_BANDS.map(b => ({ band: b.band, count: scores.filter(s => s >= b.min && s <= b.max).length }));

const toAccuracy = (map: Record<string, { correct: number; total: number }>): Accuracy[] =>
  Object.entries(map)
    .map(([label, v]) => ({ label, correct: v.correct, total: v.total, percent: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

// PostgREST puts `.in()` values in the URL, so fetch large id lists in chunks.
async function fetchInChunks<T>(table: string, column: string, ids: string[], select: string): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from(table).select(select).in(column, ids.slice(i, i + 150));
    if (error) throw error;
    out.push(...((data || []) as T[]));
  }
  return out;
}

export function useInstituteAnalytics(instituteId?: string | null) {
  const [analytics, setAnalytics] = useState<InstituteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instituteId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [{ data: classes }, { data: students }, { data: tests }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('institute_id', instituteId),
        supabase.from('users').select('id, name, roll_no, class_id').eq('role', 'student').eq('institute_id', instituteId),
        supabase.from('tests').select('id, title, start_window, date, created_at, question_ids').eq('institute_id', instituteId),
      ]);

      const classById = new Map((classes || []).map((c: any) => [c.id, c.name as string]));
      const studentById = new Map((students || []).map((s: any) => [s.id, s]));
      const onlineTests = (tests || []).filter((t: any) => (t.question_ids || []).length > 0);
      const testIds = onlineTests.map((t: any) => t.id);

      const [attempts, assignments] = await Promise.all([
        testIds.length ? fetchInChunks<any>('test_attempts', 'test_id', testIds, 'id, test_id, student_id, score, total_correct, total_wrong, answers, end_time, flagged, tab_switch_count, fullscreen_exit_count') : Promise.resolve([]),
        testIds.length ? fetchInChunks<any>('test_assignments', 'test_id', testIds, 'test_id, class_id') : Promise.resolve([]),
      ]);
      const studentAttempts = attempts.filter(a => a.student_id);

      const questionIds = Array.from(new Set(onlineTests.flatMap((t: any) => t.question_ids as string[])));
      const mcqs = questionIds.length ? await fetchInChunks<any>('mcqs', 'id', questionIds, 'id, subject, topic, options, answer, answer_index') : [];
      const mcqById = new Map(mcqs.map(m => [m.id, m]));
      const correctIdx = new Map(mcqs.map(m => {
        let options = m.options;
        if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = []; } }
        return [m.id, getCorrectOptionIndex({ ...m, options: options || [] } as MCQ)];
      }));

      const campusSubject: Record<string, { correct: number; total: number }> = {};
      const campusTopic: Record<string, { correct: number; total: number }> = {};
      const bump = (map: Record<string, { correct: number; total: number }>, key: string, ok: boolean) => {
        if (!map[key]) map[key] = { correct: 0, total: 0 };
        map[key].total += 1;
        if (ok) map[key].correct += 1;
      };

      const testStats: InstituteTestStat[] = onlineTests.map((t: any) => {
        const rows = studentAttempts.filter(a => a.test_id === t.id);
        const testSubject: Record<string, { correct: number; total: number }> = {};
        for (const a of rows) {
          for (const qid of t.question_ids as string[]) {
            const m = mcqById.get(qid);
            if (!m) continue;
            const sel = a.answers?.[qid];
            const ok = sel !== undefined && sel !== null && correctIdx.get(qid) === sel;
            bump(testSubject, m.subject || 'General', ok);
            bump(campusSubject, m.subject || 'General', ok);
            if (m.topic?.trim()) bump(campusTopic, m.topic.trim(), ok);
          }
        }
        const scores = rows.map(r => r.score as number);
        const assignedClasses = new Set(assignments.filter(x => x.test_id === t.id).map(x => x.class_id));
        const eligible = assignedClasses.size
          ? (students || []).filter((s: any) => assignedClasses.has(s.class_id)).length
          : (students || []).length;
        const attemptRows: InstituteAttemptRow[] = rows
          .map(r => {
            const s: any = studentById.get(r.student_id);
            return {
              attemptId: r.id, studentId: r.student_id, studentName: s?.name || 'Former student', rollNo: s?.roll_no || null,
              className: s ? classById.get(s.class_id) || null : null,
              score: r.score, correct: r.total_correct, wrong: r.total_wrong,
              rank: 1 + rows.filter(o => o.score > r.score).length, // ties share a rank
              flagged: !!r.flagged, tabSwitches: r.tab_switch_count || 0, fullscreenExits: r.fullscreen_exit_count || 0, endTime: r.end_time,
            };
          })
          .sort((a, b) => a.rank - b.rank || a.studentName.localeCompare(b.studentName));
        return {
          id: t.id, title: t.title, date: t.start_window || t.date || t.created_at,
          questionCount: t.question_ids.length, attempts: attemptRows,
          averageScore: avg(scores), topScore: scores.length ? Math.max(...scores) : 0, lowestScore: scores.length ? Math.min(...scores) : 0,
          participation: eligible ? Math.min(100, Math.round((rows.length / eligible) * 100)) : 0,
          flaggedCount: rows.filter(r => r.flagged).length,
          subjectAccuracy: toAccuracy(testSubject), distribution: distributionOf(scores),
        };
      });

      const tested = testStats.filter(t => t.attempts.length > 0);
      const byDateAsc = tested.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const testDate = new Map(testStats.map(t => [t.id, new Date(t.date).getTime()]));

      const studentRows: InstituteStudentRow[] = (students || []).map((s: any) => {
        const mine = studentAttempts
          .filter(a => a.student_id === s.id)
          .sort((a, b) => (testDate.get(a.test_id) || 0) - (testDate.get(b.test_id) || 0));
        const first = mine[0]?.score ?? null;
        const latest = mine[mine.length - 1]?.score ?? null;
        return {
          id: s.id, name: s.name, rollNo: s.roll_no, className: classById.get(s.class_id) || null,
          testsTaken: mine.length, averageScore: avg(mine.map(a => a.score)),
          firstScore: first, latestScore: latest,
          improvement: mine.length >= 2 && first !== null && latest !== null ? latest - first : null,
          flaggedCount: mine.filter(a => a.flagged).length,
        };
      }).sort((a, b) => b.averageScore - a.averageScore || b.testsTaken - a.testsTaken);

      setAnalytics({
        studentCount: (students || []).length,
        classCount: (classes || []).length,
        testsWithAttempts: tested.length,
        totalAttempts: studentAttempts.length,
        campusAverage: avg(studentAttempts.map(a => a.score)),
        flaggedAttempts: studentAttempts.filter(a => a.flagged).length,
        tests: testStats.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        trend: byDateAsc.map(t => ({ title: t.title, date: t.date, average: t.averageScore, top: t.topScore })),
        distribution: distributionOf(studentAttempts.map(a => a.score)),
        subjectAccuracy: toAccuracy(campusSubject),
        weakestConcepts: toAccuracy(campusTopic).filter(c => c.total >= 10).sort((a, b) => a.percent - b.percent).slice(0, 5),
        students: studentRows,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { load(); }, [load]);

  return { analytics, loading, error, refresh: load };
}
