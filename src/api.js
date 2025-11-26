// src/api.js
import axios from "axios";
import { useAuth } from "./context/AuthContext";

export const API_BASE_URL = "http://localhost:3000";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Attach token before each request
export function useApi() {
  const { auth } = useAuth();

  axiosInstance.interceptors.request.use(
    (config) => {
      if (auth?.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return axiosInstance;
}
