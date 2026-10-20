
import React from 'react';
import { School, GraduationCap, CircleCheck, type LucideIcon } from 'lucide-react';
import { Reveal, SectionHeading, SECTION_SPACING } from '../motion';
import { cardHover, iconWell } from '../ui';

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


const BenefitCard: React.FC<{ title: string; icon: LucideIcon; items: string[] }> = ({ title, icon: Icon, items }) => (
    <div className={`group/card ${cardHover} h-full p-7 sm:p-8 md:p-10 overflow-hidden`}>
        {/* Decorative glow that blooms on hover */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-atlas-primary/10 blur-2xl transition-all duration-700 ease-premium group-hover/card:scale-150 group-hover/card:bg-atlas-primary/20 light:hidden" aria-hidden="true" />

        <div className="relative">
            <div className="flex items-center mb-8">
                <div className={`mr-4 rounded-xl p-3 transition-all duration-500 ease-premium group-hover/card:border-emerald-400/50 group-hover/card:shadow-glow light:group-hover/card:shadow-none ${iconWell}`}>
                    <Icon strokeWidth={1.6} className="h-8 w-8 transition-transform duration-700 ease-premium group-hover/card:scale-110 group-hover/card:-rotate-6" aria-hidden="true" />
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold text-white transition-colors duration-500 group-hover/card:text-emerald-300 light:group-hover/card:text-brand-deep`}>{title}</h3>
            </div>

            <ul className="space-y-2">
                {items.map(item => (
                    <li key={item} className="group/item -mx-3 flex items-start rounded-xl px-3 py-1.5 transition-colors duration-300 hover:bg-white/[0.03] light:hover:bg-paper/70">
                        <CircleCheck strokeWidth={1.75} aria-hidden="true" className={`mr-3 mt-0.5 h-6 w-6 flex-shrink-0 text-atlas-primary/70 transition-all duration-300 ease-premium group-hover/item:scale-110 group-hover/item:text-emerald-300 light:text-atlas-primary`} />
                        <span className="text-base sm:text-lg text-gray-300 transition-all duration-300 ease-premium group-hover/item:translate-x-1 group-hover/item:text-white">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const Benefits: React.FC = () => {
  return (
    <section className={`${SECTION_SPACING} bg-canvas-cool relative overflow-hidden light:bg-paper`}>
      {/* Ambient Background Glows */}
      <div className="absolute top-[18%] left-1/4 w-96 h-96 bg-atlas-primary/5 light:hidden rounded-full blur-[120px] pointer-events-none" aria-hidden="true"></div>
      <div className="absolute bottom-[18%] right-1/4 w-96 h-96 bg-emerald-600/5 light:hidden rounded-full blur-[120px] pointer-events-none" aria-hidden="true"></div>

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeading
            eyebrow="Benefits"
            title={<>A Partnership That <span className="text-transparent bg-clip-text bg-gradient-to-r from-atlas-primary to-emerald-400 light:from-brand-deep light:via-atlas-primary light:to-brand-vivid">Benefits Everyone</span></>}
            subtitle="We create a win-win ecosystem where institutions grow and students excel through our integrated learning model."
        />

        <div data-spotlight-group className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 max-w-6xl mx-auto">
            <Reveal variant="left" className="h-full">
                <BenefitCard title="For Schools" icon={School} items={schoolBenefits} />
            </Reveal>
            <Reveal variant="right" delay={120} className="h-full">
                <BenefitCard title="For Students" icon={GraduationCap} items={studentBenefits} />
            </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Benefits;