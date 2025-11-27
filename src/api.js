// src/api.js
import axios from "axios";

export const API_BASE_URL = "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Always attach token from localStorage, even after refresh
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem("auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      }
    } catch (e) {
      console.warn("Failed to read auth from localStorage", e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const useApi = () => api;

export default api;
