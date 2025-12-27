
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { TrashIcon } from '../../../../components/icons';

const ManageTests: React.FC = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const { data: testsData, error: testsError } = await supabase
        .from('tests')
        .select('*, institute:institutes(name)');

      if (testsError) {
        console.error('Error fetching tests:', testsError);
      } else {
        setTests(testsData || []);
      }

      const { data: instData, error: instError } = await supabase
        .from('institutes')
        .select('*');

      if (instError) {
        console.error('Error fetching institutes:', instError);
      } else {
        setInstitutes(instData || []);
      }

      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove this test?')) {
      const { error } = await supabase.from('tests').delete().eq('id', id);
      if (error) {
        console.error('Error deleting test:', error);
      } else {
        setTests(tests.filter(t => t.id !== id));
      }
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading Network Tests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-white">Active Global Tests</h2>
      </div>

      <div className="bg-atlas-soft border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-atlas-dark border-b border-gray-800 text-[10px] uppercase font-bold text-gray-500 tracking-widest">
              <th className="p-5">Test Detail</th>
              <th className="p-5">Institute</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {tests.map(test => (
              <tr key={test.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="p-5">
                   <p className="text-sm font-bold text-white">{test.title}</p>
                   <p className="text-[10px] text-gray-500 uppercase tracking-tighter">{test.subject}</p>
                </td>
                <td className="p-5 text-xs text-gray-400">
                    {test.institute?.name || 'Unassigned'}
                </td>
                <td className="p-5">
                   <span className="px-2 py-1 text-[10px] font-black bg-atlas-primary/10 text-atlas-primary rounded">
                      {test.status}
                   </span>
                </td>
                <td className="p-5 text-right">
                   <button onClick={() => handleDelete(test.id)} className="p-2 text-gray-600 hover:text-red-500">
                      <TrashIcon className="h-4 w-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tests.length === 0 && (
           <div className="p-20 text-center text-gray-600 uppercase font-black text-xs">No active tests found.</div>
        )}
      </div>
    </div>
  );
};

export default ManageTests;
