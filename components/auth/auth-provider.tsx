/**
 * Auth context provider for client-side authentication state.
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { ensureAdminUserClient } from '@/lib/client/admin-seed';
import { installFetchInterceptor } from '@/lib/client/fetch-interceptor';
import type { LearningOnboardingStatus } from '@/lib/onboarding/types';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: 'guest' | 'user' | 'admin';
  status: 'active' | 'suspended';
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
  emailVerified: boolean;
  createdAt: number;
  onboardingStatus: LearningOnboardingStatus;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface RegisterData {
  email?: string;
  username: string;
  password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isPublicSkyLearningRoute(pathname?: string | null): boolean {
  return (
    pathname?.startsWith('/sky/software-cup') ||
    pathname?.startsWith('/sky/cloud-mind/course-studio') ||
    pathname?.startsWith('/sky/study-lab') ||
    false
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const skipAuthBootstrap = isPublicSkyLearningRoute(pathname);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    installFetchInterceptor();
    if (skipAuthBootstrap) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    ensureAdminUserClient().then(() => fetchUser());
  }, [fetchUser, skipAuthBootstrap]);

  // Auto-refresh access token every 10 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(
      () => {
        fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' }).catch(() => {});
      },
      10 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [user]);

  // Sync profile from server when user changes
  useEffect(() => {
    if (user) {
      useUserProfileStore.getState().fetchFromServer();
    }
  }, [user]);

  const login = async (emailOrUsername: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emailOrUsername, password }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Login failed');
    }
    await fetchUser();
  };

  const register = async (data: RegisterData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Registration failed');
    }
    await fetchUser();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchUser();
      }
    } catch {
      // Ignore refresh failures
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest: !user || user.role === 'guest',
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
