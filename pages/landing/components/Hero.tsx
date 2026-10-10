
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
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-28 pb-16 md:pt-32">
      {/* Background with Parallax Effect */}
      <div ref={bgRef} className="absolute inset-0 z-0 will-change-transform">
        <img
          src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop" 
          alt="Mathematics and Science formulas background"
          className="w-full h-full object-cover scale-105 animate-pulse-slow opacity-40"
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-atlas-dark/95 via-atlas-dark/80 to-atlas-dark"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F19_100%)] opacity-90"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
      </div>

      {/* Floating Abstract Elements */}
      <div className="absolute top-1/3 -left-20 w-72 h-72 bg-atlas-primary/[0.14] rounded-full blur-[110px] animate-float delay-0" aria-hidden="true"></div>
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-atlas-primary/[0.14] rounded-full blur-[110px] animate-float" style={{animationDelay: '2s'}} aria-hidden="true"></div>

      {/* Soft hand-off into the next section (no hard seam) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-atlas-dark" />

      <div ref={contentRef} className="relative z-10 container mx-auto px-6 text-center max-w-5xl will-change-transform">
        {/* Chips */}
        <div className={`flex flex-wrap justify-center gap-3 mb-8 ${TALL}mb-10 animate-fade-in-up`} style={{animationDelay: '0.1s'}}>
            <span className="px-4 py-1.5 rounded-full bg-atlas-primary/10 backdrop-blur-md border border-atlas-primary/30 text-xs sm:text-sm font-bold text-atlas-primary uppercase tracking-wider">IIT-JEE</span>
            <span className="px-4 py-1.5 rounded-full bg-blue-500/10 backdrop-blur-md border border-blue-500/30 text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-wider">NEET</span>
            <span className="px-4 py-1.5 rounded-full bg-purple-500/10 backdrop-blur-md border border-purple-500/30 text-xs sm:text-sm font-bold text-purple-400 uppercase tracking-wider">Foundation</span>
        </div>

        {/* Main Headline */}
        <h1 className={`text-5xl md:text-7xl xl:text-8xl ${TALL}text-9xl font-extrabold mb-6 ${TALL}mb-8 leading-[1.05] tracking-tight text-white drop-shadow-2xl animate-fade-in-up`} style={{animationDelay: '0.3s'}}>
          Master the <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400">Future.</span>
          <br />
          <span className={`text-4xl md:text-6xl xl:text-7xl ${TALL}text-8xl text-gray-300 font-bold`}>Begin Your Journey.</span>
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
                <div key={idx} className="group/stat spotlight p-4 rounded-2xl bg-atlas-soft/30 border border-white/[0.06] backdrop-blur-sm">
                    <p className={`text-3xl md:text-4xl ${TALL}text-5xl font-bold text-white mb-1`}><CountUp value={stat.val} /></p>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold transition-colors duration-500 group-hover/stat:text-emerald-300">{stat.label}</p>
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
