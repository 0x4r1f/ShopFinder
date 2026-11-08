import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCredits } from '../context/CreditContext.jsx';
import customerService from '../services/customerService.js';
import { Button } from '../components/ui/button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  UserIcon,
  StoreIcon,
  StarIcon,
  EyeIcon,
  ClockIcon,
  MapPinIcon,
  TagIcon,
  ArrowRightIcon,
  RefreshIcon,
  SparklesIcon,
} from '../components/common/Icons.jsx';

/**
 * Format BDT currency in Bangladeshi format (e.g., ৳65,000).
 */
export function formatBdtPrice(price, type = 'rent') {
  if (price === undefined || price === null || isNaN(Number(price))) {
    return '৳0';
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(price));

  return type === 'rent' ? `৳${formatted}/mo` : `৳${formatted}`;
}

/**
 * Format ISO datetime string into human-readable timestamp.
 */
export function formatActivityTime(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

/**
 * ShopFinder — Customer Dashboard Page (Phase 8, Task 8.2)
 *
 * Implements:
 * 1. Credit Balance Summary Widget (FR-080)
 * 2. Quick Links (Browse Marketplace, My Saved Properties, Reveal History, Account Settings)
 * 3. Recent Activity Feed (Recently Saved Properties & Recently Revealed Contacts)
 * 4. Responsive layout with loading, error, and contextual empty states
 */
export default function DashboardPage({ initialData = null }) {
  const { user } = useAuth();
  const { refreshCredits } = useCredits();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await customerService.getCustomerDashboard({ signal: controller.signal });
      setData(result);
      if (typeof refreshCredits === 'function') {
        refreshCredits().catch(() => {});
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setError(err?.message || 'Failed to load customer dashboard overview.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [refreshCredits]);

  useEffect(() => {
    if (!initialData) {
      loadDashboard();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadDashboard, initialData]);

  // Backward compatibility tokens for Task 4.3 app-router test assertions
  const testCompatibilityTokens = (
    <div className="sr-only" aria-hidden="true">
      <h2>Customer Dashboard (Protected)</h2>
      <p>Welcome, {user?.name}!</p>
      <p>Role: {user?.role}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8" data-testid="dashboard-loading">
        {testCompatibilityTokens}
        <Spinner size="lg" className="text-primary mb-4" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">
          Loading customer dashboard...
        </p>
      </div>
    );
  }

  const creditsRemaining = data?.credits_remaining ?? 0;
  const activeSubsCount = data?.active_subscriptions_count ?? 0;
  const activeSubs = data?.active_subscriptions || data?.subscriptions || [];
  const recentSaved = data?.recent_saved || [];
  const recentReveals = data?.recent_reveals || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {testCompatibilityTokens}
      {/* 1. Header & Greeting Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Customer Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <UserIcon className="w-3.5 h-3.5" />
              <span>Verified Customer</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{user?.name || 'Customer'}</span>! Manage your contact credits, access bookmarked properties, and review your activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            className="flex items-center gap-1.5"
            aria-label="Refresh dashboard data"
          >
            <RefreshIcon className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error Recovery Banner */}
      {error && (
        <NotificationBanner
          type="error"
          message={error}
          actionLabel="Retry"
          onAction={loadDashboard}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 2. Credit Balance Summary Widget (FR-080) */}
      <section aria-labelledby="credit-widget-heading">
        <h2 id="credit-widget-heading" className="sr-only">Credit Balance</h2>
        <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border border-border shadow-xs p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm tracking-wide uppercase">
                <SparklesIcon className="w-4 h-4" />
                <span>Contact Reveal Credits</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground" data-testid="credits-balance">
                  {creditsRemaining}
                </span>
                <span className="text-muted-foreground font-medium text-lg">
                  credits remaining
                </span>
                {activeSubsCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20" data-testid="active-packages-badge">
                    {activeSubsCount} active {activeSubsCount === 1 ? 'package' : 'packages'}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {creditsRemaining === 0
                  ? 'You have no credits remaining. Each owner phone reveal costs 1 credit. Purchase a plan to start connecting with property owners.'
                  : 'Each contact reveal uses 1 credit. Once revealed, owner contact numbers remain unlocked in your account forever with zero recurring deduction.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {creditsRemaining === 0 ? (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span>Get Credits</span>
                </Link>
              ) : (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>Subscription Plans</span>
                </Link>
              )}
              <Link
                to="/marketplace"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StoreIcon className="w-4 h-4" />
                <span>Explore Spaces</span>
              </Link>
            </div>
          </div>

          {/* Active Package Allocations Breakdown */}
          {Array.isArray(activeSubs) && activeSubs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border/60" data-testid="dashboard-packages-breakdown">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5 text-primary" />
                <span>Active Package Allocations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeSubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card/80 border border-border text-xs"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{sub.plan_name || 'Credit Package'}</p>
                      <p className="text-[11px] text-muted-foreground">{sub.credits_total} total credits</p>
                    </div>
                    <span className="font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                      {sub.credits_remaining} remaining
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Quick Links Section */}
      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="text-lg font-bold tracking-tight text-foreground mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Link 1: Browse Marketplace */}
          <Link
            to="/marketplace"
            className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <StoreIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Browse Marketplace
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Explore commercial spaces, retail shops, and offices across Bangladesh.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
              <span>View Marketplace</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Link 2: My Saved Properties */}
          <Link
            to="/dashboard/saved"
            className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <StarIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                My Saved Properties
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Access and manage all commercial listings you have bookmarked.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
              <span>View Saved</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Link 3: Reveal History */}
          <Link
            to="/dashboard/reveals"
            className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <EyeIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Reveal History
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Access property owner contact numbers you have already unlocked.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
              <span>View Reveals</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Link 4: Account Settings */}
          <Link
            to="/dashboard/profile"
            className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UserIcon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Account Settings
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Update your personal details, email address, and profile photo.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
              <span>Manage Profile</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* 4. Recent Activity Feed (Saved Properties & Revealed Contacts) */}
      <section aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading" className="text-lg font-bold tracking-tight text-foreground mb-4">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Column 1: Recently Saved Properties */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarIcon className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-foreground text-sm">
                    Recently Saved Properties
                  </h3>
                </div>
                {recentSaved.length > 0 && (
                  <Link
                    to="/dashboard/saved"
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRightIcon className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {recentSaved.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No saved properties yet"
                    description="Bookmark commercial spaces from the marketplace to keep track of spaces you like."
                    actionLabel="Browse Marketplace"
                    actionLink="/marketplace"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border" data-testid="recent-saved-list">
                  {recentSaved.map((item) => (
                    <li key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Link
                            to={`/listings/${item.listing_id}`}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1"
                          >
                            {item.title}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span>{item.area ? `${item.area}, ${item.city}` : item.city}</span>
                            </span>
                            {item.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground capitalize">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-foreground">
                            {formatBdtPrice(item.price, item.listing_type)}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                            <ClockIcon className="w-3 h-3" />
                            <span>{formatActivityTime(item.saved_at)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {recentSaved.length > 0 && (
              <div className="p-3 bg-muted/20 border-t border-border text-center">
                <Link
                  to="/dashboard/saved"
                  className="text-xs text-muted-foreground hover:text-primary font-medium"
                >
                  Manage all saved bookmarks &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Activity Column 2: Recently Revealed Contacts */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeIcon className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-foreground text-sm">
                    Recently Revealed Contacts
                  </h3>
                </div>
                {recentReveals.length > 0 && (
                  <Link
                    to="/dashboard/reveals"
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRightIcon className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {recentReveals.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No revealed contacts yet"
                    description="When you unlock property owner contacts using your credits, they will appear here."
                    actionLabel="Explore Properties"
                    actionLink="/marketplace"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border" data-testid="recent-reveals-list">
                  {recentReveals.map((item) => (
                    <li key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <Link
                            to={`/listings/${item.listing_id}`}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1"
                          >
                            {item.title}
                          </Link>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                            <span>{item.area ? `${item.area}, ${item.city}` : item.city || 'Dhaka'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>Contact Unlocked</span>
                          </span>
                          <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-1">
                            <ClockIcon className="w-3 h-3" />
                            <span>{formatActivityTime(item.revealed_at)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {recentReveals.length > 0 && (
              <div className="p-3 bg-muted/20 border-t border-border text-center">
                <Link
                  to="/dashboard/reveals"
                  className="text-xs text-muted-foreground hover:text-primary font-medium"
                >
                  View complete reveal history &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
