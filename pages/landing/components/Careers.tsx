
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../../../components/icons';

const Careers: React.FC = () => {
  return (
    <section 
      className="py-32 relative overflow-hidden"
      id="careers"
    >
      {/* Background Texture */}
      <div className="absolute inset-0 bg-atlas-soft"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwaDQwVjBIMHY0MHptMjAgMjBoMjB2MjBIMjBWNjB6TTEwIDgwaDIwdjIwSDEwVjgwem0xMCAyMGgyMHYyMEgyMFYxMDB6IiBmaWxsPSIjMDBiYzc1IiBmaWxsLW9wYWNpdHk9IjAuMDIiLz48L2c+PC9zdmc+')] opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-atlas-dark via-transparent to-atlas-dark pointer-events-none"></div>
      
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-atlas-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
            <div className="reveal-on-scroll">
                 <span className="inline-block py-1 px-3 rounded-full bg-atlas-primary/10 border border-atlas-primary/30 text-atlas-primary text-xs font-bold uppercase tracking-widest mb-6 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    We are Hiring
                 </span>
                <h2 className="text-5xl md:text-6xl font-extrabold mb-8 text-white tracking-tight leading-tight">
                  Shape the <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-300">Future</span> with Us
                </h2>
            </div>
            
            <div className="reveal-on-scroll" style={{transitionDelay: '0.1s'}}>
                <p className="text-gray-400 mb-12 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                  We're a team of passionate innovators building the next generation of educational technology. If you're driven by purpose, creativity, and excellence, we want to hear from you.
                </p>
            </div>

            <div className="reveal-on-scroll" style={{transitionDelay: '0.2s'}}>
                <Link
                  to="/careers"
                  className="group relative inline-flex items-center justify-center py-4 px-10 font-bold text-lg text-white bg-atlas-primary rounded-full overflow-hidden transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:-translate-y-1"
                >
                  <span className="relative z-10 flex items-center">
                      Explore Opportunities 
                      <ArrowRightIcon className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                  <div className="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-emerald-600"></div>
                </Link>
                <p className="mt-6 text-sm text-gray-500">
                    Join <span className="text-white font-bold">Our expert team</span> making an impact.
                </p>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Careers;
