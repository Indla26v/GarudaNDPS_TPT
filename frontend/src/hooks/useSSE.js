/**
 * GARUDA — useSSE Hook
 * 
 * Manages a Server-Sent Events connection for real-time dashboard updates.
 * Automatically reconnects on disconnection with exponential backoff.
 * 
 * Usage:
 *   const { lastEvent, isConnected } = useSSE();
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const SSE_URL = '/api/sse/connect';
const MAX_RETRY_DELAY = 30000; // 30 seconds max

export function useSSE() {
  const [lastEvent, setLastEvent] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('garuda_access_token');
    if (!token) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // EventSource doesn't support custom headers natively,
    // so we pass the token as a query parameter
    const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

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

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY);
      retryCountRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    eventSourceRef.current = es;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [connect]);

  return { lastEvent, isConnected };
}
