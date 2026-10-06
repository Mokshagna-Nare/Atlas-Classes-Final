import React, { useCallback, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Squares2X2Icon, ClipboardCheckIcon, DocumentTextIcon, ChartPieIcon, CreditCardIcon } from '../../../components/icons';
import DashboardShell, { ShellNavGroup } from '../../../components/shell/DashboardShell';
import Tests from './components/Tests';
import Results from './components/Results';
import Fees from './components/Fees';
import Profile from './components/Profile';
import Analytics from './components/Analytics';

export type DashboardView = 'profile' | 'tests' | 'results' | 'analytics' | 'fees';

const NAV: ShellNavGroup<DashboardView>[] = [
  {
    heading: 'Learning',
    items: [
      { view: 'profile', label: 'Overview', subtitle: 'Your progress at a glance', icon: Squares2X2Icon },
      { view: 'tests', label: 'My Tests', subtitle: 'Tests assigned to your class', icon: ClipboardCheckIcon },
      { view: 'results', label: 'Results', subtitle: 'Every attempt, reviewed question by question', icon: DocumentTextIcon },
      { view: 'analytics', label: 'Analytics', subtitle: 'Overall, test-wise, and date-range insights', icon: ChartPieIcon },
    ],
  },
  {
    heading: 'Account',
    items: [{ view: 'fees', label: 'Fees', subtitle: 'Your fee schedule and payment history', icon: CreditCardIcon }],
  },
];

const StudentDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>('profile');
  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
    setTimeout(logout, 50);
  };

  const goTo = useCallback((view: DashboardView) => setActiveView(view), []);

  const renderContent = () => {
    switch (activeView) {
      case 'tests': return <Tests />;
      case 'results': return <Results />;
      case 'analytics': return <Analytics />;
      case 'fees': return <Fees />;
      default: return <Profile onNavigate={goTo} />;
    }
  };

  return (
    <DashboardShell<DashboardView>
      portalLabel="Student Portal"
      brand={<img src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" alt="Atlas Classes" className="h-14 w-auto object-contain" />}
      groups={NAV}
      activeView={activeView}
      onNavigate={goTo}
      user={{ name: user?.name || 'Student', caption: user?.roll_no ? `Roll ${user.roll_no}` : user?.email }}
      welcome={{ name: user?.name?.trim().split(/\s+/)[0] || 'there', tagline: "let's see how you're doing." }}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardShell>
  );
};

export default StudentDashboard;
