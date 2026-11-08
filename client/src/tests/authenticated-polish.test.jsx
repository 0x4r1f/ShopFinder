import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import SavedListingsPage from '../pages/SavedListingsPage.jsx';
import CustomerRevealsPage from '../pages/CustomerRevealsPage.jsx';
import OwnerDashboardPage, { OWNER_DASHBOARD_TABS, getNextOwnerTab } from '../pages/OwnerDashboardPage.jsx';
import AdminReviewQueuePage from '../pages/AdminReviewQueuePage.jsx';
import AdminUsersPage from '../pages/AdminUsersPage.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

function renderWithAuth(ui, { user = null, initialRoute = '/' } = {}) {
  const authValue = {
    user,
    token: user ? 'mock-jwt-token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
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

describe('Phase 12, Task 12.3, Step 3 — Authenticated Dashboards & Tables Polish', () => {
  // =========================================================================
  // 1. Customer Pages Skeletons & Interactions
  // =========================================================================
  describe('1. Customer Pages Skeletons & Interactions', () => {
    test('1.1 SavedListingsPage renders ListingsGridSkeleton during initial loading', () => {
      const html = renderWithAuth(<SavedListingsPage initialData={null} />, {
        user: { id: 'cust_1', role: 'customer' },
        initialRoute: '/dashboard/saved',
      });

      assert.ok(html.includes('data-testid="saved-listings-loading"'), 'Must have saved-listings-loading test id');
      assert.ok(html.includes('Loading saved properties...'), 'Must render accessible loading description');
      assert.ok(html.includes('animate-pulse'), 'Must render pulse skeleton placeholders');
      assert.ok(html.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'Must render responsive grid skeleton');
    });

    test('1.2 CustomerRevealsPage renders ListingsGridSkeleton during initial loading', () => {
      const html = renderWithAuth(<CustomerRevealsPage initialLoading={true} initialReveals={[]} autoFetch={false} />, {
        user: { id: 'cust_1', role: 'customer' },
        initialRoute: '/dashboard/reveals',
      });

      assert.ok(html.includes('data-testid="reveals-loading"'), 'Must have reveals-loading test id');
      assert.ok(html.includes('Loading your contact reveal history...'), 'Must render accessible loading description');
      assert.ok(html.includes('animate-pulse'), 'Must render pulse skeleton placeholders');
    });

    test('1.3 CustomerRevealsPage pagination has polished touch targets and active scale classes', () => {
      const mockReveals = Array.from({ length: 15 }).map((_, i) => ({
        id: `rev_${i}`,
        listing: {
          id: `lst_${i}`,
          title: `Commercial Office Suite ${i}`,
          status: 'approved',
        },
        revealed_at: new Date().toISOString(),
      }));

      const html = renderWithAuth(
        <CustomerRevealsPage
          initialReveals={mockReveals}
          initialPagination={{ page: 1, perPage: 12, totalItems: 15, totalPages: 2 }}
          autoFetch={false}
        />,
        {
          user: { id: 'cust_1', role: 'customer' },
          initialRoute: '/dashboard/reveals',
        }
      );

      assert.ok(html.includes('data-testid="pagination-prev"'), 'Must render prev pagination button');
      assert.ok(html.includes('data-testid="pagination-next"'), 'Must render next pagination button');
      assert.ok(html.includes('min-h-[42px] sm:min-h-[36px]'), 'Must enforce mobile-friendly touch targets');
      assert.ok(html.includes('active:scale-95'), 'Must include active scale feedback');
    });
  });

  // =========================================================================
  // 2. Owner Dashboard Skeletons, Scrolling & Keyboard Navigation
  // =========================================================================
  describe('2. Owner Dashboard Skeletons, Scrolling & Keyboard Navigation', () => {
    test('2.1 OwnerDashboardPage renders KpiCardSkeleton and TableSkeleton during initial loading', () => {
      const html = renderWithAuth(<OwnerDashboardPage />, {
        user: { id: 'own_1', role: 'owner' },
        initialRoute: '/owner-dashboard',
      });

      assert.ok(html.includes('data-testid="owner-listings-loading"'), 'Must render owner-listings-loading container');
      assert.ok(html.includes('role="status"'), 'Loading container must declare role="status"');
      assert.ok(html.includes('Loading listings...'), 'Must preserve screen-reader label');
      assert.ok(html.includes('animate-pulse'), 'Must render pulse skeletons');
      assert.ok(html.includes('overflow-x-auto'), 'Table wrapper must provide horizontal scrolling');
    });

    test('2.2 Owner dashboard tabs implement WAI-ARIA roving tabindex (0 for active, -1 for inactive)', () => {
      const html = renderWithAuth(<OwnerDashboardPage />, {
        user: { id: 'own_1', role: 'owner' },
        initialRoute: '/owner-dashboard',
      });

      // Active tab (Properties & Listings)
      assert.ok(
        html.includes('id="owner-tab-listings"') &&
        html.includes('aria-selected="true"') &&
        html.includes('tabindex="0"'),
        'Active listings tab must have aria-selected="true" and tabindex="0"'
      );

      // Inactive tab (Performance & Analytics)
      assert.ok(
        html.includes('id="owner-tab-analytics"') &&
        html.includes('aria-selected="false"') &&
        html.includes('tabindex="-1"'),
        'Inactive analytics tab must have aria-selected="false" and tabindex="-1"'
      );
    });

    test('2.3 getNextOwnerTab navigation helper cycles with wraparound and Home/End', () => {
      assert.deepStrictEqual(OWNER_DASHBOARD_TABS, ['listings', 'analytics']);

      // ArrowRight
      assert.strictEqual(getNextOwnerTab('listings', 'ArrowRight'), 'analytics');
      assert.strictEqual(getNextOwnerTab('analytics', 'ArrowRight'), 'listings', 'Wraps around to first tab');

      // ArrowLeft
      assert.strictEqual(getNextOwnerTab('listings', 'ArrowLeft'), 'analytics', 'Wraps around to last tab');
      assert.strictEqual(getNextOwnerTab('analytics', 'ArrowLeft'), 'listings');

      // Home & End
      assert.strictEqual(getNextOwnerTab('analytics', 'Home'), 'listings');
      assert.strictEqual(getNextOwnerTab('listings', 'End'), 'analytics');

      // Other keys remain unchanged
      assert.strictEqual(getNextOwnerTab('listings', 'Tab'), 'listings');
    });
  });

  // =========================================================================
  // 3. Admin Moderation & Users Table Skeletons
  // =========================================================================
  describe('3. Admin Moderation & Users Table Skeletons', () => {
    test('3.1 AdminReviewQueuePage renders TableSkeleton with role="status" during loading', () => {
      const html = renderWithAuth(<AdminReviewQueuePage initialData={null} />, {
        user: { id: 'adm_1', role: 'admin' },
        initialRoute: '/admin/review-queue',
      });

      assert.ok(html.includes('role="status"'), 'Review queue loading state must have role="status"');
      assert.ok(html.includes('Loading pending review queue...'), 'Must preserve accessible text');
      assert.ok(html.includes('overflow-x-auto'), 'Must support horizontal table scroll');
      assert.ok(html.includes('animate-pulse'), 'Must render table pulse cells');
    });

    test('3.2 AdminUsersPage renders TableSkeleton with role="status" during loading', () => {
      const html = renderWithAuth(<AdminUsersPage initialData={null} />, {
        user: { id: 'adm_1', role: 'admin' },
        initialRoute: '/admin/users',
      });

      assert.ok(html.includes('role="status"'), 'User table loading state must have role="status"');
      assert.ok(html.includes('Loading platform users from database...'), 'Must preserve accessible text');
      assert.ok(html.includes('overflow-x-auto'), 'Must support horizontal table scroll');
      assert.ok(html.includes('animate-pulse'), 'Must render table pulse cells');
    });
  });

  // =========================================================================
  // 4. Sidebar Cleanup & Navigation
  // =========================================================================
  describe('4. Sidebar Navigation Cleanup', () => {
    test('4.1 ownerNav no longer marks implemented features as Upcoming', () => {
      const ownerSidebarHtml = renderWithAuth(<Sidebar />, {
        user: { id: 'own_1', role: 'owner' },
        initialRoute: '/owner-dashboard',
      });

      // "My Listings" and "Add New Listing" must NOT be disabled upcoming items
      assert.doesNotMatch(
        ownerSidebarHtml,
        /<div[^>]*aria-disabled="true"[^>]*>[\s\S]*?My Listings[\s\S]*?Upcoming<\/span>/i,
        'My Listings must NOT be marked as disabled upcoming'
      );
      assert.doesNotMatch(
        ownerSidebarHtml,
        /<div[^>]*aria-disabled="true"[^>]*>[\s\S]*?Add New Listing[\s\S]*?Upcoming<\/span>/i,
        'Add New Listing must NOT be marked as disabled upcoming'
      );
    });

    test('4.2 Owner sidebar provides active NavLink to Add New Listing (/owner-dashboard/listings/new)', () => {
      const ownerSidebarHtml = renderWithAuth(<Sidebar />, {
        user: { id: 'own_1', role: 'owner' },
        initialRoute: '/owner-dashboard',
      });

      assert.ok(
        ownerSidebarHtml.includes('href="/owner-dashboard/listings/new"'),
        'Owner sidebar must include active link to /owner-dashboard/listings/new'
      );
      assert.ok(
        ownerSidebarHtml.includes('Add New Listing'),
        'Owner sidebar must render Add New Listing label'
      );
    });

    test('4.3 Preserves genuinely future modules for admin', () => {
      const adminSidebarHtml = renderWithAuth(<Sidebar />, {
        user: { id: 'adm_1', role: 'admin' },
        initialRoute: '/admin-dashboard',
      });

      assert.ok(adminSidebarHtml.includes('Subscription Plans'), 'Admin sidebar retains Subscription Plans upcoming module');
      assert.ok(adminSidebarHtml.includes('Payment Logs'), 'Admin sidebar retains Payment Logs upcoming module');
    });
  });

  // =========================================================================
  // 5. Privacy & Architecture Guardrails
  // =========================================================================
  describe('5. Privacy & Architecture Guardrails', () => {
    test('5.1 No direct PocketBase imports in modified files', () => {
      const filesToCheck = [
        'pages/SavedListingsPage.jsx',
        'pages/CustomerRevealsPage.jsx',
        'pages/OwnerDashboardPage.jsx',
        'pages/AdminReviewQueuePage.jsx',
        'pages/AdminUsersPage.jsx',
        'components/layout/Sidebar.jsx',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(clientSrcDir, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.equal(
          content.includes("from 'pocketbase'"),
          false,
          `${relPath} must not import PocketBase directly`
        );
        assert.equal(
          content.includes('pocketbase.js'),
          false,
          `${relPath} must not import pocketbase.js config directly`
        );
      }
    });
  });
});
