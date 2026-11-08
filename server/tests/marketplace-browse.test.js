import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import * as listingService from '../src/services/listing.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Phase 5, Task 5.2 — Marketplace Browse Page & Public Listings API', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const createdImageIds = [];
  const testRunId = Date.now();

  let approvedListing1Id;
  let approvedListing2Id;
  let pendingListingId;
  let rejectedListingId;
  let archivedListingId;

  // React & bundle variables for frontend tests
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let AuthContext;
  let MarketplacePage;
  let ListingCard;
  let FilterSidebar;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-market-auth.js');
  const tempMarketPath = path.join(clientSrcDir, 'pages/temp-test-market-page.js');
  const tempCardPath = path.join(clientSrcDir, 'components/marketplace/temp-test-listing-card.js');
  const tempSidebarPath = path.join(clientSrcDir, 'components/marketplace/temp-test-filter-sidebar.js');

  before(async () => {
    // 1. Setup Backend PocketBase Test Data
    adminPb = await getAdminClient();

    // Create test owner
    const ownerRecord = await adminPb.collection('users').create({
      name: `Browse Owner ${testRunId}`,
      email: `owner_browse_${testRunId}@shopfinder.local`,
      password: 'Password123!Safe',
      passwordConfirm: 'Password123!Safe',
      role: 'owner',
    });
    createdUserIds.push(ownerRecord.id);

    // Create owner contact record to verify privacy boundary
    try {
      await adminPb.collection('owner_contacts').create({
        user: ownerRecord.id,
        phone: '+8801911223344',
        is_verified: true,
      });
    } catch {
      // Ignore if collection not active
    }

    // 1a. Approved Listing 1 (Retail Shop)
    const approved1 = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Commercial Retail Shop Dhanmondi',
      description: 'Prime retail location on Satmasjid road.',
      category: 'retail',
      listing_type: 'rent',
      price: 65000,
      area_sqft: 750,
      address: 'House 12, Road 27, Satmasjid Road',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
      is_featured: false,
    });
    approvedListing1Id = approved1.id;
    createdListingIds.push(approvedListing1Id);

    // 1b. Approved Listing 2 (Office Space)
    const approved2 = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Corporate Office Floor Kawran Bazar',
      description: 'Fully furnished commercial office space.',
      category: 'office',
      listing_type: 'rent',
      price: 180000,
      area_sqft: 2200,
      address: 'BDBL Bhaban, Kazi Nazrul Islam Ave',
      city: 'Dhaka',
      area: 'Kawran Bazar',
      status: 'approved',
      is_featured: true,
    });
    approvedListing2Id = approved2.id;
    createdListingIds.push(approvedListing2Id);

    // 1c. Pending Listing (Excluded)
    const pending = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Pending Restaurant Space Uttara',
      description: 'Rooftop cafe space awaiting admin approval.',
      category: 'restaurant',
      listing_type: 'rent',
      price: 95000,
      area_sqft: 1400,
      address: 'Sector 3, Jashimuddin Ave',
      city: 'Dhaka',
      area: 'Uttara',
      status: 'pending',
      is_featured: false,
    });
    pendingListingId = pending.id;
    createdListingIds.push(pendingListingId);

    // 1d. Rejected Listing (Excluded)
    const rejected = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Rejected Warehouse Gazipur',
      description: 'Warehouse facility rejected during inspection.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 110000,
      area_sqft: 4500,
      address: 'Joydebpur Road',
      city: 'Gazipur',
      area: 'Joydebpur',
      status: 'rejected',
      is_featured: false,
    });
    rejectedListingId = rejected.id;
    createdListingIds.push(rejectedListingId);

    // 1e. Archived Listing (Excluded)
    const archived = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Archived Commercial Showroom',
      description: 'Showroom lease expired and archived.',
      category: 'showroom',
      listing_type: 'sale',
      price: 32000000,
      area_sqft: 2800,
      address: 'GEC Circle',
      city: 'Chittagong',
      area: 'GEC',
      status: 'archived',
      is_featured: false,
    });
    archivedListingId = archived.id;
    createdListingIds.push(archivedListingId);

    // Start Ephemeral Server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 2. Setup Frontend Test Bundles
    React = (await import('../../client/node_modules/react/index.js')).default;
    renderToStaticMarkup = (await import('../../client/node_modules/react-dom/server.node.js')).renderToStaticMarkup;
    MemoryRouter = (await import('../../client/node_modules/react-router-dom/dist/index.js')).MemoryRouter;
    esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // Compile AuthContext
    const authRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthPath, authCode);

    // Bundle ListingCard
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'components/marketplace/ListingCard.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempCardPath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
    });

    // Bundle FilterSidebar
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'components/marketplace/FilterSidebar.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempSidebarPath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
    });

    // Bundle MarketplacePage
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'pages/MarketplacePage.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempMarketPath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
      plugins: [
        {
          name: 'alias-market-auth',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => ({
              path: '../context/temp-test-market-auth.js',
              external: true,
            }));
          },
        },
      ],
    });

    AuthContext = (await import(pathToFileURL(tempAuthPath).href)).AuthContext;
    ListingCard = (await import(pathToFileURL(tempCardPath).href)).default;
    FilterSidebar = (await import(pathToFileURL(tempSidebarPath).href)).default;
    MarketplacePage = (await import(pathToFileURL(tempMarketPath).href)).default;
  });

  after(async () => {
    // Stop ephemeral server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up PocketBase test data
    if (adminPb) {
      for (const id of createdImageIds) {
        try {
          await adminPb.collection('listing_images').delete(id);
        } catch {}
      }
      for (const id of createdListingIds) {
        try {
          await adminPb.collection('listings').delete(id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {}
      }
    }

    // Clean up temporary bundle files
    try {
      fs.unlinkSync(tempAuthPath);
    } catch {}
    try {
      fs.unlinkSync(tempCardPath);
    } catch {}
    try {
      fs.unlinkSync(tempSidebarPath);
    } catch {}
    try {
      fs.unlinkSync(tempMarketPath);
    } catch {}
  });

  function renderWithRouter(Component, props = {}, route = '/marketplace') {
    const originalError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
        return;
      }
      originalError(...args);
    };

    try {
      return renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          React.createElement(
            AuthContext.Provider,
            { value: { isAuthenticated: false, user: null } },
            React.createElement(Component, props)
          )
        )
      );
    } finally {
      console.error = originalError;
    }
  }

  // =========================================================================
  // BACKEND TESTS: GET /api/v1/listings (Task 5.2)
  // =========================================================================

  test('1. GET /api/v1/listings is publicly accessible without authentication', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings`);
    assert.equal(res.status, 200, 'Public listings endpoint must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.listings), 'Response data must contain a listings array');
  });

  test('2. GET /api/v1/listings returns only approved listings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings`);
    const json = await res.json();
    const ids = json.data.listings.map((l) => l.id);

    // Both approved listings must be present
    assert.ok(ids.includes(approvedListing1Id), 'Approved listing 1 must be present');
    assert.ok(ids.includes(approvedListing2Id), 'Approved listing 2 must be present');

    // All returned listings must have status === 'approved'
    for (const listing of json.data.listings) {
      assert.equal(listing.status, 'approved', 'Every returned listing must have status approved');
    }
  });

  test('3. Strictly excludes pending, rejected, and archived listings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings`);
    const json = await res.json();
    const ids = json.data.listings.map((l) => l.id);

    assert.equal(ids.includes(pendingListingId), false, 'Pending listing must be excluded from public results');
    assert.equal(ids.includes(rejectedListingId), false, 'Rejected listing must be excluded from public results');
    assert.equal(ids.includes(archivedListingId), false, 'Archived listing must be excluded from public results');
  });

  test('4. Security: Never leaks owner phone numbers, owner_contacts, or sensitive credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings`);
    const json = await res.json();
    const rawResponse = JSON.stringify(json);

    assert.ok(!rawResponse.includes('+8801911223344'), 'Owner phone number must NEVER appear in public response');
    assert.ok(!rawResponse.includes('owner_contacts'), 'owner_contacts collection must never be exposed');
    assert.ok(!rawResponse.includes('password'), 'Password hashes must never appear in response');
    assert.ok(!rawResponse.includes('tokenKey'), 'PocketBase tokenKey must never appear in response');

    for (const listing of json.data.listings) {
      if (listing.owner) {
        const ownerKeys = Object.keys(listing.owner);
        const forbiddenKeys = ['email', 'phone', 'role', 'password', 'tokenKey'];
        for (const forbidden of forbiddenKeys) {
          assert.equal(
            ownerKeys.includes(forbidden),
            false,
            `Owner object must not expose sensitive field: ${forbidden}`
          );
        }
      }
    }
  });

  test('5. Serialization: Sanitized listings include expected public commercial attributes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings`);
    const json = await res.json();
    const match = json.data.listings.find((l) => l.id === approvedListing1Id);

    assert.ok(match, 'Approved listing 1 must be found');
    assert.equal(match.title, 'Commercial Retail Shop Dhanmondi');
    assert.equal(match.category, 'retail');
    assert.equal(match.listing_type, 'rent');
    assert.equal(match.price, 65000);
    assert.equal(match.area_sqft, 750);
    assert.equal(match.city, 'Dhaka');
    assert.equal(match.area, 'Dhanmondi');
    assert.equal(typeof match.is_featured, 'boolean');
  });

  test('6. Empty results return HTTP 200 with an empty array, not an error', async () => {
    const originalCollection = adminPb.collection.bind(adminPb);
    try {
      adminPb.collection = (name) => {
        if (name === 'listings') {
          return {
            getList: async () => ({ items: [] }),
          };
        }
        return originalCollection(name);
      };

      const listings = await listingService.getListings();
      assert.ok(Array.isArray(listings));
      assert.equal(listings.length, 0);
    } finally {
      adminPb.collection = originalCollection;
    }
  });

  test('7. Database failures are caught and masked safely without exposing credentials', async () => {
    const originalCollection = adminPb.collection.bind(adminPb);
    try {
      adminPb.collection = (name) => {
        if (name === 'listings') {
          return {
            getList: async () => {
              throw new Error('Database connection failed with sensitive DB_TOKEN_SECRET_XYZ');
            },
          };
        }
        return originalCollection(name);
      };

      const res = await fetch(`${baseUrl}/api/v1/listings`);
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.equal(json.success, false);
      const raw = JSON.stringify(json);
      assert.ok(!raw.includes('DB_TOKEN_SECRET_XYZ'), 'Internal database secrets must never leak to client');
    } finally {
      adminPb.collection = originalCollection;
    }
  });

  // =========================================================================
  // FRONTEND TESTS: ListingCard Component (Task 5.2)
  // =========================================================================

  test('8. ListingCard renders properly in grid view mode (default)', () => {
    const mockListing = {
      id: 'list_123',
      title: 'Modern Showroom Space',
      category: 'showroom',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 1500,
      address: 'Gulshan Avenue',
      city: 'Dhaka',
      area: 'Gulshan',
      is_featured: true,
      cover_image: null,
    };

    const html = renderWithRouter(ListingCard, { listing: mockListing, viewMode: 'grid' });

    assert.ok(html.includes('Modern Showroom Space'), 'Card must render title');
    assert.ok(html.includes('Showroom'), 'Card must render category label');
    assert.ok(html.includes('For Rent'), 'Card must render listing type badge');
    assert.ok(html.includes('৳1,20,000 / mo'), 'Card must format BDT price');
    assert.ok(html.includes('1,500'), 'Card must format area in sqft');
    assert.ok(html.includes('Gulshan Avenue, Gulshan, Dhaka'), 'Card must render formatted location');
    assert.ok(html.includes('href="/listings/list_123"'), 'Card must link to /listings/:id');
  });

  test('9. ListingCard renders properly in list view mode', () => {
    const mockListing = {
      id: 'list_456',
      title: 'Warehouse Logistics Hub',
      description: 'Massive warehouse with loading docks and high ceilings.',
      category: 'warehouse',
      listing_type: 'sale',
      price: 45000000,
      area_sqft: 8000,
      address: 'Tongi Industrial Area',
      city: 'Gazipur',
      area: 'Tongi',
      is_featured: false,
      cover_image: null,
    };

    const html = renderWithRouter(ListingCard, { listing: mockListing, viewMode: 'list' });

    assert.ok(html.includes('Warehouse Logistics Hub'), 'List view must render title');
    assert.ok(html.includes('Warehouse'), 'List view must render category');
    assert.ok(html.includes('For Sale'), 'List view must render For Sale badge');
    assert.ok(html.includes('৳4,50,00,000'), 'List view must format sale price without / mo');
    assert.ok(html.includes('Massive warehouse with loading docks'), 'List view must display description snippet');
    assert.ok(html.includes('View Details'), 'List view must render View Details action');
    assert.ok(html.includes('href="/listings/list_456"'), 'List view must link to /listings/:id');
  });

  test('10. ListingCard gracefully handles missing cover images without crashing', () => {
    const mockListing = {
      id: 'list_789',
      title: 'Shop Without Image',
      category: 'retail',
      listing_type: 'rent',
      price: 30000,
      area_sqft: null,
      address: 'Mirpur 10',
      city: 'Dhaka',
      area: 'Mirpur',
      cover_image: null,
    };

    const html = renderWithRouter(ListingCard, { listing: mockListing, viewMode: 'grid' });

    assert.ok(html.includes('Shop Without Image'), 'Must render card title');
    assert.ok(html.includes('Shop'), 'Must render category label in image fallback');
    assert.ok(html.includes('Area upon inquiry'), 'Must handle null area_sqft gracefully');
  });

  // =========================================================================
  // FRONTEND TESTS: FilterSidebar Component (Task 5.2)
  // =========================================================================

  test('11. FilterSidebar renders desktop persistent shell with Task 5.2 layout boundaries', () => {
    const html = renderWithRouter(FilterSidebar, { isOpen: false });

    assert.ok(html.includes('Filters'), 'Sidebar must render Filters header');
    assert.ok(html.includes('Task 5.2'), 'Sidebar must display Task 5.2 layout note');
    assert.ok(html.includes('id="filter-keyword-shell"'), 'Sidebar must render keyword input shell');
    assert.ok(html.includes('id="filter-category-shell"'), 'Sidebar must render category select shell');
    assert.ok(html.includes('Price Range'), 'Sidebar must render price range section');
    assert.ok(html.includes('disabled'), 'Future filter controls must be clearly disabled to prevent confusion');
  });

  test('12. FilterSidebar renders mobile modal drawer when isOpen is true', () => {
    const html = renderWithRouter(FilterSidebar, { isOpen: true });

    assert.ok(html.includes('role="dialog"'), 'Mobile drawer must declare role="dialog"');
    assert.ok(html.includes('aria-modal="true"'), 'Mobile drawer must declare aria-modal="true"');
    assert.ok(html.includes('aria-label="Close filters"'), 'Close button must have accessible aria-label');
  });

  // =========================================================================
  // FRONTEND TESTS: MarketplacePage (Task 5.2)
  // =========================================================================

  test('13. MarketplacePage renders header, breadcrumbs, view toggle, and filter shell', () => {
    const html = renderWithRouter(MarketplacePage);

    assert.ok(html.includes('Commercial Marketplace</h1>'), 'Must render Commercial Marketplace heading');
    assert.ok(html.includes('aria-label="Breadcrumb"'), 'Must render breadcrumb navigation');
    assert.ok(html.includes('aria-label="View layout toggle"'), 'Must render view layout toggle button group');
    assert.ok(html.includes('aria-label="Grid view"'), 'Must have Grid view button');
    assert.ok(html.includes('aria-label="List view"'), 'Must have List view button');
    assert.ok(html.includes('aria-label="Filter properties sidebar"'), 'Must render FilterSidebar desktop shell');
  });
});

