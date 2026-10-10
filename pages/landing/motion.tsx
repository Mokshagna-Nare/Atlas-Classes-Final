import React, { useEffect, useRef, useState } from 'react';

// Motion toolkit for the home page: smooth in-page navigation, reveal-on-scroll, count-up
// numbers, a scroll progress bar and the shared section heading. Scrolling itself stays
// native (no scroll hijacking); everything falls back to static content when the visitor
// prefers reduced motion.

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// In-page navigation
// ---------------------------------------------------------------------------

/** Extra space kept above a section when jumping to it, so its heading clears the fixed navbar. */
const SECTION_SCROLL_OFFSET = 32;

/** Glides to a section (or a y position) using the browser's native smooth scrolling. */
export function useSectionScroll() {
  return (target: HTMLElement | number) => {
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY - SECTION_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
}

// ---------------------------------------------------------------------------
// Reveal on scroll
// ---------------------------------------------------------------------------

/** Watches every `.reveal` element on the page and marks it visible as it scrolls into view. */
export function useRevealOnScroll() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

type RevealVariant = 'up' | 'left' | 'right' | 'scale';

/**
 * Wraps content that fades, rises and un-blurs into place. It's a wrapper (not a class on the
 * card itself) so a card's own hover transform/transition never fights the reveal.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  as?: 'div' | 'li' | 'span';
}> = ({ children, delay = 0, variant = 'up', className = '', as: Tag = 'div' }) => (
  <Tag
    className={`reveal ${variant === 'up' ? '' : `reveal-${variant}`} ${className}`}
    style={{ '--reveal-delay': delay } as React.CSSProperties}
  >
    {children}
  </Tag>
);

// ---------------------------------------------------------------------------
// Spotlight hover
// ---------------------------------------------------------------------------

/**
 * Feeds the cursor position to .spotlight cards (as --mx / --my) for the cursor-following glow.
 * Inside a [data-spotlight-group] every card is updated, so neighbours' edges light up as the
 * cursor approaches. One passive listener for the page, at most one update per frame, mouse only.
 */
export function useSpotlight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const update = () => {
      frame = 0;
      const e = last;
      const target = e?.target as Element | null;
      if (!e || !target?.closest) return;
      const group = target.closest('[data-spotlight-group]');
      const single = target.closest<HTMLElement>('.spotlight');
      const cards = group ? Array.from(group.querySelectorAll<HTMLElement>('.spotlight')) : single ? [single] : [];
      for (const card of cards) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      last = e;
      if (!frame) frame = requestAnimationFrame(update);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Count-up numbers
// ---------------------------------------------------------------------------

/** "500+" counts 0 → 500 (keeping the "+") once it scrolls into view. */
export const CountUp: React.FC<{ value: string; duration?: number; className?: string }> = ({ value, duration = 1600, className }) => {
  const match = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(value);
  const target = match ? parseFloat(match[2]) : 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() || !match ? target : 0));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!match || prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 4); // quart-out: fast start, gentle landing
          setShown(Math.round(target * eased));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!match) return <span className={className}>{value}</span>;
  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`}>
      {match[1]}
      {shown}
      {match[3]}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Scroll progress
// ---------------------------------------------------------------------------

/** Thin emerald bar across the top of the viewport showing how far down the page you are. */
export const ScrollProgress: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]" aria-hidden="true">
      <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-emerald-500 via-atlas-primary to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.7)]" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

/** Shared heading for every home page section: eyebrow, title, accent bar, subtitle — staggered in. */
export const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}> = ({ eyebrow, title, subtitle, align = 'center', className = '' }) => {
  const centered = align === 'center';
  return (
    <div className={`${centered ? 'mx-auto max-w-3xl text-center' : 'text-left'} mb-14 md:mb-16 ${className}`}>
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-atlas-primary/25 bg-atlas-primary/[0.08] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-atlas-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-atlas-primary shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={90}>
        <h2 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-white">{title}</h2>
      </Reveal>
      <Reveal delay={170} variant="scale">
        <div className={`mt-6 h-1.5 w-20 rounded-full bg-gradient-to-r from-atlas-primary to-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] ${centered ? 'mx-auto' : ''}`} />
      </Reveal>
      {subtitle && (
        <Reveal delay={240}>
          <p className={`mt-6 text-lg leading-relaxed text-gray-400 ${centered ? 'mx-auto max-w-2xl' : 'max-w-xl'}`}>{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
};

/** Consistent vertical rhythm for every content section on the home page. */
export const SECTION_SPACING = 'py-20 md:py-28';
