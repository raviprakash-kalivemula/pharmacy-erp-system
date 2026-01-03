// src/components/pages/Dashboard.jsx - UPDATED WITH SKELETON LOADERS
import React, { useEffect } from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useRealtime from '../../hooks/useRealtime';
import StatCard from '../common/StatCard';
import SkeletonLoader from '../common/SkeletonLoader';
import Phase2BDebugger from '../common/Phase2BDebugger';
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Bell, 
  AlertCircle, 
  TrendingUp, 
  Activity, 
  XCircle 
} from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '../../utils/formatters';
import toastQueue from '../../utils/toastQueue';

const Dashboard = ({ onNavigate }) => {
  const { data: stats, loading, error, refetch } = useFetch(api.getDashboard);
  
  // Real-time payment and sale updates
  const user = JSON.parse(localStorage.getItem('user')) || { id: 'unknown', username: 'User' };
  const { onPaymentReceived, onSaleCompleted } = useRealtime(user?.id, user?.username);
  
  useEffect(() => {
    if (!user?.id) return;
    
    const unsubscribePayment = onPaymentReceived?.((payment) => {
      toastQueue.success(`Payment received: Rs ${payment.amount}`);
      refetch();
    });
    
    const unsubscribeSale = onSaleCompleted?.((sale) => {
      toastQueue.success(`Sale completed: Rs ${sale.totalAmount}`);
      refetch();
    });
    
    return () => {
      unsubscribePayment?.();
      unsubscribeSale?.();
    };
  }, [user?.id, onPaymentReceived, onSaleCompleted, refetch]);

  if (loading) {
    return <SkeletonLoader type="dashboard" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow">
          <div className="flex items-start">
            <XCircle className="text-red-500 mr-3 flex-shrink-0" size={24} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <div className="space-y-2 text-sm text-red-600">
                <p>• Check if backend server is running: <code className="bg-red-100 px-2 py-1 rounded">node server.js</code></p>
                <p>• Verify database is connected</p>
                <p>• Check console for detailed error messages</p>
              </div>
              <button 
                onClick={refetch}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>

        {/* Show empty dashboard cards for reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-50">
          <StatCard 
            icon={Package} 
            title="Total Stock Items" 
            value="--" 
            color="blue" 
          />
          <StatCard 
            icon={AlertCircle} 
            title="Low Stock Alerts" 
            value="--" 
            color="red" 
          />
          <StatCard 
            icon={ShoppingCart} 
            title="Today's Sales" 
            value="--" 
            color="green" 
          />
          <StatCard 
            icon={Bell} 
            title="Pending Payments" 
            value="--" 
            color="orange" 
          />
        </div>
      </div>
    );
  }

  const {
    totalStock = 0,
    lowStock = 0,
    todaySales = 0,
    pendingPayments = 0,
    monthlyRevenue = 0,
    monthlyExpense = 0,
    profitMargin = 0,
    stockValue = 0,
    expiryingSoon = 0
  } = stats || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Package} 
          title="Total Stock Items" 
          value={totalStock} 
          color="blue" 
          onClick={() => onNavigate('inventory')}
          subtitle={`Value: ${formatCurrencyCompact(stockValue)}`}
        />
        <StatCard 
          icon={AlertCircle} 
          title="Low Stock Alerts" 
          value={lowStock} 
          color="red" 
          onClick={() => onNavigate('inventory')}
          subtitle={`${expiryingSoon} expiring soon`}
        />
        <StatCard 
          icon={ShoppingCart} 
          title="Today's Sales" 
          value={formatCurrency(todaySales)} 
          color="green" 
        />
        <StatCard 
          icon={Bell} 
          title="Pending Payments" 
          value={formatCurrency(pendingPayments)} 
          color="orange" 
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-600">Monthly Revenue</h3>
            <TrendingUp className="text-green-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(monthlyRevenue)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-600">Monthly Expenses</h3>
            <DollarSign className="text-red-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-red-600">
            {formatCurrency(monthlyExpense)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-600">Profit Margin</h3>
            <Activity className="text-blue-600" size={20} />
          </div>
          <p className="text-3xl font-bold text-blue-600">{profitMargin}%</p>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="text-red-500" />
          Low Stock & Expiry Alerts
        </h3>
        <div className="space-y-2">
          {lowStock > 0 || expiryingSoon > 0 ? (
            <>
              {lowStock > 0 && (
                <div className="flex justify-between items-center p-3 bg-red-50 rounded border-l-4 border-red-500">
                  <div>
                    <p className="font-medium text-sm">Low Stock Items</p>
                    <p className="text-xs text-gray-600">{lowStock} items need restocking</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('inventory')}
                    className="text-blue-600 text-sm font-medium hover:text-blue-700"
                  >
                    View
                  </button>
                </div>
              )}
              {expiryingSoon > 0 && (
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded border-l-4 border-yellow-500">
                  <div>
                    <p className="font-medium text-sm">Expiring Soon</p>
                    <p className="text-xs text-gray-600">{expiryingSoon} items expiring within 90 days</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('inventory')}
                    className="text-blue-600 text-sm font-medium hover:text-blue-700"
                  >
                    View
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">No alerts at the moment</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => onNavigate('billing')}
            className="p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          >
            <ShoppingCart className="text-blue-600 mb-2" size={24} />
            <p className="font-medium">Create New Bill</p>
            <p className="text-sm text-gray-600">Start billing process</p>
          </button>
          
          <button 
            onClick={() => onNavigate('purchase')}
            className="p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
          >
            <Package className="text-green-600 mb-2" size={24} />
            <p className="font-medium">Add Purchase</p>
            <p className="text-sm text-gray-600">Record new stock</p>
          </button>
          
          <button 
            onClick={() => onNavigate('inventory')}
            className="p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
          >
            <AlertCircle className="text-purple-600 mb-2" size={24} />
            <p className="font-medium">View Alerts</p>
            <p className="text-sm text-gray-600">Check stock & expiry</p>
          </button>
        </div>
      </div>

      {/* Phase 2B Real-time Debugger */}
      <Phase2BDebugger />
    </div>
  );
};

export default Dashboard;