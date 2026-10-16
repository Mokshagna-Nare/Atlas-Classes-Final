import React, { useId } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Sun ⇄ moon toggle. The disc grows into a moon as a shadow slides across it while the rays
// spin away (and back the other way); the new theme then sweeps out in a circle from the button.

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

interface ThemeToggleProps {
  className?: string;
  /** 'md' = 40px (headers), 'sm' = 36px (compact bars). */
  size?: 'sm' | 'md';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const { isDark, toggleTheme } = useTheme();
  const maskId = `theme-moon-${useId().replace(/:/g, '')}`;
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  const t = (ms: number, delay = 0) => ({ transition: `transform ${ms}ms ${EASE} ${delay}ms, opacity ${ms}ms ${EASE} ${delay}ms` });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-300 shadow-[inset_0_1px_0_rgb(var(--c-white)/0.04)] transition-[background-color,border-color,color,transform] duration-200 ease-premium hover:border-emerald-400/30 hover:bg-emerald-400/[0.08] hover:text-emerald-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-black light:border-gray-700 light:bg-paper light:shadow-[0_1px_2px_rgba(28,25,23,0.06)] light:hover:border-brand-line light:hover:bg-brand-pale light:hover:text-brand-deep ${size === 'sm' ? 'h-9 w-9' : 'h-10 w-10'} ${className}`}
    >
      {/* Soft glow behind the icon on hover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_50%_50%,rgb(var(--c-emerald-400)/0.22),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <svg viewBox="0 0 24 24" aria-hidden="true" className="relative h-[18px] w-[18px] overflow-visible">
        <mask id={maskId}>
          <rect x="-4" y="-4" width="32" height="32" fill="white" />
          {/* The moon's shadow: slides over the disc in dark mode, parked off the disc in light. */}
          <circle
            cx="12" cy="12" r="8" fill="black"
            style={{ ...t(600), transform: isDark ? 'translate(6px, -5px)' : 'translate(16px, -16px)' }}
          />
        </mask>
        <circle
          cx="12" cy="12" r="8" fill="currentColor" mask={`url(#${maskId})`}
          style={{ ...t(600), transformBox: 'fill-box', transformOrigin: 'center', transform: isDark ? 'scale(1) rotate(-25deg)' : 'scale(0.55)' }}
        />
        <g
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ ...t(isDark ? 300 : 600, isDark ? 0 : 120), transformOrigin: '12px 12px', transform: isDark ? 'rotate(-90deg) scale(0.4)' : 'rotate(0deg) scale(1)', opacity: isDark ? 0 : 1 }}
        >
          {RAYS.map(a => (
            <line key={a} x1="12" y1="2.2" x2="12" y2="4.2" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      </svg>
    </button>
  );
};

export default ThemeToggle;
