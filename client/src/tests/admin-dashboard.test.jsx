import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import adminService from '../services/adminService.js';
import AdminDashboardPage, {
  formatActivityTime,
  getNextActiveTab,
  ADMIN_DASHBOARD_TABS,
} from '../pages/AdminDashboardPage.jsx';
import Header from '../components/layout/Header.jsx';
import MobileNav from '../components/layout/MobileNav.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth User Fixtures
 */
const mockAdminUser = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

const mockOwnerUser = {
  id: 'usr_owner1234567',
  name: 'Tariq Rahman',
  email: 'tariq@example.com',
  role: 'owner',
};

const mockCustomerUser = {
  id: 'usr_cust12345678',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
};

/**
 * Mock Stats Fixtures
 */
const mockStatsData = {
  totalListings: 42,
  pendingListings: 7,
  totalUsers: 156,
  usersByRole: {
    customers: 120,
    owners: 32,
    admins: 4,
  },
  recentActivity: [
    {
      id: 'activity_lst_001',
      type: 'listing_submission',
      title: 'Gulshan Prime Tower Level 4',
      subtitle: 'Gulshan, Dhaka • rent',
      timestamp: '2026-11-07T12:00:00.000Z',
      status: 'pending',
    },
    {
      id: 'activity_usr_002',
      type: 'user_registration',
      title: 'Rahim Khan',
      subtitle: 'Registered as owner',
      timestamp: '2026-11-07T11:30:00.000Z',
      status: 'active',
    },
  ],
};

function renderWithAuth(component, user = mockAdminUser) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    loading: false,
    logout: () => {},
    updateUser: () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/admin-dashboard']}>
        {component}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function renderRoute(routePath, user = mockAdminUser) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    loading: false,
    logout: () => {},
    updateUser: () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[routePath]}>
        <AppRouter />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 7, Task 7.1 — Admin Dashboard Overview (Frontend Unit & Integration)', () => {
  let originalGetAdminStats;
  let originalFetch;

  beforeEach(() => {
    originalGetAdminStats = adminService.getAdminStats;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    adminService.getAdminStats = originalGetAdminStats;
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. adminService Client Contract
  // =========================================================================
  describe('1. adminService Client Contract', () => {
    test('1.1 adminService exposes getAdminStats function', () => {
      assert.strictEqual(typeof adminService.getAdminStats, 'function', 'getAdminStats must be defined');
    });

    test('1.2 getAdminStats uses GET /api/v1/admin/stats with credentials', async () => {
      let requestedUrl = null;
      let requestedOptions = null;

      globalThis.fetch = async (url, options) => {
        requestedUrl = url;
        requestedOptions = options;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: mockStatsData,
          }),
        };
      };

      const result = await adminService.getAdminStats();
      assert.ok(requestedUrl.includes('/api/v1/admin/stats'), 'Must request /api/v1/admin/stats');
      assert.strictEqual(requestedOptions.credentials, 'include', 'Must include credentials');
      assert.strictEqual(result.totalListings, 42);
    });

    test('1.3 adminService exposes getPendingListings function (Task 7.2)', () => {
      assert.strictEqual(typeof adminService.getPendingListings, 'function', 'getPendingListings must be defined');
    });

    test('1.4 getPendingListings uses GET /api/v1/admin/listings/pending with credentials and query params', async () => {
      let requestedUrl = null;
      let requestedOptions = null;

      globalThis.fetch = async (url, options) => {
        requestedUrl = url;
        requestedOptions = options;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              listings: [{ id: 'lst_pending_01', status: 'pending' }],
              pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
            },
          }),
        };
      };

      const result = await adminService.getPendingListings({ page: 2, perPage: 20, sort: 'oldest' });
      assert.ok(requestedUrl.includes('/api/v1/admin/listings/pending'), 'Must request /api/v1/admin/listings/pending');
      assert.ok(requestedUrl.includes('page=2'), 'Must include page=2 query param');
      assert.ok(requestedUrl.includes('perPage=20'), 'Must include perPage=20 query param');
      assert.ok(requestedUrl.includes('sort=oldest'), 'Must include sort=oldest query param');
      assert.strictEqual(requestedOptions.credentials, 'include', 'Must include credentials');
      assert.strictEqual(result.listings.length, 1);
      assert.strictEqual(result.pagination.totalItems, 1);
    });

    test('1.5 adminService exposes approveListing, rejectListing, and archiveListing (Task 7.3)', async () => {
      assert.strictEqual(typeof adminService.approveListing, 'function');
      assert.strictEqual(typeof adminService.rejectListing, 'function');
      assert.strictEqual(typeof adminService.archiveListing, 'function');

      let lastUrl = null;
      let lastMethod = null;
      let lastBody = null;

      globalThis.fetch = async (url, options) => {
        lastUrl = url;
        lastMethod = options.method;
        lastBody = options.body;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { listing: { id: 'lst_mod_1', status: 'approved' } },
          }),
        };
      };

      // Test approveListing
      await adminService.approveListing('lst_mod_1');
      assert.ok(lastUrl.includes('/api/v1/admin/listings/lst_mod_1/approve'));
      assert.strictEqual(lastMethod, 'POST');

      // Test rejectListing
      await adminService.rejectListing('lst_mod_1', 'Document missing');
      assert.ok(lastUrl.includes('/api/v1/admin/listings/lst_mod_1/reject'));
      assert.strictEqual(lastMethod, 'POST');
      assert.ok(lastBody.includes('Document missing'));

      // Test archiveListing
      await adminService.archiveListing('lst_mod_1');
      assert.ok(lastUrl.includes('/api/v1/admin/listings/lst_mod_1/archive'));
      assert.strictEqual(lastMethod, 'POST');
    });
  });

  // =========================================================================
  // 2. formatActivityTime Helper
  // =========================================================================
  describe('2. Timestamp Formatting Helper', () => {
    test('2.1 formatActivityTime formats valid ISO dates', () => {
      const formatted = formatActivityTime('2026-11-07T12:00:00.000Z');
      assert.ok(formatted.includes('2026'), 'Formatted string must include year 2026');
      assert.ok(formatted.includes('Nov'), 'Formatted string must include month Nov');
    });

    test('2.2 formatActivityTime handles falsy or invalid dates safely', () => {
      assert.strictEqual(formatActivityTime(null), 'Recently');
      assert.strictEqual(formatActivityTime('invalid-date-string'), 'Recently');
    });
  });

  // =========================================================================
  // 3. AdminDashboardPage Rendering
  // =========================================================================
  describe('3. AdminDashboardPage UI Rendering', () => {
    test('3.1 Renders KPI cards with accurate values and badges', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} />);

      // Header & Identity
      assert.ok(html.includes('Admin Dashboard'), 'Must render title');
      assert.ok(html.includes('System Administrator'), 'Must render administrator badge');

      // Metric numbers
      assert.ok(html.includes('42'), 'Must render totalListings count 42');
      assert.ok(html.includes('Total Commercial Listings'), 'Must render Total Commercial Listings label');
      assert.ok(html.includes('7'), 'Must render pendingListings count 7');
      assert.ok(html.includes('Pending Review'), 'Must render Pending Review label');
      assert.ok(html.includes('Needs Action'), 'Must render Needs Action badge when pending > 0');
      assert.ok(html.includes('156'), 'Must render totalUsers count 156');
      assert.ok(html.includes('Total Registered Users'), 'Must render Total Registered Users label');

      // Role breakdown
      assert.ok(html.includes('120'), 'Must render customers count 120');
      assert.ok(html.includes('32'), 'Must render owners count 32');
      assert.ok(html.includes('4'), 'Must render admins count 4');
    });

    test('3.2 Does not render "Needs Action" when pendingListings is 0', () => {
      const zeroPendingStats = {
        ...mockStatsData,
        pendingListings: 0,
      };
      const html = renderWithAuth(<AdminDashboardPage initialStats={zeroPendingStats} />);
      assert.ok(!html.includes('Needs Action'), 'Must not render Needs Action when pending is 0');
    });

    test('3.3 Renders recent activity items with proper types and titles', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} />);

      // Activity 1
      assert.ok(html.includes('Gulshan Prime Tower Level 4'), 'Must render listing title');
      assert.ok(html.includes('Gulshan, Dhaka • rent'), 'Must render listing subtitle');
      assert.ok(html.includes('pending'), 'Must render pending status badge');

      // Activity 2
      assert.ok(html.includes('Rahim Khan'), 'Must render user registration name');
      assert.ok(html.includes('Registered as owner'), 'Must render user subtitle');
      assert.ok(html.includes('active'), 'Must render active status badge');
    });

    test('3.4 Renders empty state when recent activity list is empty', () => {
      const emptyActivityStats = {
        ...mockStatsData,
        recentActivity: [],
      };
      const html = renderWithAuth(<AdminDashboardPage initialStats={emptyActivityStats} />);
      assert.ok(html.includes('No Recent Activity'), 'Must render No Recent Activity title');
    });
  });

  // =========================================================================
  // 4. Route Authorization Guards
  // =========================================================================
  describe('4. Route Authorization Guards on "/admin-dashboard"', () => {
    test('4.1 Admin is ALLOWED to access "/admin-dashboard"', () => {
      const html = renderRoute('/admin-dashboard', mockAdminUser);
      assert.ok(html.includes('Admin Dashboard'), 'Admin must see Admin Dashboard');
      assert.ok(html.includes('System Administrator'), 'Admin must see System Administrator badge');
      assert.ok(!html.includes('Access Denied'), 'Admin must not receive Access Denied');
    });

    test('4.2 Customer receives ACCESS DENIED on "/admin-dashboard"', () => {
      const html = renderRoute('/admin-dashboard', mockCustomerUser);
      assert.ok(html.includes('Access Denied'), 'Customer must receive Access Denied');
      assert.ok(!html.includes('System Administrator'), 'Customer must not access Admin Dashboard');
    });

    test('4.3 Owner receives ACCESS DENIED on "/admin-dashboard"', () => {
      const html = renderRoute('/admin-dashboard', mockOwnerUser);
      assert.ok(html.includes('Access Denied'), 'Owner must receive Access Denied');
      assert.ok(!html.includes('System Administrator'), 'Owner must not access Admin Dashboard');
    });

    test('4.4 Unauthenticated visitor is REDIRECTED away from "/admin-dashboard"', () => {
      const html = renderRoute('/admin-dashboard', null);
      assert.ok(!html.includes('System Administrator'), 'Unauthenticated visitor must not access Admin Dashboard');
    });
  });

  // =========================================================================
  // 5. Layout & Navigation Integration
  // =========================================================================
  describe('5. Layout & Navigation Integration', () => {
    test('5.1 Header renders Admin Portal linking to /admin-dashboard for admin user', () => {
      const authValue = {
        user: mockAdminUser,
        isAuthenticated: true,
        loading: false,
        logout: () => {},
      };

      const html = renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(html.includes('href="/admin-dashboard"'), 'Header must link to /admin-dashboard for admin');
      assert.ok(html.includes('Admin Portal'), 'Header must display Admin Portal');
    });

    test('5.2 MobileNav renders Admin Portal linking to /admin-dashboard for admin user', () => {
      const authValue = {
        user: mockAdminUser,
        isAuthenticated: true,
        loading: false,
        logout: () => {},
      };

      const html = renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/']}>
            <MobileNav isOpen={true} onClose={() => {}} />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(html.includes('href="/admin-dashboard"'), 'MobileNav must link to /admin-dashboard for admin');
      assert.ok(html.includes('Admin Portal'), 'MobileNav must display Admin Portal');
    });

    test('5.3 Sidebar renders Overview linking to /admin-dashboard for admin user', () => {
      const authValue = {
        user: mockAdminUser,
        isAuthenticated: true,
        loading: false,
        logout: () => {},
      };

      const html = renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/admin-dashboard']}>
            <Sidebar />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(html.includes('href="/admin-dashboard"'), 'Sidebar must link overview to /admin-dashboard');
      assert.ok(html.includes('Overview'), 'Sidebar must display Overview');
    });
  });

  // =========================================================================
  // 6. Dual-View Tab Integration (D-021)
  // =========================================================================
  describe('6. Dual-View Tab Integration (D-021)', () => {
    test('6.1 Renders tab navigation with Overview & Activity and Platform Analytics tabs', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} />);

      assert.ok(html.includes('role="tablist"'), 'Tab navigation must declare role="tablist"');
      assert.ok(html.includes('id="admin-tab-overview"'), 'Overview tab must exist');
      assert.ok(html.includes('id="admin-tab-analytics"'), 'Analytics tab must exist');
      assert.ok(html.includes('Overview &amp; Activity') || html.includes('Overview & Activity'), 'Overview tab label must exist');
      assert.ok(html.includes('Platform Analytics'), 'Analytics tab label must exist');

      // Default state: overview selected
      assert.ok(html.includes('id="admin-tab-overview" aria-selected="true"'), 'Overview tab must be selected by default');
      assert.ok(html.includes('id="admin-tab-analytics" aria-selected="false"'), 'Analytics tab must be unselected by default');
    });

    test('6.2 Overview tabpanel is visible and displays platform metrics by default', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} />);

      // Tabpanel associations
      assert.ok(html.includes('id="admin-panel-overview" aria-labelledby="admin-tab-overview"'), 'Overview panel must be linked to its tab');
      assert.ok(html.includes('id="admin-panel-analytics" aria-labelledby="admin-tab-analytics"'), 'Analytics panel must be linked to its tab');

      // Overview panel should not have "hidden" class
      assert.ok(!html.includes('id="admin-panel-overview" aria-labelledby="admin-tab-overview" class="hidden"'), 'Overview panel must be visible');
      // Analytics panel should have "hidden" class
      assert.ok(html.includes('id="admin-panel-analytics" aria-labelledby="admin-tab-analytics" class="hidden"'), 'Analytics panel must be hidden by default');

      // Core overview content rendered
      assert.ok(html.includes('Platform Metrics Overview'), 'Overview section title must be present');
      assert.ok(html.includes('Total Commercial Listings'), 'KPI cards must be rendered in overview');
      assert.ok(html.includes('Gulshan Prime Tower Level 4'), 'Recent activity must be rendered in overview');
    });

    test('6.3 Displays Platform Analytics view when initialTab is "analytics"', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="analytics" />);

      // Analytics tab is selected
      assert.ok(html.includes('id="admin-tab-analytics" aria-selected="true"'), 'Analytics tab must be selected');
      assert.ok(html.includes('id="admin-tab-overview" aria-selected="false"'), 'Overview tab must not be selected');

      // Analytics panel is visible, Overview panel is hidden
      assert.ok(!html.includes('id="admin-panel-analytics" aria-labelledby="admin-tab-analytics" class="hidden"'), 'Analytics panel must be visible');
      assert.ok(html.includes('id="admin-panel-overview" aria-labelledby="admin-tab-overview" class="hidden"'), 'Overview panel must have hidden class');

      // AdminAnalyticsOverview component is rendered inside analytics panel
      assert.ok(html.includes('Platform Intelligence &amp; Analytics') || html.includes('Platform Intelligence & Analytics'), 'Analytics overview header must be present');
      assert.ok(html.includes('Last 7 Days'), 'Timeframe preset 7d button must be present');
      assert.ok(html.includes('Last 30 Days'), 'Timeframe preset 30d button must be present');
      assert.ok(html.includes('Last 90 Days'), 'Timeframe preset 90d button must be present');
    });

    test('6.4 Preserves independent refresh controls for both views without collision', () => {
      const html = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="analytics" />);

      // Header refresh button for overview stats
      assert.ok(html.includes('aria-label="Refresh statistics"'), 'Overview refresh action must exist in header');
      // Dedicated analytics refresh button in analytics view
      assert.ok(html.includes('aria-label="Refresh platform analytics"'), 'Dedicated analytics refresh action must exist');
    });

    test('6.5 Implements roving tabindex according to WAI-ARIA tab pattern', () => {
      // Case A: Default (overview active)
      const htmlOverview = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="overview" />);
      assert.ok(
        htmlOverview.includes('id="admin-tab-overview" tabindex="0"') ||
        htmlOverview.includes('id="admin-tab-overview" tabIndex="0"') ||
        htmlOverview.includes('tabindex="0" aria-selected="true" id="admin-tab-overview"') ||
        htmlOverview.match(/id="admin-tab-overview"[^>]*tabindex="0"/i),
        'Active overview tab must have tabindex="0"'
      );
      assert.ok(
        htmlOverview.includes('id="admin-tab-analytics" tabindex="-1"') ||
        htmlOverview.includes('id="admin-tab-analytics" tabIndex="-1"') ||
        htmlOverview.match(/id="admin-tab-analytics"[^>]*tabindex="-1"/i),
        'Inactive analytics tab must have tabindex="-1"'
      );

      // Case B: Analytics active
      const htmlAnalytics = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="analytics" />);
      assert.ok(
        htmlAnalytics.match(/id="admin-tab-overview"[^>]*tabindex="-1"/i),
        'Inactive overview tab must have tabindex="-1"'
      );
      assert.ok(
        htmlAnalytics.match(/id="admin-tab-analytics"[^>]*tabindex="0"/i),
        'Active analytics tab must have tabindex="0"'
      );
    });

    test('6.6 getNextActiveTab handles ArrowRight, ArrowLeft, Home, and End with wraparound', () => {
      // ArrowRight: sequential and wraparound
      assert.strictEqual(getNextActiveTab('overview', 'ArrowRight'), 'analytics');
      assert.strictEqual(getNextActiveTab('analytics', 'ArrowRight'), 'overview', 'ArrowRight at end must wrap to overview');

      // ArrowLeft: sequential and wraparound
      assert.strictEqual(getNextActiveTab('analytics', 'ArrowLeft'), 'overview');
      assert.strictEqual(getNextActiveTab('overview', 'ArrowLeft'), 'analytics', 'ArrowLeft at start must wrap to analytics');

      // Home and End
      assert.strictEqual(getNextActiveTab('analytics', 'Home'), 'overview', 'Home key must select first tab (overview)');
      assert.strictEqual(getNextActiveTab('overview', 'Home'), 'overview');
      assert.strictEqual(getNextActiveTab('overview', 'End'), 'analytics', 'End key must select last tab (analytics)');
      assert.strictEqual(getNextActiveTab('analytics', 'End'), 'analytics');

      // Non-navigation keys leave tab unchanged
      assert.strictEqual(getNextActiveTab('overview', 'Tab'), 'overview');
      assert.strictEqual(getNextActiveTab('analytics', 'Escape'), 'analytics');
      assert.strictEqual(getNextActiveTab('overview', 'Enter'), 'overview');
    });

    test('6.7 Lazy mounting: analytics is not rendered until analytics tab is activated', () => {
      // Overview view: analytics container is not mounted
      const htmlOverview = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="overview" />);
      assert.ok(!htmlOverview.includes('data-testid="admin-analytics-overview"'), 'Analytics overview must not be mounted initially');
      assert.ok(!htmlOverview.includes('Platform Intelligence & Analytics'), 'Analytics header must not exist in overview DOM');

      // Analytics view: analytics container is mounted
      const htmlAnalytics = renderWithAuth(<AdminDashboardPage initialStats={mockStatsData} initialTab="analytics" />);
      assert.ok(htmlAnalytics.includes('data-testid="admin-analytics-overview"'), 'Analytics overview must be mounted when active');
    });
  });
});
