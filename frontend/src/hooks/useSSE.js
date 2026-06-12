/**
 * GARUDA — useSSE Hook
 * 
 * Manages a Server-Sent Events connection for real-time dashboard updates.
 * Automatically reconnects on disconnection with exponential backoff.
 * Uses Page Visibility API to pause/resume connections when the tab is idle.
 * 
 * Usage:
 *   const { lastEvent, isConnected } = useSSE();
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const SSE_URL = '/api/sse/connect';
const MAX_RETRY_DELAY = 30000; // 30 seconds max
const MAX_RETRIES = 10; // Stop retrying after 10 consecutive failures
const IDLE_PAUSE_MS = 2 * 60 * 1000; // Pause SSE after 2 min of tab hidden

export function useSSE() {
  const [lastEvent, setLastEvent] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const pausedRef = useRef(false);
  const hiddenSinceRef = useRef(null);

  const disconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    // Don't reconnect if paused (tab hidden for too long)
    if (pausedRef.current) return;

    // Close existing connection
    disconnect();

    // ── SECURITY FIX #4 & #12: Use HttpOnly Cookie for SSE Authentication
    // EventSource with `withCredentials: true` automatically sends the HttpOnly cookie,
    // avoiding the need to expose the JWT in the URL query string.
    const es = new EventSource(SSE_URL, { withCredentials: true });

    es.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
      } catch (err) {
        console.warn('SSE: failed to parse event data', err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();

      // Stop retrying after max attempts to prevent flooding
      if (retryCountRef.current >= MAX_RETRIES) {
        console.warn('SSE: max retries reached, stopping reconnection');
        pausedRef.current = true;
        return;
      }

      // Don't retry if tab is hidden
      if (document.visibilityState === 'hidden') {
        pausedRef.current = true;
        return;
      }

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY);
      retryCountRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    eventSourceRef.current = es;
  }, [disconnect]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const idleMs = hiddenSinceRef.current
          ? Date.now() - hiddenSinceRef.current
          : 0;
        hiddenSinceRef.current = null;

        // If tab was hidden for a long time, the SSE connection is likely dead.
        // Reconnect once (reset retry count for a fresh start).
        if (idleMs > IDLE_PAUSE_MS || pausedRef.current) {
          pausedRef.current = false;
          retryCountRef.current = 0;
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connect]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { lastEvent, isConnected };
}
