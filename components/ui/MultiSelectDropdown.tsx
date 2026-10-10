import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon } from '../icons';
import { placeMenu, MenuPlacement } from './placeMenu';

// Premium multi-select used by the Question Bank filters and Create Online Test.

export interface FilterOption {
  value: string;
  label: string;
  /** Questions matching this option together with every *other* active filter. */
  count: number;
}

export interface MultiSelectProps {
  /** Plural heading inside the menu, e.g. "Grades". */
  title: string;
  /** Singular name on the button, e.g. "Grade". */
  label: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  /** Label for the button when exactly one option is selected, e.g. "Grade 11". */
  singleLabel?: (option: FilterOption) => string;
  /** Optional colour dot per option (subjects, difficulty). */
  dotFor?: (value: string) => string | undefined;
  /** Counts can't account for a free-text search, so they are hidden while one is active. */
  showCounts?: boolean;
  disabled?: boolean;
  /** Shown as the button tooltip while disabled. */
  disabledHint?: string;
}

const CheckMark: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] transition-all duration-200 ${
      checked
        ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/60'
        : 'bg-black/30 ring-1 ring-inset ring-white/15 group-hover:ring-white/30'
    }`}
    aria-hidden="true"
  >
    <svg
      className={`h-3 w-3 text-gray-950 transition-all duration-200 ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({
  title, label, icon, options, selectedValues, onChange, singleLabel, dotFor, showCounts = true, disabled = false, disabledHint,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<MenuPlacement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The menu is portaled to <body> with fixed positioning, so no ancestor stacking
  // context (backdrop-blur, transforms, animations) can paint the results table over it.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      // Header (+ search box) above the list, Clear/Done footer below it.
      if (rect) setMenuPos(placeMenu(rect, 288, (options.length > 8 ? 96 : 52) + 56));
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
    if (refocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    setActiveIndex(0);
    // Focus the menu (or its search box) so the keyboard works straight away.
    requestAnimationFrame(() => {
      const search = menuRef.current?.querySelector('input');
      (search ?? menuRef.current)?.focus();
    });
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) onChange(selectedValues.filter(v => v !== value));
    else onChange([...selectedValues, value]);
  };

  const hasSelection = selectedValues.length > 0;
  const searchable = options.length > 8;
  const visibleOptions = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(0, visibleOptions.length - 1)));
  }, [visibleOptions.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || (e.key === ' ' && !(e.target instanceof HTMLInputElement))) {
      e.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) toggleOption(option.value);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const singleSelected = selectedValues.length === 1 ? options.find(o => o.value === selectedValues[0]) : undefined;
  const buttonLabel = singleSelected ? (singleLabel ? singleLabel(singleSelected) : singleSelected.label) : label;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={disabled ? disabledHint : hasSelection ? options.filter(o => selectedValues.includes(o.value)).map(o => o.label).join(', ') : undefined}
        className={`group h-9 inline-flex disabled:cursor-not-allowed disabled:opacity-40 items-center gap-2 rounded-xl pl-3 pr-2.5 text-[13px] font-semibold tracking-tight transition-all duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 max-w-[230px] ${
          isOpen
            ? 'bg-white/[0.08] text-white ring-1 ring-emerald-400/70 shadow-[0_0_0_4px_rgba(16,185,129,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]'
            : hasSelection
              ? 'bg-gradient-to-b from-emerald-400/[0.18] to-emerald-500/[0.08] text-emerald-100 ring-1 ring-inset ring-emerald-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_18px_-8px_rgba(16,185,129,0.55)] hover:ring-emerald-300/60'
              : 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-gray-300 ring-1 ring-inset ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.35)] hover:text-white hover:ring-white/20 hover:from-white/[0.09] hover:-translate-y-px'
        }`}
      >
        {icon && (
          <span className={`shrink-0 transition-colors ${hasSelection || isOpen ? 'text-emerald-300' : 'text-gray-500 group-hover:text-gray-300'}`}>
            {icon}
          </span>
        )}
        <span className="truncate">{buttonLabel}</span>
        {selectedValues.length > 1 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-400 text-[11px] font-black text-gray-950 flex items-center justify-center tabular-nums shadow-[0_0_10px_-2px_rgba(16,185,129,0.8)]">
            {selectedValues.length}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-emerald-300' : 'text-gray-500 group-hover:text-gray-300'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          aria-multiselectable="true"
          aria-label={title}
          onKeyDown={onMenuKeyDown}
          style={{ top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left }}
          className={`fixed z-[60] w-72 ${menuPos.above ? 'origin-bottom-left' : 'origin-top-left'} overflow-hidden rounded-2xl bg-[#0d131d]/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(16,185,129,0.05)] outline-none animate-menu-in`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">{title}</span>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
              {hasSelection ? <span className="text-emerald-300">{selectedValues.length} selected</span> : `${options.length} options`}
            </span>
          </div>

          {searchable && (
            <div className="px-3 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={`Search ${title.toLowerCase()}…`}
                  className="w-full rounded-lg bg-black/30 py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 ring-1 ring-inset ring-white/10 outline-none transition focus:ring-emerald-400/50"
                />
              </div>
            </div>
          )}

          <div ref={listRef} style={{ maxHeight: menuPos.listMaxHeight }} className="overflow-y-auto custom-scrollbar px-1.5 pb-1.5">
            {visibleOptions.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-500">No matching {title.toLowerCase()}</p>
            )}
            {visibleOptions.map((option, index) => {
              const checked = selectedValues.includes(option.value);
              const empty = showCounts && option.count === 0 && !checked;
              const active = index === activeIndex;
              const dot = dotFor?.(option.value);
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={checked}
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => toggleOption(option.value)}
                  className={`group relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 ${
                    checked ? 'bg-emerald-500/[0.09]' : active ? 'bg-white/[0.05]' : ''
                  }`}
                >
                  <CheckMark checked={checked} />
                  {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
                  <span
                    className={`flex-1 truncate text-[13px] ${
                      checked ? 'font-semibold text-white' : empty ? 'text-gray-500' : 'text-gray-300 group-hover:text-white'
                    }`}
                    title={option.label}
                  >
                    {option.label}
                  </span>
                  {showCounts && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
                        checked ? 'bg-emerald-400/15 text-emerald-200' : empty ? 'text-gray-600' : 'bg-white/[0.05] text-gray-400'
                      }`}
                    >
                      {option.count.toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-black/20 px-3 py-2.5">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!hasSelection}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-3.5 py-1.5 text-xs font-bold text-gray-950 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:brightness-110 active:scale-[0.97]"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MultiSelectDropdown;
