import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as authService from '../services/authService.js';

export const AuthContext = createContext(null);

/**
 * ShopFinder — Authentication Context Provider (Task 3.7)
 *
 * Manages user authentication state across the frontend application.
 * Relies exclusively on server-set httpOnly cookies (D-010).
 * Never stores or exposes raw JWT tokens in browser storage or component state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // In-flight promise tracker to deduplicate concurrent hydration requests
  // (e.g. React 18 StrictMode setup -> cleanup -> setup lifecycle or concurrent retries)
  const inFlightPromiseRef = useRef(null);

  /**
   * Fetches the current user profile from GET /api/v1/users/me.
   * Deduplicates concurrent in-flight calls so React StrictMode or concurrent
   * callers share the same network request without duplicate traffic.
   */
  const fetchCurrentUserDeduped = useCallback(() => {
    if (!inFlightPromiseRef.current) {
      inFlightPromiseRef.current = authService.getCurrentUser().finally(() => {
        inFlightPromiseRef.current = null;
      });
    }
    return inFlightPromiseRef.current;
  }, []);

  // Explicit session hydration on application startup or user retry
  const hydrateSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await fetchCurrentUserDeduped();
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      // 401 is standard unauthenticated response (no active session)
      if (err.status === 401) {
        setUser(null);
      } else {
        // Network or server error during hydration
        setError(err.message || 'Unable to reach authentication server');
        setUser(null);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUserDeduped]);

  useEffect(() => {
    let isMounted = true;

    async function executeHydration() {
      try {
        setError(null);
        const currentUser = await fetchCurrentUserDeduped();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 401) {
            setUser(null);
          } else {
            setError(err.message || 'Unable to reach authentication server');
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    executeHydration();

    return () => {
      isMounted = false;
    };
  }, [fetchCurrentUserDeduped]);

  /**
   * Logs in user with email and password.
   */
  const login = useCallback(async (credentials) => {
    setError(null);
    const loggedInUser = await authService.login(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  /**
   * Registers a new customer or owner user.
   */
  const register = useCallback(async (data) => {
    setError(null);
    const registeredUser = await authService.register(data);
    setUser(registeredUser);
    return registeredUser;
  }, []);

  /**
   * Logs out user and clears server cookie and local user state.
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Logout request warning:', err.message);
    } finally {
      // Always clear in-flight reference and user state safely regardless of network status
      inFlightPromiseRef.current = null;
      setUser(null);
      setError(null);
    }
  }, []);

  /**
   * Re-hydrates current user profile from GET /api/v1/users/me.
   */
  const refreshUser = useCallback(async () => {
    try {
      const refreshed = await fetchCurrentUserDeduped();
      setUser(refreshed);
      return refreshed;
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
      }
      throw err;
    }
  }, [fetchCurrentUserDeduped]);

  /**
   * Updates permitted profile fields and synchronizes local user state.
   */
  const updateUser = useCallback(async (updateData) => {
    const updated = await authService.updateProfile(updateData);
    setUser(updated);
    return updated;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    error,
    login,
    register,
    logout,
    refreshUser,
    updateUser,
    hydrateSession,
    refreshSession: hydrateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook providing access to AuthContext.
 *
 * @returns {Object} AuthContext value
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
