import React, { useEffect, useMemo, useState } from 'react';
import { ICONS, PageHeader, Segmented, Svg, inputCls, primaryBtn, secondaryBtn } from '../../../../../components/ui/admin';
import { messageOf, useTasks } from './TasksContext';
import { SetupNotice } from './QuickAdd';
import { AreaChips, Avatar, CHEVRON, DueLabel, MIC, PriorityBadge, StatusMenu, StatusPill, TypeChip } from './TaskParts';
import {
  BOARD_COLUMNS, PRIORITIES, PRIORITY_META, STATUS_META, Task, TaskStatus, TYPES, TYPE_META, adminName, compareTasks, isOverdue, istDay,
} from './taskModel';

// The Tasks section: everything admins need to fix, change or do in Atlas, as a board
// (drag cards between statuses) or a list, with filters.

type Scope = 'all' | 'mine' | 'created';
type View = 'board' | 'list';
type StatFilter = TaskStatus | 'overdue' | null;

const readView = (): View => {
  try {
    const saved = localStorage.getItem('atlas-tasks-view');
    if (saved === 'board' || saved === 'list') return saved;
  } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.innerWidth < 1024 ? 'list' : 'board';
};

const selectCls = `${inputCls.replace('w-full ', '')} h-10 w-auto max-w-[14rem] cursor-pointer pr-8 text-xs`;

const TaskCard: React.FC<{ task: Task; draggable?: boolean }> = ({ task, draggable }) => {
  const { admins, me, areas, openTask, update } = useTasks();
  const [error, setError] = useState<string | null>(null);
  const overdue = isOverdue(task);
  return (
    <article
      draggable={draggable}
      onDragStart={e => { e.dataTransfer.setData('text/task-id', task.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => openTask(task.id)}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) openTask(task.id); }}
      tabIndex={0}
      aria-label={`${task.title}, ${STATUS_META[task.status].label}`}
      className={`group cursor-pointer rounded-2xl bg-gray-900/70 p-3.5 ring-1 ring-inset transition hover:-translate-y-0.5 hover:ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.05)] light:hover:shadow-[0_8px_20px_-12px_rgba(16,24,40,0.25)] ${overdue ? 'ring-rose-400/40' : 'ring-white/[0.07] light:ring-gray-700'} ${draggable ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <p className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${task.status === 'completed' || task.status === 'cancelled' ? 'text-gray-400 line-through decoration-gray-600' : 'text-white'}`}>{task.title}</p>
        <Avatar id={task.assignee_id} admins={admins} me={me} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip type={task.type} />
        <PriorityBadge priority={task.priority} quiet />
        <AreaChips slugs={task.areas} areas={areas} max={2} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        <StatusMenu status={task.status} onChange={(status, extra) => update(task.id, { status, ...(extra || {}) }, extra?.postpone_reason || null).catch(err => setError(messageOf(err)))} />
        <DueLabel task={task} />
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </article>
  );
};

const TasksPage: React.FC = () => {
  const { tasks, admins, areas, me, loading, setupNeeded, error, counts, refresh, setQuickAdd, update, openTask } = useTasks();
  const [scope, setScope] = useState<Scope>('all');
  const [view, setView] = useState<View>(readView);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [stat, setStat] = useState<StatFilter>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ completed: true, cancelled: true });
  const [completedLimit, setCompletedLimit] = useState(15);

  useEffect(() => { try { localStorage.setItem('atlas-tasks-view', view); } catch { /* ignore */ } }, [view]);

  const today = istDay();
  const filtersOn = !!(search || area || type || priority || assignee || stat || scope !== 'all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter(task => scope === 'all' || (scope === 'mine' ? task.assignee_id === me : task.created_by === me))
      .filter(task => !q || `${task.title} ${task.details} ${task.voice_transcript || ''}`.toLowerCase().includes(q))
      .filter(task => !area || task.areas.includes(area))
      .filter(task => !type || task.type === type)
      .filter(task => !priority || task.priority === priority)
      .filter(task => !assignee || (assignee === 'none' ? !task.assignee_id : task.assignee_id === assignee))
      .filter(task => (stat === 'overdue' ? isOverdue(task, today) : !stat || task.status === stat))
      .sort((a, b) => compareTasks(a, b, today));
  }, [tasks, scope, me, search, area, type, priority, assignee, stat, today]);

  const byStatus = (status: TaskStatus) => filtered.filter(task => task.status === status);

  const stats: { key: StatFilter; label: string; value: number; tone: string }[] = [
    { key: 'todo', label: 'To do', value: tasks.filter(t => t.status === 'todo').length, tone: 'text-sky-300 light:text-sky-700' },
    { key: 'in_progress', label: 'In progress', value: tasks.filter(t => t.status === 'in_progress').length, tone: 'text-amber-300 light:text-amber-700' },
    { key: 'postponed', label: 'Postponed', value: tasks.filter(t => t.status === 'postponed').length, tone: 'text-violet-300 light:text-violet-700' },
    { key: 'overdue', label: 'Overdue', value: counts.overdue, tone: counts.overdue ? 'text-rose-300 light:text-rose-700' : 'text-gray-400' },
    { key: 'completed', label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, tone: 'text-emerald-300 light:text-brand-deep' },
  ];

  const clearFilters = () => { setSearch(''); setArea(''); setType(''); setPriority(''); setAssignee(''); setStat(null); setScope('all'); };

  const drop = async (status: TaskStatus, id: string) => {
    setDragOver(null);
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    setMoveError(null);
    try {
      await update(id, { status });
    } catch (err) {
      setMoveError(messageOf(err, "Couldn't move the task."));
    }
  };

  const header = (
    <PageHeader
      eyebrow="Workspace"
      title="Tasks"
      subtitle="Bugs, changes, software updates and to-dos for Atlas — one list shared by all admins."
      aside={
        <div className="flex gap-2">
          <button type="button" onClick={() => setQuickAdd('voice')} className={`${primaryBtn} h-11 px-4 text-sm`}><Svg d={MIC} className="h-4 w-4" /> Speak a task</button>
          <button type="button" onClick={() => setQuickAdd('type')} className={`${secondaryBtn} h-11 px-4 text-sm`}><Svg d={ICONS.plus} /> New task</button>
        </div>
      }
    />
  );

  if (setupNeeded) return <div className="space-y-6">{header}<div className="max-w-2xl"><SetupNotice /></div></div>;

  const columnTasks = (status: TaskStatus) => {
    const list = byStatus(status);
    return status === 'completed' ? list.sort((a, b) => ((a.completed_at || a.updated_at) < (b.completed_at || b.updated_at) ? 1 : -1)) : list;
  };

  return (
    <div className="space-y-6 pb-16">
      {header}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30">
          {error}
          <button type="button" onClick={refresh} className={`${secondaryBtn} h-8 px-3 text-xs`}>Retry</button>
        </div>
      )}

      {/* Status counts — also quick filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(item => {
          const on = stat === item.key;
          return (
            <button key={item.label} type="button" onClick={() => setStat(on ? null : item.key)} aria-pressed={on}
              className={`rounded-2xl p-4 text-left ring-1 ring-inset transition hover:-translate-y-0.5 ${on ? 'bg-emerald-400/10 ring-emerald-400/50 light:bg-brand-pale light:ring-brand-line' : 'bg-gray-900/60 ring-white/[0.07] hover:ring-white/20 light:bg-paper light:ring-gray-700'}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{item.label}</p>
              <p className={`mt-1 text-3xl font-black tabular-nums ${item.tone}`}>{loading ? '–' : item.value}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl bg-gray-900/50 p-3 ring-1 ring-inset ring-white/[0.06] light:bg-paper light:ring-gray-700">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="shrink-0 whitespace-nowrap">
            <Segmented<Scope> value={scope} onChange={setScope} options={[
              { value: 'all', label: 'All' },
              { value: 'mine', label: `Mine${counts.mine ? ` · ${counts.mine}` : ''}` },
              { value: 'created', label: 'By me' },
            ]} />
          </div>
          <div className="relative min-w-0 flex-1">
            <Svg d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className={`${inputCls} h-10 pl-9 text-sm`} />
          </div>
          <div className="shrink-0">
            <Segmented<View> value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }]} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Filter</span>
          <select value={area} onChange={e => setArea(e.target.value)} aria-label="Filter by area" className={selectCls}>
            <option value="">All areas</option>
            {areas.map(a => <option key={a.slug} value={a.slug}>{a.label}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Filter by type" className={selectCls}>
            <option value="">All types</option>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Filter by priority" className={selectCls}>
            <option value="">Any priority</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          <select value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Filter by assignee" className={selectCls}>
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {admins.map(a => <option key={a.id} value={a.id}>{adminName(a.id, admins, me)}</option>)}
          </select>
          {filtersOn && <button type="button" onClick={clearFilters} className="px-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200 light:text-brand-deep">Clear filters</button>}
        </div>
      </div>

      {moveError && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30">{moveError}</p>}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-white/[0.03] animate-pulse light:bg-gray-800" />)}</div>
      ) : !tasks.length ? (
        <div className="mx-auto max-w-md rounded-3xl bg-gray-900/50 p-8 text-center ring-1 ring-inset ring-white/[0.06] light:bg-paper light:ring-gray-700">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30 light:bg-brand-pale light:text-brand-deep light:ring-brand-line"><Svg d={MIC} className="h-7 w-7" /></span>
          <h3 className="text-lg font-bold">No tasks yet</h3>
          <p className="mt-1 text-sm text-gray-400">Add the first one — just say it. For example: “Add a bug in Question Bank: filters reset after search, high priority, due Friday.”</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => setQuickAdd('voice')} className={`${primaryBtn} h-11 px-4 text-sm`}><Svg d={MIC} className="h-4 w-4" /> Speak a task</button>
            <button type="button" onClick={() => setQuickAdd('type')} className={`${secondaryBtn} h-11 px-4 text-sm`}>Type instead</button>
          </div>
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl bg-gray-900/40 p-8 text-center text-sm text-gray-400 ring-1 ring-inset ring-white/[0.06] light:bg-paper light:ring-gray-700">
          No tasks match these filters. <button type="button" onClick={clearFilters} className="font-semibold text-emerald-300 hover:text-emerald-200 light:text-brand-deep">Clear filters</button>
        </div>
      ) : view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.map(status => {
            const list = columnTasks(status);
            const shown = status === 'completed' ? list.slice(0, completedLimit) : list;
            return (
              <section key={status} aria-label={STATUS_META[status].label}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(status); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/task-id'); if (id) drop(status, id); }}
                className={`flex min-h-[12rem] flex-col rounded-2xl p-2.5 ring-1 ring-inset transition ${dragOver === status ? 'bg-emerald-400/[0.07] ring-emerald-400/50' : 'bg-white/[0.02] ring-white/[0.05] light:bg-gray-950 light:ring-gray-700'}`}>
                <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />{STATUS_META[status].label}
                  </span>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-gray-400 light:bg-paper">{list.length}</span>
                </header>
                <div className="flex-1 space-y-2.5">
                  {shown.map(task => <TaskCard key={task.id} task={task} draggable />)}
                  {!list.length && <p className="px-2 py-6 text-center text-xs text-gray-600">{dragOver === status ? 'Drop here' : 'Nothing here'}</p>}
                  {status === 'completed' && list.length > completedLimit && (
                    <button type="button" onClick={() => setCompletedLimit(n => n + 30)} className="w-full rounded-xl py-2 text-xs font-semibold text-gray-400 hover:text-white">Show more ({list.length - completedLimit})</button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {(['todo', 'in_progress', 'postponed', 'completed', 'cancelled'] as TaskStatus[]).map(status => {
            const list = columnTasks(status);
            if (!list.length || (status === 'cancelled' && !showCancelled && stat !== 'cancelled')) return null;
            const isCollapsed = collapsed[status] && stat !== status;
            return (
              <section key={status} className="overflow-hidden rounded-2xl bg-gray-900/50 ring-1 ring-inset ring-white/[0.06] light:bg-paper light:ring-gray-700">
                <button type="button" onClick={() => setCollapsed(prev => ({ ...prev, [status]: !isCollapsed }))} aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Svg d={CHEVRON} className={`h-4 w-4 text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  <StatusPill status={status} />
                  <span className="text-xs font-bold tabular-nums text-gray-500">{list.length}</span>
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05] light:divide-gray-700 light:border-gray-700">
                    {list.map(task => (
                      <li key={task.id} className={`flex flex-col gap-2 px-4 py-3 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-4 ${isOverdue(task) ? 'bg-rose-500/[0.04]' : ''}`}>
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <StatusMenu status={task.status} onChange={(s, extra) => update(task.id, { status: s, ...(extra || {}) }, extra?.postpone_reason || null).catch(err => setMoveError(messageOf(err)))} />
                        </div>
                        <button type="button" onClick={() => openTask(task.id)} className="min-w-0 flex-1 text-left">
                          <span className={`block truncate text-sm font-semibold ${status === 'completed' || status === 'cancelled' ? 'text-gray-400 line-through decoration-gray-600' : 'text-white'}`}>{task.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <TypeChip type={task.type} />
                            <PriorityBadge priority={task.priority} quiet />
                            <AreaChips slugs={task.areas} areas={areas} max={3} />
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-3 sm:w-56 sm:justify-end">
                          <DueLabel task={task} />
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Avatar id={task.assignee_id} admins={admins} me={me} />
                            <span className="hidden max-w-[7rem] truncate md:inline">{adminName(task.assignee_id, admins, me)}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {tasks.some(t => t.status === 'cancelled') && stat !== 'cancelled' && (
            <button type="button" onClick={() => setShowCancelled(v => !v)} className="text-xs font-semibold text-gray-500 hover:text-white">
              {showCancelled ? 'Hide cancelled tasks' : 'Show cancelled tasks'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
