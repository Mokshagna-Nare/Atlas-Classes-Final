import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  GlobeAltIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  PlusIcon,
  PencilSquareIcon,
  Squares2X2Icon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
} from "../../../components/icons";
import DashboardShell, { ShellNavGroup } from "../../../components/shell/DashboardShell";
import BackgroundTaskBar, { BackgroundTaskEntry } from "../../../components/shell/BackgroundTaskBar";
import { TaskScope, TaskInfo, TaskReporter } from "../../../contexts/BackgroundTasks";
import { AdminModal, primaryBtn, secondaryBtn, dangerBtn, ICONS } from "../../../components/ui/admin";

import ManageInstitutes from "./components/ManageInstitutes";
import AIPaperGenerator from "./components/AIPaperGenerator";
import MCQUpload from "./components/MCQUpload";
import CreateTest from "./components/CreateTest";
import QuestionBank from "./components/QuestionBank";
import ManageTests from "./components/ManageTests";
import QuestionPaperGenerator from "./components/QuestionPaperGenerator";
import StudentAnalyticsDashboard from "./components/Analytics/StudentAnalyticsDashboard";
import FlaggedAttempts from "./components/FlaggedAttempts";
import QuestionsGenerator from "./components/questionsGenerator/QuestionsGenerator";

import { MCQ } from "../../../types";

type DashboardView =
  | "institutes"
  | "ai-generator"
  | "mcq-upload"
  | "create-test"
  | "question-bank"
  | "tests"
  | "paper-generator"
  | "analytics"
  | "flagged-attempts"
  | "questions-generator";

const NAV: ShellNavGroup<DashboardView>[] = [
  {
    heading: "Content",
    items: [
      { view: "ai-generator", label: "Upload / Assign Test", subtitle: "Convert and assign exam papers", icon: SparklesIcon, hasOwnHeading: true },
      { view: "mcq-upload", label: "MCQ Upload", subtitle: "Add questions one by one or in bulk", icon: PlusIcon, hasOwnHeading: true },
      { view: "question-bank", label: "Question Bank", subtitle: "Search, edit, and flag questions", icon: Squares2X2Icon, hasOwnHeading: true },
      { view: "paper-generator", label: "Generate Paper", subtitle: "Build printable question papers", icon: ClipboardDocumentListIcon, hasOwnHeading: true },
      { view: "questions-generator", label: "Questions generator", subtitle: "Generate or extract questions from a PDF or image", icon: DocumentDuplicateIcon, hasOwnHeading: true },
    ],
  },
  {
    heading: "Assessments",
    items: [
      { view: "create-test", label: "Create Online Test", subtitle: "Build and assign an online test", icon: PencilSquareIcon, hasOwnHeading: true },
      { view: "tests", label: "Manage Tests", subtitle: "Tests, links, and attempt results", icon: ClipboardCheckIcon, hasOwnHeading: true },
      { view: "flagged-attempts", label: "Flagged Attempts", subtitle: "Proctoring flags to review", icon: ShieldCheckIcon, hasOwnHeading: true },
    ],
  },
  {
    heading: "Insights",
    items: [{ view: "analytics", label: "Student Analytics", subtitle: "Individual student performance", icon: ChartBarIcon, hasOwnHeading: true }],
  },
  {
    heading: "Network",
    items: [{ view: "institutes", label: "Manage Institutes", subtitle: "Partner schools and their logins", icon: GlobeAltIcon, hasOwnHeading: true }],
  },
];

const VIEW_ORDER: DashboardView[] = NAV.flatMap(g => g.items.map(i => i.view));
const SECTION_NAME = Object.fromEntries(NAV.flatMap(g => g.items.map(i => [i.view, i.label]))) as Record<DashboardView, string>;

type Prompt =
  | { kind: "leave"; to: DashboardView; then?: () => void }
  | { kind: "end"; view: DashboardView }
  | { kind: "logout" }
  | { kind: "edit-over"; mcq: MCQ };

const AdminDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>("ai-generator");
  const [editingMcq, setEditingMcq] = useState<MCQ | null>(null);
  /** Ongoing work declared by sections, keyed "view::taskId". */
  const [tasks, setTasks] = useState<Record<string, TaskInfo & { view: DashboardView }>>({});
  /** Sections kept mounted (hidden) so their work carries on while another section is open. */
  const [background, setBackground] = useState<DashboardView[]>([]);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const report = useCallback<TaskReporter>((view, id, info) => {
    const key = `${view}::${id}`;
    setTasks(prev => {
      if (!info) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { ...info, view: view as DashboardView } };
    });
  }, []);

  /** The first piece of ongoing work in a section, if any. */
  const taskOf = useCallback((view: DashboardView) => Object.values(tasks).find(t => t.view === view) || null, [tasks]);

  const clearTasks = (view: DashboardView) =>
    setTasks(prev => Object.fromEntries(Object.entries(prev).filter(([, t]) => t.view !== view)));

  // A background section whose work has finished is closed the next time it isn't on screen.
  useEffect(() => {
    setBackground(prev => {
      const next = prev.filter(v => v === activeView || taskOf(v));
      return next.length === prev.length ? prev : next;
    });
  }, [activeView, taskOf]);

  // Editing a bank question lives in MCQ Upload; forget it once that section is closed.
  useEffect(() => {
    if (activeView !== "mcq-upload" && !background.includes("mcq-upload")) setEditingMcq(null);
  }, [activeView, background]);

  // Closing or reloading the tab would lose running work: let the browser ask first.
  const hasTasks = Object.keys(tasks).length > 0;
  useEffect(() => {
    if (!hasTasks) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasTasks]);

  /** Opens a section; if the current one has unfinished work, asks what to do with it first. */
  const go = (to: DashboardView, then?: () => void) => {
    if (to === activeView) { then?.(); return; }
    if (taskOf(activeView) && !background.includes(activeView)) {
      setPrompt({ kind: "leave", to, then });
      return;
    }
    setActiveView(to);
    then?.();
  };

  const keepRunningAndSwitch = () => {
    if (prompt?.kind !== "leave") return;
    setBackground(prev => (prev.includes(activeView) ? prev : [...prev, activeView]));
    setActiveView(prompt.to);
    prompt.then?.();
    setPrompt(null);
  };

  const endAndSwitch = () => {
    if (prompt?.kind !== "leave") return;
    const leaving = activeView;
    setBackground(prev => prev.filter(v => v !== leaving));
    clearTasks(leaving);
    setActiveView(prompt.to);
    prompt.then?.();
    setPrompt(null);
  };

  const endBackgroundTask = (view: DashboardView) => {
    setBackground(prev => prev.filter(v => v !== view));
    clearTasks(view);
    setPrompt(null);
  };

  const doLogout = () => {
    setPrompt(null);
    navigate("/");
    setTimeout(logout, 50);
  };

  const handleLogout = () => (hasTasks ? setPrompt({ kind: "logout" }) : doLogout());

  // MCQ Upload may hold unsaved work (in the background): don't overwrite it without asking.
  const handleEditMcq = (mcq: MCQ) =>
    taskOf("mcq-upload") && !editingMcq ? setPrompt({ kind: "edit-over", mcq }) : go("mcq-upload", () => setEditingMcq(mcq));

  const confirmEditOver = () => {
    if (prompt?.kind !== "edit-over") return;
    const { mcq } = prompt;
    clearTasks("mcq-upload");
    setPrompt(null);
    go("mcq-upload", () => setEditingMcq(mcq));
  };
  const handleFinishedMcqEdit = () => {
    setEditingMcq(null);
    setActiveView("question-bank");
  };

  const renderView = (view: DashboardView) => {
    switch (view) {
      case "paper-generator":
        return <QuestionPaperGenerator />;
      case "institutes":
        return <ManageInstitutes />;
      case "mcq-upload":
        return <MCQUpload editingMcq={editingMcq} onFinished={editingMcq ? handleFinishedMcqEdit : undefined} />;
      case "create-test":
        return <CreateTest />;
      case "question-bank":
        return <QuestionBank onEdit={handleEditMcq} />;
      case "tests":
        return <ManageTests />;
      case "flagged-attempts":
        return <FlaggedAttempts />;
      case "questions-generator":
        return <QuestionsGenerator />;
      case "analytics":
        return <StudentAnalyticsDashboard />;
      default:
        return <AIPaperGenerator />;
    }
  };

  // The open section plus every background one, in sidebar order so React keeps each mounted.
  const mounted = VIEW_ORDER.filter(v => v === activeView || background.includes(v));

  const backgroundEntries: BackgroundTaskEntry[] = useMemo(
    () =>
      background
        .filter(v => v !== activeView)
        .map(v => {
          const t = taskOf(v);
          return t ? { ...t, view: v, section: SECTION_NAME[v] } : null;
        })
        .filter(Boolean) as BackgroundTaskEntry[],
    [background, activeView, taskOf]
  );

  const leavingTask = prompt?.kind === "leave" ? taskOf(activeView) : null;
  const endingTask = prompt?.kind === "end" ? taskOf(prompt.view) : null;

  return (
    <DashboardShell<DashboardView>
      portalLabel="Admin Console"
      brand={<img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-1.png" alt="Atlas Classes" className="h-14 w-auto object-contain" />}
      groups={NAV}
      activeView={activeView}
      onNavigate={view => go(view)}
      user={{ name: user?.name || "Administrator", caption: "Administrator" }}
      welcome={{ name: user?.name?.trim().split(/\s+/)[0] || "Admin", tagline: "everything across the network is ready for you." }}
      onLogout={handleLogout}
      keepMounted
      statusBar={
        <BackgroundTaskBar
          tasks={backgroundEntries}
          onOpen={view => go(view as DashboardView)}
          onEnd={view => setPrompt({ kind: "end", view: view as DashboardView })}
        />
      }
    >
      {mounted.map(view => (
        <div key={view} hidden={view !== activeView} className="animate-view-in">
          <TaskScope view={view} report={report}>
            {renderView(view)}
          </TaskScope>
        </div>
      ))}

      {prompt?.kind === "leave" && leavingTask && (
        <AdminModal
          icon={ICONS.warning}
          tone="amber"
          title={`${SECTION_NAME[activeView]} is still in progress`}
          subtitle={leavingTask.label}
          onClose={() => setPrompt(null)}
          footer={
            <>
              <button type="button" onClick={() => setPrompt(null)} className={`${secondaryBtn} px-4 py-2.5 text-sm`}>Stay here</button>
              <button type="button" onClick={endAndSwitch} className={`${dangerBtn} px-4 py-2.5 text-sm`}>End task &amp; switch</button>
              <button type="button" onClick={keepRunningAndSwitch} className={`${primaryBtn} px-4 py-2.5 text-sm`}>Keep running in background</button>
            </>
          }
        >
          <div className="space-y-3 text-sm leading-relaxed text-gray-300">
            {leavingTask.detail && <p className="font-semibold text-white">{leavingTask.detail}</p>}
            <p>
              You are opening <span className="font-semibold text-white">{SECTION_NAME[prompt.to]}</span>. Choose what happens to this work:
            </p>
            <ul className="space-y-2">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" /><span><span className="font-semibold text-white">Keep running in background</span> — it carries on exactly where it is. Reopen it any time from the bar at the bottom of the panel.</span></li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /><span><span className="font-semibold text-white">End task &amp; switch</span> — closes it. Anything not yet saved is discarded and it starts fresh next time.</span></li>
            </ul>
          </div>
        </AdminModal>
      )}

      {prompt?.kind === "end" && (
        <AdminModal
          icon={ICONS.warning}
          tone="rose"
          title="End this background task?"
          subtitle={endingTask ? `${SECTION_NAME[prompt.view]} · ${endingTask.label}` : SECTION_NAME[prompt.view]}
          onClose={() => setPrompt(null)}
          footer={
            <>
              <button type="button" onClick={() => setPrompt(null)} className={`${secondaryBtn} px-4 py-2.5 text-sm`}>Keep it running</button>
              <button type="button" onClick={() => endBackgroundTask(prompt.view)} className={`${dangerBtn} px-4 py-2.5 text-sm`}>End task</button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-300">Anything not yet saved in this task will be discarded. Saved drafts stay where they are.</p>
        </AdminModal>
      )}

      {prompt?.kind === "edit-over" && (
        <AdminModal
          icon={ICONS.warning}
          tone="amber"
          title="MCQ Upload has unsaved work"
          subtitle={taskOf("mcq-upload")?.label}
          onClose={() => setPrompt(null)}
          footer={
            <>
              <button type="button" onClick={() => setPrompt(null)} className={`${secondaryBtn} px-4 py-2.5 text-sm`}>Cancel</button>
              <button type="button" onClick={confirmEditOver} className={`${dangerBtn} px-4 py-2.5 text-sm`}>Discard it &amp; edit this question</button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-gray-300">
            Editing <span className="font-semibold text-white">{prompt.mcq.question_code || "this question"}</span> opens it in MCQ Upload, which replaces the work that is there now. Cancel to finish or save that first.
          </p>
        </AdminModal>
      )}

      {prompt?.kind === "logout" && (
        <AdminModal
          icon={ICONS.warning}
          tone="amber"
          title="Log out with work in progress?"
          subtitle={`${new Set(Object.values(tasks).map(t => t.view)).size} section(s) still have unfinished work`}
          onClose={() => setPrompt(null)}
          footer={
            <>
              <button type="button" onClick={() => setPrompt(null)} className={`${secondaryBtn} px-4 py-2.5 text-sm`}>Stay</button>
              <button type="button" onClick={doLogout} className={`${dangerBtn} px-4 py-2.5 text-sm`}>Log out anyway</button>
            </>
          }
        >
          <ul className="space-y-1.5 text-sm text-gray-300">
            {Object.values(tasks).map((t, i) => (
              <li key={i}><span className="font-semibold text-white">{SECTION_NAME[t.view]}</span> · {t.label}</li>
            ))}
          </ul>
        </AdminModal>
      )}
    </DashboardShell>
  );
};

export default AdminDashboard;
