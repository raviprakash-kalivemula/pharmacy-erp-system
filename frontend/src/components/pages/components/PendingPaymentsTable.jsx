import React from 'react';
import { AlertTriangle } from 'lucide-react';

const PendingPaymentsTable = ({ payments }) => {
  if (!payments || payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Pending Payments</h3>
        <p className="text-gray-500 text-center py-8">No pending payments - Great!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Pending Payments ({payments.length})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-center font-semibold">Bills</th>
              <th className="px-4 py-3 text-right font-semibold">Amount Due</th>
              <th className="px-4 py-3 text-center font-semibold">Days</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 8).map((payment, index) => (
              <tr key={index} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{payment.customer_name}</p>
                    <p className="text-xs text-gray-500">{payment.customer_phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">{payment.pending_bills}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">
                  ₹{payment.total_pending.toFixed(0)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    payment.days_since_purchase > 30 ? 'bg-red-100 text-red-700' :
                    payment.days_since_purchase > 15 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {payment.days_since_purchase}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length > 8 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Showing 8 of {payments.length} pending payments
        </p>
      )}
    </div>
  );
};

export default PendingPaymentsTable;
