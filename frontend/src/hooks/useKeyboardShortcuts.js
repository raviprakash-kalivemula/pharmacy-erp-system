/**
 * useKeyboardShortcuts Hook
 * Manages keyboard shortcuts for the application
 * Prevents shortcuts from triggering when typing in input fields
 */

import { useEffect } from 'react';

const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in input/textarea
      const isTyping = 
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.contentEditable === 'true';

      if (isTyping && !event.ctrlKey && !event.metaKey) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const { key, ctrl = false, shift = false, alt = false, callback } = shortcut;

        const keyMatch = event.key.toLowerCase() === key.toLowerCase();
        const ctrlMatch = ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = shift === event.shiftKey;
        const altMatch = alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};

export default useKeyboardShortcuts;
