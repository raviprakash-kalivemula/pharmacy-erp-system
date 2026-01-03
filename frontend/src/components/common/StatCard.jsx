// src/components/common/StatCard.jsx
import React from 'react';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = 'blue',
  subtitle,
  onClick,
  trend,
  className = ''
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500'
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`${colorClasses[color]} p-3 rounded-lg`}>
            <Icon className="text-white" size={24} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;