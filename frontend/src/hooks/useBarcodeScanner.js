// frontend/src/hooks/useBarcodeScanner.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for barcode scanner detection
 * Handles keyboard wedge barcode scanners (most common type)
 * 
 * How it works:
 * - Barcode scanners type very fast (< 50ms between characters)
 * - Regular typing is slower (> 50ms between characters)
 * - Detects rapid input and triggers onScan callback
 */
const useBarcodeScanner = ({ 
  onScan, 
  minLength = 3, 
  maxLength = 20,
  timeout = 50,
  enabled = true,
  preventDefault = true 
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const bufferRef = useRef('');
  const timerRef = useRef(null);
  const lastKeyTimeRef = useRef(Date.now());

  const reset = useCallback(() => {
    bufferRef.current = '';
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const processBarcode = useCallback((code) => {
    const trimmedCode = code.trim();
    
    // Validate barcode length
    if (trimmedCode.length >= minLength && trimmedCode.length <= maxLength) {
      setLastScannedCode(trimmedCode);
      setIsScanning(false);
      
      if (onScan) {
        onScan(trimmedCode);
      }
      
      // Play success sound (optional)
      if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }
    }
    
    reset();
  }, [minLength, maxLength, onScan, reset]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (event) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Ignore if user is typing in an input field (unless we want to override)
      const target = event.target;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      // Skip if typing in input and we're not overriding
      if (isInputField && !target.dataset.allowBarcode) {
        return;
      }

      // Check if this is likely a scanner (fast input)
      const isLikelyScanner = timeDiff < timeout;

      // Enter key signals end of barcode
      if (event.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          if (preventDefault) {
            event.preventDefault();
          }
          processBarcode(bufferRef.current);
        }
        return;
      }

      // Ignore special keys
      if (event.key.length > 1 && event.key !== 'Enter') {
        return;
      }

      // If this looks like scanner input
      if (isLikelyScanner || bufferRef.current.length > 0) {
        if (preventDefault && !isInputField) {
          event.preventDefault();
        }
        
        setIsScanning(true);
        bufferRef.current += event.key;

        // Clear existing timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // Set new timer to process if no more input
        timerRef.current = setTimeout(() => {
          if (bufferRef.current.length > 0) {
            processBarcode(bufferRef.current);
          }
        }, timeout * 2);
      }
    };

    // Add event listener
    document.addEventListener('keypress', handleKeyPress);

    // Cleanup
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
      reset();
    };
  }, [enabled, timeout, preventDefault, processBarcode, reset]);

  return {
    isScanning,
    lastScannedCode,
    reset
  };
};

export default useBarcodeScanner;