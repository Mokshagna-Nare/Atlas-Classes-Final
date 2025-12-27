import axios from 'axios';

// Get the API URL from environment variables (Vite uses import.meta.env)
// If VITE_API_URL is not set (development), fallback to localhost
// Cast import.meta to any to avoid TypeScript error regarding 'env' property on ImportMeta
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('atlas-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;