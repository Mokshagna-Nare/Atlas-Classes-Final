import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { getCorrectOptionIndex } from '../../../../utils/mcqAnswer';
import {
  FlagIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  InformationCircleIcon,
  PhotoIcon,
  MagnifyingGlassIcon
} from '../../../../components/icons';
import { getQuestionImages, getOptionImages, McqImageList } from '../../../../utils/mcqContent';
import ModalPortal from '../../../../components/ModalPortal';
import MultiSelectDropdown, { FilterOption } from '../../../../components/ui/MultiSelectDropdown';
import { RichMathText, stripMathMarkers } from '../../../../utils/renderMath';

import { supabase } from '../../../../services/supabase';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface QuestionBankProps {
  onEdit: (mcq: MCQ) => void;
}

const ITEMS_PER_PAGE = 20;

const ActiveChip: React.FC<{ label: string; dot?: string; onRemove: () => void }> = ({ label, dot, onRemove }) => (
  <span className="group inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-2.5 pr-1 text-xs font-medium text-gray-200 ring-1 ring-inset ring-white/10 transition-colors hover:ring-white/20 max-w-[260px] animate-menu-in">
    {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
    <span className="truncate" title={label}>{label}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      className="flex h-5 w-5 items-center justify-center rounded-full text-gray-500 transition-all hover:bg-rose-500/15 hover:text-rose-300 active:scale-90"
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </span>
);

const SUBJECT_COLORS: Record<string, string> = {
  Physics: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  Chemistry: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  Biology: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  Mathematics: 'text-violet-300 bg-violet-500/10 border-violet-500/25'
};

const SUBJECT_DOTS: Record<string, string> = {
  physics: 'bg-sky-400',
  chemistry: 'bg-amber-400',
  biology: 'bg-emerald-400',
  mathematics: 'bg-violet-400'
};

const DIFFICULTY_DOTS: Record<string, string> = {
  easy: 'bg-emerald-400',
  medium: 'bg-amber-400',
  hard: 'bg-rose-400'
};

const FilterIcon: React.FC<{ d: string }> = ({ d }) => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const FILTER_ICONS: Record<string, string> = {
  grade: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342',
  subject: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  topic: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  sub_topic: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  difficulty: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  question_type: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
  skill_type: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  status: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
};


const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

type FacetDim = 'grade' | 'subject' | 'topic' | 'sub_topic' | 'difficulty' | 'question_type' | 'skill_type' | 'status';

type FacetRow = Partial<Record<'grade' | 'subject' | 'topic' | 'sub_topic' | 'difficulty' | 'question_type' | 'skill_type', string | number | null>> & {
  isFlagged?: boolean | null;
};

const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];
const SUBJECT_KEYS = SUBJECT_ORDER.map(s => s.toLowerCase());
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

const byFixedOrder = (order: string[]) => (x: FilterOption, y: FilterOption) => {
  const ix = order.indexOf(x.value), iy = order.indexOf(y.value);
  return (ix === -1 ? order.length : ix) - (iy === -1 ? order.length : iy) || x.label.localeCompare(y.label);
};

interface FacetDimConfig {
  key: FacetDim;
  title: string;
  label: string;
  /** Secondary filters sit after a divider in the filter row. */
  secondary?: boolean;
  /** mcqs column; status is derived from isFlagged. */
  column?: string;
  /** Values always offered even when no question uses them yet. */
  fixed?: string[];
  sort?: (x: FilterOption, y: FilterOption) => number;
  singleLabel?: (o: FilterOption) => string;
  dotFor?: (value: string) => string | undefined;
}

const FACET_DIMS: FacetDimConfig[] = [
  {
    key: 'grade', label: 'Grade', title: 'Grades', column: 'grade', fixed: ['10', '11', '12'],
    sort: (x, y) => (parseFloat(x.value) || 0) - (parseFloat(y.value) || 0) || x.label.localeCompare(y.label),
    singleLabel: o => `Grade ${o.label}`,
  },
  { key: 'subject', label: 'Subject', title: 'Subjects', column: 'subject', fixed: SUBJECT_ORDER, sort: byFixedOrder(SUBJECT_KEYS), dotFor: v => SUBJECT_DOTS[v] },
  { key: 'topic', label: 'Topic', title: 'Topics', column: 'topic' },
  { key: 'sub_topic', label: 'Sub-topic', title: 'Sub-topics', column: 'sub_topic' },
  { key: 'difficulty', label: 'Difficulty', title: 'Difficulty', column: 'difficulty', fixed: ['Easy', 'Medium', 'Hard'], sort: byFixedOrder(DIFFICULTY_ORDER), dotFor: v => DIFFICULTY_DOTS[v] },
  { key: 'question_type', label: 'Question type', secondary: true, title: 'Question Types', column: 'question_type' },
  { key: 'skill_type', label: 'Skill type', secondary: true, title: 'Skill Types', column: 'skill_type' },
  { key: 'status', label: 'Status', secondary: true, title: 'Status', fixed: ['Clean', 'Flagged'], sort: byFixedOrder(['clean', 'flagged']), dotFor: v => (v === 'flagged' ? 'bg-rose-400' : 'bg-emerald-400') },
];

const EMPTY_FILTERS = Object.fromEntries(FACET_DIMS.map(d => [d.key, []])) as unknown as Record<FacetDim, string[]>;

const rawValue = (row: FacetRow, dim: FacetDim): string => {
  if (dim === 'status') return row.isFlagged ? 'Flagged' : 'Clean';
  const value = row[dim];
  return value === null || value === undefined ? '' : String(value).trim() ? String(value) : '';
};

const FACET_PAGE = 1000;

type SortMode = 'subject' | 'newest' | 'oldest';

const SORT_ORDER: Record<SortMode, [string, boolean][]> = {
  // Within one subject's block (see fetchQuestions for the subject order itself).
  subject: [['grade', true], ['topic', true], ['sub_topic', true], ['question_code', true]],
  newest: [['createdAt', false]],
  oldest: [['createdAt', true]],
};

const SORT_LABELS: Record<SortMode, string> = {
  subject: 'Subject order',
  newest: 'Newest first',
  oldest: 'Oldest first',
};

const QuestionBank: React.FC<QuestionBankProps> = ({ onEdit }) => {
  const { deleteMCQ, flagMCQ, unflagMCQ } = useData();

  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'text' | 'id'>('text');

  // Selected filter values are normalized keys (trimmed, lower-case) so "Easy" and
  // "easy" in the data are one option; the query expands a key back to every raw spelling.
  const [filters, setFilters] = useState<Record<FacetDim, string[]>>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState<SortMode>('subject');

  const [facetRows, setFacetRows] = useState<FacetRow[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number>(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showDownloadPreview, setShowDownloadPreview] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  // Every list fetch takes a ticket; a response whose ticket is stale (filters changed
  // while it was in flight) is dropped instead of overwriting newer results.
  const requestTicket = useRef(0);

  const setFilter = useCallback((dim: FacetDim, values: string[]) => {
    setFilters(prev => ({ ...prev, [dim]: values }));
  }, []);

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
  };

  // ---- Facets: one lightweight pass over every question's filterable columns ----

  const loadFacets = useCallback(async () => {
    const rows: FacetRow[] = [];
    // PostgREST caps a response at 1000 rows, so page through the whole table.
    for (let from = 0; ; from += FACET_PAGE) {
      const { data, error } = await supabase
        .from('mcqs')
        .select(FACET_DIMS.filter(d => d.column).map(d => d.column).join(',') + ',isFlagged')
        .order('id', { ascending: true })
        .range(from, from + FACET_PAGE - 1);
      if (error) {
        console.error('Failed to load question bank filters', error);
        break;
      }
      rows.push(...((data ?? []) as unknown as FacetRow[]));
      if (!data || data.length < FACET_PAGE) break;
    }
    setFacetRows(rows);
  }, []);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  const totalCount = facetRows.length;

  /** For each dimension: normalized key -> display label (most common spelling) and raw spellings. */
  const facetIndex = useMemo(() => {
    const index = {} as Record<FacetDim, Map<string, { label: string; raws: Map<string, number> }>>;
    for (const dim of FACET_DIMS) {
      const map = new Map<string, { label: string; raws: Map<string, number> }>();
      for (const fixed of dim.fixed ?? []) map.set(normalize(fixed), { label: fixed, raws: new Map() });
      for (const row of facetRows) {
        const raw = rawValue(row, dim.key);
        if (!raw) continue;
        const key = normalize(raw);
        const entry = map.get(key) ?? { label: raw.trim(), raws: new Map() };
        entry.raws.set(raw, (entry.raws.get(raw) ?? 0) + 1);
        map.set(key, entry);
      }
      for (const entry of map.values()) {
        if (entry.raws.size === 0) continue;
        // Show the spelling most questions use ("Easy", not the stray "easy").
        entry.label = [...entry.raws.entries()].sort((x, y) => y[1] - x[1])[0][0].trim();
      }
      index[dim.key] = map;
    }
    return index;
  }, [facetRows]);

  /** Whole-bank count per subject (ignores filters), in the standard subject order. */
  const bankSubjects = useMemo(
    () =>
      [...facetIndex.subject.entries()]
        .map(([key, entry]) => ({ key, label: entry.label, count: [...entry.raws.values()].reduce((n, c) => n + c, 0) }))
        .filter(subject => subject.count > 0 || SUBJECT_KEYS.includes(subject.key))
        .sort((x, y) => {
          const ix = SUBJECT_KEYS.indexOf(x.key), iy = SUBJECT_KEYS.indexOf(y.key);
          return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x.label.localeCompare(y.label);
        }),
    [facetIndex]
  );

  const rowMatches = useCallback(
    (row: FacetRow, active: Partial<Record<FacetDim, string[]>>, except?: FacetDim) =>
      FACET_DIMS.every(dim => {
        if (dim.key === except) return true;
        const selected = active[dim.key];
        if (!selected || selected.length === 0) return true;
        return selected.includes(normalize(rawValue(row, dim.key)));
      }),
    []
  );

  /**
   * Options for one dropdown, counted against every *other* active filter. Long, data-driven
   * lists (topics, types) only show values that still have matches; the short fixed lists
   * (grade, subject, difficulty, status) always show every value, with a 0 count when empty.
   */
  const optionsFor = useCallback(
    (dimKey: FacetDim): FilterOption[] => {
      const dim = FACET_DIMS.find(d => d.key === dimKey)!;
      const counts = new Map<string, number>();
      for (const row of facetRows) {
        if (!rowMatches(row, filters, dimKey)) continue;
        const raw = rawValue(row, dimKey);
        if (!raw) continue;
        const key = normalize(raw);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const selected = filters[dimKey];
      const options: FilterOption[] = [];
      for (const [key, entry] of facetIndex[dimKey]) {
        const count = counts.get(key) ?? 0;
        const keep = count > 0 || selected.includes(key) || (dim.fixed ?? []).some(f => normalize(f) === key);
        if (keep) options.push({ value: key, label: entry.label, count });
      }
      return options.sort(dim.sort ?? ((x, y) => x.label.localeCompare(y.label)));
    },
    [facetIndex, facetRows, filters, rowMatches]
  );

  // Topics belong to a grade + subject, and sub-topics to a topic. When a parent filter
  // changes, drop child selections that no longer exist under it, so a leftover topic
  // can't silently zero out the results.
  useEffect(() => {
    if (facetRows.length === 0) return;
    const prune = (dim: FacetDim, parents: FacetDim[]) => {
      const scope = Object.fromEntries(parents.map(p => [p, filters[p]])) as Partial<Record<FacetDim, string[]>>;
      const alive = new Set(
        facetRows.filter(r => rowMatches(r, scope)).map(r => normalize(rawValue(r, dim)))
      );
      return filters[dim].filter(v => alive.has(v));
    };
    const topics = prune('topic', ['grade', 'subject']);
    const subTopics = prune('sub_topic', ['grade', 'subject', 'topic']);
    if (topics.length !== filters.topic.length || subTopics.length !== filters.sub_topic.length) {
      setFilters(prev => ({ ...prev, topic: topics, sub_topic: subTopics }));
    }
  }, [facetRows, filters, rowMatches]);

  // ---- Server query ----

  const applyBaseFilters = useCallback(
    (query: any, except?: FacetDim) => {
      for (const dim of FACET_DIMS) {
        const selected = filters[dim.key];
        if (dim.key === except || selected.length === 0) continue;

        if (dim.key === 'status') {
          if (selected.length === 1 && selected[0] === 'flagged') query = query.eq('isFlagged', true);
          // A question that was never flagged may have NULL rather than false.
          if (selected.length === 1 && selected[0] === 'clean') query = query.or('isFlagged.is.null,isFlagged.eq.false');
          continue;
        }

        const raws = selected.flatMap(key => {
          const entry = facetIndex[dim.key].get(key);
          return entry && entry.raws.size > 0 ? [...entry.raws.keys()] : [entry?.label ?? key];
        });
        query = query.in(dim.column!, raws);
      }

      if (search.trim()) {
        const term = search.trim();
        query = query.ilike(searchType === 'text' ? 'question' : 'question_code', `%${term}%`);
      }

      return query;
    },
    [filters, facetIndex, search, searchType]
  );

  const hasAnyFilter = useMemo(
    () => FACET_DIMS.some(d => filters[d.key].length > 0) || search.trim().length > 0,
    [filters, search]
  );

  const activeFilterCount = FACET_DIMS.reduce((n, d) => n + filters[d.key].length, 0) + (search.trim() ? 1 : 0);

  /** Matching-question count per subject (all filters applied), in the standard subject order. */
  const countBySubject = useCallback(async () => {
    const groups = [...facetIndex.subject.entries()]
      .filter(([key]) => filters.subject.length === 0 || filters.subject.includes(key))
      .sort(([x], [y]) => {
        const ix = SUBJECT_KEYS.indexOf(x), iy = SUBJECT_KEYS.indexOf(y);
        return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x.localeCompare(y);
      })
      .map(([, entry]) => ({ label: entry.label, raws: entry.raws.size > 0 ? [...entry.raws.keys()] : [entry.label] }));

    return Promise.all(
      groups.map(async group => {
        let query = supabase.from('mcqs').select('id', { count: 'exact', head: true });
        query = applyBaseFilters(query, 'subject').in('subject', group.raws);
        const { count, error } = await query;
        if (error) throw error;
        return { ...group, count: count ?? 0 };
      })
    );
  }, [applyBaseFilters, facetIndex, filters.subject]);

  const fetchQuestions = useCallback(
    async (page: number, append: boolean = false) => {
      const ticket = append ? requestTicket.current : ++requestTicket.current;

      if (!hasAnyFilter) {
        setQuestions([]);
        setFilteredTotalCount(0);
        setSubjectCounts({});
        setHasMore(false);
        return;
      }

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const from = page * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        let rows: MCQ[] = [];
        let count: number;
        let subjectGroups: { label: string; raws: string[]; count: number }[] | null = null;

        if (sortBy === 'subject') {
          // A database ORDER BY on subject is alphabetical (Biology first). To list subjects in
          // the standard Physics › Chemistry › Biology › Mathematics order, page through each
          // subject's block in turn, using the per-subject counts to find which blocks this page spans.
          subjectGroups = await countBySubject();
          count = subjectGroups.reduce((n, g) => n + g.count, 0);
          let offset = 0;
          for (const group of subjectGroups) {
            const start = Math.max(from, offset);
            const end = Math.min(to, offset + group.count - 1);
            if (start <= end) {
              let query = supabase.from('mcqs').select('*');
              query = applyBaseFilters(query, 'subject').in('subject', group.raws);
              for (const [column, ascending] of SORT_ORDER.subject) query = query.order(column, { ascending, nullsFirst: false });
              const { data, error } = await query.order('id', { ascending: true }).range(start - offset, end - offset);
              if (error) throw error;
              rows.push(...((data ?? []) as MCQ[]));
            }
            offset += group.count;
            if (offset > to) break;
          }
        } else {
          let query = supabase.from('mcqs').select('*', { count: 'exact' });
          for (const [column, ascending] of SORT_ORDER[sortBy]) query = query.order(column, { ascending, nullsFirst: false });
          // Unique tie-breaker: without it, rows with equal sort keys can repeat or vanish between pages.
          query = applyBaseFilters(query.order('id', { ascending: true }).range(from, to));
          const { data, error, count: total } = await query;
          if (error) throw error;
          rows = (data ?? []) as MCQ[];
          count = total ?? 0;
        }

        if (ticket !== requestTicket.current) return;

        const fetchedIds = rows.map(d => d.id!);

        if (append) {
          setQuestions(prev => {
            const seen = new Set(prev.map(q => q.id));
            return [...prev, ...rows.filter(r => !seen.has(r.id))];
          });
          setExpandedRows(prev => new Set([...prev, ...fetchedIds]));
        } else {
          setQuestions(rows);
          setExpandedRows(new Set(fetchedIds));
        }

        setCurrentPage(page);
        setFilteredTotalCount(count);
        setHasMore((page + 1) * ITEMS_PER_PAGE < count);

        if (!append) {
          const groups = subjectGroups ?? (await countBySubject());
          if (ticket !== requestTicket.current) return;
          setSubjectCounts(Object.fromEntries(groups.filter(g => g.count > 0).map(g => [g.label, g.count])));
        }
      } catch (err) {
        console.error('Failed to load questions', err);
      } finally {
        if (ticket === requestTicket.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applyBaseFilters, countBySubject, hasAnyFilter, sortBy]
  );

  // Refetch from the first page whenever the filters, search or sort change (debounced for typing).
  useEffect(() => {
    const timer = setTimeout(() => fetchQuestions(0, false), 250);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  const handleLoadMore = useCallback(() => {
    fetchQuestions(currentPage + 1, true);
  }, [fetchQuestions, currentPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) handleLoadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, handleLoadMore]);

  // Keep the user's selection when more pages load; only drop ids that left the list.
  useEffect(() => {
    setSelectedIds(prev => {
      const visible = new Set(questions.map(q => q.id));
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [questions]);

  const refreshAfterChange = () => {
    fetchQuestions(0, false);
    loadFacets();
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const toggleAllRows = () => {
    if (questions.length === 0) return;

    const allExpanded = questions.every(q => expandedRows.has(q.id!));

    if (allExpanded) {
      const newExpanded = new Set(expandedRows);
      questions.forEach(q => newExpanded.delete(q.id!));
      setExpandedRows(newExpanded);
    } else {
      setExpandedRows(new Set([...expandedRows, ...questions.map(q => q.id!)]));
    }
  };

  const allVisibleExpanded = questions.length > 0 && questions.every(q => expandedRows.has(q.id!));

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(questions.map(q => q.id!)));
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selectedIds).map(id => deleteMCQ(id)));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    refreshAfterChange();
  };

  const confirmFlag = async () => {
    if (flaggingId) {
      await flagMCQ(flaggingId, reason);
      setFlaggingId(null);
      setReason('');
      refreshAfterChange();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteMCQ(id);
      refreshAfterChange();
    }
  };

  const handleUnflag = async (id: string) => {
    await unflagMCQ(id);
    refreshAfterChange();
  };

  const selectedQuestions = useMemo(
    () => questions.filter(q => selectedIds.has(q.id!)),
    [questions, selectedIds]
  );

  const isAllSelected = questions.length > 0 && selectedIds.size === questions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < questions.length;

  const handleDownloadContinue = () => {
    setShowDownloadPreview(false);
    setShowFormatModal(true);
  };

  const handleDownload = async () => {
    if (!downloadFormat || selectedQuestions.length === 0) return;

    if (downloadFormat === 'pdf') {
      const doc = new jsPDF();
      let y = 20;

      selectedQuestions.forEach((q, index) => {
        const questionLines = doc.splitTextToSize(`${index + 1}. ${stripMathMarkers(q.question)}`, 170);
        doc.setFontSize(12);
        doc.text(questionLines, 20, y);
        y += questionLines.length * 7;

        if (q.options?.length) {
          q.options.forEach((opt, optIndex) => {
            const optionLabel = `${String.fromCharCode(65 + optIndex)}. ${stripMathMarkers(opt)}`;
            const optionLines = doc.splitTextToSize(optionLabel, 160);
            doc.setFontSize(10);
            doc.text(optionLines, 28, y);
            y += optionLines.length * 6;

            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          });
        }

        y += 8;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      doc.save('questions.pdf');
    }

    if (downloadFormat === 'docx') {
      const children: Paragraph[] = [];

      selectedQuestions.forEach((q, index) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. ${stripMathMarkers(q.question)}`,
                bold: true
              })
            ],
            spacing: { after: 200 }
          })
        );

        if (q.options?.length) {
          q.options.forEach((opt, optIndex) => {
            children.push(
              new Paragraph({
                text: `${String.fromCharCode(65 + optIndex)}. ${stripMathMarkers(opt)}`,
                spacing: { after: 120 }
              })
            );
          });
        }

        children.push(new Paragraph({ text: '' }));
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children
          }
        ]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, 'questions.docx');
    }

    setShowFormatModal(false);
    setDownloadFormat(null);
  };

  return (
    <div className="space-y-6 reveal-on-scroll text-white">
      {/* Header: title, bank size and per-subject breakdown in one card (subject tiles toggle the filter). */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-1 ring-inset ring-white/[0.07] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col xl:flex-row xl:items-center gap-5 p-5 sm:p-6">
          <div className="shrink-0 xl:pr-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Question Bank</h2>
            <p className="mt-1.5 flex items-center gap-2 whitespace-nowrap text-sm text-gray-400">
              <InformationCircleIcon className="h-4 w-4 shrink-0" />
              Manage and review your MCQ repository
            </p>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-1 rounded-xl bg-emerald-400/[0.07] px-4 py-3 ring-1 ring-inset ring-emerald-400/20">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">In bank</p>
              <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-white">{totalCount.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500">{bankSubjects.filter(sub => sub.count > 0).length} subjects</p>
            </div>

            {bankSubjects.map(subject => {
              const active = filters.subject.includes(subject.key);
              const share = totalCount ? (subject.count / totalCount) * 100 : 0;
              return (
                <button
                  key={subject.key}
                  type="button"
                  onClick={() =>
                    setFilter('subject', active ? filters.subject.filter(v => v !== subject.key) : [...filters.subject, subject.key])
                  }
                  aria-pressed={active}
                  title={active ? `Remove ${subject.label} filter` : `Show ${subject.label} questions`}
                  className={`group rounded-xl px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
                    active
                      ? 'bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/50 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.7)]'
                      : 'bg-white/[0.03] ring-1 ring-inset ring-white/10 hover:-translate-y-px hover:bg-white/[0.06] hover:ring-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${SUBJECT_DOTS[subject.key] ?? 'bg-gray-500'}`} />
                    <span className={`flex-1 truncate text-xs font-semibold ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                      {subject.label}
                    </span>
                    {active && (
                      <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-black tabular-nums tracking-tight text-white">{subject.count.toLocaleString()}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-gray-500">{share < 1 && share > 0 ? '<1' : Math.round(share)}%</span>
                  </span>
                  <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${SUBJECT_DOTS[subject.key] ?? 'bg-gray-500'} transition-all duration-500`}
                      style={{ width: `${Math.max(share, subject.count > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Share of the bank per subject, as an accent along the card's bottom edge */}
        <div className="flex h-1 w-full" aria-hidden="true">
          {bankSubjects.map(subject => (
            <span
              key={subject.key}
              className={`${SUBJECT_DOTS[subject.key] ?? 'bg-gray-500'} h-full opacity-80 transition-all duration-500`}
              style={{ width: `${totalCount ? (subject.count / totalCount) * 100 : 0}%` }}
            />
          ))}
        </div>
      </div>

      {/* relative z-20: backdrop-blur makes this card its own stacking context; keep it above the table. */}
      <div className="relative z-20 rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 ring-1 ring-inset ring-white/[0.07] backdrop-blur-md shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-col md:flex-row gap-3 p-4">
          <div className="flex-1 relative flex items-center min-w-0">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder={searchType === 'text' ? 'Search question text…' : 'Search by question ID…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-11 rounded-xl bg-black/25 pl-12 pr-28 text-sm text-white placeholder-gray-500 ring-1 ring-inset ring-white/10 outline-none transition-all duration-200 hover:ring-white/20 focus:bg-black/35 focus:ring-emerald-400/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
            />
            <div className="absolute right-1.5 flex items-center rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-inset ring-white/10" role="group" aria-label="Search by">
              {(['text', 'id'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSearchType(type)}
                  aria-pressed={searchType === type}
                  className={`px-2.5 py-1.5 text-[10px] tracking-wide font-extrabold rounded-md transition-all ${
                    searchType === type ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.8)]' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {type === 'text' ? 'TEXT' : 'ID'}
                </button>
              ))}
            </div>
          </div>

          <label className="h-11 shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-3.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:ring-white/20 focus-within:ring-emerald-400/60 cursor-pointer">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h13M3 12h9m-9 5h5m9-9v12m0 0l-3-3m3 3l3-3" />
            </svg>
            Sort
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortMode)}
              className="bg-transparent pr-1 text-[13px] font-semibold text-white outline-none cursor-pointer"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                <option key={mode} value={mode} className="bg-gray-800">{SORT_LABELS[mode]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-white/[0.06]">
          <span className="flex items-center gap-1.5 pr-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            <FunnelIcon className="h-4 w-4 text-green-500" />
            Filters
          </span>
          {FACET_DIMS.map((dim, i) => (
            <React.Fragment key={dim.key}>
              {dim.secondary && !FACET_DIMS[i - 1]?.secondary && (
                <span className="hidden sm:block h-5 w-px bg-gray-700 mx-1" aria-hidden="true" />
              )}
              <MultiSelectDropdown
                title={dim.title}
                label={dim.label}
                options={optionsFor(dim.key)}
                selectedValues={filters[dim.key]}
                onChange={values => setFilter(dim.key, values)}
                singleLabel={dim.singleLabel}
                dotFor={dim.dotFor}
                icon={<FilterIcon d={FILTER_ICONS[dim.key]} />}
                showCounts={!search.trim()}
              />
            </React.Fragment>
          ))}
        </div>

        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-black/20 rounded-b-2xl animate-menu-in">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 pr-1">Active</span>
            {search.trim() && (
              <ActiveChip label={`${searchType === 'id' ? 'ID' : 'Text'}: “${search.trim()}”`} onRemove={() => setSearch('')} />
            )}
            {FACET_DIMS.flatMap(dim =>
              filters[dim.key].map(key => {
                const option = { value: key, label: facetIndex[dim.key].get(key)?.label ?? key, count: 0 };
                return (
                  <ActiveChip
                    key={`${dim.key}:${key}`}
                    label={dim.singleLabel ? dim.singleLabel(option) : `${dim.label}: ${option.label}`}
                    dot={dim.dotFor?.(key)}
                    onRemove={() => setFilter(dim.key, filters[dim.key].filter(v => v !== key))}
                  />
                );
              })
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Clear all ({activeFilterCount})
            </button>
          </div>
        )}
      </div>

      {hasAnyFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-400" aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                Updating results…
              </span>
            ) : (
              <>
                Showing <span className="font-bold text-white tabular-nums">{questions.length.toLocaleString()}</span> of{' '}
                <span className="font-bold text-emerald-400 tabular-nums">{filteredTotalCount.toLocaleString()}</span> matching questions
              </>
            )}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(subjectCounts)
              .sort(([x], [y]) => {
                const ix = SUBJECT_ORDER.indexOf(x), iy = SUBJECT_ORDER.indexOf(y);
                return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x.localeCompare(y);
              })
              .map(([sub, count]) => (
                <span
                  key={sub}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    SUBJECT_COLORS[sub] || 'text-gray-400 bg-gray-800 border-gray-700'
                  }`}
                >
                  {sub} <span className="tabular-nums text-white/90">{count.toLocaleString()}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {selectedIds.size} Selected
            </div>
            <span className="text-sm text-gray-300">
              {selectedIds.size === 1 ? '1 question selected' : `${selectedIds.size} questions selected`}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDownloadPreview(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-900/20"
            >
              Download
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-red-900/20"
            >
              <TrashIcon className="h-4 w-4" /> Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-800">
              <th className="p-5 w-14">
                <div className="flex items-center justify-center">
                  <label className="relative flex items-center cursor-pointer">
                    <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-gray-600 rounded bg-gray-800/80 peer-checked:bg-red-500 peer-checked:border-red-500 hover:border-gray-500 transition-all flex items-center justify-center relative">
                      {isSomeSelected && !isAllSelected ? (
                        <div className="w-2.5 h-0.5 bg-white rounded-full"></div>
                      ) : (
                        <svg
                          className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>
              </th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[45%]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAllRows}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                      allVisibleExpanded
                        ? 'bg-green-500/15 border-green-500 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                    title={allVisibleExpanded ? 'Collapse all visible questions' : 'Expand all visible questions'}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-300 ${allVisibleExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <span>Question</span>
                </div>
              </th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[20%]">
                Metadata
              </th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">
                Status
              </th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right w-[15%]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/50">
            {!hasAnyFilter ? (
              <tr>
                <td colSpan={5} className="p-14 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-800 flex items-center justify-center mb-4 border border-gray-700">
                      <FunnelIcon className="h-6 w-6 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Start filtering to view questions</h3>
                    <p className="text-sm text-gray-400">
                      The question bank stays blank until you apply filters. Choose any filter above to load matching questions.
                    </p>
                  </div>
                </td>
              </tr>
            ) : loading && questions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-gray-500">
                  Loading questions...
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-gray-500">
                  No questions found matching your criteria.
                </td>
              </tr>
            ) : (
              questions.map(q => {
                const isExpanded = expandedRows.has(q.id!);
                const correctOptionIndex = getCorrectOptionIndex(q);

                return (
                  <React.Fragment key={q.id}>
                    <tr
                      className={`group transition-colors ${
                        selectedIds.has(q.id!) ? 'bg-red-500/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="p-5 text-center align-top">
                        <label className="relative inline-flex items-center cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id!)}
                            onChange={() => toggleSelectOne(q.id!)}
                            className="peer sr-only"
                          />
                          <div className="w-5 h-5 border-2 border-gray-600 rounded bg-gray-800/80 peer-checked:bg-red-500 peer-checked:border-red-500 hover:border-gray-500 transition-all flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </td>

                      <td className="p-5 align-top">
                        <div className="flex gap-3">
                          {q.imageUrl ? (
                            <PhotoIcon className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-5 shrink-0" />
                          )}

                          <div>
                            <div
                              className="text-sm text-gray-200 line-clamp-2 font-medium leading-relaxed cursor-pointer hover:text-green-400 transition-colors prose prose-invert max-w-none"
                              onClick={() => toggleRowExpansion(q.id!)}
                            >
                              {q.question ? (
                                <RichMathText text={q.question} />
                              ) : (
                                <span className="italic text-gray-500">(Image-based question)</span>
                              )}
                            </div>

                            {getQuestionImages(q as any).length > 0 ? (
                              <div className="mt-2">
                                <McqImageList
                                  images={getQuestionImages(q as any)}
                                  alt="Question"
                                  className="flex flex-wrap gap-2"
                                />
                              </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="bg-gray-800 text-[10px] text-gray-400 px-1.5 py-0.5 rounded font-mono border border-gray-700">
                                {q.question_code || 'No Code'}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                                • {q.topic} {q.sub_topic && `> ${q.sub_topic}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 align-top">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${
                              SUBJECT_COLORS[q.subject] || 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {q.subject}
                          </span>
                          <span className="text-[10px] text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded-full border border-gray-700/50">
                            G{q.grade} • {q.difficulty} • {q.question_type || 'Question Skill'}
                          </span>
                        </div>
                      </td>

                      <td className="p-5 align-top">
                        {q.isFlagged ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 animate-pulse">
                            <FlagIcon className="h-3.5 w-3.5" /> Flagged
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-medium">Clean</span>
                        )}
                      </td>

                      <td className="p-5 align-top text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleRowExpansion(q.id!)}
                            className={`p-2 rounded-lg transition ${
                              isExpanded ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                            title="Preview Options"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          <button
                            onClick={() => onEdit(q)}
                            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => (q.isFlagged ? handleUnflag(q.id!) : setFlaggingId(q.id!))}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                            title="Flag"
                          >
                            <FlagIcon className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(q.id!)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-black/20 border-b border-gray-800/50">
                        <td colSpan={5} className="px-5 pb-6 pt-2">
                          <div className="ml-[3.25rem] max-w-4xl animate-scale-in">
                            {q.options && q.options.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {q.options.map((opt, idx) => {
                                  // Keep consistent correctness + option highlighting even when option text is empty.
                                  const optionText = opt;
                                  const optionImages = getOptionImages(q as any, idx);
                                  const hasTextOpt = !!String(optionText ?? '').trim();

                                  // Keep text-only MCQ behavior, but do NOT hide image-only options.
                                  if (!hasTextOpt && optionImages.length === 0) return null;

                                  const isCorrect = correctOptionIndex === idx;

                                  return (
                                    <div
                                      key={idx}
                                      className={`relative flex flex-col p-3.5 rounded-xl border transition-all ${
                                        isCorrect
                                          ? 'bg-green-500/10 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                                          : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/60'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-1 ${
                                            isCorrect ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'
                                          }`}
                                        >
                                          {String.fromCharCode(65 + idx)}
                                        </span>

                                        <div className="flex-1">
                                          {hasTextOpt ? (
                                            <span
                                              className={`text-sm leading-relaxed block ${
                                                isCorrect ? 'text-green-400 font-semibold' : 'text-gray-300'
                                              }`}
                                            >
                                              <RichMathText text={optionText} />
                                            </span>
                                          ) : null}

                                          {optionImages.length > 0 ? (
                                            <McqImageList
                                              images={optionImages}
                                              alt={`Option ${String.fromCharCode(65 + idx)}`}
                                              className="flex flex-wrap gap-2 mt-2"
                                            />
                                          ) : null}
                                        </div>
                                      </div>

                                      {isCorrect && (
                                        <svg
                                          className="w-5 h-5 text-green-500 absolute right-4 top-4 drop-shadow-md"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-2 text-sm text-gray-500 italic">No options available for this question.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {!loading && questions.length > 0 && hasMore && (
          <div ref={loadMoreRef} className="p-6 flex flex-col items-center gap-3 bg-gray-900/20 border-t border-gray-800">
            {loadingMore ? (
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm font-medium">Loading more...</span>
              </div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2"
              >
                Load More
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {showBulkDeleteConfirm && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Delete Multiple Questions</h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete <span className="text-red-500 font-bold">{selectedIds.size}</span>{' '}
              {selectedIds.size === 1 ? 'question' : 'questions'}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="text-gray-400 font-bold text-sm hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
              >
                Delete {selectedIds.size} {selectedIds.size === 1 ? 'Question' : 'Questions'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {flaggingId && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Flag Question</h3>
            <p className="text-sm text-gray-400 mb-4">Why are you flagging this question?</p>
            <textarea
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason..."
              className="w-full p-4 bg-black/50 border border-gray-700 rounded-2xl text-white resize-none mb-6 focus:border-red-500 outline-none"
              rows={4}
            />
            <div className="flex justify-end gap-4">
              <button onClick={() => setFlaggingId(null)} className="text-gray-400 font-bold text-sm hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={confirmFlag}
                className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
              >
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {showDownloadPreview && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl rounded-3xl p-8 animate-scale-in shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">Preview Selected Questions</h3>
                <p className="text-sm text-gray-400">Review your selection before downloading.</p>
              </div>
              <button onClick={() => setShowDownloadPreview(false)} className="text-gray-400 hover:text-white transition">
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {selectedQuestions.map((q, index) => (
                <div key={q.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Question {index + 1}</div>
                      <RichMathText as="div" className="text-sm text-white font-medium prose prose-invert max-w-none" text={q.question} />
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded-lg">
                      {q.question_code || 'No Code'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setShowDownloadPreview(false)}
                className="text-gray-400 font-bold text-sm hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadContinue}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {showFormatModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Choose Download Format</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setDownloadFormat('pdf')}
                className={`px-4 py-4 rounded-2xl border transition ${
                  downloadFormat === 'pdf'
                    ? 'bg-red-500/15 border-red-500 text-red-400'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => setDownloadFormat('docx')}
                className={`px-4 py-4 rounded-2xl border transition ${
                  downloadFormat === 'docx'
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Docx
              </button>
            </div>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowFormatModal(false)} className="text-gray-400 font-bold text-sm hover:text-white transition">
                Cancel
              </button>
              <button
                disabled={!downloadFormat}
                onClick={handleDownload}
                className="bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-green-700 transition"
              >
                Download
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default QuestionBank;