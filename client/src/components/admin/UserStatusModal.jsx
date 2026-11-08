import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button.jsx';
import { AlertCircleIcon, CheckCircleIcon, CloseIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

/**
 * ShopFinder — Admin User Status Confirmation Modal (Phase 7, Task 7.5)
 *
 * Accessible confirmation dialog for activating or deactivating a platform user account.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object|null} props.user - Target user object ({ id, name, email, role, is_active })
 * @param {Function} props.onClose - Modal dismissal handler
 * @param {Function} props.onConfirm - async () => Promise<void>
 * @param {boolean} [props.isSubmitting=false]
 */
export default function UserStatusModal({
  isOpen,
  user,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !user) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const willActivate = !user.is_active;
  const actionLabel = willActivate ? 'Activate' : 'Deactivate';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-status-dialog-title"
      aria-describedby="user-status-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-reduce:transition-none"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-card text-card-foreground rounded-xl shadow-xl border border-border p-6 space-y-5 transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-reduce:transition-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                willActivate
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {willActivate ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <AlertCircleIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="user-status-dialog-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                {willActivate ? 'Activate User Account' : 'Deactivate User Account'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {willActivate
                  ? 'Restore platform access for this user'
                  : 'Suspend platform access for this user'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity Details */}
        <div id="user-status-dialog-desc" className="bg-muted/40 p-3.5 rounded-lg border border-border/80 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">User:</span>
            <span className="font-semibold text-foreground truncate max-w-[220px]">
              {user.name || 'User'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Email:</span>
            <span className="text-xs font-mono text-foreground truncate max-w-[220px]">
              {user.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Role:</span>
            <span className="text-xs font-medium uppercase tracking-wider bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
              {user.role}
            </span>
          </div>
        </div>

        {/* Action Explanation */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {willActivate
            ? 'Activating this account will allow the user to log in and interact with platform features.'
            : 'Deactivating this account will prevent the user from logging in or modifying any listings.'}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant={willActivate ? 'default' : 'destructive'}
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`min-w-[120px] font-medium ${
              willActivate ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className={willActivate ? 'text-white' : ''} />
                <span>Updating...</span>
              </>
            ) : willActivate ? (
              'Activate User'
            ) : (
              'Deactivate User'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

