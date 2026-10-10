import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon } from '../icons';
import { placeMenu, MenuPlacement } from './placeMenu';

// Premium single-choice menu (form-field sized), the single-select sibling of MultiSelectDropdown.

export interface SelectMenuOption {
  value: string;
  label: string;
  /** Secondary text shown under the label, e.g. a paper's subject. */
  hint?: string;
  /** Leading visual for this option (e.g. an institute logo); replaces the field icon when selected. */
  media?: React.ReactNode;
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder: string;
  /** Menu heading, e.g. "Institutes". */
  title: string;
  icon?: React.ReactNode;
  /** An explicit "none" choice shown first (e.g. "No institute — public link"). */
  emptyOption?: SelectMenuOption;
}

const SelectMenu: React.FC<SelectMenuProps> = ({ value, onChange, options, placeholder, title, icon, emptyOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState<MenuPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all = emptyOption ? [emptyOption, ...options] : options;
  const searchable = options.length > 5;
  const visible = query.trim() ? all.filter(o => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : all;
  const selected = all.find(o => o.value === value);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 280);
      // Header (+ search box when shown) above the list.
      setPos(placeMenu(r, width, searchable ? 96 : 52));
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
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    setActiveIndex(Math.max(0, all.findIndex(o => o.value === value)));
    requestAnimationFrame(() => (menuRef.current?.querySelector('input') ?? menuRef.current)?.focus());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, close]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const choose = (v: string) => {
    onChange(v);
    close(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visible[activeIndex]) choose(visible[activeIndex].value);
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
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex h-11 w-full items-center gap-3 rounded-xl px-4 text-left text-sm transition-all duration-200 ${
          isOpen ? 'bg-black/35 ring-1 ring-emerald-400/60 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : 'bg-black/25 ring-1 ring-inset ring-white/10 hover:ring-white/20'
        }`}
      >
        {selected?.media ? (
          <span className="shrink-0">{selected.media}</span>
        ) : (
          icon && <span className={`shrink-0 ${selected && selected.value ? 'text-emerald-300' : 'text-gray-500'}`}>{icon}</span>
        )}
        <span className={`flex-1 truncate ${selected ? 'font-semibold text-white' : 'text-gray-500'}`}>{selected ? selected.label : placeholder}</span>
        {selected?.hint && <span className="hidden sm:inline truncate text-xs text-gray-500">{selected.hint}</span>}
        <svg className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-300' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
          aria-label={title}
          onKeyDown={onKeyDown}
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}
          className="fixed z-[60] overflow-hidden rounded-2xl bg-[#0d131d]/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] outline-none animate-menu-in"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <p className="px-4 pt-3.5 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">{title}</p>
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
          <div ref={listRef} style={{ maxHeight: pos.listMaxHeight }} className="overflow-y-auto custom-scrollbar px-1.5 pb-1.5">
            {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-gray-500">No matches</p>}
            {visible.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <div
                  key={o.value || '__none'}
                  role="option"
                  aria-selected={isSelected}
                  data-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(o.value)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-emerald-500/[0.09]' : i === activeIndex ? 'bg-white/[0.05]' : ''
                  }`}
                >
                  {o.media && <span className="shrink-0">{o.media}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${isSelected ? 'font-semibold text-white' : o.value ? 'text-gray-200' : 'text-gray-400'}`}>{o.label}</span>
                    {o.hint && <span className="block truncate text-[11px] text-gray-500">{o.hint}</span>}
                  </span>
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
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

export default SelectMenu;
