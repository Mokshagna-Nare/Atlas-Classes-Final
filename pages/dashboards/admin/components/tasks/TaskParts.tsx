import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chip, ICONS, Svg, inputCls, primaryBtn, secondaryBtn, textareaCls } from '../../../../../components/ui/admin';
import {
  AdminUser, AreaTag, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, TYPES, TYPE_META, Task, TaskPriority, TaskStatus, TaskType,
  addDays, adminName, areaLabel, friendlyDay, initials, isOverdue, istDay, weekday,
} from './taskModel';

// Small building blocks shared by the Tasks page, the task drawer and quick-add.

export const CALENDAR = 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5';
export const MIC = 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z';
export const TAG = 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z';
export const CHEVRON = 'M19.5 8.25l-7.5 7.5-7.5-7.5';

const AVATAR_TONES = ['from-emerald-400 to-teal-500', 'from-sky-400 to-indigo-500', 'from-amber-400 to-orange-500', 'from-violet-400 to-fuchsia-500', 'from-rose-400 to-pink-500', 'from-cyan-400 to-blue-500'];
const toneFor = (id: string) => AVATAR_TONES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

export const Avatar: React.FC<{ id: string | null; admins: AdminUser[]; me: string | null; size?: 'sm' | 'md' }> = ({ id, admins, me, size = 'sm' }) => {
  const name = adminName(id, admins, me);
  const box = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]';
  if (!id) {
    return <span title="Unassigned" className={`${box} inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-gray-500 light:border-gray-600`}>?</span>;
  }
  return (
    <span title={name} className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${toneFor(id)} font-black text-gray-950`}>
      {initials(name)}
    </span>
  );
};

export const StatusPill: React.FC<{ status: TaskStatus }> = ({ status }) => (
  <Chip tone={STATUS_META[status].tone}>
    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden="true" />
    {STATUS_META[status].label}
  </Chip>
);

export const PriorityBadge: React.FC<{ priority: TaskPriority; quiet?: boolean }> = ({ priority, quiet }) => {
  if (quiet && priority === 'medium') return null;
  return (
    <Chip tone={PRIORITY_META[priority].tone}>
      {priority === 'urgent' && <Svg d={ICONS.flag} className="h-3 w-3" />}
      {PRIORITY_META[priority].label}
    </Chip>
  );
};

export const TypeChip: React.FC<{ type: TaskType }> = ({ type }) => (
  <Chip tone={TYPE_META[type].tone}>
    <Svg d={TYPE_META[type].icon} className="h-3 w-3" />
    {TYPE_META[type].label}
  </Chip>
);

export const AreaChips: React.FC<{ slugs: string[]; areas: AreaTag[]; max?: number }> = ({ slugs, areas, max = 3 }) => (
  <>
    {slugs.slice(0, max).map(slug => (
      <Chip key={slug} className="max-w-[160px]" title={areaLabel(slug, areas)}>
        <Svg d={TAG} className="h-3 w-3 shrink-0 opacity-70" />
        <span className="truncate">{areaLabel(slug, areas)}</span>
      </Chip>
    ))}
    {slugs.length > max && <Chip title={slugs.slice(max).map(slug => areaLabel(slug, areas)).join(', ')}>+{slugs.length - max}</Chip>}
  </>
);

export const DueLabel: React.FC<{ task: Task }> = ({ task }) => {
  const today = istDay();
  if (task.status === 'postponed' && task.postponed_until) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-300 light:text-violet-700"><Svg d={CALENDAR} className="h-3.5 w-3.5" />Until {friendlyDay(task.postponed_until, today)}</span>;
  }
  if (!task.due_date) return null;
  const overdue = isOverdue(task, today);
  const soon = !overdue && task.status !== 'completed' && task.due_date <= addDays(today, 1);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${overdue ? 'text-rose-300 light:text-rose-700' : soon ? 'text-amber-300 light:text-amber-700' : 'text-gray-400'}`}>
      <Svg d={CALENDAR} className="h-3.5 w-3.5" />
      {overdue ? `Overdue · ${friendlyDay(task.due_date, today)}` : `Due ${friendlyDay(task.due_date, today)}`}
    </span>
  );
};

/** Closes on outside click / Escape. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverCls =
  'absolute z-50 mt-2 rounded-2xl bg-atlas-raised p-2 ring-1 ring-white/10 shadow-[0_24px_60px_-20px_rgb(var(--shadow-rgb)/calc(0.9*var(--shadow-k)))] animate-menu-in light:bg-paper light:ring-gray-700';

/** Status button with a menu; choosing "Postponed" asks for an optional date and reason. */
export const StatusMenu: React.FC<{
  status: TaskStatus;
  onChange: (status: TaskStatus, extra?: { postponed_until: string | null; postpone_reason: string | null }) => void;
  align?: 'left' | 'right';
  disabled?: boolean;
}> = ({ status, onChange, align = 'left', disabled }) => {
  const { open, setOpen, ref } = usePopover();
  const [postponing, setPostponing] = useState(false);
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { if (!open) setPostponing(false); }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={e => { e.stopPropagation(); setOpen(v => !v); }} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg transition hover:brightness-125 disabled:opacity-50" title="Change status">
        <StatusPill status={status} />
        <Svg d={CHEVRON} className="h-3 w-3 text-gray-500" />
      </button>
      {open && (
        <div role="menu" onClick={e => e.stopPropagation()} className={`${popoverCls} w-64 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {!postponing ? STATUSES.map(option => (
            <button key={option} type="button" role="menuitemradio" aria-checked={option === status}
              onClick={() => { if (option === 'postponed') { setPostponing(true); return; } setOpen(false); if (option !== status) onChange(option); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/[0.06] light:hover:bg-gray-800 ${option === status ? 'bg-white/[0.04] light:bg-gray-950' : ''}`}>
              <span className={`h-2 w-2 rounded-full ${STATUS_META[option].dot}`} />
              <span className="flex-1">
                <span className="block font-semibold text-white">{STATUS_META[option].label}</span>
                <span className="block text-[11px] text-gray-500">{STATUS_META[option].hint}</span>
              </span>
              {option === status && <Svg d={ICONS.check} className="h-4 w-4 text-emerald-300 light:text-brand-deep" />}
            </button>
          )) : (
            <div className="space-y-3 p-2">
              <p className="text-sm font-bold text-white">Postpone until…</p>
              <DueInput value={until || null} onChange={value => setUntil(value || '')} compact />
              <input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Reason (optional)" className={`${inputCls} h-10`} />
              <div className="flex gap-2">
                <button type="button" className={`${secondaryBtn} h-9 flex-1 text-xs`} onClick={() => setPostponing(false)}>Back</button>
                <button type="button" className={`${primaryBtn} h-9 flex-1 text-xs`} onClick={() => { setOpen(false); onChange('postponed', { postponed_until: until || null, postpone_reason: reason.trim() || null }); }}>Postpone</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Date input with quick picks (Today / Tomorrow / Friday / Next week). */
export const DueInput: React.FC<{ value: string | null; onChange: (value: string | null) => void; compact?: boolean; id?: string }> = ({ value, onChange, compact, id }) => {
  const today = istDay();
  const friday = addDays(today, ((5 - weekday(today) + 7) % 7) || 7);
  const nextMonday = addDays(today, ((1 - weekday(today) + 7) % 7) || 7);
  const picks: [string, string][] = [['Today', today], ['Tomorrow', addDays(today, 1)], ['Friday', friday], ['Next week', nextMonday]];
  return (
    <div className="space-y-2">
      <div className="flex min-w-0 gap-2">
        <input id={id} type="date" value={value || ''} onChange={e => onChange(e.target.value || null)}
          className={`${inputCls} ${compact ? 'h-10' : ''} min-w-0 flex-1 [color-scheme:dark] light:[color-scheme:light]`} />
        {value && (
          <button type="button" onClick={() => onChange(null)} title="Clear date" aria-label="Clear date"
            className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-xl text-gray-400 ring-1 ring-inset ring-white/10 transition hover:text-white light:ring-gray-700">
            <Svg d={ICONS.close} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {picks.map(([label, day]) => (
          <button key={label} type="button" onClick={() => onChange(day)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${value === day ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/40 light:bg-brand-pale light:text-brand-deep light:ring-brand-line' : 'text-gray-400 ring-white/10 hover:text-white hover:ring-white/20 light:ring-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

/** Pick area tags (grouped, searchable); new custom tags can be created from the search box. */
export const AreaPicker: React.FC<{
  value: string[];
  onChange: (slugs: string[]) => void;
  areas: AreaTag[];
  onCreate: (label: string) => Promise<AreaTag>;
}> = ({ value, onChange, areas, onCreate }) => {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => areas.filter(area => !q || area.label.toLowerCase().includes(q) || area.aliases?.some(alias => alias.includes(q))),
    [areas, q],
  );
  const groups = (['Admin console', 'Other parts of Atlas', 'Custom'] as const)
    .map(group => ({ group, items: filtered.filter(area => area.group === group) }))
    .filter(group => group.items.length);
  const exact = areas.some(area => area.label.toLowerCase() === q);

  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter(s => s !== slug) : [...value, slug]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const tag = await onCreate(query.trim());
      if (!value.includes(tag.slug)) onChange([...value, tag.slug]);
      setQuery('');
    } catch (err: any) {
      setError(err?.response?.data?.message || "Couldn't add that tag.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map(slug => (
          <span key={slug} className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/10 py-1 pl-2 pr-1 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 light:bg-brand-pale light:text-brand-deep light:ring-brand-line">
            {areaLabel(slug, areas)}
            <button type="button" onClick={() => toggle(slug)} aria-label={`Remove ${areaLabel(slug, areas)}`} className="rounded p-0.5 hover:bg-black/20">
              <Svg d={ICONS.close} className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-300 border border-dashed border-white/20 transition hover:text-white hover:border-white/40 light:border-gray-600">
          <Svg d={ICONS.plus} className="h-3.5 w-3.5" /> {value.length ? 'Add tag' : 'Choose where'}
        </button>
      </div>
      {open && (
        <div className={`${popoverCls} left-0 w-[min(22rem,calc(100vw-3rem))]`}>
          <div className="relative mb-2">
            <Svg d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search or create a tag" maxLength={40}
              onKeyDown={e => { if (e.key === 'Enter' && q && !exact && !filtered.length) { e.preventDefault(); create(); } }}
              className={`${inputCls} h-10 pl-9`} />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {groups.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <p className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{group}</p>
                {items.map(area => {
                  const on = value.includes(area.slug);
                  return (
                    <button key={area.slug} type="button" onClick={() => toggle(area.slug)} role="menuitemcheckbox" aria-checked={on}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-gray-200 transition hover:bg-white/[0.06] light:hover:bg-gray-800">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1 ring-inset ${on ? 'bg-emerald-400 text-gray-950 ring-emerald-400' : 'ring-white/25 light:ring-gray-600'}`}>
                        {on && <Svg d={ICONS.check} className="h-3 w-3" />}
                      </span>
                      {area.label}
                    </button>
                  );
                })}
              </div>
            ))}
            {q && !exact && (
              <button type="button" onClick={create} disabled={creating}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50 light:text-brand-deep">
                <Svg d={ICONS.plus} /> {creating ? 'Adding…' : `Create tag “${query.trim()}”`}
              </button>
            )}
            {error && <p className="px-2 py-1 text-xs text-rose-300">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export const AssigneeSelect: React.FC<{ value: string | null; onChange: (id: string | null) => void; admins: AdminUser[]; me: string | null; compact?: boolean; id?: string }> = ({
  value, onChange, admins, me, compact, id,
}) => (
  <select id={id} value={value || ''} onChange={e => onChange(e.target.value || null)} className={`${inputCls} ${compact ? 'h-10' : ''} cursor-pointer`}>
    <option value="">Unassigned</option>
    {[...admins].sort((a, b) => Number(b.id === me) - Number(a.id === me)).map(admin => (
      <option key={admin.id} value={admin.id}>{adminName(admin.id, admins, me)}</option>
    ))}
  </select>
);

export interface FormValue {
  title: string;
  details: string;
  type: TaskType;
  priority: TaskPriority;
  areas: string[];
  assignee_id: string | null;
  due_date: string | null;
}

const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400';

/** The task fields. `compact` is the dense version used inside voice drafts. */
export const TaskForm: React.FC<{
  value: FormValue;
  onChange: (patch: Partial<FormValue>) => void;
  admins: AdminUser[];
  me: string | null;
  areas: AreaTag[];
  onCreateTag: (label: string) => Promise<AreaTag>;
  compact?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}> = ({ value, onChange, admins, me, areas, onCreateTag, compact, autoFocus, idPrefix = 'task' }) => (
  <div className={compact ? 'space-y-3' : 'space-y-5'}>
    <div>
      <label htmlFor={`${idPrefix}-title`} className={labelCls}>What needs doing <span className="text-rose-400">*</span></label>
      <input id={`${idPrefix}-title`} autoFocus={autoFocus} value={value.title} maxLength={200} onChange={e => onChange({ title: e.target.value })}
        placeholder="e.g. Login fails after OTP on the student portal" className={`${inputCls} ${compact ? 'h-10' : ''} font-semibold`} />
    </div>

    {!compact || value.details ? (
      <div>
        <label htmlFor={`${idPrefix}-details`} className={labelCls}>Details <span className="ml-1 normal-case tracking-normal font-medium text-gray-600">optional</span></label>
        <textarea id={`${idPrefix}-details`} value={value.details} maxLength={5000} rows={compact ? 2 : 3} onChange={e => onChange({ details: e.target.value })}
          placeholder="Steps to reproduce, links, what 'done' looks like…" className={textareaCls} />
      </div>
    ) : null}

    <div>
      <span className={labelCls}>Type</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type">
        {TYPES.map(type => {
          const on = value.type === type;
          return (
            <button key={type} type="button" role="radio" aria-checked={on} onClick={() => onChange({ type })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${on ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/50 light:bg-brand-pale light:text-brand-deep light:ring-brand-line' : 'text-gray-400 ring-white/10 hover:text-white hover:ring-white/20 light:ring-gray-700'}`}>
              <Svg d={TYPE_META[type].icon} className="h-3.5 w-3.5" />{TYPE_META[type].label}
            </button>
          );
        })}
      </div>
    </div>

    <div>
      <span className={labelCls}>Where in Atlas</span>
      <AreaPicker value={value.areas} onChange={slugs => onChange({ areas: slugs })} areas={areas} onCreate={onCreateTag} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className={labelCls}>Priority</span>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-inset ring-white/10 light:bg-gray-800 light:ring-gray-700" role="radiogroup" aria-label="Priority">
          {[...PRIORITIES].reverse().map(priority => {
            const on = value.priority === priority;
            const tone = priority === 'urgent' ? 'bg-rose-500/20 text-rose-200 ring-rose-400/50' : priority === 'high' ? 'bg-amber-500/20 text-amber-100 ring-amber-400/50' : priority === 'medium' ? 'bg-sky-500/20 text-sky-100 ring-sky-400/50' : 'bg-white/10 text-gray-100 ring-white/20';
            return (
              <button key={priority} type="button" role="radio" aria-checked={on} onClick={() => onChange({ priority })}
                className={`rounded-lg px-1 py-1.5 text-[11px] font-bold transition ${on ? `${tone} ring-1 ring-inset light:ring-0 light:bg-gray-100 light:text-on-accent` : 'text-gray-500 hover:text-gray-200'}`}>
                {PRIORITY_META[priority].label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-assignee`} className={labelCls}>Assigned to</label>
        <AssigneeSelect id={`${idPrefix}-assignee`} value={value.assignee_id} onChange={assignee_id => onChange({ assignee_id })} admins={admins} me={me} compact={compact} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-due`} className={labelCls}>Due date</label>
        <DueInput id={`${idPrefix}-due`} value={value.due_date} onChange={due_date => onChange({ due_date })} compact={compact} />
      </div>
    </div>
  </div>
);
