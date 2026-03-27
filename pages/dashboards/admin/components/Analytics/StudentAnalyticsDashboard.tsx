import React, { useState, useRef } from "react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip
} from "recharts";
import { Target, Clock, Trophy, AlertTriangle, Users, Download, Filter, FileText } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// --- GLOBAL STYLES FOR RECHARTS FIX ---
// This disables the default blue focus ring that browsers put on Recharts SVG elements
const RechartsFixStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    .recharts-wrapper * { outline: none !important; }
    .recharts-surface:focus { outline: none !important; }
    path:focus, g:focus, rect:focus { outline: none !important; }
  `}} />
);

// --- MOCK DATA FOR SPECIFIC ONLINE TESTS ---
const mockStudents = [
  { id: "s1", name: "Rahul Sharma", grade: "GRADE 11" },
  { id: "s2", name: "Ananya Patel", grade: "GRADE 12" },
];

const mockOnlineTests = {
  s1: [
    {
      testId: "t1",
      testName: "AITS Full Syllabus Mock - 1",
      date: "12 Oct 2023",
      score: "82.4%",
      avgSpeed: "1m 12s",
      rank: "14th",
      accuracy: { correct: 65, wrong: 15, skipped: 10 },
      cognitiveData: [
        { skill: "Accuracy", value: 78 }, { skill: "Speed", value: 84 },
        { skill: "Retention", value: 62 }, { skill: "Logic", value: 90 }, { skill: "Focus", value: 75 }
      ],
      subjectMasteryData: [
        { subject: "Physics", score: 82 }, { subject: "Chemistry", score: 71 },
        { subject: "Math", score: 90 }
      ],
      topics: [
        { subject: "Physics", topic: "Thermodynamics", pct: 45 },
        { subject: "Physics", topic: "Kinematics", pct: 58 },
        { subject: "Physics", topic: "Optics", pct: 88 },
        { subject: "Chemistry", topic: "Organic Chem", pct: 52 },
        { subject: "Chemistry", topic: "Polymers", pct: 60 },
        { subject: "Math", topic: "Integral Calc", pct: 60 },
        { subject: "Math", topic: "Probability", pct: 75 },
      ]
    },
    {
      testId: "t2",
      testName: "Weekly Part Test - Mechanics",
      date: "05 Oct 2023",
      score: "76.0%",
      avgSpeed: "1m 30s",
      rank: "22nd",
      accuracy: { correct: 38, wrong: 12, skipped: 0 },
      cognitiveData: [
        { skill: "Accuracy", value: 76 }, { skill: "Speed", value: 65 },
        { skill: "Retention", value: 80 }, { skill: "Logic", value: 70 }, { skill: "Focus", value: 85 }
      ],
      subjectMasteryData: [
        { subject: "Physics", score: 76 }
      ],
      topics: [
        { subject: "Physics", topic: "Newton's Laws", pct: 70 },
        { subject: "Physics", topic: "Friction", pct: 40 },
        { subject: "Physics", topic: "Work & Energy", pct: 55 },
      ]
    }
  ]
};

// --- UI COMPONENTS ---
function StatCard({ title, value, subtitle, icon }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f1523] p-5 shadow-lg flex flex-col justify-between transition-all duration-500 hover:border-emerald-500/30">
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

function CardShell({ title, subtitle, right, children, className = "" }: any) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-[#0f1523] p-5 shadow-lg flex flex-col h-full transition-all duration-500 hover:border-slate-700 ${className}`}>
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
  const [activeTab, setActiveTab] = useState<"cumulative" | "online" | "offline">("online");
  const [selectedTestId, setSelectedTestId] = useState<string>("t1");
  const [selectedSubject, setSelectedSubject] = useState<string>("All"); // Interactivity State
  const [isExporting, setIsExporting] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  // Data lookups
  const student = mockStudents.find(s => s.id === selectedStudentId) || mockStudents[0];
  const studentTests = mockOnlineTests[selectedStudentId as keyof typeof mockOnlineTests] || mockOnlineTests.s1;
  const currentTest = studentTests.find(t => t.testId === selectedTestId) || studentTests[0];

  // Interactive filtering for Focus Areas
  const filteredTopics = selectedSubject === "All" 
    ? currentTest.topics 
    : currentTest.topics.filter(t => t.subject === selectedSubject);

  const displayTopics = [...filteredTopics].sort((a, b) => a.pct - b.pct);

  // --- EXPORT PDF ---
  const handleExport = async () => {
    if (!printRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#0a0f18' });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
      pdf.save(`${student.name}_${currentTest.testName}.pdf`);
    } catch (error) {
      alert("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full text-slate-200">
      <RechartsFixStyles /> {/* Inject anti-outline CSS */}
      
      {/* GLOBAL CONTROLS & TAB NAVIGATION */}
      <div data-html2canvas-ignore="true" className="mb-6 flex flex-col gap-4 bg-[#0f1523] p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-2 text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <span className="font-semibold">Viewing Student:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setSelectedSubject("All");
              }}
              className="h-9 min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
            >
              {mockStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
            </select>
          </div>
          <button onClick={handleExport} disabled={isExporting} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors">
            <Download className="h-4 w-4" /> {isExporting ? "Exporting..." : "Export Report"}
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab("cumulative")} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "cumulative" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50"}`}>
            📊 Cumulative (Overall)
          </button>
          <button onClick={() => setActiveTab("online")} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "online" ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/50" : "text-slate-400 hover:bg-slate-800/50"}`}>
            💻 Online Tests
          </button>
          <button onClick={() => setActiveTab("offline")} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "offline" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50"}`}>
            📝 Offline Tests
          </button>
        </div>
      </div>

      {/* ONLINE TEST SPECIFIC VIEW */}
      {activeTab === "online" && (
        <div ref={printRef} className="bg-[#0a0f18] p-4 sm:p-6 rounded-xl border border-slate-800/50 animate-in fade-in duration-500">
          
          {/* Header & Specific Test Selector */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 text-xl font-bold text-emerald-400 shadow-inner">
                {student.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">{student.name}</h1>
                <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <span className="text-emerald-400 border border-emerald-800 bg-emerald-900/20 px-1.5 rounded text-xs">Online Profile</span>
                  <span>STU-{student.id}</span>
                </div>
              </div>
            </div>
            
            <div data-html2canvas-ignore="true" className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
              <FileText className="w-4 h-4 text-slate-400 ml-2" />
              <select
                value={selectedTestId}
                onChange={(e) => {
                  setSelectedTestId(e.target.value);
                  setSelectedSubject("All");
                }}
                className="h-9 min-w-[250px] rounded-lg border-none bg-transparent px-2 text-sm font-medium text-white outline-none cursor-pointer"
              >
                {studentTests.map(t => <option key={t.testId} value={t.testId} className="bg-slate-900">{t.testName}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1 border-b border-slate-800 pb-2 flex justify-between">
              <span>{currentTest.testName} <span className="text-slate-500 text-sm font-normal ml-2">({currentTest.date})</span></span>
            </h2>
          </div>

          {/* Cleaned Up Top Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard title="Test Score" value={currentTest.score} icon={<Target className="h-5 w-5" />} />
            <StatCard title="Class Rank" value={currentTest.rank} icon={<Trophy className="h-5 w-5" />} />
            <StatCard title="Avg. Speed" value={currentTest.avgSpeed} subtitle="per question" icon={<Clock className="h-5 w-5" />} />
          </div>

          {/* Charts Layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
            
            <CardShell title="Accuracy Profile" subtitle="Answers for this specific test">
              <div className="flex h-56 mt-2 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: currentTest.accuracy.correct, color: "#22c55e" }, { value: currentTest.accuracy.wrong, color: "#ef4444" }, { value: currentTest.accuracy.skipped, color: "#334155" }]} dataKey="value" innerRadius={60} outerRadius={85} paddingAngle={3} stroke="none" isAnimationActive={true} animationDuration={1000}>
                      {[{ color: "#22c55e" }, { color: "#ef4444" }, { color: "#334155" }].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800"><div className="text-sm font-bold text-emerald-400">{currentTest.accuracy.correct}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Correct</div></div>
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800"><div className="text-sm font-bold text-rose-400">{currentTest.accuracy.wrong}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Wrong</div></div>
                <div className="rounded-xl bg-slate-900/40 p-2 text-center border border-slate-800"><div className="text-sm font-bold text-slate-300">{currentTest.accuracy.skipped}</div><div className="text-[10px] uppercase text-slate-500 mt-1">Skipped</div></div>
              </div>
            </CardShell>

            <CardShell title="Skills Profile" subtitle="Tested cognitive metrics">
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={currentTest.cognitiveData} outerRadius="70%">
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} isAnimationActive={true} animationDuration={1200} />
                    <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardShell>

          </div>

          {/* Interactive Subject & Focus Areas Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            
            <CardShell 
              title="Subject Mastery" 
              subtitle="Click a subject bar to filter focus areas"
              className={selectedSubject !== "All" ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : ""}
              right={
                selectedSubject !== "All" && (
                  <button onClick={() => setSelectedSubject("All")} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center transition-colors">
                    <Filter className="w-3 h-3 mr-1" /> Reset Filter
                  </button>
                )
              }
            >
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentTest.subjectMasteryData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <XAxis dataKey="subject" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", borderRadius: 8 }} />
                    <Bar 
                      dataKey="score" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40} 
                      isAnimationActive={true} 
                      animationDuration={1000}
                      className="cursor-pointer transition-all hover:opacity-80"
                      onClick={(data: any) => {
                        if (data && data.subject) {
                          setSelectedSubject(data.subject);
                        }
                      }}
                    >
                      {currentTest.subjectMasteryData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={selectedSubject === "All" || selectedSubject === entry.subject ? "#22c55e" : "#1e293b"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardShell>

            <CardShell 
              title={selectedSubject === "All" ? "Focus Areas (All Subjects)" : `Focus Areas: ${selectedSubject}`} 
              subtitle="Topics sorted by lowest accuracy" 
              right={<div className="rounded-xl bg-amber-950/30 border border-amber-900/50 p-2 text-amber-400"><AlertTriangle className="h-4 w-4" /></div>}
            >
              <div key={selectedSubject} className="space-y-4 mt-4 pr-2 overflow-y-auto max-h-[250px] custom-scrollbar">
                {displayTopics.length === 0 ? (
                  <div className="text-slate-500 text-sm text-center py-8">No specific topics recorded for {selectedSubject}.</div>
                ) : (
                  displayTopics.map((x: any, i: number) => (
                    <div key={x.topic} className="space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}>
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="font-semibold text-sm text-white">{x.topic}</div>
                          {selectedSubject === "All" && (
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{x.subject}</div>
                          )}
                        </div>
                        <div className={`text-sm font-bold ${x.pct < 50 ? 'text-rose-400' : x.pct < 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {x.pct}%
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-1.5 rounded-full transition-all duration-1000 ease-out" 
                          style={{ 
                            width: `${x.pct}%`, 
                            backgroundColor: x.pct < 50 ? '#ef4444' : x.pct < 75 ? '#f59e0b' : '#22c55e'
                          }} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardShell>

          </div>
        </div>
      )}

      {/* STUBS FOR OTHER TABS */}
      {activeTab === "cumulative" && (
         <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-xl text-slate-400">
            <Target className="w-10 h-10 mb-2 opacity-50" />
            <p>Cumulative Analytics Dashboard will go here.</p>
            <p className="text-xs mt-2">Merging online test performance with uploaded offline data.</p>
         </div>
      )}
      {activeTab === "offline" && (
         <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-xl text-slate-400">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p>Offline Tests Dashboard will go here.</p>
            <p className="text-xs mt-2">Displaying data uploaded via Excel.</p>
         </div>
      )}
    </div>
  );
}
