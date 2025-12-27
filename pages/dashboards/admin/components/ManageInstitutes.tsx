
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import AddInstituteModal from './AddInstituteModal';
import EditInstituteModal from './EditInstituteModal';
import { TrashIcon, PencilSquareIcon, UserGroupIcon } from '../../../../components/icons';

const ManageInstitutes: React.FC = () => {
  const { institutes, deleteInstitute } = useData();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-white">Institutes</h2>
          <p className="text-atlas-text-muted text-sm mt-1">Manage partner institutes and their contact details.</p>
        </div>
        <div>
          <button onClick={() => setIsAddOpen(true)} className="bg-atlas-primary text-black font-bold px-4 py-2 rounded-lg">Add Institute</button>
        </div>
      </div>

      <div className="grid gap-4">
        {institutes.map(inst => (
          <div key={inst.id} className="bg-atlas-gray p-4 rounded-lg flex justify-between items-center">
            <div>
              <div className="font-bold text-white">{inst.name}</div>
              <div className="text-sm text-gray-400">{inst.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(inst)} className="p-2 bg-transparent border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800"><PencilSquareIcon className="h-4 w-4" /></button>
              <button onClick={() => { if (window.confirm('Delete this institute?')) deleteInstitute(inst.id); }} className="p-2 bg-red-600 rounded-md text-white hover:bg-red-700"><TrashIcon className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {isAddOpen && <AddInstituteModal onClose={() => setIsAddOpen(false)} />}
      {editing && <EditInstituteModal institute={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

export default ManageInstitutes;
