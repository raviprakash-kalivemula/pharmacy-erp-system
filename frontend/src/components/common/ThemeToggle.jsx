import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../App';

/**
 * Standalone Theme Toggle Component
 * Can be used in Settings page or anywhere in the app
 */
const ThemeToggle = ({ variant = 'button', showLabel = true }) => {
  const { theme, toggleTheme } = useTheme();

  // Button variant (used in sidebar)
  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-blue-500 dark:hover:bg-gray-700"
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? (
          <Moon size={18} className="text-white" />
        ) : (
          <Sun size={18} className="text-white" />
        )}
        {showLabel && (
          <span className="text-sm text-white">
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
        )}
      </button>
    );
  }

  // Card variant (used in Settings page)
  if (variant === 'card') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {theme === 'light' ? (
                <Sun size={20} className="text-yellow-500" />
              ) : (
                <Moon size={20} className="text-blue-400" />
              )}
              Theme Preference
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose your preferred theme appearance
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Light Mode Option */}
          <button
            onClick={() => {
              if (theme !== 'light') toggleTheme();
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-yellow-100' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <Sun size={20} className={theme === 'light' ? 'text-yellow-600' : 'text-gray-600 dark:text-gray-400'} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 dark:text-gray-100">Light Mode</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Bright and clear interface</div>
            </div>
            {theme === 'light' && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </button>

          {/* Dark Mode Option */}
          <button
            onClick={() => {
              if (theme !== 'dark') toggleTheme();
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <Moon size={20} className={theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Easy on the eyes, perfect for night</div>
            </div>
            {theme === 'dark' && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Monitor size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Your theme preference is saved and will be remembered across sessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Toggle variant (switch style)
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {theme === 'light' ? 'Light' : 'Dark'} Mode
      </span>
      <button
        onClick={toggleTheme}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {theme === 'light' ? (
        <Sun size={18} className="text-yellow-500" />
      ) : (
        <Moon size={18} className="text-blue-400" />
      )}
    </div>
  );
};

export default ThemeToggle;