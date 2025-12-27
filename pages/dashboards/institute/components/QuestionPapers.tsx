import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import CreateTestModal from './CreateTestModal';

const QuestionPapers: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tests, deleteTest } = useData();

  const papers = tests.filter(test => test.pdfFileName);

  const handleDelete = (testId: string) => {
    if (window.confirm('Are you sure you want to delete this paper and its associated test? This action is permanent.')) {
        deleteTest(testId);
    }
  };

  const handleDownload = (fileName: string) => {
    // Simulate file download
    const mockContent = `This is a mock question paper for the test: ${fileName}.\n\nQ1. What is the capital of France?\n...`;
    const blob = new Blob([mockContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.pdf', '.txt'); // Downloading as txt as we can't generate a PDF on the fly here
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-atlas-orange">Question Papers & Downloads</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-atlas-orange text-white font-bold py-2 px-4 rounded-md hover:bg-orange-600 transition">
          Upload Paper
        </button>
      </div>
      <div className="bg-atlas-black p-4 rounded-lg">
        {papers.length > 0 ? (
          <ul className="space-y-3">
              {papers.map(paper => (
                  <li key={paper.id} className="flex justify-between items-center p-3 bg-atlas-gray rounded-md">
                      <div>
                          <p className="font-bold">{paper.pdfFileName}</p>
                          <p className="text-sm text-gray-400">Associated Test: {paper.title}</p>
                      </div>
                      <div className="flex items-center space-x-4">
                          <button onClick={() => alert(`Simulating view for ${paper.pdfFileName}`)} className="text-blue-400 hover:underline">View</button>
                          <button onClick={() => handleDownload(paper.pdfFileName!)} className="text-green-400 hover:underline">Download</button>
                          <button onClick={() => handleDelete(paper.id)} className="text-red-500 hover:text-red-400">Delete</button>
                      </div>
                  </li>
              ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 py-8">No question papers uploaded. Create a test to add one.</p>
        )}
      </div>
      {isModalOpen && <CreateTestModal testToEdit={null} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default QuestionPapers;