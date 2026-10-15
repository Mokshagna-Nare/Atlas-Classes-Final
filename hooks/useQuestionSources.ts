import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// The list of question sources offered when tagging or filtering questions: a few common
// presets, every source already used in the bank (with how many questions use it), and any
// custom source typed in this session. A custom source becomes permanent once a question is
// saved with it, because the list is built from the questions themselves.

export const PRESET_SOURCES = [
  'NCERT',
  'NCERT Exemplar',
  'JEE Main PYQ',
  'JEE Advanced PYQ',
  'NEET PYQ',
  'KCET PYQ',
  'Board Exam PYQ',
  'Atlas Original',
];

export interface QuestionSource {
  name: string;
  /** Questions in the bank using it (0 for presets/custom ones not used yet). */
  count: number;
}

/** Tidies a typed source: trims and collapses inner spaces. */
export const cleanSource = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

const PAGE = 1000;
let used: Map<string, QuestionSource> | null = null; // lower-case key → most common spelling + count
let loading: Promise<void> | null = null;
const sessionAdded = new Map<string, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

async function loadUsedSources() {
  const counts = new Map<string, Map<string, number>>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('mcqs').select('source').not('source', 'is', null).neq('source', '').order('id').range(from, from + PAGE - 1);
    if (error) break;
    for (const row of data ?? []) {
      const name = cleanSource((row as { source: string }).source);
      if (!name) continue;
      const key = name.toLowerCase();
      const spellings = counts.get(key) ?? new Map<string, number>();
      spellings.set(name, (spellings.get(name) ?? 0) + 1);
      counts.set(key, spellings);
    }
    if (!data || data.length < PAGE) break;
  }
  used = new Map(
    [...counts].map(([key, spellings]) => {
      const [name] = [...spellings].sort((a, b) => b[1] - a[1])[0];
      return [key, { name, count: [...spellings.values()].reduce((n, c) => n + c, 0) }];
    })
  );
  notify();
}

/** Every known source: used ones first (most-used first), then presets and custom ones A–Z. */
function snapshot(): QuestionSource[] {
  const all = new Map<string, QuestionSource>(used ?? []);
  for (const name of [...PRESET_SOURCES, ...sessionAdded.values()]) {
    const key = name.toLowerCase();
    if (!all.has(key)) all.set(key, { name, count: 0 });
  }
  return [...all.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Makes a newly typed source available to every picker right away. Returns the cleaned name. */
export function addCustomSource(value: string): string {
  const name = cleanSource(value);
  if (!name) return '';
  const key = name.toLowerCase();
  const existing = snapshot().find(s => s.name.toLowerCase() === key);
  if (existing) return existing.name;
  sessionAdded.set(key, name);
  notify();
  return name;
}

/** Re-reads the bank's sources (call after saving questions). */
export function refreshQuestionSources() {
  loading = loadUsedSources();
  return loading;
}

export function useQuestionSources() {
  const [sources, setSources] = useState<QuestionSource[]>(snapshot);
  useEffect(() => {
    const update = () => setSources(snapshot());
    listeners.add(update);
    if (!used && !loading) loading = loadUsedSources();
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return sources;
}
