import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import api from '../services/api';
// IMPORTANT: Import your frontend Supabase client so we can inject the session
// Inside AuthContext.tsx
import { supabase } from '../services/supabase';  

interface AuthContextType {
  user: User | null;
  login: (credentials: any, role: string) => Promise<void>;
  signup: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('atlas-token');
      const refreshToken = localStorage.getItem('atlas-refreshToken');
      const storedUser = localStorage.getItem('atlas-user');
      
      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Attach token to any standard Axios requests
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Inject session into Supabase client to ensure refreshes don't break RLS fetching
          if (refreshToken) {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken
            });
          }
        } catch (err) {
          console.error("Failed to parse stored user", err);
          localStorage.removeItem('atlas-token');
          localStorage.removeItem('atlas-refreshToken');
          localStorage.removeItem('atlas-user');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: any, role: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Send request to your Express backend
      const response = await api.post('/auth/login', { ...credentials });
      const { token, refreshToken, user } = response.data;

      // 2. Verify role
      if (user.role !== role && role !== 'any') {
          throw new Error(`Unauthorized. This login is for ${role}s only.`);
      }

      // 3. Inject the session into the frontend Supabase Client instantly.
      // This fixes the empty data bug on the first login!
      if (refreshToken) {
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken
        });
      }

      // 4. Save to localStorage
      localStorage.setItem('atlas-token', token);
      if (refreshToken) localStorage.setItem('atlas-refreshToken', refreshToken);
      localStorage.setItem('atlas-user', JSON.stringify(user));
      
      // 5. Update React state and Axios default headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage); 
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: any) => {
      setIsLoading(true);
      setError(null);
      try {
          await api.post('/auth/signup', userData);
      } catch (err: any) {
          const errorMessage = err.response?.data?.message || 'Signup failed';
          setError(errorMessage);
          throw new Error(errorMessage);
      } finally {
          setIsLoading(false);
      }
  }

  const logout = async () => {
    // Clear tokens from browser, reset React state, and sign out of Supabase
    localStorage.removeItem('atlas-token');
    localStorage.removeItem('atlas-refreshToken');
    localStorage.removeItem('atlas-user');
    delete api.defaults.headers.common['Authorization'];
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType | null => {
  return useContext(AuthContext);
};