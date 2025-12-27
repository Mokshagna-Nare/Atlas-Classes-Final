
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Test } from '../../../../types';

type TestStatus = 'Upcoming' | 'Completed' | 'Assigned';

const TestCard: React.FC<{ test: Test }> = ({ test }) => {
    const navigate = useNavigate();

    const handleStartTest = () => {
        navigate(`/dashboard/student/test/${test.id}`);
    };

    // This would ideally navigate to a specific result page
    const handleViewResult = () => {
        alert(`Navigating to results for ${test.title}. You can view all your results in the 'My Results' tab.`);
    };

    return (
        <div className="bg-atlas-gray p-4 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="w-full sm:w-auto text-center sm:text-left">
                <p className="font-bold text-lg">{test.title}</p>
                <p className="text-sm text-gray-400">Scheduled for: {test.date}</p>
            </div>
            {test.status === 'Upcoming' && <button onClick={handleStartTest} className="w-full sm:w-auto bg-atlas-orange text-white font-bold py-2 px-4 rounded-md hover:bg-orange-600 transition">Start Test</button>}
            {test.status === 'Completed' && <button onClick={handleViewResult} className="w-full sm:w-auto border border-atlas-orange text-atlas-orange font-bold py-2 px-4 rounded-md hover:bg-atlas-orange hover:text-white transition">View Result</button>}
            {test.status === 'Assigned' && <p className="text-blue-400">Awaiting start date</p>}
        </div>
    );
};

const Tests: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TestStatus>('Upcoming');
    const { tests } = useData();
    const { user } = useAuth()!;

    // Filter tests for the specific institute
    // const instituteTests = tests.filter(test => test.instituteId === user?.instituteId);
    const instituteTests = tests.filter(test => test.institute_id === user?.institute_id);
    const filteredTests = instituteTests.filter(test => test.status === activeTab);

    const TabButton: React.FC<{ status: TestStatus }> = ({ status }) => (
        <button
            onClick={() => setActiveTab(status)}
            className={`px-4 py-2 font-semibold rounded-t-lg transition ${
                activeTab === status ? 'bg-atlas-gray text-atlas-orange' : 'text-gray-400 hover:bg-atlas-black'
            }`}
        >
            {status}
        </button>
    );

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-atlas-orange">My Tests</h2>
            <div className="border-b border-gray-700">
                <TabButton status="Upcoming" />
                <TabButton status="Assigned" />
                <TabButton status="Completed" />
            </div>
            <div className="mt-6 space-y-4">
                {filteredTests.length > 0 ? (
                    filteredTests.map(test => <TestCard key={test.id} test={test} />)
                ) : (
                    <p className="text-gray-500 text-center py-8">No {activeTab.toLowerCase()} tests.</p>
                )}
            </div>
        </div>
    );
};

export default Tests;