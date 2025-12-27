
import React from 'react';
import { BookOpenIcon, ClipboardCheckIcon, DesktopComputerIcon, AcademicCapIcon, SparklesIcon, TrophyIcon } from '../../../components/icons';

const missionItems = [
    {
        icon: <BookOpenIcon className="h-8 w-8 text-atlas-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"/>,
        title: 'Content & Curriculum',
        description: 'Foundation courses (Grade 6–10) meticulously aligned with IIT-JEE/NEET requirements.',
        delay: '0s'
    },
    {
        icon: <ClipboardCheckIcon className="h-8 w-8 text-atlas-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"/>,
        title: 'Assessment',
        description: 'Weekly papers, professional evaluation, and detailed performance analysis.',
        delay: '0.1s'
    },
    {
        icon: <DesktopComputerIcon className="h-8 w-8 text-atlas-primary transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"/>,
        title: 'Technology & Planning',
        description: 'Dedicated LMS access and structured Microplans for efficient lesson delivery.',
        delay: '0.2s'
    },
    {
        icon: <AcademicCapIcon className="h-8 w-8 text-atlas-primary transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"/>,
        title: 'Teacher Empowerment',
        description: 'Continuous Teacher Training and academic resource access.',
        delay: '0.3s'
    },
];

const Mission: React.FC = () => {
    return (
        <section className="py-32 bg-atlas-dark relative overflow-hidden" id="mission">
            {/* Background Ambiance */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                 <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-atlas-primary/5 rounded-full blur-[120px] animate-pulse-slow"></div>
                 <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
                 <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30"></div>
            </div>
            
            <div className="container mx-auto px-6 relative z-10">
                
                {/* Header */}
                <div className="text-center mb-20">
                     <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight text-white drop-shadow-2xl">
                        Philosophy & <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-300">Partnership</span>
                    </h2>
                    <div className="w-24 h-1.5 bg-atlas-primary mx-auto rounded-full shadow-[0_0_20px_rgba(16,185,129,0.6)]"></div>
                </div>

                {/* Mission & Vision Grid */}
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-24">
                    {/* Mission Card */}
                    <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-gray-800/50 to-gray-900/50 hover:from-atlas-primary/20 hover:to-gray-900/80 transition-all duration-500 shadow-lg hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)] hover:-translate-y-2 border border-white/5 hover:border-atlas-primary/30">
                         <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px] rounded-3xl pointer-events-none"></div>
                         <div className="relative p-10 h-full flex flex-col">
                            <div className="flex items-center mb-6">
                                <div className="p-3 rounded-xl bg-atlas-primary/10 border border-atlas-primary/20 text-atlas-primary mr-4 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform duration-500">
                                     <SparklesIcon className="h-6 w-6" />
                                </div>
                                <h3 className="text-3xl font-bold text-white group-hover:text-atlas-primary transition-colors duration-300">Our Mission</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed group-hover:text-white transition-colors duration-300">
                                "Providing accessible, affordable, and structured coaching to build a quality foundation of competitive skills in students everywhere."
                            </p>
                            <div className="mt-auto pt-6 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-2 group-hover:translate-y-0">
                                <div className="h-0.5 w-12 bg-atlas-primary mr-2"></div>
                                <span className="text-atlas-primary text-sm font-bold tracking-widest uppercase">Excellence</span>
                            </div>
                         </div>
                    </div>

                    {/* Vision Card */}
                    <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-gray-800/50 to-gray-900/50 hover:from-atlas-primary/20 hover:to-gray-900/80 transition-all duration-500 shadow-lg hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)] hover:-translate-y-2 border border-white/5 hover:border-atlas-primary/30">
                         <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px] rounded-3xl pointer-events-none"></div>
                         <div className="relative p-10 h-full flex flex-col">
                            <div className="flex items-center mb-6">
                                <div className="p-3 rounded-xl bg-atlas-primary/10 border border-atlas-primary/20 text-atlas-primary mr-4 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform duration-500">
                                     <TrophyIcon className="h-6 w-6" />
                                </div>
                                <h3 className="text-3xl font-bold text-white group-hover:text-atlas-primary transition-colors duration-300">Our Vision</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed group-hover:text-white transition-colors duration-300">
                                "Empowering every learner to rise from basics to brilliance and from classrooms to the world."
                            </p>
                             <div className="mt-auto pt-6 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-2 group-hover:translate-y-0">
                                <div className="h-0.5 w-12 bg-atlas-primary mr-2"></div>
                                <span className="text-atlas-primary text-sm font-bold tracking-widest uppercase">Empowerment</span>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Atlas Advantage Block */}
                <div className="relative max-w-5xl mx-auto mb-24 group reveal-on-scroll">
                    <div className="absolute -inset-1 bg-gradient-to-r from-atlas-primary to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-atlas-soft/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-10 md:p-14 shadow-2xl overflow-hidden">
                        {/* Glowing Left Border */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-atlas-primary shadow-[0_0_20px_rgba(16,185,129,0.8)]"></div>
                        {/* Inner Light Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-atlas-primary/5 to-transparent pointer-events-none"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                             <div className="flex-1">
                                <h3 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                                    The <span className="text-atlas-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">ATLAS</span> Advantage
                                </h3>
                                <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                                    We bring the structure, quality, and expertise of metropolitan coaching directly to your school, at an incredibly nominal and affordable fee. We believe high quality shouldn't mean high cost.
                                </p>
                            </div>
                             <div className="hidden md:block">
                                 <div className="w-20 h-20 rounded-full border-2 border-atlas-primary/30 flex items-center justify-center animate-pulse-slow">
                                      <div className="w-16 h-16 rounded-full border border-atlas-primary/60 flex items-center justify-center">
                                          <div className="w-2 h-2 bg-atlas-primary rounded-full shadow-[0_0_10px_#10B981]"></div>
                                      </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 4 Core Components Section */}
                <div className="text-center mb-12">
                     <h3 className="text-3xl font-bold mb-4 text-white">An All-Inclusive Partnership</h3>
                     <p className="max-w-3xl mx-auto text-gray-400 text-lg">
                        A seamless, all-inclusive solution allowing your school to focus solely on excellence.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {missionItems.map((item, index) => (
                        <div 
                            key={index} 
                            className="group relative bg-atlas-soft/30 backdrop-blur-md p-8 rounded-2xl border border-white/5 hover:border-atlas-primary/50 transition-all duration-500 hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.15)] hover:-translate-y-2 flex flex-col items-center text-center reveal-on-scroll"
                            style={{transitionDelay: item.delay}}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-atlas-primary/5 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-500"></div>
                            
                            <div className="relative z-10 flex-shrink-0 bg-gray-800/50 p-5 rounded-full mb-6 border border-gray-700 group-hover:border-atlas-primary group-hover:bg-atlas-primary/10 transition-all duration-500 shadow-inner">
                                {item.icon}
                            </div>
                            <h3 className="relative z-10 text-xl font-bold text-white mb-3 group-hover:text-atlas-primary transition-colors duration-300">{item.title}</h3>
                            <p className="relative z-10 text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{item.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Mission;
