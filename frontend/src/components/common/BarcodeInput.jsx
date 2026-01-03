import React, { useState } from 'react';
import { Search, Camera, Barcode, Loader } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';

/**
 * Enhanced input field with barcode scanning capabilities
 * Supports both keyboard wedge scanners and camera scanning
 */
const BarcodeInput = ({
  value,
  onChange,
  onBarcodeDetected,
  placeholder = 'Search or scan barcode...',
  className = '',
  disabled = false,
  showCameraButton = true,
  autoFocus = false
}) => {
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle keyboard wedge barcode scanner
  const { isScanning } = useBarcodeScanner({
    onScan: async (code) => {
      setIsProcessing(true);
      
      // Call the barcode detected callback
      if (onBarcodeDetected) {
        await onBarcodeDetected(code);
      }
      
      setIsProcessing(false);
    },
    enabled: !disabled,
    minLength: 3,
    maxLength: 20,
    timeout: 50,
    preventDefault: false
  });

  // Handle camera scan
  const handleCameraScan = async (code) => {
    setIsProcessing(true);
    setShowScanner(false);
    
    if (onBarcodeDetected) {
      await onBarcodeDetected(code);
    }
    
    setIsProcessing(false);
  };

  return (
    <>
      <div className="relative">
        {/* Input field */}
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || isProcessing}
            autoFocus={autoFocus}
            data-allow-barcode="true"
            className={`
              w-full px-4 py-2 pr-24 
              border border-gray-300 dark:border-gray-600 
              rounded-lg 
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-gray-900 dark:text-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
              ${isScanning ? 'ring-2 ring-blue-500 border-blue-500' : ''}
              ${className}
            `}
          />
          
          {/* Search icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>

          {/* Right side indicators and buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs mr-1">
                <Loader size={14} className="animate-spin" />
                <span className="hidden sm:inline">Processing...</span>
              </div>
            )}

            {/* Scanning indicator */}
            {isScanning && !isProcessing && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs mr-1 animate-pulse">
                <Barcode size={14} />
                <span className="hidden sm:inline">Scanning...</span>
              </div>
            )}

            {/* Camera scan button */}
            {showCameraButton && !isProcessing && (
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={disabled}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Scan with camera"
              >
                <Camera size={18} />
              </button>
            )}

            {/* Barcode icon indicator */}
            {!isScanning && !isProcessing && (
              <div 
                className="p-1.5 text-gray-400 dark:text-gray-600"
                title="Barcode scanner ready"
              >
                <Barcode size={18} />
              </div>
            )}
          </div>
        </div>

        {/* Help text */}
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Barcode size={12} />
          <span>Type to search or scan barcode directly</span>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
};

export default BarcodeInput;