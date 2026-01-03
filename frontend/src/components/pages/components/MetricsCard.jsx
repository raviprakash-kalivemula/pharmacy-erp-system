import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MetricsCard = ({ title, value, type = 'number', change = null, icon: Icon, color = 'blue', compareText }) => {
  const isPositive = change >= 0;
  const formatValue = () => {
    if (type === 'currency') {
      return `₹${typeof value === 'number' ? value.toFixed(2) : '0.00'}`;
    }
    return typeof value === 'number' ? value.toLocaleString() : value;
  };

  const getColorClasses = () => {
    if (color === 'warning') return 'bg-orange-50 border-orange-200';
    if (color === 'success') return 'bg-green-50 border-green-200';
    if (color === 'danger') return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getIconColorClasses = () => {
    if (color === 'warning') return 'text-orange-500';
    if (color === 'success') return 'text-green-500';
    if (color === 'danger') return 'text-red-500';
    return 'text-blue-500';
  };

  return (
    <div className={`border rounded-lg p-6 ${getColorClasses()} transition hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        {Icon && <Icon size={20} className={getIconColorClasses()} />}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-bold text-gray-900">
          {formatValue()}
        </span>
        {change !== null && change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      {compareText && (
        <p className="text-xs text-gray-600 mt-3 pt-2 border-t border-gray-200">
          {compareText}
        </p>
      )}
    </div>
  );
};

export default MetricsCard;
