import React from 'react';

const TopMedicinesTable = ({ medicines }) => {
  if (!medicines || medicines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Top Medicines Sold</h3>
        <p className="text-gray-500 text-center py-8">No sales data available today</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Low Stock Items</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Medicine</th>
              <th className="px-4 py-3 text-center font-semibold">Stock</th>
              <th className="px-4 py-3 text-center font-semibold">Min</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {medicines.slice(0, 5).map((medicine, index) => (
              <tr key={index} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{medicine.name}</p>
                    <p className="text-xs text-gray-500">{medicine.manufacturer}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-bold">{medicine.total_stock}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {medicine.min_stock || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    medicine.total_stock === 0 ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {medicine.total_stock === 0 ? 'OUT' : 'LOW'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopMedicinesTable;
