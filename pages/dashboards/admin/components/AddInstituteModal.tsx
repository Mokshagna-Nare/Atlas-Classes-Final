import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { XIcon } from '../../../../components/icons';

interface AddInstituteModalProps {
  onClose: () => void;
}

const AddInstituteModal: React.FC<AddInstituteModalProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { addInstitute } = useData();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email && password) {
      addInstitute({ name, email, password });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
      <div className="bg-atlas-gray rounded-lg shadow-2xl w-full max-w-lg relative p-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <XIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-atlas-orange">Add New Institute</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Institute Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="e.g., Quantum Leap Academy"
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
              placeholder="e.g., contact@quantum.edu"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Login Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="Enter a secure password"
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="w-full bg-atlas-orange text-white font-bold py-3 px-6 rounded-md hover:bg-orange-600 transition">
              Add Institute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInstituteModal;