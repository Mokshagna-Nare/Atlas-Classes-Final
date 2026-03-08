import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { InformationCircleIcon, TrashIcon } from '../../../../components/icons';

// Simple Copy Icon SVG Component
const CopyLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const ManageTests: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setTests(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    
    await supabase.from('tests').delete().eq('id', id);
    fetchTests(); // Refresh table
  };

    // --- Copy Link Function ---
  const copyTestLink = (testId: string) => {
    // FIXED: Added /# to the generated URL to support HashRouter
    const link = `${window.location.origin}/#/test/${testId}`;
    
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedId(testId);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy link.");
      });
  };


  const getTestStatus = (startWindow: string, endWindow: string) => {
    const now = new Date();
    const start = new Date(startWindow);
    const end = new Date(endWindow);

    if (now < start) return { label: 'Upcoming', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    if (now >= start && now <= end) return { label: 'Live / Active', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
    return { label: 'Expired', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-3xl font-extrabold mb-1">Manage Online Tests</h2>
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <InformationCircleIcon className="h-4 w-4" /> 
          View all tests, copy public links to share with students, and manage statuses.
        </p>
      </div>

      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-gray-800/50 border-b border-gray-800">
            <tr>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Test Title</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time Window</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Questions</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-gray-500">Loading tests...</td></tr>
            ) : tests.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-gray-500">No tests created yet.</td></tr>
            ) : (
              tests.map(test => {
                const status = getTestStatus(test.start_window, test.end_window);
                const isCopied = copiedId === test.id;

                return (
                  <tr key={test.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-5">
                      <p className="text-sm font-bold text-gray-200">{test.title}</p>
                      <p className="text-xs text-gray-500 mt-1">ID: {test.id.substring(0, 8)}...</p>
                    </td>
                    <td className="p-5">
                      <p className="text-xs text-gray-300">Starts: {new Date(test.start_window).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Ends: {new Date(test.end_window).toLocaleString()}</p>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-sm font-mono text-gray-300 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                        {test.question_ids ? test.question_ids.length : 0} Qs
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-end gap-2">
                        {/* Copy Link Button */}
                        <button 
                          onClick={() => copyTestLink(test.id)} 
                          className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                            isCopied 
                              ? 'text-green-400 bg-green-500/10' 
                              : 'text-blue-400 hover:text-white hover:bg-blue-500/20'
                          }`}
                          title="Copy Public Link"
                        >
                          <CopyLinkIcon className="h-5 w-5" />
                          {isCopied && <span className="text-[10px] font-bold uppercase pr-1">Copied</span>}
                        </button>
                        
                        {/* Delete Button */}
                        <button 
                          onClick={() => handleDelete(test.id)} 
                          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" 
                          title="Delete Test"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageTests;
