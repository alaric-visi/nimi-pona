import { useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Exercise-local keyboard shortcuts. Ignores typing in inputs (except Enter is left
 * to forms), modified keys, key repeat and anything while a dialog is open.
 * Return true from the handler to mark the key handled.
 */
export function useKeys(handler: (e: KeyboardEvent, onButton: boolean) => boolean | void) {
  const ref = useRef(handler);
  ref.current = handler;
  // layout effect: the shortcut is live as soon as the element is on screen,
  // so a fast Enter right after an answer is never lost
  useLayoutEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.querySelector('dialog[open]')) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (ref.current(e, !!target?.closest('button'))) e.preventDefault();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

/** Digit key → zero-based index, or -1. */
export const digit = (e: KeyboardEvent) => (/^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1);
