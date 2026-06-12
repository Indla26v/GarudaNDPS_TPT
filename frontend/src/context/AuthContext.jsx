import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('garuda_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  const validatingRef = useRef(false);

  // ── SECURITY FIX #12: Rely on user state instead of localStorage token
  const isAuthenticated = !!user;

  /**
   * Validate session against the server.
   * Called on app mount and when the tab regains focus after idle.
   * Handles Neon cold-start delays gracefully via axios retry interceptor.
   */
  const validateSession = useCallback(async () => {
    if (validatingRef.current) {
      setSessionValidated(true);
      return;
    }

    validatingRef.current = true;
    try {
      const res = await api.get('/auth/me');
      const serverUser = res.data.data;
      // Sync user data from server (role/department may have changed)
      const userData = {
        username: serverUser.username,
        fullName: serverUser.full_name,
        role: serverUser.role,
        department: serverUser.department || null,
        policeStationId: serverUser.police_station_id || null,
      };
      localStorage.setItem('garuda_user', JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      // If 401/403 after retries, the token is truly invalid — logout
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('garuda_user');
        setUser(null);
      }
      // For network errors, axios retry interceptor will have already retried.
      // If still failing, we let the ConnectionGuard handle it.
    } finally {
      validatingRef.current = false;
      setSessionValidated(true);
    }
  }, []);

  // Validate session on initial mount
  useEffect(() => {
    const stored = localStorage.getItem('garuda_user');
    if (stored) {
      validateSession();
    } else {
      setSessionValidated(true);
    }
  }, [validateSession]);

  // Re-validate when tab regains focus after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        validateSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, validateSession]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const data = res.data.data;
      // Note: HttpOnly cookies are automatically set by the browser from the response
      const userData = {
        username: data.username,
        fullName: data.fullName,
        role: data.role,
        department: data.department || null,
        policeStationId: data.policeStationId || null,
      };
      localStorage.setItem('garuda_user', JSON.stringify(userData));
      setUser(userData);
      setSessionValidated(true);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async (reason) => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    // Note: HttpOnly cookies are cleared by the backend response
    localStorage.removeItem('garuda_user');
    setUser(null);
    if (reason === 'idle') {
      // Store a flag so the login page can show an informative message
      sessionStorage.setItem('garuda_idle_logout', 'true');
    }
  }, []);

  // Auto-logout after 15 minutes of inactivity
  useIdleTimeout(
    () => logout('idle'),
    15 * 60 * 1000, // 15 minutes
    isAuthenticated
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, sessionValidated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
