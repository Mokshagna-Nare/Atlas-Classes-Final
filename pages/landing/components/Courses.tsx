
import React from 'react';
import { COURSES_DATA } from '../../../constants';
import { Course } from '../../../types';
import { ArrowRightIcon, AxisIllustration, CompassIllustration, NexusIllustration } from '../../../components/icons';
import { Reveal, SectionHeading, SECTION_SPACING } from '../motion';
import { buttonSecondary, cardHover } from '../ui';

const courseIcons: { [key: string]: React.FC<{ className?: string }> } = {
    'COMPASS – Foundation for IIT-JEE': CompassIllustration,
    'AXIS – Foundation for NEET': AxisIllustration,
    'NEXUS – Comprehensive Foundation': NexusIllustration,
};

/**
 * Light theme: each program gets its own soft pastel tint from the hero's palette (mint, sky,
 * lavender) — a tinted wash on the card, a coloured illustration with a matching glow, and a
 * tinted enquiry button that fills with the colour on hover. The dark theme ignores these.
 * Marked important (!) so they override the shared card / button light styles they sit on.
 */
const LIGHT_ACCENTS = [
    {
        card: 'light:!bg-[linear-gradient(180deg,#e7f7ef_0%,#f6fcf9_42%,#ffffff_75%)] light:!border-[#cdeedc] light:hover:!border-[#9fdcbd] light:hover:!shadow-[0_1px_2px_rgba(16,24,40,0.04),0_28px_56px_-24px_rgba(15,122,85,0.30)]',
        icon: 'light:!text-[#0f7a55]',
        well: 'light:!border-[#cdeedc] light:!shadow-[0_14px_30px_-12px_rgba(15,122,85,0.35)] light:group-hover/card:!border-[#9fdcbd] light:group-hover/card:!shadow-[0_0_0_8px_rgba(15,122,85,0.07),0_18px_36px_-12px_rgba(15,122,85,0.40)]',
        title: 'light:group-hover/card:!text-[#0b5e42]',
        btn: 'light:!border-[#bfe6d2] light:!bg-[#effaf4] light:!text-[#0b5e42] light:!shadow-none light:hover:!border-[#0f7a55] light:hover:!bg-[#0f7a55] light:hover:!text-white',
    },
    {
        card: 'light:!bg-[linear-gradient(180deg,#e6f2fc_0%,#f5faff_42%,#ffffff_75%)] light:!border-[#cfe3f6] light:hover:!border-[#a6cdf0] light:hover:!shadow-[0_1px_2px_rgba(16,24,40,0.04),0_28px_56px_-24px_rgba(11,106,168,0.28)]',
        icon: 'light:!text-[#0b6aa8]',
        well: 'light:!border-[#cfe3f6] light:!shadow-[0_14px_30px_-12px_rgba(11,106,168,0.32)] light:group-hover/card:!border-[#a6cdf0] light:group-hover/card:!shadow-[0_0_0_8px_rgba(11,106,168,0.07),0_18px_36px_-12px_rgba(11,106,168,0.38)]',
        title: 'light:group-hover/card:!text-[#0a5a8f]',
        btn: 'light:!border-[#c6def4] light:!bg-[#eff6fd] light:!text-[#0a5a8f] light:!shadow-none light:hover:!border-[#0b6aa8] light:hover:!bg-[#0b6aa8] light:hover:!text-white',
    },
    {
        card: 'light:!bg-[linear-gradient(180deg,#efebfd_0%,#f8f6ff_42%,#ffffff_75%)] light:!border-[#e0d9f8] light:hover:!border-[#c7b9f2] light:hover:!shadow-[0_1px_2px_rgba(16,24,40,0.04),0_28px_56px_-24px_rgba(91,63,196,0.26)]',
        icon: 'light:!text-[#5b3fc4]',
        well: 'light:!border-[#e0d9f8] light:!shadow-[0_14px_30px_-12px_rgba(91,63,196,0.30)] light:group-hover/card:!border-[#c7b9f2] light:group-hover/card:!shadow-[0_0_0_8px_rgba(91,63,196,0.07),0_18px_36px_-12px_rgba(91,63,196,0.36)]',
        title: 'light:group-hover/card:!text-[#4a31a8]',
        btn: 'light:!border-[#ddd4f7] light:!bg-[#f5f2fe] light:!text-[#4a31a8] light:!shadow-none light:hover:!border-[#5b3fc4] light:hover:!bg-[#5b3fc4] light:hover:!text-white',
    },
];

/** "COMPASS – Foundation for IIT-JEE" → "COMPASS" */
const programName = (title: string) => title.split('–')[0].trim();

const CourseCard: React.FC<{ course: Course; index: number; onEnquire: (title: string) => void }> = ({ course, index, onEnquire }) => {
    const accent = LIGHT_ACCENTS[index % LIGHT_ACCENTS.length];
    const Icon = courseIcons[course.title];
    return (
    <article className={`group/card ${cardHover} ${accent.card} h-full p-8 sm:p-10 flex flex-col items-center text-center overflow-hidden`}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-atlas-primary/10 blur-3xl transition-all duration-700 ease-premium group-hover/card:bg-atlas-primary/20 group-hover/card:scale-125 light:inset-x-0 light:top-0 light:left-0 light:bg-transparent light:group-hover/card:bg-transparent light:h-52 light:w-auto light:translate-x-0 light:rounded-none light:blur-0 light:bg-[linear-gradient(180deg,rgba(232,247,240,1),rgba(232,247,240,0))] light:group-hover/card:scale-100 light:group-hover/card:bg-[linear-gradient(180deg,rgba(214,242,229,1),rgba(214,242,229,0))] light:hidden" aria-hidden="true" />
        <div className={`relative p-6 bg-atlas-dark rounded-full mb-8 border border-white/10 shadow-inner transition-[border-color,box-shadow] duration-500 ease-premium group-hover/card:border-emerald-400/40 group-hover/card:shadow-[0_0_0_6px_rgba(16,185,129,0.06),0_0_40px_-6px_rgba(16,185,129,0.55)] light:border-gray-700 light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_10px_24px_-12px_rgba(16,24,40,0.14)] light:group-hover/card:border-brand-line light:group-hover/card:shadow-[0_0_0_6px_rgba(21,128,90,0.06),0_14px_28px_-12px_rgba(16,24,40,0.16)] ${accent.well}`}>
            <span className="block transition-transform duration-700 ease-premium group-hover/card:-translate-y-1 group-hover/card:scale-110 group-hover/card:-rotate-6">
                {Icon && <Icon className={`h-24 w-24 text-atlas-primary light:text-brand-deep mb-6 ${accent.icon}`} />}
            </span>
        </div>
        <h3 className={`relative text-xl sm:text-2xl font-bold text-white mb-4 transition-colors duration-500 group-hover/card:text-emerald-300 ${accent.title}`}>{course.title}</h3>
        <p className="relative text-gray-400 mb-8 flex-grow leading-relaxed text-base sm:text-lg">{course.description}</p>
        <button
            type="button"
            onClick={() => onEnquire(course.title)}
            className={`group/btn ${buttonSecondary} relative mt-auto w-full rounded-xl px-5 py-3 text-sm whitespace-nowrap group-hover/card:border-emerald-400/30 ${accent.btn}`}
        >
            Enquire about {programName(course.title)}
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 ease-premium group-hover/btn:translate-x-1" />
        </button>
    </article>
    );
};

const Courses: React.FC<{ onEnquire: (programTitle: string) => void }> = ({ onEnquire }) => {
  return (
    <section className={`${SECTION_SPACING} bg-canvas relative light:bg-canvas-cool`}>
      <div className="container mx-auto px-6">
        <SectionHeading
          eyebrow="Programs"
          title="Our Core Programs"
          subtitle="Designed to build a robust academic foundation for future success."
        />
        <div data-spotlight-group className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {COURSES_DATA.map((course, i) => (
            <Reveal key={course.id} delay={i * 100} className={`h-full ${i === 2 ? 'md:col-span-2 lg:col-span-1 md:max-w-xl md:mx-auto md:w-full lg:max-w-none' : ''}`}>
              <CourseCard course={course} index={i} onEnquire={onEnquire} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Courses;
