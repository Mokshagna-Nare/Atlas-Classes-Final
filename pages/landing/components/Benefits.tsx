
import React from 'react';
import { CheckCircleIcon } from '../../../components/icons';
import { Reveal, SectionHeading, SECTION_SPACING } from '../motion';
import { cardHover } from '../ui';

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

const SCHOOL_ICON = 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z';
const STUDENT_ICON = 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5';

const BenefitCard: React.FC<{ title: string; icon: string; items: string[] }> = ({ title, icon, items }) => (
    <div className={`group/card ${cardHover} h-full p-7 sm:p-8 md:p-10 overflow-hidden`}>
        {/* Decorative glow that blooms on hover */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-atlas-primary/10 blur-2xl transition-all duration-700 ease-premium group-hover/card:scale-150 group-hover/card:bg-atlas-primary/20" aria-hidden="true" />

        <div className="relative">
            <div className="flex items-center mb-8">
                <div className="mr-4 rounded-xl border border-atlas-primary/20 bg-atlas-primary/10 p-3 transition-all duration-500 ease-premium group-hover/card:border-emerald-400/50 group-hover/card:shadow-glow">
                    <svg className="h-8 w-8 text-atlas-primary transition-transform duration-700 ease-premium group-hover/card:scale-110 group-hover/card:-rotate-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white transition-colors duration-500 group-hover/card:text-emerald-300">{title}</h3>
            </div>

            <ul className="space-y-2">
                {items.map(item => (
                    <li key={item} className="group/item -mx-3 flex items-start rounded-xl px-3 py-1.5 transition-colors duration-300 hover:bg-white/[0.03]">
                        <CheckCircleIcon className="mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-atlas-primary/70 transition-all duration-300 ease-premium group-hover/item:scale-110 group-hover/item:text-emerald-300" />
                        <span className="text-base sm:text-lg text-gray-300 transition-all duration-300 ease-premium group-hover/item:translate-x-1 group-hover/item:text-white">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const Benefits: React.FC = () => {
  return (
    <section className={`${SECTION_SPACING} bg-atlas-dark relative overflow-hidden`}>
      {/* Ambient Background Glows */}
      <div className="absolute top-[18%] left-1/4 w-96 h-96 bg-atlas-primary/5 rounded-full blur-[120px] pointer-events-none" aria-hidden="true"></div>
      <div className="absolute bottom-[18%] right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" aria-hidden="true"></div>

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeading
            eyebrow="Benefits"
            title={<>A Partnership That <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400">Benefits Everyone</span></>}
            subtitle="We create a win-win ecosystem where institutions grow and students excel through our integrated learning model."
        />

        <div data-spotlight-group className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 max-w-6xl mx-auto">
            <Reveal variant="left" className="h-full">
                <BenefitCard title="For Schools" icon={SCHOOL_ICON} items={schoolBenefits} />
            </Reveal>
            <Reveal variant="right" delay={120} className="h-full">
                <BenefitCard title="For Students" icon={STUDENT_ICON} items={studentBenefits} />
            </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Benefits;