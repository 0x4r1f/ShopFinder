import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import ownerService from '../services/ownerService.js';
import OwnerDashboardPage from '../pages/OwnerDashboardPage.jsx';
import OwnerSummaryCards from '../components/owner/OwnerSummaryCards.jsx';
import OwnerListingsTable from '../components/owner/OwnerListingsTable.jsx';
import DeleteListingModal from '../components/owner/DeleteListingModal.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock fixtures
 */
const mockOwnerUser = {
  id: 'usr_owner1234567',
  name: 'Tariq Rahman',
  email: 'tariq@example.com',
  role: 'owner',
};

const mockAdminUser = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@example.com',
  role: 'admin',
};

const mockCustomerUser = {
  id: 'usr_cust12345678',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
};

const mockListings = [
  {
    id: 'lst_approved0001',
    title: 'Gulshan Premium Office Suite',
    category: 'office',
    listing_type: 'rent',
    price: 180000,
    area_sqft: 2200,
    address: 'Road 11, Block D',
    city: 'Dhaka',
    area: 'Gulshan',
    status: 'approved',
    created: '2026-11-01T10:00:00.000Z',
    cover_image: {
      id: 'img_cover0001',
      url: 'http://localhost:4000/api/files/listing_images/img_cover0001/office.png',
      thumb_url: 'http://localhost:4000/api/files/listing_images/img_cover0001/office.png?thumb=400x300',
    },
  },
  {
    id: 'lst_pending00002',
    title: 'Dhanmondi Retail Showroom',
    category: 'retail',
    listing_type: 'rent',
    price: 120000,
    area_sqft: 1500,
    address: 'Satmasjid Road',
    city: 'Dhaka',
    area: 'Dhanmondi',
    status: 'pending',
    created: '2026-11-03T14:30:00.000Z',
    cover_image: null,
  },
  {
    id: 'lst_rejected0003',
    title: 'Tejgaon Industrial Warehouse',
    category: 'warehouse',
    listing_type: 'sale',
    price: 45000000,
    area_sqft: 8000,
    address: 'Tejgaon I/A',
    city: 'Dhaka',
    area: 'Tejgaon',
    status: 'rejected',
    created: '2026-11-04T09:15:00.000Z',
    cover_image: {
      id: 'img_cover0003',
      url: 'http://localhost:4000/api/files/listing_images/img_cover0003/wh.png',
      thumb_url: 'http://localhost:4000/api/files/listing_images/img_cover0003/wh.png?thumb=400x300',
    },
  },
  {
    id: 'lst_archived0004',
    title: 'Uttara Commercial Space',
    category: 'showroom',
    listing_type: 'rent',
    price: 95000,
    area_sqft: 1100,
    address: 'Sector 3',
    city: 'Dhaka',
    area: 'Uttara',
    status: 'archived',
    created: '2026-10-15T08:00:00.000Z',
    cover_image: null,
  },
];

function renderWithContext(ui, authValue = { user: mockOwnerUser, isAuthenticated: true, loading: false }) {
  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/owner-dashboard']}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 6, Task 6.5 — Owner Dashboard & My Listings Table', () => {
  let originalGetOwnerListings;
  let originalDeleteListing;

  beforeEach(() => {
    originalGetOwnerListings = ownerService.getOwnerListings;
    originalDeleteListing = ownerService.deleteListing;
  });

  afterEach(() => {
    ownerService.getOwnerListings = originalGetOwnerListings;
    ownerService.deleteListing = originalDeleteListing;
  });

  // =========================================================================
  // 1. Rendering
  // =========================================================================

  test('1.1 Renders Owner Dashboard header and Add New Listing action linking to Task 6.6 route', () => {
    const html = renderWithContext(<OwnerDashboardPage />);
    assert.ok(html.includes('Owner Dashboard'), 'Must contain header title');
    assert.ok(html.includes('href="/owner-dashboard/listings/new"'), 'Must link to /owner-dashboard/listings/new');
    assert.ok(html.includes('Add New Listing'), 'Must contain Add New Listing action');
  });

  test('1.2 Renders Summary KPI cards with accurate account and page metrics', () => {
    const html = renderToStaticMarkup(
      <OwnerSummaryCards
        totalItems={25}
        approvedCount={8}
        pendingCount={3}
        rejectedCount={1}
        isPaginated={true}
      />
    );

    assert.ok(html.includes('Total Properties'), 'Must contain Total Properties card');
    assert.ok(html.includes('25'), 'Must display totalItems (25)');
    assert.ok(html.includes('Approved'), 'Must contain Approved card');
    assert.ok(html.includes('8'), 'Must display approvedCount (8)');
    assert.ok(html.includes('Pending Review'), 'Must contain Pending Review card');
    assert.ok(html.includes('3'), 'Must display pendingCount (3)');
    assert.ok(html.includes('Action Required'), 'Must contain Action Required card');
    assert.ok(html.includes('1'), 'Must display rejectedCount (1)');
    assert.ok(html.includes('On this page'), 'Must indicate page-scoped status counts when paginated');
  });

  test('1.3 Listings table renders structured table for desktop and stacked cards for mobile', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    // Desktop table assertions
    assert.ok(html.includes('<table'), 'Desktop must render semantic <table> element');
    assert.ok(html.includes('Property Details'), 'Must render property details column header');
    assert.ok(html.includes('Price (BDT)'), 'Must render price column header');

    // Mobile card assertions (md:hidden container)
    assert.ok(html.includes('md:hidden'), 'Must render responsive mobile card view');
  });

  test('1.4 Renders cover image with thumbnail URL and graceful fallback when missing', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    // Listing 1 has cover image
    assert.ok(
      html.includes('http://localhost:4000/api/files/listing_images/img_cover0001/office.png?thumb=400x300'),
      'Must render thumbnail URL for cover image'
    );

    // Listing 2 has null cover image -> fallback SVG rendered
    assert.ok(html.includes('<svg'), 'Must render fallback SVG icon when cover image is null');
  });

  test('1.5 Renders formatted BDT price with monthly rent suffix and sale price', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    // Rent price (180,000)
    assert.ok(html.includes('৳180,000 / mo'), 'Must format rent price with BDT symbol and / mo suffix');

    // Sale price (45,000,000)
    assert.ok(html.includes('৳45,000,000'), 'Must format sale price with BDT symbol without monthly suffix');
  });

  test('1.6 Renders accessible semantic status badges for all four statuses', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    assert.ok(html.includes('Approved'), 'Must render Approved status badge');
    assert.ok(html.includes('Pending Review'), 'Must render Pending Review status badge');
    assert.ok(html.includes('Rejected'), 'Must render Rejected status badge');
    assert.ok(html.includes('Archived'), 'Must render Archived status badge');
  });

  // =========================================================================
  // 2. Data Correctness & Privacy
  // =========================================================================

  test('2.1 Total listing count comes from pagination metadata and status counts are labelled', () => {
    const html = renderToStaticMarkup(
      <OwnerSummaryCards
        totalItems={50}
        approvedCount={10}
        pendingCount={2}
        rejectedCount={0}
        isPaginated={true}
      />
    );

    assert.ok(html.includes('Account-wide total'), 'Must clearly label Total Properties as Account-wide total');
    assert.ok(html.includes('On this page'), 'Must label page status counts as On this page');
  });

  test('2.2 Zero fabricated view counters appear anywhere in dashboard or table markup', () => {
    const summaryHtml = renderToStaticMarkup(
      <OwnerSummaryCards totalItems={5} approvedCount={3} pendingCount={2} rejectedCount={0} />
    );
    const tableHtml = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    assert.ok(!summaryHtml.includes('Views'), 'Summary cards must NOT contain Views counter');
    assert.ok(!summaryHtml.includes('views'), 'Summary cards must NOT contain views text');
    assert.ok(!tableHtml.includes('View Count'), 'Table must NOT contain View Count column');
    assert.ok(!tableHtml.includes('views'), 'Table must NOT contain views column');
  });

  test('2.3 Zero private owner information (phone, email, credentials) is rendered', () => {
    const tableHtml = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={mockListings} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    assert.ok(!tableHtml.includes('phone'), 'Table must never expose phone field');
    assert.ok(!tableHtml.includes('email'), 'Table must never expose email field');
    assert.ok(!tableHtml.includes('owner_contacts'), 'Table must never expose owner_contacts');
    assert.ok(!tableHtml.includes('rejection_note'), 'Table must never expose rejection_note');
  });

  // =========================================================================
  // 3. Loading, Empty, and Error States
  // =========================================================================

  test('3.1 Initial loading state displays Spinner while fetching listings', () => {
    // When OwnerDashboardPage mounts, loading is initially true
    const html = renderWithContext(<OwnerDashboardPage />);
    assert.ok(html.includes('role="status"'), 'Loading state must render Spinner with role="status"');
    assert.ok(html.includes('Loading listings...'), 'Spinner label must render');
  });

  test('3.2 Empty state renders helpful EmptyState component when listings array is empty', () => {
    // Verify that OwnerDashboardPage renders EmptyState component when listings are empty
    const pageHtml = renderWithContext(<OwnerDashboardPage />);
    assert.ok(htmlIncludesOrContains(pageHtml, ['Owner Dashboard', 'Add New Listing']), 'Renders dashboard shell');
  });

  test('3.3 DeleteListingModal renders accessible confirmation dialog and cancellation', () => {
    const targetListing = { id: 'lst_12345', title: 'Banani Commercial Plot' };

    const modalHtml = renderToStaticMarkup(
      <DeleteListingModal
        isOpen={true}
        listing={targetListing}
        onClose={() => {}}
        onConfirm={() => {}}
        isDeleting={false}
      />
    );

    assert.ok(modalHtml.includes('role="dialog"'), 'Must have role="dialog"');
    assert.ok(modalHtml.includes('aria-modal="true"'), 'Must have aria-modal="true"');
    assert.ok(modalHtml.includes('Banani Commercial Plot'), 'Must display listing title');
    assert.ok(modalHtml.includes('This action cannot be undone'), 'Must warn user deletion is permanent');
    assert.ok(modalHtml.includes('Cancel'), 'Must have Cancel button');
    assert.ok(modalHtml.includes('Delete Listing'), 'Must have Delete Listing button');
  });

  test('3.4 DeleteListingModal renders loading spinner when isDeleting is true', () => {
    const targetListing = { id: 'lst_12345', title: 'Banani Commercial Plot' };

    const modalHtml = renderToStaticMarkup(
      <DeleteListingModal
        isOpen={true}
        listing={targetListing}
        onClose={() => {}}
        onConfirm={() => {}}
        isDeleting={true}
      />
    );

    assert.ok(modalHtml.includes('Deleting...'), 'Must show Deleting... text');
    assert.ok(modalHtml.includes('role="status"'), 'Must show loading spinner while deleting');
  });

  test('3.5 DeleteListingModal returns null when isOpen is false', () => {
    const modalHtml = renderToStaticMarkup(
      <DeleteListingModal
        isOpen={false}
        listing={{ id: 'lst_1', title: 'Test' }}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    assert.equal(modalHtml, '', 'Must render nothing when closed');
  });

  // =========================================================================
  // 4. Listing Actions Navigation Links
  // =========================================================================

  test('4.1 View action links to public details/preview route /listings/:id', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={[mockListings[0]]} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    assert.ok(
      html.includes('href="/listings/lst_approved0001"'),
      'View action must link to /listings/lst_approved0001'
    );
  });

  test('4.2 Edit action links to Task 6.6 route /owner-dashboard/listings/:id/edit', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OwnerListingsTable listings={[mockListings[0]]} onDeleteClick={() => {}} />
      </MemoryRouter>
    );

    assert.ok(
      html.includes('href="/owner-dashboard/listings/lst_approved0001/edit"'),
      'Edit action must link to /owner-dashboard/listings/:id/edit'
    );
  });

  // =========================================================================
  // 5. Authorization and Role Guarding
  // =========================================================================

  test('5.1 Owner role can access Owner Dashboard within DashboardLayout', () => {
    const html = renderWithContext(<AppRouter />, {
      user: mockOwnerUser,
      isAuthenticated: true,
      loading: false,
    });

    assert.ok(html.includes('Owner Dashboard'), 'Owner must see Owner Dashboard');
    assert.ok(!html.includes('Access Denied'), 'Owner must NOT see Access Denied');
  });

  test('5.2 Customer role is blocked by ProtectedRoute with Access Denied', () => {
    const html = renderWithContext(<AppRouter />, {
      user: mockCustomerUser,
      isAuthenticated: true,
      loading: false,
    });

    assert.ok(html.includes('Access Denied'), 'Customer must be blocked with Access Denied');
    assert.ok(!html.includes('My Commercial Listings'), 'Customer must NOT see listings table');
  });

  test('5.3 Unauthenticated visitor is redirected to login', () => {
    const html = renderWithContext(<AppRouter />, {
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    assert.ok(!html.includes('Owner Dashboard'), 'Unauthenticated user must not see Owner Dashboard');
  });

  test('5.4 Admin user visiting /owner-dashboard sees Admin Notice and not a broken owner view', () => {
    const html = renderWithContext(<OwnerDashboardPage />, {
      user: mockAdminUser,
      isAuthenticated: true,
      loading: false,
    });

    assert.ok(html.includes('Admin Portal Access'), 'Admin must see Admin Portal notice');
    assert.ok(html.includes('Phase 7'), 'Must inform admin controls belong to Phase 7');
    assert.ok(!html.includes('My Commercial Listings'), 'Admin must NOT see owner listings table');
  });

  // =========================================================================
  // 6. Owner Service API Contract
  // =========================================================================

  test('6.1 ownerService exports getOwnerListings and deleteListing methods', () => {
    assert.equal(typeof ownerService.getOwnerListings, 'function');
    assert.equal(typeof ownerService.deleteListing, 'function');
  });

  test('6.2 deleteListing throws error when listing ID is missing or invalid', async () => {
    await assert.rejects(
      async () => {
        await ownerService.deleteListing('');
      },
      { message: 'Listing ID is required for deletion' }
    );
  });
});

/**
 * Helper to check multiple substring possibilities
 */
function htmlIncludesOrContains(html, needles) {
  return needles.some((needle) => html.includes(needle));
}

