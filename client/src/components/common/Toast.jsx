import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils.js';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  CloseIcon,
} from './Icons.jsx';

const ToastContext = createContext(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

/**
 * ShopFinder — Global Lightweight Toast System (Task 4.5)
 *
 * Provides a transient notification overlay supporting success, error, warning, and info messages.
 * Automatically cleans up timers, enforces a maximum stack size, announces to assistive tech,
 * and allows manual dismissal.
 */
export function ToastProvider({ children, maxToasts = MAX_TOASTS }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // Mark mounted state and cleanup all timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const currentTimers = timersRef.current;

    return () => {
      isMountedRef.current = false;
      currentTimers.forEach((timerId) => clearTimeout(timerId));
      currentTimers.clear();
    };
  }, []);

  const dismiss = useCallback((id) => {
    // Clear scheduled timer if active
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }

    if (isMountedRef.current) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current.clear();

    if (isMountedRef.current) {
      setToasts([]);
    }
  }, []);

  const toast = useCallback(
    ({
      id,
      title,
      message,
      variant = 'info',
      duration = DEFAULT_DURATION,
    }) => {
      const toastId = id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newToast = {
        id: toastId,
        title,
        message,
        variant,
        duration,
        createdAt: Date.now(),
      };

      if (!isMountedRef.current) return toastId;

      setToasts((prev) => {
        // Enforce maximum stack limit: retain up to (maxToasts - 1) before prepending new toast
        const trimmed = prev.length >= maxToasts ? prev.slice(prev.length - maxToasts + 1) : prev;
        return [...trimmed, newToast];
      });

      // Schedule auto-dismissal if duration is positive
      if (duration > 0) {
        if (timersRef.current.has(toastId)) {
          clearTimeout(timersRef.current.get(toastId));
        }

        const timer = setTimeout(() => {
          dismiss(toastId);
        }, duration);

        timersRef.current.set(toastId, timer);
      }

      return toastId;
    },
    [dismiss, maxToasts]
  );

  const value = {
    toast,
    dismiss,
    dismissAll,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access the toast notification dispatcher.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Toast Container displaying the floating stack of toast notifications.
 */
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-4 sm:p-0"
    >
      {toasts && toasts.map((item) => (
        <ToastItem key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Single Toast notification item.
 */
function ToastItem({ toast, onDismiss }) {
  const isError = toast.variant === 'error';

  const config = {
    error: {
      container: 'border-destructive/30 bg-card text-destructive shadow-lg',
      icon: <AlertCircleIcon className="w-5 h-5 text-destructive shrink-0" />,
      titleColor: 'text-destructive font-semibold',
    },
    warning: {
      container: 'border-amber-500/30 bg-card text-amber-800 dark:text-amber-200 shadow-lg',
      icon: <AlertCircleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      titleColor: 'text-amber-900 dark:text-amber-100 font-semibold',
    },
    success: {
      container: 'border-emerald-500/30 bg-card text-emerald-800 dark:text-emerald-200 shadow-lg',
      icon: <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      titleColor: 'text-emerald-900 dark:text-emerald-100 font-semibold',
    },
    info: {
      container: 'border-border bg-card text-foreground shadow-lg',
      icon: <InfoIcon className="w-5 h-5 text-primary shrink-0" />,
      titleColor: 'text-foreground font-semibold',
    },
  };

  const current = config[toast.variant] || config.info;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 motion-reduce:transition-none shadow-md',
        current.container
      )}
    >
      {current.icon}

      <div className="flex-1 min-w-0 pr-1">
        {toast.title && <h5 className={cn('text-xs uppercase tracking-wide mb-0.5', current.titleColor)}>{toast.title}</h5>}
        {toast.message && <p className="text-sm opacity-90 leading-snug">{toast.message}</p>}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        className="p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default ToastProvider;
