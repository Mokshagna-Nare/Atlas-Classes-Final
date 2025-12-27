
import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Courses from './components/Courses';
import Mission from './components/Mission';
import Faculty from './components/Faculty';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { ChevronUpIcon } from '../../components/icons';
import { NAV_LINKS } from '../../constants';
import Careers from './components/Careers';
import Benefits from './components/Benefits';

const LandingPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  const sectionRefs = {
    home: useRef<HTMLDivElement>(null),
    courses: useRef<HTMLDivElement>(null),
    benefits: useRef<HTMLDivElement>(null),
    mission: useRef<HTMLDivElement>(null),
    faculty: useRef<HTMLDivElement>(null),
    careers: useRef<HTMLDivElement>(null),
    contact: useRef<HTMLDivElement>(null),
  };

  // Scroll Observer for Animations
  useEffect(() => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, observerOptions);

    // Target all elements with 'reveal-on-scroll' class
    document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
        observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

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
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (id: string) => {
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-atlas-dark font-sans relative isolate overflow-x-hidden text-white">
      {/* Dark theme ambient glow */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_center,rgba(122,184,0,0.08),transparent_40%)] pointer-events-none"></div>
      
      <Navbar activeSection={activeSection} scrollToSection={scrollToSection} />
      <main>
        <div ref={sectionRefs.home} id="home"><Hero scrollToSection={scrollToSection} /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.courses} id="courses"><Courses /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.benefits} id="benefits"><Benefits /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.mission} id="mission"><Mission /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.faculty} id="faculty"><Faculty /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.careers} id="careers"><Careers /></div>
        <div className="reveal-on-scroll" ref={sectionRefs.contact} id="contact"><Contact /></div>
      </main>
      <Footer />
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-atlas-green text-white p-3 rounded-full shadow-[0_0_15px_rgba(122,184,0,0.5)] hover:bg-green-600 hover:shadow-[0_0_25px_rgba(122,184,0,0.7)] hover:-translate-y-1 transition-all duration-300 z-50 border border-green-500/50"
          aria-label="Back to top"
        >
          <ChevronUpIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default LandingPage;
