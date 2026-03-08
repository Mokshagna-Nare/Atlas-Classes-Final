import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { InformationCircleIcon, TrashIcon } from '../../../../components/icons';

// Icons
const CopyLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25C7 12 7.5 12.504 7.5 13.125v6.75C7.5 20.496 7 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const ManageTests: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Results Modal States
  const [viewingResults, setViewingResults] = useState<{ id: string, title: string } | null>(null);
  const [testAttempts, setTestAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const fetchTests = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (!error && data) setTests(data);
    setLoading(false);
  };

  useEffect(() => { fetchTests(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this test? All student results will also be deleted.")) return;
    await supabase.from('tests').delete().eq('id', id);
    fetchTests(); 
  };

  const copyTestLink = (testId: string) => {
    const link = `${window.location.origin}/#/test/${testId}`;
    navigator.clipboard.writeText(link).then(() => {
        setCopiedId(testId);
        setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openResults = async (testId: string, title: string) => {
    setViewingResults({ id: testId, title });
    setLoadingAttempts(true);
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('test_id', testId)
      .order('score', { ascending: false }); // Show highest scores first
    
    if (!error && data) setTestAttempts(data);
    setLoadingAttempts(false);
  };

  // --- CSV Export Logic ---
  const downloadCSV = () => {
    if (testAttempts.length === 0) return alert("No data to download.");

    // 1. Define Column Headers
    const headers = ["Student Name", "Email Address", "Score (%)", "Correct Answers", "Wrong Answers", "Completion Date"];
    
    // 2. Map data to rows
    const rows = testAttempts.map(attempt => [
      `"${attempt.guest_name || ''}"`, // Wrap strings in quotes to prevent comma issues
      `"${attempt.guest_email || ''}"`,
      attempt.score,
      attempt.total_correct,
      attempt.total_wrong,
      `"${new Date(attempt.end_time).toLocaleString()}"`
    ]);

    // 3. Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // 4. Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Clean up filename (replace spaces with underscores)
    const safeTitle = viewingResults?.title.replace(/\s+/g, '_') || "test";
    link.download = `${safeTitle}_Results.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTestStatus = (startWindow: string, endWindow: string) => {
    const now = new Date(); const start = new Date(startWindow); const end = new Date(endWindow);
    if (now < start) return { label: 'Upcoming', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    if (now >= start && now <= end) return { label: 'Live / Active', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
    return { label: 'Expired', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  return (
    <div className="space-y-6 text-white relative">
      <div>
        <h2 className="text-3xl font-extrabold mb-1">Manage Online Tests</h2>
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <InformationCircleIcon className="h-4 w-4" /> 
          View all tests, manage statuses, and review student attempt results.
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
                        <button onClick={() => copyTestLink(test.id)} className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${isCopied ? 'text-green-400 bg-green-500/10' : 'text-blue-400 hover:text-white hover:bg-blue-500/20'}`} title="Copy Public Link">
                          <CopyLinkIcon className="h-5 w-5" />
                          {isCopied && <span className="text-[10px] font-bold uppercase pr-1">Copied</span>}
                        </button>
                        
                        {/* View Results Button */}
                        <button onClick={() => openResults(test.id, test.title)} className="p-2 text-purple-400 hover:text-white hover:bg-purple-500/20 rounded-lg transition" title="View Results">
                          <ChartBarIcon className="h-5 w-5" />
                        </button>

                        {/* Delete Button */}
                        <button onClick={() => handleDelete(test.id)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Delete Test">
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

      {/* --- RESULTS OVERLAY MODAL --- */}
      {viewingResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 bg-gray-800/50">
              <div>
                <h3 className="text-2xl font-extrabold text-white">Test Results</h3>
                <p className="text-gray-400 text-sm mt-1">{viewingResults.title}</p>
              </div>
              <div className="flex gap-3">
                {/* NEW DOWNLOAD BUTTON */}
                <button 
                  onClick={downloadCSV} 
                  disabled={testAttempts.length === 0 || loadingAttempts}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition shadow-lg"
                >
                  <DownloadIcon className="h-4 w-4" /> Download CSV
                </button>
                <button onClick={() => setViewingResults(null)} className="p-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition">
                  <CloseIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingAttempts ? (
                <div className="text-center text-gray-500 p-10">Fetching attempt records...</div>
              ) : testAttempts.length === 0 ? (
                <div className="text-center text-gray-500 p-10 bg-gray-800/30 rounded-2xl border border-gray-800 border-dashed">
                  No students have completed this test yet.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-gray-900/95 backdrop-blur z-10 border-b border-gray-800">
                    <tr>
                      <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Student</th>
                      <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email</th>
                      <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Score</th>
                      <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Correct / Wrong</th>
                      <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Completion Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-gray-800/20">
                    {testAttempts.map(attempt => (
                      <tr key={attempt.id} className="hover:bg-gray-800/50 transition">
                        <td className="p-4 text-sm font-bold text-white">{attempt.guest_name}</td>
                        <td className="p-4 text-sm text-gray-400">{attempt.guest_email}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-xl text-xs font-bold ${attempt.score >= 50 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {attempt.score}%
                          </span>
                        </td>
                        <td className="p-4 text-center text-sm font-mono text-gray-300">
                          <span className="text-green-400">{attempt.total_correct}</span> / <span className="text-red-400">{attempt.total_wrong}</span>
                        </td>
                        <td className="p-4 text-right text-xs text-gray-500">
                          {new Date(attempt.end_time).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTests;
