import React, { useState, useEffect } from 'react';
import api from '../../api';
import { RefreshCw, Download, FileText, Mail, Printer, TrendingUp, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import MetricsCard from './components/MetricsCard';
import ChartsSection from './components/ChartsSection';
import AlertsSection from './components/AlertsSection';
import PendingPaymentsTable from './components/PendingPaymentsTable';
import LowStockTable from './components/LowStockTable';
import TopMedicinesTable from './components/TopMedicinesTable';
import './SalesPerformance.css';

const SalesPerformance = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [userRole] = useState(localStorage.getItem('userRole') || 'manager');
  const [view, setView] = useState(userRole === 'cashier' ? 'cashier' : 'manager');

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/sales-performance');
      if (response.data.success) {
        setDashboardData(response.data.data);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Export to Excel
  const handleExportExcel = () => {
    if (!dashboardData) return;

    const data = [
      ['Sales Performance Report', new Date().toLocaleDateString()],
      [],
      ['METRICS'],
      ['Metric', 'Value', 'vs Yesterday'],
      ['Total Sales', dashboardData.metrics.today.total_sales, dashboardData.metrics.comparisons.todayVsYesterday.sales_change + '%'],
      ['Transactions', dashboardData.metrics.today.transaction_count, dashboardData.metrics.comparisons.todayVsYesterday.transactions_change],
      ['Avg Bill', dashboardData.metrics.today.avg_bill, dashboardData.metrics.comparisons.todayVsYesterday.avg_bill_change + '%'],
      ['Pending', dashboardData.metrics.today.pending_amount, ''],
      []
    ];

    // Add more detailed data
    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-performance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <RefreshCw size={32} className="text-blue-500" />
          </div>
          <p className="text-gray-600">Loading Sales Performance Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p>{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-gray-500">No data available</div>;
  }

  const { metrics, charts, tables, alerts } = dashboardData;
  const { today, yesterday, comparisons } = metrics;

  return (
    <div className="sales-performance-dashboard space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Sales Performance Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Last updated: {formatTime(lastUpdated)}
              <span className="ml-2 text-xs text-gray-500">(Auto-refreshes every 5 minutes)</span>
            </p>
          </div>

          {/* Role Toggle */}
          {userRole === 'manager' && (
            <div className="flex gap-2">
              <button
                onClick={() => setView('manager')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  view === 'manager'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Manager View
              </button>
              <button
                onClick={() => setView('cashier')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  view === 'cashier'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cashier View
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              title="Refresh data"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
              title="Export to Excel"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition"
              title="Print report"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <AlertsSection alerts={alerts} />
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Today's Sales"
          value={today.total_sales}
          type="currency"
          change={comparisons.todayVsYesterday.sales_change}
          icon={DollarSign}
          compareText={`vs yesterday: ${yesterday.total_sales > 0 ? yesterday.total_sales.toFixed(0) : 'N/A'}`}
        />
        <MetricsCard
          title="Transactions"
          value={today.transaction_count}
          type="number"
          change={comparisons.todayVsYesterday.transactions_change}
          icon={ShoppingCart}
          compareText={`vs yesterday: ${yesterday.transaction_count}`}
        />
        <MetricsCard
          title="Avg Bill Value"
          value={today.avg_bill}
          type="currency"
          change={comparisons.todayVsYesterday.avg_bill_change}
          icon={TrendingUp}
          compareText={`vs yesterday: ${yesterday.avg_bill.toFixed(0)}`}
        />
        <MetricsCard
          title="Pending Payments"
          value={today.pending_amount}
          type="currency"
          change={null}
          icon={AlertCircle}
          color="warning"
          compareText={`from ${tables.pendingPayments.length} customers`}
        />
      </div>

      {/* Charts Section */}
      <ChartsSection data={charts} />

      {/* Manager-only sections */}
      {view === 'manager' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Period Comparison */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month Sales:</span>
                <span className="font-bold text-lg">₹{metrics.thisMonth.total_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Month Sales:</span>
                <span className="font-bold text-lg">₹{metrics.lastMonth.total_sales.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-gray-600">Monthly Change:</span>
                <span className={`font-bold text-lg ${comparisons.monthVsLastMonth.sales_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {comparisons.monthVsLastMonth.sales_change >= 0 ? '+' : ''}{comparisons.monthVsLastMonth.sales_change.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Year Comparison */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Year to Date</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Sales (YTD):</span>
                <span className="font-bold text-lg">₹{metrics.thisYear.total_sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Transactions:</span>
                <span className="font-bold text-lg">{metrics.thisYear.transaction_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Bill (YTD):</span>
                <span className="font-bold text-lg">₹{metrics.thisYear.avg_bill.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopMedicinesTable medicines={tables.lowStock && tables.lowStock.slice(0, 5)} />
        <PendingPaymentsTable payments={tables.pendingPayments} />
      </div>

      {/* Low Stock Alert */}
      {tables.lowStock && tables.lowStock.length > 0 && (
        <LowStockTable medicines={tables.lowStock} />
      )}

      {/* Print-only section */}
      <div className="print-only text-center text-gray-600 mt-8 py-4 border-t">
        <p>Report generated on {new Date().toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
};

export default SalesPerformance;
