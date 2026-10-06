import React, { useState, useMemo } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { Student } from '../../../../types';
import {
    UserPlusIcon, IdentificationIcon, KeyIcon, TrashIcon, PencilSquareIcon,
    EyeIcon, EyeSlashIcon, ClipboardIcon, CheckCircleIcon, MagnifyingGlassIcon,
    ArrowPathIcon, XIcon, UserGroupIcon, AcademicCapIcon, ArrowUpTrayIcon
} from '../../../../components/icons';
import ModalPortal from '../../../../components/ModalPortal';
import BulkImportStudentsModal from './BulkImportStudentsModal';

const randomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

// --- ADD / EDIT STUDENT MODAL ---
const StudentModal: React.FC<{
    student?: Student | null;
    instituteId: string;
    onClose: () => void;
    onSaved: () => void;
}> = ({ student, instituteId, onClose, onSaved }) => {
    const { classes, createStudent, updateStudent } = useData();
    const instituteClasses = classes.filter(c => c.institute_id === instituteId);
    const isEditing = !!student;

    const [name, setName] = useState(student?.name || '');
    const [email, setEmail] = useState(student?.email || '');
    const [rollNo, setRollNo] = useState(student?.roll_no || '');
    const [classId, setClassId] = useState(student?.class_id || '');
    const [password, setPassword] = useState(student?.password || randomPassword());
    const [showPassword, setShowPassword] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            if (isEditing && student) {
                await updateStudent(student.id, {
                    name, email, roll_no: rollNo || null, class_id: classId || null,
                    ...(password !== student.password ? { password } : {}),
                });
            } else {
                await createStudent({
                    name, email, password, institute_id: instituteId,
                    class_id: classId || null, roll_no: rollNo || null,
                });
            }
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || err.message || 'Failed to save student.');
            setIsLoading(false);
        }
    };

    return (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="bg-atlas-dark border border-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl my-8 animate-scale-in">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-atlas-primary/10 rounded-xl border border-atlas-primary/20">
                        <UserPlusIcon className="h-5 w-5 text-atlas-primary" />
                    </div>
                    <h3 className="text-xl font-black text-white">{isEditing ? 'Edit Student' : 'Enroll New Student'}</h3>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Full Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                            className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white transition-colors"
                            placeholder="e.g., Ananya Sharma" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Roll No.</label>
                            <input type="text" value={rollNo} onChange={e => setRollNo(e.target.value)}
                                className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white transition-colors"
                                placeholder="e.g., 24" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Class</label>
                            <select value={classId} onChange={e => setClassId(e.target.value)}
                                className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white transition-colors">
                                <option value="">Unassigned</option>
                                {instituteClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Login Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isEditing}
                            className="w-full p-3 bg-atlas-black border border-gray-700 rounded-xl focus:outline-none focus:border-atlas-primary text-white transition-colors disabled:opacity-50"
                            placeholder="student@example.com" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Password</label>
                        <div className="flex items-center gap-2 bg-atlas-black border border-gray-700 rounded-xl pr-2 focus-within:border-atlas-primary transition-colors">
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                className="flex-1 p-3 bg-transparent outline-none text-white font-mono text-sm" />
                            <button type="button" onClick={() => setPassword(randomPassword())} className="p-2 text-gray-500 hover:text-atlas-primary transition-colors" title="Generate new password">
                                <ArrowPathIcon className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setShowPassword(s => !s)} className="p-2 text-gray-500 hover:text-white transition-colors">
                                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} disabled={isLoading}
                            className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading}
                            className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-atlas-primary hover:bg-emerald-600 transition-all hover:-translate-y-0.5 active:scale-95 shadow-lg disabled:opacity-50 disabled:hover:translate-y-0">
                            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </ModalPortal>
    );
};

// --- MAIN MANAGE STUDENTS COMPONENT ---
const ManageStudents: React.FC = () => {
    const { students, classes, deleteStudent, refreshStudents } = useData();
    const { user } = useAuth()!;
    const instituteId = user?.id || '';

    const instituteStudents = useMemo(() => students.filter(s => s.institute_id === instituteId), [students, instituteId]);
    const instituteClasses = useMemo(() => classes.filter(c => c.institute_id === instituteId), [classes, instituteId]);

    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('All');
    const [editingStudent, setEditingStudent] = useState<Student | null | undefined>(undefined);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const filteredStudents = instituteStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase()) || (s.roll_no || '').toLowerCase().includes(search.toLowerCase());
        const matchesClass = classFilter === 'All' || s.class_id === classFilter;
        return matchesSearch && matchesClass;
    });

    const togglePassword = (id: string) => {
        setVisiblePasswords(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const copyCredentials = (s: Student) => {
        navigator.clipboard.writeText(`Email: ${s.email}\nPassword: ${s.password || '(not available — reset to view)'}`);
        setCopiedId(s.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const handleDelete = (s: Student) => {
        if (window.confirm(`Remove ${s.name}'s account? This permanently deletes their login and cannot be undone.`)) {
            deleteStudent(s.id);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-white">Student Roster</h2>
                    <p className="text-atlas-text-muted text-sm font-semibold uppercase tracking-widest mt-1">
                        {instituteStudents.length} enrolled &middot; {instituteClasses.length} classes
                    </p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="bg-atlas-soft border border-gray-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg hover:border-atlas-primary hover:-translate-y-1 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                        <ArrowUpTrayIcon className="h-4 w-4" /> Bulk Import
                    </button>
                    <button
                        onClick={() => setEditingStudent(null)}
                        className="bg-atlas-primary text-white font-black py-4 px-8 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                        <UserPlusIcon className="h-4 w-4" /> Enroll Student
                    </button>
                </div>
            </div>

            {instituteClasses.length === 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <AcademicCapIcon className="h-6 w-6 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-200/80">
                        You haven't defined any classes yet. Head to <span className="font-bold text-amber-300">Academics &rarr; Grade Repository</span> to add one, so students can be sorted by section.
                    </p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, or roll no..."
                        className="w-full pl-11 pr-4 py-3.5 bg-atlas-dark border border-gray-800 rounded-2xl text-white text-sm outline-none focus:border-atlas-primary transition-colors"
                    />
                </div>
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                    className="px-4 py-3.5 bg-atlas-dark border border-gray-800 rounded-2xl text-white text-sm font-bold outline-none focus:border-atlas-primary transition-colors">
                    <option value="All">All Classes</option>
                    {instituteClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="bg-atlas-dark border border-white/5 rounded-3xl overflow-x-auto shadow-2xl">
                <table className="w-full text-left min-w-[720px]">
                    <thead className="bg-atlas-black/50 border-b border-gray-800 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <tr>
                            <th className="px-5 py-4">Student</th>
                            <th className="px-5 py-4">Class</th>
                            <th className="px-5 py-4">Credentials</th>
                            <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {filteredStudents.map(s => (
                            <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-atlas-primary/10 border border-atlas-primary/20 flex items-center justify-center shrink-0">
                                            <span className="text-atlas-primary font-black text-sm">{s.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm whitespace-nowrap">{s.name}</p>
                                            <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                                                {s.roll_no && <><IdentificationIcon className="h-3 w-3" /> Roll {s.roll_no}</>}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    {s.class_id ? (
                                        <span className="px-3 py-1.5 bg-atlas-primary/5 text-atlas-primary border border-atlas-primary/20 text-[10px] font-black rounded-lg uppercase tracking-widest whitespace-nowrap">
                                            {instituteClasses.find(c => c.id === s.class_id)?.name || 'Unknown'}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600 text-xs italic">Unassigned</span>
                                    )}
                                </td>
                                <td className="px-5 py-4">
                                    <p className="text-xs text-gray-400 mb-1">{s.email}</p>
                                    <div className="flex items-center gap-2">
                                        <KeyIcon className="h-3 w-3 text-gray-600" />
                                        <p className="text-sm font-mono text-gray-400">
                                            {visiblePasswords.has(s.id) ? (s.password || '••••••••') : '••••••••'}
                                        </p>
                                        <button onClick={() => togglePassword(s.id)} className="text-gray-600 hover:text-atlas-primary transition-colors">
                                            {visiblePasswords.has(s.id) ? <EyeSlashIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                                        </button>
                                        <button onClick={() => copyCredentials(s)} className="text-gray-600 hover:text-atlas-primary transition-colors" title="Copy credentials">
                                            {copiedId === s.id ? <CheckCircleIcon className="h-3.5 w-3.5 text-atlas-primary" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingStudent(s)} className="p-2.5 bg-atlas-soft border border-gray-700 rounded-xl text-blue-400 hover:text-white hover:bg-blue-500 transition-all">
                                            <PencilSquareIcon className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(s)} className="p-2.5 bg-atlas-soft border border-gray-700 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredStudents.length === 0 && (
                    <div className="p-20 text-center text-gray-600 font-black uppercase tracking-widest text-sm flex flex-col items-center gap-3">
                        <UserGroupIcon className="h-10 w-10 text-gray-700" />
                        {instituteStudents.length === 0 ? 'No students enrolled yet.' : 'No students match your search.'}
                    </div>
                )}
            </div>

            {editingStudent !== undefined && (
                <StudentModal
                    student={editingStudent}
                    instituteId={instituteId}
                    onClose={() => setEditingStudent(undefined)}
                    onSaved={refreshStudents}
                />
            )}

            {isBulkModalOpen && (
                <BulkImportStudentsModal
                    instituteId={instituteId}
                    classes={instituteClasses}
                    onClose={() => setIsBulkModalOpen(false)}
                    onImported={refreshStudents}
                />
            )}
        </div>
    );
};

export default ManageStudents;
