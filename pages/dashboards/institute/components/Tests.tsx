import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import CreateTestModal from './CreateTestModal';
import { useAuth } from '../../../../contexts/AuthContext';
import { Test } from '../../../../types';

const Tests: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const { tests, deleteTest } = useData();
  const { user } = useAuth()!;

  // Filter tests for the specific institute
  const instituteTests = tests.filter(test => test.instituteId === user?.id);

  const handleOpenCreateModal = () => {
    setEditingTest(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (test: Test) => {
    setEditingTest(test);
    setIsModalOpen(true);
  };

  const handleDelete = (testId: string) => {
    if (window.confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
        deleteTest(testId);
    }
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-atlas-orange">Manage Tests</h2>
            <button onClick={handleOpenCreateModal} className="bg-atlas-orange text-white font-bold py-2 px-4 rounded-md hover:bg-orange-600 transition">
                Create New Test
            </button>
        </div>
        <div className="bg-atlas-black p-4 rounded-lg">
            {instituteTests.length > 0 ? (
                <ul className="space-y-3">
                    {instituteTests.map(test => (
                        <li key={test.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-atlas-gray rounded-md gap-3">
                            <div className="flex-grow">
                                <p className="font-bold">{test.title}</p>
                                <div className="flex items-center flex-wrap space-x-2 mt-1">
                                    <p className="text-sm text-gray-400">Date: {test.date}</p>
                                    <span className="text-gray-600 hidden sm:inline">•</span>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                        test.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                                        test.status === 'Upcoming' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {test.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
                                <button onClick={() => handleOpenEditModal(test)} className="text-gray-400 hover:text-white text-sm py-1 px-2 rounded hover:bg-atlas-black transition-colors">Edit</button>
                                <button onClick={() => handleDelete(test.id)} className="text-red-500 hover:text-red-400 text-sm py-1 px-2 rounded hover:bg-atlas-black transition-colors">Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                 <p className="text-gray-500 text-center py-8">No tests created yet.</p>
            )}
        </div>
        {isModalOpen && <CreateTestModal testToEdit={editingTest} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default Tests;