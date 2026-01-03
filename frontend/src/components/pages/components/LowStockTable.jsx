import React from 'react';
import { AlertTriangle } from 'lucide-react';

const LowStockTable = ({ medicines }) => {
  if (!medicines || medicines.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-400">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-yellow-600" size={24} />
        <h3 className="text-lg font-semibold">Low Stock Alert ({medicines.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-yellow-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Medicine</th>
              <th className="px-4 py-3 text-center font-semibold">Current</th>
              <th className="px-4 py-3 text-center font-semibold">Min Stock</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((medicine, index) => {
              const daysToExpiry = medicine.days_to_expiry;
              const isExpired = daysToExpiry < 0;
              const expiringCritical = daysToExpiry < 30 && daysToExpiry >= 0;

              return (
                <tr key={index} className="border-b hover:bg-yellow-50 transition">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{medicine.name}</p>
                      <p className="text-xs text-gray-500">{medicine.manufacturer}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-red-600">{medicine.total_stock}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-700">{medicine.min_stock || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      medicine.total_stock === 0 ? 'bg-red-100 text-red-700' :
                      medicine.total_stock <= (medicine.min_stock || 5) ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {medicine.total_stock === 0 ? 'OUT' : 'LOW'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      isExpired ? 'bg-red-100 text-red-700' :
                      expiringCritical ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {isExpired ? 'EXPIRED' : daysToExpiry ? `${daysToExpiry}d` : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LowStockTable;
