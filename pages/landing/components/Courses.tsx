
import React from 'react';
import { COURSES_DATA } from '../../../constants';
import { Course } from '../../../types';
import { AxisIllustration, CompassIllustration, NexusIllustration } from '../../../components/icons';

const courseIcons: { [key: string]: React.ReactNode } = {
    'COMPASS – Foundation for IIT-JEE': <CompassIllustration className="h-24 w-24 text-atlas-primary mb-6" />,
    'AXIS – Foundation for NEET': <AxisIllustration className="h-24 w-24 text-atlas-primary mb-6" />,
    'NEXUS – Comprehensive Foundation': <NexusIllustration className="h-24 w-24 text-atlas-primary mb-6" />
};

const CourseCard: React.FC<{ course: Course }> = ({ course }) => (
    <div className="group relative bg-atlas-soft p-10 rounded-2xl shadow-xl border border-gray-800 transform transition-all duration-500 hover:-translate-y-3 flex flex-col overflow-hidden hover:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] hover:border-atlas-primary/50">
        {/* Hover Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-atlas-soft via-atlas-soft to-atlas-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="relative z-10 flex flex-col flex-grow items-center text-center">
            <div className="p-6 bg-atlas-dark rounded-full mb-8 border border-gray-700 group-hover:border-atlas-primary/30 transition-colors duration-300 shadow-inner">
                {courseIcons[course.title]}
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-atlas-primary transition-colors duration-300">{course.title}</h3>
            <p className="text-gray-400 mb-8 flex-grow leading-relaxed text-lg">{course.description}</p>
            <button className="mt-auto w-full bg-transparent border border-gray-600 text-gray-300 font-bold py-3 px-6 rounded-lg hover:bg-atlas-primary hover:text-white hover:border-atlas-primary transition-all duration-300 uppercase tracking-wide text-sm ripple">
                View Details
            </button>
        </div>
    </div>
);

const Courses: React.FC = () => {
  return (
    <section className="py-24 bg-atlas-dark relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
             <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-white">Our Core Programs</h2>
             <div className="w-24 h-1.5 bg-atlas-primary mx-auto rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
             <p className="mt-6 text-gray-400 max-w-2xl mx-auto text-lg">Designed to build a robust academic foundation for future success.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {COURSES_DATA.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Courses;
