
import React from 'react';
import { BookOpenIcon, ClipboardCheckIcon, DesktopComputerIcon, AcademicCapIcon, SparklesIcon, TrophyIcon } from '../../../components/icons';
import { Reveal, SectionHeading, SECTION_SPACING } from '../motion';
import { cardHover } from '../ui';

const missionItems = [
    {
        icon: <BookOpenIcon className="h-8 w-8 text-atlas-primary"/>,
        title: 'Content & Curriculum',
        description: 'Foundation courses (Grade 6–10) meticulously aligned with IIT-JEE/NEET requirements.'
    },
    {
        icon: <ClipboardCheckIcon className="h-8 w-8 text-atlas-primary"/>,
        title: 'Assessment',
        description: 'Weekly papers, professional evaluation, and detailed performance analysis.'
    },
    {
        icon: <DesktopComputerIcon className="h-8 w-8 text-atlas-primary"/>,
        title: 'Technology & Planning',
        description: 'Dedicated LMS access and structured Microplans for efficient lesson delivery.'
    },
    {
        icon: <AcademicCapIcon className="h-8 w-8 text-atlas-primary"/>,
        title: 'Teacher Empowerment',
        description: 'Continuous Teacher Training and academic resource access.'
    },
];

const philosophy = [
    {
        title: 'Our Mission',
        icon: <SparklesIcon className="h-6 w-6" />,
        quote: 'Providing accessible, affordable, and structured coaching to build a quality foundation of competitive skills in students everywhere.',
        tag: 'Excellence',
    },
    {
        title: 'Our Vision',
        icon: <TrophyIcon className="h-6 w-6" />,
        quote: 'Empowering every learner to rise from basics to brilliance and from classrooms to the world.',
        tag: 'Empowerment',
    },
];

const PhilosophyCard: React.FC<(typeof philosophy)[number]> = ({ title, icon, quote, tag }) => (
    <div className={`group/card ${cardHover} h-full rounded-3xl p-7 sm:p-10 flex flex-col`}>
        <div className="flex items-center mb-6">
            <div className="mr-4 rounded-xl border border-atlas-primary/20 bg-atlas-primary/10 p-3 text-atlas-primary transition-all duration-500 ease-premium group-hover/card:scale-110 group-hover/card:-rotate-6 group-hover/card:border-emerald-400/50 group-hover/card:shadow-glow">
                {icon}
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white transition-colors duration-500 group-hover/card:text-emerald-300">{title}</h3>
        </div>
        <p className="text-base sm:text-lg leading-relaxed text-gray-300 transition-colors duration-500 group-hover/card:text-white">"{quote}"</p>
        <div className="mt-auto flex items-center pt-6">
            <div className="mr-2 h-0.5 w-12 bg-atlas-primary transition-all duration-700 ease-premium group-hover/card:w-20 group-hover/card:shadow-glow-sm" />
            <span className="text-sm font-bold uppercase tracking-widest text-atlas-primary transition-[letter-spacing] duration-700 ease-premium group-hover/card:tracking-[0.2em]">{tag}</span>
        </div>
    </div>
);

const Mission: React.FC = () => {
    return (
        <section className={`${SECTION_SPACING} bg-atlas-dark relative overflow-hidden`}>
            {/* Background Ambiance */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                 <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-atlas-primary/5 rounded-full blur-[120px] animate-pulse-slow"></div>
                 <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
                 <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30"></div>
            </div>
            
            <div className="container mx-auto px-6 relative z-10">
                
                {/* Header */}
                <SectionHeading
                    eyebrow="Our philosophy"
                    title={<>Philosophy & <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-300">Partnership</span></>}
                    subtitle="Why we exist, where we're headed, and how we work hand in hand with every partner school."
                />

                {/* Mission & Vision Grid */}
                <div data-spotlight-group className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 mb-20">
                    {philosophy.map((card, i) => (
                        <Reveal key={card.title} variant={i === 0 ? 'left' : 'right'} delay={i * 120} className="h-full">
                            <PhilosophyCard {...card} />
                        </Reveal>
                    ))}
                </div>

                {/* Atlas Advantage Block */}
                <Reveal variant="scale" className="max-w-5xl mx-auto mb-20">
                <div className="group/adv relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-atlas-primary to-emerald-600 rounded-2xl blur opacity-20 transition-opacity duration-700 ease-premium group-hover/adv:opacity-40" aria-hidden="true"></div>
                    <div className="spotlight spotlight-flat relative bg-atlas-soft/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 sm:p-10 md:p-14 shadow-2xl overflow-hidden">
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
                                 <div className="w-20 h-20 rounded-full border-2 border-atlas-primary/30 flex items-center justify-center animate-pulse-slow transition-transform duration-700 ease-premium group-hover/adv:scale-110 group-hover/adv:rotate-45">
                                      <div className="w-16 h-16 rounded-full border border-atlas-primary/60 flex items-center justify-center">
                                          <div className="w-2 h-2 bg-atlas-primary rounded-full shadow-[0_0_10px_#10B981]"></div>
                                      </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
                </Reveal>

                {/* 4 Core Components Section */}
                <Reveal className="text-center mb-12">
                     <h3 className="text-3xl font-bold mb-4 text-white">An All-Inclusive Partnership</h3>
                     <p className="max-w-3xl mx-auto text-gray-400 text-lg">
                        A seamless, all-inclusive solution allowing your school to focus solely on excellence.
                    </p>
                </Reveal>

                <div data-spotlight-group className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {missionItems.map((item, index) => (
                        <Reveal key={index} delay={index * 100} className="h-full">
                        <div
                            className={`group/card ${cardHover} h-full p-7 sm:p-8 flex flex-col items-center text-center`}
                        >
                                                        
                            <div className="relative z-10 flex-shrink-0 bg-atlas-primary/10 p-5 rounded-full mb-6 border border-atlas-primary/25 shadow-inner transition-all duration-500 ease-premium group-hover/card:-translate-y-1 group-hover/card:rotate-6 group-hover/card:border-emerald-400/50 group-hover/card:bg-atlas-primary/15 group-hover/card:shadow-glow">
                                {item.icon}
                            </div>
                            <h3 className="relative z-10 text-xl font-bold text-white mb-3 transition-colors duration-500 group-hover/card:text-emerald-300">{item.title}</h3>
                            <p className="relative z-10 text-gray-400 text-sm leading-relaxed transition-colors duration-500 group-hover/card:text-gray-300">{item.description}</p>
                        </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Mission;
