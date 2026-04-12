"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from './types';
import { api } from './api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // If token was invalid/expired, clear it
          document.cookie = 'cowatch_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
      } catch (error) {

      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (idToken: string) => {
    setIsLoading(true);
    try {
      const { access_token, user: userData } = await api.googleLogin(idToken);
      
      setUser(userData);
      
      // Store JWT in cookie for middleware
      // We store the actual token now, so middleware can potentially verify it if needed
      // but for now middleare just checks for presence.
      document.cookie = `cowatch_auth=${access_token}; path=/; max-age=${60 * 60 * 24 * 7}`;
      
      // Also store user in localStorage for speed (optional, since we have /me)
      localStorage.setItem('cowatch_user', JSON.stringify(userData));
    } catch (error) {

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setUser(null);
    localStorage.removeItem('cowatch_user');
    document.cookie = 'cowatch_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    sessionStorage.clear();
    setIsLoading(false);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = await api.updateProfile(updates);
      setUser(updatedUser);
      localStorage.setItem('cowatch_user', JSON.stringify(updatedUser));
    } catch (error) {

      throw error;
    }
  };

  // Onboarding Guard
  useEffect(() => {
    if (isLoading) return;
    
    const pathname = window.location.pathname;
    
    if (user) {
      if (!user.display_name && pathname !== '/onboarding') {
        window.location.href = '/onboarding';
      } else if (user.display_name && pathname === '/onboarding') {
        window.location.href = '/dashboard';
      }
    }
  }, [user, isLoading]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
