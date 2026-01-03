// src/hooks/useFilterPresets.js
import { useState, useEffect } from 'react';
import toast from '../utils/toast';

const STORAGE_KEY = 'filter_presets';

const useFilterPresets = (pageKey) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, [pageKey]);

  const loadPresets = () => {
    try {
      setLoading(true);
      const allPresets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      setPresets(allPresets[pageKey] || []);
    } catch (error) {
      console.error('Error loading presets:', error);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  };

  const savePreset = (name, filterData) => {
    try {
      if (!name || name.trim() === '') {
        toast.error('Preset name is required');
        return false;
      }

      const allPresets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      
      if (!allPresets[pageKey]) {
        allPresets[pageKey] = [];
      }

      // Check if preset with same name exists
      const existingIndex = allPresets[pageKey].findIndex(p => p.name === name);
      
      if (existingIndex >= 0) {
        // Update existing preset
        allPresets[pageKey][existingIndex] = {
          name,
          filters: filterData,
          updatedAt: new Date().toISOString()
        };
        toast.success(`Preset "${name}" updated`);
      } else {
        // Create new preset
        allPresets[pageKey].push({
          name,
          filters: filterData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success(`Preset "${name}" saved`);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPresets));
      loadPresets();
      return true;
    } catch (error) {
      console.error('Error saving preset:', error);
      toast.error('Failed to save preset');
      return false;
    }
  };

  const loadPresetFilters = (name) => {
    try {
      const allPresets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const pagePresets = allPresets[pageKey] || [];
      const preset = pagePresets.find(p => p.name === name);
      
      if (preset) {
        toast.info(`Loaded preset: "${name}"`);
        return preset.filters;
      }
      
      toast.error('Preset not found');
      return null;
    } catch (error) {
      console.error('Error loading preset:', error);
      toast.error('Failed to load preset');
      return null;
    }
  };

  const deletePreset = (name) => {
    try {
      const allPresets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      
      if (!allPresets[pageKey]) {
        toast.error('Preset not found');
        return false;
      }

      allPresets[pageKey] = allPresets[pageKey].filter(p => p.name !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPresets));
      loadPresets();
      toast.success(`Preset "${name}" deleted`);
      return true;
    } catch (error) {
      console.error('Error deleting preset:', error);
      toast.error('Failed to delete preset');
      return false;
    }
  };

  const clearAllPresets = () => {
    try {
      const allPresets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      delete allPresets[pageKey];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPresets));
      loadPresets();
      toast.success('All presets cleared');
      return true;
    } catch (error) {
      console.error('Error clearing presets:', error);
      toast.error('Failed to clear presets');
      return false;
    }
  };

  return {
    presets,
    loading,
    savePreset,
    loadPresetFilters,
    deletePreset,
    clearAllPresets
  };
};

export default useFilterPresets;
