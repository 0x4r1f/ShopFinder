import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import customerService from '../services/customerService.js';

export const CreditContext = createContext(null);

/**
 * ShopFinder — Customer Credit Balance Context Provider (Phase 9, Task 9.5)
 *
 * Manages authenticated customer contact-reveal credit balance across Header,
 * Mobile Navigation, and Customer Dashboard.
 *
 * Key Architectural Safeguards:
 * - Uses existing authoritative backend query (GET /api/v1/customer/subscriptions).
 * - Only queries when authenticated as a customer (skips anonymous, owner, admin).
 * - Caches balance across route transitions to prevent duplicate network traffic.
 * - Displays zero credits safely.
 * - Handles network/API failures gracefully without breaking navigation.
 * - Provides refreshCredits() callback for synchronizing balance.
 */
export function CreditProvider({
  children,
  initialCredits = null,
  initialActiveCount = 0,
  initialLoading = false,
  initialError = null,
}) {
  const { user, isAuthenticated } = useAuth();
  const isCustomer = Boolean(isAuthenticated && user?.role === 'customer');

  const [credits, setCredits] = useState(initialCredits);
  const [activeSubscriptionsCount, setActiveSubscriptionsCount] = useState(initialActiveCount);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [loading, setLoading] = useState(
    initialLoading || (isCustomer && initialCredits === null && !initialError)
  );
  const [error, setError] = useState(initialError);

  const abortControllerRef = useRef(null);
  const inFlightPromiseRef = useRef(null);

  /**
   * Authoritative credit balance fetcher.
   * Deduplicates concurrent calls and ensures clean cancellation on unmount.
   */
  const fetchCredits = useCallback(async () => {
    if (!isCustomer) {
      setCredits(null);
      setActiveSubscriptionsCount(0);
      setActiveSubscriptions([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const promise = customerService
      .getCustomerSubscriptions({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          const remaining = Number(data?.credits_remaining);
          setCredits(Number.isFinite(remaining) && remaining >= 0 ? remaining : 0);
          setActiveSubscriptionsCount(Number(data?.active_subscriptions_count) || 0);
          setActiveSubscriptions(Array.isArray(data?.subscriptions) ? data.subscriptions : []);
          setError(null);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        // Non-fatal error: fall back safely so navigation is never broken
        setError(err?.message || 'Unable to load credit balance');
        setCredits(0);
      })
      .finally(() => {
        inFlightPromiseRef.current = null;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    inFlightPromiseRef.current = promise;
    return promise;
  }, [isCustomer]);

  /**
   * Immediate synchronous credit balance updater (e.g. after reveal API response).
   */
  const updateCreditBalance = useCallback((newCredits) => {
    const num = Number(newCredits);
    setCredits(Number.isFinite(num) && num >= 0 ? num : 0);
  }, []);

  // Fetch credits when customer session is established or changed
  useEffect(() => {
    if (isCustomer && initialCredits === null && !initialError) {
      fetchCredits();
    } else if (!isCustomer) {
      setCredits(null);
      setActiveSubscriptionsCount(0);
      setActiveSubscriptions([]);
      setLoading(false);
      setError(null);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isCustomer, fetchCredits, initialCredits, initialError]);

  const value = {
    credits: isCustomer ? credits : null,
    activeSubscriptionsCount: isCustomer ? activeSubscriptionsCount : 0,
    activeSubscriptions: isCustomer ? activeSubscriptions : [],
    loading: isCustomer ? loading : false,
    error: isCustomer ? error : null,
    refreshCredits: fetchCredits,
    setCredits: updateCreditBalance,
    isCustomer,
  };

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}

/**
 * Custom hook providing access to customer credit balance context.
 * Features a resilient fallback if invoked outside CreditProvider
 * (e.g., in isolated component unit tests), preventing crashes.
 *
 * @returns {{
 *   credits: number|null,
 *   activeSubscriptionsCount: number,
 *   activeSubscriptions: Array<Object>,
 *   loading: boolean,
 *   error: string|null,
 *   refreshCredits: () => Promise<void>,
 *   setCredits: (newCredits: number) => void,
 *   isCustomer: boolean
 * }}
 */
export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    return {
      credits: null,
      activeSubscriptionsCount: 0,
      activeSubscriptions: [],
      loading: false,
      error: null,
      refreshCredits: async () => {},
      setCredits: () => {},
      isCustomer: false,
    };
  }
  return context;
}

export default CreditContext;

