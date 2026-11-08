import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { CreditContext } from '../context/CreditContext.jsx';
import OwnerInfoCard from '../components/marketplace/OwnerInfoCard.jsx';
import ContactRevealModal from '../components/marketplace/ContactRevealModal.jsx';
import CustomerRevealsPage, { formatRevealTime } from '../pages/CustomerRevealsPage.jsx';
import ListingDetailPage from '../pages/ListingDetailPage.jsx';
import { revealContact, getRevealHistory } from '../services/revealService.js';
import { setApiBaseUrl, getApiBaseUrl } from '../services/api.js';

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
 * Mock Listing Fixture
 */
const mockListing = {
  id: 'lst_banani_01',
  title: 'Banani Prime Corner Retail Shop',
  category: 'retail',
  city: 'Dhaka',
  area: 'Banani',
  price: 45000,
  listing_type: 'rent',
  status: 'approved',
  owner: {
    id: 'usr_owner1234567',
    name: 'Tariq Owner',
    created: '2025-06-15T10:00:00.000Z',
  },
};

/**
 * Mock Backend Reveal History Records (Phase 10 API format)
 */
const mockApiRevealHistory = [
  {
    id: 'rev_rec_001',
    revealedAt: '2026-11-08T12:00:00.000Z',
    listing: {
      id: 'lst_banani_01',
      title: 'Banani Prime Corner Retail Shop',
      category: 'retail',
      city: 'Dhaka',
      area: 'Banani',
      price: 45000,
      status: 'approved',
      imageUrl: null,
    },
  },
  {
    id: 'rev_rec_002',
    revealedAt: '2026-11-08T11:30:00.000Z',
    listing: {
      id: 'lst_gulshan_02',
      title: 'Gulshan Corporate Office Floor',
      category: 'office',
      city: 'Dhaka',
      area: 'Gulshan 2',
      price: 180000,
      status: 'approved',
      imageUrl: null,
    },
  },
  {
    id: 'rev_rec_003_deleted',
    revealedAt: '2026-11-07T14:15:00.000Z',
    listing: null, // Listing was deleted or is unavailable
  },
];

/**
 * Helper: Render component with AuthContext, CreditContext, and MemoryRouter
 */
function renderWithContext(
  ui,
  {
    user = mockCustomerUser,
    credits = 5,
    activeCount = 1,
    initialRoute = '/listings/lst_banani_01',
    setCredits = () => {},
    refreshCredits = async () => {},
    creditValueOverride = null,
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

  const creditValue = creditValueOverride || {
    credits: isCustomer ? credits : null,
    activeSubscriptionsCount: isCustomer ? activeCount : 0,
    activeSubscriptions: [],
    loading: false,
    error: null,
    refreshCredits,
    setCredits,
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

describe('Phase 10, Task 10.9 — Interactive Contact Reveal Modal & History UI', () => {

  // =========================================================================
  // 1. OwnerInfoCard Trigger & RBAC Visibility
  // =========================================================================
  describe('1. OwnerInfoCard Trigger & Role-Based Access Controls', () => {
    test('1.1 Anonymous visitor sees "Sign In to Reveal Contact" linking to /login with redirect parameter', () => {
      const html = renderWithContext(
        <OwnerInfoCard owner={mockListing.owner} listing={mockListing} />,
        { user: null }
      );

      assert.match(html, /Sign In to Reveal Contact/i);
      assert.match(html, /href="\/login\?redirect=%2Flistings%2Flst_banani_01"/);
      assert.match(html, /Sign in with a customer account/i);
    });

    test('1.2 Authenticated customer sees active "Reveal Contact (1 Credit)" button', () => {
      const html = renderWithContext(
        <OwnerInfoCard owner={mockListing.owner} listing={mockListing} />,
        { user: mockCustomerUser, credits: 5 }
      );

      assert.match(html, /Reveal Contact \(1 Credit\)/i);
      assert.match(html, /data-testid="reveal-contact-button"/);
      assert.match(html, /1 credit per listing • Free permanent repeat view/i);
      assert.doesNotMatch(html, /Sign In to Reveal Contact/i);
    });

    test('1.3 Authenticated owner sees disabled button with customer-only notice', () => {
      const html = renderWithContext(
        <OwnerInfoCard owner={mockListing.owner} listing={mockListing} />,
        { user: mockOwnerUser }
      );

      assert.match(html, /Reveal Contact \(Customers Only\)/i);
      assert.match(html, /disabled/i);
      assert.match(html, /reserved exclusively for verified customer accounts/i);
      assert.doesNotMatch(html, /data-testid="reveal-contact-button"/);
    });

    test('1.4 Authenticated admin sees disabled button with customer-only notice', () => {
      const html = renderWithContext(
        <OwnerInfoCard owner={mockListing.owner} listing={mockListing} />,
        { user: mockAdminUser }
      );

      assert.match(html, /Reveal Contact \(Customers Only\)/i);
      assert.match(html, /disabled/i);
      assert.match(html, /reserved exclusively for verified customer accounts/i);
    });

    test('1.5 OwnerInfoCard always displays protected contact notice (D-014)', () => {
      const html = renderWithContext(
        <OwnerInfoCard owner={mockListing.owner} listing={mockListing} />,
        { user: mockCustomerUser }
      );

      assert.match(html, /Contact Number Protected/i);
      assert.match(html, /private and is not publicly displayed on this page/i);
      // Ensure raw phone numbers are never present in static page
      assert.doesNotMatch(html, /\+880/);
    });

    test('1.6 ListingDetailPage source code wires listing prop to OwnerInfoCard', () => {
      const detailSource = fs.readFileSync(
        path.join(clientSrcDir, 'pages', 'ListingDetailPage.jsx'),
        'utf8'
      );

      assert.match(
        detailSource,
        /<OwnerInfoCard[^>]*listing=\{listing\}[^>]*\/>/,
        'ListingDetailPage must pass listing={listing} to OwnerInfoCard'
      );
    });
  });

  // =========================================================================
  // 2. ContactRevealModal Accessible Component Testing
  // =========================================================================
  describe('2. ContactRevealModal Presentation & Privacy States', () => {
    test('2.1 Renders null when isOpen is false or listing is null', () => {
      const htmlClosed = renderWithContext(
        <ContactRevealModal isOpen={false} listing={mockListing} onClose={() => {}} />
      );
      assert.strictEqual(htmlClosed, '');

      const htmlNoListing = renderWithContext(
        <ContactRevealModal isOpen={true} listing={null} onClose={() => {}} />
      );
      assert.strictEqual(htmlNoListing, '');
    });

    test('2.2 Renders accessible dialog semantics (role="dialog", aria-modal="true", labelledby)', () => {
      const html = renderWithContext(
        <ContactRevealModal isOpen={true} listing={mockListing} onClose={() => {}} />,
        { user: mockCustomerUser, credits: 3 }
      );

      assert.match(html, /role="dialog"/);
      assert.match(html, /aria-modal="true"/);
      assert.match(html, /aria-labelledby="reveal-modal-title"/);
      assert.match(html, /aria-describedby="reveal-modal-description"/);
      assert.match(html, /aria-label="Close dialog"/);
    });

    test('2.3 Pre-reveal confirmation displays listing title, 1 credit cost, and customer balance', () => {
      const html = renderWithContext(
        <ContactRevealModal isOpen={true} listing={mockListing} onClose={() => {}} />,
        { user: mockCustomerUser, credits: 4 }
      );

      assert.match(html, /Reveal Owner Contact/);
      assert.match(html, /Banani Prime Corner Retail Shop/);
      assert.match(html, /Reveal Cost/);
      assert.match(html, /1 Credit/);
      assert.match(html, /Your Balance/);
      assert.match(html, /4 credits/);
      assert.match(html, /Balance After Reveal/);
      assert.match(html, /3 credits/);
      assert.match(html, /One-Time Deduction Guarantee/);
      assert.match(html, /Reveal Contact \(1 Credit\)/);
    });

    test('2.4 Customer with 0 credits automatically sees Insufficient Credits state with CTA to /pricing', () => {
      const html = renderWithContext(
        <ContactRevealModal isOpen={true} listing={mockListing} onClose={() => {}} />,
        { user: mockCustomerUser, credits: 0 }
      );

      assert.match(html, /Insufficient Credits/i);
      assert.match(html, /Credits Required for Contact Unlocking/i);
      assert.match(html, /You do not have enough credits/i);
      assert.match(html, /Current Balance:.*0 credits/);
      assert.match(html, /href="\/pricing"/);
      assert.match(html, /View Credit Packages/i);
      assert.doesNotMatch(html, /Reveal Contact \(1 Credit\)/);
    });

    test('2.5 Modal component file guarantees zero localStorage or sessionStorage storage of phone', () => {
      const modalSource = fs.readFileSync(
        path.join(clientSrcDir, 'components', 'marketplace', 'ContactRevealModal.jsx'),
        'utf8'
      );

      assert.doesNotMatch(modalSource, /localStorage/);
      assert.doesNotMatch(modalSource, /sessionStorage/);
      assert.doesNotMatch(modalSource, /console\.log.*ownerPhone/i);
      assert.doesNotMatch(modalSource, /console\.log.*revealedPhone/i);
    });

    test('2.6 Modal component cleans sensitive phone state on close or listing change', () => {
      const modalSource = fs.readFileSync(
        path.join(clientSrcDir, 'components', 'marketplace', 'ContactRevealModal.jsx'),
        'utf8'
      );

      assert.match(modalSource, /setRevealedPhone\(null\)/);
      assert.match(modalSource, /resetState/);
    });
  });

  // =========================================================================
  // 3. CustomerRevealHistory UI (Real API & Edge Case Integration)
  // =========================================================================
  describe('3. CustomerRevealHistory Page Component & Invariants', () => {
    test('3.1 Renders page title, guide, and EmptyState when no revealed records exist', () => {
      const html = renderWithContext(
        <CustomerRevealsPage initialReveals={[]} autoFetch={false} />
      );

      assert.match(html, /Contact Reveal History/i);
      assert.match(html, /About Contact Reveals \(Phase 10 Engine\)/i);
      assert.match(html, /No revealed contacts yet/i);
      assert.match(html, /href="\/marketplace"/);
      assert.match(html, /Browse Marketplace/i);
    });

    test('3.2 Renders loading spinner when initialLoading is true', () => {
      const html = renderWithContext(
        <CustomerRevealsPage initialLoading={true} initialReveals={[]} autoFetch={false} />
      );

      assert.match(html, /data-testid="reveals-loading"/);
      assert.match(html, /Loading your contact reveal history/i);
      assert.match(html, /Fetching unlocked commercial property contacts/i);
    });

    test('3.3 Renders error state with Retry button when initialError is provided', () => {
      const html = renderWithContext(
        <CustomerRevealsPage
          initialError="Failed to connect to contact reveal service."
          initialReveals={[]}
          autoFetch={false}
        />
      );

      assert.match(html, /data-testid="reveals-error"/);
      assert.match(html, /Failed to Load History/i);
      assert.match(html, /Failed to connect to contact reveal service/i);
      assert.match(html, /Retry/i);
    });

    test('3.4 Renders real backend reveal records with property title, location, and price', () => {
      const html = renderWithContext(
        <CustomerRevealsPage initialReveals={mockApiRevealHistory} autoFetch={false} />
      );

      assert.match(html, /data-testid="reveals-grid"/);
      assert.match(html, /data-testid="reveal-card-lst_banani_01"/);
      assert.match(html, /data-testid="reveal-card-lst_gulshan_02"/);
      assert.match(html, /Banani Prime Corner Retail Shop/);
      assert.match(html, /Gulshan Corporate Office Floor/);
      assert.match(html, /৳45,000/);
      assert.match(html, /৳1,?80,000/);
      assert.match(html, /Banani, Dhaka/);
      assert.match(html, /Gulshan 2, Dhaka/);
      assert.match(html, /Unlocked/);
      assert.match(html, /View Listing/);
    });

    test('3.5 Gracefully handles deleted/archived listing (listing === null) without broken links', () => {
      const html = renderWithContext(
        <CustomerRevealsPage initialReveals={mockApiRevealHistory} autoFetch={false} />
      );

      assert.match(html, /Property Listing No Longer Available/i);
      assert.match(html, /This commercial listing has been removed or is no longer active/i);
      assert.match(html, /Unlocked \(Archived\)/i);
      assert.match(html, /Listing inactive/i);
      // Ensure there are no broken links to "/listings/null" or "/listings/undefined"
      assert.doesNotMatch(html, /href="\/listings\/null"/);
      assert.doesNotMatch(html, /href="\/listings\/undefined"/);
    });

    test('3.6 D-014 Privacy Invariant: Customer reveal history NEVER renders owner phone numbers', () => {
      // Inject dummy phone numbers into mock data to verify they are never rendered
      const recordsWithSneakyPhones = [
        {
          id: 'rev_with_phone',
          revealedAt: '2026-11-08T12:00:00.000Z',
          ownerPhone: '+8801712345678',
          phone: '01812345678',
          listing: {
            id: 'lst_phone_test',
            title: 'Test Commercial Shop',
            city: 'Dhaka',
            area: 'Motijheel',
            price: 50000,
            status: 'approved',
          },
        },
      ];

      const html = renderWithContext(
        <CustomerRevealsPage initialReveals={recordsWithSneakyPhones} autoFetch={false} />
      );

      assert.doesNotMatch(html, /\+880/);
      assert.doesNotMatch(html, /01[3-9]\d{8}/);
    });

    test('3.7 Renders interactive pagination bar when totalPages > 1', () => {
      const html = renderWithContext(
        <CustomerRevealsPage
          initialReveals={mockApiRevealHistory}
          initialPagination={{ page: 1, perPage: 12, totalItems: 25, totalPages: 3 }}
          autoFetch={false}
        />
      );

      assert.match(html, /data-testid="reveals-pagination"/);
      assert.match(html, /Showing page.*1.*of.*3.*\(25 total revealed\)/);
      assert.match(html, /data-testid="pagination-prev"/);
      assert.match(html, /data-testid="pagination-next"/);
      // On page 1, previous is disabled
      assert.match(html, /(?:data-testid="pagination-prev"[^>]*disabled|disabled[^>]*data-testid="pagination-prev")/);
    });
  });

  // =========================================================================
  // 4. revealService Client Architecture & Privacy Boundaries
  // =========================================================================
  describe('4. revealService Client Architecture & Security Contracts', () => {
    test('4.1 revealService source communicates exclusively with Express REST endpoints', () => {
      const serviceSource = fs.readFileSync(
        path.join(clientSrcDir, 'services', 'revealService.js'),
        'utf8'
      );

      assert.match(serviceSource, /\/api\/v1\/customer\/reveal/);
      assert.match(serviceSource, /\/api\/v1\/reveal\/history/);
      assert.match(serviceSource, /from '\.\/api\.js'/);
      // Zero direct PocketBase browser imports
      assert.doesNotMatch(serviceSource, /pocketbase/i);
      assert.doesNotMatch(serviceSource, /8090/);
    });

    test('4.2 revealService exports revealContact and getRevealHistory functions', () => {
      assert.strictEqual(typeof revealContact, 'function');
      assert.strictEqual(typeof getRevealHistory, 'function');
    });

    test('4.3 CreditContext provides setCredits and refreshCredits', () => {
      const contextSource = fs.readFileSync(
        path.join(clientSrcDir, 'context', 'CreditContext.jsx'),
        'utf8'
      );

      assert.match(contextSource, /setCredits:/);
      assert.match(contextSource, /refreshCredits:/);
      assert.match(contextSource, /updateCreditBalance/);
    });
  });

  // =========================================================================
  // 5. Behavioral: Reveal API Integration & In-Flight Control (Points 1–4)
  // =========================================================================
  describe('5. Behavioral: Reveal API Integration & In-Flight Lock', () => {
    test('1. Clicking reveal confirmation action calls revealContact(listingId) exactly once', async () => {
      let callCount = 0;
      let controller = null;
      const mockRevealFn = async () => {
        callCount++;
        return {
          revealed: true,
          ownerPhone: '+8801711223344',
          alreadyRevealed: false,
          creditsRemaining: 4,
        };
      };

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={mockRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      assert.ok(controller, 'Controller must be exposed for behavioral testing');
      await controller.handleReveal();
      assert.strictEqual(callCount, 1, 'revealContact must be called exactly once');
    });

    test('2. The correct listing ID is passed to the reveal API service', async () => {
      let passedListingId = null;
      let controller = null;
      const mockRevealFn = async (id) => {
        passedListingId = id;
        return {
          revealed: true,
          ownerPhone: '+8801711223344',
          alreadyRevealed: false,
          creditsRemaining: 4,
        };
      };

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={mockRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      await controller.handleReveal();
      assert.strictEqual(passedListingId, mockListing.id, 'Must pass the exact target listing ID');
    });

    test('3. The loading state appears while the request is pending', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialLoading={true}
          onClose={() => {}}
        />
      );

      assert.match(html, /Securing and unlocking owner contact/i);
      assert.match(html, /Validating customer subscription balance via trusted session/i);
      // Action buttons must be disabled while in loading state
      assert.match(html, /disabled/i);
    });

    test('4. Duplicate clicks during an in-flight request do not create duplicate API calls', async () => {
      let callCount = 0;
      let finishPromise;
      const slowRevealFn = () =>
        new Promise((resolve) => {
          callCount++;
          finishPromise = resolve;
        });

      let controller = null;
      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={slowRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      // Trigger first click
      const p1 = controller.handleReveal();
      // Immediate duplicate clicks while p1 is in-flight
      const p2 = controller.handleReveal();
      const p3 = controller.handleReveal();

      // Resolve the pending promise
      finishPromise({
        revealed: true,
        ownerPhone: '+8801711223344',
        alreadyRevealed: false,
        creditsRemaining: 4,
      });

      await Promise.all([p1, p2, p3]);
      assert.strictEqual(callCount, 1, 'In-flight lock must block duplicate concurrent calls');
    });
  });

  // =========================================================================
  // 6. Behavioral: First-Time Reveal & Credit Balance Synchronization (Points 5–8)
  // =========================================================================
  describe('6. Behavioral: First-Time Reveal & Credit Balance Synchronization', () => {
    test('5. A successful first-time reveal displays the phone returned by the backend', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialPhone="+8801711223344"
          initialAlreadyRevealed={false}
          onClose={() => {}}
        />
      );

      assert.match(html, /\+8801711223344/);
      assert.match(html, /href="tel:\+8801711223344"/);
      assert.match(html, /Copy Number/);
      assert.match(html, /Call Owner/);
    });

    test('6. The modal identifies the reveal as a first-time reveal', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialPhone="+8801711223344"
          initialAlreadyRevealed={false}
          onClose={() => {}}
        />
      );

      assert.match(html, /Contact Revealed \(1 Credit Deducted\)/);
      assert.doesNotMatch(html, /Previously Revealed/);
    });

    test('7. The credit balance updates to the backend creditsRemaining value and calls refreshCredits', async () => {
      let balanceReceived = null;
      let refreshInvoked = false;
      let controller = null;

      const mockRevealFn = async () => ({
        revealed: true,
        ownerPhone: '+8801711223344',
        alreadyRevealed: false,
        creditsRemaining: 7, // Backend authoritative remaining balance
      });

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={mockRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />,
        {
          setCredits: (val) => { balanceReceived = val; },
          refreshCredits: async () => { refreshInvoked = true; },
        }
      );

      await controller.handleReveal();
      assert.strictEqual(balanceReceived, 7, 'setCredits must receive creditsRemaining (7)');
      assert.strictEqual(refreshInvoked, true, 'refreshCredits must be called');
    });

    test('8. No frontend-only credit deduction is performed independently of backend results', async () => {
      let creditChangedBeforeBackend = false;
      let controller = null;

      const slowMockFn = async () => {
        // At the moment the API call is in-flight, verify credit balance has NOT been prematurely decremented
        assert.strictEqual(
          creditChangedBeforeBackend,
          false,
          'Frontend must NOT decrement credit balance before backend confirms transaction'
        );
        return {
          revealed: true,
          ownerPhone: '+8801711223344',
          alreadyRevealed: false,
          creditsRemaining: 4,
        };
      };

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={slowMockFn}
          onController={(ctrl) => { controller = ctrl; }}
        />,
        {
          setCredits: () => { creditChangedBeforeBackend = true; },
        }
      );

      await controller.handleReveal();
      assert.strictEqual(creditChangedBeforeBackend, true, 'Credit balance updates only upon successful response');
    });
  });

  // =========================================================================
  // 7. Behavioral: Repeat Reveal & Idempotency Safeguards (Points 9–12)
  // =========================================================================
  describe('7. Behavioral: Repeat Reveal & Idempotency Safeguards', () => {
    test('9. An already-revealed response displays the returned phone', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialPhone="+8801755667788"
          initialAlreadyRevealed={true}
          onClose={() => {}}
        />
      );

      assert.match(html, /\+8801755667788/);
      assert.match(html, /Call Owner/);
    });

    test('10. The modal indicates that no additional credit was deducted', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialPhone="+8801755667788"
          initialAlreadyRevealed={true}
          onClose={() => {}}
        />
      );

      assert.match(html, /Previously Revealed \(0 Credits Deducted\)/);
      assert.doesNotMatch(html, /Contact Revealed \(1 Credit Deducted\)/);
    });

    test('11. The existing credit balance is not decremented again on repeat reveal', async () => {
      let balanceDecremented = false;
      let controller = null;

      const repeatRevealFn = async () => ({
        revealed: true,
        ownerPhone: '+8801755667788',
        alreadyRevealed: true,
        creditsRemaining: 5, // Unchanged
      });

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={repeatRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />,
        {
          credits: 5,
          setCredits: (val) => {
            if (val < 5) balanceDecremented = true;
          },
        }
      );

      await controller.handleReveal();
      assert.strictEqual(balanceDecremented, false, 'Credit balance must not decrement on repeat reveal');
    });

    test('12. A null creditsRemaining does not corrupt the credit context', async () => {
      let setCreditsCalledWithNull = false;
      let controller = null;

      const nullCreditsRevealFn = async () => ({
        revealed: true,
        ownerPhone: '+8801755667788',
        alreadyRevealed: true,
        creditsRemaining: null, // Null / absent from backend
      });

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={nullCreditsRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />,
        {
          setCredits: (val) => {
            if (val === null || val === undefined || isNaN(val)) {
              setCreditsCalledWithNull = true;
            }
          },
        }
      );

      await controller.handleReveal();
      assert.strictEqual(setCreditsCalledWithNull, false, 'Null creditsRemaining must not be passed to setCredits');
    });
  });

  // =========================================================================
  // 8. Behavioral: Insufficient Credits & Controlled Error Handling (Points 13–17)
  // =========================================================================
  describe('8. Behavioral: Insufficient Credits & Error Handling', () => {
    test('13. An actual HTTP 402 API error displays the insufficient-credit state', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialError={{ status: 402, message: 'Insufficient credits to reveal contact' }}
          onClose={() => {}}
        />
      );

      assert.match(html, /Insufficient Credits/i);
      assert.match(html, /Credits Required for Contact Unlocking/i);
      assert.match(html, /You do not have enough credits to reveal this property/i);
    });

    test('14. The pricing CTA navigates to /pricing', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialError={{ status: 402, message: 'Insufficient credits' }}
          onClose={() => {}}
        />
      );

      assert.match(html, /href="\/pricing"/);
      assert.match(html, /View Credit Packages/i);
    });

    test('15. Other API failures display a controlled error message and retry button', () => {
      const html = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialError={{ status: 500, message: 'Internal reveal transaction failure' }}
          onClose={() => {}}
        />
      );

      assert.match(html, /Unable to Reveal Contact/i);
      assert.match(html, /Internal reveal transaction failure/i);
      assert.match(html, /Try Again/i);
    });

    test('16. Retry invokes the reveal API again', async () => {
      let attempts = 0;
      let controller = null;

      const failThenPassFn = async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Temporary gateway timeout');
          err.status = 504;
          throw err;
        }
        return {
          revealed: true,
          ownerPhone: '+8801700112233',
          alreadyRevealed: false,
          creditsRemaining: 3,
        };
      };

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={failThenPassFn}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      // First attempt fails
      await controller.handleReveal();
      assert.strictEqual(attempts, 1);
      assert.ok(controller.getState().error, 'First attempt must record error');

      // Retry invokes handleReveal a second time and succeeds
      await controller.handleReveal();
      assert.strictEqual(attempts, 2, 'Retry action must invoke reveal API again');
      assert.strictEqual(controller.getState().revealedPhone, '+8801700112233');
    });

    test('17. Failed requests never change the credit balance', async () => {
      let setCreditsCalled = false;
      let controller = null;

      const failingRevealFn = async () => {
        const err = new Error('Database locked');
        err.status = 500;
        throw err;
      };

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
          revealFn={failingRevealFn}
          onController={(ctrl) => { controller = ctrl; }}
        />,
        {
          setCredits: () => { setCreditsCalled = true; },
        }
      );

      await controller.handleReveal();
      assert.strictEqual(setCreditsCalled, false, 'Failed request must NEVER alter customer credit balance');
    });
  });

  // =========================================================================
  // 9. Behavioral: Sensitive State Lifecycle Protection (Points 18–20)
  // =========================================================================
  describe('9. Behavioral: Sensitive State Lifecycle Protection', () => {
    test('18. Closing the modal clears the phone from component state', () => {
      let closeCalled = false;
      let controller = null;

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          initialPhone="+8801799999999"
          onClose={() => { closeCalled = true; }}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      assert.strictEqual(controller.getState().revealedPhone, '+8801799999999');
      controller.handleSafeClose();
      assert.strictEqual(closeCalled, true, 'Close callback must be called');
      assert.strictEqual(
        controller.getState().revealedPhone,
        null,
        'Phone number must be cleared to null upon closing modal'
      );
    });

    test('19. Switching to a different listing cannot display previous listing phone', () => {
      let controller = null;

      renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={{ id: 'lst_first_01', title: 'First Shop' }}
          initialPhone="+8801711111111"
          onClose={() => {}}
          onController={(ctrl) => { controller = ctrl; }}
        />
      );

      assert.strictEqual(controller.getState().revealedPhone, '+8801711111111');
      // Reset state simulates listing transition
      controller.resetState();
      assert.strictEqual(
        controller.getState().revealedPhone,
        null,
        'Switching listings must clear phone state completely'
      );
    });

    test('20. Reopening the modal does not expose stale phone information', () => {
      // Step A: Modal closed
      const htmlClosed = renderWithContext(
        <ContactRevealModal
          isOpen={false}
          listing={mockListing}
          onClose={() => {}}
        />
      );
      assert.strictEqual(htmlClosed, '', 'Closed modal must render nothing');

      // Step B: Reopened modal without an existing reveal must show pre-reveal state
      const htmlReopened = renderWithContext(
        <ContactRevealModal
          isOpen={true}
          listing={mockListing}
          onClose={() => {}}
        />
      );
      assert.doesNotMatch(htmlReopened, /\+880/, 'Reopened modal must not contain stale phone numbers');
      assert.match(htmlReopened, /Reveal Contact \(1 Credit\)/);
      assert.match(htmlReopened, /Reveal Owner Contact/);
    });
  });
});
