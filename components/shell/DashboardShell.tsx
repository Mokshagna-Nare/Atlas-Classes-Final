import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogoutIcon, MenuIcon, XIcon } from '../icons';
import WelcomeSplash, { shouldShowWelcome } from './WelcomeSplash';
import ThemeToggle from '../ui/ThemeToggle';

export interface ShellNavItem<V extends string> {
  view: V;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  /** The page renders its own headline, so the top bar shows only the breadcrumb. */
  hasOwnHeading?: boolean;
  /** Small count shown on the right of the item (e.g. open tasks). */
  badge?: number | null;
  /** Accent for the badge: 'alert' for things needing attention. */
  badgeTone?: 'default' | 'alert';
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
  /**
   * The children manage their own mounting (several sections kept alive, the hidden ones
   * using the `hidden` attribute), so the shell must not remount them on every view change.
   */
  keepMounted?: boolean;
  /** Docked under the scrolling content (e.g. background tasks); never covers the page. */
  statusBar?: React.ReactNode;
  /** Floats over the content area (e.g. a quick-add button), above the status bar. */
  floating?: React.ReactNode;
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
      className="hidden sm:inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 light:bg-gray-950 light:border-gray-700 text-xs font-semibold text-gray-400 shrink-0"
      title="India Standard Time (UTC+5:30)"
    >
      <span>{istDate(now)}</span>
      <span className="h-3 w-px bg-white/10" aria-hidden="true" />
      <span className="tabular-nums text-white">{IST_TIME.format(now).replace(/\b(am|pm)\b/, m => m.toUpperCase())}</span>
      <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-emerald-300">IST</span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Collapsible sidebar (desktop): full panel ⇄ slim icon rail. Remembered per portal,
// toggled from the edge handle, the top-bar button or ⌘/Ctrl + B.
// ---------------------------------------------------------------------------
const RAIL_KEY = (portal: string) => `atlas-sidebar-rail:${portal}`;
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SHORTCUT = IS_MAC ? '⌘B' : 'Ctrl+B';
/** The "A" of the Atlas Classes logo (same artwork as the site's favicon). */
const ATLAS_MARK = 'https://i.postimg.cc/7hZVtdz9/Favicon-(without-BG)-(1).png';

function useDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/** The sidebar-panel glyph used on the toggle buttons. */
const PanelIcon: React.FC<{ className?: string; rail: boolean }> = ({ className = 'h-[18px] w-[18px]', rail }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3.5" />
    <path d="M9 4v16" />
    <path d={rail ? 'M13.5 10l2 2-2 2' : 'M15.5 10l-2 2 2 2'} strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
  </svg>
);

interface Tip { label: string; sub?: string; badge?: number | null; alert?: boolean; top: number; left: number }

function DashboardShell<V extends string>({
  portalLabel, brand, groups, activeView, onNavigate, user, welcome, onLogout, children, keepMounted, statusBar, floating,
}: DashboardShellProps<V>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_KEY(portalLabel)) === '1'; } catch { return false; }
  });
  const [tip, setTip] = useState<Tip | null>(null);
  const desktop = useDesktop();
  const rail = collapsed && desktop; // the phone drawer always shows the full panel
  const mainRef = useRef<HTMLDivElement>(null);

  const active = groups.flatMap(g => g.items).find(i => i.view === activeView);
  const handleWelcomeDone = useCallback(() => setShowWelcome(false), []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeView]);

  const toggleRail = useCallback(() => {
    setTip(null);
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(RAIL_KEY(portalLabel), next ? '1' : '0'); } catch { /* optional */ }
      return next;
    });
  }, [portalLabel]);

  // ⌘/Ctrl + B — unless the admin is typing (B for bold in an editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'b') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      e.preventDefault();
      toggleRail();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleRail]);

  useEffect(() => { if (!rail) setTip(null); }, [rail]);

  const showTip = (e: React.MouseEvent | React.FocusEvent, content: Omit<Tip, 'top' | 'left'>) => {
    if (!rail) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ ...content, top: r.top + r.height / 2, left: r.right + 14 });
  };
  const hideTip = () => setTip(null);

  const go = (view: V) => {
    onNavigate(view);
    setIsSidebarOpen(false);
    hideTip();
  };

  const ease = 'duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
  // Text that slides away as the panel narrows (kept in the DOM so it can animate back).
  const fade = `transition-[opacity,transform] ${ease} ${rail ? 'pointer-events-none -translate-x-2 opacity-0' : 'opacity-100'}`;

  return (
    <div className="min-h-screen flex bg-atlas-black text-white font-sans">
      {showWelcome && <WelcomeSplash name={welcome.name} portalLabel={portalLabel} tagline={welcome.tagline} onDone={handleWelcomeDone} />}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-scrim/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        data-rail={rail || undefined}
        className={`group/side fixed inset-y-0 left-0 bg-atlas-soft/95 backdrop-blur-xl border-r border-white/5 light:bg-paper light:border-gray-700 flex flex-col z-30 shrink-0 h-screen transform transition-[transform,width] ${ease} md:sticky md:top-0 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${rail ? 'w-[84px]' : 'w-64 xl:w-72'}`}
      >
        {/* Edge handle: collapse / expand */}
        <button
          type="button"
          onClick={toggleRail}
          onMouseEnter={e => showTip(e, { label: rail ? 'Expand sidebar' : 'Collapse sidebar', sub: SHORTCUT })}
          onMouseLeave={hideTip}
          title={rail ? undefined : `Collapse sidebar (${SHORTCUT})`}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!rail}
          className={`absolute -right-3.5 top-[88px] z-10 hidden h-7 w-7 items-center justify-center rounded-full bg-atlas-raised text-gray-400 ring-1 ring-white/15 shadow-[0_6px_18px_-6px_rgb(var(--shadow-rgb)/calc(0.9*var(--shadow-k)))] transition-all duration-300 hover:scale-110 hover:bg-emerald-400 hover:text-gray-950 hover:ring-emerald-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:flex light:bg-paper light:ring-gray-700 light:hover:bg-atlas-primary light:hover:text-on-accent ${rail ? 'opacity-100' : 'opacity-0 group-hover/side:opacity-100'}`}
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${ease} ${rail ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Brand zone */}
        <div className="relative shrink-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(52,211,153,0.16),rgba(52,211,153,0.04)_55%,transparent_80%)] light:bg-[radial-gradient(120%_90%_at_50%_0%,rgb(var(--c-brand-pale)),rgb(var(--c-brand-pale)/0.35)_60%,transparent_85%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" aria-hidden="true" />
        <div className={`relative flex items-center pt-6 pb-2 transition-[padding] ${ease} ${rail ? 'px-[16px]' : 'justify-between px-6'}`}>
          <div className={`min-w-0 ${fade} ${rail ? 'absolute' : ''}`}>{brand}</div>
          {/* Compact mark in the rail */}
          <button
            type="button"
            onClick={toggleRail}
            onMouseEnter={e => showTip(e, { label: 'Expand sidebar', sub: SHORTCUT })}
            onMouseLeave={hideTip}
            tabIndex={rail ? 0 : -1}
            aria-hidden={!rail}
            aria-label="Expand sidebar"
            className={`group/mark relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] ring-1 ring-inset ring-white/10 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[opacity,transform,box-shadow] ${ease} hover:ring-emerald-300/40 hover:shadow-[0_14px_34px_-10px_rgba(16,185,129,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:from-paper light:to-paper light:ring-brand-line light:shadow-[0_1px_2px_rgba(16,24,40,0.06),0_10px_24px_-12px_rgba(21,128,90,0.45)] ${rail ? 'scale-100 opacity-100' : 'pointer-events-none absolute scale-75 opacity-0'}`}
          >
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_35%,rgba(52,211,153,0.22),transparent_70%)] opacity-80 transition-opacity group-hover/mark:opacity-100" aria-hidden="true" />
            <img src={ATLAS_MARK} alt="Atlas Classes" className="keep-original-colors relative h-8 w-8 object-contain drop-shadow-[0_2px_6px_rgba(16,185,129,0.35)] transition-transform duration-300 group-hover/mark:scale-110" />
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors" aria-label="Close menu">
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <p className={`whitespace-nowrap px-6 text-[10px] font-black uppercase tracking-[0.3em] text-atlas-primary/80 transition-[opacity,height,padding] ${ease} ${rail ? 'h-0 pb-4 opacity-0' : 'h-auto pb-5 opacity-100'}`}>{portalLabel}</p>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent light:via-brand-line" aria-hidden="true" />
        </div>

        <nav className={`flex-grow overflow-y-auto overflow-x-hidden pt-5 pb-4 transition-[padding] ${ease} ${rail ? 'px-3 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'px-4 space-y-7'}`} aria-label={`${portalLabel} navigation`} onScroll={hideTip}>
          {groups.map((group, groupIndex) => (
            <div key={group.heading}>
              {rail ? (
                groupIndex > 0 && <div className="mx-auto mb-3 h-px w-8 bg-white/10 light:bg-gray-700" aria-hidden="true" />
              ) : (
                <p className="px-3 mb-2.5 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.25em] text-gray-600 animate-fade-in">{group.heading}</p>
              )}
              <div className="space-y-1">
                {group.items.map(({ view, label, subtitle, icon: Icon, badge, badgeTone }) => {
                  const isActive = activeView === view;
                  return (
                    <button
                      key={view}
                      onClick={() => go(view)}
                      onMouseEnter={e => showTip(e, { label, sub: subtitle, badge, alert: badgeTone === 'alert' })}
                      onMouseLeave={hideTip}
                      onFocus={e => showTip(e, { label, sub: subtitle, badge, alert: badgeTone === 'alert' })}
                      onBlur={hideTip}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={rail ? `${label}${badge ? `, ${badge} open` : ''}` : undefined}
                      className={`group relative w-full flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${rail ? 'px-[10px]' : 'px-3'} ${
                        isActive ? 'bg-atlas-primary/10 text-white light:bg-gray-100 light:text-on-accent light:shadow-[0_6px_16px_-6px_rgba(16,24,40,0.4)]' : 'text-gray-400 hover:bg-white/[0.04] hover:text-white light:hover:bg-gray-800'
                      }`}
                    >
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-atlas-primary transition-all duration-300 light:hidden ${isActive ? 'opacity-100' : 'opacity-0 -translate-x-1'} ${rail ? '-left-3' : ''}`} />
                      <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-atlas-primary/15 text-atlas-primary light:bg-paper/15 light:text-[#6ee7b7]' : 'bg-white/[0.03] text-gray-500 group-hover:text-gray-300 light:bg-gray-800 light:text-gray-500 light:group-hover:text-gray-200'}`}>
                        <Icon className="h-5 w-5" />
                        {rail && !!badge && (
                          <span className={`absolute -right-1.5 -top-1.5 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-black leading-[1.1rem] tabular-nums ring-2 ring-atlas-soft animate-success-pop light:ring-paper ${badgeTone === 'alert' ? 'bg-rose-500 text-white light:text-on-accent' : 'bg-emerald-400 text-gray-950 light:bg-atlas-primary light:text-on-accent'}`} aria-hidden="true">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </span>
                      <span className={`truncate whitespace-nowrap ${fade}`}>{label}</span>
                      {!!badge && (
                        <span className={`ml-auto min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black tabular-nums ${fade} ${badgeTone === 'alert' ? 'bg-rose-500/20 text-rose-200 light:bg-rose-500 light:text-on-accent' : 'bg-emerald-400/15 text-emerald-200 light:bg-brand-pale light:text-brand-deep'}`}
                          aria-label={`${badge} open`}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile zone */}
        <div className={`relative shrink-0 bg-black/25 bg-gradient-to-t from-black/30 to-transparent light:bg-gray-950 light:from-gray-950 transition-[padding] ${ease} ${rail ? 'px-3 pb-4 pt-5' : 'px-4 pb-4 pt-5'}`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent light:via-brand-line" aria-hidden="true" />
          <div className={`flex items-center rounded-2xl border transition-all ${ease} ${rail ? 'flex-col gap-1.5 border-white/[0.08] bg-white/[0.04] px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] light:border-gray-700 light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.05)]' : 'gap-3 p-3 bg-white/[0.04] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] light:bg-paper light:border-gray-700 light:shadow-[0_1px_2px_rgba(16,24,40,0.05)]'}`}>
            <div
              tabIndex={rail ? 0 : -1}
              onMouseEnter={e => showTip(e, { label: user.name, sub: user.caption })}
              onMouseLeave={hideTip}
              onFocus={e => showTip(e, { label: user.name, sub: user.caption })}
              onBlur={hideTip}
              className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {user.avatarUrl ? (
                <div className="h-10 w-10 rounded-xl bg-paper p-1 flex items-center justify-center">
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-atlas-primary flex items-center justify-center font-black text-atlas-black">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className={`min-w-0 flex-1 ${rail ? 'hidden' : 'animate-fade-in'}`}>
              <p className="text-sm font-bold text-white truncate" title={user.name}>{user.name}</p>
              {user.caption && <p className="text-[11px] text-gray-500 truncate" title={user.caption}>{user.caption}</p>}
            </div>
            <button
              onClick={onLogout}
              onMouseEnter={e => showTip(e, { label: 'Log out' })}
              onMouseLeave={hideTip}
              title={rail ? undefined : 'Log out'}
              aria-label="Log out"
              className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Rail tooltip (fixed, so the scrolling nav can't clip it) */}
      {rail && tip && (
        <div role="tooltip" style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-40 -translate-y-1/2 animate-menu-in">
          <div className="relative flex items-center gap-2.5 whitespace-nowrap rounded-xl bg-atlas-raised px-3 py-2 ring-1 ring-white/10 shadow-[0_16px_40px_-12px_rgb(var(--shadow-rgb)/calc(0.9*var(--shadow-k)))] light:bg-gray-100 light:ring-0">
            <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-atlas-raised ring-1 ring-white/10 [clip-path:polygon(0_0,0_100%,100%_100%)] light:bg-gray-100 light:ring-0" aria-hidden="true" />
            <span>
              <span className="block text-[13px] font-bold text-white light:text-on-accent">{tip.label}</span>
              {tip.sub && <span className="block text-[11px] text-gray-400 light:text-on-accent/70">{tip.sub}</span>}
            </span>
            {!!tip.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${tip.alert ? 'bg-rose-500 text-white light:text-on-accent' : 'bg-emerald-400 text-gray-950 light:bg-atlas-primary light:text-on-accent'}`}>{tip.badge} open</span>
            )}
          </div>
        </div>
      )}

      <main className="relative flex-1 min-w-0 h-screen flex flex-col">
        <div className="relative flex-1 min-h-0">
        <div ref={mainRef} className="absolute inset-0 overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_70%)]" />

        <header className="sticky top-0 z-10 bg-atlas-black/80 backdrop-blur-xl border-b border-white/5 light:bg-paper/85 light:border-gray-700 px-4 sm:px-8 py-4 flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-300 p-1" aria-label="Open menu">
            <MenuIcon className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={toggleRail}
            title={`${collapsed ? 'Show' : 'Hide'} sidebar (${SHORTCUT})`}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-pressed={collapsed}
            className="group/toggle relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-400 transition-all duration-200 hover:border-emerald-400/30 hover:bg-emerald-400/[0.08] hover:text-emerald-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 md:inline-flex light:border-gray-700 light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.06)] light:hover:border-brand-line light:hover:bg-brand-pale light:hover:text-brand-deep"
          >
            <PanelIcon rail={collapsed} />
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
          <ThemeToggle />
        </header>

        <div className={`relative px-4 sm:px-8 py-6 sm:py-8 ${floating ? 'pb-24' : ''}`}>
          {/* No per-section scroll animations here: animating sections gives each its own
              stacking context, which traps dropdowns (z-50) beneath the next section. */}
          {keepMounted ? children : (
            <div key={activeView} className="animate-view-in">
              {children}
            </div>
          )}
        </div>
        </div>
        {floating && <div className="pointer-events-none absolute inset-0 z-[15]">{floating}</div>}
        </div>
        {statusBar}
      </main>
    </div>
  );
}

export default DashboardShell;
