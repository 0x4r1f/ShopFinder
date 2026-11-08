import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCredits } from '../../context/CreditContext.jsx';
import { SparklesIcon } from './Icons.jsx';

/**
 * ShopFinder — Reusable Customer Credit Balance Badge (Phase 9, Task 9.5)
 *
 * Displays the authenticated customer's available contact-reveal credits.
 * Strictly hidden for anonymous users, property owners, and administrators.
 *
 * Variants:
 * - 'header': Compact desktop navbar chip
 * - 'mobile': Full-width touch-friendly drawer row
 *
 * @param {Object} props
 * @param {'header'|'mobile'} [props.variant='header'] - Badge presentation variant
 * @param {number} [props.initialCredits] - Optional explicit credits count override
 * @param {boolean} [props.initialLoading] - Optional explicit loading state override
 * @param {string} [props.className] - Additional CSS classes
 * @param {Function} [props.onClick] - Optional click handler (e.g., closing mobile drawer)
 */
export default function CreditBadge({
  variant = 'header',
  initialCredits,
  initialLoading,
  className = '',
  onClick,
}) {
  const { user, isAuthenticated } = useAuth();
  const contextCredits = useCredits();

  // Strict role guard: only customers can ever view credit indicators
  const isCustomer = Boolean(isAuthenticated && user?.role === 'customer');
  if (!isCustomer) {
    return null;
  }

  const isLoading = initialLoading !== undefined ? initialLoading : contextCredits.loading;
  const rawCredits = initialCredits !== undefined ? initialCredits : contextCredits.credits;
  const numericCredits = Number(rawCredits);
  const creditsCount = Number.isFinite(numericCredits) && numericCredits >= 0 ? numericCredits : 0;

  const accessibleLabel = isLoading
    ? 'Loading available contact reveal credits'
    : `Available contact reveal credits: ${creditsCount}`;

  if (variant === 'mobile') {
    return (
      <Link
        to="/dashboard"
        onClick={onClick}
        aria-label={accessibleLabel}
        title="Available contact reveal credits"
        data-testid="mobile-credit-indicator"
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold">Available Credits</span>
        </div>
        {isLoading ? (
          <span
            className="inline-block w-8 h-4 bg-primary/20 animate-pulse rounded-full"
            aria-busy="true"
          />
        ) : (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow-xs"
            data-testid="mobile-credits-count"
          >
            {creditsCount}
          </span>
        )}
      </Link>
    );
  }

  // Default: 'header' variant (compact desktop chip)
  return (
    <Link
      to="/dashboard"
      onClick={onClick}
      aria-label={accessibleLabel}
      title="Available contact reveal credits"
      data-testid="header-credit-indicator"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <SparklesIcon className="w-3.5 h-3.5 text-primary shrink-0" />
      {isLoading ? (
        <span
          className="inline-block w-12 h-3.5 bg-primary/20 animate-pulse rounded"
          aria-busy="true"
        />
      ) : (
        <span data-testid="header-credits-count">
          {creditsCount} {creditsCount === 1 ? 'Credit' : 'Credits'}
        </span>
      )}
    </Link>
  );
}

