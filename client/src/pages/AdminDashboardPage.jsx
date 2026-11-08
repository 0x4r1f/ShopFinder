import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import adminService from '../services/adminService.js';
import AdminAnalyticsOverview from '../components/admin/AdminAnalyticsOverview.jsx';
import { Button } from '../components/ui/button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  ShieldCheckIcon,
  StoreIcon,
  ClockIcon,
  UserIcon,
  RefreshIcon,
  FileTextIcon,
  EyeIcon,
} from '../components/common/Icons.jsx';

/**
 * Format ISO datetime string into human-readable timestamp (e.g. "Nov 7, 2026, 08:30 PM").
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
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export const ADMIN_DASHBOARD_TABS = ['overview', 'analytics'];

/**
 * Pure WAI-ARIA tab navigation helper for roving focus across tabs.
 */
export function getNextActiveTab(currentTab, key) {
  const currentIndex = ADMIN_DASHBOARD_TABS.indexOf(currentTab);
  if (currentIndex === -1) return currentTab;

  if (key === 'ArrowRight') {
    return ADMIN_DASHBOARD_TABS[(currentIndex + 1) % ADMIN_DASHBOARD_TABS.length];
  }
  if (key === 'ArrowLeft') {
    return ADMIN_DASHBOARD_TABS[(currentIndex - 1 + ADMIN_DASHBOARD_TABS.length) % ADMIN_DASHBOARD_TABS.length];
  }
  if (key === 'Home') {
    return ADMIN_DASHBOARD_TABS[0];
  }
  if (key === 'End') {
    return ADMIN_DASHBOARD_TABS[ADMIN_DASHBOARD_TABS.length - 1];
  }
  return currentTab;
}

/**
 * ShopFinder — Admin Dashboard Page (Phase 7, Task 7.1)
 *
 * Provides platform administrators with live overview metrics and recent activity:
 * 1. KPI statistics cards (Total Listings, Pending Review, Total Users, Customers, Owners, Admins).
 * 2. Recent platform activity feed (Listing submissions & User registrations).
 * 3. Loading, empty, and error recovery states.
 */
export default function AdminDashboardPage({ initialStats = null, initialTab = 'overview' }) {
  let location = null;
  try {
    location = useLocation();
  } catch {
    location = null;
  }

  const effectiveInitialTab = initialTab || location?.state?.tab || 'overview';
  const [activeTab, setActiveTab] = useState(effectiveInitialTab);
  const [hasOpenedAnalytics, setHasOpenedAnalytics] = useState(effectiveInitialTab === 'analytics');

  const overviewTabRef = useRef(null);
  const analyticsTabRef = useRef(null);

  const selectTab = useCallback((tabId, shouldFocus = false) => {
    setActiveTab(tabId);
    if (tabId === 'analytics') {
      setHasOpenedAnalytics(true);
    }
    if (shouldFocus) {
      if (tabId === 'overview') {
        overviewTabRef.current?.focus();
      } else if (tabId === 'analytics') {
        analyticsTabRef.current?.focus();
      }
    }
  }, []);

  const handleTabKeyDown = (e) => {
    const targetTab = getNextActiveTab(activeTab, e.key);
    if (targetTab !== activeTab) {
      e.preventDefault();
      selectTab(targetTab, true);
    }
  };

  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const loadStats = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await adminService.getAdminStats({ signal: controller.signal });
      setStats(data);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setError(err?.message || 'Failed to load platform administrative statistics.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialStats) {
      loadStats();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadStats, initialStats]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* 1. Header & Identity Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Admin Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheckIcon className="w-3.5 h-3.5" />
              <span>System Administrator</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live overview of commercial listings, platform users, and recent system activity.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={loading}
            className="gap-1.5"
            aria-label="Refresh statistics"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. Navigation Tabs (Overview & Activity vs Platform Analytics) per D-021 */}
      <div
        className="flex items-center gap-6 border-b border-border"
        role="tablist"
        aria-label="Admin Dashboard Views"
      >
        <button
          ref={overviewTabRef}
          type="button"
          role="tab"
          id="admin-tab-overview"
          aria-selected={activeTab === 'overview'}
          aria-controls="admin-panel-overview"
          tabIndex={activeTab === 'overview' ? 0 : -1}
          onClick={() => selectTab('overview')}
          onKeyDown={handleTabKeyDown}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileTextIcon className="w-4 h-4" />
          <span>Overview & Activity</span>
        </button>

        <button
          ref={analyticsTabRef}
          type="button"
          role="tab"
          id="admin-tab-analytics"
          aria-selected={activeTab === 'analytics'}
          aria-controls="admin-panel-analytics"
          tabIndex={activeTab === 'analytics' ? 0 : -1}
          onClick={() => selectTab('analytics')}
          onKeyDown={handleTabKeyDown}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <EyeIcon className="w-4 h-4" />
          <span>Platform Analytics</span>
        </button>
      </div>

      {/* 3. Tab Panel 1: Overview & Activity */}
      <div
        role="tabpanel"
        id="admin-panel-overview"
        aria-labelledby="admin-tab-overview"
        className={activeTab === 'overview' ? 'space-y-8' : 'hidden'}
      >
        {/* Loading State */}
        {loading && !stats && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Spinner size="lg" label="Loading platform statistics..." />
            <p className="mt-4 text-sm text-muted-foreground">
              Fetching platform overview metrics from database...
            </p>
          </div>
        )}

        {/* Error Banner with Retry */}
        {error && (
          <NotificationBanner
            variant="error"
            title="Failed to Load Statistics"
            onClose={() => setError(null)}
          >
            <div className="space-y-3">
              <p>{error}</p>
              <Button variant="default" size="sm" onClick={loadStats}>
                Try Again
              </Button>
            </div>
          </NotificationBanner>
        )}

        {/* Dashboard Content (Stats & Recent Activity) */}
        {stats && (
          <div className="space-y-8">
          {/* Primary Statistics Cards */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">
              Platform Metrics Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Total Commercial Listings */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Commercial Listings
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <StoreIcon className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight text-foreground" data-testid="stat-total-listings">
                  {stats.totalListings.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All published, pending, and archived properties
                </p>
              </div>

              {/* Pending Review */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Pending Review
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <ClockIcon className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground" data-testid="stat-pending-listings">
                    {stats.pendingListings.toLocaleString()}
                  </span>
                  {stats.pendingListings > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      Needs Action
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Submissions awaiting administrative moderation
                </p>
              </div>

              {/* Total Registered Users */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Registered Users
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight text-foreground" data-testid="stat-total-users">
                  {stats.totalUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all customer, owner, and admin accounts
                </p>
              </div>
            </div>
          </div>

          {/* User Role Breakdown Cards */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">
              Registered Accounts by Role
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Customers */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Customers</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-border text-muted-foreground capitalize">
                    Buyer / Tenant
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground" data-testid="stat-role-customers">
                  {stats.usersByRole?.customers?.toLocaleString() || 0}
                </div>
                <span className="text-xs text-muted-foreground">
                  Seeking commercial spaces
                </span>
              </div>

              {/* Property Owners */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Property Owners</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-border text-muted-foreground capitalize">
                    Seller / Landlord
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground" data-testid="stat-role-owners">
                  {stats.usersByRole?.owners?.toLocaleString() || 0}
                </div>
                <span className="text-xs text-muted-foreground">
                  Listing commercial real estate
                </span>
              </div>

              {/* Administrators */}
              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Administrators</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
                    Platform Admin
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold text-foreground" data-testid="stat-role-admins">
                  {stats.usersByRole?.admins?.toLocaleString() || 0}
                </div>
                <span className="text-xs text-muted-foreground">
                  Full administrative permissions
                </span>
              </div>
            </div>
          </div>

          {/* Recent Platform Activity */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Recent Platform Activity
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest property listing submissions and new user registrations
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-border text-muted-foreground">
                Latest {stats.recentActivity?.length || 0} Events
              </span>
            </div>

            {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
              <div className="py-12">
                <EmptyState
                  icon={<FileTextIcon className="w-7 h-7 text-muted-foreground" />}
                  title="No Recent Activity"
                  description="No listing submissions or user registrations have occurred recently."
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-4 sm:px-6 hover:bg-muted/40 transition-colors flex items-center justify-between gap-4"
                    data-testid="activity-item"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          activity.type === 'listing_submission'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}
                      >
                        {activity.type === 'listing_submission' ? (
                          <StoreIcon className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-blue-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={activity.title}>
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatActivityTime(activity.timestamp)}
                      </span>
                      <span
                        className={`inline-flex items-center text-[10px] capitalize px-2 py-0.5 rounded font-medium ${
                          activity.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : activity.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {activity.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* 4. Tab Panel 2: Platform Analytics per D-021 */}
      <div
        role="tabpanel"
        id="admin-panel-analytics"
        aria-labelledby="admin-tab-analytics"
        className={activeTab === 'analytics' ? 'space-y-6' : 'hidden'}
      >
        {hasOpenedAnalytics && <AdminAnalyticsOverview />}
      </div>
    </div>
  );
}
