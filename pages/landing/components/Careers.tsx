
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../../../components/icons';
import { Reveal, SECTION_SPACING } from '../motion';
import { buttonPrimary, eyebrowChip, eyebrowDot } from '../ui';

const Careers: React.FC = () => {
  return (
    // In the light theme this band is a brand island: the page's one bold, saturated emerald card,
    // inset from the page edges (white text, mint accents, a white button).
    <section data-theme="brand" className={`${SECTION_SPACING} relative overflow-hidden light:mx-4 light:sm:mx-6 light:lg:mx-auto light:max-w-6xl light:rounded-[2rem] light:shadow-[0_30px_60px_-30px_rgba(11,122,85,0.55)]`}>
      {/* Background Texture */}
      <div className="absolute inset-0 bg-canvas-sage brand:bg-[radial-gradient(60%_80%_at_15%_0%,#14a374,transparent_70%),linear-gradient(135deg,#0b7a55,#075c40)]"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwaDQwVjBIMHY0MHptMjAgMjBoMjB2MjBIMjBWNjB6TTEwIDgwaDIwdjIwSDEwVjgwem0xMCAyMGgyMHYyMEgyMFYxMDB6IiBmaWxsPSIjMDBiYzc1IiBmaWxsLW9wYWNpdHk9IjAuMDIiLz48L2c+PC9zdmc+')] opacity-30 brand:opacity-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-canvas via-transparent to-canvas pointer-events-none brand:hidden"></div>
      
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-atlas-primary/5 brand:bg-[#34d399]/35 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
            <Reveal>
                 <span className={`${eyebrowChip} mb-6`}>
                    <span className={`${eyebrowDot} animate-pulse`} />
                    We are hiring
                 </span>
            </Reveal>
            <Reveal delay={90}>
                <h2 className="text-4xl md:text-6xl font-extrabold mb-8 text-white tracking-tight leading-[1.1]">
                  Shape the <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-300">Future</span> with Us
                </h2>
            </Reveal>

            <Reveal delay={180}>
                <p className="text-gray-400 mb-12 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                  We're a team of passionate innovators building the next generation of educational technology. If you're driven by purpose, creativity, and excellence, we want to hear from you.
                </p>
            </Reveal>

            <Reveal delay={270}>
                <Link to="/careers" className={`group ${buttonPrimary} px-8 sm:px-10 py-4 text-base sm:text-lg`}>
                  Explore Opportunities
                  <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 ease-premium group-hover:translate-x-1" />
                </Link>
                <p className="mt-6 text-sm text-gray-500">
                    Join <span className="text-white font-bold">Our expert team</span> making an impact.
                </p>
            </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Careers;
