/**
 * SalesReport Component
 * Displays sales analytics with daily, monthly, and yearly breakdowns
 * Features: Date filtering, report type selection, CSV export, summary metrics
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, FileText } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import useModal from '../../hooks/useModal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Table from '../common/Table';
import SkeletonLoader from '../common/SkeletonLoader';
import { showSuccess, showWarning, showError } from '../../utils/toast';
import api from '../../api'; // Import api service for manual calls

const SalesReport = () => {
  // ... (state) ...
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalItems: 0,
    totalProfit: 0,
    totalTransactions: 0,
    averageOrderValue: 0
  });

  const { isOpen, open, close } = useModal();
  const { data, loading, error } = useFetch(`/api/reports/sales?type=${reportType}&startDate=${startDate}&endDate=${endDate}`);

  useEffect(() => {
    // ... (effect) ...
    if (data) {
      setReportData(data.transactions || []);
      setSummary({
        totalRevenue: data.totalRevenue || 0,
        totalItems: data.totalItems || 0,
        totalProfit: data.totalProfit || 0,
        totalTransactions: data.totalTransactions || 0,
        averageOrderValue: data.totalTransactions ? (data.totalRevenue / data.totalTransactions).toFixed(2) : 0
      });
    }
  }, [data]);

  const handleExportPDF = async () => {
    try {
      showSuccess('Generating PDF...');
      const response = await api.get('/reports/sales/pdf', {
        params: { startDate, endDate },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales-report-${startDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('PDF Downloaded successfully');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showError('Failed to export PDF');
    }
  };

  const handleExportCSV = () => {
    // ... (rest of csv logic) ...

    if (!reportData || reportData.length === 0) {
      showWarning('No data to export');
      return;
    }

    const csv = [
      ['Sales Report - ' + reportType.toUpperCase()],
      ['Period:', `${formatDate(startDate)} to ${formatDate(endDate)}`],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Total Revenue', formatCurrency(summary.totalRevenue)],
      ['Total Items Sold', summary.totalItems],
      ['Total Profit', formatCurrency(summary.totalProfit)],
      ['Total Transactions', summary.totalTransactions],
      ['Average Order Value', formatCurrency(summary.averageOrderValue)],
      [],
      ['Transaction Details'],
      ['Date', 'Customer', 'Items', 'Subtotal', 'Tax', 'Total', 'Profit']
    ];

    reportData.forEach(transaction => {
      csv.push([
        formatDateTime(transaction.createdAt),
        transaction.customerName || 'N/A',
        transaction.itemCount || 0,
        formatCurrency(transaction.subtotal || 0),
        formatCurrency(transaction.tax || 0),
        formatCurrency(transaction.total || 0),
        formatCurrency(transaction.profit || 0)
      ]);
    });

    const csvContent = csv.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${reportType}-${startDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccess('Report exported successfully');
  };

  const columns = [
    { header: 'Date', key: 'createdAt', render: (val) => formatDateTime(val) },
    { header: 'Customer', key: 'customerName' },
    { header: 'Items', key: 'itemCount' },
    { header: 'Subtotal', key: 'subtotal', render: (val) => formatCurrency(val) },
    { header: 'Tax', key: 'tax', render: (val) => formatCurrency(val) },
    { header: 'Total', key: 'total', render: (val) => formatCurrency(val) },
    { header: 'Profit', key: 'profit', render: (val) => formatCurrency(val) }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Report</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleExportCSV}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleExportPDF}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Items Sold</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
            {summary.totalItems}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {formatCurrency(summary.totalProfit)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Transactions</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">
            {summary.totalTransactions}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Order</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-2">
            {formatCurrency(summary.averageOrderValue)}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Transaction Details
        </h2>

        {loading ? (
          <div className="space-y-2">
            <SkeletonLoader count={5} />
          </div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 p-4">
            Error loading sales data: {error}
          </div>
        ) : reportData && reportData.length > 0 ? (
          <Table columns={columns} data={reportData} />
        ) : (
          <div className="text-gray-500 dark:text-gray-400 p-4 text-center">
            No sales data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesReport;
