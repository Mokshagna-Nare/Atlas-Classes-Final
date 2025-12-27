
import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogoutIcon, MenuIcon, XIcon } from '../../../components/icons';
import Tests from './components/Tests';
import Results from './components/Results';
import Fees from './components/Fees';
import Profile from './components/Profile';

type DashboardView = 'profile' | 'tests' | 'results' | 'fees';

const StudentDashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('profile');
  const { user, logout } = useAuth()!;
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
    setTimeout(logout, 50);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'profile': return <Profile />;
      case 'tests': return <Tests />;
      case 'results': return <Results />;
      case 'fees': return <Fees />;
      default: return <Profile />;
    }
  };

  const NavItem: React.FC<{ view: DashboardView, label: string }> = ({ view, label }) => (
    <button
      onClick={() => {
        setActiveView(view);
        setIsSidebarOpen(false);
      }}
      className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
        activeView === view ? 'bg-green-900/30 text-atlas-green font-bold border-l-4 border-atlas-green' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {label}
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
        <div className="flex justify-between items-center mb-8">
            <div className="px-2">
                <img 
                    src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                    alt="Atlas Classes" 
                    className="h-16 w-auto object-contain" 
                />
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
              <XIcon className="h-6 w-6" />
            </button>
        </div>
        <nav className="flex-grow space-y-2">
            <NavItem view="profile" label="My Profile" />
            <NavItem view="tests" label="My Tests" />
            <NavItem view="results" label="My Results" />
            <NavItem view="fees" label="My Fees" />
        </nav>
        <div className="mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-md bg-gray-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 transition-colors">
            <LogoutIcon className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-auto bg-atlas-dark">
        <header className="md:hidden flex justify-between items-center mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-300 p-1">
            <MenuIcon className="h-6 w-6" />
          </button>
           <h1 className="text-xl font-bold truncate text-white">Welcome, {user?.name}</h1>
        </header>
        <header className="hidden md:block mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome, {user?.name}</h1>
          <p className="text-gray-500">Your personal academic dashboard.</p>
        </header>
        <div className="bg-atlas-soft p-4 sm:p-6 rounded-lg shadow-sm border border-gray-800">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
