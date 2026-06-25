import axios from 'axios';

let activeRequests = 0;
const listeners = new Set();

export const subscribeToLoading = (listener) => {
  listeners.add(listener);
  // Initial sync
  listener(activeRequests > 0);
  return () => {
    listeners.delete(listener);
  };
};

const updateLoading = (delta) => {
  activeRequests += delta;
  if (activeRequests < 0) activeRequests = 0;
  const isLoading = activeRequests > 0;
  listeners.forEach((l) => l(isLoading));
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ── SECURITY FIX #12: Send HttpOnly cookies automatically
});

// ── Retry config for cold-start / Neon wake-up resilience ─────────────
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [502, 503, 504]; // Gateway errors from cold starts
const RETRY_BASE_DELAY = 1000; // 1s, 2s, 4s

function shouldRetry(error) {
  // Retry on network errors (no response at all)
  if (!error.response) return true;
  // Retry on gateway/timeout errors from Vercel cold starts
  if (RETRY_STATUS_CODES.includes(error.response.status)) return true;
  return false;
}

function getRetryDelay(retryCount) {
  return RETRY_BASE_DELAY * Math.pow(2, retryCount);
}

// Request interceptor to track active requests
api.interceptors.request.use(
  (config) => {
    if (!config.headers?.['X-Skip-Loading']) {
      updateLoading(1);
    }
    return config;
  },
  (error) => {
    if (error.config && !error.config.headers?.['X-Skip-Loading']) {
      updateLoading(-1);
    }
    return Promise.reject(error);
  }
);

// Response interceptor — handle retries + 401 (token expired)
api.interceptors.response.use(
  (response) => {
    if (!response.config.headers?.['X-Skip-Loading']) {
      updateLoading(-1);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && !originalRequest.headers?.['X-Skip-Loading']) {
      updateLoading(-1);
    }

    // ── Retry logic for cold-start / network errors ──────────────
    if (originalRequest && !originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }

    if (
      originalRequest &&
      shouldRetry(error) &&
      originalRequest._retryCount < MAX_RETRIES &&
      !originalRequest._isRefreshRequest
    ) {
      originalRequest._retryCount += 1;
      const delay = getRetryDelay(originalRequest._retryCount - 1);
      console.warn(
        `[API] Retry ${originalRequest._retryCount}/${MAX_RETRIES} for ${originalRequest.url} in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
      return api(originalRequest);
    }

    // ── 401 handling — token refresh via HttpOnly Cookie ────────────────
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true;

      try {
        // Backend now reads the garuda_refresh_token cookie automatically
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        // Refresh succeeded, retry original request (which will now send the new garuda_access_token cookie)
        return api(originalRequest);
      } catch {
        // Refresh failed (or no refresh token cookie) — force logout
        localStorage.removeItem('garuda_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
