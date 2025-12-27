
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ChevronDownIcon } from '../../components/icons';

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
    return (
        <div className="bg-atlas-gray rounded-lg shadow-lg border border-gray-800 overflow-hidden transition-all duration-300">
            <button
                onClick={onToggle}
                className="w-full text-left p-6 flex justify-between items-center hover:bg-atlas-black/30 transition-colors duration-200"
                aria-expanded={isOpen}
            >
                <div>
                    <h3 className="text-xl font-bold text-white">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 text-gray-400 mt-1 text-sm">
                        <span>{job.type}</span>
                        <span className="text-gray-600">•</span>
                        <span>{job.location}</span>
                        {job.details.map(detail => <span key={detail}><span className="text-gray-600">•</span> {detail}</span>)}
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="bg-atlas-orange text-white font-bold py-2 px-5 rounded-md hover:bg-orange-600 transition duration-300 whitespace-nowrap hidden sm:block"
                    >
                        Apply
                    </a>
                    <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="border-t border-gray-700 p-6">
                    <p className="text-gray-300 mb-4">
                        {job.description}
                    </p>
                    <h4 className="font-bold text-white mt-4 mb-2">Responsibilities:</h4>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {job.responsibilities.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                    <h4 className="font-bold text-white mt-4 mb-2">Requirements:</h4>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {job.requirements.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                     <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 bg-atlas-orange text-white font-bold py-2 px-6 rounded-md hover:bg-orange-600 transition duration-300 block sm:hidden text-center"
                    >
                        Apply Now
                    </a>
                </div>
            </div>
        </div>
    );
};


const CareersPage: React.FC = () => {
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

    return (
        <div className="min-h-screen bg-atlas-black text-white font-sans">
            <header className="bg-atlas-gray shadow-md sticky top-0 z-20">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <Link to="/" className="flex items-center">
                        <img 
                            src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                            alt="Atlas Classes" 
                            className="h-14 w-auto object-contain" 
                        />
                    </Link>
                    <Link to="/" className="flex items-center text-gray-300 hover:text-atlas-orange transition-colors">
                        <ArrowLeftIcon className="h-4 w-4 mr-2" />
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="container mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white">Work With Us</h1>
                    <p className="text-lg text-gray-400 mt-4 max-w-2xl mx-auto">
                        Be part of a team that's shaping the future of education. We're passionate, innovative, and dedicated to making a difference.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-atlas-gray p-4 rounded-lg border border-gray-800">
                        <div className="flex-1">
                            <label htmlFor="department-filter" className="block text-sm font-medium text-gray-400 mb-1">Department</label>
                            <select
                                id="department-filter"
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
                            >
                                {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                             <label htmlFor="location-filter" className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                            <select
                                id="location-filter"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
                            >
                                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-atlas-orange mb-6">Current Openings ({filteredJobs.length})</h2>
                    <div className="space-y-4">
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
                            <div className="text-center py-12 bg-atlas-gray rounded-lg">
                                <p className="text-gray-400">No openings match your current filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="bg-atlas-gray py-6 mt-16">
                <div className="container mx-auto px-6 text-center text-gray-400">
                    <p>© 2025 Atlas Classes. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default CareersPage;
