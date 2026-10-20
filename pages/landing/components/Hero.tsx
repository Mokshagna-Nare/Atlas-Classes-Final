
import React, { useEffect, useRef } from 'react';
import { ArrowRightIcon, SparklesIcon } from '../../../components/icons';
import { CountUp, prefersReducedMotion } from '../motion';
import { buttonPrimary, buttonSecondary, focusRing } from '../ui';

/**
 * Variant prefix for large, tall displays (1536px+ wide and 1200px+ tall, e.g. 1440p monitors):
 * the hero scales up there so it reads as a statement instead of floating in empty space.
 * (At 1080p the standard size already fills the screen well and leaves room for the scroll cue.)
 */
const TALL = '[@media(min-width:1536px)_and_(min-height:1200px)]:';

interface HeroProps {
    scrollToSection: (id: string) => void;
}

const Hero: React.FC<HeroProps> = ({ scrollToSection }) => {
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Parallax: the background drifts slower than the page, and the headline eases back and
  // fades as you scroll into the next section. Transform/opacity only, once per frame.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      if (y > vh * 1.2) return;
      if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${y * 0.15}px, 0)`;
      // On phones the hero is taller than the screen, so fading it would dim content still being read.
      if (contentRef.current && window.innerWidth >= 768) {
        const p = Math.min(1, y / (vh * 0.85));
        contentRef.current.style.transform = `translate3d(0, ${y * 0.08}px, 0)`;
        contentRef.current.style.opacity = String(1 - p * 0.45);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    // Vertical balance: the navbar visibly ends ~81px down, so the top padding (128px) is "navbar + 47px".
    // Bottom padding 64px = 47px + a 16px optical lift: the content block sits centred in the space
    // below the navbar, a touch above true centre (true centre reads slightly low to the eye).
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-28 pb-16 md:pt-32 light:bg-paper">
      {/* Background with Parallax Effect */}
      <div ref={bgRef} className="absolute inset-0 z-0 will-change-transform">
        <img
          src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop" 
          alt="Mathematics and Science formulas background"
          className="w-full h-full object-cover scale-105 animate-pulse-slow opacity-40 light:hidden"
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/95 via-canvas/80 to-canvas light:from-transparent light:via-transparent light:to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgb(var(--c-canvas))_100%)] opacity-90 light:opacity-0"></div>
        {/* Light theme: soft pastel colour clouds (mint, aqua, a little lemon and peach) on white,
            with thin orbit lines drifting around the headline */}
        <div className="absolute inset-0 hidden light:block bg-[radial-gradient(30%_38%_at_18%_30%,rgba(110,231,183,0.45),transparent_72%),radial-gradient(28%_36%_at_84%_26%,rgba(125,211,252,0.35),transparent_72%),radial-gradient(30%_30%_at_70%_74%,rgba(253,230,138,0.38),transparent_72%),radial-gradient(28%_28%_at_30%_76%,rgba(254,205,211,0.32),transparent_72%)] blur-2xl"></div>
        <svg aria-hidden="true" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 hidden h-full w-full light:block">
          <g fill="none" strokeWidth="1.2">
            <ellipse cx="600" cy="330" rx="520" ry="150" transform="rotate(-12 600 330)" stroke="rgba(21,128,90,0.16)" />
            <ellipse cx="600" cy="340" rx="440" ry="200" transform="rotate(8 600 340)" stroke="rgba(56,189,248,0.14)" />
          </g>
          <path d="M1010 196l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="rgba(21,128,90,0.35)" />
          <path d="M214 470l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="rgba(56,189,248,0.35)" />
        </svg>
        <div className="absolute top-0 left-0 w-full h-full light:hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
      </div>

      {/* Floating Abstract Elements */}
      <div className="absolute top-1/3 -left-20 w-72 h-72 bg-atlas-primary/[0.14] light:hidden rounded-full blur-[110px] animate-float delay-0" aria-hidden="true"></div>
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-atlas-primary/[0.14] light:hidden rounded-full blur-[110px] animate-float" style={{animationDelay: '2s'}} aria-hidden="true"></div>

      {/* Soft hand-off into the next section (no hard seam) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-canvas" />

      <div ref={contentRef} className="relative z-10 container mx-auto px-6 text-center max-w-5xl will-change-transform">
        {/* Chips */}
        <div className={`flex flex-wrap justify-center gap-3 mb-8 ${TALL}mb-10 animate-fade-in-up`} style={{animationDelay: '0.1s'}}>
            <span className="px-4 py-1.5 rounded-full bg-atlas-primary/10 backdrop-blur-md border border-atlas-primary/30 text-xs sm:text-sm font-bold text-atlas-primary uppercase tracking-wider light:bg-brand-pale light:border-brand-line light:text-brand-deep">IIT-JEE</span>
            <span className="px-4 py-1.5 rounded-full bg-blue-500/10 backdrop-blur-md border border-blue-500/30 text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-wider light:bg-sky-900/40 light:border-sky-800">NEET</span>
            <span className="px-4 py-1.5 rounded-full bg-purple-500/10 backdrop-blur-md border border-purple-500/30 text-xs sm:text-sm font-bold text-purple-400 uppercase tracking-wider light:bg-violet-900/40 light:border-violet-800">Foundation</span>
        </div>

        {/* Main Headline */}
        <h1 className={`text-5xl md:text-7xl xl:text-8xl ${TALL}text-9xl font-extrabold mb-6 ${TALL}mb-8 leading-[1.05] tracking-tight text-white drop-shadow-2xl light:drop-shadow-none animate-fade-in-up`} style={{animationDelay: '0.3s'}}>
          Master the <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400 light:from-brand-deep light:via-atlas-primary light:to-brand-vivid">Future.</span>
          <br />
          <span className={`text-4xl md:text-6xl xl:text-7xl ${TALL}text-8xl text-gray-300 light:text-gray-200 font-bold`}>Begin Your Journey.</span>
        </h1>

        {/* Subheadline */}
        <p className={`text-lg md:text-xl ${TALL}text-2xl max-w-3xl ${TALL}max-w-4xl mx-auto mb-10 ${TALL}mb-12 text-gray-400 font-medium leading-relaxed animate-fade-in-up`} style={{animationDelay: '0.5s'}}>
          We bring metropolitan-level coaching structure, quality, and expertise directly to your school. 
          Build a solid foundation for competitive success with Atlas Classes.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4 max-w-sm sm:max-w-none mx-auto animate-fade-in-up" style={{animationDelay: '0.7s'}}>
            <button type="button" onClick={() => scrollToSection('courses')} className={`group ${buttonPrimary} px-8 py-4 text-base sm:text-lg`}>
                Explore Programs
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 ease-premium group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={() => scrollToSection('contact')} className={`group ${buttonSecondary} px-8 py-4 text-base sm:text-lg`}>
                Book a Demo
                <SparklesIcon className="h-5 w-5 text-atlas-primary transition-transform duration-500 ease-premium group-hover:rotate-12" />
            </button>
        </div>

        {/* Stats - Enhanced Visuals */}
        <div data-spotlight-group className={`mt-14 ${TALL}mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center animate-fade-in-up`} style={{animationDelay: '1s'}}>
            {[
                { val: '500+', label: 'Students' },
                { val: '98%', label: 'Success Rate' },
                { val: '15+', label: 'Expert Faculty' },
                { val: '10+', label: 'Partner Schools' }
            ].map((stat, idx) => (
                <div key={idx} className="group/stat spotlight p-4 rounded-2xl bg-atlas-soft/30 border border-white/[0.06] backdrop-blur-sm light:rounded-[1.25rem] light:bg-paper/90 light:backdrop-blur-md light:border-gray-700/70 light:py-5 light:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-14px_rgba(16,24,40,0.12)] light:hover:border-brand-line">
                    <p className={`text-3xl md:text-4xl ${TALL}text-5xl font-bold text-white mb-1 light:font-extrabold light:tracking-tight`}><CountUp value={stat.val} /></p>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold transition-colors duration-500 group-hover/stat:text-emerald-300 light:text-gray-500">{stat.label}</p>
                </div>
            ))}
        </div>
      </div>

      {/* Scroll cue (only when there's vertical room for it under the stats) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 hidden justify-center [@media(min-height:940px)]:flex">
        <button
          type="button"
          onClick={() => scrollToSection('courses')}
          aria-label="Scroll to programs"
          className={`pointer-events-auto flex flex-col items-center gap-2 rounded-lg p-1 text-gray-500 transition-colors hover:text-atlas-primary animate-fade-in-up ${focusRing}`}
          style={{ animationDelay: '1.4s' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Scroll</span>
          <span className="flex h-9 w-5 justify-center rounded-full border border-current pt-1.5">
            <span className="h-2 w-1 rounded-full bg-current animate-[scrollCue_1.8s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
          </span>
        </button>
      </div>
    </section>
  );
};

export default Hero;
