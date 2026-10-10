
import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Courses from './components/Courses';
import Mission from './components/Mission';
import Faculty from './components/Faculty';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { ChevronUpIcon } from '../../components/icons';
import { NAV_LINKS, SHOW_TEAM_SECTION } from '../../constants';
import Careers from './components/Careers';
import Benefits from './components/Benefits';
import { useSectionScroll, useRevealOnScroll, useSpotlight, ScrollProgress } from './motion';
import { focusRing } from './ui';

const LandingPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Program picked via a course card's "Enquire" button; pre-fills the contact form.
  const [enquiry, setEnquiry] = useState<{ program: string; at: number } | null>(null);
  
  const sectionRefs = {
    home: useRef<HTMLDivElement>(null),
    courses: useRef<HTMLDivElement>(null),
    benefits: useRef<HTMLDivElement>(null),
    mission: useRef<HTMLDivElement>(null),
    faculty: useRef<HTMLDivElement>(null),
    careers: useRef<HTMLDivElement>(null),
    contact: useRef<HTMLDivElement>(null),
  };

  const smoothScrollTo = useSectionScroll();
  useRevealOnScroll();
  useSpotlight();

  const handleScroll = () => {
    const pageYOffset = window.pageYOffset;
    
    // Back to top button visibility
    if (pageYOffset > 300) {
      setShowBackToTop(true);
    } else {
      setShowBackToTop(false);
    }

    // Active section highlighting
    let currentSection = 'home';
    NAV_LINKS.forEach((link) => {
      const ref = sectionRefs[link.href as keyof typeof sectionRefs];
      if (ref.current) {
        const sectionTop = ref.current.offsetTop - 150; // Adjusted offset for better detection
        const sectionHeight = ref.current.offsetHeight;
        if (pageYOffset >= sectionTop && pageYOffset < sectionTop + sectionHeight) {
          currentSection = link.href;
        }
      }
    });
    setActiveSection(currentSection);
  };

  useEffect(() => {
    // At most one update per frame, however fast scroll events arrive.
    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; handleScroll(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (id: string) => {
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (id === 'home') smoothScrollTo(0);
    else if (ref.current) smoothScrollTo(ref.current);
  };

  const scrollToTop = () => smoothScrollTo(0);

  const enquireAbout = (program: string) => {
    setEnquiry({ program, at: Date.now() });
    scrollToSection('contact');
  };

  return (
    <div className="bg-atlas-dark font-sans relative isolate overflow-x-hidden text-white">
      {/* Dark theme ambient glow */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_center,rgba(16,185,129,0.08),transparent_40%)] pointer-events-none"></div>
      
      <ScrollProgress />
      <Navbar activeSection={activeSection} scrollToSection={scrollToSection} />
      <main>
        <div ref={sectionRefs.home} id="home"><Hero scrollToSection={scrollToSection} /></div>
        <div ref={sectionRefs.courses} id="courses"><Courses onEnquire={enquireAbout} /></div>
        <div ref={sectionRefs.benefits} id="benefits"><Benefits /></div>
        <div ref={sectionRefs.mission} id="mission"><Mission /></div>
        {SHOW_TEAM_SECTION && <div ref={sectionRefs.faculty} id="faculty"><Faculty /></div>}
        <div ref={sectionRefs.careers} id="careers"><Careers /></div>
        <div ref={sectionRefs.contact} id="contact"><Contact enquiry={enquiry} /></div>
      </main>
      <Footer scrollToSection={scrollToSection} />
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
        aria-hidden={!showBackToTop}
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 rounded-full border border-emerald-300/40 bg-gradient-to-b from-emerald-400 to-emerald-500 p-3 text-gray-950 shadow-glow transition-all duration-500 ease-premium hover:-translate-y-1 hover:shadow-glow-lg active:scale-95 ${focusRing} ${
          showBackToTop ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-75 translate-y-4'
        }`}
      >
        <ChevronUpIcon className="h-6 w-6" />
      </button>
    </div>
  );
};

export default LandingPage;
