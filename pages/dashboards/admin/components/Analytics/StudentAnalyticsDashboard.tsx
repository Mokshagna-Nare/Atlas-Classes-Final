import React, { useState, useRef } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Target, Brain, Clock, Trophy, AlertTriangle, Users, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// --- MOCK DATA GENERATOR ---
const mockStudents = [
  { id: "s1", name: "Rahul Sharma", grade: "GRADE 11" },
  { id: "s2", name: "Ananya Patel", grade: "GRADE 12" },
  { id: "s3", name: "Karan Singh", grade: "GRADE 11" },
];

const mockAnalytics = {
  s1: {
    overallScore: 82.4,
    questionsAttempted: 1248,
    avgSpeed: "1m 12s",
    completedTests: 14,
    accuracy: { correct: 973, wrong: 187, skipped: 88 },
    trajectoryData: [
      { date: "W1", score: 62, classAvg: 60 },
      { date: "W2", score: 66, classAvg: 63 },
      { date: "W3", score: 71, classAvg: 65 },
      { date: "W4", score: 74, classAvg: 67 },
      { date: "W5", score: 72, classAvg: 68 },
      { date: "W6", score: 79, classAvg: 70 },
      { date: "W7", score: 84, classAvg: 72 },
    ],
    subjectMasteryData: [
      { subject: "Physics", score: 82 },
      { subject: "Chemistry", score: 71 },
      { subject: "Math", score: 90 },
      { subject: "Biology", score: 86 },
      { subject: "English", score: 78 },
    ],
    focusAreas: [
      { topic: "Thermodynamics", subject: "PHYSICS", pct: 45 },
      { topic: "Organic Chem", subject: "CHEMISTRY", pct: 52 },
      { topic: "Integral Calc", subject: "MATH", pct: 60 },
      { topic: "Genetics", subject: "BIOLOGY", pct: 65 },
    ],
    cognitiveData: [
      { skill: "Accuracy", value: 78 },
      { skill: "Speed", value: 84 },
      { skill: "Retention", value: 62 },
      { skill: "Logic", value: 90 },
      { skill: "Focus", value: 75 }
    ]
  },
  s2: {
    overallScore: 91.2,
    questionsAttempted: 850,
    avgSpeed: "0m 58s",
    completedTests: 10,
    accuracy: { correct: 775, wrong: 50, skipped: 25 },
    trajectoryData: [
      { date: "W1", score: 80, classAvg: 60 },
      { date: "W2", score: 85, classAvg: 63 },
      { date: "W3", score: 88, classAvg: 65 },
      { date: "W4", score: 92, classAvg: 67 },
      { date: "W5", score: 90, classAvg: 68 },
      { date: "W6", score: 94, classAvg: 70 },
      { date: "W7", score: 95, classAvg: 72 },
    ],
    subjectMasteryData: [
      { subject: "Physics", score: 95 },
      { subject: "Chemistry", score: 88 },
      { subject: "Math", score: 92 },
    ],
    focusAreas: [
      { topic: "Electromagnetism", subject: "PHYSICS", pct: 68 },
      { topic: "Polymers", subject: "CHEMISTRY", pct: 70 },
    ],
    cognitiveData: [
      { skill: "Accuracy", value: 92 },
      { skill: "Speed", value: 95 },
      { skill: "Retention", value: 88 },
      { skill: "Logic", value: 94 },
      { skill: "Focus", value: 85 }
    ]
  }
};

// --- UI COMPONENTS ---
function StatCard({ title, value, subtitle, icon }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f1523] p-5 shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col justify-between transition-all duration-500 hover:border-emerald-500/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-2 text-emerald-400">{icon}</div>
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
        {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  );
}

function CardShell({ title, subtitle, right, children }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f1523] p-5 shadow-[0_10px_35px_rgba(0,0,0,0.35)] flex flex-col h-full transition-all duration-500 hover:border-slate-700">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// --- MAIN DASHBOARD ---
export default function StudentAnalyticsDashboard() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("s1");
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Get current mock data
  const student = mockStudents.find(s => s.id === selectedStudentId) || mockStudents[0];
  const data = mockAnalytics[selectedStudentId as keyof typeof mockAnalytics] || mockAnalytics.s1;

  // PDF EXPORT
  const handleExport = async () => {
    if (!printRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#0a0f18' });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${student.name.replace(/\s+/g, '_')}_Analytics.pdf`);
    } catch (error) {
      alert("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full text-slate-200">
      
      {/* Top Admin Controls */}
      <div data-html2canvas-ignore="true" className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-[#0f1523] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-2 text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <span className="font-semibold">Prototype Mode:</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="h-10 min-w-[250px] rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
          >
            {mockStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          
          <button onClick={handleExport} disabled={isExporting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Download className="h-4 w-4" /> {isExporting ? "Exporting..." : "Export Report"}
          </button>
        </div>
      </div>

      <div ref={printRef} className="bg-[#0a0f18] p-4 sm:p-6 rounded-xl border border-slate-800/50">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 text-xl font-bold text-emerald-400 shadow-inner">
              {student.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">{student.name}</h1>
                <span className="px-2 py-0.5 rounded border border-emerald-800/50 bg-emerald-900/30 text-[10px] font-bold text-emerald-400">
                  {student.grade}
                </span>
              </div>
              <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                <span>STU-{student.id}</span>
                <span className="text-slate-600">•</span>
                <span>Online Analytics Prototype</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <StatCard title="Overall Accuracy" value={`${data.overallScore.toFixed(1)}%`} icon={<Target className="h-5 w-5" />} />
          <StatCard title="Questions Attempted" value={data.questionsAttempted.toLocaleString()} icon={<Brain className="h-5 w-5" />} />
          <StatCard title="Avg. Speed" value={data.avgSpeed} subtitle="per question" icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Tests Completed" value={data.completedTests.toString()} icon={<Trophy className="h-5 w-5" />} />
        </div>

        {/* Charts Row 1 */}
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
            <CardShell title="Performance Trajectory" subtitle="Score progression over tests">
              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.trajectoryData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                    {/* ENABLING ANIMATIONS HERE */}
                    <Area type="monotone" dataKey="classAvg" stroke="#64748b" strokeWidth={2} fill="url(#avgFill)" isAnimationActive={true} animationDuration={1500} />
                    <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={3} fill="url(#scoreFill)" isAnimationActive={true} animationDuration={1500} animationBegin={300} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardShell>
          </div>

          <div className="xl:col-span-1 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
            <CardShell title="Accuracy Profile">
              <div className="h-48 mt-4">
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    {/* PIE CHART ANIMATION */}
                    <Pie data={[{ value: data.accuracy.correct, color: "#22c55e" }, { value: data.accuracy.wrong, color: "#ef4444" }, { value: data.accuracy.skipped, color: "#334155" }]} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={true} animationDuration={1000} animationBegin={600}>
                      {[{ color: "#22c55e" }, { color: "#ef4444" }, { color: "#334155" }].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800 transition-colors hover:bg-slate-800"><div className="text-sm font-bold text-emerald-400">{data.accuracy.correct}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Correct</div></div>
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800 transition-colors hover:bg-slate-800"><div className="text-sm font-bold text-rose-400">{data.accuracy.wrong}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Wrong</div></div>
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800 transition-colors hover:bg-slate-800"><div className="text-sm font-bold text-slate-300">{data.accuracy.skipped}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Skipped</div></div>
              </div>
            </CardShell>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
          
          <CardShell title="Skills Profile">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={data.cognitiveData} outerRadius="70%">
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  {/* RADAR ANIMATION */}
                  <Radar dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} isAnimationActive={true} animationDuration={1200} animationBegin={800}/>
                  <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardShell>

          <CardShell title="Subject Mastery">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.subjectMasteryData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="subject" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                  {/* BAR ANIMATION */}
                  <Bar dataKey="score" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={30} isAnimationActive={true} animationDuration={1000} animationBegin={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardShell>

          <CardShell title="Focus Areas" subtitle="Topics < 70% accuracy" right={<div className="rounded-xl bg-amber-950/30 border border-amber-900/50 p-2 text-amber-400"><AlertTriangle className="h-4 w-4" /></div>}>
            <div className="space-y-4 mt-4 pr-2">
              {data.focusAreas.map((x: any, i: number) => (
                <div key={x.topic} className="space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${1200 + (i * 150)}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="font-semibold text-sm text-white">{x.topic}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{x.subject}</div>
                    </div>
                    <div className="text-sm font-bold text-white">{x.pct}%</div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    {/* CSS PROGRESS BAR ANIMATION */}
                    <div className="h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${x.pct}%`, background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)", transformOrigin: "left" }} />
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
