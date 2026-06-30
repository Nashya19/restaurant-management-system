'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts(enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      // Only trigger if Ctrl or Cmd key is pressed (not Shift alone, etc)
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      // Ignore if user is typing in editable elements
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isInput = tagName === 'input' || tagName === 'textarea' || activeEl.isContentEditable;
        if (isInput) return;
      }

      const key = event.key.toLowerCase();
      let targetPath = null;

      switch (key) {
        case 'd':
          targetPath = '/dashboard';
          break;
        case 'k':
          targetPath = '/kitchen';
          break;
        case 't':
          targetPath = '/tables';
          break;
        case 'o':
          targetPath = '/orders';
          break;
        case 'm':
          targetPath = '/menu';
          break;
        case 's':
          targetPath = '/schedule';
          break;
        default:
          return; // Do nothing for other keys
      }

      if (targetPath) {
        event.preventDefault();
        router.push(targetPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, router]);
}
