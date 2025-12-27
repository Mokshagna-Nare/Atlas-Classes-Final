
import React from 'react';
import { CheckCircleIcon } from '../../../components/icons';

const schoolBenefits = [
    'Enhanced Brand Value',
    'Improved Quality & Standards',
    'Increased Revenue Generation',
    'Competitive Edge in the region',
    'Zero program infrastructure cost',
];

const studentBenefits = [
    'Builds Cognitive and Analytical Skills',
    'Early Preparation for IIT-JEE, NEET',
    'High-Quality, low Fee curriculum locally',
    'Eliminates costly metropolitan relocation',
    'Fuels confidence, ensures success',
];

const Benefits: React.FC = () => {
  return (
    <section className="py-24 bg-atlas-dark relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-atlas-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-white drop-shadow-lg">
                A Partnership That <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400">Benefits Everyone</span>
            </h2>
            <div className="w-24 h-1.5 bg-atlas-primary mx-auto rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            <p className="mt-6 text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                We create a win-win ecosystem where institutions grow and students excel through our integrated learning model.
            </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
            {/* School Benefits Card */}
            <div className="group relative p-1 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 hover:from-atlas-primary/40 hover:to-emerald-600/40 transition-all duration-500 shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:-translate-y-2">
                <div className="absolute inset-0 bg-atlas-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative h-full bg-atlas-soft/90 backdrop-blur-xl p-8 md:p-10 rounded-xl border border-white/5 overflow-hidden">
                     {/* Decorative Icon Background */}
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-atlas-primary/10 rounded-full blur-2xl group-hover:bg-atlas-primary/20 transition-colors duration-500"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center mb-8">
                            <div className="p-3 bg-atlas-primary/10 rounded-lg mr-4 border border-atlas-primary/20 group-hover:border-atlas-primary/50 transition-colors duration-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                 <svg className="w-8 h-8 text-atlas-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white group-hover:text-atlas-primary transition-colors duration-300">For Schools</h3>
                        </div>
                        
                        <ul className="space-y-5">
                            {schoolBenefits.map((benefit, index) => (
                                <li key={index} className="flex items-start group/item">
                                    <CheckCircleIcon className="h-6 w-6 text-atlas-primary/60 mr-3 flex-shrink-0 group-hover/item:text-atlas-primary transition-colors duration-300 shadow-[0_0_10px_rgba(16,185,129,0.1)] rounded-full" />
                                    <span className="text-gray-300 text-lg group-hover/item:text-white transition-colors duration-300">{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Student Benefits Card */}
             <div className="group relative p-1 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 hover:from-atlas-primary/40 hover:to-emerald-600/40 transition-all duration-500 shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:-translate-y-2">
                <div className="absolute inset-0 bg-atlas-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative h-full bg-atlas-soft/90 backdrop-blur-xl p-8 md:p-10 rounded-xl border border-white/5 overflow-hidden">
                     {/* Decorative Icon Background */}
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center mb-8">
                             <div className="p-3 bg-atlas-primary/10 rounded-lg mr-4 border border-atlas-primary/20 group-hover:border-atlas-primary/50 transition-colors duration-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <svg className="w-8 h-8 text-atlas-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                                </svg>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white group-hover:text-atlas-primary transition-colors duration-300">For Students</h3>
                        </div>
                        
                        <ul className="space-y-5">
                            {studentBenefits.map((benefit, index) => (
                                <li key={index} className="flex items-start group/item">
                                    <CheckCircleIcon className="h-6 w-6 text-atlas-primary/60 mr-3 flex-shrink-0 group-hover/item:text-atlas-primary transition-colors duration-300 shadow-[0_0_10px_rgba(16,185,129,0.1)] rounded-full" />
                                    <span className="text-gray-300 text-lg group-hover/item:text-white transition-colors duration-300">{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;