// src/components/common/Modal.jsx
import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../App';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showFooter = true,
  footerContent,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-4'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg w-full ${sizes[size]} max-h-[90vh] flex flex-col ${isDark ? 'bg-gray-800' : 'bg-white'} ${className}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-4 border-b flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button
            data-modal-close
            onClick={onClose}
            className={`rounded p-1 transition-colors ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={`p-6 overflow-y-auto flex-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div className={`border-t p-4 flex justify-end gap-2 flex-shrink-0 ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
            {footerContent || (
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg transition-colors ${isDark ? 'border border-gray-600 hover:bg-gray-700 text-gray-100' : 'border border-gray-300 hover:bg-gray-50'}`}
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;