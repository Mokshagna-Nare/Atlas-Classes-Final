
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

  useEffect(() => {
    const token = localStorage.getItem('atlas-token');
    const storedUser = localStorage.getItem('atlas-user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: any, role: string) => {
    setIsLoading(true);
    setError(null);

    // --- DEMO CREDENTIALS INTERCEPTION (Client-Side Override) ---
    const { email, password } = credentials;
    let demoUser: User | null = null;
    let demoToken = 'demo-token-static';

    if (email === 'student@atlas.com' && password === 'password') {
        demoUser = { id: 's1', name: 'Riya Sharma', role: 'student', instituteId: 'i1' };
    } else if (email === 'institute@atlas.com' && password === 'password') {
        demoUser = { id: 'i1', name: 'ABC School', role: 'institute' };
    } else if (email === 'admin@atlas.com' && password === 'password') {
        demoUser = { id: 'admin-id', name: 'Administrator', role: 'admin' };
    }

    if (demoUser) {
        await new Promise(resolve => setTimeout(resolve, 500));

        if (demoUser.role !== role && role !== 'any') {
             setError(`Unauthorized. This login is for ${role}s only.`);
             setIsLoading(false);
             return;
        }

        localStorage.setItem('atlas-token', demoToken);
        localStorage.setItem('atlas-user', JSON.stringify(demoUser));
        setUser(demoUser);
        setIsLoading(false);
        return;
    }
    // -----------------------------------------------------------

    try {
      const response = await api.post('/auth/login', { ...credentials });
      const { token, user } = response.data;

      if (user.role !== role && role !== 'any') {
          throw new Error(`Unauthorized. This login is for ${role}s only.`);
      }

      localStorage.setItem('atlas-token', token);
      localStorage.setItem('atlas-user', JSON.stringify(user));
      setUser(user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
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
          setError(err.response?.data?.message || 'Signup failed');
          throw err;
      } finally {
          setIsLoading(false);
      }
  }

  const logout = () => {
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
