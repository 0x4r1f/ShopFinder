import React, { useState, useEffect, useCallback, useRef } from 'react';
import adminService from '../../services/adminService.js';
import AdminRevenueChart from './AdminRevenueChart.jsx';
import AdminUserGrowthChart from './AdminUserGrowthChart.jsx';
import AdminDistributionCharts from './AdminDistributionCharts.jsx';
import AdminCreditConsumptionChart from './AdminCreditConsumptionChart.jsx';
import Spinner from '../common/Spinner.jsx';
import NotificationBanner from '../common/NotificationBanner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { Button } from '../ui/button.jsx';
import {
  RefreshIcon,
  StoreIcon,
  UserIcon,
  PhoneIcon,
  FileTextIcon,
} from '../common/Icons.jsx';

/**
 * Format numeric value to BDT string.
 */
function formatBdt(amount) {
  const val = Number(amount) || 0;
  return `৳${val.toLocaleString()}`;
}

/**
 * ShopFinder — Admin Analytics Overview Component (Phase 12, Task 12.2)
 *
 * Primary administrative intelligence and reporting container.
 * Coordinates data fetching via Express API, timeframe preset switching,
 * KPI metric presentation, and chart composition.
 *
 * Invariants:
 * - Communicates strictly with Express REST endpoint GET /api/v1/admin/analytics.
 * - Timeframe presets: 7d, 30d, 90d (D-019).
 * - Lifetime totals visually separated from period-specific metrics.
 * - Zero fabricated fallback numbers while loading or on error.
 * - Zero customer phone numbers, emails, passwords, or tokens displayed.
 *
 * @param {Object} [props]
 * @param {'7d'|'30d'|'90d'} [props.initialPeriod='30d']
 */
export default function AdminAnalyticsOverview({ initialPeriod = '30d' }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchAnalytics = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await adminService.getAdminAnalytics({
        period,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setAnalytics(data);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setError(err?.message || 'Failed to retrieve administrative platform analytics.');
    } finally {
      if (!controller.signal.aborted && abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAnalytics]);

  const summary = analytics?.summary || null;
  const userGrowth = analytics?.userGrowth || null;
  const listingVolume = analytics?.listingVolume || null;
  const revenue = analytics?.revenue || null;
  const creditConsumption = analytics?.creditConsumption || null;

  return (
    <div className="space-y-6" data-testid="admin-analytics-overview">
      {/* 1. Header & Timeframe Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground">Platform Intelligence & Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time financial revenue, user registrations, commercial inventory, and credit usage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Timeframe Presets (D-019) */}
          <div
            className="inline-flex rounded-lg border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Analytics Timeframe Preset"
          >
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              disabled={loading && period === '7d'}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === '7d'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              disabled={loading && period === '30d'}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === '30d'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setPeriod('90d')}
              disabled={loading && period === '90d'}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === '90d'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 90 Days
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="gap-1.5 h-8 text-xs"
            aria-label="Refresh platform analytics"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. Loading State */}
      {loading && !analytics && (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-card rounded-xl border border-border">
          <Spinner size="lg" label="Loading platform analytics..." />
          <p className="mt-4 text-sm text-muted-foreground">
            Aggregating platform revenue, growth trends, and inventory metrics...
          </p>
        </div>
      )}

      {/* 3. Error Banner with Retry */}
      {error && (
        <NotificationBanner
          variant="error"
          title="Failed to Load Platform Analytics"
          onClose={() => setError(null)}
        >
          <div className="space-y-3">
            <p>{error}</p>
            <Button variant="default" size="sm" onClick={fetchAnalytics}>
              Try Again
            </Button>
          </div>
        </NotificationBanner>
      )}

      {/* 4. Loaded Analytics View */}
      {analytics && (
        <div className="space-y-6">
          {/* Top 4 Primary KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Gross Platform Revenue */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Gross Platform Revenue
                </span>
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  ৳
                </span>
              </div>
              <div className="text-2xl font-extrabold text-foreground tracking-tight" data-testid="kpi-gross-revenue">
                {formatBdt(summary?.lifetime?.grossRevenueBdt)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                <span>Period ({period}):</span>
                <span className="font-semibold text-emerald-600">
                  {formatBdt(summary?.period?.revenueBdt)}
                </span>
              </div>
            </div>

            {/* KPI 2: Active Commercial Inventory */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Active Commercial Listings
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <StoreIcon className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-foreground tracking-tight" data-testid="kpi-active-listings">
                {(listingVolume?.totalActive || 0).toLocaleString()}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                <span>Pending Review:</span>
                <span className="font-semibold text-amber-600">
                  {listingVolume?.moderationStatus?.pending || 0}
                </span>
              </div>
            </div>

            {/* KPI 3: Total Platform Users */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Platform Accounts
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-foreground tracking-tight" data-testid="kpi-total-users">
                {(userGrowth?.totals?.all || 0).toLocaleString()}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                <span>New in {period}:</span>
                <span className="font-semibold text-purple-600">
                  +{userGrowth?.periodNewUsers || 0}
                </span>
              </div>
            </div>

            {/* KPI 4: Contact Reveals & Credits */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Contact Reveals Consumed
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <PhoneIcon className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-foreground tracking-tight" data-testid="kpi-credits-consumed">
                {(creditConsumption?.totalCreditsConsumed || 0).toLocaleString()}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                <span>Utilization Rate:</span>
                <span className="font-semibold text-foreground">
                  {creditConsumption?.utilizationRate || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Row 1 Visualizations: Revenue & User Growth */}
          <div className="space-y-6">
            <AdminRevenueChart
              data={revenue?.timeline || []}
              periodRevenueBdt={revenue?.periodRevenueBdt || 0}
              lifetimeRevenueBdt={revenue?.lifetimeRevenueBdt || 0}
              byPlan={revenue?.byPlan || []}
            />

            <AdminUserGrowthChart
              data={userGrowth?.timeline || []}
              totals={userGrowth?.totals || {}}
              periodNewUsers={userGrowth?.periodNewUsers || 0}
            />
          </div>

          {/* Row 2 Visualizations: Commercial Distribution */}
          <AdminDistributionCharts
            listingVolume={listingVolume || {}}
          />

          {/* Row 3 Visualizations: Credit Consumption Velocity */}
          <AdminCreditConsumptionChart
            data={creditConsumption?.timeline || []}
            summary={creditConsumption || {}}
          />
        </div>
      )}

      {/* 5. Empty State when no analytics payload exists and not loading */}
      {!loading && !error && !analytics && (
        <EmptyState
          icon={<FileTextIcon className="w-8 h-8 text-muted-foreground" />}
          title="No Analytics Available"
          description="Platform analytics data could not be computed for this period."
          action={
            <Button variant="outline" size="sm" onClick={fetchAnalytics}>
              Reload Analytics
            </Button>
          }
        />
      )}
    </div>
  );
}

