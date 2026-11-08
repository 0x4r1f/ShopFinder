import { test, it, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import adminService, { getAdminAnalytics } from '../services/adminService.js';
import { api } from '../services/api.js';
import AdminAnalyticsOverview from '../components/admin/AdminAnalyticsOverview.jsx';
import AdminRevenueChart from '../components/admin/AdminRevenueChart.jsx';
import AdminUserGrowthChart from '../components/admin/AdminUserGrowthChart.jsx';
import AdminDistributionCharts from '../components/admin/AdminDistributionCharts.jsx';
import AdminCreditConsumptionChart from '../components/admin/AdminCreditConsumptionChart.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

// Mock User
const mockAdminUser = {
  id: 'usr_admin_test_01',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

// Mock Analytics Data Payload matching actual backend contract
const mockAnalyticsData = {
  period: '30d',
  timeframe: {
    startDate: '2026-10-10',
    endDate: '2026-11-08',
    days: 30,
  },
  summary: {
    lifetime: {
      grossRevenueBdt: 128850,
      totalUsers: 580,
      activeListings: 142,
      creditsConsumed: 1240,
      utilizationRate: 14.4,
    },
    period: {
      revenueBdt: 24500,
      newUsers: 64,
      contactReveals: 142,
      successfulTransactions: 35,
    },
  },
  userGrowth: {
    totals: {
      all: 580,
      customers: 420,
      owners: 155,
      admins: 5,
      active: 574,
      deactivated: 6,
    },
    periodNewUsers: 64,
    timeline: [
      { date: '2026-11-01', label: 'Nov 1', customer: 4, owner: 1, admin: 0, total: 5 },
      { date: '2026-11-02', label: 'Nov 2', customer: 3, owner: 2, admin: 0, total: 5 },
    ],
  },
  listingVolume: {
    totalActive: 142,
    byCity: [
      { city: 'Dhaka', count: 88, percentage: 62.0 },
      { city: 'Chittagong', count: 34, percentage: 23.9 },
      { city: 'Sylhet', count: 10, percentage: 7.0 },
      { city: 'Rajshahi', count: 5, percentage: 3.5 },
      { city: 'Khulna', count: 3, percentage: 2.1 },
      { city: 'Other', count: 2, percentage: 1.4 },
    ],
    byCategory: [
      { category: 'retail', count: 52, percentage: 36.6 },
      { category: 'office', count: 48, percentage: 33.8 },
      { category: 'warehouse', count: 20, percentage: 14.1 },
      { category: 'showroom', count: 12, percentage: 8.5 },
      { category: 'restaurant', count: 6, percentage: 4.2 },
      { category: 'industrial', count: 3, percentage: 2.1 },
      { category: 'other', count: 1, percentage: 0.7 },
    ],
    byType: {
      rent: { count: 110, percentage: 77.5 },
      sale: { count: 32, percentage: 22.5 },
    },
    moderationStatus: {
      approved: 142,
      pending: 8,
      rejected: 14,
      archived: 6,
      total: 170,
    },
  },
  revenue: {
    lifetimeRevenueBdt: 128850,
    successfulTransactions: 185,
    pendingTransactions: 12,
    failedTransactions: 7,
    totalTransactions: 204,
    successRate: 90.7,
    periodRevenueBdt: 24500,
    periodSuccessfulTransactions: 35,
    byPlan: [
      { planId: 'p_pro', name: 'Pro', price: 999, count: 75, revenueBdt: 74925, revenuePercentage: 58.1 },
      { planId: 'p_starter', name: 'Starter', price: 299, count: 110, revenueBdt: 32890, revenuePercentage: 25.5 },
    ],
    timeline: [
      { date: '2026-11-01', label: 'Nov 1', revenueBdt: 3594, transactions: 4 },
      { date: '2026-11-02', label: 'Nov 2', revenueBdt: 1998, transactions: 2 },
    ],
  },
  creditConsumption: {
    totalCreditsPurchased: 8600,
    totalCreditsConsumed: 1240,
    totalCreditsRemaining: 7360,
    utilizationRate: 14.4,
    periodRevealsCount: 142,
    averageDailyReveals: 4.7,
    timeline: [
      { date: '2026-11-01', label: 'Nov 1', reveals: 8 },
      { date: '2026-11-02', label: 'Nov 2', reveals: 6 },
    ],
  },
};

function renderWithAuth(ui, { user = mockAdminUser, initialRoute = '/admin-dashboard' } = {}) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 12, Task 12.2 — Admin Analytics Frontend Unit & Integration Tests', () => {
  // --------------------------------------------------------------------------
  // 1. Admin API Service Tests
  // --------------------------------------------------------------------------
  describe('adminService.getAdminAnalytics API Client', () => {
    let originalGet;

    beforeEach(() => {
      originalGet = api.get;
    });

    afterEach(() => {
      api.get = originalGet;
    });

    it('invokes GET /api/v1/admin/analytics with default period 30d', async () => {
      let capturedEndpoint = '';
      let capturedConfig = null;

      api.get = async (endpoint, config) => {
        capturedEndpoint = endpoint;
        capturedConfig = config;
        return { success: true, data: mockAnalyticsData };
      };

      const result = await getAdminAnalytics();
      assert.equal(capturedEndpoint, '/api/v1/admin/analytics');
      assert.deepEqual(capturedConfig.params, { period: '30d' });
      assert.equal(result.period, '30d');
      assert.equal(result.summary.lifetime.grossRevenueBdt, 128850);
    });

    it('passes custom period (7d, 90d) and AbortSignal', async () => {
      let capturedConfig = null;
      const controller = new AbortController();

      api.get = async (endpoint, config) => {
        capturedConfig = config;
        return { success: true, data: { ...mockAnalyticsData, period: '7d' } };
      };

      const result = await adminService.getAdminAnalytics({
        period: '7d',
        signal: controller.signal,
      });

      assert.deepEqual(capturedConfig.params, { period: '7d' });
      assert.equal(capturedConfig.signal, controller.signal);
      assert.equal(result.period, '7d');
    });

    it('propagates API errors without inventing fabricated fallback metrics', async () => {
      api.get = async () => {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      };

      await assert.rejects(
        () => getAdminAnalytics(),
        (err) => err.status === 401 && err.message === 'Unauthorized'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. AdminRevenueChart Component
  // --------------------------------------------------------------------------
  describe('AdminRevenueChart Component', () => {
    it('renders gross platform revenue headers, period and lifetime totals', () => {
      const html = renderToStaticMarkup(
        <AdminRevenueChart
          data={mockAnalyticsData.revenue.timeline}
          periodRevenueBdt={mockAnalyticsData.revenue.periodRevenueBdt}
          lifetimeRevenueBdt={mockAnalyticsData.revenue.lifetimeRevenueBdt}
          byPlan={mockAnalyticsData.revenue.byPlan}
        />
      );

      assert.ok(html.includes('Gross Platform Revenue (BDT)'));
      assert.ok(html.includes('Successful Only'));
      assert.ok(html.includes('৳24,500')); // Period
      assert.ok(html.includes('৳128,850')); // Lifetime
    });

    it('renders plan contribution breakdown (Starter vs Pro)', () => {
      const html = renderToStaticMarkup(
        <AdminRevenueChart
          data={mockAnalyticsData.revenue.timeline}
          periodRevenueBdt={mockAnalyticsData.revenue.periodRevenueBdt}
          lifetimeRevenueBdt={mockAnalyticsData.revenue.lifetimeRevenueBdt}
          byPlan={mockAnalyticsData.revenue.byPlan}
        />
      );

      assert.ok(html.includes('Pro Package'));
      assert.ok(html.includes('75 sold'));
      assert.ok(html.includes('Starter Package'));
      assert.ok(html.includes('110 sold'));
      assert.ok(html.includes('Package Sales Contribution (Lifetime)'));
    });

    it('renders friendly fallback message when data is empty', () => {
      const html = renderToStaticMarkup(<AdminRevenueChart data={[]} />);
      assert.ok(html.includes('No financial transaction data recorded for this timeframe.'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. AdminUserGrowthChart Component
  // --------------------------------------------------------------------------
  describe('AdminUserGrowthChart Component', () => {
    it('renders user growth header, period signups, and role distribution chips', () => {
      const html = renderToStaticMarkup(
        <AdminUserGrowthChart
          data={mockAnalyticsData.userGrowth.timeline}
          totals={mockAnalyticsData.userGrowth.totals}
          periodNewUsers={mockAnalyticsData.userGrowth.periodNewUsers}
        />
      );

      assert.ok(html.includes('User Registration &amp; Growth Dynamics') || html.includes('User Registration & Growth Dynamics'));
      assert.ok(html.includes('+64')); // Period signups
      assert.ok(html.includes('580')); // Total accounts
      assert.ok(html.includes('Customers:'));
      assert.ok(html.includes('420'));
      assert.ok(html.includes('Owners:'));
      assert.ok(html.includes('155'));
      assert.ok(html.includes('Admins:'));
      assert.ok(html.includes('5'));
    });

    it('renders friendly fallback message when data is empty', () => {
      const html = renderToStaticMarkup(<AdminUserGrowthChart data={[]} />);
      assert.ok(html.includes('No user registration data recorded for this timeframe.'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. AdminDistributionCharts Component (D-020)
  // --------------------------------------------------------------------------
  describe('AdminDistributionCharts Component', () => {
    it('renders Top 5 cities + Other (D-020) with inventory counts and percentages', () => {
      const html = renderToStaticMarkup(
        <AdminDistributionCharts listingVolume={mockAnalyticsData.listingVolume} />
      );

      assert.ok(html.includes('Inventory by Metropolitan City'));
      assert.ok(html.includes('Top 5 + Other'));
      assert.ok(html.includes('Dhaka'));
      assert.ok(html.includes('88'));
      assert.ok(html.includes('62%') || html.includes('62.0%'));
      assert.ok(html.includes('Chittagong'));
      assert.ok(html.includes('Other'));
      assert.ok(html.includes('1.4%'));
    });

    it('renders commercial categories across all 7 standard types', () => {
      const html = renderToStaticMarkup(
        <AdminDistributionCharts listingVolume={mockAnalyticsData.listingVolume} />
      );

      assert.ok(html.includes('Commercial Category Breakdown'));
      assert.ok(html.includes('Retail'));
      assert.ok(html.includes('Office'));
      assert.ok(html.includes('Warehouse'));
      assert.ok(html.includes('Showroom'));
    });

    it('renders commercial rent vs sale listing type ratios and moderation status', () => {
      const html = renderToStaticMarkup(
        <AdminDistributionCharts listingVolume={mockAnalyticsData.listingVolume} />
      );

      assert.ok(html.includes('Commercial Listing Type Ratio'));
      assert.ok(html.includes('For Rent: 110 (77.5%)'));
      assert.ok(html.includes('For Sale: 32 (22.5%)'));
      assert.ok(html.includes('Listing Moderation Distribution'));
      assert.ok(html.includes('Approved'));
      assert.ok(html.includes('Pending'));
      assert.ok(html.includes('Rejected'));
      assert.ok(html.includes('Archived'));
    });
  });

  // --------------------------------------------------------------------------
  // 5. AdminCreditConsumptionChart Component
  // --------------------------------------------------------------------------
  describe('AdminCreditConsumptionChart Component', () => {
    it('renders credit consumption header, 1 Reveal = 1 Credit badge, and pool summary', () => {
      const html = renderToStaticMarkup(
        <AdminCreditConsumptionChart
          data={mockAnalyticsData.creditConsumption.timeline}
          summary={mockAnalyticsData.creditConsumption}
        />
      );

      assert.ok(html.includes('Credit Consumption &amp; Reveal Velocity') || html.includes('Credit Consumption & Reveal Velocity'));
      assert.ok(html.includes('1 Reveal = 1 Credit'));
      assert.ok(html.includes('Credits Purchased'));
      assert.ok(html.includes('8,600'));
      assert.ok(html.includes('Credits Consumed'));
      assert.ok(html.includes('1,240'));
      assert.ok(html.includes('Remaining Pool'));
      assert.ok(html.includes('7,360'));
      assert.ok(html.includes('Platform Utilization'));
      assert.ok(html.includes('14.4%'));
      assert.ok(html.includes('142')); // Period reveals
      assert.ok(html.includes('4.7/day')); // Daily velocity
    });

    it('renders friendly fallback message when data is empty', () => {
      const html = renderToStaticMarkup(<AdminCreditConsumptionChart data={[]} />);
      assert.ok(html.includes('No contact reveal activity recorded for this timeframe.'));
    });
  });

  // --------------------------------------------------------------------------
  // 6. AdminAnalyticsOverview Component
  // --------------------------------------------------------------------------
  describe('AdminAnalyticsOverview Component', () => {
    it('renders section title, timeframe controls, and refresh action', () => {
      const html = renderWithAuth(<AdminAnalyticsOverview />);
      assert.ok(html.includes('Platform Intelligence &amp; Analytics') || html.includes('Platform Intelligence & Analytics'));
      assert.ok(html.includes('Last 7 Days'));
      assert.ok(html.includes('Last 30 Days'));
      assert.ok(html.includes('Last 90 Days'));
      assert.ok(html.includes('aria-label="Refresh platform analytics"'));
    });

    it('renders initial loading state with accessible status label', () => {
      const html = renderWithAuth(<AdminAnalyticsOverview />);
      // Initial SSR render starts with loading = true
      assert.ok(html.includes('Loading platform analytics...'));
      assert.ok(html.includes('Aggregating platform revenue, growth trends, and inventory metrics...'));
    });

    it('implements post-await abort check preventing stale responses from overwriting analytics', () => {
      const overviewSource = fs.readFileSync(
        path.join(clientSrcDir, 'components', 'admin', 'AdminAnalyticsOverview.jsx'),
        'utf8'
      );

      // Verify the post-await guard is strictly present
      assert.match(
        overviewSource,
        /if\s*\(\s*controller\.signal\.aborted\s*\)\s*return;/i,
        'AdminAnalyticsOverview must verify signal.aborted after await to prevent race condition overwrite'
      );

      // Verify the finally block guards against clearing loading for a newer active request
      assert.match(
        overviewSource,
        /abortControllerRef\.current\s*===\s*controller/i,
        'AdminAnalyticsOverview finally block must confirm controller identity before resetting loading'
      );
    });

    it('simulates race condition: aborted older request is suppressed and leaves newer state intact', async () => {
      let state = { analytics: null, loading: true };
      let activeControllerRef = { current: null };

      async function simulatedFetch(targetPeriod, delayMs, payload) {
        if (activeControllerRef.current) {
          activeControllerRef.current.abort();
        }
        const controller = new AbortController();
        activeControllerRef.current = controller;
        state.loading = true;

        try {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          // Post-await guard
          if (controller.signal.aborted) return;
          state.analytics = payload;
        } finally {
          if (!controller.signal.aborted && activeControllerRef.current === controller) {
            state.loading = false;
          }
        }
      }

      // Start Request 1 (slow 30d request: 40ms)
      const p1 = simulatedFetch('30d', 40, { period: '30d', data: 'STALE_DATA' });

      // After 10ms, user switches to 7d (fast request: 15ms)
      await new Promise((r) => setTimeout(r, 10));
      const p2 = simulatedFetch('7d', 15, { period: '7d', data: 'FRESH_DATA' });

      await Promise.all([p1, p2]);

      // Request 2 must have won and Request 1 must NOT have overwritten Request 2
      assert.strictEqual(state.analytics?.period, '7d');
      assert.strictEqual(state.analytics?.data, 'FRESH_DATA');
      assert.strictEqual(state.loading, false);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Security, Invariant & Privacy Audits
  // --------------------------------------------------------------------------
  describe('Security & Privacy Audits (D-007, D-010, D-014)', () => {
    it('adminService does not import PocketBase directly (D-007)', () => {
      const adminServiceCode = fs.readFileSync(path.join(clientSrcDir, 'services/adminService.js'), 'utf8');
      assert.equal(adminServiceCode.includes("from 'pocketbase'"), false);
      assert.equal(adminServiceCode.includes('new PocketBase'), false);
    });

    it('all admin analytics components avoid direct PocketBase imports (D-007)', () => {
      const files = [
        'components/admin/AdminAnalyticsOverview.jsx',
        'components/admin/AdminRevenueChart.jsx',
        'components/admin/AdminUserGrowthChart.jsx',
        'components/admin/AdminDistributionCharts.jsx',
        'components/admin/AdminCreditConsumptionChart.jsx',
      ];

      for (const file of files) {
        const code = fs.readFileSync(path.join(clientSrcDir, file), 'utf8');
        assert.equal(code.includes("from 'pocketbase'"), false, `${file} must not import pocketbase`);
        assert.equal(code.includes('new PocketBase'), false, `${file} must not instantiate PocketBase`);
      }
    });

    it('D-014 Privacy Audit: Zero private phone numbers, emails, or credentials in rendered markup', () => {
      const html = renderToStaticMarkup(
        <div>
          <AdminRevenueChart
            data={mockAnalyticsData.revenue.timeline}
            periodRevenueBdt={mockAnalyticsData.revenue.periodRevenueBdt}
            lifetimeRevenueBdt={mockAnalyticsData.revenue.lifetimeRevenueBdt}
            byPlan={mockAnalyticsData.revenue.byPlan}
          />
          <AdminUserGrowthChart
            data={mockAnalyticsData.userGrowth.timeline}
            totals={mockAnalyticsData.userGrowth.totals}
            periodNewUsers={mockAnalyticsData.userGrowth.periodNewUsers}
          />
          <AdminDistributionCharts listingVolume={mockAnalyticsData.listingVolume} />
          <AdminCreditConsumptionChart
            data={mockAnalyticsData.creditConsumption.timeline}
            summary={mockAnalyticsData.creditConsumption}
          />
        </div>
      );

      assert.equal(html.includes('password'), false);
      assert.equal(html.includes('tokenKey'), false);
      assert.equal(html.includes('owner_contacts'), false);
      assert.equal(html.includes('admin@shopfinder.test'), false);
      assert.equal(html.includes('+880'), false);
    });
  });
});

