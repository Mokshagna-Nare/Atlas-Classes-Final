import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Apple-style date & time picker: inline month calendar with circular day selection and
// iOS-style scroll wheels for the time. Value format matches <input type="datetime-local">
// ("YYYY-MM-DDTHH:mm", local time) so it drops in wherever that input was used.

const pad = (n: number) => String(n).padStart(2, '0');

interface Parts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number; // 0-23
  minute: number;
}

const parse = (value: string): Parts | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  if (!m) return null;
  return { year: +m[1], month: +m[2] - 1, day: +m[3], hour: +m[4], minute: +m[5] };
};

const format = (p: Parts) => `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;

const dayKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;

const IN_DATE = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Indian-style display, e.g. "Wed, 7 Oct 2026 · 1:00 PM". */
export const formatIndian = (p: Parts) => {
  const parts = Object.fromEntries(IN_DATE.formatToParts(new Date(p.year, p.month, p.day)).map(x => [x.type, x.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} · ${formatTimeIndian(p.hour, p.minute)}`;
};

const formatTimeIndian = (hour: number, minute: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ---------------------------------------------------------------------------
// Wheel
// ---------------------------------------------------------------------------

const ITEM_H = 32;
const VISIBLE = 3;

const Wheel: React.FC<{
  items: string[];
  index: number;
  onChange: (index: number) => void;
  label: string;
  width?: string;
  /** Items that would land before the allowed minimum: greyed out and not selectable. */
  isDisabled?: (index: number) => boolean;
}> = ({ items, index, onChange, label, width = 'w-14', isDisabled }) => {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const [live, setLive] = useState(index);

  // Follow external changes (e.g. picking "Today") without fighting an in-progress scroll.
  useLayoutEffect(() => {
    const align = () => {
      const el = ref.current;
      if (el && Math.round(el.scrollTop / ITEM_H) !== index) el.scrollTop = index * ITEM_H;
    };
    align();
    // A scroll set while the popover is still mounting can be dropped; re-apply next frame.
    const raf = requestAnimationFrame(align);
    setLive(index);
    return () => cancelAnimationFrame(raf);
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
    setLive(i);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (i !== index) onChange(i);
    }, 110);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      className={`${width} relative overflow-y-scroll overscroll-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      style={{
        height: ITEM_H * VISIBLE,
        paddingTop: ITEM_H * ((VISIBLE - 1) / 2),
        paddingBottom: ITEM_H * ((VISIBLE - 1) / 2),
        maskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)',
      }}
    >
      {items.map((item, i) => {
        const disabled = isDisabled?.(i) ?? false;
        return (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={i === live}
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return;
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
              onChange(i);
            }}
            className={`block w-full snap-center text-center tabular-nums transition-all duration-150 ${
              disabled
                ? 'cursor-not-allowed text-[15px] text-gray-700'
                : i === live
                  ? 'text-[19px] font-semibold text-white'
                  : Math.abs(i - live) === 1
                    ? 'text-[17px] text-gray-400'
                    : 'text-[15px] text-gray-600'
            }`}
            style={{ height: ITEM_H, lineHeight: `${ITEM_H}px` }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const PERIODS = ['AM', 'PM'];

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable moment (same format). Days before it are disabled. */
  min?: string;
  label?: string;
  invalid?: boolean;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, placeholder = 'Select date & time', min, label = 'Date and time', invalid }) => {
  const parts = parse(value);
  const minParts = min ? parse(min) : null;
  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: (parts ?? minParts)?.year ?? today.getFullYear(), month: (parts ?? minParts)?.month ?? today.getMonth() }));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Re-centre the calendar on the selected month each time it opens.
  useEffect(() => {
    if (!isOpen) return;
    const anchor = parts ?? minParts;
    setView({ year: anchor?.year ?? today.getFullYear(), month: anchor?.month ?? today.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 340;
      const height = popRef.current?.offsetHeight ?? 440;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = r.bottom + 8;
      const above = r.top - height - 8;
      // Prefer below; flip above when that fits better; otherwise keep it fully on screen.
      let top = below;
      if (below + height > window.innerHeight - 8) {
        top = above >= 8 ? above : Math.max(8, window.innerHeight - height - 8);
      }
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  const close = useCallback((refocus = false) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  /** Time used when a day is picked before any time: the next full hour. */
  const defaultTime = () => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return { hour: next.getHours(), minute: 0 };
  };

  const emit = (next: Partial<Parts>) => {
    const base: Parts = parts ?? {
      year: today.getFullYear(), month: today.getMonth(), day: today.getDate(), ...defaultTime(),
    };
    let merged = { ...base, ...next };
    // Never emit a moment before `min`.
    if (minParts && format(merged) < format(minParts)) merged = { ...minParts };
    onChange(format(merged));
  };

  const grid = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [view]);

  const shiftMonth = (delta: number) => {
    setView(v => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const minKey = minParts ? dayKey(minParts.year, minParts.month, minParts.day) : -Infinity;
  const selectedKey = parts ? dayKey(parts.year, parts.month, parts.day) : null;

  const hour12 = parts ? parts.hour % 12 : null;
  const period = parts ? (parts.hour >= 12 ? 1 : 0) : null;

  const triggerText = parts ? formatIndian(parts) : '';

  // On the earliest allowed day, times before `min` are greyed out on the wheels.
  const shown: Parts = parts ?? {
    year: today.getFullYear(), month: today.getMonth(), day: today.getDate(), ...defaultTime(),
  };
  const onMinDay = Boolean(minParts && dayKey(shown.year, shown.month, shown.day) === dayKey(minParts.year, minParts.month, minParts.day));
  const shownPeriod = shown.hour >= 12 ? 1 : 0;
  const hourDisabled = (i: number) => onMinDay && i + shownPeriod * 12 < minParts!.hour;
  const minuteDisabled = (i: number) => onMinDay && (shown.hour < minParts!.hour || (shown.hour === minParts!.hour && i < minParts!.minute));
  const periodDisabled = (i: number) => onMinDay && i === 0 && minParts!.hour >= 12;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
        className={`group flex h-11 w-full items-center gap-3 rounded-xl px-4 text-left text-sm transition-all duration-200 ${
          isOpen
            ? 'bg-black/35 ring-1 ring-emerald-400/60 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]'
            : invalid
              ? 'bg-black/25 ring-1 ring-inset ring-rose-400/60'
              : 'bg-black/25 ring-1 ring-inset ring-white/10 hover:ring-white/20'
        }`}
      >
        <svg className={`h-4 w-4 shrink-0 ${parts ? 'text-emerald-300' : 'text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className={`flex-1 truncate ${parts ? 'font-semibold text-white' : 'text-gray-500'}`}>{parts ? triggerText : placeholder}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-300' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && pos && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={label}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[60] w-[340px] overflow-hidden rounded-[22px] bg-[#1c1c1e]/95 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] animate-menu-in select-none"
        >
          {/* Month header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <p className="text-[17px] font-semibold tracking-tight text-white">
              {MONTHS[view.month]} <span className="text-gray-400 font-medium">{view.year}</span>
            </p>
            <div className="flex items-center gap-1">
              {[-1, 1].map(delta => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => shiftMonth(delta)}
                  aria-label={delta < 0 ? 'Previous month' : 'Next month'}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-400 transition hover:bg-white/[0.08] active:scale-90"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={delta < 0 ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="px-3.5">
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="py-1.5 text-center text-[11px] font-semibold uppercase text-gray-500">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {grid.map((d, i) => {
                if (!d) return <span key={i} />;
                const key = dayKey(view.year, view.month, d);
                const disabled = key < minKey;
                const selected = key === selectedKey;
                const isToday = key === todayKey;
                return (
                  <div key={i} className="flex justify-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => emit({ year: view.year, month: view.month, day: d })}
                      aria-pressed={selected}
                      aria-label={new Date(view.year, view.month, d).toDateString()}
                      className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[16px] tabular-nums transition-all duration-150 ${
                        selected
                          ? 'bg-emerald-400 font-semibold text-gray-950 shadow-[0_6px_16px_-6px_rgba(52,211,153,0.9)]'
                          : disabled
                            ? 'cursor-not-allowed text-gray-700'
                            : isToday
                              ? 'font-semibold text-emerald-400 hover:bg-white/[0.08]'
                              : 'text-gray-100 hover:bg-white/[0.08] active:scale-90'
                      }`}
                    >
                      {d}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="mt-3 border-t border-white/[0.08] px-5 pt-3">
            <div className="flex items-center justify-between">
              <span>
                <span className="block text-[15px] font-medium text-white">Time</span>
                {onMinDay && (
                  <span className="block text-[11px] text-gray-500">Earliest {formatTimeIndian(minParts!.hour, minParts!.minute)}</span>
                )}
              </span>
              <span className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-[15px] font-semibold tabular-nums text-white">
                {parts ? formatTimeIndian(parts.hour, parts.minute) : '—'}
              </span>
            </div>
            <div className="relative mt-2 flex items-center justify-center gap-1">
              <div className="pointer-events-none absolute inset-x-6 top-1/2 h-[32px] -translate-y-1/2 rounded-lg bg-white/[0.08]" aria-hidden="true" />
              <Wheel
                label="Hour"
                isDisabled={hourDisabled}
                items={HOURS}
                index={hour12 ?? defaultTime().hour % 12}
                onChange={i => emit({ hour: i + (period ?? (defaultTime().hour >= 12 ? 1 : 0)) * 12 })}
              />
              <span className="relative text-[19px] font-semibold text-white">:</span>
              <Wheel label="Minute" isDisabled={minuteDisabled} items={MINUTES} index={parts?.minute ?? 0} onChange={i => emit({ minute: i })} />
              <Wheel
                label="AM or PM"
                isDisabled={periodDisabled}
                width="w-16"
                items={PERIODS}
                index={period ?? (defaultTime().hour >= 12 ? 1 : 0)}
                onChange={i => emit({ hour: ((parts?.hour ?? defaultTime().hour) % 12) + i * 12 })}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.08] px-3 py-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const t = parts ? { hour: parts.hour, minute: parts.minute } : defaultTime();
                  emit({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate(), ...t });
                  setView({ year: today.getFullYear(), month: today.getMonth() });
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-white/[0.06]"
              >
                Today
              </button>
              {parts && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-1.5 text-sm font-bold text-gray-950 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.8),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.97]"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DateTimePicker;
