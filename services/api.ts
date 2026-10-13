import axios from 'axios';
import { supabase } from './supabase';

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
// Prefers the live Supabase session (refreshed automatically, and carries the admin's
// two-step level) over the token saved at login, which expires after an hour.
api.interceptors.request.use(
  async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || localStorage.getItem('atlas-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;