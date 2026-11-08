import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import PricingPage, { formatPlanPrice } from '../pages/PricingPage.jsx';
import AppRouter from '../routes/AppRouter.jsx';
import Header from '../components/layout/Header.jsx';
import MobileNav from '../components/layout/MobileNav.jsx';
import Footer from '../components/layout/Footer.jsx';

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
 * Standard Approved Plan Fixtures (D-001)
 */
const mockApprovedPlans = [
  {
    id: 'plan_starter_01',
    name: 'Starter',
    price: 299,
    credits: 10,
    duration_months: 1,
    description: 'Perfect for small business owners exploring properties.',
    is_active: true,
  },
  {
    id: 'plan_pro_02',
    name: 'Pro',
    price: 999,
    credits: 100,
    duration_months: 1,
    description: 'Best value for serious entrepreneurs and investors.',
    is_active: true,
  },
];

/**
 * Helper: Render UI with AuthContext and MemoryRouter
 */
function renderWithAuth(
  ui,
  {
    user = null,
    initialRoute = '/pricing',
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

describe('Phase 9, Task 9.4 — Subscription Plans Pricing Page (Frontend Unit & Integration)', () => {
  // =========================================================================
  // 1. Structure, Hero, and Page Presentation
  // =========================================================================
  describe('1. Structure, Hero & Guarantee Pillars', () => {
    test('1.1 Pricing page renders hero heading and subtitle', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Simple, Transparent Pricing/i);
      assert.match(html, /Contact Reveal Credit Packages/i);
      assert.match(html, /one-time payments/i);
      assert.match(html, /Zero recurring monthly charges/i);
    });

    test('1.2 "One-time purchase" wording is displayed prominently in guarantees', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /One-time purchase/i);
      assert.match(html, /no recurring monthly billing, auto-renewal, or subscription auto-debit/i);
    });

    test('1.3 "Credits never expire" wording is displayed prominently in guarantees', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Credits never expire/i);
      assert.match(html, /credits stay in your account forever until you choose to reveal/i);
    });

    test('1.4 "Credits stack" explanation is displayed prominently in guarantees', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Credits stack/i);
      assert.match(html, /New credits automatically stack and aggregate with your existing balance/i);
    });
  });

  // =========================================================================
  // 2. Plan Package Display & Pricing Accuracy (Starter & Pro)
  // =========================================================================
  describe('2. Plan Package Display & Pricing Accuracy', () => {
    test('2.1 Starter plan displays ৳299 and 10 credits', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Starter/);
      assert.match(html, /৳299/);
      assert.match(html, /10 Contact Reveal Credits/i);
      assert.match(html, /10 verified.*commercial property owner phone reveals/i);
      assert.match(html, /৳29\.9 \/ reveal/i);
    });

    test('2.2 Pro plan displays ৳999 and 100 credits with Best Value badge', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Pro/);
      assert.match(html, /৳999/);
      assert.match(html, /100 Contact Reveal Credits/i);
      assert.match(html, /100 verified.*commercial property owner phone reveals/i);
      assert.match(html, /Best Value/i);
      assert.match(html, /৳10\.0 \/ reveal/i);
    });

    test('2.3 formatPlanPrice handles prices, zeros, and malformed values gracefully', () => {
      assert.strictEqual(formatPlanPrice(299), '৳299');
      assert.strictEqual(formatPlanPrice(999), '৳999');
      assert.strictEqual(formatPlanPrice(0), '৳0');
      assert.strictEqual(formatPlanPrice(-10), '৳0');
      assert.strictEqual(formatPlanPrice('invalid'), '৳0');
      assert.strictEqual(formatPlanPrice(null), '৳0');
      assert.strictEqual(formatPlanPrice(undefined), '৳0');
    });

    test('2.4 Unexpected/malformed plan data is handled safely without producing NaN', () => {
      const malformedPlans = [
        {
          id: 'plan_malformed_1',
          name: 'Corrupt Plan',
          price: 'not-a-number',
          credits: 'invalid',
          description: null,
        },
      ];

      const html = renderWithAuth(<PricingPage initialPlans={malformedPlans} />);

      assert.match(html, /Corrupt Plan/);
      assert.match(html, /৳0/);
      assert.doesNotMatch(html, /NaN/i);
    });
  });

  // =========================================================================
  // 3. UI States (Loading, Error, Empty)
  // =========================================================================
  describe('3. Robust UI States Handling', () => {
    test('3.1 Loading state renders Spinner and "Loading subscription plans..."', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={null} initialLoading={true} />
      );

      assert.match(html, /Loading subscription plans\.\.\./i);
      assert.match(html, /pricing-loading/);
      assert.doesNotMatch(html, /pricing-grid/);
    });

    test('3.2 API error state renders NotificationBanner with error message and retry', () => {
      const errorMessage = 'Network unreachable: unable to load plans from gateway';
      const html = renderWithAuth(
        <PricingPage initialPlans={null} initialLoading={false} initialError={errorMessage} />
      );

      assert.match(html, /pricing-error/);
      assert.match(html, /Network unreachable/);
      assert.match(html, /Retry/);
    });

    test('3.3 Empty plan response handled safely via EmptyState', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={[]} initialLoading={false} />
      );

      assert.match(html, /pricing-empty/);
      assert.match(html, /No active subscription plans/i);
      assert.match(html, /Browse Marketplace/i);
      assert.match(html, /href="\/marketplace"/);
    });
  });

  // =========================================================================
  // 4. Plan Selection Flow & Role Navigation (Phase 9, Task 9.5)
  // =========================================================================
  describe('4. Plan Selection Flow & Role Navigation', () => {
    test('4.1 Anonymous visitor sees register link and no payment trigger', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={mockApprovedPlans} />,
        { user: null }
      );

      assert.match(html, /href="\/register"/);
      assert.match(html, /Get Started with Starter/i);
      assert.match(html, /Get Started with Pro/i);
    });

    test('4.2 Authenticated customer can select Starter and Pro with active CTAs', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={mockApprovedPlans} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="select-plan-starter"/);
      assert.match(html, /data-testid="select-plan-pro"/);
      assert.match(html, /Select Starter/i);
      assert.match(html, /Select Pro/i);
    });

    test('4.3 Selection modal displays selected package details and Phase 11 payment notice', () => {
      const html = renderWithAuth(
        <PricingPage
          initialPlans={mockApprovedPlans}
          initialSelectedPlan={mockApprovedPlans[0]}
        />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="plan-selection-modal"/);
      assert.match(html, /Starter Credit Package/i);
      assert.match(html, /৳299/);
      assert.match(html, /10/);
      assert.match(html, /Online Payment Activation Pending \(Phase 11\)/i);
      assert.match(html, /Confirm Starter Selection/i);
      assert.match(html, /Change Package/i);
    });

    test('4.4 Confirmed selection renders confirmation receipt banner with change and dashboard options', () => {
      const html = renderWithAuth(
        <PricingPage
          initialPlans={mockApprovedPlans}
          initialSelectedPlan={mockApprovedPlans[1]}
          initialSelectionConfirmed={true}
        />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="plan-selection-confirmed"/);
      assert.match(html, /Package Selection Saved/i);
      assert.match(html, /Pro Credit Package \(100 Credits — ৳999\)/i);
      assert.match(html, /Change Package/i);
      assert.match(html, /Go to Dashboard/i);
      assert.match(html, /Phase Boundary Notice/i);
    });

    test('4.5 Authenticated owner sees return to dashboard button', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={mockApprovedPlans} />,
        { user: mockOwnerUser }
      );

      assert.match(html, /href="\/owner-dashboard"/);
      assert.match(html, /Return to Dashboard/i);
    });

    test('4.6 Authenticated admin sees return to admin portal button', () => {
      const html = renderWithAuth(
        <PricingPage initialPlans={mockApprovedPlans} />,
        { user: mockAdminUser }
      );

      assert.match(html, /href="\/admin-dashboard"/);
      assert.match(html, /Return to Dashboard/i);
    });
  });

  // =========================================================================
  // 5. Frequently Asked Questions (FAQ) Section
  // =========================================================================
  describe('5. FAQ & Business Policy Clarity', () => {
    test('5.1 FAQ explains credit expiry, multi-package stacking, and non-recurring nature', () => {
      const html = renderWithAuth(<PricingPage initialPlans={mockApprovedPlans} />);

      assert.match(html, /Frequently Asked Questions/i);
      assert.match(html, /Do my credits ever expire\?/i);
      assert.match(html, /Can I purchase multiple packages\?/i);
      assert.match(html, /What does 1 credit unlock\?/i);
      assert.match(html, /Is this a recurring subscription\?/i);
      assert.match(html, /credits never expire/i);
      assert.match(html, /automatically stack/i);
      assert.match(html, /strictly one-time purchases/i);
    });
  });

  // =========================================================================
  // 6. Router Integration & Global Navigation
  // =========================================================================
  describe('6. Router Integration & Global Navigation Links', () => {
    test('6.1 AppRouter mounts /pricing as a public route without requiring login', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/pricing',
      });

      assert.match(html, /Simple, Transparent Pricing/i);
      assert.match(html, /Contact Reveal Credit Packages/i);
    });

    test('6.2 Header renders Pricing navigation link', () => {
      const html = renderWithAuth(<Header />, {
        user: null,
        initialRoute: '/',
      });

      assert.match(html, /href="\/pricing"/);
      assert.match(html, /Pricing/);
    });

    test('6.3 MobileNav renders Pricing navigation link with Credits badge', () => {
      const html = renderWithAuth(<MobileNav isOpen={true} onClose={() => {}} />, {
        user: null,
        initialRoute: '/',
      });

      assert.match(html, /href="\/pricing"/);
      assert.match(html, /Pricing/);
      assert.match(html, /Credits/);
    });

    test('6.4 Footer renders Pricing & Credits navigation link', () => {
      const html = renderWithAuth(<Footer />, {
        user: null,
        initialRoute: '/',
      });

      assert.match(html, /href="\/pricing"/);
      assert.match(html, /Pricing &amp; Credits/i);
    });
  });
});

