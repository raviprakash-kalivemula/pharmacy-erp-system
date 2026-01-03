/**
 * useTheme Hook
 * Custom hook to access theme context
 * Returns: { theme, toggleTheme, isDark }
 */

import { useContext, createContext } from 'react';

// This will be provided by App.js ThemeProvider
export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  
  // Add isDark property for convenience
  return {
    ...context,
    isDark: context.theme === 'dark'
  };
};

export default useTheme;
