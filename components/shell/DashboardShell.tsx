import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogoutIcon, MenuIcon, XIcon } from '../icons';
import WelcomeSplash, { shouldShowWelcome } from './WelcomeSplash';

export interface ShellNavItem<V extends string> {
  view: V;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  /** The page renders its own headline, so the top bar shows only the breadcrumb. */
  hasOwnHeading?: boolean;
}

export interface ShellNavGroup<V extends string> {
  heading: string;
  items: ShellNavItem<V>[];
}

interface DashboardShellProps<V extends string> {
  portalLabel: string;
  brand: React.ReactNode;
  groups: ShellNavGroup<V>[];
  activeView: V;
  onNavigate: (view: V) => void;
  user: { name: string; caption?: string; avatarUrl?: string | null };
  welcome: { name: string; tagline: string };
  onLogout: () => void;
  children: React.ReactNode;
}

const IST_DATE = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
/** "Wed, 7 Oct 2026" — en-IN on its own inserts a comma after the month. */
const istDate = (d: Date) => {
  const p = Object.fromEntries(IST_DATE.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
};
const IST_TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

/** Live date & time in India Standard Time. Its own component so the per-second tick re-renders only this chip. */
const LiveClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span
      className="hidden sm:inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs font-semibold text-gray-400 shrink-0"
      title="India Standard Time (UTC+5:30)"
    >
      <span>{istDate(now)}</span>
      <span className="h-3 w-px bg-white/10" aria-hidden="true" />
      <span className="tabular-nums text-white">{IST_TIME.format(now).replace(/\b(am|pm)\b/, m => m.toUpperCase())}</span>
      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-emerald-300">IST</span>
    </span>
  );
};

function DashboardShell<V extends string>({
  portalLabel, brand, groups, activeView, onNavigate, user, welcome, onLogout, children,
}: DashboardShellProps<V>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const mainRef = useRef<HTMLElement>(null);

  const active = groups.flatMap(g => g.items).find(i => i.view === activeView);
  const handleWelcomeDone = useCallback(() => setShowWelcome(false), []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeView]);

  const go = (view: V) => {
    onNavigate(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-atlas-black text-white font-sans">
      {showWelcome && <WelcomeSplash name={welcome.name} portalLabel={portalLabel} tagline={welcome.tagline} onDone={handleWelcomeDone} />}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 bg-atlas-soft/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-30 w-64 xl:w-72 shrink-0 h-screen transform transition-transform duration-300 ease-out md:sticky md:top-0 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <div className="min-w-0">{brand}</div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors" aria-label="Close menu">
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="px-6 pb-6 text-[10px] font-black uppercase tracking-[0.3em] text-atlas-primary/80">{portalLabel}</p>

        <nav className="flex-grow px-4 space-y-7 overflow-y-auto pb-4" aria-label={`${portalLabel} navigation`}>
          {groups.map(group => (
            <div key={group.heading}>
              <p className="px-3 mb-2.5 text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">{group.heading}</p>
              <div className="space-y-1">
                {group.items.map(({ view, label, icon: Icon }) => {
                  const isActive = activeView === view;
                  return (
                    <button
                      key={view}
                      onClick={() => go(view)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        isActive ? 'bg-atlas-primary/10 text-white' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-atlas-primary transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 -translate-x-1'}`} />
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-atlas-primary/15 text-atlas-primary' : 'bg-white/[0.03] text-gray-500 group-hover:text-gray-300'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            {user.avatarUrl ? (
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white p-1 flex items-center justify-center">
                <img src={user.avatarUrl} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-atlas-primary flex items-center justify-center font-black text-atlas-black">
                {user.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate" title={user.name}>{user.name}</p>
              {user.caption && <p className="text-[11px] text-gray-500 truncate" title={user.caption}>{user.caption}</p>}
            </div>
            <button onClick={onLogout} title="Log out" aria-label="Log out" className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <main ref={mainRef} className="relative flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_70%)]" />

        <header className="sticky top-0 z-10 bg-atlas-black/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 py-4 flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-300 p-1" aria-label="Open menu">
            <MenuIcon className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-gray-500 font-semibold shrink-0">{portalLabel}</span>
              <span className="hidden sm:inline text-gray-700 shrink-0">/</span>
              <span className="text-lg sm:text-xl font-black text-white tracking-tight truncate">{active?.label}</span>
            </nav>
            {active && !active.hasOwnHeading && <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">{active.subtitle}</p>}
          </div>
          <LiveClock />
        </header>

        <div className="relative px-4 sm:px-8 py-6 sm:py-8">
          {/* No per-section scroll animations here: animating sections gives each its own
              stacking context, which traps dropdowns (z-50) beneath the next section. */}
          <div key={activeView} className="animate-view-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardShell;
