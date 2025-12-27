
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { XIcon } from '../../../../components/icons';
import { Institute } from '../../../../types';

interface EditInstituteModalProps {
  institute: Institute;
  onClose: () => void;
}

const EditInstituteModal: React.FC<EditInstituteModalProps> = ({ institute, onClose }) => {
  const [name, setName] = useState(institute.name);
  const [email, setEmail] = useState(institute.email);
  const { updateInstitute } = useData();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInstitute({ ...institute, name, email });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
      <div className="bg-atlas-gray rounded-lg shadow-2xl w-full max-w-lg relative p-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <XIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-atlas-orange">Edit Institute</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Institute Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="w-full bg-atlas-orange text-white font-bold py-3 px-6 rounded-md hover:bg-orange-600 transition">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditInstituteModal;
