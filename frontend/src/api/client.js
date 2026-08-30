import axios from "axios";

// Every backend call goes through this instance — never call axios directly
// from a component. When the real backend exists, only this file needs to
// change (baseURL), not every component that makes a request.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach the access token to every request once the user is logged in.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("skillbridge_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
