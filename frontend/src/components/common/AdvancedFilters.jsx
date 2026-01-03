// src/components/common/AdvancedFilters.jsx
import React, { useState } from 'react';
import { Search, Filter, X, Download, RotateCcw, Save, Bookmark } from 'lucide-react';
import useFilterPresets from '../../hooks/useFilterPresets';
import toast from '../../utils/toast';

const AdvancedFilters = ({ 
  onFilter, 
  onExport, 
  filters: initialFilters = {},
  filterOptions = {},
  pageKey = 'default'
}) => {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    category: 'all',
    ...initialFilters
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState('');
  
  const { presets, savePreset, loadPresetFilters, deletePreset } = useFilterPresets(pageKey);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...filters, [name]: value };
    setFilters(updated);
    onFilter(updated);
  };

  const handleReset = () => {
    const reset = {
      search: '',
      dateFrom: '',
      dateTo: '',
      status: 'all',
      category: 'all'
    };
    setFilters(reset);
    onFilter(reset);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('Preset name is required');
      return;
    }
    savePreset(presetName, filters);
    setPresetName('');
    setShowPresetMenu(false);
  };

  const handleLoadPreset = (name) => {
    const loadedFilters = loadPresetFilters(name);
    if (loadedFilters) {
      setFilters(loadedFilters);
      onFilter(loadedFilters);
      setShowPresetMenu(false);
    }
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => 
    key !== 'search' && value && value !== 'all'
  ).length;

  return (
    <div className="bg-white rounded-lg shadow space-y-4">
      {/* Main search bar */}
      <div className="p-4 border-b">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleChange}
              placeholder={filterOptions.searchPlaceholder || "Search..."}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {filters.search && (
              <button
                onClick={() => handleChange({ target: { name: 'search', value: '' } })}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showAdvanced || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Presets button */}
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                presets.length > 0
                  ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                  : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Bookmark size={18} />
              <span className="hidden sm:inline">Presets</span>
              {presets.length > 0 && (
                <span className="bg-purple-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {presets.length}
                </span>
              )}
            </button>

            {/* Preset menu dropdown */}
            {showPresetMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20">
                <div className="p-3 space-y-2">
                  {/* Save new preset */}
                  <div className="border-b pb-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Preset name..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                        onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
                      />
                      <button
                        onClick={handleSavePreset}
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="Save preset"
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Existing presets */}
                  {presets.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {presets.map((preset) => (
                        <div key={preset.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <button
                            onClick={() => handleLoadPreset(preset.name)}
                            className="flex-1 text-left text-sm font-medium text-gray-700 hover:text-blue-600"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.name)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Delete preset"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">No presets saved yet</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Date From
              </label>
              <input
                type="date"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Date To
              </label>
              <input
                type="date"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            {filterOptions.statusOptions && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Status
                </label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  {filterOptions.statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Filter */}
            {filterOptions.categoryOptions && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Category
                </label>
                <select
                  name="category"
                  value={filters.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {filterOptions.categoryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Button */}
            <div className="md:col-span-4 flex justify-end">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <RotateCcw size={16} />
                Reset Filters
              </button>
            </div>
          </div>

          {/* Active filters display */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {Object.entries(filters).map(([key, value]) => {
                if (!value || value === 'all' || key === 'search') return null;
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {key}: {value}
                    <button
                      onClick={() => handleChange({ target: { name: key, value: key === 'status' || key === 'category' ? 'all' : '' } })}
                      className="hover:text-blue-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;