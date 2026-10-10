
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ChevronDownIcon } from '../../components/icons';
import { buttonPrimary, buttonSecondary, cardHover, cardStatic, fieldInput, focusRing } from '../landing/ui';
import { useSpotlight } from '../landing/motion';

const jobOpenings = [
  {
    title: 'Marketing Intern',
    type: 'Internship',
    location: 'Remote',
    details: ['3-Month Duration'],
    applyLink: 'https://docs.google.com/forms/d/e/1FAIpQLSdIPG5Pe3H2sIZP04LRzIcg0m7RnIKISOaYAaJVOYIgHdCd0A/viewform?usp=header',
    description: 'We are looking for an enthusiastic and driven Marketing Intern to join our team. This role is focused on generating leads and building relationships with schools (classes 6-10) to introduce them to the programs Atlas Classes offers.',
    responsibilities: [
      'Actively seek out and generate new leads, primarily targeting schools.',
      'Clearly and effectively explain the educational programs that Atlas Classes offers.',
      'Engage with school administrators and decision-makers.',
      'Maintain a record of outreach and lead status.',
    ],
    requirements: [
      'Strong desire to learn along with professional drive.',
      'Excellent verbal and written communication skills.',
      'Self-motivated with a results-driven approach.',
      'Familiarity with marketing software is a plus.',
    ],
  },
  {
    title: 'Subject Matter Expert - Physics',
    type: 'Full-time',
    location: 'Remote',
    details: ['₹35k - ₹45k per month'],
    applyLink: 'https://docs.google.com/forms/d/e/1FAIpQLSeDbsze_oPYva_-BlH-zggs3UJ71TXwCexJYGHIM8LQZT1_kw/viewform?usp=publish-editor',
    description: 'We are seeking a knowledgeable Physics Subject Matter Expert to enhance our curriculum. You will be responsible for creating high-quality educational content and training our educators to deliver it effectively.',
    responsibilities: [
      'Develop, review, and update academic materials for your subject.',
      'Conduct training sessions for teachers to ensure high-quality instruction.',
      'Create assessment materials, including tests and practice questions.',
      'Stay updated with the latest curriculum standards and competitive exam patterns.'
    ],
    requirements: [
      'Proven expertise in the subject (Masters degree or higher preferred).',
      'Experience in curriculum design or educational content creation.',
      'Strong presentation and training skills.',
      'A personal laptop or computer is compulsory.',
    ],
  },
  {
    title: 'Subject Matter Expert - Chemistry',
    type: 'Full-time',
    location: 'Remote',
    details: ['₹35k - ₹45k per month'],
    applyLink: 'https://forms.gle/UEZGwEE3atpSeWco8',
    description: 'We are seeking a knowledgeable Chemistry Subject Matter Expert to enhance our curriculum. You will be responsible for creating high-quality educational content and training our educators to deliver it effectively.',
    responsibilities: [
      'Develop, review, and update academic materials for your subject.',
      'Conduct training sessions for teachers to ensure high-quality instruction.',
      'Create assessment materials, including tests and practice questions.',
      'Stay updated with the latest curriculum standards and competitive exam patterns.'
    ],
    requirements: [
      'Proven expertise in the subject (Masters degree or higher preferred).',
      'Experience in curriculum design or educational content creation.',
      'Strong presentation and training skills.',
      'A personal laptop or computer is compulsory.',
    ],
  },
  {
    title: 'Subject Matter Expert - Maths',
    type: 'Full-time',
    location: 'Remote',
    details: ['₹35k - ₹45k per month'],
    applyLink: 'https://forms.gle/T4kLe6z8XH7hCkrP7',
    description: 'We are seeking a knowledgeable Maths Subject Matter Expert to enhance our curriculum. You will be responsible for creating high-quality educational content and training our educators to deliver it effectively.',
    responsibilities: [
      'Develop, review, and update academic materials for your subject.',
      'Conduct training sessions for teachers to ensure high-quality instruction.',
      'Create assessment materials, including tests and practice questions.',
      'Stay updated with the latest curriculum standards and competitive exam patterns.'
    ],
    requirements: [
      'Proven expertise in the subject (Masters degree or higher preferred).',
      'Experience in curriculum design or educational content creation.',
      'Strong presentation and training skills.',
      'A personal laptop or computer is compulsory.',
    ],
  },
  {
    title: 'Subject Matter Expert - Botany',
    type: 'Full-time',
    location: 'Remote',
    details: ['₹35k - ₹45k per month'],
    applyLink: 'https://forms.gle/QeSouMTQWSqSCJnz7',
    description: 'We are seeking a knowledgeable Botany Subject Matter Expert to enhance our curriculum. You will be responsible for creating high-quality educational content and training our educators to deliver it effectively.',
    responsibilities: [
      'Develop, review, and update academic materials for your subject.',
      'Conduct training sessions for teachers to ensure high-quality instruction.',
      'Create assessment materials, including tests and practice questions.',
      'Stay updated with the latest curriculum standards and competitive exam patterns.'
    ],
    requirements: [
      'Proven expertise in the subject (Masters degree or higher preferred).',
      'Experience in curriculum design or educational content creation.',
      'Strong presentation and training skills.',
      'A personal laptop or computer is compulsory.',
    ],
  },
  {
    title: 'Subject Matter Expert - Zoology',
    type: 'Full-time',
    location: 'Remote',
    details: ['₹35k - ₹45k per month'],
    applyLink: 'https://forms.gle/6wGvR8iF4rjNNYyJ6',
    description: 'We are seeking a knowledgeable Zoology Subject Matter Expert to enhance our curriculum. You will be responsible for creating high-quality educational content and training our educators to deliver it effectively.',
    responsibilities: [
      'Develop, review, and update academic materials for your subject.',
      'Conduct training sessions for teachers to ensure high-quality instruction.',
      'Create assessment materials, including tests and practice questions.',
      'Stay updated with the latest curriculum standards and competitive exam patterns.'
    ],
    requirements: [
      'Proven expertise in the subject (Masters degree or higher preferred).',
      'Experience in curriculum design or educational content creation.',
      'Strong presentation and training skills.',
      'A personal laptop or computer is compulsory.',
    ],
  },
];


const JobCard: React.FC<{ job: typeof jobOpenings[0]; isOpen: boolean; onToggle: () => void; }> = ({ job, isOpen, onToggle }) => {
    const panelId = `job-${job.title.replace(/\W+/g, '-').toLowerCase()}`;
    return (
        <article className={`group/card ${cardHover} spotlight-flat overflow-hidden`}>
            {/* Toggle and Apply are siblings: a link nested inside a button is invalid and unreliable */}
            <div className="flex items-stretch">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={`group flex flex-1 items-center justify-between gap-4 p-5 sm:p-6 text-left rounded-2xl transition-colors duration-200 hover:bg-white/[0.02] ${focusRing}`}
                >
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-white transition-colors duration-300 group-hover/card:text-emerald-300">{job.title}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400">
                            {[job.type, job.location, ...job.details].map(item => (
                                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5">{item}</span>
                            ))}
                        </div>
                    </div>
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ease-premium group-hover:text-white ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className="hidden sm:flex items-center pr-6">
                    <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className={`${buttonPrimary} px-5 py-2.5 text-sm`}>
                        Apply
                    </a>
                </div>
            </div>
            <div
                id={panelId}
                role="region"
                aria-label={`${job.title} details`}
                className={`grid transition-all duration-500 ease-premium ${isOpen ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible'}`}
            >
                <div className="overflow-hidden">
                    <div className="border-t border-white/[0.07] p-5 sm:p-6">
                        <p className="text-gray-300 leading-relaxed">{job.description}</p>
                        <h4 className="font-bold text-white mt-6 mb-2">Responsibilities</h4>
                        <ul className="space-y-2 text-gray-300">
                            {job.responsibilities.map((item, index) => (
                                <li key={index} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-atlas-primary" />{item}</li>
                            ))}
                        </ul>
                        <h4 className="font-bold text-white mt-6 mb-2">Requirements</h4>
                        <ul className="space-y-2 text-gray-300">
                            {job.requirements.map((item, index) => (
                                <li key={index} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-atlas-primary" />{item}</li>
                            ))}
                        </ul>
                        <a href={job.applyLink} target="_blank" rel="noopener noreferrer" className={`${buttonPrimary} mt-6 w-full rounded-xl py-3 sm:hidden`}>
                            Apply Now
                        </a>
                    </div>
                </div>
            </div>
        </article>
    );
};


const CareersPage: React.FC = () => {
    useSpotlight();
    const [openJobId, setOpenJobId] = useState<string | null>(null);
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [locationFilter, setLocationFilter] = useState('All');

    const departments = ['All', 'Academics', 'Marketing'];
    const locations = ['All', ...Array.from(new Set(jobOpenings.map(job => job.location)))];

    const handleToggle = (jobTitle: string) => {
        setOpenJobId(openJobId === jobTitle ? null : jobTitle);
    };

    const filteredJobs = jobOpenings.filter(job => {
        const departmentMatch = departmentFilter === 'All' ||
            (departmentFilter === 'Academics' && job.title.includes('Subject Matter Expert')) ||
            (departmentFilter === 'Marketing' && job.title.includes('Marketing'));
        
        const locationMatch = locationFilter === 'All' || job.location === locationFilter;

        return departmentMatch && locationMatch;
    });

    const selectCls = `${fieldInput} appearance-none cursor-pointer pr-11`;

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-atlas-dark text-white font-sans">
            <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_55%)]" aria-hidden="true" />

            <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-atlas-dark/85 backdrop-blur-xl">
                <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center gap-4">
                    <Link to="/" className={`flex items-center rounded-lg ${focusRing}`} aria-label="Atlas Classes home">
                        <img 
                            src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                            alt="Atlas Classes" 
                            className="h-11 sm:h-14 w-auto object-contain" 
                        />
                    </Link>
                    <Link to="/" className={`${buttonSecondary} px-4 py-2.5 text-sm`}>
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="relative container mx-auto px-4 sm:px-6 py-14 sm:py-20">
                <div className="text-center mb-12 max-w-2xl mx-auto animate-fade-in-up">
                    <span className="inline-flex items-center gap-2 rounded-full border border-atlas-primary/25 bg-atlas-primary/[0.08] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-atlas-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-atlas-primary" />
                        Careers
                    </span>
                    <h1 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight text-white">Work With Us</h1>
                    <p className="text-base sm:text-lg text-gray-400 mt-4">
                        Be part of a team that's shaping the future of education. We're passionate, innovative, and dedicated to making a difference.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className={`${cardStatic} grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 p-4 sm:p-5 animate-fade-in-up`} style={{ animationDelay: '0.1s' }}>
                        <div>
                            <label htmlFor="department-filter" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Department</label>
                            <div className="relative">
                                <select
                                id="department-filter"
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className={selectCls}
                            >
                                {departments.map(dep => <option key={dep} value={dep} className="bg-atlas-dark">{dep}</option>)}
                            </select>
                                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                             <label htmlFor="location-filter" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Location</label>
                            <div className="relative">
                                <select
                                id="location-filter"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className={selectCls}
                            >
                                {locations.map(loc => <option key={loc} value={loc} className="bg-atlas-dark">{loc}</option>)}
                            </select>
                                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-5" aria-live="polite">
                        Current Openings <span className="text-atlas-primary">({filteredJobs.length})</span>
                    </h2>
                    <div data-spotlight-group className="space-y-4">
                        {filteredJobs.length > 0 ? (
                            filteredJobs.map((job) => (
                                <JobCard
                                    key={job.title}
                                    job={job}
                                    isOpen={openJobId === job.title}
                                    onToggle={() => handleToggle(job.title)}
                                />
                            ))
                        ) : (
                            <div className={`${cardStatic} text-center py-12`}>
                                <p className="text-gray-400">No openings match your current filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="relative border-t border-white/[0.06] py-8 mt-8">
                <div className="container mx-auto px-6 text-center text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} Atlas Classes. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default CareersPage;
