import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { Institute } from '../../../../types';
import EditInstituteModal from './EditInstituteModal';
import SharePaperModal from './SharePaperModal';
import api from '../../../../services/api'; // Import our API service
import { 
    ChartPieIcon, GlobeAltIcon, SparklesIcon, UserGroupIcon, 
    DocumentDuplicateIcon, PencilSquareIcon, TrashIcon, EyeIcon, EyeSlashIcon 
} from '../../../../components/icons';

// --- NEW COMPONENT: ADD INSTITUTE MODAL ---
const AddInstituteModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Call our new Express backend route using the Master Key
      await api.post('/auth/create-institute', {
        name,
        email,
        password
      });
      
      // If successful, trigger a refresh and close modal
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create institute:", err);
      setError(err.response?.data?.message || err.message || 'Failed to create institute.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-atlas-dark border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-4">Add Partner School</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2">Institute Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white"
              placeholder="e.g., Greenwood High"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2">Login Email / Username</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white"
              placeholder="e.g., greenwood@atlas.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2">Secure Password</label>
            <input
              type="text" // Changed to text so Admin can clearly see the password they generate
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white"
              placeholder="Generate a password"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-atlas-primary hover:bg-emerald-600 transition-colors shadow-lg disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// ------------------------------------------

const GlobalAnalytics = () => {
    const { institutes, results, tests } = useData();
    const totalStudents = 500; // Mock aggregate
    const totalTests = tests.length;
    const avgGlobalScore = (results.reduce((acc, r) => acc + r.score, 0) / (results.length || 1)).toFixed(1);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800">
                    <div className="flex items-center gap-4 mb-3">
                        <GlobeAltIcon className="h-5 w-5 text-atlas-primary" />
                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Schools</h4>
                    </div>
                    <p className="text-3xl font-black text-white">{institutes.length}</p>
                </div>
                <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800">
                    <div className="flex items-center gap-4 mb-3">
                        <UserGroupIcon className="h-5 w-5 text-atlas-primary" />
                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Total Students</h4>
                    </div>
                    <p className="text-3xl font-black text-white">{totalStudents}</p>
                </div>
                <div className="bg-atlas-dark p-6 rounded-3xl border border-gray-800">
                    <div className="flex items-center gap-4 mb-3">
                        <ChartPieIcon className="h-5 w-5 text-atlas-primary" />
                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Total Tests</h4>
                    </div>
                    <p className="text-3xl font-black text-white">{totalTests}</p>
                </div>
                <div className="bg-atlas-dark p-6 rounded-3xl border border-atlas-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                    <div className="flex items-center gap-4 mb-3">
                        <SparklesIcon className="h-5 w-5 text-atlas-primary" />
                        <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Global Avg</h4>
                    </div>
                    <p className="text-3xl font-black text-atlas-primary">{avgGlobalScore}%</p>
                </div>
            </div>

            <div className="bg-atlas-dark border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="p-6 border-b border-gray-800 bg-atlas-black/50">
                    <h3 className="text-lg font-bold text-white">Institute Performance Ranking</h3>
                 </div>
                 <table className="w-full text-left">
                    <thead className="bg-atlas-black/30 border-b border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <tr>
                            <th className="p-6">Institute Name</th>
                            <th className="p-6">Tests Held</th>
                            <th className="p-6">Avg Performance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {institutes.map(inst => (
                            <tr key={inst.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-6 font-bold text-white">{inst.name}</td>
                                <td className="p-6 text-gray-400">{tests.filter(t => t.institute_id === inst.id).length}</td>
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden max-w-[100px]">
                                            <div className="h-full bg-atlas-primary rounded-full" style={{ width: '75%' }}></div>
                                        </div>
                                        <span className="text-sm font-black text-white">75.0%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        </div>
    );
};

const ManageInstitutes: React.FC = () => {
  const { institutes, deleteInstitute, refreshInstitutes } = useData(); // Assumes refreshData exists in DataContext
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [editingInstitute, setEditingInstitute] = useState<Institute | null>(null);
  const [sharingInstitute, setSharingInstitute] = useState<Institute | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const togglePasswordVisibility = (id: string) => {
    const newSet = new Set(visiblePasswords);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisiblePasswords(newSet);
  };

  const handleEdit = (institute: Institute) => setEditingInstitute(institute);
  const handleShare = (institute: Institute) => setSharingInstitute(institute);
  const handleCloseModal = () => {
    setEditingInstitute(null);
    setSharingInstitute(null);
  };
  const handleDelete = (instituteId: string) => {
    if (window.confirm('Are you sure you want to delete this institute? This action cannot be undone.')) {
        deleteInstitute(instituteId);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h2 className="text-3xl font-extrabold text-white">Network Management</h2>
            <p className="text-atlas-text-muted text-sm font-semibold uppercase tracking-widest mt-1">Control your partner ecosystem</p>
        </div>
        <div className="flex gap-2 bg-atlas-dark p-1.5 rounded-2xl border border-gray-800">
            <button onClick={() => setActiveTab('list')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-atlas-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Directory</button>
            <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-atlas-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Global Analytics</button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
          <GlobalAnalytics />
      ) : (
          <>
            <div className="flex justify-end">
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-atlas-primary text-white font-black py-4 px-10 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-widest"
                >
                    Add Partner School
                </button>
            </div>
            <div className="bg-atlas-dark border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                <thead className="bg-atlas-black/50 border-b border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <tr>
                    <th className="p-6">ID</th>
                    <th className="p-6">Institute Details</th>
                    <th className="p-6">Credentials</th>
                    <th className="p-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {institutes.map(institute => (
                    <tr key={institute.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="p-6 text-atlas-primary font-mono text-xs font-black">
                           {institute.id.substring(0, 8)}... {/* Shorten UUID for cleaner display */}
                        </td>
                        <td className="p-6">
                            <p className="font-bold text-white text-base">{institute.name}</p>
                            <p className="text-gray-500 text-xs mt-1">{institute.email}</p>
                        </td>
                        <td className="p-6">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Access Pass</p>
                            <div className="flex items-center gap-3">
                                <p className="text-sm font-mono text-gray-400">
                                    {/* We don't store plain text passwords anymore, so we just show a hidden placeholder */}
                                    {visiblePasswords.has(institute.id) ? 'Encrypted via Supabase' : '••••••••'}
                                </p>
                                <button 
                                    onClick={() => togglePasswordVisibility(institute.id)}
                                    className="text-gray-600 hover:text-atlas-primary transition-colors"
                                    title={visiblePasswords.has(institute.id) ? "Hide Password" : "Show Password"}
                                >
                                    {visiblePasswords.has(institute.id) ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                </button>
                            </div>
                        </td>
                        <td className="p-6 text-right">
                        <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleShare(institute)} 
                                className="p-2.5 bg-atlas-soft border border-gray-700 rounded-xl text-atlas-primary hover:text-white hover:bg-atlas-primary transition-all"
                                title="Share Documents"
                            >
                                <DocumentDuplicateIcon className="h-5 w-5" />
                            </button>
                            <button 
                                onClick={() => handleEdit(institute)} 
                                className="p-2.5 bg-atlas-soft border border-gray-700 rounded-xl text-blue-400 hover:text-white hover:bg-blue-500 transition-all"
                                title="Edit Institute"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button 
                                onClick={() => handleDelete(institute.id)} 
                                className="p-2.5 bg-atlas-soft border border-gray-700 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all"
                                title="Delete Institute"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
                {institutes.length === 0 && (
                    <div className="p-20 text-center text-gray-600 font-black uppercase tracking-widest text-sm italic">
                        No partners registered in network.
                    </div>
                )}
            </div>
          </>
      )}
      {editingInstitute && <EditInstituteModal institute={editingInstitute} onClose={handleCloseModal} />}
      {sharingInstitute && <SharePaperModal institute={sharingInstitute} onClose={handleCloseModal} />}
      
      {/* Render the new Add Institute Modal when state is true */}
      {isAddModalOpen && (
  <AddInstituteModal 
      onClose={() => setIsAddModalOpen(false)} 
      onSuccess={async () => {
          await refreshInstitutes(); // <--- Make sure this matches!
      }} 
  />
)}
    </div>
  );
};

export default ManageInstitutes;
