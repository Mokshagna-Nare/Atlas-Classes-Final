
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { XIcon, SparklesIcon } from '../../../../components/icons';

interface AddInstituteModalProps {
  onClose: () => void;
}

const AddInstituteModal: React.FC<AddInstituteModalProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [customId, setCustomId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { addInstitute } = useData();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email && password) {
      addInstitute({ 
        name, 
        id: customId || undefined, 
        email, 
        password 
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
      <div className="bg-atlas-soft border border-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-10 relative z-10">
            <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
            <XIcon className="h-7 w-7" />
            </button>
            
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-atlas-primary/10 rounded-2xl border border-atlas-primary/20">
                    <SparklesIcon className="h-8 w-8 text-atlas-primary" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white">Enroll Partner</h2>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Configure access credentials</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Institute Name</label>
                    <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white outline-none focus:border-atlas-primary transition-all"
                    placeholder="e.g., Global Science Academy"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Institute ID (Optional)</label>
                    <input
                    type="text"
                    value={customId}
                    onChange={e => setCustomId(e.target.value)}
                    className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white outline-none focus:border-atlas-primary transition-all placeholder:italic"
                    placeholder="Leave blank to auto-generate"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Official Email</label>
                    <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white outline-none focus:border-atlas-primary transition-all"
                    placeholder="admin@school.com"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Login Password</label>
                    <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white outline-none focus:border-atlas-primary transition-all"
                    placeholder="••••••••"
                    />
                </div>
            </div>
            
            <div className="pt-6">
                <button type="submit" className="w-full bg-atlas-primary text-white font-black py-5 rounded-2xl shadow-glow hover:bg-emerald-600 transition-all uppercase tracking-widest text-sm active:scale-95">
                Generate Network Access
                </button>
            </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default AddInstituteModal;
