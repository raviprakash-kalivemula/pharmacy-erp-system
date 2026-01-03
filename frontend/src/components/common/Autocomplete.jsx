// src/components/common/Autocomplete.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../App';

const Autocomplete = ({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = 'Search...',
  disabled = false,
  loading = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    onChange(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen && suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        setIsOpen(true);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        setIsOpen(false);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    onChange(suggestion);
    if (onSelect) {
      onSelect(suggestion);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={inputRef}>
      <div className={`relative flex items-center border rounded-lg ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'}`}>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 outline-none ${isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        {loading && (
          <div className="px-3 animate-spin">
            <div className={`w-4 h-4 border-2 border-t-transparent rounded-full ${isDark ? 'border-blue-400' : 'border-blue-500'}`} />
          </div>
        )}
        {!loading && suggestions.length > 0 && (
          <ChevronDown 
            size={20} 
            className={`px-2 transition-transform ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-10 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <ul className="max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full text-left px-4 py-2 transition-colors ${
                    index === highlightedIndex
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-gray-900'
                      : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
