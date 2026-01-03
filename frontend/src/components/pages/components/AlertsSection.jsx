import React from 'react';
import { AlertCircle, TrendingDown } from 'lucide-react';

const AlertsSection = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`border-l-4 rounded-lg p-4 flex gap-3 ${
            alert.type === 'critical'
              ? 'border-red-500 bg-red-50'
              : alert.type === 'warning'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-green-500 bg-green-50'
          }`}
        >
          <div className="flex-shrink-0 text-2xl">
            {alert.icon}
          </div>
          <div className="flex-grow">
            <p className={`font-semibold ${
              alert.type === 'critical' ? 'text-red-900' :
              alert.type === 'warning' ? 'text-yellow-900' :
              'text-green-900'
            }`}>
              {alert.message}
            </p>
            <p className={`text-sm ${
              alert.type === 'critical' ? 'text-red-700' :
              alert.type === 'warning' ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {alert.category.toUpperCase()} ALERT
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AlertsSection;
