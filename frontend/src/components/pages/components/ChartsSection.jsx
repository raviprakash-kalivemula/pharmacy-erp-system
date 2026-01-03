import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const ChartsSection = ({ data }) => {
  const { paymentBreakdown, hourlySales, topMedicines, paymentModes } = data;

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Format payment breakdown data
  const paymentData = paymentBreakdown.map(item => ({
    name: item.payment_status.charAt(0).toUpperCase() + item.payment_status.slice(1),
    value: parseInt(item.count),
    amount: item.amount
  }));

  // Format hourly sales data
  const hourlyData = hourlySales.map(item => ({
    hour: `${item.hour}:00`,
    sales: parseFloat(item.amount),
    transactions: item.transactions,
    paid: parseFloat(item.paid_amount),
    pending: parseFloat(item.pending_amount)
  }));

  // Format top medicines data
  const medicinesData = topMedicines.map(item => ({
    name: item.medicine_name.substring(0, 15) + (item.medicine_name.length > 15 ? '...' : ''),
    quantity: item.total_qty,
    revenue: parseFloat(item.total_revenue),
    transactions: item.transaction_count
  }));

  // Format payment modes data
  const modesData = paymentModes.map(item => ({
    name: item.payment_mode.toUpperCase(),
    value: parseInt(item.transactions),
    amount: parseFloat(item.amount)
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Payment Status Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Payment Status Distribution</h3>
        {paymentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} transactions`, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No payment data available</p>
        )}
      </div>

      {/* Hourly Sales Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Hourly Sales Trend</h3>
        {hourlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`₹${value.toFixed(0)}`, 'Sales']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Sales"
              />
              <Line
                type="monotone"
                dataKey="paid"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 3 }}
                name="Paid"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No hourly data available</p>
        )}
      </div>

      {/* Top 5 Medicines Sold */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Top 5 Medicines Sold</h3>
        {medicinesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={medicinesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip
                formatter={(value) => value.toLocaleString()}
              />
              <Legend />
              <Bar dataKey="quantity" fill="#8B5CF6" name="Quantity Sold" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No medicine sales data available</p>
        )}
      </div>

      {/* Sales by Payment Mode */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Sales by Payment Mode</h3>
        {modesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modesData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {modesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} transactions`, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No payment mode data available</p>
        )}
      </div>
    </div>
  );
};

export default ChartsSection;
