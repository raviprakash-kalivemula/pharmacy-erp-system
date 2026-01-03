// src/hooks/useSearch.js
import { useState, useEffect } from 'react';

const useSearch = (data = [], apiSearchFunction = null, searchFields = [], suggestionFields = []) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, data]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setFilteredData(data);
      setSuggestions([]);
      return;
    }

    // Generate suggestions
    generateSuggestions();

    // If API search function exists, use it
    if (apiSearchFunction) {
      try {
        setLoading(true);
        const response = await apiSearchFunction(searchTerm);
        setFilteredData(response.data);
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to client-side search
        performClientSearch();
      } finally {
        setLoading(false);
      }
    } else {
      // Client-side search
      performClientSearch();
    }
  };

  const performClientSearch = () => {
    const term = searchTerm.toLowerCase();
    const filtered = data.filter(item => {
      // If search fields specified, search only those
      if (searchFields.length > 0) {
        return searchFields.some(field => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return value.toString().toLowerCase().includes(term);
        });
      }
      
      // Otherwise search all string fields
      return Object.values(item).some(value => {
        if (value === null || value === undefined) return false;
        return value.toString().toLowerCase().includes(term);
      });
    });
    setFilteredData(filtered);
  };

  const generateSuggestions = () => {
    if (!searchTerm.trim() || data.length === 0) {
      setSuggestions([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const fieldsToCheck = suggestionFields.length > 0 ? suggestionFields : searchFields;
    
    if (fieldsToCheck.length === 0) {
      setSuggestions([]);
      return;
    }

    // Extract unique suggestions from specified fields
    const uniqueSuggestions = new Set();
    
    data.forEach(item => {
      fieldsToCheck.forEach(field => {
        const value = item[field];
        if (value && value.toString().toLowerCase().includes(term)) {
          uniqueSuggestions.add(value.toString());
        }
      });
    });

    // Return top 5 suggestions
    setSuggestions(Array.from(uniqueSuggestions).slice(0, 5));
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilteredData(data);
    setSuggestions([]);
  };

  const selectSuggestion = (suggestion) => {
    setSearchTerm(suggestion);
  };

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    suggestions,
    loading,
    clearSearch,
    selectSuggestion
  };
};

export default useSearch;