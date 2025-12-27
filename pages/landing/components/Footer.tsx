import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-atlas-dark py-12 border-t border-gray-800">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
             <div className="mb-6 md:mb-0 text-center md:text-left">
                <img 
                    src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                    alt="Atlas Classes" 
                    className="h-12 w-auto object-contain mb-4 mx-auto md:mx-0 opacity-80 hover:opacity-100 transition-opacity" 
                />
                <p className="text-gray-500 text-sm">Empowering students from basics to brilliance.</p>
            </div>
            <div className="flex space-x-6 mb-6 md:mb-0">
                <Link to="/" className="text-gray-400 hover:text-atlas-primary transition-colors text-sm">Home</Link>
                <Link to="/careers" className="text-gray-400 hover:text-atlas-primary transition-colors text-sm">Careers</Link>
                <a href="#contact" className="text-gray-400 hover:text-atlas-primary transition-colors text-sm">Contact</a>
                <Link to="/login/admin" className="text-gray-500 hover:text-gray-300 transition-colors text-xs mt-1">Admin</Link>
            </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-600 text-sm">
            <p>© {new Date().getFullYear()} Atlas Classes. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;