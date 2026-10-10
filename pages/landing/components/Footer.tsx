import React from 'react';
import { Link } from 'react-router-dom';
import { focusRing } from '../ui';

interface FooterProps {
  /** Scrolls within the home page. (A plain href="#contact" would be read as a route by the HashRouter.) */
  scrollToSection: (id: string) => void;
}

const linkCls = `inline-flex min-h-[44px] items-center rounded-md px-1 text-sm text-gray-400 transition-colors duration-200 hover:text-atlas-primary ${focusRing}`;

const Footer: React.FC<FooterProps> = ({ scrollToSection }) => {
  return (
    <footer className="relative bg-atlas-dark py-12 border-t border-white/[0.06]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" aria-hidden="true" />
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="text-center md:text-left">
                <img
                    src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png"
                    alt="Atlas Classes"
                    className="h-12 w-auto object-contain mb-4 mx-auto md:mx-0 opacity-80"
                />
                <p className="text-gray-500 text-sm">Empowering students from basics to brilliance.</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1">
                <button type="button" onClick={() => scrollToSection('home')} className={linkCls}>Home</button>
                <Link to="/careers" className={linkCls}>Careers</Link>
                <button type="button" onClick={() => scrollToSection('contact')} className={linkCls}>Contact</button>
                <Link to="/login/admin" className={`${linkCls} !text-xs !text-gray-500 hover:!text-gray-300`}>Admin</Link>
            </nav>
        </div>
        <div className="border-t border-white/[0.06] mt-8 pt-8 text-center text-gray-600 text-sm">
            <p>© {new Date().getFullYear()} Atlas Classes. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
