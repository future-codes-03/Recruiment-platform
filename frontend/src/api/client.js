import axios from "axios";

const TOKEN_KEY = "skillbridge_access_token";
const REFRESH_KEY = "skillbridge_refresh_token";
const USER_KEY = "skillbridge_user";
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Every backend call goes through this instance — never call axios directly
// from a component. When the real backend exists, only this file needs to
// change (baseURL), not every component that makes a request.
const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the access token to every request once the user is logged in.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function clearSessionAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// Concurrent requests can all 401 around the same moment (e.g. a page that
// fires three requests at once right as the token expires) — without this,
// each one would kick off its own /auth/refresh call. Sharing one in-flight
// promise means only the first 401 actually calls refresh; the rest just
// wait on the same result.
let refreshPromise = null;

// A 401 means the access token is missing/expired/invalid. Before giving up,
// try exchanging the refresh token for a new access token once. Only if
// that also fails (refresh token itself expired/invalid, or there wasn't
// one) do we actually clear the session and send the user to login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retried && !isRefreshCall) {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      original._retried = true;
      try {
        if (!refreshPromise) {
          // Plain axios, not `api` — deliberately bypasses this same
          // interceptor so a failed refresh can't recursively trigger
          // another refresh attempt.
          refreshPromise = axios
            .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const { data } = await refreshPromise;
        localStorage.setItem(TOKEN_KEY, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401) {
      clearSessionAndRedirect();
    }

    return Promise.reject(error);
  }
);

export default api;
