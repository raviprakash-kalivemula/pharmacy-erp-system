import React, { useState } from 'react';
import { Calendar, Filter, RotateCcw } from 'lucide-react';

const AuditFilters = ({ onFiltersChange = () => {} }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    entityType: '',
  });

  const actions = [
    { value: 'CREATE', label: '➕ Create' },
    { value: 'UPDATE', label: '✏️ Update' },
    { value: 'DELETE', label: '🗑️ Delete' },
    { value: 'LOGIN', label: '🔐 Login' },
    { value: 'LOGOUT', label: '🚪 Logout' },
  ];

  const entityTypes = [
    { value: 'medicines', label: 'Medicines' },
    { value: 'customers', label: 'Customers' },
    { value: 'suppliers', label: 'Suppliers' },
    { value: 'sales', label: 'Sales' },
    { value: 'purchases', label: 'Purchases' },
    { value: 'users', label: 'Users' },
    { value: 'reports', label: 'Reports' },
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handlePreset = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    let newFilters = { ...filters };

    switch (preset) {
      case 'today':
        newFilters.startDate = today.toISOString().split('T')[0];
        newFilters.endDate = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        newFilters.startDate = startDate.toISOString().split('T')[0];
        newFilters.endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        newFilters.startDate = startDate.toISOString().split('T')[0];
        newFilters.endDate = today.toISOString().split('T')[0];
        break;
      case 'quarter':
        startDate.setDate(startDate.getDate() - 90);
        newFilters.startDate = startDate.toISOString().split('T')[0];
        newFilters.endDate = today.toISOString().split('T')[0];
        break;
      default:
        break;
    }

    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters = {
      startDate: '',
      endDate: '',
      userId: '',
      action: '',
      entityType: '',
    };
    setFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handlePreset('today')}
          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
            filters.startDate === new Date().toISOString().split('T')[0]
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => handlePreset('week')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Last 7 Days
        </button>
        <button
          onClick={() => handlePreset('month')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Last 30 Days
        </button>
        <button
          onClick={() => handlePreset('quarter')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Last 90 Days
        </button>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              Start Date
            </div>
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              End Date
            </div>
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Action</label>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </div>

        {/* Entity Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type</label>
          <select
            value={filters.entityType}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Entities</option>
            {entityTypes.map((entity) => (
              <option key={entity.value} value={entity.value}>
                {entity.label}
              </option>
            ))}
          </select>
        </div>

        {/* User ID (optional - could be populated from user list) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">User (ID or Name)</label>
          <input
            type="text"
            placeholder="Filter by user..."
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Active Filters Display */}
      {Object.values(filters).some((v) => v) && (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Active filters:
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.startDate && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  Start: {filters.startDate}
                  <button
                    onClick={() => handleFilterChange('startDate', '')}
                    className="hover:text-blue-900 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  End: {filters.endDate}
                  <button
                    onClick={() => handleFilterChange('endDate', '')}
                    className="hover:text-blue-900 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              {filters.action && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  Action: {filters.action}
                  <button
                    onClick={() => handleFilterChange('action', '')}
                    className="hover:text-green-900 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              {filters.entityType && (
                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                  Entity: {filters.entityType}
                  <button
                    onClick={() => handleFilterChange('entityType', '')}
                    className="hover:text-purple-900 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              {filters.userId && (
                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                  User: {filters.userId}
                  <button
                    onClick={() => handleFilterChange('userId', '')}
                    className="hover:text-yellow-900 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditFilters;
