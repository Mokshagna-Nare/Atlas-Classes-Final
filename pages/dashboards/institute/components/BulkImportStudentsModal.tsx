import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../../../services/api';
import { AcademicClass } from '../../../../types';
import {
    ArrowUpTrayIcon, CloudArrowUpIcon, XIcon, CheckCircleIcon,
    ClipboardIcon, ArrowPathIcon, InformationCircleIcon
} from '../../../../components/icons';
import ModalPortal from '../../../../components/ModalPortal';

const randomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
};

interface ParsedRow {
    name: string;
    email: string;
    password: string;
    roll_no: string | null;
    className: string;
    class_id: string | null;
    error?: string;
}

type ResultRow = { name?: string; email: string; password?: string; success: boolean; message?: string };

const pick = (row: Record<string, any>, keys: string[]): string => {
    for (const key of Object.keys(row)) {
        if (keys.includes(key.trim().toLowerCase().replace(/[\s_]/g, ''))) {
            const v = row[key];
            return v === undefined || v === null ? '' : String(v).trim();
        }
    }
    return '';
};

const BulkImportStudentsModal: React.FC<{
    instituteId: string;
    classes: AcademicClass[];
    onClose: () => void;
    onImported: () => void;
}> = ({ instituteId, classes, onClose, onImported }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [results, setResults] = useState<ResultRow[] | null>(null);
    const [parseError, setParseError] = useState('');
    const [copied, setCopied] = useState(false);

    const validCount = rows.filter(r => !r.error).length;

    const handleFile = (file: File) => {
        setParseError('');
        setResults(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                if (json.length === 0) {
                    setParseError('That file has no rows. Use the template below to check the expected format.');
                    setRows([]);
                    return;
                }

                const parsed: ParsedRow[] = json.map((row) => {
                    const name = pick(row, ['name', 'fullname', 'studentname']);
                    const email = pick(row, ['email', 'loginemail', 'emailaddress']);
                    const rollNo = pick(row, ['rollno', 'roll', 'rollnumber']);
                    const className = pick(row, ['class', 'grade', 'classname']);
                    const passwordInput = pick(row, ['password']);

                    const matchedClass = className
                        ? classes.find(c => c.name.toLowerCase() === className.toLowerCase())
                        : undefined;

                    let error: string | undefined;
                    if (!name) error = 'Missing name';
                    else if (!email) error = 'Missing email';
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email';
                    else if (className && !matchedClass) error = `Unknown class "${className}"`;

                    return {
                        name, email, roll_no: rollNo || null,
                        className, class_id: matchedClass?.id || null,
                        password: passwordInput || randomPassword(),
                        error,
                    };
                });

                setRows(parsed);
            } catch (err) {
                setParseError('Could not read that file. Make sure it\'s a valid .xlsx, .xls, or .csv file.');
                setRows([]);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Name', 'RollNo', 'Class', 'Email', 'Password'],
            ['Ananya Sharma', '24', 'Class 10', 'ananya.sharma@example.com', ''],
            ['Rohan Verma', '25', 'Class 10', 'rohan.verma@example.com', ''],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'atlas-student-import-template.xlsx');
    };

    const handleSubmit = async () => {
        const validRows = rows.filter(r => !r.error);
        if (validRows.length === 0) return;
        setIsSubmitting(true);
        try {
            const { data } = await api.post('/auth/bulk-create-students', {
                institute_id: instituteId,
                students: validRows.map(r => ({
                    name: r.name, email: r.email, password: r.password,
                    class_id: r.class_id, roll_no: r.roll_no,
                })),
            });
            setResults(data.results as ResultRow[]);
            onImported();
        } catch (err: any) {
            setParseError(err?.response?.data?.message || err.message || 'Bulk import failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyCredentials = () => {
        if (!results) return;
        const text = results.filter(r => r.success)
            .map(r => `${r.name}\t${r.email}\t${r.password}`)
            .join('\n');
        navigator.clipboard.writeText(`Name\tEmail\tPassword\n${text}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const downloadCredentials = () => {
        if (!results) return;
        const successRows = results.filter(r => r.success);
        const ws = XLSX.utils.aoa_to_sheet([
            ['Name', 'Email', 'Password'],
            ...successRows.map(r => [r.name || '', r.email, r.password || '']),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
        XLSX.writeFile(wb, 'atlas-new-student-credentials.xlsx');
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
                <div className="bg-atlas-dark border border-gray-800 rounded-3xl p-8 w-full max-w-3xl shadow-2xl my-8 animate-scale-in">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-atlas-primary/10 rounded-xl border border-atlas-primary/20">
                                <ArrowUpTrayIcon className="h-5 w-5 text-atlas-primary" />
                            </div>
                            <h3 className="text-xl font-black text-white">Bulk Import Students</h3>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {!results && (
                        <>
                            <div className="flex items-start gap-3 bg-atlas-primary/5 border border-atlas-primary/20 rounded-2xl p-4 mb-6">
                                <InformationCircleIcon className="h-5 w-5 text-atlas-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    Upload an Excel (.xlsx) or CSV file with columns <span className="font-bold text-white">Name, Email</span>, and optionally
                                    <span className="font-bold text-white"> RollNo, Class, Password</span>. If Class is given it must match an existing class name exactly.
                                    Leave Password blank to auto-generate one per student.
                                    {' '}<button onClick={downloadTemplate} className="text-atlas-primary font-bold underline underline-offset-2 hover:text-emerald-400">Download template</button>
                                </p>
                            </div>

                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-700 hover:border-atlas-primary rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors mb-6"
                            >
                                <CloudArrowUpIcon className="h-10 w-10 text-gray-600" />
                                <p className="text-sm text-gray-400 font-bold">{fileName || 'Click to browse, or drag a file here'}</p>
                                <p className="text-xs text-gray-600">.xlsx, .xls, or .csv &middot; up to 500 students</p>
                                <input
                                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                />
                            </div>

                            {parseError && <p className="text-red-500 text-sm font-medium mb-4">{parseError}</p>}

                            {rows.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-white">Preview ({rows.length} rows)</h4>
                                        <span className={`text-xs font-black uppercase tracking-widest ${validCount === rows.length ? 'text-atlas-primary' : 'text-amber-400'}`}>
                                            {validCount} ready &middot; {rows.length - validCount} need fixing
                                        </span>
                                    </div>
                                    <div className="border border-gray-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-900/80 sticky top-0">
                                                <tr className="text-gray-500 uppercase font-bold tracking-widest">
                                                    <th className="p-3">Name</th>
                                                    <th className="p-3">Email</th>
                                                    <th className="p-3">Roll No.</th>
                                                    <th className="p-3">Class</th>
                                                    <th className="p-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/60">
                                                {rows.map((r, i) => (
                                                    <tr key={i} className={r.error ? 'bg-red-500/5' : ''}>
                                                        <td className="p-3 text-gray-200">{r.name || <span className="text-gray-600 italic">—</span>}</td>
                                                        <td className="p-3 text-gray-400">{r.email || <span className="text-gray-600 italic">—</span>}</td>
                                                        <td className="p-3 text-gray-400">{r.roll_no || '—'}</td>
                                                        <td className="p-3 text-gray-400">{r.className || 'Unassigned'}</td>
                                                        <td className="p-3">
                                                            {r.error
                                                                ? <span className="text-red-400 font-bold">{r.error}</span>
                                                                : <span className="text-atlas-primary font-bold flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5" /> Ready</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={onClose} disabled={isSubmitting}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleSubmit} disabled={validCount === 0 || isSubmitting}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-atlas-primary hover:bg-emerald-600 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2">
                                    {isSubmitting ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Creating {validCount} accounts...</> : `Import ${validCount || ''} Students`}
                                </button>
                            </div>
                        </>
                    )}

                    {results && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-4 bg-atlas-primary/5 border border-atlas-primary/20 rounded-2xl p-5">
                                <CheckCircleIcon className="h-8 w-8 text-atlas-primary shrink-0" />
                                <div>
                                    <p className="text-white font-black">{results.filter(r => r.success).length} of {results.length} students created</p>
                                    {results.some(r => !r.success) && <p className="text-xs text-amber-400 mt-1">{results.filter(r => !r.success).length} failed — see details below.</p>}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-white">New credentials — save these now, they won't be shown again this clearly</h4>
                                    <div className="flex gap-2">
                                        <button onClick={copyCredentials} className="text-xs font-bold text-gray-400 hover:text-atlas-primary flex items-center gap-1.5 transition-colors">
                                            {copied ? <CheckCircleIcon className="h-3.5 w-3.5 text-atlas-primary" /> : <ClipboardIcon className="h-3.5 w-3.5" />} Copy
                                        </button>
                                        <button onClick={downloadCredentials} className="text-xs font-bold text-gray-400 hover:text-atlas-primary flex items-center gap-1.5 transition-colors">
                                            <ArrowUpTrayIcon className="h-3.5 w-3.5 rotate-180" /> Download
                                        </button>
                                    </div>
                                </div>
                                <div className="border border-gray-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-900/80 sticky top-0">
                                            <tr className="text-gray-500 uppercase font-bold tracking-widest">
                                                <th className="p-3">Name</th>
                                                <th className="p-3">Email</th>
                                                <th className="p-3">Password</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/60">
                                            {results.map((r, i) => (
                                                <tr key={i} className={!r.success ? 'bg-red-500/5' : ''}>
                                                    <td className="p-3 text-gray-200">{r.name || '—'}</td>
                                                    <td className="p-3 text-gray-400">{r.email}</td>
                                                    <td className="p-3">
                                                        {r.success
                                                            ? <span className="font-mono text-atlas-primary">{r.password}</span>
                                                            : <span className="text-red-400 font-bold">{r.message}</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <button onClick={onClose} className="w-full px-4 py-3 rounded-xl font-bold text-white bg-atlas-primary hover:bg-emerald-600 transition-all shadow-lg">
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </ModalPortal>
    );
};

export default BulkImportStudentsModal;
