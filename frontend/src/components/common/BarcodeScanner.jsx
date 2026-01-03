// frontend/src/components/common/BarcodeScanner.jsx - WORKING VERSION
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

/**
 * Camera-based barcode scanner component
 * Supports: EAN-13, EAN-8, Code-128, Code-39, UPC, QR codes
 */
const BarcodeScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Success callback
    const onScanSuccess = (decodedText) => {
      console.log('Barcode detected:', decodedText);
      setIsScanning(false);
      
      // Stop scanner
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
      
      // Call parent callback
      if (onScan) {
        onScan(decodedText);
      }
    };

    // Error callback - only log meaningful errors
    const onScanError = (err) => {
      // Ignore continuous scanning errors (normal behavior)
      if (!err.includes('NotFoundException') && !err.includes('No MultiFormat Readers')) {
        console.warn('Scanner error:', err);
      }
    };

    try {
      // Initialize scanner with simple config
      const scanner = new Html5QrcodeScanner(
        'barcode-scanner-container',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          // By default, supports all formats: EAN-13, EAN-8, Code-128, QR, etc.
        },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanError);
      scannerRef.current = scanner;
      setIsScanning(true);
    } catch (err) {
      console.error('Failed to initialize scanner:', err);
      setError('Failed to initialize camera. Please check camera permissions.');
    }

    // Cleanup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Camera className="text-blue-600 dark:text-blue-400" size={24} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Scan Barcode
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close scanner"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Scanner Container */}
        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div>
              {/* Scanner will be rendered here */}
              <div id="barcode-scanner-container" className="w-full"></div>

              {/* Instructions */}
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  📸 How to scan:
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Hold your device steady</li>
                  <li>• Point camera at barcode</li>
                  <li>• Ensure good lighting</li>
                  <li>• Wait for automatic detection</li>
                </ul>
              </div>

              {isScanning && (
                <div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Camera active - Ready to scan</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Supports EAN-13, EAN-8, Code-128, QR codes
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;