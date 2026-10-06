import React from 'react';
import { useData } from '../../../../contexts/DataContext';
import { CreditCardIcon, CheckCircleIcon, InformationCircleIcon, ClipboardDocumentListIcon } from '../../../../components/icons';

const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const Fees: React.FC = () => {
    const { payments } = useData();

    const paid = payments.filter(p => p.status === 'Paid');
    const due = payments.filter(p => p.status === 'Due');
    const totalPaid = paid.reduce((a, p) => a + p.amount, 0);
    const totalDue = due.reduce((a, p) => a + p.amount, 0);
    const nextDue = due.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    return (
        <div className="space-y-6">
            {/* Online payments aren't wired to a gateway or a fees table yet — say so plainly instead of faking a checkout. */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-500/[0.06] border border-sky-500/20">
                <InformationCircleIcon className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-sm text-sky-100/80">
                    Online fee payment isn't available yet. Please pay dues at your institute's office — your records will update once they're recorded. The entries below are sample records.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-atlas-dark p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Total paid</p>
                    <p className="text-3xl font-black text-emerald-400">{inr(totalPaid)}</p>
                    <p className="text-xs text-gray-500 mt-2">{paid.length} payment{paid.length === 1 ? '' : 's'}</p>
                </div>
                <div className="bg-atlas-dark p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Outstanding</p>
                    <p className={`text-3xl font-black ${totalDue > 0 ? 'text-amber-400' : 'text-white'}`}>{inr(totalDue)}</p>
                    <p className="text-xs text-gray-500 mt-2">{due.length ? `${due.length} pending` : 'Nothing pending'}</p>
                </div>
                <div className="bg-atlas-dark p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Next due</p>
                    <p className="text-3xl font-black text-white">{nextDue ? longDate(nextDue.date) : '—'}</p>
                    <p className="text-xs text-gray-500 mt-2">{nextDue ? inr(nextDue.amount) : "You're all caught up"}</p>
                </div>
            </div>

            <section className="bg-atlas-dark rounded-[1.75rem] border border-white/5 overflow-hidden">
                <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-atlas-primary/10 text-atlas-primary"><ClipboardDocumentListIcon className="h-5 w-5" /></div>
                    <div>
                        <h3 className="text-lg font-black text-white">Payment history</h3>
                        <p className="text-xs text-gray-500">Most recent first</p>
                    </div>
                </header>
                {payments.length === 0 ? (
                    <div className="p-12 text-center text-sm text-gray-500">No fee records yet.</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {payments.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                            <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                <div className={`p-2.5 rounded-xl ${p.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                    {p.status === 'Paid' ? <CheckCircleIcon className="h-5 w-5" /> : <CreditCardIcon className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{p.status === 'Paid' ? 'Tuition fee paid' : 'Tuition fee due'}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{longDate(p.date)} · Ref #{p.id}</p>
                                </div>
                                <p className="text-base font-black text-white">{inr(p.amount)}</p>
                                <span className={`hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                    {p.status === 'Paid' ? 'Paid' : 'Pay at institute'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default Fees;
