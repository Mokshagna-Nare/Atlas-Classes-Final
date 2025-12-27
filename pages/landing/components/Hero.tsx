
import React from 'react';
import { ArrowRightIcon, SparklesIcon } from '../../../components/icons';

interface HeroProps {
    scrollToSection: (id: string) => void;
}

const Hero: React.FC<HeroProps> = ({ scrollToSection }) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-40 md:pt-24 lg:pt-52">
      {/* Background with Parallax Effect */}
      <div className="absolute inset-0 z-0">
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
      <div className="absolute top-1/3 -left-20 w-64 h-64 bg-atlas-primary/20 rounded-full blur-[100px] animate-float delay-0"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>

      <div className="relative z-10 container mx-auto px-6 text-center max-w-5xl">
        {/* Chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
            <span className="px-5 py-2 rounded-full bg-atlas-primary/10 backdrop-blur-md border border-atlas-primary/30 text-sm font-bold text-atlas-primary uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)]">IIT-JEE</span>
            <span className="px-5 py-2 rounded-full bg-blue-500/10 backdrop-blur-md border border-blue-500/30 text-sm font-bold text-blue-400 uppercase tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.2)]">NEET</span>
            <span className="px-5 py-2 rounded-full bg-purple-500/10 backdrop-blur-md border border-purple-500/30 text-sm font-bold text-purple-400 uppercase tracking-wider shadow-[0_0_15px_rgba(168,85,247,0.2)]">Foundation</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-8 leading-tight tracking-tight text-white drop-shadow-2xl animate-fade-in-up" style={{animationDelay: '0.3s'}}>
          Master the <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400">Future.</span>
          <br />
          <span className="text-4xl md:text-6xl lg:text-7xl text-gray-300 font-bold">Begin Your Journey.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl max-w-3xl mx-auto mb-12 text-gray-400 font-medium leading-relaxed animate-fade-in-up" style={{animationDelay: '0.5s'}}>
          We bring metropolitan-level coaching structure, quality, and expertise directly to your school. 
          Build a solid foundation for competitive success with Atlas Classes.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 animate-fade-in-up" style={{animationDelay: '0.7s'}}>
            <button 
              onClick={() => scrollToSection('courses')}
              className="ripple group relative px-10 py-5 bg-atlas-primary text-white font-bold text-lg rounded-full overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:-translate-y-1"
            >
                <span className="relative z-10 flex items-center">
                    Explore Programs <ArrowRightIcon className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform"/>
                </span>
                <div className="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-emerald-600"></div>
            </button>
            
            <button 
              onClick={() => scrollToSection('contact')}
              className="group px-10 py-5 bg-atlas-soft/50 border border-gray-600 text-gray-200 font-bold text-lg rounded-full backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white hover:scale-105 hover:shadow-lg"
            >
                <span className="flex items-center">
                    Book a Demo <SparklesIcon className="ml-2 h-6 w-6 text-atlas-primary group-hover:animate-spin"/>
                </span>
            </button>
        </div>

        {/* Stats - Enhanced Visuals */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 text-center animate-fade-in-up" style={{animationDelay: '1s'}}>
            {[
                { val: '500+', label: 'Students' },
                { val: '98%', label: 'Success Rate' },
                { val: '15+', label: 'Expert Faculty' },
                { val: '10+', label: 'Partner Schools' }
            ].map((stat, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-atlas-soft/30 border border-white/5 hover:bg-atlas-soft/50 transition-colors duration-300 backdrop-blur-sm">
                    <p className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.val}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{stat.label}</p>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
