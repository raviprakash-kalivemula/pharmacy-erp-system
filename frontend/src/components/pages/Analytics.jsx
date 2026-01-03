/**
 * Analytics Dashboard Component
 * Comprehensive analytics with charts, forecasts, and insights
 */

import React, { useState, useEffect } from 'react';
import api from '../../api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import toastQueue from '../../utils/toastQueue';
import { formatCurrency } from '../../utils/formatters';

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [salesTrends, setSalesTrends] = useState([]);
  const [inventoryForecast, setInventoryForecast] = useState([]);
  const [profitLoss, setProfitLoss] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [topMedicines, setTopMedicines] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    fetchAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch each endpoint separately to isolate failures
      try {
        const res = await api.getAnalyticsSalesTrends(selectedPeriod);
        setSalesTrends(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching sales trends:', error);
        setSalesTrends([]);
      }

      try {
        const res = await api.getAnalyticsInventoryForecast();
        setInventoryForecast(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching inventory forecast:', error);
        setInventoryForecast([]);
      }

      try {
        const res = await api.getAnalyticsProfitLoss(12);
        setProfitLoss(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching profit/loss:', error);
        setProfitLoss([]);
      }

      try {
        const res = await api.getAnalyticsCustomers();
        setCustomers(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching customers:', error);
        setCustomers([]);
      }

      try {
        const res = await api.getAnalyticsDashboard();
        setMetrics(res.data || {});
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        setMetrics({});
      }

      try {
        const res = await api.getAnalyticsTopMedicines(10);
        setTopMedicines(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching top medicines:', error);
        setTopMedicines([]);
      }

    } catch (error) {
      console.error('Critical error in analytics:', error);
      toastQueue.error('Failed to load some analytics data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">⚙️ Loading analytics...</div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Calculate inventory health stats
  const inventoryStats = {
    critical: inventoryForecast.filter(m => m.status === 'critical' || m.status === 'stockout').length,
    low: inventoryForecast.filter(m => m.status === 'low').length,
    healthy: inventoryForecast.filter(m => m.status === 'healthy').length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800">📊 Analytics & Insights</h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last Year</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Today's Sales</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {formatCurrency(metrics?.today?.today_sales || 0)}
              </p>
              <p className="text-gray-500 text-xs mt-2">{metrics?.today?.today_transactions || 0} transactions</p>
            </div>
            <DollarSign className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">This Month Revenue</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {formatCurrency(metrics?.month?.month_sales || 0)}
              </p>
              <p className="text-gray-500 text-xs mt-2">Cost: {formatCurrency(metrics?.month?.month_cogs || 0)}</p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Stock Value</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {formatCurrency(metrics?.inventory?.total_stock_value || 0)}
              </p>
              <p className="text-gray-500 text-xs mt-2">{metrics?.inventory?.total_items || 0} items</p>
            </div>
            <Package className="text-orange-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Customers</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {customers.filter(c => c.status === 'active').length}
              </p>
              <p className="text-gray-500 text-xs mt-2">{customers.length} total</p>
            </div>
            <Users className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Sales Trends */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">💹 Sales Trends</h3>
        {salesTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="daily_sales" stroke="#3B82F6" name="Daily Sales" />
              <Line type="monotone" dataKey="paid_sales" stroke="#10B981" name="Paid" />
              <Line type="monotone" dataKey="pending_sales" stroke="#F59E0B" name="Pending" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No sales data available</p>
        )}
      </div>

      {/* Profit & Loss */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">📈 Profit & Loss Analysis</h3>
        {profitLoss.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitLoss}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                <Bar dataKey="cost_of_goods" fill="#EF4444" name="COGS" />
                <Bar dataKey="expenses" fill="#F59E0B" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
            {profitLoss[0]?.profit !== undefined && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(profitLoss.reduce((acc, m) => acc + (m.profit || 0), 0))}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600">Avg Monthly Profit</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(profitLoss.reduce((acc, m) => acc + (m.profit || 0), 0) / profitLoss.length)}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded border-l-4 border-purple-500">
                  <p className="text-sm text-gray-600">Profit Margin</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {profitLoss[0]?.profit && profitLoss[0]?.revenue ? 
                      ((profitLoss[0].profit / profitLoss[0].revenue) * 100).toFixed(1) : '0'}%
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded border-l-4 border-orange-500">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(profitLoss.reduce((acc, m) => acc + (m.revenue || 0), 0))}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">No financial data available</p>
        )}
      </div>

      {/* Inventory Forecast */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">📦 Inventory Forecast & Health</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-red-50 rounded text-center border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Critical/Stockout</p>
            <p className="text-2xl font-bold text-red-600">{inventoryStats.critical}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded text-center border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-600">{inventoryStats.low}</p>
          </div>
          <div className="p-4 bg-green-50 rounded text-center border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Healthy</p>
            <p className="text-2xl font-bold text-green-600">{inventoryStats.healthy}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Medicine</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">Daily Avg Sales</th>
                <th className="px-4 py-3 text-right">Days of Stock</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {inventoryForecast.slice(0, 15).map((medicine) => (
                <tr key={medicine.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{medicine.name}</p>
                      <p className="text-xs text-gray-500">{medicine.salt}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{medicine.current_quantity}</td>
                  <td className="px-4 py-3 text-right">{medicine.avg_daily_sales?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-3 text-right">
                    {medicine.days_of_stock === 999 ? '∞' : medicine.days_of_stock}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      medicine.status === 'stockout' ? 'bg-red-100 text-red-700' :
                      medicine.status === 'critical' ? 'bg-red-50 text-red-600' :
                      medicine.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {medicine.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Selling Medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">🏆 Top Selling Medicines</h3>
          {topMedicines.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topMedicines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_sold" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No sales data</p>
          )}
        </div>

        {/* Customer Segmentation */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">👥 Customer Segmentation</h3>
          {customers.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: customers.filter(c => c.status === 'active').length },
                      { name: 'At Risk', value: customers.filter(c => c.status === 'at_risk').length },
                      { name: 'Inactive', value: customers.filter(c => c.status === 'inactive').length }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="inline-block w-3 h-3 bg-blue-500 mr-2 rounded"></span>Active: {customers.filter(c => c.status === 'active').length}</p>
                <p><span className="inline-block w-3 h-3 bg-amber-500 mr-2 rounded"></span>At Risk: {customers.filter(c => c.status === 'at_risk').length}</p>
                <p><span className="inline-block w-3 h-3 bg-red-500 mr-2 rounded"></span>Inactive: {customers.filter(c => c.status === 'inactive').length}</p>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">No customer data</p>
          )}
        </div>
      </div>

      {/* Top Customers by Lifetime Value */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">💎 Top Customers (Lifetime Value)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-right">Lifetime Value</th>
                <th className="px-4 py-3 text-right">Transactions</th>
                <th className="px-4 py-3 text-right">Avg Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Last Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.slice(0, 10).map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.phone}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(customer.lifetime_value || 0)}</td>
                  <td className="px-4 py-3 text-right">{customer.total_transactions}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(customer.avg_transaction_value || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      customer.status === 'active' ? 'bg-green-100 text-green-700' :
                      customer.status === 'at_risk' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 text-xs">
                    {customer.days_since_purchase ? `${customer.days_since_purchase}d ago` : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
