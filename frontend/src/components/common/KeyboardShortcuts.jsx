/**
 * KeyboardShortcuts Component
 * Displays available keyboard shortcuts in a styled modal
 */

import React from 'react';
import { Command } from 'lucide-react';
import Modal from './Modal';

const KeyboardShortcuts = ({ isOpen, onClose }) => {
  const shortcuts = [
    { combo: 'Ctrl + N', description: 'Create new customer' },
    { combo: 'Ctrl + M', description: 'Add new medicine' },
    { combo: 'Ctrl + P', description: 'New purchase order' },
    { combo: 'Ctrl + S', description: 'Create new sale' },
    { combo: 'Ctrl + D', description: 'Go to dashboard' },
    { combo: 'Ctrl + I', description: 'Go to inventory' },
    { combo: 'Ctrl + H', description: 'Show shortcuts help' },
    { combo: 'Ctrl + E', description: 'Export data' },
    { combo: 'Ctrl + R', description: 'Refresh page' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6">
          <Command className="w-5 h-5" />
          <p className="text-sm font-medium">
            Use these keyboard shortcuts for faster navigation
          </p>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <kbd className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                           rounded font-mono text-sm font-semibold text-gray-900 dark:text-white 
                           whitespace-nowrap flex-shrink-0">
                {shortcut.combo}
              </kbd>
              <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center pt-1">
                {shortcut.description}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            💡 <strong>Tip:</strong> Shortcuts won't work while typing in input fields. Press Escape to close this dialog.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default KeyboardShortcuts;