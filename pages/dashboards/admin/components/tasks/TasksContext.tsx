import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../../services/api';
import {
  AdminUser, AreaTag, Task, TaskChanges, TaskDraft, TaskEvent, allAreas, isOverdue, istDay,
} from './taskModel';

// Shared state for the Tasks section, the quick-add button and the task drawer: one list for
// all admins, refreshed in the background so changes made by other admins show up.

interface TasksValue {
  tasks: Task[];
  admins: AdminUser[];
  areas: AreaTag[];
  me: string | null;
  loading: boolean;
  /** The database tables aren't created yet (migration 006). */
  setupNeeded: boolean;
  error: string | null;
  lastTaskId: string | null;
  counts: { active: number; mine: number; overdue: number };
  refresh: () => Promise<void>;
  create: (drafts: TaskDraft[]) => Promise<Task[]>;
  update: (id: string, changes: TaskChanges, note?: string | null) => Promise<Task>;
  remove: (id: string) => Promise<void>;
  addTag: (label: string) => Promise<AreaTag>;
  events: (id: string) => Promise<TaskEvent[]>;
  comment: (id: string, text: string) => Promise<TaskEvent>;
  openTaskId: string | null;
  openTask: (id: string | null) => void;
  /** The quick-add panel ("voice" or "type"), open from anywhere in the console. */
  quickAdd: QuickAddMode | null;
  setQuickAdd: (mode: QuickAddMode | null) => void;
}

export type QuickAddMode = 'voice' | 'type';

const TasksContext = createContext<TasksValue | null>(null);

const REFRESH_MS = 45000;

export const messageOf = (error: any, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.message || (error?.message === 'Network Error' ? "Can't reach the server. Check your connection." : null) || fallback;

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [tags, setTags] = useState<{ slug: string; label: string }[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddMode | null>(null);
  const busy = useRef(0); // pending writes: skip background refreshes so they can't undo an optimistic change

  const refresh = useCallback(async () => {
    if (busy.current) return;
    try {
      const { data } = await api.get('/tasks');
      if (busy.current) return;
      setTasks(data.tasks || []);
      setAdmins(data.admins || []);
      setTags(data.tags || []);
      setMe(data.me || null);
      setSetupNeeded(false);
      setError(null);
    } catch (err: any) {
      if (err?.response?.data?.code === 'tasks_setup') setSetupNeeded(true);
      else setError(messageOf(err, "Couldn't load tasks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const track = async <T,>(work: () => Promise<T>) => {
    busy.current += 1;
    try {
      return await work();
    } finally {
      busy.current -= 1;
    }
  };

  const create = useCallback((drafts: TaskDraft[]) => track(async () => {
    const { data } = await api.post('/tasks', { tasks: drafts });
    const created: Task[] = data.tasks || [];
    setTasks(prev => [...created, ...prev]);
    if (created.length) setLastTaskId(created[created.length - 1].id);
    return created;
  }), []);

  const update = useCallback((id: string, changes: TaskChanges, note?: string | null) => track(async () => {
    let previous: Task | undefined;
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task;
      previous = task;
      return { ...task, ...changes, updated_at: new Date().toISOString() };
    }));
    try {
      const { data } = await api.patch(`/tasks/${id}`, { ...changes, note: note || undefined });
      setTasks(prev => prev.map(task => (task.id === id ? data.task : task)));
      setLastTaskId(id);
      return data.task as Task;
    } catch (err) {
      if (previous) setTasks(prev => prev.map(task => (task.id === id ? previous! : task)));
      throw err;
    }
  }), []);

  const remove = useCallback((id: string) => track(async () => {
    await api.delete(`/tasks/${id}`);
    setTasks(prev => prev.filter(task => task.id !== id));
    setOpenTaskId(current => (current === id ? null : current));
  }), []);

  const addTag = useCallback(async (label: string) => {
    const { data } = await api.post('/tasks/tags', { label });
    setTags(prev => (prev.some(tag => tag.slug === data.tag.slug) ? prev : [...prev, data.tag].sort((a, b) => a.label.localeCompare(b.label))));
    return { slug: data.tag.slug, label: data.tag.label, group: 'Custom' as const };
  }, []);

  const events = useCallback(async (id: string) => (await api.get(`/tasks/${id}/events`)).data.events as TaskEvent[], []);

  const comment = useCallback(async (id: string, text: string) => {
    const { data } = await api.post(`/tasks/${id}/comments`, { comment: text });
    setTasks(prev => prev.map(task => (task.id === id ? { ...task, updated_at: data.event.created_at } : task)));
    return data.event as TaskEvent;
  }, []);

  const areas = useMemo(() => allAreas(tags), [tags]);

  const counts = useMemo(() => {
    const today = istDay();
    const active = tasks.filter(task => task.status === 'todo' || task.status === 'in_progress');
    return {
      active: active.length,
      mine: active.filter(task => task.assignee_id === me).length,
      overdue: tasks.filter(task => isOverdue(task, today)).length,
    };
  }, [tasks, me]);

  const value = useMemo<TasksValue>(() => ({
    tasks, admins, areas, me, loading, setupNeeded, error, lastTaskId, counts,
    refresh, create, update, remove, addTag, events, comment,
    openTaskId, openTask: setOpenTaskId, quickAdd, setQuickAdd,
  }), [tasks, admins, areas, me, loading, setupNeeded, error, lastTaskId, counts, refresh, create, update, remove, addTag, events, comment, openTaskId, quickAdd]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};

export function useTasks() {
  const value = useContext(TasksContext);
  if (!value) throw new Error('useTasks must be used inside <TasksProvider>');
  return value;
}
