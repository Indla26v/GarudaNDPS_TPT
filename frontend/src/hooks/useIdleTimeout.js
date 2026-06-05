/**
 * GARUDA — useIdleTimeout Hook
 *
 * Monitors user activity (mouse, keyboard, scroll, touch) and triggers
 * a callback after the specified idle timeout. Used for auto-logout
 * after 15 minutes of inactivity.
 *
 * Only active when the user is authenticated.
 */
import { useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
];

/**
 * @param {Function} onIdle - Callback when idle timeout expires
 * @param {number} timeoutMs - Idle timeout in milliseconds (default: 15 minutes)
 * @param {boolean} enabled - Whether the idle timer is active
 */
export function useIdleTimeout(onIdle, timeoutMs = 15 * 60 * 1000, enabled = true) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);

  // Keep the callback ref current without re-registering events
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      // Clear any existing timer when disabled
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Start the initial timer
    resetTimer();

    // Attach activity listeners
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      // Cleanup
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [enabled, resetTimer]);
}
