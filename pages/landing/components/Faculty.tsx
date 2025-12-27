
import React, { useState } from 'react';
import { FACULTY_DATA } from '../../../constants';
import { FacultyMember } from '../../../types';
import FacultyModal from './FacultyModal';

const FacultyCard: React.FC<{ member: FacultyMember; onClick: () => void; delay: number }> = ({ member, onClick, delay }) => (
    <div 
        className="group relative p-1 rounded-2xl bg-gradient-to-b from-gray-800/50 to-gray-900/50 hover:from-atlas-primary/30 hover:to-emerald-900/30 transition-all duration-500 shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:-translate-y-3 cursor-pointer reveal-on-scroll"
        style={{ transitionDelay: `${delay}ms` }}
        onClick={onClick}
    >
        <div className="absolute inset-0 bg-atlas-soft/90 backdrop-blur-xl rounded-2xl h-full w-full"></div>
        
        <div className="relative z-10 p-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
                 {/* Glowing Ring */}
                 <div className="absolute -inset-1 bg-gradient-to-br from-atlas-primary to-emerald-600 rounded-full opacity-70 blur group-hover:opacity-100 group-hover:blur-md transition-all duration-500"></div>
                 <img 
                    src={member.photoUrl} 
                    alt={member.name} 
                    className="relative w-28 h-28 rounded-full object-cover border-2 border-atlas-primary/30 group-hover:border-atlas-primary transition-colors duration-300 shadow-2xl" 
                />
            </div>
            
            <h3 className="text-xl font-bold text-white group-hover:text-atlas-primary transition-colors duration-300 mb-2">{member.name}</h3>
            <p className="text-gray-400 font-medium text-sm uppercase tracking-wider group-hover:text-white transition-colors duration-300">{member.subject}</p>
            
            {/* Decorative small line */}
            <div className="w-12 h-0.5 bg-gray-700 mt-4 group-hover:bg-atlas-primary group-hover:w-20 transition-all duration-500"></div>
        </div>
    </div>
);

const Faculty: React.FC = () => {
    const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);

    const handleCardClick = (member: FacultyMember) => {
        setSelectedFaculty(member);
    };

    const handleCloseModal = () => {
        setSelectedFaculty(null);
    };

    return (
        <>
            <section className="py-24 bg-atlas-dark relative overflow-hidden" id="faculty">
                {/* Ambient Background */}
                <div className="absolute top-1/4 left-0 w-full h-full pointer-events-none">
                     <div className="absolute top-10 left-10 w-64 h-64 bg-atlas-primary/5 rounded-full blur-[100px]"></div>
                     <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-600/5 rounded-full blur-[120px]"></div>
                </div>

                <div className="container mx-auto px-6 text-center relative z-10">
                    <div className="mb-16">
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-white tracking-tight">Meet Our Team</h2>
                        <div className="w-24 h-1.5 bg-atlas-primary mx-auto rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                         <p className="mt-6 text-gray-400 max-w-2xl mx-auto text-lg">
                            Led by experts dedicated to transforming education through innovation and excellence.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {FACULTY_DATA.map((member, index) => (
                            <FacultyCard 
                                key={member.id} 
                                member={member} 
                                onClick={() => handleCardClick(member)} 
                                delay={index * 100}
                            />
                        ))}
                    </div>
                </div>
            </section>
            {selectedFaculty && (
                <FacultyModal member={selectedFaculty} onClose={handleCloseModal} />
            )}
        </>
    );
};

export default Faculty;
