import React, { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { AlertTriangle, AlertCircle, Shield, TrendingUp } from 'lucide-react';

const SecurityAlerts = ({ limit = 10 }) => {
  const { data, loading, error } = useFetch(
    `/api/audit-logs/security?limit=${limit}`
  );

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading Security Alerts</h3>
          <p className="text-red-700 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  const alerts = data?.logs || [];
  const uniqueIps = new Set(alerts.map((a) => a.ip_address)).size;
  const suspiciousCount = alerts.filter((a) => {
    // Mark as suspicious if more than 3 failures from same IP in short time
    const ipFailures = alerts.filter((b) => b.ip_address === a.ip_address).length;
    return ipFailures > 3;
  }).length;

  const getSeverity = (log) => {
    const failureCount = alerts.filter((a) => a.ip_address === log.ip_address).length;
    if (failureCount > 5) return 'critical';
    if (failureCount > 3) return 'high';
    return 'medium';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Failed Attempts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{alerts.length}</p>
            </div>
            <AlertTriangle className="text-red-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Unique IPs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{uniqueIps}</p>
            </div>
            <Shield className="text-yellow-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Suspicious IPs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {Math.max(0, new Set(
                  alerts
                    .filter((a) => alerts.filter((b) => b.ip_address === a.ip_address).length > 3)
                    .map((a) => a.ip_address)
                ).size)}
              </p>
            </div>
            <TrendingUp className="text-orange-600" size={24} />
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-white rounded-lg shadow">
        {alerts.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {alerts.map((alert, idx) => {
              const severity = getSeverity(alert);
              const severityColor = {
                critical: 'bg-red-50 border-l-4 border-red-500',
                high: 'bg-orange-50 border-l-4 border-orange-500',
                medium: 'bg-yellow-50 border-l-4 border-yellow-500',
              };

              const username = typeof alert.user_id === 'object' ? alert.user_id.username : 'Unknown';
              const failuresFromIP = alerts.filter((a) => a.ip_address === alert.ip_address).length;

              return (
                <div key={idx} className={`p-4 ${severityColor[severity]}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {alert.action === 'LOGIN_FAILED'
                            ? 'Failed Login Attempt'
                            : 'Unauthorized Access'}
                        </h4>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          severity === 'critical'
                            ? 'bg-red-200 text-red-800'
                            : severity === 'high'
                            ? 'bg-orange-200 text-orange-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {severity.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-gray-600">User</p>
                          <p className="font-mono text-gray-900">{username}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">IP Address</p>
                          <p className="font-mono text-gray-900">{alert.ip_address}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Time</p>
                          <p className="text-gray-900">{formatTime(alert.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">From This IP</p>
                          <p className={`font-semibold ${failuresFromIP > 3 ? 'text-red-600' : 'text-gray-900'}`}>
                            {failuresFromIP} attempt{failuresFromIP !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {failuresFromIP > 3 && (
                        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                          ⚠️ Suspicious activity detected: Multiple failed attempts from this IP address
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Shield size={32} className="mx-auto mb-2 opacity-50" />
            <p>No security alerts found</p>
            <p className="text-xs text-gray-400 mt-1">Good job! No unauthorized access attempts detected.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAlerts;
