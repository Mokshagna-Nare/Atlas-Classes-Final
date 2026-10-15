import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { placeMenu, MenuPlacement } from './placeMenu';
import { useQuestionSources, addCustomSource, cleanSource } from '../../hooks/useQuestionSources';
import { Svg, ICONS } from './admin';

// Pick a question's source from the known list, or type any new one and add it
// ("+ Add “Allen Module 3” as a source"). Same look and keyboard behaviour as SelectMenu.

interface SourcePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Compact trigger for toolbars (h-9 instead of h-11). */
  compact?: boolean;
}

type Row = { kind: 'none' } | { kind: 'add'; name: string } | { kind: 'source'; name: string; count: number };

const SourcePicker: React.FC<SourcePickerProps> = ({ value, onChange, placeholder = 'Choose or add a source', compact }) => {
  const sources = useQuestionSources();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<MenuPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = cleanSource(value);

  const rows = useMemo<Row[]>(() => {
    const q = cleanSource(query).toLowerCase();
    const matches = sources.filter(s => !q || s.name.toLowerCase().includes(q));
    const exact = sources.some(s => s.name.toLowerCase() === q);
    const list: Row[] = [];
    if (q && !exact) list.push({ kind: 'add', name: cleanSource(query) });
    if (!q) list.push({ kind: 'none' });
    for (const s of matches) list.push({ kind: 'source', name: s.name, count: s.count });
    return list;
  }, [sources, query]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos(placeMenu(r, Math.max(r.width, 300), 100));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  const close = useCallback((refocus = false) => {
    setIsOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
    requestAnimationFrame(() => menuRef.current?.querySelector('input')?.focus());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen, close]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const choose = (row: Row) => {
    if (row.kind === 'none') onChange('');
    else if (row.kind === 'add') onChange(addCustomSource(row.name));
    else onChange(row.name);
    close(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[activeIndex]) choose(rows[activeIndex]);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex ${compact ? 'h-9' : 'h-11'} w-full items-center gap-3 rounded-xl px-4 text-left text-sm transition-all duration-200 ${
          isOpen ? 'bg-black/35 ring-1 ring-emerald-400/60 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : 'bg-black/25 ring-1 ring-inset ring-white/10 hover:ring-white/20'
        }`}
      >
        <span className={`shrink-0 ${current ? 'text-emerald-300' : 'text-gray-500'}`}><Svg d={ICONS.book} /></span>
        <span className={`flex-1 truncate ${current ? 'font-semibold text-white' : 'text-gray-500'}`}>{current || placeholder}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-300' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Sources"
          onKeyDown={onKeyDown}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}
          className="fixed z-[90] overflow-hidden rounded-2xl bg-[#0d131d]/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] outline-none animate-menu-in"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <p className="px-4 pt-3.5 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Source</p>
          <div className="px-3 pb-2">
            <div className="relative">
              <Svg d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search, or type a new source…"
                className="w-full rounded-lg bg-black/30 py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 ring-1 ring-inset ring-white/10 outline-none transition focus:ring-emerald-400/50"
              />
            </div>
          </div>
          <div ref={listRef} style={{ maxHeight: pos.listMaxHeight }} className="overflow-y-auto custom-scrollbar px-1.5 pb-1.5">
            {rows.length === 0 && <p className="px-3 py-6 text-center text-xs text-gray-500">No matches</p>}
            {rows.map((row, i) => {
              const selected = row.kind === 'source' ? row.name.toLowerCase() === current.toLowerCase() : row.kind === 'none' && !current;
              return (
                <div
                  key={row.kind === 'source' ? row.name : row.kind}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(row)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    selected ? 'bg-emerald-500/[0.09]' : i === activeIndex ? 'bg-white/[0.05]' : ''
                  }`}
                >
                  {row.kind === 'add' ? (
                    <>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"><Svg d={ICONS.plus} className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-200">Add <span className="font-semibold text-white">“{row.name}”</span> as a new source</span>
                    </>
                  ) : row.kind === 'none' ? (
                    <span className="flex-1 text-[13px] text-gray-400">No source</span>
                  ) : (
                    <>
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${selected ? 'font-semibold text-white' : 'text-gray-200'}`}>{row.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-gray-500">{row.count ? `${row.count} question${row.count === 1 ? '' : 's'}` : 'new'}</span>
                    </>
                  )}
                  {selected && <Svg d={ICONS.check} className="h-4 w-4 shrink-0 text-emerald-400" />}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SourcePicker;
