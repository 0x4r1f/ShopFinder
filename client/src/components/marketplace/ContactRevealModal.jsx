import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button.jsx';
import Spinner from '../common/Spinner.jsx';
import {
  PhoneIcon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  AlertCircleIcon,
  CloseIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../common/Icons.jsx';
import { revealContact } from '../../services/revealService.js';
import { useCredits } from '../../context/CreditContext.jsx';

/**
 * ShopFinder — Interactive Contact Reveal Modal (Phase 10, Task 10.9)
 *
 * Implements accessible, secure contact reveal modal for authenticated customers:
 * - Pre-reveal confirmation with credit balance context.
 * - In-flight loading feedback with disabled interaction.
 * - Revealed success state displaying owner phone exclusively from backend response.
 * - Distinguishes first reveal (1 credit deducted) vs repeat reveal (already revealed, 0 credits deducted).
 * - Direct tel: action and copy-to-clipboard functionality.
 * - Insufficient credits state (HTTP 402) with clear CTA navigating to /pricing.
 * - General error handling with retry capability.
 * - Strict Privacy (D-014): Clears sensitive phone state on close, never persists to browser storage, zero console logging.
 * - Focus management, Escape key listener, and ARIA dialog semantics.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal dialog is visible
 * @param {Object|null} props.listing - Target commercial listing ({ id, title, city, area })
 * @param {Function} props.onClose - Modal close handler
 * @param {Function} [props.onSuccess] - Optional callback after successful reveal
 */
export default function ContactRevealModal({
  isOpen,
  listing,
  onClose,
  onSuccess,
  initialPhone = null,
  initialAlreadyRevealed = false,
  initialLoading = false,
  initialError = null,
  revealFn = null,
  onController = null,
}) {
  const { credits, setCredits, refreshCredits } = useCredits();

  // Sensitive owner phone state — kept strictly in React memory
  const [revealedPhone, setRevealedPhone] = useState(initialPhone);
  const [alreadyRevealed, setAlreadyRevealed] = useState(initialAlreadyRevealed);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState(initialError);
  const [isCopied, setIsCopied] = useState(false);

  const modalRef = useRef(null);
  const primaryBtnRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const inFlightRef = useRef(false);

  // Synchronous state ref ensuring deterministic state inspection in tests
  const stateRef = useRef({
    revealedPhone: initialPhone,
    alreadyRevealed: initialAlreadyRevealed,
    isLoading: initialLoading,
    error: initialError,
    isCopied: false,
  });

  // Keep stateRef updated with initial values
  useEffect(() => {
    stateRef.current.revealedPhone = initialPhone;
    stateRef.current.alreadyRevealed = initialAlreadyRevealed;
    stateRef.current.isLoading = initialLoading;
    stateRef.current.error = initialError;
  }, [initialPhone, initialAlreadyRevealed, initialLoading, initialError]);

  // Reset all sensitive state whenever modal closes or listing changes
  const resetState = useCallback(() => {
    stateRef.current = {
      revealedPhone: null,
      alreadyRevealed: false,
      isLoading: false,
      error: null,
      isCopied: false,
    };
    inFlightRef.current = false;
    setRevealedPhone(null);
    setAlreadyRevealed(false);
    setIsLoading(false);
    setError(null);
    setIsCopied(false);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }, []);

  // Safe close handler that cleans sensitive state
  const handleSafeClose = useCallback(() => {
    if (isLoading || inFlightRef.current) return;
    resetState();
    onClose();
  }, [isLoading, resetState, onClose]);

  // Clean state when closed or when target listing changes
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, listing?.id, resetState]);

  // Focus management and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, handleSafeClose]);

  if (!isOpen || !listing) {
    return null;
  }

  const listingTitle = listing.title || 'Commercial Property';
  const locationText = [listing.area, listing.city].filter(Boolean).join(', ');
  const hasZeroCredits = typeof credits === 'number' && credits <= 0;
  const isInsufficientCredits = error?.status === 402 || (!revealedPhone && !error && hasZeroCredits);

  /**
   * Dispatches reveal request to Express backend
   */
  const handleReveal = async () => {
    if (isLoading || inFlightRef.current || !listing?.id) return;

    inFlightRef.current = true;
    stateRef.current.isLoading = true;
    stateRef.current.error = null;
    setIsLoading(true);
    setError(null);

    try {
      const executeReveal = typeof revealFn === 'function' ? revealFn : revealContact;
      const response = await executeReveal(listing.id);

      if (response?.revealed && response?.ownerPhone) {
        stateRef.current.revealedPhone = response.ownerPhone;
        stateRef.current.alreadyRevealed = Boolean(response.alreadyRevealed);
        setRevealedPhone(response.ownerPhone);
        setAlreadyRevealed(Boolean(response.alreadyRevealed));

        // Synchronize credit balance in CreditContext only when valid finite number
        if (
          typeof response.creditsRemaining === 'number' &&
          Number.isFinite(response.creditsRemaining)
        ) {
          setCredits(response.creditsRemaining);
        }
        if (typeof refreshCredits === 'function') {
          refreshCredits();
        }

        if (typeof onSuccess === 'function') {
          onSuccess(response);
        }
      } else {
        throw new Error('Unable to retrieve owner contact information.');
      }
    } catch (err) {
      const errObj = {
        status: err?.status || 500,
        message: err?.message || 'Failed to reveal owner contact. Please try again.',
      };
      stateRef.current.error = errObj;
      setError(errObj);
    } finally {
      inFlightRef.current = false;
      stateRef.current.isLoading = false;
      setIsLoading(false);
    }
  };

  /**
   * Copies revealed phone number to clipboard safely
   */
  const handleCopyPhone = async () => {
    if (!revealedPhone) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(revealedPhone);
        setIsCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
      }
    } catch {
      // Fallback: clipboard permission denied
      setIsCopied(false);
    }
  };

  // Expose controller methods for behavioral testing if requested
  if (typeof onController === 'function') {
    onController({
      handleReveal,
      resetState,
      handleSafeClose,
      handleCopyPhone,
      getState: () => ({ ...stateRef.current }),
    });
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleSafeClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-modal-title"
      aria-describedby="reveal-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-reduce:transition-none"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-6 space-y-5 transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-reduce:transition-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                revealedPhone
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : isInsufficientCredits
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {revealedPhone ? (
                <PhoneIcon className="w-5 h-5" />
              ) : isInsufficientCredits ? (
                <AlertCircleIcon className="w-5 h-5" />
              ) : (
                <LockIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="reveal-modal-title"
                className="text-lg font-bold tracking-tight text-foreground"
              >
                {revealedPhone
                  ? 'Owner Contact Unlocked'
                  : isInsufficientCredits
                  ? 'Insufficient Credits'
                  : 'Reveal Owner Contact'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {listingTitle}
                {locationText ? ` • ${locationText}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Loading State */}
        {isLoading && (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-foreground">
              Securing and unlocking owner contact...
            </p>
            <p className="text-xs text-muted-foreground">
              Validating customer subscription balance via trusted session
            </p>
          </div>
        )}

        {/* Modal Body: Revealed Success State */}
        {!isLoading && revealedPhone && (
          <div id="reveal-modal-description" className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  alreadyRevealed
                    ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                }`}
              >
                <CheckCircleIcon className="w-3.5 h-3.5" />
                {alreadyRevealed
                  ? 'Previously Revealed (0 Credits Deducted)'
                  : 'Contact Revealed (1 Credit Deducted)'}
              </span>

              {typeof credits === 'number' && (
                <span className="text-xs text-muted-foreground">
                  Balance: <strong>{credits}</strong> {credits === 1 ? 'credit' : 'credits'}
                </span>
              )}
            </div>

            {/* Phone Display Box */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Owner Direct Phone
                </span>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-wider text-foreground select-all">
                  {revealedPhone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPhone}
                  className="text-xs"
                >
                  {isCopied ? 'Copied!' : 'Copy Number'}
                </Button>

                <Button asChild size="sm" className="text-xs">
                  <a href={`tel:${revealedPhone}`}>
                    <PhoneIcon className="w-3.5 h-3.5 mr-1" />
                    Call Owner
                  </a>
                </Button>
              </div>
            </div>

            {/* Permanent Access Guarantee Notice */}
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Permanent Contact Access</span>
              </div>
              <p className="leading-relaxed opacity-95">
                This commercial property contact is now permanently unlocked in your history. You can return and view this number anytime with zero additional credits deducted.
              </p>
            </div>
          </div>
        )}

        {/* Modal Body: Insufficient Credits State (HTTP 402 or 0 credits) */}
        {!isLoading && !revealedPhone && isInsufficientCredits && (
          <div id="reveal-modal-description" className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <SparklesIcon className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Credits Required for Contact Unlocking</span>
              </div>
              <p className="leading-relaxed">
                You do not have enough credits to reveal this property owner's direct contact details.
                Each commercial listing reveal requires 1 credit from an active package.
              </p>
              {typeof credits === 'number' && (
                <p className="font-medium pt-1">
                  Current Balance: <span className="font-bold">{credits} credits</span>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 text-xs text-muted-foreground space-y-1.5">
              <span className="font-semibold text-foreground block">Why ShopFinder uses credits:</span>
              <p className="leading-relaxed">
                Credit packages keep commercial listings verified and protect property owners from spam. Credits never expire and unlocked contacts remain accessible forever.
              </p>
            </div>
          </div>
        )}

        {/* Modal Body: General Error State (non-402) */}
        {!isLoading && !revealedPhone && error && error.status !== 402 && (
          <div id="reveal-modal-description" className="space-y-4">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircleIcon className="w-4 h-4 shrink-0" />
                <span>Unable to Reveal Contact</span>
              </div>
              <p className="leading-relaxed">
                {error.message || 'An unexpected error occurred while communicating with the reveal service.'}
              </p>
            </div>
          </div>
        )}

        {/* Modal Body: Confirmation / Pre-Reveal State */}
        {!isLoading && !revealedPhone && !error && !hasZeroCredits && (
          <div id="reveal-modal-description" className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reveal Cost</span>
                <span className="font-bold text-foreground">1 Credit</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your Balance</span>
                <span className="font-bold text-foreground">
                  {typeof credits === 'number' ? `${credits} credits` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Balance After Reveal</span>
                <span className="font-bold text-primary">
                  {typeof credits === 'number' ? `${Math.max(0, credits - 1)} credits` : '—'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>One-Time Deduction Guarantee</span>
              </div>
              <p className="leading-relaxed">
                Once revealed, this owner's phone number remains permanently saved in your contact history. If you revisit this listing later, zero credits will be deducted.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
          {/* Revealed Success State */}
          {revealedPhone ? (
            <Button
              ref={primaryBtnRef}
              type="button"
              onClick={handleSafeClose}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          ) : isInsufficientCredits ? (
            /* Insufficient Credits State */
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSafeClose}
              >
                Cancel
              </Button>
              <Button
                ref={primaryBtnRef}
                asChild
                className="w-full sm:w-auto"
              >
                <Link to="/pricing" onClick={handleSafeClose}>
                  <SparklesIcon className="w-4 h-4 mr-1.5" />
                  View Credit Packages
                </Link>
              </Button>
            </>
          ) : error ? (
            /* General Error State */
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSafeClose}
              >
                Close
              </Button>
              <Button
                ref={primaryBtnRef}
                type="button"
                onClick={handleReveal}
              >
                Try Again
              </Button>
            </>
          ) : (
            /* Pre-Reveal Confirmation State */
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSafeClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                ref={primaryBtnRef}
                type="button"
                onClick={handleReveal}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <PhoneIcon className="w-4 h-4 mr-1.5" />
                Reveal Contact (1 Credit)
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

