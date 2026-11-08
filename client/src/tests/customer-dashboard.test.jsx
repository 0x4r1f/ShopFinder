import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import customerService from '../services/customerService.js';
import DashboardPage, { formatActivityTime, formatBdtPrice } from '../pages/DashboardPage.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth User Fixtures
 */
const mockCustomerUser = {
  id: 'usr_cust12345678',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
};

const mockOwnerUser = {
  id: 'usr_owner1234567',
  name: 'Tariq Owner',
  email: 'tariq@example.com',
  role: 'owner',
};

const mockAdminUser = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

/**
 * Mock Customer Dashboard Fixtures
 */
const mockDashboardDataWithCredits = {
  credits_remaining: 15,
  active_subscriptions_count: 2,
  recent_saved: [
    {
      id: 'sav_001',
      listing_id: 'lst_banani_01',
      saved_at: '2026-11-08T00:10:00.000Z',
      title: 'Banani Prime Commercial Shop',
      price: 65000,
      city: 'Dhaka',
      area: 'Banani',
      category: 'retail',
      listing_type: 'rent',
    },
    {
      id: 'sav_002',
      listing_id: 'lst_gulshan_02',
      saved_at: '2026-11-08T00:05:00.000Z',
      title: 'Gulshan Corporate Office Floor',
      price: 180000,
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'office',
      listing_type: 'rent',
    },
  ],
  recent_reveals: [
    {
      id: 'rev_001',
      listing_id: 'lst_dhanmondi_03',
      revealed_at: '2026-11-08T00:08:00.000Z',
      title: 'Dhanmondi Fitted Restaurant Space',
      city: 'Dhaka',
      area: 'Dhanmondi',
    },
  ],
};

const mockDashboardDataZeroCredits = {
  credits_remaining: 0,
  active_subscriptions_count: 0,
  recent_saved: [],
  recent_reveals: [],
};

/**
 * Test Helper: Render component with AuthContext and MemoryRouter
 */
function renderWithAuth(ui, { user = mockCustomerUser, initialRoute = '/dashboard' } = {}) {
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

describe('Phase 8, Task 8.2 — Customer Dashboard (Frontend Unit & Integration)', () => {
  let originalGetCustomerDashboard;

  beforeEach(() => {
    originalGetCustomerDashboard = customerService.getCustomerDashboard;
  });

  afterEach(() => {
    customerService.getCustomerDashboard = originalGetCustomerDashboard;
  });

  // =========================================================================
  // 1. customerService Client Contract
  // =========================================================================
  describe('1. customerService Client Contract', () => {
    test('1.1 customerService exposes getCustomerDashboard function', () => {
      assert.strictEqual(
        typeof customerService.getCustomerDashboard,
        'function',
        'customerService must export getCustomerDashboard'
      );
    });
  });

  // =========================================================================
  // 2. Formatting Helpers
  // =========================================================================
  describe('2. Formatting Helpers', () => {
    test('2.1 formatBdtPrice formats rent and sale prices correctly', () => {
      assert.strictEqual(formatBdtPrice(65000, 'rent'), '৳65,000/mo');
      assert.strictEqual(formatBdtPrice(15000000, 'sale'), '৳1,50,00,000');
      assert.strictEqual(formatBdtPrice(0, 'rent'), '৳0/mo');
      assert.strictEqual(formatBdtPrice(null), '৳0');
    });

    test('2.2 formatActivityTime formats valid ISO dates and handles falsy safely', () => {
      const formatted = formatActivityTime('2026-11-08T00:10:00.000Z');
      assert.ok(formatted.includes('Nov') || formatted.includes('2026'));
      assert.strictEqual(formatActivityTime(null), 'Recently');
      assert.strictEqual(formatActivityTime('invalid-date'), 'Recently');
    });
  });

  // =========================================================================
  // 3. UI Rendering & Widget Features
  // =========================================================================
  describe('3. Customer Dashboard UI Rendering', () => {
    test('3.1 Prominently displays credit balance summary widget with active credits', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataWithCredits} />
      );

      assert.match(html, /Customer Dashboard/i);
      assert.match(html, /Verified Customer/i);
      assert.match(html, /15/);
      assert.match(html, /credits remaining/i);
      assert.match(html, /Each contact reveal uses 1 credit/i);
      assert.match(html, /Subscription Plans/i);
    });

    test('3.2 Displays zero-credit state and "Get Credits" button when credits_remaining is 0', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataZeroCredits} />
      );

      assert.match(html, />0</, 'Must display 0 credits');
      assert.match(html, /You have no credits remaining/i);
      assert.match(html, /Get Credits/i);
    });

    test('3.3 Renders all 4 Quick Links with correct destinations', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataWithCredits} />
      );

      assert.match(html, /Quick Actions/i);
      assert.match(html, /href="\/marketplace"/, 'Must have Browse Marketplace destination');
      assert.match(html, /href="\/dashboard\/saved"/, 'Must have Saved Properties destination');
      assert.match(html, /href="\/dashboard\/reveals"/, 'Must have Reveal History destination');
      assert.match(html, /href="\/dashboard\/profile"/, 'Must have Account Settings destination');
    });

    test('3.4 Renders recent saved properties with titles, locations, and prices', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataWithCredits} />
      );

      assert.match(html, /Recently Saved Properties/i);
      assert.match(html, /Banani Prime Commercial Shop/i);
      assert.match(html, /Gulshan Corporate Office Floor/i);
      assert.match(html, /৳65,000\/mo/);
      assert.match(html, /href="\/listings\/lst_banani_01"/);
    });

    test('3.5 Renders EmptyState when recent_saved is empty', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataZeroCredits} />
      );

      assert.match(html, /No saved properties yet/i);
      assert.match(html, /Bookmark commercial spaces from the marketplace/i);
    });

    test('3.6 Renders recent revealed contacts with listing titles and locations', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataWithCredits} />
      );

      assert.match(html, /Recently Revealed Contacts/i);
      assert.match(html, /Dhanmondi Fitted Restaurant Space/i);
      assert.match(html, /Contact Unlocked/i);
      assert.match(html, /href="\/listings\/lst_dhanmondi_03"/);
    });

    test('3.7 Renders EmptyState when recent_reveals is empty', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataZeroCredits} />
      );

      assert.match(html, /No revealed contacts yet/i);
      assert.match(html, /When you unlock property owner contacts/i);
    });

    test('3.8 D-014 Privacy Verification: Owner phone numbers never render in dashboard feed', () => {
      const html = renderWithAuth(
        <DashboardPage initialData={mockDashboardDataWithCredits} />
      );

      assert.doesNotMatch(html, /\+880/);
      assert.doesNotMatch(html, /phone/i);
      assert.doesNotMatch(html, /owner_contacts/i);
    });

    test('3.9 Loading state renders spinner and feedback text when initialData is null', () => {
      const html = renderWithAuth(<DashboardPage initialData={null} />);

      assert.match(html, /Loading customer dashboard/i);
      assert.match(html, /data-testid="dashboard-loading"/);
    });
  });

  // =========================================================================
  // 4. Route Authorization Guards on "/dashboard"
  // =========================================================================
  describe('4. Route Authorization Guards on "/dashboard"', () => {
    test('4.1 Customer is ALLOWED to access "/dashboard"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /Loading customer dashboard|Customer Dashboard/i);
      assert.doesNotMatch(html, /Access Denied/i);
    });

    test('4.2 Owner receives ACCESS DENIED on "/dashboard"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockOwnerUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /Access Denied/i);
      assert.doesNotMatch(html, /Verified Customer/i);
    });

    test('4.3 Admin receives ACCESS DENIED on "/dashboard"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdminUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /Access Denied/i);
      assert.doesNotMatch(html, /Verified Customer/i);
    });

    test('4.4 Unauthenticated visitor is redirected away from "/dashboard"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/dashboard',
      });

      assert.doesNotMatch(html, /Customer Dashboard/i);
      assert.doesNotMatch(html, /Verified Customer/i);
    });
  });
});
