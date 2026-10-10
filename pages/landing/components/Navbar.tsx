
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS } from '../../../constants';
import { MenuIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '../../../components/icons';
import { focusRing } from '../ui';

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
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    return (
        <div className="relative group" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`flex items-center transition-all duration-300 ease-premium ${focusRing} ${buttonClassName}`}
            >
                {buttonText}
                <ChevronDownIcon className={`h-3.5 w-3.5 ml-1.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div role="menu" className="absolute right-0 top-full mt-3 w-56 bg-atlas-raised/95 backdrop-blur-2xl rounded-xl shadow-card-raised border border-white/10 py-2 z-20 animate-menu-in origin-top-right overflow-hidden">
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
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className={`w-full flex justify-between items-center min-h-[48px] py-3 px-2 rounded-lg text-gray-300 hover:text-white transition-colors font-medium ${focusRing}`}
            >
                {title}
                {isOpen ? <ChevronUpIcon className="h-4 w-4 text-atlas-primary" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            {/* `invisible` when collapsed keeps the hidden links out of the tab order */}
            <div className={`overflow-hidden transition-all duration-300 ease-premium ${isOpen ? 'max-h-60 opacity-100 mb-4 visible' : 'max-h-0 opacity-0 invisible'}`}>
                <div className="space-y-2 px-2">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface PillRect { x: number; y: number; w: number; h: number }

/**
 * Desktop section links with two gliding pills: an emerald one that slides to the active section,
 * and a soft one that follows the mouse between items. Positions are measured from the buttons and
 * re-measured whenever the nav resizes (window resize, font load, the compact scrolled state).
 */
const DesktopNav: React.FC<{ activeSection: string; onNavigate: (href: string) => void; compact: boolean }> = ({ activeSection, onNavigate, compact }) => {
    const navRef = useRef<HTMLElement>(null);
    const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [active, setActive] = useState<PillRect | null>(null);
    const [hover, setHover] = useState<{ rect: PillRect; visible: boolean } | null>(null);
    const [animate, setAnimate] = useState(false);

    const rectOf = (href: string | null): PillRect | null => {
        const el = href ? itemRefs.current[href] : null;
        return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    };

    useLayoutEffect(() => {
        setActive(rectOf(activeSection));
    }, [activeSection]);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const remeasure = () => setActive(rectOf(activeSection));
        const observer = new ResizeObserver(remeasure);
        observer.observe(nav);
        document.fonts?.ready.then(remeasure).catch(() => {});
        // Place the pill without animating on first paint, then let it glide from then on.
        const raf = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
        return () => {
            observer.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [activeSection]);

    const pillStyle = (r: PillRect): React.CSSProperties => ({
        width: r.w,
        height: r.h,
        transform: `translate3d(${r.x}px, ${r.y}px, 0)`,
    });
    const glide = animate ? 'transition-[transform,width,height,opacity] duration-500 ease-premium' : '';

    return (
        <nav
            ref={navRef}
            aria-label="Sections"
            onMouseLeave={() => setHover(h => (h ? { ...h, visible: false } : h))}
            // Edges are inset shadows, not borders: no default-grey border can flash while styles load.
            // Inside the compact capsule the pill drops its own outline, so there is one clean edge.
            className={`relative hidden lg:flex items-center justify-self-center rounded-full p-1.5 transition-[background-color,box-shadow] duration-500 ease-premium ${
                compact
                    ? 'bg-transparent shadow-none'
                    : 'bg-atlas-soft/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_4px_20px_-5px_rgba(0,0,0,0.3)] backdrop-blur-2xl'
            }`}
        >
            {/* Hover pill: follows the mouse between items */}
            {hover && (
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-0 rounded-full bg-white/[0.06] ${glide} ${hover.visible ? 'opacity-100' : 'opacity-0'}`}
                    style={pillStyle(hover.rect)}
                />
            )}
            {/* Active pill: glides to the section in view */}
            {active && (
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-0 rounded-full bg-gradient-to-b from-emerald-400/20 to-emerald-500/[0.08] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4),0_0_12px_-2px_rgba(16,185,129,0.45)] ${glide}`}
                    style={pillStyle(active)}
                >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.07] to-transparent" />
                </span>
            )}

            {NAV_LINKS.map(link => {
                const isActive = activeSection === link.href;
                return (
                    <button
                        key={link.name}
                        ref={el => { itemRefs.current[link.href] = el; }}
                        type="button"
                        onClick={() => onNavigate(link.href)}
                        onMouseEnter={() => {
                            const rect = rectOf(link.href);
                            if (rect) setHover({ rect, visible: true });
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        className={`relative z-10 min-h-[40px] whitespace-nowrap rounded-full px-4 xl:px-6 py-2.5 text-xs xl:text-sm font-medium transition-colors duration-300 ${focusRing} ${
                            isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {link.name}
                    </button>
                );
            })}
        </nav>
    );
};

const Navbar: React.FC<NavbarProps> = ({ activeSection, scrollToSection }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const handleNavClick = (href: string) => {
        scrollToSection(href);
        setIsOpen(false);
    };

    // Mobile menu: Esc closes it, and the page behind it doesn't scroll while it's open.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKey);
        };
    }, [isOpen]);

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

    // Compact header once the page has scrolled (checked at most once per frame).
    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            setIsScrolled(window.scrollY > 24);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(frame);
        };
    }, []);

    const compact = isScrolled && !isOpen;

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 transition-[padding,background-color,box-shadow] duration-500 ease-premium ${
                isOpen
                    ? 'bg-atlas-dark/95 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl'
                    : compact
                        // Phones: a slim blurred bar. Desktop: the header goes transparent and the bar floats as a capsule.
                        ? 'bg-atlas-dark/80 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl lg:bg-transparent lg:pt-3 lg:shadow-none lg:backdrop-blur-none'
                        : 'bg-transparent'
            }`}
        >
            {/* Three columns on desktop keep the section pill exactly centred whatever the side widths */}
            <div
                // Compact capsule: fully round. Sign Up sits 11px from the top, bottom and right edges,
                // so its curve runs concentric with the capsule's, matching the round pills inside it.
                className={`container relative mx-auto flex items-center justify-between transition-[max-width,padding,background-color,box-shadow,border-radius] duration-500 ease-premium lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6 ${
                    compact
                        ? 'px-4 py-2.5 sm:px-6 lg:max-w-6xl lg:rounded-full lg:bg-atlas-dark/75 lg:py-2 lg:pl-7 lg:pr-[11px] lg:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.06),0_24px_50px_-20px_rgba(0,0,0,0.9)] lg:backdrop-blur-xl lg:backdrop-saturate-150'
                        : 'px-4 py-4 sm:px-6 lg:rounded-full lg:px-8 lg:py-6'
                }`}
            >
                
                {/* Logo */}
                <button type="button" aria-label="Atlas Classes — back to top" className={`z-50 flex flex-shrink-0 items-center justify-self-start rounded-lg transition-transform duration-300 ease-premium hover:scale-105 ${focusRing}`} onClick={() => handleNavClick('home')}>
                    <img 
                        src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                        alt="Atlas Classes" 
                        className={`w-auto object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-[height] duration-500 ease-premium ${compact ? 'h-9 sm:h-10 lg:h-11' : 'h-10 sm:h-12 lg:h-[62px]'}`}
                    />
                </button>

                <DesktopNav activeSection={activeSection} onNavigate={handleNavClick} compact={compact} />

                {/* Desktop Actions - Visible on Large Screens */}
                <div className="hidden lg:flex items-center justify-self-end gap-2 xl:gap-4 flex-shrink-0">
                    <Dropdown
                        buttonText="Login"
                        buttonClassName="min-h-[40px] text-xs xl:text-sm font-semibold text-gray-400 hover:text-white px-3 py-2 hover:bg-white/5 rounded-lg"
                    >
                       <Link to="/login/student" role="menuitem" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary focus-visible:bg-atlas-primary/10 focus-visible:text-atlas-primary focus-visible:outline-none transition-colors border-l-2 border-transparent hover:border-atlas-primary focus-visible:border-atlas-primary">Student Login</Link>
                       <Link to="/login/institute" role="menuitem" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary focus-visible:bg-atlas-primary/10 focus-visible:text-atlas-primary focus-visible:outline-none transition-colors border-l-2 border-transparent hover:border-atlas-primary focus-visible:border-atlas-primary">Institute Login</Link>
                       <Link to="/login/admin" role="menuitem" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary focus-visible:bg-atlas-primary/10 focus-visible:text-atlas-primary focus-visible:outline-none transition-colors border-l-2 border-transparent hover:border-atlas-primary focus-visible:border-atlas-primary">Admin Login</Link>
                    </Dropdown>
                    <Dropdown
                        buttonText="Sign Up"
                        buttonClassName="text-xs xl:text-sm font-bold bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 px-6 py-3 rounded-full shadow-glow hover:shadow-glow-lg hover:brightness-110 border border-emerald-300/40 hover:-translate-y-0.5 active:scale-[0.98] whitespace-nowrap"
                    >
                       <Link to="/signup/student" role="menuitem" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary focus-visible:bg-atlas-primary/10 focus-visible:text-atlas-primary focus-visible:outline-none transition-colors border-l-2 border-transparent hover:border-atlas-primary focus-visible:border-atlas-primary">Student Signup</Link>
                       <Link to="/signup/institute" role="menuitem" className="block w-full text-left px-5 py-3 text-xs text-gray-300 hover:bg-atlas-primary/10 hover:text-atlas-primary focus-visible:bg-atlas-primary/10 focus-visible:text-atlas-primary focus-visible:outline-none transition-colors border-l-2 border-transparent hover:border-atlas-primary focus-visible:border-atlas-primary">Institute Signup</Link>
                    </Dropdown>
                </div>
                
                {/* Mobile/Tablet Nav Toggle */}
                <div className="lg:hidden flex items-center">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`text-gray-300 hover:text-atlas-primary p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 ${focusRing}`}
                        aria-label={isOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isOpen}
                        aria-controls="mobile-menu"
                    >
                        {isOpen ? <XIcon className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
                    </button>
                </div>
            </div>

            {/* Mobile/Tablet Nav Menu - Slide Down/Fade */}
            {/* Positioned absolute top-full to push content or overlay correctly without calculating heights manually */}
            <div
                id="mobile-menu"
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
                                aria-current={isActive ? 'true' : undefined}
                                className={`block w-full text-left px-4 py-3 text-lg font-semibold rounded-xl transition-all duration-300 ${focusRing} ${
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
                            <Link to="/login/student" onClick={() => setIsOpen(false)} className={`block min-h-[44px] py-3 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm ${focusRing}`}>Student Login</Link>
                            <Link to="/login/institute" onClick={() => setIsOpen(false)} className={`block min-h-[44px] py-3 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm ${focusRing}`}>Institute Login</Link>
                            <Link to="/login/admin" onClick={() => setIsOpen(false)} className={`block min-h-[44px] py-3 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm ${focusRing}`}>Admin Login</Link>
                         </MobileAccordion>

                         <MobileAccordion title="Sign Up">
                            <Link to="/signup/student" onClick={() => setIsOpen(false)} className={`block min-h-[44px] py-3 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm ${focusRing}`}>Student Signup</Link>
                            <Link to="/signup/institute" onClick={() => setIsOpen(false)} className={`block min-h-[44px] py-3 px-4 rounded-lg text-gray-400 hover:text-atlas-primary hover:bg-white/5 text-sm ${focusRing}`}>Institute Signup</Link>
                         </MobileAccordion>

                         <div className="mt-6 px-2">
                            <Link 
                                to="/signup/student" 
                                onClick={() => setIsOpen(false)} 
                                className={`block w-full text-center py-3.5 bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 rounded-xl font-bold shadow-glow hover:brightness-110 transition-all active:scale-[0.98] ${focusRing}`}
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
