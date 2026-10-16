import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Light / dark theme. Every colour in the app is a CSS variable (theme.css), so switching is one
// attribute on <html>. The saved choice is applied before first paint by the inline script in
// index.html; this context keeps React in step, animates the switch and syncs other tabs.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'atlas-theme';
const PAGE_COLOUR: Record<Theme, string> = { light: '#f6f8f7', dark: '#0b0f19' };
const SWEEP_MS = 650;
const SWEEP_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  /** `origin` is the viewport point the new theme sweeps out from (usually the toggle's centre). */
  setTheme: (theme: Theme, origin?: { x: number; y: number }) => void;
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const currentTheme = (): Theme =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  root.style.backgroundColor = PAGE_COLOUR[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE_COLOUR[theme]);
}

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(currentTheme);
  const transition = useRef<ViewTransitionLike | null>(null);
  /** The latest theme asked for — may be ahead of the DOM while a sweep is starting. */
  const target = useRef<Theme>(currentTheme());
  const fadeTimer = useRef<number | undefined>(undefined);

  const setTheme = useCallback((next: Theme, origin?: { x: number; y: number }) => {
    if (next === target.current) return;
    target.current = next;
    // A sweep still playing is cut short, so rapid toggles always land on the latest choice.
    transition.current?.skipTransition();
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: choice lasts this visit */ }

    // Applies whatever was asked for last, so a skipped sweep's late callback can't undo a newer choice.
    const commit = () => {
      applyTheme(target.current);
      flushSync(() => setThemeState(target.current));
    };
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = (document as Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike }).startViewTransition;

    if (reduceMotion) {
      commit();
      return;
    }
    if (!start) {
      // No View Transitions (older Safari/Firefox): crossfade colours instead.
      window.clearTimeout(fadeTimer.current);
      root.classList.add('theme-fading');
      commit();
      fadeTimer.current = window.setTimeout(() => root.classList.remove('theme-fading'), 360);
      return;
    }

    const x = origin?.x ?? window.innerWidth - 48;
    const y = origin?.y ?? 40;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = start.call(document, commit);
    transition.current = vt;
    vt.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: SWEEP_MS, easing: SWEEP_EASE, pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => { /* skipped — the theme is already applied */ });
    vt.finished.finally(() => {
      if (transition.current === vt) transition.current = null;
    });
  }, []);

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => setTheme(target.current === 'dark' ? 'light' : 'dark', origin),
    [setTheme],
  );

  // Another tab changed the theme: follow it without animating.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next: Theme = e.newValue === 'light' ? 'light' : 'dark';
      target.current = next;
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
