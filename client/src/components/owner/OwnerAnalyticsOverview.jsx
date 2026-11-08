import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ownerService from '../../services/ownerService.js';
import OwnerEngagementChart from './OwnerEngagementChart.jsx';
import Spinner from '../common/Spinner.jsx';
import NotificationBanner from '../common/NotificationBanner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import {
  EyeIcon,
  PhoneIcon,
  BookmarkIcon,
  BuildingIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from '../common/Icons.jsx';

/**
 * ShopFinder — Owner Analytics Overview Panel (Phase 12, Task 12.1)
 *
 * Provides commercial property owners with actionable engagement metrics:
 * - Aggregate KPI summary cards (Views, Inquiries, Conversion Rate, Saves).
 * - Timeframe selector (7 Days / 30 Days).
 * - Daily engagement time-series chart via Recharts.
 * - Listing-level performance comparison table.
 * - Loading, error, and empty state handling.
 */
export default function OwnerAnalyticsOverview({ initialListingId = null }) {
  const [period, setPeriod] = useState('7d');
  const [selectedListingId, setSelectedListingId] = useState(initialListingId || '');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await ownerService.getOwnerAnalytics({
        period,
        listingId: selectedListingId || null,
      });

      setAnalytics(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve analytics metrics');
    } finally {
      setLoading(false);
    }
  }, [period, selectedListingId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = analytics?.summary || {
    total_views: 0,
    total_favorites: 0,
    total_reveals: 0,
    conversion_rate: 0.0,
    active_listings: 0,
  };

  const listings = analytics?.listings || [];
  const dailyEngagement = analytics?.daily_engagement || [];

  return (
    <div className="space-y-6" data-testid="owner-analytics-overview">
      {/* ===================================================================== */}
      {/* 1. Analytics Controls Bar (Timeframe & Listing Filter)                */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground">Performance & Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track commercial listing views, customer inquiries, and conversion efficiency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe toggle buttons */}
          <div
            className="inline-flex rounded-lg border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Analytics Timeframe"
          >
            <button
              type="button"
              onClick={() => setPeriod('7d')}
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
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                period === '30d'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Optional listing filter */}
          {listings.length > 1 && (
            <select
              aria-label="Filter by property"
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="text-xs font-medium rounded-lg border border-border bg-background px-3 py-1.5 text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Properties ({listings.length})</option>
              {listings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title.length > 28 ? `${item.title.slice(0, 28)}...` : item.title}
                </option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            title="Refresh analytics data"
            aria-label="Refresh analytics data"
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Feedback / Error State                                             */}
      {/* ===================================================================== */}
      {error && (
        <NotificationBanner
          variant="error"
          title="Unable to load analytics"
          message={error}
          actionLabel="Retry"
          onAction={fetchAnalytics}
        />
      )}

      {/* ===================================================================== */}
      {/* 3. Loading State                                                      */}
      {/* ===================================================================== */}
      {loading && !analytics ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Spinner size="lg" className="text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Calculating engagement metrics...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregating page views, inquiries, and conversion ratios.
          </p>
        </div>
      ) : listings.length === 0 && !loading ? (
        /* Empty State */
        <EmptyState
          icon={<BuildingIcon className="w-10 h-10 text-muted-foreground" />}
          title="No analytics recorded yet"
          description="You do not have any active properties published. Create and publish commercial listings to start measuring engagement."
          actionLabel="Add New Listing"
          actionLink="/owner-dashboard/listings/new"
        />
      ) : (
        <>
          {/* ================================================================= */}
          {/* 4. KPI Summary Cards                                              */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Views */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Views
                </span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <EyeIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2" data-testid="kpi-total-views">
                {summary.total_views.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Public property detail views ({period})
              </p>
            </div>

            {/* Total Inquiries (Reveals) */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Inquiries
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <PhoneIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2" data-testid="kpi-total-reveals">
                {summary.total_reveals.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contact reveals unlocked by customers
              </p>
            </div>

            {/* Conversion Rate */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conversion Rate
                </span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <CheckCircleIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2" data-testid="kpi-conversion-rate">
                {summary.conversion_rate}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.total_views > 0
                  ? 'Views converted to contact inquiries'
                  : 'Requires views to compute ratio'}
              </p>
            </div>

            {/* Total Favorites */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Saved / Favorites
                </span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <BookmarkIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mt-2" data-testid="kpi-total-favorites">
                {summary.total_favorites.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Bookmarked by prospective tenants
              </p>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 5. Daily Engagement Trends Chart                                  */}
          {/* ================================================================= */}
          <div className="p-5 rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-border/60">
              <div>
                <h3 className="font-bold text-base text-foreground">Daily Engagement Trends</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Day-by-day views, contact reveals, and bookmark activity over {period === '30d' ? '30 days' : '7 days'}.
                </p>
              </div>

              <div className="text-xs text-muted-foreground font-medium">
                {period === '30d' ? 'Monthly View' : 'Weekly View'}
              </div>
            </div>

            <OwnerEngagementChart data={dailyEngagement} />
          </div>

          {/* ================================================================= */}
          {/* 6. Listing Performance Comparison Table                           */}
          {/* ================================================================= */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-base text-foreground">Listing Performance Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparison of views, customer inquiries, and conversion efficiency across properties.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold text-[11px] border-b border-border">
                  <tr>
                    <th scope="col" className="px-4 py-3">Property</th>
                    <th scope="col" className="px-4 py-3">Location</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Views</th>
                    <th scope="col" className="px-4 py-3 text-right">Inquiries</th>
                    <th scope="col" className="px-4 py-3 text-right">Conversion</th>
                    <th scope="col" className="px-4 py-3 text-right">Saves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-card-foreground">
                  {listings.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`analytics-row-${item.id}`}
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/listings/${item.id}`}
                          className="hover:text-primary transition-colors line-clamp-1"
                          title={item.title}
                        >
                          {item.title}
                        </Link>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {item.category} • ৳{Number(item.price).toLocaleString()}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {item.area}, {item.city}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : item.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.status === 'approved' && <CheckCircleIcon className="w-3 h-3" />}
                          {item.status === 'pending' && <ClockIcon className="w-3 h-3" />}
                          {item.status === 'rejected' && <AlertCircleIcon className="w-3 h-3" />}
                          <span className="capitalize">{item.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {item.views}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.reveals}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            item.conversion_rate > 5
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : item.conversion_rate > 0
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {item.conversion_rate}%
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right text-muted-foreground font-medium">
                        {item.favorites}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

