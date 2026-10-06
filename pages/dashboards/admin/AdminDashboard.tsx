import React, { useState } from "react";
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
} from "../../../components/icons";
import DashboardShell, { ShellNavGroup } from "../../../components/shell/DashboardShell";

import ManageInstitutes from "./components/ManageInstitutes";
import AIPaperGenerator from "./components/AIPaperGenerator";
import MCQUpload from "./components/MCQUpload";
import CreateTest from "./components/CreateTest";
import QuestionBank from "./components/QuestionBank";
import ManageTests from "./components/ManageTests";
import QuestionPaperGenerator from "./components/QuestionPaperGenerator";
import StudentAnalyticsDashboard from "./components/Analytics/StudentAnalyticsDashboard";
import FlaggedAttempts from "./components/FlaggedAttempts";

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
  | "flagged-attempts";

const NAV: ShellNavGroup<DashboardView>[] = [
  {
    heading: "Content",
    items: [
      { view: "ai-generator", label: "Upload / Assign Test", subtitle: "Convert and assign exam papers", icon: SparklesIcon, hasOwnHeading: true },
      { view: "mcq-upload", label: "MCQ Upload", subtitle: "Add questions one by one or in bulk", icon: PlusIcon, hasOwnHeading: true },
      { view: "question-bank", label: "Question Bank", subtitle: "Search, edit, and flag questions", icon: Squares2X2Icon, hasOwnHeading: true },
      { view: "paper-generator", label: "Generate Paper", subtitle: "Build printable question papers", icon: ClipboardDocumentListIcon, hasOwnHeading: true },
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

const AdminDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>("ai-generator");
  const [editingMcq, setEditingMcq] = useState<MCQ | null>(null);

  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
    setTimeout(logout, 50);
  };

  const handleNavigate = (view: DashboardView) => {
    setActiveView(view);
    setEditingMcq(null);
  };

  const handleEditMcq = (mcq: MCQ) => {
    setEditingMcq(mcq);
    setActiveView("mcq-upload");
  };

  const handleFinishedMcqEdit = () => {
    setEditingMcq(null);
    setActiveView("question-bank");
  };

  const renderContent = () => {
    switch (activeView) {
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
      case "analytics":
        return <StudentAnalyticsDashboard />;
      default:
        return <AIPaperGenerator />;
    }
  };

  return (
    <DashboardShell<DashboardView>
      portalLabel="Admin Console"
      brand={<img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-1.png" alt="Atlas Classes" className="h-14 w-auto object-contain" />}
      groups={NAV}
      activeView={activeView}
      onNavigate={handleNavigate}
      user={{ name: user?.name || "Administrator", caption: "Administrator" }}
      welcome={{ name: user?.name?.trim().split(/\s+/)[0] || "Admin", tagline: "everything across the network is ready for you." }}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardShell>
  );
};

export default AdminDashboard;
