import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon, DocumentTextIcon, ClipboardCheckIcon, DocumentDuplicateIcon,
  UserGroupIcon, AcademicCapIcon, GlobeAltIcon
} from '../../../components/icons';
import DashboardShell, { ShellNavGroup } from '../../../components/shell/DashboardShell';
import Tests from './components/Tests';
import Results from './components/Results';
import Analysis from './components/Analysis';
import QuestionPapers from './components/QuestionPapers';
import SharedPapers from './components/SharedPapers';
import ManageStudents from './components/ManageStudents';
import AcademicsManager from './components/AcademicManager';

type DashboardView = 'tests' | 'papers' | 'results' | 'analysis' | 'shared-papers' | 'students' | 'academics';

const NAV: ShellNavGroup<DashboardView>[] = [
  {
    heading: 'Overview',
    items: [{ view: 'analysis', label: 'Analysis', subtitle: 'Campus-wide performance', icon: ChartBarIcon, hasOwnHeading: true }],
  },
  {
    heading: 'People',
    items: [
      { view: 'students', label: 'Students', subtitle: 'Enroll and manage student logins', icon: UserGroupIcon, hasOwnHeading: true },
      { view: 'academics', label: 'Academics', subtitle: 'Classes, weekly plans, and test status', icon: AcademicCapIcon },
    ],
  },
  {
    heading: 'Assessments',
    items: [
      { view: 'tests', label: 'Tests', subtitle: 'Your institute tests', icon: ClipboardCheckIcon, hasOwnHeading: true },
      { view: 'results', label: 'Results', subtitle: 'Results across your students', icon: DocumentTextIcon, hasOwnHeading: true },
      { view: 'papers', label: 'Question Papers', subtitle: 'Papers and downloads', icon: DocumentDuplicateIcon, hasOwnHeading: true },
      { view: 'shared-papers', label: 'Shared Papers', subtitle: 'Papers shared with you by Atlas', icon: GlobeAltIcon, hasOwnHeading: true },
    ],
  },
];

const InstituteDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>('analysis');
  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
    setTimeout(logout, 50);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'results': return <Results />;
      case 'tests': return <Tests />;
      case 'papers': return <QuestionPapers />;
      case 'shared-papers': return <SharedPapers />;
      case 'students': return <ManageStudents />;
      case 'academics': return <AcademicsManager />;
      default: return <Analysis />;
    }
  };

  return (
    <DashboardShell<DashboardView>
      portalLabel="Institute Console"
      brand={
        <div className="flex items-center gap-3">
          <img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" alt="Atlas Classes" className="h-10 w-auto object-contain" />
          <div className="h-8 w-px bg-white/10 shrink-0" />
          <img src="https://i.postimg.cc/Y9jSSdVL/Logo-(ilearn).png" alt="iLearn" className="w-24 h-auto object-contain" />
        </div>
      }
      groups={NAV}
      activeView={activeView}
      onNavigate={setActiveView}
      user={{ name: user?.name || 'Institute', caption: 'Institute account', avatarUrl: user?.logo_url }}
      welcome={{ name: user?.name || 'back', tagline: "here's how your campus is performing." }}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardShell>
  );
};

export default InstituteDashboard;
