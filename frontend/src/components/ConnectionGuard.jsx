import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const WAKE_URL = `${import.meta.env.VITE_API_BASE_URL || '/api'}/wake`;
const MAX_ATTEMPTS = 4;
const BASE_DELAY = 1500; // 1.5s, 3s, 6s, 12s

/**
 * ConnectionGuard wraps the app and ensures the backend (and Neon DB)
 * are awake before rendering children. Shows a branded loading screen
 * during cold starts and a retry UI if the server is unreachable.
 */
export default function ConnectionGuard({ children }) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0);
  const [latency, setLatency] = useState(null);
  const mountedRef = useRef(true);

  const wakeBackend = useCallback(async () => {
    setStatus('connecting');

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (!mountedRef.current) return;
      setAttempt(i + 1);

      try {
        const res = await axios.get(WAKE_URL, { timeout: 15000 });
        if (res.data?.dbReady) {
          setLatency(res.data.latencyMs);
          setStatus('ready');
          return;
        }
      } catch (err) {
        console.warn(`[ConnectionGuard] Wake attempt ${i + 1}/${MAX_ATTEMPTS} failed`);
      }

      if (i < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, BASE_DELAY * Math.pow(2, i)));
      }
    }

    if (mountedRef.current) {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    wakeBackend();
    return () => { mountedRef.current = false; };
  }, [wakeBackend]);

  // Re-wake when tab becomes visible after being hidden
  useEffect(() => {
    let hiddenSince = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenSince) {
        const idleMs = Date.now() - hiddenSince;
        hiddenSince = null;
        // Re-wake if tab was hidden for more than 5 minutes
        if (idleMs > 5 * 60 * 1000) {
          wakeBackend();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [wakeBackend]);

  if (status === 'ready') {
    return children;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Garuda logo / shield */}
        <div style={styles.logoContainer}>
          <svg style={styles.logo} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 4L8 20v24l24 16 24-16V20L32 4z" fill="url(#shieldGrad)" opacity="0.15" stroke="url(#shieldGrad)" strokeWidth="2"/>
            <path d="M32 16l-12 8v12l12 8 12-8V24L32 16z" fill="url(#shieldGrad)" opacity="0.3"/>
            <path d="M32 24l-6 4v6l6 4 6-4v-6l-6-4z" fill="url(#shieldGrad)"/>
            <defs>
              <linearGradient id="shieldGrad" x1="8" y1="4" x2="56" y2="60">
                <stop stopColor="#6366f1"/>
                <stop offset="1" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 style={styles.title}>GARUDA NDPS</h2>
        <p style={styles.subtitle}>
          Narcotics Intelligence Management System
        </p>

        {status === 'connecting' && (
          <>
            <div style={styles.spinnerContainer}>
              <div style={styles.spinner}></div>
            </div>
            <p style={styles.statusText}>
              Waking up server{attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...
            </p>
            <p style={styles.hint}>
              This may take a few seconds after a period of inactivity
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.errorIcon}>⚠️</div>
            <p style={styles.statusText}>Server is temporarily unavailable</p>
            <p style={styles.hint}>
              The server may be experiencing high load or maintenance. Please try again.
            </p>
            <button style={styles.retryButton} onClick={wakeBackend}>
              Retry Connection
            </button>
          </>
        )}
      </div>

      {/* Inline keyframe animation for the spinner */}
      <style>{`
        @keyframes cg-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cg-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    padding: '1rem',
  },
  card: {
    textAlign: 'center',
    padding: '3rem 2.5rem',
    borderRadius: '1.5rem',
    background: 'rgba(30, 27, 75, 0.5)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)',
    maxWidth: '420px',
    width: '100%',
  },
  logoContainer: {
    marginBottom: '1.5rem',
  },
  logo: {
    width: '72px',
    height: '72px',
    filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))',
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    background: 'linear-gradient(135deg, #818cf8, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '0 0 2rem',
    fontSize: '0.8rem',
    color: 'rgba(148, 163, 184, 0.8)',
    letterSpacing: '0.05em',
  },
  spinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(99, 102, 241, 0.2)',
    borderTopColor: '#818cf8',
    borderRadius: '50%',
    animation: 'cg-spin 0.8s linear infinite',
  },
  statusText: {
    margin: '0 0 0.5rem',
    fontSize: '0.95rem',
    color: '#c7d2fe',
    fontWeight: 500,
    animation: 'cg-pulse 2s ease-in-out infinite',
  },
  hint: {
    margin: '0',
    fontSize: '0.75rem',
    color: 'rgba(148, 163, 184, 0.6)',
    lineHeight: 1.5,
  },
  errorIcon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
  },
  retryButton: {
    marginTop: '1.5rem',
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
  },
};
