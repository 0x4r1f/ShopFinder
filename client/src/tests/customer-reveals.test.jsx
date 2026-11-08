import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import CustomerRevealsPage, { formatRevealTime } from '../pages/CustomerRevealsPage.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import AppRouter from '../routes/AppRouter.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Mock Reveal Record Fixtures (prepared for Phase 10)
 */
const mockPreparedReveals = [
  {
    id: 'rev_001',
    listing_id: 'lst_banani_01',
    title: 'Banani Prime Corner Shop',
    city: 'Dhaka',
    area: 'Banani',
    revealed_at: '2026-11-08T00:10:00.000Z',
  },
  {
    id: 'rev_002',
    listing_id: 'lst_gulshan_02',
    title: 'Gulshan Corporate Office Floor',
    city: 'Dhaka',
    area: 'Gulshan 2',
    revealed_at: '2026-11-08T00:05:00.000Z',
  },
];

/**
 * Helper: Render component with AuthContext and MemoryRouter
 */
function renderWithAuth(
  ui,
  {
    user = mockCustomerUser,
    initialRoute = '/dashboard/reveals',
  } = {}
) {
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

describe('Phase 8, Task 8.5 — Customer Reveal History Container (Frontend Unit & Integration)', () => {
  // =========================================================================
  // 1. Page Title, Description & Feature Onboarding Guide
  // =========================================================================
  describe('1. Page Header & Explanatory Presentation', () => {
    test('1.1 Reveal History page renders page title and explanatory description', () => {
      const html = renderWithAuth(<CustomerRevealsPage />);

      assert.match(html, /Contact Reveal History/i);
      assert.match(html, /Review verified commercial property owner contact details/i);
    });

    test('1.2 Feature explanation card educates customer about upcoming Phase 10 engine', () => {
      const html = renderWithAuth(<CustomerRevealsPage />);

      assert.match(html, /About Contact Reveals \(Phase 10 Engine\)/i);
      assert.match(html, /1 Credit per Reveal/i);
      assert.match(html, /Permanent Access/i);
      assert.match(html, /Privacy-Safe \(D-014\)/i);
    });

    test('1.3 formatRevealTime formats timestamps safely', () => {
      const formatted = formatRevealTime('2026-11-08T00:10:00.000Z');
      assert.ok(formatted.includes('Nov') || formatted.includes('2026'));
      assert.strictEqual(formatRevealTime(null), 'Recently');
      assert.strictEqual(formatRevealTime('invalid-date'), 'Recently');
    });
  });

  // =========================================================================
  // 2. Empty State & Marketplace Navigation (Default State)
  // =========================================================================
  describe('2. Empty State & Marketplace CTA', () => {
    test('2.1 Empty state explains reveal feature and absence of fabricated records', () => {
      const html = renderWithAuth(<CustomerRevealsPage initialReveals={[]} />);

      assert.match(html, /No revealed contacts yet/i);
      assert.match(html, /When you unlock verified property owner contacts/i);
      assert.match(html, /Phase 10/i);
    });

    test('2.2 Provides clear marketplace navigation action', () => {
      const html = renderWithAuth(<CustomerRevealsPage />);

      assert.match(html, /href="\/marketplace"/);
      assert.match(html, /Browse Marketplace/i);
    });

    test('2.3 Default state does NOT render fake reveal cards or fabricated records', () => {
      const html = renderWithAuth(<CustomerRevealsPage />);

      assert.doesNotMatch(html, /data-testid="reveals-grid"/);
      assert.doesNotMatch(html, /data-testid="reveal-card-/);
    });
  });

  // =========================================================================
  // 3. Container Prepared for Phase 10 Integration
  // =========================================================================
  describe('3. Future Reveal Records Container (Phase 10 Ready)', () => {
    test('3.1 Renders reveal records when provided with initialReveals', () => {
      const html = renderWithAuth(
        <CustomerRevealsPage initialReveals={mockPreparedReveals} />
      );

      assert.match(html, /2 revealed/i);
      assert.match(html, /data-testid="reveals-grid"/);
      assert.match(html, /data-testid="reveal-card-lst_banani_01"/);
      assert.match(html, /data-testid="reveal-card-lst_gulshan_02"/);
      assert.match(html, /Banani Prime Corner Shop/);
      assert.match(html, /Gulshan Corporate Office Floor/);
      assert.match(html, /Unlocked/);
    });

    test('3.2 D-014 Privacy Policy: Reveal cards NEVER render owner phone numbers', () => {
      const html = renderWithAuth(
        <CustomerRevealsPage initialReveals={mockPreparedReveals} />
      );

      // Verify no phone numbers are leaked in reveal card container
      assert.doesNotMatch(html, /\+880/);
      assert.doesNotMatch(html, /01[3-9]\d{8}/);
    });
  });

  // =========================================================================
  // 4. Sidebar Navigation & Active Status
  // =========================================================================
  describe('4. Customer Sidebar Navigation', () => {
    test('4.1 Customer sidebar renders active NavLink targeting /dashboard/reveals', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /href="\/dashboard\/reveals"/);
      assert.match(html, /Reveal History/);
    });

    test('4.2 "Revealed Contacts" no longer carries Upcoming status in customer sidebar', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      // Subscription is still upcoming, but Revealed Contacts is now active
      assert.match(html, /Subscription \/ Credits/);
      assert.doesNotMatch(
        html,
        /<div[^>]*aria-disabled="true"[^>]*>[\s\S]*?Revealed Contacts[\s\S]*?Upcoming<\/span>/i,
        'Revealed Contacts must NOT be rendered as a disabled upcoming item'
      );
    });

    test('4.3 Sidebar applies active styling when viewing /dashboard/reveals', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/reveals',
      });

      // Active NavLink renders aria-current="page"
      assert.match(html, /aria-current="page"/);
    });
  });

  // =========================================================================
  // 5. Route Authorization Guards on "/dashboard/reveals"
  // =========================================================================
  describe('5. Route Authorization Guards on "/dashboard/reveals"', () => {
    test('5.1 Authenticated customer is ALLOWED to access "/dashboard/reveals"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/reveals',
      });

      assert.doesNotMatch(html, /Access Denied/i);
      assert.match(html, /Contact Reveal History/i);
    });

    test('5.2 Authenticated owner receives ACCESS DENIED on "/dashboard/reveals"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockOwnerUser,
        initialRoute: '/dashboard/reveals',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('5.3 Authenticated admin receives ACCESS DENIED on "/dashboard/reveals"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdminUser,
        initialRoute: '/dashboard/reveals',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('5.4 Unauthenticated visitor is redirected away from "/dashboard/reveals"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/dashboard/reveals',
      });

      assert.doesNotMatch(html, /Contact Reveal History \(Protected\)/i);
      assert.doesNotMatch(html, /About Contact Reveals/i);
    });
  });

  // =========================================================================
  // 6. Security Audit: Zero Direct PocketBase Access
  // =========================================================================
  describe('6. Security & Direct PocketBase Prohibition Audit', () => {
    test('6.1 CustomerRevealsPage source code makes zero direct PocketBase imports or calls', () => {
      const pageCode = fs.readFileSync(
        path.resolve(__dirname, '../pages/CustomerRevealsPage.jsx'),
        'utf8'
      );

      assert.ok(
        !pageCode.includes("from 'pocketbase'"),
        'CustomerRevealsPage must never import PocketBase directly'
      );
      assert.ok(
        !pageCode.includes('new PocketBase'),
        'CustomerRevealsPage must never instantiate PocketBase'
      );
      assert.ok(
        !pageCode.includes('collection('),
        'CustomerRevealsPage must never invoke PocketBase collection queries directly'
      );
    });
  });
});

