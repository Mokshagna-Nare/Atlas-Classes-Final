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

import { supabase } from '../../../../services/supabase';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface QuestionBankProps {
  onEdit: (mcq: MCQ) => void;
}

const ITEMS_PER_PAGE = 20;

interface MultiSelectProps {
  title: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({
  title,
  options,
  selectedValues,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) onChange(selectedValues.filter(v => v !== option));
    else onChange([...selectedValues, option]);
  };

  const hasSelection = selectedValues.length > 0;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 flex-none bg-gray-800 border ${
          isOpen ? 'border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,.25)]' : 'border-gray-700'
        } text-xs font-bold text-white rounded-xl px-4 outline-none transition-all flex items-center justify-between gap-3 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-gray-500 hover:bg-gray-700/50'
        } min-w-[150px] max-w-[180px] shadow-sm`}
      >
        <span className={`truncate ${hasSelection ? 'text-white' : 'text-gray-400'}`}>
          {hasSelection ? `${selectedValues.length} ${title}` : `Select ${title}`}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${
            isOpen ? 'rotate-180 text-green-500' : 'text-gray-400'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 w-60 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-scale-in">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700/50 cursor-pointer transition-colors group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={!hasSelection}
                  onChange={() => onChange([])}
                  className="peer sr-only"
                />
                <div className="w-4 h-4 border-2 border-gray-500 rounded bg-gray-900 peer-checked:bg-green-500 peer-checked:border-green-500 group-hover:border-gray-400 transition-all flex items-center justify-center">
                  <svg
                    className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <span className={`text-sm ${!hasSelection ? 'text-white font-semibold' : 'text-gray-300'}`}>
                Select {title}
              </span>
            </label>

            {options.map(option => (
              <label
                key={option}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700/50 cursor-pointer transition-colors group"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 border-2 border-gray-500 rounded bg-gray-900 peer-checked:bg-green-500 peer-checked:border-green-500 group-hover:border-gray-400 transition-all flex items-center justify-center">
                    <svg
                      className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span
                  className={`text-sm truncate ${
                    selectedValues.includes(option) ? 'text-white font-semibold' : 'text-gray-300'
                  }`}
                >
                  {option}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SUBJECT_COLORS: Record<string, string> = {
  Physics: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Chemistry: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Biology: 'text-green-400 bg-green-500/10 border-green-500/20',
  Mathematics: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
};

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

const QuestionBank: React.FC<QuestionBankProps> = ({ onEdit }) => {
  const { deleteMCQ, flagMCQ, unflagMCQ } = useData();

  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'text' | 'id'>('text');

  const [filterGrades, setFilterGrades] = useState<string[]>([]);
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [filterTopics, setFilterTopics] = useState<string[]>([]);
  const [filterSubTopics, setFilterSubTopics] = useState<string[]>([]);
  const [filterDifficulties, setFilterDifficulties] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterFlags, setFilterFlags] = useState<string[]>([]);

  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number>(0);

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSubTopics, setAvailableSubTopics] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingSubTopics, setLoadingSubTopics] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showDownloadPreview, setShowDownloadPreview] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const applyBaseFilters = useCallback(
    (query: any) => {
      if (filterGrades.length > 0) query = query.in('grade', filterGrades);
      if (filterSubjects.length > 0) query = query.in('subject', filterSubjects);
      if (filterTopics.length > 0) query = query.in('topic', filterTopics);
      if (filterSubTopics.length > 0) query = query.in('sub_topic', filterSubTopics);
      if (filterDifficulties.length > 0) query = query.in('difficulty', filterDifficulties);
      if (filterTypes.length > 0) query = query.in('question_type', filterTypes);

      if (filterFlags.length === 1) {
        if (filterFlags.includes('Flagged')) query = query.eq('isFlagged', true);
        if (filterFlags.includes('Clean')) query = query.eq('isFlagged', false);
      }

      if (search.trim()) {
        if (searchType === 'text') query = query.ilike('question', `%${search.trim()}%`);
        else query = query.ilike('question_code', `%${search.trim()}%`);
      }

      return query;
    },
    [
      filterGrades,
      filterSubjects,
      filterTopics,
      filterSubTopics,
      filterDifficulties,
      filterTypes,
      filterFlags,
      search,
      searchType
    ]
  );

  const hasAnyFilter = useMemo(
    () =>
      filterGrades.length > 0 ||
      filterSubjects.length > 0 ||
      filterTopics.length > 0 ||
      filterSubTopics.length > 0 ||
      filterDifficulties.length > 0 ||
      filterTypes.length > 0 ||
      filterFlags.length > 0 ||
      search.trim().length > 0,
    [
      filterGrades,
      filterSubjects,
      filterTopics,
      filterSubTopics,
      filterDifficulties,
      filterTypes,
      filterFlags,
      search
    ]
  );

  const fetchSubjectCounts = useCallback(async () => {
    const subjectsToCount =
      filterSubjects.length > 0 ? filterSubjects : ['Physics', 'Chemistry', 'Biology', 'Mathematics'];

    const newCounts: Record<string, number> = {};

    await Promise.all(
      subjectsToCount.map(async sub => {
        let query = supabase.from('mcqs').select('*', { count: 'exact', head: true }).eq('subject', sub);
        query = applyBaseFilters(query);
        const { count } = await query;
        if (count !== null && count > 0) newCounts[sub] = count;
      })
    );

    setSubjectCounts(newCounts);
  }, [applyBaseFilters, filterSubjects]);

  const fetchQuestions = useCallback(
    async (page: number, append: boolean = false) => {
      if (!hasAnyFilter) {
        setQuestions([]);
        setFilteredTotalCount(0);
        setHasMore(false);
        return;
      }

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        let query = supabase
          .from('mcqs')
          .select('*', { count: 'exact' })
          .order('createdAt', { ascending: false })
          .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

        query = applyBaseFilters(query);

        const { data, error, count } = await query;
        if (error) throw error;

        if (data) {
          const fetchedIds = data.map((d: any) => d.id!);

          if (append) {
            setQuestions(prev => [...prev, ...(data as MCQ[])]);
            setExpandedRows(prev => new Set([...prev, ...fetchedIds]));
          } else {
            setQuestions(data as MCQ[]);
            setExpandedRows(new Set(fetchedIds));
          }

          if (count !== null) {
            setFilteredTotalCount(count);
            setHasMore((page + 1) * ITEMS_PER_PAGE < count);
          }
        }

        if (!append) fetchSubjectCounts();
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [applyBaseFilters, fetchSubjectCounts, hasAnyFilter]
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      const { count } = await supabase.from('mcqs').select('*', { count: 'exact', head: true });
      if (count !== null) setTotalCount(count);

      const { data: typeData } = await supabase.from('mcqs').select('question_type, topic, sub_topic');

      if (typeData) {
        const typedTypeData = typeData as {
          question_type: string | null;
          topic: string | null;
          sub_topic: string | null;
        }[];

        setAvailableTypes(
          Array.from(
            new Set(
              typedTypeData
                .map((d: { question_type: string | null }) => d.question_type)
                .filter((value): value is string => Boolean(value))
            )
          ).sort()
        );

        setAvailableTopics(
          Array.from(
            new Set(
              typedTypeData
                .map((d: { topic: string | null }) => d.topic)
                .filter((value): value is string => Boolean(value))
            )
          ).sort()
        );

        setAvailableSubTopics(
          Array.from(
            new Set(
              typedTypeData
                .map((d: { sub_topic: string | null }) => d.sub_topic)
                .filter((value): value is string => Boolean(value))
            )
          ).sort()
        );
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchTopics = async () => {
      if (filterSubjects.length === 0) return;

      setLoadingTopics(true);

      try {
        const { data } = await supabase.from('mcqs').select('topic').in('subject', filterSubjects);

        if (data) {
          const typedData = data as { topic: string | null }[];

          const uniqueTopics = Array.from(
            new Set(
              typedData
                .map((item: { topic: string | null }) => item.topic)
                .filter((value): value is string => Boolean(value))
            )
          ).sort();

          setAvailableTopics(uniqueTopics);
          setFilterTopics(prev => prev.filter(t => uniqueTopics.includes(t)));
        }
      } finally {
        setLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [filterSubjects]);

  useEffect(() => {
    const fetchSubTopics = async () => {
      let query: any = supabase.from('mcqs').select('sub_topic');

      if (filterSubjects.length > 0) query = query.in('subject', filterSubjects);
      if (filterTopics.length > 0) query = query.in('topic', filterTopics);

      setLoadingSubTopics(true);

      try {
        const { data } = await query;

        if (data) {
          const typedData = data as { sub_topic: string | null }[];

          const uniqueSubTopics = Array.from(
            new Set(
              typedData
                .map((item: { sub_topic: string | null }) => item.sub_topic)
                .filter((value): value is string => Boolean(value))
            )
          ).sort();

          setAvailableSubTopics(uniqueSubTopics);
          setFilterSubTopics(prev => prev.filter(t => uniqueSubTopics.includes(t)));
        }
      } finally {
        setLoadingSubTopics(false);
      }
    };

    fetchSubTopics();
  }, [filterSubjects, filterTopics]);

  useEffect(() => {
    setCurrentPage(0);
    setQuestions([]);
    setHasMore(true);
  }, [
    filterGrades,
    filterSubjects,
    filterTopics,
    filterSubTopics,
    filterDifficulties,
    filterTypes,
    filterFlags,
    search,
    searchType
  ]);

  useEffect(() => {
    const timer = setTimeout(() => fetchQuestions(0, false), 250);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchQuestions(nextPage, true);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) handleLoadMore();
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [hasMore, loadingMore, loading, currentPage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [questions]);

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
    setCurrentPage(0);
    fetchQuestions(0, false);

    const { count } = await supabase.from('mcqs').select('*', { count: 'exact', head: true });
    if (count !== null) setTotalCount(count);
  };

  const confirmFlag = async () => {
    if (flaggingId) {
      await flagMCQ(flaggingId, reason);
      setFlaggingId(null);
      setReason('');
      setCurrentPage(0);
      fetchQuestions(0, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteMCQ(id);
      setCurrentPage(0);
      fetchQuestions(0, false);
      setTotalCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleUnflag = async (id: string) => {
    await unflagMCQ(id);
    setCurrentPage(0);
    fetchQuestions(0, false);
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
        const questionLines = doc.splitTextToSize(`${index + 1}. ${q.question}`, 170);
        doc.setFontSize(12);
        doc.text(questionLines, 20, y);
        y += questionLines.length * 7;

        if (q.options?.length) {
          q.options.forEach((opt, optIndex) => {
            const optionLabel = `${String.fromCharCode(65 + optIndex)}. ${opt}`;
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
                text: `${index + 1}. ${q.question}`,
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
                text: `${String.fromCharCode(65 + optIndex)}. ${opt}`,
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
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 w-full">
        <div>
          <h2 className="text-3xl font-extrabold mb-2">Question Bank</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <InformationCircleIcon className="h-4 w-4" />
              Manage and review your MCQ repository
            </span>
            <span className="bg-gray-800 px-3 py-1 rounded-full text-xs font-mono text-gray-300 border border-gray-700 shadow-sm">
              Showing <span className="text-white font-bold">{questions.length}</span> /{' '}
              <span className="text-green-500 font-bold">{filteredTotalCount}</span> Filtered (
              <span className="text-gray-500">{totalCount}</span> Total)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(subjectCounts).map(([sub, count]) => (
            <div
              key={sub}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                SUBJECT_COLORS[sub] || 'text-gray-400 bg-gray-800 border-gray-700'
              }`}
            >
              {sub} <span className="bg-black/20 px-1.5 py-0.5 rounded text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800 backdrop-blur-md overflow-visible">
        <div className="flex-1 relative flex items-center min-w-[280px] max-w-full">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 text-gray-500" />
          <input
            type="text"
            placeholder={searchType === 'text' ? 'Search question text...' : 'Search by Question ID...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-sm rounded-xl py-3 pl-12 pr-32 focus:border-green-500 outline-none text-white placeholder-gray-500 transition-all shadow-inner"
          />
          <div className="absolute right-2 flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700 shadow-md">
            <button
              onClick={() => setSearchType('text')}
              className={`px-3 py-1.5 text-[10px] tracking-wide font-extrabold rounded-md transition-all ${
                searchType === 'text'
                  ? 'bg-green-500 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              TEXT
            </button>
            <button
              onClick={() => setSearchType('id')}
              className={`px-3 py-1.5 text-[10px] tracking-wide font-extrabold rounded-md transition-all ${
                searchType === 'id'
                  ? 'bg-green-500 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              ID
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-start">
          <FunnelIcon className="h-5 w-5 text-green-500 hidden xl:block mr-1" />
          <MultiSelectDropdown title="Grades" options={['10', '11', '12']} selectedValues={filterGrades} onChange={setFilterGrades} />
          <MultiSelectDropdown
            title="Subjects"
            options={['Physics', 'Chemistry', 'Biology', 'Mathematics']}
            selectedValues={filterSubjects}
            onChange={setFilterSubjects}
          />
          <MultiSelectDropdown
            title="Topics"
            options={availableTopics}
            selectedValues={filterTopics}
            onChange={setFilterTopics}
            disabled={loadingTopics}
          />
          <MultiSelectDropdown
            title="Sub-topics"
            options={availableSubTopics}
            selectedValues={filterSubTopics}
            onChange={setFilterSubTopics}
            disabled={loadingSubTopics}
          />
          <MultiSelectDropdown
            title="Difficulty"
            options={['Easy', 'Medium', 'Hard']}
            selectedValues={filterDifficulties}
            onChange={setFilterDifficulties}
          />
          <MultiSelectDropdown
            title="Question Skill type"
            options={availableTypes}
            selectedValues={filterTypes}
            onChange={setFilterTypes}
            disabled={availableTypes.length === 0}
          />
          <MultiSelectDropdown
            title="Status"
            options={['Flagged', 'Clean']}
            selectedValues={filterFlags}
            onChange={setFilterFlags}
          />
        </div>
      </div>

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
                                <span dangerouslySetInnerHTML={{ __html: q.question }} />
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
                                              {optionText}
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
      )}

      {flaggingId && (
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
      )}

      {showDownloadPreview && (
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
                      <div className="text-sm text-white font-medium prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: q.question }} />
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
      )}

      {showFormatModal && (
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
      )}
    </div>
  );
};

export default QuestionBank;