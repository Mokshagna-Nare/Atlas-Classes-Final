import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  login: (credentials: any, role: string) => Promise<void>;
  signup: (userData: any) => Promise<void>;
  logout: () => void;
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
    const token = localStorage.getItem('atlas-token');
    const storedUser = localStorage.getItem('atlas-user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user", err);
        localStorage.removeItem('atlas-token');
        localStorage.removeItem('atlas-user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: any, role: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Send request to your Express backend (which uses Supabase Auth)
      const response = await api.post('/auth/login', { ...credentials });
      const { token, user } = response.data;

      // 2. Verify the user has the correct role for the portal they are trying to access
      if (user.role !== role && role !== 'any') {
          throw new Error(`Unauthorized. This login is for ${role}s only.`);
      }

      // 3. Save real Supabase token and user profile to localStorage
      localStorage.setItem('atlas-token', token);
      localStorage.setItem('atlas-user', JSON.stringify(user));
      
      // 4. Update React state
      setUser(user);

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage); // Throw to let the UI component (AdminLogin) handle the error state
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

  const logout = () => {
    // Clear tokens from browser and reset React state
    localStorage.removeItem('atlas-token');
    localStorage.removeItem('atlas-user');
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
