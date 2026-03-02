import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogoutIcon, ChartBarIcon, DocumentTextIcon, ClipboardCheckIcon, DocumentDuplicateIcon, MenuIcon, XIcon, DocumentTextIcon as SharedIcon } from '../../../components/icons';
import Tests from './components/Tests';
import Results from './components/Results';
import Analysis from './components/Analysis';
import QuestionPapers from './components/QuestionPapers';
import SharedPapers from './components/SharedPapers';

type DashboardView = 'tests' | 'papers' | 'results' | 'analysis' | 'shared-papers';

const InstituteDashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('analysis');
  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
    setTimeout(logout, 50);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'analysis': return <Analysis />;
      case 'results': return <Results />;
      case 'tests': return <Tests />;
      case 'papers': return <QuestionPapers />;
      case 'shared-papers': return <SharedPapers />;
      default: return <Analysis />;
    }
  };

  const NavItem: React.FC<{ view: DashboardView, label: string, icon: React.ReactNode }> = ({ view, label, icon }) => (
    <button
      onClick={() => {
          setActiveView(view);
          setIsSidebarOpen(false);
      }}
      className={`w-full text-left px-4 py-3 rounded-md transition-colors flex items-center space-x-3 ${
        activeView === view ? 'bg-green-900/30 text-atlas-green font-bold border-l-4 border-atlas-green' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex bg-atlas-dark text-white font-sans">
      {isSidebarOpen && (
          <div 
              className="fixed inset-0 bg-black/60 z-20 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
          ></div>
      )}
      <aside className={`fixed inset-y-0 left-0 bg-atlas-soft border-r border-gray-800 p-4 flex flex-col z-30 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header Section with both logos side-by-side */}
        <div className="flex justify-between items-center mb-8 w-full">
            <div className="flex flex-row items-center justify-start gap-2 w-full pr-1">
                {/* Atlas Logo */}
                <img 
                    src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                    alt="Atlas Classes" 
                    className="h-auto w-[45%] object-contain" 
                />
                {/* Visual Separator */}
                <div className="h-8 w-[1px] bg-gray-600 shrink-0"></div>
                {/* iLearn Logo */}
                <img 
                    src="https://i.postimg.cc/Y9jSSdVL/Logo-(ilearn).png" 
                    alt="iLearn" 
                    className="h-auto w-[45%] object-contain" 
                />
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white shrink-0 ml-1">
                <XIcon className="h-6 w-6" />
            </button>
        </div>

        <nav className="flex-grow space-y-2">
            <NavItem view="analysis" label="Analysis" icon={<ChartBarIcon className="h-5 w-5" />} />
            <NavItem view="results" label="Results" icon={<DocumentTextIcon className="h-5 w-5" />} />
            <NavItem view="tests" label="Tests" icon={<ClipboardCheckIcon className="h-5 w-5" />} />
            <NavItem view="papers" label="Question Papers" icon={<DocumentDuplicateIcon className="h-5 w-5" />} />
            <NavItem view="shared-papers" label="Shared Papers" icon={<SharedIcon className="h-5 w-5" />} />
        </nav>
        <div className="mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-md bg-gray-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 transition-colors">
            <LogoutIcon className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
            <main className="flex-1 p-4 md:p-8 overflow-auto bg-atlas-dark">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-300 p-1">
            <MenuIcon className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3">
              {/* Dynamic Logo (Mobile) - Removed circle, allowed natural width */}
              {user?.logo_url && (
                  <div className="h-10 w-auto max-w-[80px] shrink-0 bg-white/5 rounded-md p-1 flex items-center justify-center">
                      <img 
                          src={user.logo_url} 
                          alt="Institute Logo" 
                          className="h-full w-full object-contain" 
                      />
                  </div>
              )}
             <h1 className="text-xl font-bold truncate text-white">Welcome, {user?.name}</h1>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex flex-col mb-8">
          <div className="flex items-center gap-4">
              {/* Dynamic Logo (Desktop) - Removed circle, allowed natural width, scaled slightly */}
              {user?.logo_url && (
                  <div className="h-16 w-auto max-w-[140px] shrink-0 bg-white rounded-lg p-2 shadow-md flex items-center justify-center">
                      <img 
                          src={user.logo_url} 
                          alt={`${user?.name} logo`} 
                          // object-contain keeps aspect ratio, scale-110 slightly zooms past excess whitespace
                          className="h-full w-full object-contain scale-110" 
                      />
                  </div>
              )}
              <h1 className="text-3xl font-bold text-white tracking-tight">Welcome, {user?.name}</h1>
          </div>
          <p className="text-gray-500 mt-1">Here's your institute's performance overview.</p>
        </header>

        <div className="bg-atlas-soft p-4 sm:p-6 rounded-lg shadow-sm border border-gray-800">
          {renderContent()}
        </div>
      </main>

    </div>
  );
};

export default InstituteDashboard;
