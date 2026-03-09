import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  trend?: string; // e.g., "+4.2%" or "-1.5%"
  subtitle?: string; // e.g., "vs last month"
  icon: React.ReactNode;
}

export default function StatCard({ title, value, trend, subtitle, icon }: StatCardProps) {
  // Check if the trend is positive (starts with +) or negative to color it green or red
  const isPositive = trend?.startsWith('+') || false;

  return (
    <div className="bg-[#0f1523] border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</h3>
        <div className="p-2 bg-gray-800/50 rounded-lg text-green-500 border border-gray-700/50">
          {icon}
        </div>
      </div>
      
      <div>
        <div className="text-3xl font-bold text-white mb-3">{value}</div>
        
        {(trend || subtitle) && (
          <div className="flex items-center text-xs">
            {trend && (
              <span className={`px-2 py-0.5 rounded flex items-center mr-2 font-medium ${
                isPositive 
                  ? 'bg-green-900/30 text-green-400' 
                  : 'bg-red-900/30 text-red-400'
              }`}>
                {isPositive ? '↗' : '↘'} {trend}
              </span>
            )}
            <span className="text-gray-500">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}
