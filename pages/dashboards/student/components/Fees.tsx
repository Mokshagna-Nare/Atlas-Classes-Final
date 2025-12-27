import React from 'react';
import { useData } from '../../../../contexts/DataContext';

const Fees: React.FC = () => {
    const { payments, updatePaymentStatus } = useData();

    const handlePayNow = (paymentId: string) => {
        updatePaymentStatus(paymentId, 'Paid');
        alert('Payment successful! Your records have been updated.');
    };

    const handleViewReceipt = (paymentId: string) => {
        alert(`Showing receipt for payment ID #${paymentId}.`);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-atlas-orange">Fee & Payment History</h2>
            <div className="overflow-x-auto bg-atlas-black rounded-lg">
                <table className="w-full text-left">
                    <thead className="border-b border-gray-700">
                        <tr>
                            <th className="p-4">Transaction ID</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Amount (INR)</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((payment) => (
                            <tr key={payment.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="p-4">#{payment.id}</td>
                                <td className="p-4">{payment.date}</td>
                                <td className="p-4">{payment.amount.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        payment.status === 'Paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {payment.status === 'Due' ? (
                                        <button onClick={() => handlePayNow(payment.id)} className="bg-atlas-orange text-white font-bold py-1 px-3 rounded-md text-sm hover:bg-orange-600 transition">
                                            Pay Now
                                        </button>
                                    ) : (
                                        <button onClick={() => handleViewReceipt(payment.id)} className="text-gray-400 text-sm hover:underline">View Receipt</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Fees;