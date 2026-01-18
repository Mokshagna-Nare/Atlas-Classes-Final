
import React, { useState, useEffect } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { AcademicClass, WeeklySchedule } from '../../../../types';
import { 
    PlusIcon, TrashIcon, AcademicCapIcon, 
    ChevronDownIcon, XIcon, CheckCircleIcon, ClipboardIcon 
} from '../../../../components/icons';

interface AcademicsManagerProps {
    initialTab?: 'classes' | 'schedule' | 'tests';
}

const AcademicsManager: React.FC<AcademicsManagerProps> = ({ initialTab }) => {
    const { classes, addClass, deleteClass, schedules, addSchedule, deleteSchedule, tests, results } = useData();
    const [activeTab, setActiveTab] = useState<'classes' | 'schedule' | 'tests'>(initialTab || 'classes');
    
    // Auto-switch tab if prop changes
    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    // Add Class Modal State
    const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
    const [newClassName, setNewClassName] = useState('Class 6');
    const [newClassSubjects, setNewClassSubjects] = useState<string[]>(['Mathematics', 'Science', 'Social']);
    
    // Add Schedule Modal State
    const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false);
    const [schedClassId, setSchedClassId] = useState('');
    const [schedWeek, setSchedWeek] = useState(1);
    const [schedSub, setSchedSub] = useState('');
    const [schedTopic, setSchedTopic] = useState('');

    const handleAddClass = (e: React.FormEvent) => {
        e.preventDefault();
        const id = `c${newClassName.split(' ')[1]}`;
        // Check if exists
        if(classes.find(c => c.id === id)) {
            alert('Class already exists');
            return;
        }
        addClass({ id, name: newClassName, subjects: newClassSubjects.filter(s => s.trim() !== '') });
        setIsAddClassModalOpen(false);
    };

    const handleAddSchedule = (e: React.FormEvent) => {
        e.preventDefault();
        addSchedule({ id: `sc${Date.now()}`, classId: schedClassId, weekNumber: schedWeek, subject: schedSub, topic: schedTopic });
        setSchedTopic('');
        setIsAddScheduleModalOpen(false);
    };

    const getTestStatus = (testId: string, currentStatus: string) => {
        const hasResults = results.some(r => r.testId === testId);
        if (hasResults) return 'Graded';
        return currentStatus;
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex border-b border-white/5 mb-6 overflow-x-auto scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('classes')} 
                    className={`px-8 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${activeTab === 'classes' ? 'border-atlas-primary text-atlas-primary bg-atlas-primary/5' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                    Grade Repository
                </button>
                <button 
                    onClick={() => setActiveTab('schedule')} 
                    className={`px-8 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${activeTab === 'schedule' ? 'border-atlas-primary text-atlas-primary bg-atlas-primary/5' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                    Weekly Microplans
                </button>
                <button 
                    onClick={() => setActiveTab('tests')} 
                    className={`px-8 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${activeTab === 'tests' ? 'border-atlas-primary text-atlas-primary bg-atlas-primary/5' : 'border-transparent text-gray-500 hover:text-white'}`}
                >
                    Test Status Segment
                </button>
            </div>

            {activeTab === 'classes' && (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button onClick={() => setIsAddClassModalOpen(true)} className="bg-atlas-primary text-white font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-600 transition-all text-xs uppercase tracking-widest shadow-glow">
                            <PlusIcon className="h-4 w-4" /> Define Grade
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {classes.sort((a,b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1])).map(cls => (
                            <div key={cls.id} className="bg-atlas-soft/40 border border-white/5 rounded-3xl p-8 hover:border-atlas-primary/40 transition-all group relative overflow-hidden">
                                <button onClick={() => deleteClass(cls.id)} className="absolute top-6 right-6 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-atlas-dark rounded-lg border border-white/5">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                                <div className="p-3 bg-atlas-primary/10 rounded-2xl w-fit mb-6 border border-atlas-primary/20">
                                    <AcademicCapIcon className="h-6 w-6 text-atlas-primary" />
                                </div>
                                <h3 className="text-xl font-black text-white mb-2">{cls.name}</h3>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Course Subjects</p>
                                <div className="flex flex-wrap gap-2">
                                    {cls.subjects.map((sub, i) => (
                                        <span key={i} className="px-3 py-1 bg-atlas-dark border border-white/5 text-gray-400 text-[10px] font-bold uppercase rounded-lg">
                                            {sub}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-atlas-dark p-6 rounded-3xl border border-white/5">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Global Schedule Repository</h3>
                            <p className="text-xs text-gray-500 mt-1">Manage weekly lesson topics per grade.</p>
                        </div>
                        <button onClick={() => setIsAddScheduleModalOpen(true)} className="bg-atlas-primary text-white font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-600 transition-all text-xs uppercase tracking-widest">
                            <PlusIcon className="h-4 w-4" /> Add Topic Entry
                        </button>
                    </div>

                    <div className="bg-atlas-soft border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-atlas-black/50 border-b border-white/5">
                                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    <th className="p-6">Grade</th>
                                    <th className="p-6">Week</th>
                                    <th className="p-6">Subject</th>
                                    <th className="p-6">Academic Topic</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {schedules.map(sch => (
                                    <tr key={sch.id} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="p-6">
                                            <span className="text-sm font-bold text-white">{classes.find(c => c.id === sch.classId)?.name || 'Unknown'}</span>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-sm font-black text-atlas-primary">W-{sch.weekNumber}</span>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{sch.subject}</span>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-sm text-gray-300 font-medium">{sch.topic}</span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button onClick={() => deleteSchedule(sch.id)} className="text-gray-600 hover:text-red-500 p-2">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {schedules.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No topics mapped for this semester.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'tests' && (
                <div className="space-y-6">
                    <div className="bg-atlas-dark p-6 rounded-3xl border border-white/5">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest">Global Test Monitor</h3>
                        <p className="text-xs text-gray-500 mt-1">Cross-batch visibility of all examinations and their evaluation status.</p>
                    </div>

                    <div className="bg-atlas-soft border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-atlas-black/50 border-b border-white/5">
                                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    <th className="p-6">Test Identifier</th>
                                    <th className="p-6">Assigned Batch</th>
                                    <th className="p-6">Schedule</th>
                                    <th className="p-6">Progress Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {tests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(test => {
                                    const status = getTestStatus(test.id, test.status);
                                    return (
                                        <tr key={test.id} className="hover:bg-white/[0.02] transition-all">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-atlas-dark border border-white/5 rounded-lg">
                                                        <ClipboardIcon className="h-4 w-4 text-atlas-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{test.title}</p>
                                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{test.subject}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="px-3 py-1 bg-atlas-primary/5 text-atlas-primary border border-atlas-primary/20 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                                    {test.batch}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-xs text-gray-400 font-medium">{test.date}</span>
                                            </td>
                                            <td className="p-6">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                    status === 'Graded' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    status === 'Completed' ? 'bg-atlas-primary/10 text-atlas-primary' :
                                                    'bg-gray-800 text-gray-500'
                                                }`}>
                                                    {status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isAddClassModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddClassModalOpen(false)}></div>
                    <form onSubmit={handleAddClass} className="relative bg-atlas-soft border border-white/10 p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-scale-in">
                        <h2 className="text-2xl font-black text-white mb-8">Register New Grade</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Grade Name</label>
                                <select value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-4 bg-atlas-dark border border-white/5 rounded-2xl text-white outline-none focus:border-atlas-primary">
                                    <option>Class 6</option>
                                    <option>Class 7</option>
                                    <option>Class 8</option>
                                    <option>Class 9</option>
                                    <option>Class 10</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-atlas-primary text-white font-black py-4 rounded-2xl shadow-glow hover:bg-emerald-600 transition-all uppercase tracking-widest text-xs">Confirm Grade logic</button>
                        </div>
                    </form>
                </div>
            )}

            {isAddScheduleModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddScheduleModalOpen(false)}></div>
                    <form onSubmit={handleAddSchedule} className="relative bg-atlas-soft border border-white/10 p-10 rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-scale-in">
                        <h2 className="text-2xl font-black text-white mb-8">Schedule New Topic</h2>
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Target Grade</label>
                                <select value={schedClassId} onChange={e => setSchedClassId(e.target.value)} required className="w-full p-4 bg-atlas-dark border border-white/5 rounded-2xl text-white outline-none">
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Week Number</label>
                                <input type="number" value={schedWeek} onChange={e => setSchedWeek(parseInt(e.target.value))} required className="w-full p-4 bg-atlas-dark border border-white/5 rounded-2xl text-white outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Subject</label>
                                <input type="text" value={schedSub} onChange={e => setSchedSub(e.target.value)} required placeholder="e.g., Physics" className="w-full p-4 bg-atlas-dark border border-white/5 rounded-2xl text-white outline-none" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Topic Description</label>
                                <textarea value={schedTopic} onChange={e => setSchedTopic(e.target.value)} required placeholder="Primary lesson objective..." className="w-full p-4 bg-atlas-dark border border-white/5 rounded-2xl text-white outline-none resize-none" rows={3} />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-atlas-primary text-white font-black py-4 rounded-2xl shadow-glow hover:bg-emerald-600 transition-all uppercase tracking-widest text-xs">Confirm Schedule Entry</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AcademicsManager;
