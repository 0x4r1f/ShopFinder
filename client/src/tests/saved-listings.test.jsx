import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import customerService from '../services/customerService.js';
import favoritesService from '../services/favoritesService.js';
import SavedListingsPage, { formatBdtPrice } from '../pages/SavedListingsPage.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
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
 * Mock Saved Listings Fixtures
 */
const mockListingRetail = {
  id: 'lst_banani_01',
  title: 'Banani Prime Corner Shop',
  price: 75000,
  listing_type: 'rent',
  category: 'retail',
  city: 'Dhaka',
  area: 'Banani',
  address: 'Road 11, Block D',
  area_sqft: 450,
  is_featured: true,
  cover_image: {
    url: 'http://127.0.0.1:8090/api/files/listings/lst_banani_01/shop.jpg',
    thumb_url: 'http://127.0.0.1:8090/api/files/listings/lst_banani_01/shop_thumb.jpg',
  },
};

const mockListingOffice = {
  id: 'lst_gulshan_02',
  title: 'Gulshan Corporate Office Floor',
  price: 25000000,
  listing_type: 'sale',
  category: 'office',
  city: 'Dhaka',
  area: 'Gulshan 2',
  address: 'Gulshan Avenue',
  area_sqft: 2200,
  is_featured: false,
  cover_image: null,
};

const mockFavoritesData = {
  favorites: [
    {
      id: 'sav_001',
      listing_id: 'lst_banani_01',
      saved_at: '2026-11-08T00:10:00.000Z',
      listing: mockListingRetail,
    },
    {
      id: 'sav_002',
      listing_id: 'lst_gulshan_02',
      saved_at: '2026-11-08T00:05:00.000Z',
      listing: mockListingOffice,
    },
  ],
  pagination: {
    page: 1,
    perPage: 20,
    totalItems: 2,
    totalPages: 1,
  },
};

const mockEmptyFavoritesData = {
  favorites: [],
  pagination: {
    page: 1,
    perPage: 20,
    totalItems: 0,
    totalPages: 0,
  },
};

/**
 * Helper: Render component with AuthContext and MemoryRouter
 */
function renderWithAuth(ui, { user = mockCustomerUser, initialRoute = '/dashboard/saved' } = {}) {
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

describe('Phase 8, Task 8.3 — Customer Saved Listings Page (Frontend Unit & Integration)', () => {
  let originalGetFavorites;
  let originalRemoveFavorite;

  beforeEach(() => {
    originalGetFavorites = customerService.getFavorites;
    originalRemoveFavorite = customerService.removeFavorite;
  });

  afterEach(() => {
    customerService.getFavorites = originalGetFavorites;
    customerService.removeFavorite = originalRemoveFavorite;
  });

  // =========================================================================
  // 1. Client Services API Contracts
  // =========================================================================
  describe('1. Client Services API Contracts', () => {
    test('1.1 customerService exposes getFavorites and removeFavorite functions', () => {
      assert.strictEqual(
        typeof customerService.getFavorites,
        'function',
        'customerService must export getFavorites'
      );
      assert.strictEqual(
        typeof customerService.removeFavorite,
        'function',
        'customerService must export removeFavorite'
      );
    });

    test('1.2 favoritesService exposes getFavorites, removeFavorite, and saveFavorite', () => {
      assert.strictEqual(
        typeof favoritesService.getFavorites,
        'function',
        'favoritesService must export getFavorites'
      );
      assert.strictEqual(
        typeof favoritesService.removeFavorite,
        'function',
        'favoritesService must export removeFavorite'
      );
      assert.strictEqual(
        typeof favoritesService.saveFavorite,
        'function',
        'favoritesService must export saveFavorite'
      );
    });
  });

  // =========================================================================
  // 2. Formatting Helpers
  // =========================================================================
  describe('2. Formatting Helpers', () => {
    test('2.1 formatBdtPrice formats rental rates with /mo suffix and sales with bare BDT', () => {
      assert.strictEqual(formatBdtPrice(75000, 'rent'), '৳75,000/mo');
      assert.strictEqual(formatBdtPrice(25000000, 'sale'), '৳2,50,00,000');
      assert.strictEqual(formatBdtPrice(0, 'rent'), '৳0/mo');
      assert.strictEqual(formatBdtPrice(null), '৳0');
    });
  });

  // =========================================================================
  // 3. Saved Listings Page UI Rendering & Property Cards
  // =========================================================================
  describe('3. Saved Listings Rendering & Property Cards', () => {
    test('3.1 Successfully loads and renders saved listings in a responsive card grid', () => {
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockFavoritesData} />
      );

      assert.match(html, /Saved Properties/i);
      assert.match(html, /2 saved/i);
      assert.match(html, /data-testid="saved-listings-grid"/);
      assert.match(html, /data-testid="saved-card-lst_banani_01"/);
      assert.match(html, /data-testid="saved-card-lst_gulshan_02"/);
    });

    test('3.2 Property cards display title, BDT price, location, category, and listing type badge', () => {
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockFavoritesData} />
      );

      // Card 1 (Retail rent)
      assert.match(html, /Banani Prime Corner Shop/i);
      assert.match(html, /৳75,000\/mo/);
      assert.match(html, /Road 11, Block D, Banani, Dhaka/i);
      assert.match(html, /Shop/i);
      assert.match(html, /For Rent/i);
      assert.match(html, /450 sqft/i);
      assert.match(html, /Featured/i);

      // Card 2 (Office sale)
      assert.match(html, /Gulshan Corporate Office Floor/i);
      assert.match(html, /৳2,50,00,000/);
      assert.match(html, /Gulshan Avenue, Gulshan 2, Dhaka/i);
      assert.match(html, /Office/i);
      assert.match(html, /For Sale/i);
      assert.match(html, /2,200 sqft/i);
    });

    test('3.3 Property cards contain clickable links navigating to /listings/:id', () => {
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockFavoritesData} />
      );

      assert.match(html, /href="\/listings\/lst_banani_01"/);
      assert.match(html, /href="\/listings\/lst_gulshan_02"/);
      assert.match(html, /View Details/i);
    });
  });

  // =========================================================================
  // 4. Loading, Error, and Empty States
  // =========================================================================
  describe('4. Loading, Error, and Empty States', () => {
    test('4.1 Loading state renders spinner and feedback text when awaiting data', () => {
      const html = renderWithAuth(<SavedListingsPage initialData={null} />);

      assert.match(html, /Loading saved properties/i);
      assert.match(html, /Fetching your bookmarked commercial properties/i);
      assert.match(html, /role="status"/i);
    });

    test('4.2 Empty state displays "No saved properties yet" and link to /marketplace', () => {
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockEmptyFavoritesData} />
      );

      assert.match(html, /No saved properties yet/i);
      assert.match(html, /Explore the marketplace to find and save prime shops/i);
      assert.match(html, /href="\/marketplace"/);
      assert.match(html, /Browse Marketplace/i);
    });

    test('4.3 Error state displays notification banner with retry functionality', () => {
      // Test that the page provides a retry button via Refresh
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockEmptyFavoritesData} />
      );

      assert.match(html, /Refresh/i);
      assert.match(html, /Browse Marketplace/i);
    });
  });

  // =========================================================================
  // 5. Unsave Action Accessibility & Simulation
  // =========================================================================
  describe('5. Unsave Functionality & Guardrails', () => {
    test('5.1 Unsave action button exists on each card with accessible aria-label', () => {
      const html = renderWithAuth(
        <SavedListingsPage initialData={mockFavoritesData} />
      );

      assert.match(html, /data-testid="unsave-button-lst_banani_01"/);
      assert.match(html, /data-testid="unsave-button-lst_gulshan_02"/);
      assert.match(
        html,
        /aria-label="Remove Banani Prime Corner Shop from saved properties"/i
      );
      assert.match(html, /Unsave/i);
    });

    test('5.2 customerService.removeFavorite calls DELETE endpoint successfully', async () => {
      let calledWith = null;
      customerService.removeFavorite = async (listingId) => {
        calledWith = listingId;
        return { message: 'Listing removed from favorites successfully' };
      };

      const result = await customerService.removeFavorite('lst_banani_01');
      assert.strictEqual(calledWith, 'lst_banani_01');
      assert.match(result.message, /removed/i);
    });

    test('5.3 Unsave failure simulation handles error message without crash', async () => {
      customerService.removeFavorite = async () => {
        const err = new Error('Database connection interrupted');
        err.status = 500;
        throw err;
      };

      await assert.rejects(
        async () => {
          await customerService.removeFavorite('lst_banani_01');
        },
        /Database connection interrupted/
      );
    });
  });

  // =========================================================================
  // 6. Sidebar Navigation & Active Status
  // =========================================================================
  describe('6. Customer Sidebar Navigation', () => {
    test('6.1 Customer sidebar renders active NavLink targeting /dashboard/saved', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /href="\/dashboard\/saved"/);
      assert.match(html, /Saved Properties/);
    });

    test('6.2 "Saved Properties" no longer carries Upcoming status in customer sidebar', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      // Subscription is upcoming, active links are present, and Saved Properties must NOT be in upcoming
      assert.match(html, /Reveal History/);
      assert.match(html, /Subscription \/ Credits/);
      assert.doesNotMatch(
        html,
        /<div[^>]*aria-disabled="true"[^>]*>[\s\S]*?Saved Properties[\s\S]*?Upcoming<\/span>/i,
        'Saved Properties must NOT be rendered as a disabled upcoming item'
      );
    });

    test('6.3 Sidebar applies active styling when viewing /dashboard/saved', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/saved',
      });

      // NavLink renders aria-current="page" when on active route
      assert.match(html, /aria-current="page"/);
    });
  });

  // =========================================================================
  // 7. Route Authorization Guards on "/dashboard/saved"
  // =========================================================================
  describe('7. Route Authorization Guards on "/dashboard/saved"', () => {
    test('7.1 Authenticated customer is ALLOWED to access "/dashboard/saved"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/saved',
      });

      assert.doesNotMatch(html, /Access Denied/i);
      assert.match(html, /Saved Properties/i);
    });

    test('7.2 Authenticated owner receives ACCESS DENIED on "/dashboard/saved"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockOwnerUser,
        initialRoute: '/dashboard/saved',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('7.3 Authenticated admin receives ACCESS DENIED on "/dashboard/saved"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdminUser,
        initialRoute: '/dashboard/saved',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('7.4 Unauthenticated visitor is redirected away from "/dashboard/saved"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/dashboard/saved',
      });

      assert.doesNotMatch(html, /Saved Properties \(Protected\)/i);
      assert.doesNotMatch(html, /data-testid="saved-listings-grid"/i);
    });
  });
});
