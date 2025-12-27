
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../../../constants';
import { MenuIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '../../../components/icons';

interface NavbarProps {
    activeSection: string;
    scrollToSection: (id: string) => void;
}

interface DropdownProps {
    buttonText: string;
    children: React.ReactNode;
    buttonClassName?: string;
    active?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ buttonText, children, buttonClassName, active }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative group" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center transition-all duration-300 ease-in-out ${buttonClassName}`}
            >
                {buttonText}
                <ChevronDownIcon className={`h-3.5 w-3.5 ml-1.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-3 w-56 bg-atlas-soft/95 backdrop-blur-2xl rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] border border-white/10 py-2 z-20 animate-scale-in origin-top-right overflow-hidden ring-1 ring-white/5">
                    {children}
                </div>
            )}
        </div>
    );
};

// Mobile Accordion for Logins
const MobileAccordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-white/5 last:border-0">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-4 px-2 text-gray-300 hover:text-white transition-colors font-medium"
            >
                {title}
                {isOpen ? <ChevronUpIcon className="h-4 w-4 text-atlas-primary" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-60 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
                <div className="space-y-2 px-2">
                    {children}
                </div>
            </div>
        </div>
    );
}

const Navbar: React.FC<NavbarProps> = ({ activeSection, scrollToSection }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const handleNavClick = (href: string) => {
        if (href === 'home') {
            window.location.hash = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            scrollToSection(href);
        }
        setIsOpen(false);
    };

    // Close menu on resize to prevent layout issues on large screens
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) { // Close on lg breakpoint
                setIsOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Detect scroll for sticky header styling
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header 
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                isScrolled || isOpen
                ? 'bg-atlas-dark/95 backdrop-blur-xl shadow-lg shadow-black/50 border-b border-white/5 py-3 lg:py-4' 
                : 'bg-transparent border-b border-transparent py-5 lg:py-6'
            }`}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center relative">
                
                {/* Logo */}
                <div className="cursor-pointer flex-shrink-0 flex items-center transform transition-transform duration-300 hover:scale-105 z-50" onClick={() => handleNavClick('home')}>
                    <img 
                        src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                        alt="Atlas Classes" 
                        className="h-10 sm:h-12 lg:h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                    />
                </div>

                {/* Desktop Nav - Visible on Large Screens (1024px+) */}
                {/* Uses lg:flex to ensure it shows on small laptops/landscape tablets */}
                <nav className="hidden lg:flex items-center space-x-1 bg-atlas-soft/40 backdrop-blur-2xl px-3 py-2 rounded-full border border-white/10 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] mx-4 flex-shrink max-w-4xl justify-center">
                    {NAV_LINKS.map((link) => {
                         const isActive = activeSection === link.href;
                         return (
                            <button
                                key={link.name}
                                onClick={() => handleNavClick(link.href)}
                                className={`relative px-4 xl:px-6 py-2.5 rounded-full text-xs xl:text-sm transition-all duration-300 font-medium overflow-hidden group whitespace-nowrap ${
                                    isActive 
                                    ? 'text-white bg-atlas-primary/15 border border-atlas-primary/40 shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <span className="relative z-10">{link.name}</span>
                                {isActive && (
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Desktop Actions - Visible on Large Screens */}
                <div className="hidden lg:flex items-center space-x-2 xl:space-x-4 flex-shrink-0">
                    <Dropdown
                        buttonText="Login"
                        buttonClassName="text-xs xl:text-sm font-semibold text-gray-400 hover:text-white transition-colors px-3 py-2 hover:bg-white/5 rounded-lg"
                    >
                       <Link to="/login/student" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary transition-colors border-l-2 border-transparent hover:border-atlas-primary">Student Login</Link>
                       <Link to="/login/institute" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary transition-colors border-l-2 border-transparent hover:border-atlas-primary">Institute Login</Link>
                       <Link to="/login/admin" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary transition-colors border-l-2 border-transparent hover:border-atlas-primary">Admin Login</Link>
                    </Dropdown>
                    <Dropdown
                        buttonText="Sign Up"
                        buttonClassName="text-xs xl:text-sm font-bold bg-atlas-primary text-white px-6 py-3 rounded-full shadow-[0_0_20px_-5px_rgba(16,185,129,0.6)] hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.8)] hover:bg-emerald-500 transition-all duration-300 border border-emerald-400/30 hover:-translate-y-0.5 whitespace-nowrap"
                    >
                       <Link to="/signup/student" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary transition-colors border-l-2 border-transparent hover:border-atlas-primary">Student Signup</Link>
                       <Link to="/signup/institute" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary transition-colors border-l-2 border-transparent hover:border-atlas-primary">Institute Signup</Link>
                    </Dropdown>
                </div>
                
                {/* Mobile/Tablet Nav Toggle */}
                <div className="lg:hidden flex items-center">
                    <button 
                        onClick={() => setIsOpen(!isOpen)} 
                        className="text-gray-300 focus:outline-none hover:text-atlas-primary p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                        aria-label="Toggle Menu"
                    >
                        {isOpen ? <XIcon className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
                    </button>
                </div>
            </div>

            {/* Mobile/Tablet Nav Menu - Slide Down/Fade */}
            {/* Positioned absolute top-full to push content or overlay correctly without calculating heights manually */}
            <div 
                className={`lg:hidden absolute top-full left-0 right-0 bg-atlas-dark/95 backdrop-blur-xl border-t border-white/10 shadow-2xl overflow-y-auto transition-all duration-500 ease-in-out origin-top ${
                    isOpen ? 'max-h-screen opacity-100 visible' : 'max-h-0 opacity-0 invisible'
                }`}
            >
                <nav className="px-6 py-8 pb-32 space-y-2 flex flex-col max-w-xl mx-auto h-[calc(100vh-80px)] overflow-y-auto">
                    {/* Navigation Links */}
                    {NAV_LINKS.map((link) => {
                        const isActive = activeSection === link.href;
                        return (
                            <button
                                key={link.name}
                                onClick={() => handleNavClick(link.href)}
                                className={`block w-full text-left px-4 py-3 text-lg font-semibold rounded-xl transition-all duration-300 ${
                                    isActive 
                                    ? 'text-atlas-primary bg-atlas-primary/10 border border-atlas-primary/20 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                {link.name}
                            </button>
                        );
                    })}

                    <div className="pt-6 mt-6 border-t border-white/10">
                         <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-4">Account Access</p>
                         
                         {/* Mobile Auth Accordions */}
                         <MobileAccordion title="Login">
                            <Link to="/login/student" onClick={() => setIsOpen(false)} className="block py-2 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm">Student Login</Link>
                            <Link to="/login/institute" onClick={() => setIsOpen(false)} className="block py-2 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm">Institute Login</Link>
                            <Link to="/login/admin" onClick={() => setIsOpen(false)} className="block py-2 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm">Admin Login</Link>
                         </MobileAccordion>

                         <MobileAccordion title="Sign Up">
                            <Link to="/signup/student" onClick={() => setIsOpen(false)} className="block py-2 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm">Student Signup</Link>
                            <Link to="/signup/institute" onClick={() => setIsOpen(false)} className="block py-2 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm">Institute Signup</Link>
                         </MobileAccordion>

                         <div className="mt-6 px-2">
                            <Link 
                                to="/signup/student" 
                                onClick={() => setIsOpen(false)} 
                                className="block w-full text-center py-3.5 bg-atlas-primary text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 hover:bg-emerald-600 transition-all active:scale-95"
                            >
                                Get Started
                            </Link>
                         </div>
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
