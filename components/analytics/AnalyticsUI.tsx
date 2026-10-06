import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { ChevronUpIcon } from '../icons';

// Visual building blocks shared by the student and institute analytics pages.

export interface StatBucket { label: string; correct: number; total: number; percent: number }
export const tooltipStyle = {
  backgroundColor: '#0B0F19',
  borderRadius: '14px',
  padding: '12px 14px',
  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)',
  border: '1px solid rgba(255,255,255,0.08)',
};

export const perfColor = (p: number) => (p >= 75 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444');
export const perfText = (p: number) => (p >= 75 ? 'text-emerald-400' : p >= 50 ? 'text-amber-400' : 'text-red-400');
export const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const percentileOf = (rank: number, total: number) => (total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0);
export const topPercentOf = (rank: number, total: number) => (total > 0 ? Math.max(1, Math.round((rank / total) * 100)) : 100);

export const Card: React.FC<{ title: string; caption?: string; icon?: React.ReactNode; className?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, caption, icon, className = '', action, children }) => (
  <section className={`bg-atlas-dark rounded-[1.75rem] border border-white/5 p-6 sm:p-8 ${className}`}>
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="p-2.5 rounded-xl bg-atlas-primary/10 text-atlas-primary shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
          {caption && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{caption}</p>}
        </div>
      </div>
      {action}
    </header>
    {children}
  </section>
);

export const StatTile: React.FC<{ label: string; value: string; hint?: string; valueClass?: string; icon: React.ReactNode }> = ({ label, value, hint, valueClass, icon }) => (
  <div className="group bg-atlas-dark p-5 sm:p-6 rounded-3xl border border-white/5 hover:border-atlas-primary/30 hover:-translate-y-0.5 transition-all duration-300 min-w-0">
    <div className="flex items-center gap-2.5 mb-4 min-w-0">
      <span className="p-2 rounded-xl bg-atlas-primary/10 text-atlas-primary shrink-0 group-hover:scale-110 transition-transform">{icon}</span>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 truncate">{label}</p>
    </div>
    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${valueClass || 'text-white'}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-2 truncate" title={hint}>{hint}</p>}
  </div>
);

export const DeltaChip: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  if (value === 0) return <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-black text-gray-400">No change</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-lg border text-xs font-black ${up ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
      <ChevronUpIcon className={`h-3 w-3 ${up ? '' : 'rotate-180'}`} />
      {Math.abs(value)}{suffix}
    </span>
  );
};

export const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="h-full min-h-[10rem] flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-center px-6">
    <p className="text-xs text-gray-500 font-semibold">{text}</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-3xl bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.07)_50%,rgba(255,255,255,0.03)_100%)] bg-[length:800px_100%] animate-shimmer ${className}`} />
);

// Below this many questions a percentage is too noisy to judge — such bars are faded.
export const LOW_SAMPLE = 5;

// Horizontal accuracy bars, colored by performance, labelled with their question count.
export const AccuracyBars: React.FC<{ data: StatBucket[]; emptyText: string; order?: string[] }> = ({ data, emptyText, order }) => {
  const sorted = order ? data.slice().sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : data;
  if (sorted.length === 0) return <EmptyNote text={emptyText} />;
  const rows = sorted.map(r => ({ ...r, display: `${r.label} · ${r.total}q` }));
  const hasLowSample = rows.some(r => r.total < LOW_SAMPLE);
  return (
    <div>
      <div style={{ height: Math.max(160, rows.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#4B5563" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="display" stroke="#9CA3AF" fontSize={11} width={150} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9CA3AF', fontWeight: 700 }}
              labelFormatter={(_l: any, p: any) => p?.[0]?.payload.label || ''}
              formatter={(v: any, _n: any, p: any) => [`${v}% · ${p.payload.correct} of ${p.payload.total} correct${p.payload.total < LOW_SAMPLE ? ' (too few to judge)' : ''}`, 'Accuracy']} />
            <Bar dataKey="percent" radius={[0, 8, 8, 0]} barSize={20} animationDuration={900}>
              {rows.map((r, i) => <Cell key={i} fill={perfColor(r.percent)} fillOpacity={r.total < LOW_SAMPLE ? 0.3 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hasLowSample && <p className="text-[11px] text-gray-600 mt-3">Faded bars are based on fewer than {LOW_SAMPLE} questions — too few to judge yet.</p>}
    </div>
  );
};
