
import React, { useState } from 'react';
import { EnvelopeIcon, GlobeAltIcon, MapPinIcon } from '../../../components/icons';

const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for your message! We will get back to you shortly.");
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
  };

  return (
    <section className="py-24 bg-atlas-dark relative overflow-hidden" id="contact">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-atlas-primary/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-72 h-72 bg-emerald-600/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            
            {/* Left Column: Contact Info & Intro */}
            <div className="order-2 lg:order-1">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-white leading-tight">
                    Get in <span className="text-atlas-primary">Touch</span>
                </h2>
                <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                    Have questions about our curriculum, faculty, or partnership model? We're here to answer all your queries and help you get started with Atlas Classes.
                </p>

                <div className="space-y-5">
                    <a href="mailto:contact@atlasclasses.com" className="block group">
                        <div className="flex items-center p-5 bg-atlas-soft border border-gray-800 rounded-2xl hover:border-atlas-primary/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <div className="bg-gray-800 p-3.5 rounded-full mr-5 group-hover:bg-atlas-primary group-hover:text-white text-atlas-primary transition-colors duration-300 shadow-inner">
                                <EnvelopeIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Email Us</p>
                                <p className="text-lg font-bold text-white group-hover:text-atlas-primary transition-colors">contact@atlasclasses.com</p>
                            </div>
                        </div>
                    </a>

                    <a href="https://www.atlasclasses.com" target="_blank" rel="noopener noreferrer" className="block group">
                         <div className="flex items-center p-5 bg-atlas-soft border border-gray-800 rounded-2xl hover:border-atlas-primary/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <div className="bg-gray-800 p-3.5 rounded-full mr-5 group-hover:bg-atlas-primary group-hover:text-white text-atlas-primary transition-colors duration-300 shadow-inner">
                                <GlobeAltIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Visit Website</p>
                                <p className="text-lg font-bold text-white group-hover:text-atlas-primary transition-colors">www.atlasclasses.com</p>
                            </div>
                        </div>
                    </a>

                     <div className="flex items-center p-5 bg-atlas-soft border border-gray-800 rounded-2xl">
                        <div className="bg-gray-800 p-3.5 rounded-full mr-5 text-atlas-primary shadow-inner">
                            <MapPinIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Headquarters</p>
                            <p className="text-lg font-bold text-white">Bellari, Karnataka, India</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="order-1 lg:order-2">
                <div className="bg-atlas-soft p-8 md:p-10 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
                     {/* Glow effect behind form content */}
                     <div className="absolute -inset-1 bg-gradient-to-br from-atlas-primary/20 to-transparent blur-2xl opacity-50 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-white mb-2">Send us a Message</h3>
                        <p className="text-gray-400 mb-8 text-sm">Fill out the form below and we'll get back to you as soon as possible.</p>
                        
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3.5 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary focus:ring-1 focus:ring-atlas-primary transition-colors text-white placeholder-gray-600" placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Phone</label>
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full px-4 py-3.5 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary focus:ring-1 focus:ring-atlas-primary transition-colors text-white placeholder-gray-600" placeholder="+91 98765 43210" />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3.5 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary focus:ring-1 focus:ring-atlas-primary transition-colors text-white placeholder-gray-600" placeholder="john@example.com" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Message</label>
                                <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} required className="w-full px-4 py-3.5 bg-atlas-dark border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary focus:ring-1 focus:ring-atlas-primary transition-colors text-white placeholder-gray-600 resize-none" placeholder="How can we help you?" />
                            </div>

                            <button type="submit" className="w-full py-4 bg-atlas-primary hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-emerald-900/40 uppercase tracking-wider text-sm">
                                Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
