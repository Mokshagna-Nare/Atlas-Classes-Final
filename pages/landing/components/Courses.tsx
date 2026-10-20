
import React from 'react';
import { COURSES_DATA } from '../../../constants';
import { Course } from '../../../types';
import { ArrowRightIcon, AxisIllustration, CompassIllustration, NexusIllustration } from '../../../components/icons';
import { Reveal, SectionHeading, SECTION_SPACING } from '../motion';
import { buttonSecondary, cardHover, lightCardWash } from '../ui';

const courseIcons: { [key: string]: React.FC<{ className?: string }> } = {
    'COMPASS – Foundation for IIT-JEE': CompassIllustration,
    'AXIS – Foundation for NEET': AxisIllustration,
    'NEXUS – Comprehensive Foundation': NexusIllustration,
};

/** "COMPASS – Foundation for IIT-JEE" → "COMPASS" */
const programName = (title: string) => title.split('–')[0].trim();

const CourseCard: React.FC<{ course: Course; onEnquire: (title: string) => void }> = ({ course, onEnquire }) => {
    const Icon = courseIcons[course.title];
    return (
    <article className={`group/card ${cardHover} ${lightCardWash} h-full p-8 sm:p-10 flex flex-col items-center text-center overflow-hidden`}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-atlas-primary/10 blur-3xl transition-all duration-700 ease-premium group-hover/card:bg-atlas-primary/20 group-hover/card:scale-125 light:inset-x-0 light:top-0 light:left-0 light:bg-transparent light:group-hover/card:bg-transparent light:h-52 light:w-auto light:translate-x-0 light:rounded-none light:blur-0 light:bg-[linear-gradient(180deg,rgba(232,247,240,1),rgba(232,247,240,0))] light:group-hover/card:scale-100 light:group-hover/card:bg-[linear-gradient(180deg,rgba(214,242,229,1),rgba(214,242,229,0))] light:hidden" aria-hidden="true" />
        <div className={`relative p-6 bg-atlas-dark rounded-full mb-8 border border-white/10 shadow-inner transition-[border-color,box-shadow] duration-500 ease-premium group-hover/card:border-emerald-400/40 group-hover/card:shadow-[0_0_0_6px_rgba(16,185,129,0.06),0_0_40px_-6px_rgba(16,185,129,0.55)] light:border-brand-line light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_12px_28px_-14px_rgba(15,122,85,0.30)] light:group-hover/card:border-[#a9dcc3] light:group-hover/card:shadow-[0_0_0_8px_rgba(15,122,85,0.06),0_16px_32px_-14px_rgba(15,122,85,0.36)]`}>
            <span className="block transition-transform duration-700 ease-premium group-hover/card:-translate-y-1 group-hover/card:scale-110 group-hover/card:-rotate-6">
                {Icon && <Icon className="h-24 w-24 text-atlas-primary light:text-brand-deep mb-6" />}
            </span>
        </div>
        <h3 className={`relative text-xl sm:text-2xl font-bold text-white mb-4 transition-colors duration-500 group-hover/card:text-emerald-300 light:group-hover/card:text-brand-deep`}>{course.title}</h3>
        <p className="relative text-gray-400 mb-8 flex-grow leading-relaxed text-base sm:text-lg">{course.description}</p>
        <button
            type="button"
            onClick={() => onEnquire(course.title)}
            className={`group/btn ${buttonSecondary} relative mt-auto w-full rounded-xl px-5 py-3 text-sm whitespace-nowrap group-hover/card:border-emerald-400/30 light:hover:!border-brand-line light:hover:!bg-brand-pale light:hover:!text-brand-deep`}
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
              <CourseCard course={course} onEnquire={onEnquire} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Courses;
