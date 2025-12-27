import React from 'react';
import { STUDENT_RESULTS } from '../../../../constants';
import { TrophyIcon, SignalIcon, CreditCardIcon, InformationCircleIcon } from '../../../../components/icons';

const Profile: React.FC = () => {
    const latestResult = STUDENT_RESULTS.length > 0 ? STUDENT_RESULTS[STUDENT_RESULTS.length - 1] : null;
    const totalScore = STUDENT_RESULTS.reduce((acc, r) => acc + r.score, 0);
    const totalMaxScore = STUDENT_RESULTS.reduce((acc, r) => acc + r.maxScore, 0);
    const averagePercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    const getGradeColor = (percentage: number) => {
        if (percentage >= 90) return 'text-green-400';
        if (percentage >= 80) return 'text-green-500';
        if (percentage >= 70) return 'text-yellow-400';
        if (percentage >= 60) return 'text-orange-500';
        return 'text-red-500';
    };

    const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; subtext?: string; valueClass?: string; }> = ({ icon, label, value, subtext, valueClass }) => (
      <div className="bg-atlas-black p-6 rounded-lg text-center border border-gray-800">
        <div className="flex justify-center items-center h-12 w-12 rounded-full bg-atlas-gray mx-auto mb-4 border border-gray-700">
          {icon}
        </div>
        <h3 className="text-gray-400 mb-1">{label}</h3>
        <p className={`text-4xl font-bold ${valueClass || ''}`}>{value}</p>
        {subtext && <p className="text-gray-500 text-sm">{subtext}</p>}
      </div>
    );

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-atlas-orange">My Performance Snapshot</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  icon={<SignalIcon className="h-6 w-6 text-atlas-orange"/>}
                  label="Overall Performance"
                  value={`${averagePercentage.toFixed(1)}%`}
                  valueClass={getGradeColor(averagePercentage)}
                />
                <StatCard 
                  icon={<TrophyIcon className="h-6 w-6 text-atlas-orange"/>}
                  label="Latest Rank"
                  value={latestResult ? String(latestResult.rank) : '—'}
                  subtext={latestResult ? `in ${latestResult.subject || '—'}` : 'No recent results'}
                />
                <StatCard 
                  icon={<CreditCardIcon className="h-6 w-6 text-atlas-orange"/>}
                  label="Latest Grade"
                  value={latestResult ? latestResult.grade : '—'}
                  subtext={latestResult ? `${latestResult.score}/${latestResult.maxScore} Points` : 'No recent results'}
                  valueClass={latestResult && typeof latestResult.score === 'number' && typeof latestResult.maxScore === 'number' ? getGradeColor((latestResult.score / Math.max(1, latestResult.maxScore)) * 100) : ''}
                />
            </div>
            <div className="mt-8 p-6 bg-blue-900/20 border border-blue-700/50 rounded-lg flex space-x-4">
                <div className="flex-shrink-0">
                    <InformationCircleIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-300 mb-2">Notifications</h3>
                  <ul className="space-y-1 list-disc list-inside text-blue-400">
                    <li>Your fee for October is due. <a href="#/dashboard/student" onClick={(e) => { e.preventDefault(); alert('Redirecting to fees page...'); }} className="font-bold underline hover:text-blue-300">Pay Now</a></li>
                    <li>Upcoming test: Mathematics - Algebra on 2024-10-01.</li>
                  </ul>
                </div>
            </div>
        </div>
    );
};

export default Profile;