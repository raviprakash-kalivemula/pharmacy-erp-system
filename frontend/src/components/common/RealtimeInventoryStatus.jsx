/**
 * RealtimeInventoryStatus Component
 * Displays live inventory changes and stock alerts
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { useRealtime } from '../../hooks/useRealtime';
import { useAuth } from '../../hooks/useAuth';
import toastQueue from '../../utils/toastQueue';

const RealtimeInventoryStatus = () => {
  const { user } = useAuth();
  const { isConnected, onLowStockAlert, onInventoryUpdate } = useRealtime(
    user?.id,
    user?.username
  );

  const [recentUpdates, setRecentUpdates] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    if (!user) return;

    // Listen to inventory updates
    const unsubscribeUpdate = onInventoryUpdate((data) => {
      setRecentUpdates(prev => [
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'update',
          medicineId: data.medicineId,
          changedBy: data.changedBy,
          timestamp: new Date(),
          severity: 'info'
        },
        ...prev.slice(0, 9) // Keep last 10 updates
      ]);
    });

    // Listen to low stock alerts
    const unsubscribeLowStock = onLowStockAlert((data) => {
      const isCritical = data.severity === 'critical';

      setLowStockItems(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(
          item => item.medicineId === data.medicineId
        );

        if (existingIndex >= 0) {
          updated[existingIndex] = { ...data, id: data.medicineId };
        } else {
          updated.push({ ...data, id: data.medicineId });
        }

        return updated;
      });

      // Show toast notification
      const message = isCritical
        ? `CRITICAL: ${data.name} is out of stock!`
        : `LOW STOCK: ${data.name} (${data.currentStock} remaining)`;

      toastQueue[isCritical ? 'error' : 'warning'](message, {
        duration: isCritical ? 5000 : 3500
      });

      // Add to recent updates
      setRecentUpdates(prev => [
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'lowStock',
          medicineId: data.medicineId,
          name: data.name,
          severity: data.severity,
          timestamp: new Date(),
          currentStock: data.currentStock,
          minimumStock: data.minimumStock
        },
        ...prev.slice(0, 9)
      ]);
    });

    return () => {
      unsubscribeUpdate?.();
      unsubscribeLowStock?.();
    };
  }, [user, onInventoryUpdate, onLowStockAlert]);

  // Update connection status
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected]);

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div
        className={`p-3 rounded-lg border flex items-center gap-2 ${
          isConnected
            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
          }`}
        />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
          Real-time: {connectionStatus}
        </span>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
            Stock Alerts ({lowStockItems.length})
          </h4>
          {lowStockItems.map(item => (
            <div
              key={item.id}
              className={`p-2 rounded border-l-4 text-xs ${
                item.severity === 'critical'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
              }`}
            >
              <div className="flex items-start gap-2">
                {item.severity === 'critical' ? (
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    Stock: {item.currentStock} / Min: {item.minimumStock}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
            Live Updates
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {recentUpdates.map(update => (
              <div
                key={update.id}
                className="p-2 rounded text-xs bg-gray-50 dark:bg-gray-800 flex items-center gap-2"
              >
                {update.type === 'lowStock' ? (
                  <AlertTriangle
                    className={`w-3 h-3 flex-shrink-0 ${
                      update.severity === 'critical'
                        ? 'text-red-500'
                        : 'text-yellow-500'
                    }`}
                  />
                ) : (
                  <TrendingUp className="w-3 h-3 flex-shrink-0 text-blue-500" />
                )}
                <span className="flex-1 text-gray-600 dark:text-gray-300">
                  {update.type === 'lowStock'
                    ? `${update.name} low stock`
                    : `Inventory updated`}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {update.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {lowStockItems.length === 0 && recentUpdates.length === 0 && (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <CheckCircle className="w-5 h-5 mx-auto mb-2 opacity-50" />
          <p>All inventory levels normal</p>
        </div>
      )}
    </div>
  );
};

export default RealtimeInventoryStatus;
