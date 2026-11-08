import { test, it, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import NotificationBell from '../components/notifications/NotificationBell.jsx';
import NotificationDropdown, { formatRelativeTime } from '../components/notifications/NotificationDropdown.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import Header from '../components/layout/Header.jsx';
import AppRouter from '../routes/AppRouter.jsx';
import * as notificationService from '../services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

// Mock Users
const mockCustomer = {
  id: 'usr_cust_001',
  name: 'Customer User',
  email: 'customer@test.com',
  role: 'customer',
};

const mockOwner = {
  id: 'usr_owner_001',
  name: 'Owner User',
  email: 'owner@test.com',
  role: 'owner',
};

const mockAdmin = {
  id: 'usr_admin_001',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin',
};

// Mock Notification Records
const mockNotifications = [
  {
    id: 'notif_001',
    user: 'usr_cust_001',
    type: 'credit_low',
    title: 'Low Credits Warning',
    message: 'You have only 2 credits remaining.',
    is_read: false,
    created: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
  },
  {
    id: 'notif_002',
    user: 'usr_cust_001',
    type: 'listing_approved',
    title: 'Listing Approved',
    message: 'Your commercial listing is now live.',
    is_read: true,
    created: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 'notif_003',
    user: 'usr_cust_001',
    type: 'listing_rejected',
    title: 'Listing Rejected',
    message: 'Please provide valid ownership documentation.',
    is_read: false,
    created: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
];

function renderWithAuth(ui, { user = mockCustomer, initialRoute = '/' } = {}) {
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

describe('Phase 11, Task 11.8 — In-App Notification UI Unit & Integration Tests', () => {
  // --------------------------------------------------------------------------
  // 1. formatRelativeTime Utility Tests
  // --------------------------------------------------------------------------
  describe('Relative Time Formatting', () => {
    it('returns empty string for null, undefined, or invalid dates', () => {
      assert.equal(formatRelativeTime(null), '');
      assert.equal(formatRelativeTime(undefined), '');
      assert.equal(formatRelativeTime('invalid-date-string'), '');
    });

    it('returns "Just now" for dates less than 60 seconds ago', () => {
      const now = new Date(Date.now() - 20 * 1000).toISOString();
      assert.equal(formatRelativeTime(now), 'Just now');
    });

    it('returns "Xm ago" for minutes ago', () => {
      const tenMins = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      assert.equal(formatRelativeTime(tenMins), '10m ago');
    });

    it('returns "Xh ago" for hours ago', () => {
      const threeHours = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      assert.equal(formatRelativeTime(threeHours), '3h ago');
    });

    it('returns "Xd ago" for days ago', () => {
      const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      assert.equal(formatRelativeTime(twoDays), '2d ago');
    });
  });

  // --------------------------------------------------------------------------
  // 2. NotificationBell Component Tests
  // --------------------------------------------------------------------------
  describe('NotificationBell Component Rendering', () => {
    it('renders bell button for authenticated customer', () => {
      const html = renderWithAuth(<NotificationBell />, { user: mockCustomer });
      assert.ok(html.includes('aria-label="Notifications'), 'Must include accessible notification aria-label');
      assert.ok(html.includes('aria-haspopup="true"'), 'Must have aria-haspopup');
      assert.ok(html.includes('aria-expanded="false"'), 'Must start with aria-expanded="false"');
    });

    it('renders bell button for authenticated property owner', () => {
      const html = renderWithAuth(<NotificationBell />, { user: mockOwner });
      assert.ok(html.includes('aria-label="Notifications'));
    });

    it('does NOT render for unauthenticated visitor (null user)', () => {
      const html = renderWithAuth(<NotificationBell />, { user: null });
      assert.equal(html, '', 'Must render nothing for unauthenticated visitors');
    });

    it('does NOT render for admin user', () => {
      const html = renderWithAuth(<NotificationBell />, { user: mockAdmin });
      assert.equal(html, '', 'Must render nothing for admin users');
    });
  });

  // --------------------------------------------------------------------------
  // 3. NotificationDropdown Component Tests
  // --------------------------------------------------------------------------
  describe('NotificationDropdown Component Rendering', () => {
    it('renders notification items with title, message, and type badges', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <NotificationDropdown
            notifications={mockNotifications}
            unreadCount={2}
            isLoading={false}
            error={null}
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
            onRetry={() => {}}
            onClose={() => {}}
          />
        </MemoryRouter>
      );

      // Verify header and unread count
      assert.ok(html.includes('Notifications'));
      assert.ok(html.includes('2 new'));

      // Verify "Mark all read" button
      assert.ok(html.includes('Mark all read'));

      // Verify notification messages
      assert.ok(html.includes('You have only 2 credits remaining.'));
      assert.ok(html.includes('Your commercial listing is now live.'));
      assert.ok(html.includes('Please provide valid ownership documentation.'));

      // Verify type badges
      assert.ok(html.includes('Low Credits'));
      assert.ok(html.includes('Approved'));
      assert.ok(html.includes('Rejected'));

      // Verify "View all notifications" link
      assert.ok(html.includes('href="/notifications"'));
      assert.ok(html.includes('View all notifications'));
    });

    it('renders loading spinner when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <NotificationDropdown
            notifications={[]}
            unreadCount={0}
            isLoading={true}
            error={null}
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
            onRetry={() => {}}
            onClose={() => {}}
          />
        </MemoryRouter>
      );

      assert.ok(html.includes('Loading notifications...'));
      assert.ok(html.includes('role="status"'));
    });

    it('renders error state with retry button when error occurs', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <NotificationDropdown
            notifications={[]}
            unreadCount={0}
            isLoading={false}
            error="Network connection failure"
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
            onRetry={() => {}}
            onClose={() => {}}
          />
        </MemoryRouter>
      );

      assert.ok(html.includes('Network connection failure'));
      assert.ok(html.includes('Retry'));
    });

    it('renders empty state when there are no notifications', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <NotificationDropdown
            notifications={[]}
            unreadCount={0}
            isLoading={false}
            error={null}
            onMarkAsRead={() => {}}
            onMarkAllAsRead={() => {}}
            onRetry={() => {}}
            onClose={() => {}}
          />
        </MemoryRouter>
      );

      assert.ok(html.includes('No notifications yet'));
      assert.ok(html.includes('You will receive updates on listing approvals and credit activity here.'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Header Integration Tests
  // --------------------------------------------------------------------------
  describe('Header Component Bell Placement', () => {
    it('integrates NotificationBell in Header for customer', () => {
      const html = renderWithAuth(<Header />, { user: mockCustomer });
      assert.ok(html.includes('aria-label="Notifications'));
    });

    it('integrates NotificationBell in Header for owner', () => {
      const html = renderWithAuth(<Header />, { user: mockOwner });
      assert.ok(html.includes('aria-label="Notifications'));
    });

    it('does NOT render NotificationBell in Header for unauthenticated user', () => {
      const html = renderWithAuth(<Header />, { user: null });
      assert.ok(!html.includes('aria-label="Notifications'));
    });

    it('does NOT render NotificationBell in Header for admin user', () => {
      const html = renderWithAuth(<Header />, { user: mockAdmin });
      assert.ok(!html.includes('aria-label="Notifications'));
    });
  });

  // --------------------------------------------------------------------------
  // 5. Route Protection for "/notifications" in AppRouter
  // --------------------------------------------------------------------------
  describe('Route Authorization for /notifications', () => {
    it('allows authenticated customer to access /notifications', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockCustomer,
        initialRoute: '/notifications',
      });
      assert.ok(html.includes('Notifications'));
      assert.ok(!html.includes('Please sign in to access this page'));
    });

    it('allows authenticated owner to access /notifications', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockOwner,
        initialRoute: '/notifications',
      });
      assert.ok(html.includes('Notifications'));
      assert.ok(!html.includes('Please sign in to access this page'));
    });

    it('redirects unauthenticated user away from /notifications to /login', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/notifications',
      });
      // ProtectedRoute redirects unauthenticated users to /login
      assert.ok(!html.includes('Stay updated with your commercial property moderation'));
    });

    it('denies access to admin user on /notifications', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdmin,
        initialRoute: '/notifications',
      });
      // Admin is not in allowedRoles=['customer', 'owner']
      assert.ok(!html.includes('Stay updated with your commercial property moderation'));
    });
  });

  // --------------------------------------------------------------------------
  // 6. Security Audit: Zero Direct PocketBase Calls in Client
  // --------------------------------------------------------------------------
  describe('Client Security & API Service Conformance', () => {
    it('NotificationBell does not import PocketBase directly', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'components/notifications/NotificationBell.jsx'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"), 'Must not import pocketbase');
      assert.ok(!code.includes('pb.'), 'Must not reference pb instance');
    });

    it('NotificationDropdown does not import PocketBase directly', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'components/notifications/NotificationDropdown.jsx'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"));
      assert.ok(!code.includes('pb.'));
    });

    it('NotificationsPage does not import PocketBase directly', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'pages/NotificationsPage.jsx'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"));
      assert.ok(!code.includes('pb.'));
    });

    it('notificationService.js communicates strictly through /api/v1/notifications via api.js', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'services/notificationService.js'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"));
      assert.ok(code.includes('/api/v1/notifications'));
    });
  });
});
