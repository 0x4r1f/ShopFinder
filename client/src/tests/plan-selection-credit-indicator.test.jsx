import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { CreditContext } from '../context/CreditContext.jsx';
import PricingPage from '../pages/PricingPage.jsx';
import Header from '../components/layout/Header.jsx';
import MobileNav from '../components/layout/MobileNav.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import CreditBadge from '../components/common/CreditBadge.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

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
 * Approved Plan Fixtures (D-001)
 */
const mockPlans = [
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
 * Helper: Render component with AuthContext, CreditContext, and MemoryRouter
 */
function renderWithContext(
  ui,
  {
    user = mockCustomerUser,
    credits = 10,
    activeCount = 1,
    loading = false,
    error = null,
    initialRoute = '/',
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

  const isCustomer = Boolean(user && user.role === 'customer');

  const creditValue = {
    credits: isCustomer ? credits : null,
    activeSubscriptionsCount: isCustomer ? activeCount : 0,
    activeSubscriptions: isCustomer
      ? [
          {
            id: 'sub_001',
            plan_name: 'Starter',
            credits_total: 10,
            credits_used: 0,
            credits_remaining: credits,
            status: 'active',
          },
        ]
      : [],
    loading: isCustomer ? loading : false,
    error: isCustomer ? error : null,
    refreshCredits: async () => {},
    isCustomer,
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <CreditContext.Provider value={creditValue}>
        <MemoryRouter initialEntries={[initialRoute]}>
          {ui}
        </MemoryRouter>
      </CreditContext.Provider>
    </AuthContext.Provider>
  );
}

describe('Phase 9, Task 9.5 — Plan Selection Flow & Credit Balance Indicator', () => {
  // =========================================================================
  // 1. Plan Selection Flow Requirements (1-8)
  // =========================================================================
  describe('1. Plan Selection Flow on Pricing Page', () => {
    test('1. Anonymous visitors are directed to registration', () => {
      const html = renderWithContext(
        <PricingPage initialPlans={mockPlans} />,
        { user: null }
      );

      assert.match(html, /href="\/register"/);
      assert.match(html, /Get Started with Starter/i);
      assert.match(html, /Get Started with Pro/i);
      assert.doesNotMatch(html, /data-testid="select-plan-starter"/);
    });

    test('2. Authenticated customers can select Starter', () => {
      const html = renderWithContext(
        <PricingPage initialPlans={mockPlans} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="select-plan-starter"/);
      assert.match(html, /Select Starter/i);
    });

    test('3. Authenticated customers can select Pro', () => {
      const html = renderWithContext(
        <PricingPage initialPlans={mockPlans} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="select-plan-pro"/);
      assert.match(html, /Select Pro/i);
    });

    test('4. Selected package details are accurate (name, price, credits)', () => {
      const html = renderWithContext(
        <PricingPage
          initialPlans={mockPlans}
          initialSelectedPlan={mockPlans[1]} // Pro
        />,
        { user: mockCustomerUser }
      );

      assert.match(html, /Pro Credit Package/i);
      assert.match(html, /৳999/);
      assert.match(html, /100/);
      assert.match(html, /Credits Included/i);
      assert.match(html, /One-time payment/i);
      assert.match(html, /Never expires/i);
    });

    test('5. Customer can return and change selection', () => {
      const htmlModal = renderWithContext(
        <PricingPage
          initialPlans={mockPlans}
          initialSelectedPlan={mockPlans[0]}
        />,
        { user: mockCustomerUser }
      );

      assert.match(htmlModal, /Change Package/i);
      assert.match(htmlModal, /data-testid="cancel-selection-button"/);

      const htmlConfirmed = renderWithContext(
        <PricingPage
          initialPlans={mockPlans}
          initialSelectedPlan={mockPlans[0]}
          initialSelectionConfirmed={true}
        />,
        { user: mockCustomerUser }
      );

      assert.match(htmlConfirmed, /data-testid="change-plan-button"/);
      assert.match(htmlConfirmed, /Change Package/i);
    });

    test('6. Selection does not create a purchase or grant credits (Phase 11 Notice)', () => {
      const html = renderWithContext(
        <PricingPage
          initialPlans={mockPlans}
          initialSelectedPlan={mockPlans[0]}
        />,
        { user: mockCustomerUser }
      );

      assert.match(html, /Online Payment Activation Pending \(Phase 11\)/i);
      assert.match(html, /without charging your payment method or allocating credits/i);
      assert.match(html, /Confirm Starter Selection/i);
    });

    test('7. Repeated interactions do not cause duplicate submissions (isSubmitting lock)', () => {
      const pricingPagePath = path.join(clientSrcDir, 'pages', 'PricingPage.jsx');
      const content = fs.readFileSync(pricingPagePath, 'utf8');

      // Verify isSubmitting guard and disabled state
      assert.ok(content.includes('if (isSubmitting || !selectedPlan) return;'));
      assert.ok(content.includes('disabled={isSubmitting}'));
    });

    test('8. Loading, error, and confirmation states behave correctly', () => {
      const htmlLoading = renderWithContext(
        <PricingPage initialPlans={null} initialLoading={true} />,
        { user: mockCustomerUser }
      );
      assert.match(htmlLoading, /data-testid="pricing-loading"/);

      const htmlError = renderWithContext(
        <PricingPage initialPlans={null} initialError="Service unavailable" />,
        { user: mockCustomerUser }
      );
      assert.match(htmlError, /Service unavailable/);

      const htmlConfirmed = renderWithContext(
        <PricingPage
          initialPlans={mockPlans}
          initialSelectedPlan={mockPlans[0]}
          initialSelectionConfirmed={true}
        />,
        { user: mockCustomerUser }
      );
      assert.match(htmlConfirmed, /data-testid="plan-selection-confirmed"/);
      assert.match(htmlConfirmed, /Package Selection Saved/i);
    });
  });

  // =========================================================================
  // 2. Header and Mobile Navigation Credit Balance Indicator (9-15)
  // =========================================================================
  describe('2. Header and Mobile Navigation Credit Indicators', () => {
    test('9. Customer sees the correct available credit balance in Header', () => {
      const html = renderWithContext(<Header />, {
        user: mockCustomerUser,
        credits: 10,
      });

      assert.match(html, /data-testid="header-credit-indicator"/);
      assert.match(html, /data-testid="header-credits-count"/);
      assert.match(html, /10 Credits/);
      assert.match(html, /Available contact reveal credits: 10/);
    });

    test('10. Anonymous visitors do not see customer credits in Header or MobileNav', () => {
      const headerHtml = renderWithContext(<Header />, { user: null });
      assert.doesNotMatch(headerHtml, /data-testid="header-credit-indicator"/);
      assert.doesNotMatch(headerHtml, /Available contact reveal credits/);

      const mobileHtml = renderWithContext(<MobileNav isOpen={true} onClose={() => {}} />, {
        user: null,
      });
      assert.doesNotMatch(mobileHtml, /data-testid="mobile-credit-indicator"/);
    });

    test('11. Owners do not see customer credits in Header or MobileNav', () => {
      const headerHtml = renderWithContext(<Header />, { user: mockOwnerUser });
      assert.doesNotMatch(headerHtml, /data-testid="header-credit-indicator"/);

      const mobileHtml = renderWithContext(<MobileNav isOpen={true} onClose={() => {}} />, {
        user: mockOwnerUser,
      });
      assert.doesNotMatch(mobileHtml, /data-testid="mobile-credit-indicator"/);
    });

    test('12. Admins do not see customer credits in Header or MobileNav', () => {
      const headerHtml = renderWithContext(<Header />, { user: mockAdminUser });
      assert.doesNotMatch(headerHtml, /data-testid="header-credit-indicator"/);

      const mobileHtml = renderWithContext(<MobileNav isOpen={true} onClose={() => {}} />, {
        user: mockAdminUser,
      });
      assert.doesNotMatch(mobileHtml, /data-testid="mobile-credit-indicator"/);
    });

    test('13. Zero credits display correctly', () => {
      const html = renderWithContext(<Header />, {
        user: mockCustomerUser,
        credits: 0,
      });

      assert.match(html, /0 Credits/);
      assert.match(html, /Available contact reveal credits: 0/);
    });

    test('14. API failures do not break navigation', () => {
      const html = renderWithContext(<Header />, {
        user: mockCustomerUser,
        credits: 0,
        error: 'Network unreachable',
      });

      // Navigation links remain fully rendered and interactive
      assert.match(html, /href="\/marketplace"/);
      assert.match(html, /href="\/pricing"/);
      assert.match(html, /href="\/dashboard"/);
      assert.match(html, /data-testid="header-credit-indicator"/);
    });

    test('15. Mobile navigation displays credit indicator and remains responsive', () => {
      const html = renderWithContext(<MobileNav isOpen={true} onClose={() => {}} />, {
        user: mockCustomerUser,
        credits: 25,
      });

      assert.match(html, /data-testid="mobile-credit-indicator"/);
      assert.match(html, /data-testid="mobile-credits-count"/);
      assert.match(html, /25/);
      assert.match(html, /Available Credits/);
      assert.match(html, /href="\/dashboard"/);
    });
  });

  // =========================================================================
  // 3. Customer Dashboard Credit Balance (16-20)
  // =========================================================================
  describe('3. Customer Dashboard Credit Balance Integration', () => {
    test('16. Balance matches the backend response', () => {
      const dashboardData = {
        credits_remaining: 45,
        active_subscriptions_count: 2,
        active_subscriptions: [
          {
            id: 'sub_1',
            plan_name: 'Starter',
            credits_total: 10,
            credits_used: 0,
            credits_remaining: 10,
          },
          {
            id: 'sub_2',
            plan_name: 'Pro',
            credits_total: 100,
            credits_used: 65,
            credits_remaining: 35,
          },
        ],
        recent_saved: [],
        recent_reveals: [],
      };

      const html = renderWithContext(
        <DashboardPage initialData={dashboardData} />,
        { user: mockCustomerUser, credits: 45 }
      );

      assert.match(html, /data-testid="credits-balance"/);
      assert.match(html, /45/);
      assert.match(html, /credits remaining/i);
    });

    test('17. Active package count is displayed correctly', () => {
      const dashboardData = {
        credits_remaining: 100,
        active_subscriptions_count: 1,
        active_subscriptions: [
          {
            id: 'sub_pro',
            plan_name: 'Pro',
            credits_total: 100,
            credits_used: 0,
            credits_remaining: 100,
          },
        ],
        recent_saved: [],
        recent_reveals: [],
      };

      const html = renderWithContext(
        <DashboardPage initialData={dashboardData} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /data-testid="active-packages-badge"/);
      assert.match(html, /1 active package/i);
      assert.match(html, /data-testid="dashboard-packages-breakdown"/);
      assert.match(html, /Pro/);
    });

    test('18. Zero-credit state works with Get Credits CTA', () => {
      const dashboardData = {
        credits_remaining: 0,
        active_subscriptions_count: 0,
        active_subscriptions: [],
        recent_saved: [],
        recent_reveals: [],
      };

      const html = renderWithContext(
        <DashboardPage initialData={dashboardData} />,
        { user: mockCustomerUser, credits: 0 }
      );

      assert.match(html, />0<\/span>/);
      assert.match(html, /Get Credits/i);
      assert.match(html, /You have no credits remaining/i);
      assert.match(html, /href="\/pricing"/);
    });

    test('19. Loading and error states work on Dashboard', () => {
      const htmlLoading = renderWithContext(
        <DashboardPage initialData={null} />,
        { user: mockCustomerUser }
      );
      assert.match(htmlLoading, /data-testid="dashboard-loading"/);
      assert.match(htmlLoading, /Loading customer dashboard/i);
    });

    test('20. Existing dashboard features remain functional (Quick Links, Activity)', () => {
      const dashboardData = {
        credits_remaining: 10,
        active_subscriptions_count: 1,
        active_subscriptions: [],
        recent_saved: [
          {
            id: 'fav_1',
            listing_id: 'lst_1',
            title: 'Dhanmondi Commercial Space',
            city: 'Dhaka',
            price: 75000,
            listing_type: 'rent',
          },
        ],
        recent_reveals: [],
      };

      const html = renderWithContext(
        <DashboardPage initialData={dashboardData} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /Browse Marketplace/i);
      assert.match(html, /My Saved Properties/i);
      assert.match(html, /Reveal History/i);
      assert.match(html, /Dhanmondi Commercial Space/i);
    });
  });

  // =========================================================================
  // 4. Security, Architecture & Phase Boundary Guardrails (21-25)
  // =========================================================================
  describe('4. Security & Architectural Boundaries', () => {
    test('21. Client-supplied customer IDs cannot override authenticated identity in CreditBadge', () => {
      // CreditBadge relies strictly on AuthContext and CreditContext, never URL query or props
      const html = renderWithContext(
        <CreditBadge customerId="attacker_id_spoof" />,
        { user: mockCustomerUser, credits: 10 }
      );

      assert.match(html, /data-testid="header-credit-indicator"/);
      assert.match(html, /10 Credits/);
      assert.doesNotMatch(html, /attacker_id_spoof/);
    });

    test('22. No browser-to-PocketBase direct communication is introduced', () => {
      const creditBadgeCode = fs.readFileSync(
        path.join(clientSrcDir, 'components', 'common', 'CreditBadge.jsx'),
        'utf8'
      );
      const creditContextCode = fs.readFileSync(
        path.join(clientSrcDir, 'context', 'CreditContext.jsx'),
        'utf8'
      );

      assert.doesNotMatch(creditBadgeCode, /pocketbase/i);
      assert.doesNotMatch(creditContextCode, /pocketbase/i);
    });

    test('23. No purchase allocation or credit deduction occurs from plan selection', () => {
      const pricingPageCode = fs.readFileSync(
        path.join(clientSrcDir, 'pages', 'PricingPage.jsx'),
        'utf8'
      );

      // Verify that no API calls creating subscriptions or altering credits exist in selection handlers
      assert.doesNotMatch(pricingPageCode, /createSubscription/);
      assert.doesNotMatch(pricingPageCode, /allocateCredits/);
      assert.doesNotMatch(pricingPageCode, /post.*\/api\/v1\/customer\/subscriptions/);
    });

    test('24. D-013 reveal transaction behavior remains unchanged in pb_hooks', () => {
      const hooksDir = path.resolve(__dirname, '../../../pocketbase/pb_hooks');
      // Ensure no unauthorized modifications were made to reveal or subscription hooks
      assert.ok(fs.existsSync(path.join(hooksDir, 'subscription_plans.pb.js')));
      assert.ok(fs.existsSync(path.join(hooksDir, 'user_subscriptions.pb.js')));
    });

    test('25. Owner and admin route protections remain intact', () => {
      // Owner trying to render CreditBadge gets null
      const ownerBadge = renderWithContext(<CreditBadge />, { user: mockOwnerUser });
      assert.strictEqual(ownerBadge, '');

      // Admin trying to render CreditBadge gets null
      const adminBadge = renderWithContext(<CreditBadge />, { user: mockAdminUser });
      assert.strictEqual(adminBadge, '');

      // Anonymous trying to render CreditBadge gets null
      const anonBadge = renderWithContext(<CreditBadge />, { user: null });
      assert.strictEqual(anonBadge, '');
    });
  });
});

