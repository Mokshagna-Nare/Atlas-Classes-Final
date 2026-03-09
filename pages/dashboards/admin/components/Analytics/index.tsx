import React from 'react';
import { ArrowLeft, Download, Target, Brain, Clock, Trophy } from 'lucide-react';
import StatCard from './StatCard';

export default function StudentAnalyticsDashboard() {
  return (
    <div className="min-h-screen bg-[#0a0f18] text-white p-6 rounded-lg font-sans">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center font-bold text-lg">
              RS
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight">Rahul Sharma</h1>
                <span className="px-2 py-0.5 bg-green-900/40 text-green-400 text-xs font-medium rounded border border-green-800/50">
                  GRADE 11
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-400 mt-1 space-x-3">
                <span className="flex items-center">
                  <FileTextIcon className="w-4 h-4 mr-1" /> STU-8492
                </span>
                <span className="text-gray-600">•</span>
                <span className="flex items-center text-yellow-500">
                  <Trophy className="w-4 h-4 mr-1" /> Top 5%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <select className="bg-[#0f1523] border border-gray-700 text-gray-300 text-sm rounded-lg px-4 py-2 focus:ring-green-500 focus:border-green-500 outline-none">
            <option>Last 30 Days</option>
            <option>All Time</option>
          </select>
          <button className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-black font-semibold px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Overall Score" 
          value="82.4%" 
          trend="+4.2%" 
          subtitle="vs last month" 
          icon={<Target className="w-5 h-5" />} 
        />
        <StatCard 
          title="Questions Attempted" 
          value="1,248" 
          trend="+15%" 
          subtitle="in last 30 days" 
          icon={<Brain className="w-5 h-5" />} 
        />
        <StatCard 
          title="Avg. Speed" 
          value="1m 12s" 
          trend="-8s" 
          subtitle="per question" 
          icon={<Clock className="w-5 h-5" />} 
        />
        <StatCard 
          title="Global Percentile" 
          value="94th" 
          trend="+2.1" 
          subtitle="rank among peers" 
          icon={<Trophy className="w-5 h-5" />} 
        />
      </div>

      {/* Placeholders for the charts we will build next */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[#0f1523] border border-gray-800 rounded-xl p-6 h-80 flex items-center justify-center text-gray-500">
          [Performance Trajectory Chart Goes Here]
        </div>
        <div className="col-span-1 bg-[#0f1523] border border-gray-800 rounded-xl p-6 h-80 flex items-center justify-center text-gray-500">
          [Accuracy Profile Chart Goes Here]
        </div>
      </div>
      
    </div>
  );
}

// Simple helper component for the document icon
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
      <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
  );
}
