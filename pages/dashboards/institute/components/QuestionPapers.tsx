import React from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { DocumentDuplicateIcon, InformationCircleIcon } from '../../../../components/icons';

// Paper files were never persisted (only a file name was kept, and the live `tests` table
// has no column for it), so this lists what exists and says plainly what doesn't yet.
const QuestionPapers: React.FC = () => {
  const { tests } = useData();
  const { user } = useAuth()!;
  const papers = tests.filter(t => t.institute_id === user?.id && t.pdfFileName);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-white">Question Papers</h2>
        <p className="text-sm text-gray-500 mt-1">Paper files attached to your institute's tests.</p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-500/[0.06] border border-sky-500/20">
        <InformationCircleIcon className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-sm text-sky-100/80">
          Uploading and downloading paper files isn't available yet. Papers that Atlas prepares for you will appear under <span className="font-bold text-white">Shared Papers</span>, and online tests assigned to your classes are listed under <span className="font-bold text-white">Tests</span>.
        </p>
      </div>

      {papers.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl">
          <DocumentDuplicateIcon className="h-10 w-10 text-gray-700 mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-300">No paper files yet</p>
          <p className="text-xs text-gray-500 mt-1">When paper uploads are enabled, your files will be listed here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map(p => (
            <div key={p.id} className="bg-atlas-dark border border-white/5 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-atlas-primary/10 text-atlas-primary shrink-0"><DocumentDuplicateIcon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{p.pdfFileName}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">For test: {p.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionPapers;
