
import React from 'react';
import { FacultyMember } from '../../../types';
import { XIcon } from '../../../components/icons';

interface FacultyModalProps {
  member: FacultyMember;
  onClose: () => void;
}

const FacultyModal: React.FC<FacultyModalProps> = ({ member, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up"
      style={{animationDuration: '0.3s'}}
      onClick={onClose}
    >
      <div 
        className="bg-atlas-gray rounded-lg shadow-2xl w-full max-w-2xl relative overflow-hidden transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <XIcon className="h-6 w-6" />
        </button>
        <div className="p-8">
            <div className="flex flex-col sm:flex-row items-center mb-6 text-center sm:text-left">
                <img 
                    src={member.photoUrl} 
                    alt={member.name} 
                    className="w-24 h-24 rounded-full mr-0 sm:mr-6 mb-4 sm:mb-0 border-4 border-atlas-orange flex-shrink-0"
                />
                <div>
                    <h2 className="text-3xl font-bold text-white">{member.name}</h2>
                    <p className="text-atlas-primary font-semibold text-lg">{member.subject}</p>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-bold text-lg text-atlas-primary mb-2">Areas of Expertise</h3>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {member.subjects.map((sub, index) => (
                        <span key={index} className="bg-atlas-black text-gray-300 px-3 py-1 text-sm rounded-full">{sub}</span>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-bold text-lg text-atlas-primary mb-2">Biography</h3>
                <p className="text-gray-300 leading-relaxed text-left">{member.bio}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyModal;
