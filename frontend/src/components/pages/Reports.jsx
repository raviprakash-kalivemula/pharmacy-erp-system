// src/components/pages/Reports.jsx - WITH TOAST NOTIFICATIONS
import React, { useState } from 'react';
import Button from '../common/Button';
import FormInput from '../common/FormInput';
import toast from '../../utils/toast';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Package,
  AlertCircle,
  Users,
  Receipt
} from 'lucide-react';
import { getTodayDate } from '../../utils/formatters';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    startDate: getTodayDate(),
    endDate: getTodayDate()
  });

  const reportTypes = [
    { 
      id: 'daily-sales',
      name: 'Daily Sales Report', 
      icon: Receipt, 
      color: 'blue',
      description: 'View daily sales transactions and revenue'
    },
    { 
      id: 'monthly-revenue',
      name: 'Monthly Revenue Report', 
      icon: TrendingUp, 
      color: 'green',
      description: 'Analyze monthly revenue trends'
    },
    { 
      id: 'inventory-valuation',
      name: 'Inventory Valuation', 
      icon: Package, 
      color: 'purple',
      description: 'Current stock value and investment'
    },
    { 
      id: 'low-stock',
      name: 'Low Stock Report', 
      icon: AlertCircle, 
      color: 'red',
      description: 'Items below minimum stock level'
    },
    { 
      id: 'customer-outstanding',
      name: 'Customer Outstanding', 
      icon: Users, 
      color: 'orange',
      description: 'Pending payments from customers'
    },
    { 
      id: 'gst-report',
      name: 'GST Report', 
      icon: FileText, 
      color: 'indigo',
      description: 'Tax summary for GST filing'
    },
    { 
      id: 'purchase-summary',
      name: 'Purchase Summary', 
      icon: DollarSign, 
      color: 'green',
      description: 'Total purchases and expenses'
    },
    { 
      id: 'expiry-report',
      name: 'Expiry Report', 
      icon: AlertCircle, 
      color: 'yellow',
      description: 'Medicines expiring soon'
    }
  ];

  const exportReport = (reportName, reportId) => {
    // Show loading toast
    const loadingToast = toast.loading(`Exporting ${reportName}...`);
    
    // Simulate API call
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success(`${reportName} exported successfully!`);
    }, 1500);
    
    console.log('Export report:', reportId, dateRange);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const exportAllData = () => {
    const loadingToast = toast.loading('Exporting all data...');
    
    // Simulate backup generation
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success('Complete database backup generated successfully!');
    }, 2000);
  };

  const generateCustomReport = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      toast.warning('Please select both start and end dates');
      return;
    }
    
    const loadingToast = toast.loading('Generating custom report...');
    
    // Simulate report generation
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success(`Report generated from ${dateRange.startDate} to ${dateRange.endDate}`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="text-blue-600" size={32} />
        <div>
          <h2 className="text-2xl font-bold">Reports & Analytics</h2>
          <p className="text-sm text-gray-600">Generate and export various business reports</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg shadow border border-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" size={24} />
          <h3 className="text-lg font-semibold text-blue-900">Custom Date Range</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Start Date"
            name="startDate"
            type="date"
            value={dateRange.startDate}
            onChange={handleDateChange}
          />
          <FormInput
            label="End Date"
            name="endDate"
            type="date"
            value={dateRange.endDate}
            onChange={handleDateChange}
          />
          <div className="flex items-end">
            <Button 
              onClick={generateCustomReport}
              variant="primary"
              icon={FileText}
              className="w-full"
            >
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-600',
            green: 'bg-green-100 text-green-600',
            purple: 'bg-purple-100 text-purple-600',
            red: 'bg-red-100 text-red-600',
            orange: 'bg-orange-100 text-orange-600',
            indigo: 'bg-indigo-100 text-indigo-600',
            yellow: 'bg-yellow-100 text-yellow-600'
          };

          const buttonColors = {
            blue: 'bg-blue-500 hover:bg-blue-600',
            green: 'bg-green-500 hover:bg-green-600',
            purple: 'bg-purple-500 hover:bg-purple-600',
            red: 'bg-red-500 hover:bg-red-600',
            orange: 'bg-orange-500 hover:bg-orange-600',
            indigo: 'bg-indigo-500 hover:bg-indigo-600',
            yellow: 'bg-yellow-500 hover:bg-yellow-600'
          };

          return (
            <div 
              key={report.id} 
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-all duration-200 border border-gray-200"
            >
              <div className={`${colorClasses[report.color]} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon size={24} />
              </div>
              <h3 className="font-semibold mb-2 text-gray-800">{report.name}</h3>
              <p className="text-sm text-gray-600 mb-4 h-10">{report.description}</p>
              <button 
                onClick={() => exportReport(report.name, report.id)}
                className={`w-full flex items-center justify-center gap-2 ${buttonColors[report.color]} text-white py-2 rounded-lg transition-colors`}
              >
                <Download size={16} /> Export
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-semibold mb-4 text-gray-800">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={generateCustomReport}
            className="flex items-center gap-3 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
          >
            <Calendar className="text-blue-600 group-hover:scale-110 transition-transform" size={24} />
            <div>
              <p className="font-medium text-gray-800">Custom Date Range Report</p>
              <p className="text-sm text-gray-600">Generate reports for specific periods</p>
            </div>
          </button>
          
          <button 
            onClick={exportAllData}
            className="flex items-center gap-3 p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left group"
          >
            <Download className="text-green-600 group-hover:scale-110 transition-transform" size={24} />
            <div>
              <p className="font-medium text-gray-800">Export All Data</p>
              <p className="text-sm text-gray-600">Complete database backup</p>
            </div>
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
        <div className="flex items-start gap-3">
          <FileText className="text-indigo-600 flex-shrink-0" size={24} />
          <div>
            <h4 className="font-semibold text-indigo-900 mb-2">📊 Report Features</h4>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>✅ Export to CSV, Excel, and PDF formats</li>
              <li>✅ Customizable date ranges for all reports</li>
              <li>✅ Real-time data from your database</li>
              <li>✅ GST-compliant reports for tax filing</li>
              <li>✅ Automated backup and archiving</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;