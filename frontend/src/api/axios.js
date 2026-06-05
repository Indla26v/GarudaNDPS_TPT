import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
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

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('garuda_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle retries + 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── Retry logic for cold-start / network errors ──────────────
    if (!originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }

    if (
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

    // ── 401 handling — token refresh ─────────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('garuda_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
            { refreshToken }
          );
          const { accessToken } = res.data.data;
          localStorage.setItem('garuda_access_token', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — force logout
          localStorage.removeItem('garuda_access_token');
          localStorage.removeItem('garuda_refresh_token');
          localStorage.removeItem('garuda_user');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('garuda_access_token');
        localStorage.removeItem('garuda_refresh_token');
        localStorage.removeItem('garuda_user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
