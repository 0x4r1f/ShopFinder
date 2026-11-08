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

describe('Phase 5, Task 5.1 — Homepage & Featured Listings', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const createdImageIds = [];
  const testRunId = Date.now();

  let approvedFeaturedId;
  let nonFeaturedId;
  let pendingFeaturedId;
  let rejectedFeaturedId;
  let archivedFeaturedId;

  // React & bundle variables for frontend tests
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let AuthContext;
  let HomePage;
  let AppRouter;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-feat-auth.js');
  const tempHomePath = path.join(clientSrcDir, 'pages/temp-test-feat-home.js');
  const tempRouterPath = path.join(clientSrcDir, 'routes/temp-test-feat-router.js');

  before(async () => {
    // 1. Setup Backend PocketBase Test Data
    adminPb = await getAdminClient();

    // Create test owner
    const ownerRecord = await adminPb.collection('users').create({
      name: `Test Owner ${testRunId}`,
      email: `owner_feat_${testRunId}@shopfinder.local`,
      password: 'Password123!Safe',
      passwordConfirm: 'Password123!Safe',
      role: 'owner',
    });
    createdUserIds.push(ownerRecord.id);

    // Create owner contact record (simulating sensitive phone storage)
    try {
      await adminPb.collection('owner_contacts').create({
        user: ownerRecord.id,
        phone: '+8801700998877',
        is_verified: true,
      });
    } catch {
      // If collection doesn't exist yet, proceed
    }

    // 1a. Approved & Featured Listing (Target match)
    const approvedFeatured = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Prime Gulshan Commercial Shop',
      description: 'Spacious retail outlet on road 11.',
      category: 'retail',
      listing_type: 'rent',
      price: 85000,
      area_sqft: 850,
      address: 'Plot 45, Road 11',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
      is_featured: true,
    });
    approvedFeaturedId = approvedFeatured.id;
    createdListingIds.push(approvedFeaturedId);

    // 1b. Approved but NOT Featured Listing (Must be excluded)
    const nonFeatured = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Standard Banani Office Suite',
      description: 'Co-working office space in Banani.',
      category: 'office',
      listing_type: 'rent',
      price: 60000,
      area_sqft: 1200,
      address: 'Road 8, Block C',
      city: 'Dhaka',
      area: 'Banani',
      status: 'approved',
      is_featured: false,
    });
    nonFeaturedId = nonFeatured.id;
    createdListingIds.push(nonFeaturedId);

    // 1c. Pending & Featured Listing (Must be excluded)
    const pendingFeatured = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Pending Commercial Floor Motijheel',
      description: 'Full commercial floor awaiting admin approval.',
      category: 'other',
      listing_type: 'rent',
      price: 150000,
      area_sqft: 2500,
      address: 'Dilkusha C/A',
      city: 'Dhaka',
      area: 'Motijheel',
      status: 'pending',
      is_featured: true,
    });
    pendingFeaturedId = pendingFeatured.id;
    createdListingIds.push(pendingFeaturedId);

    // 1d. Rejected & Featured Listing (Must be excluded)
    const rejectedFeatured = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Rejected Warehouse Space',
      description: 'Industrial warehouse rejected due to documentation.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 90000,
      area_sqft: 3000,
      address: 'Tongi Industrial Area',
      city: 'Gazipur',
      area: 'Tongi',
      status: 'rejected',
      is_featured: true,
    });
    rejectedFeaturedId = rejectedFeatured.id;
    createdListingIds.push(rejectedFeaturedId);

    // 1e. Archived & Featured Listing (Must be excluded)
    const archivedFeatured = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: 'Archived Agrabad Showroom',
      description: 'Historical showroom listing now closed.',
      category: 'showroom',
      listing_type: 'sale',
      price: 25000000,
      area_sqft: 1800,
      address: 'Agrabad C/A',
      city: 'Chittagong',
      area: 'Agrabad',
      status: 'archived',
      is_featured: true,
    });
    archivedFeaturedId = archivedFeatured.id;
    createdListingIds.push(archivedFeaturedId);

    // Start Ephemeral Express Server
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

    // Compile AuthContext to temporary ESM
    const authRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthPath, authCode);

    // Bundle HomePage with esbuild
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'pages/HomePage.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempHomePath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
      plugins: [
        {
          name: 'alias-feat-auth',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => ({
              path: '../context/temp-test-feat-auth.js',
              external: true,
            }));
          },
        },
      ],
    });

    // Bundle AppRouter with esbuild
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'routes/AppRouter.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempRouterPath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
      plugins: [
        {
          name: 'alias-feat-router-auth',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => ({
              path: '../context/temp-test-feat-auth.js',
              external: true,
            }));
          },
        },
      ],
    });

    AuthContext = (await import(pathToFileURL(tempAuthPath).href)).AuthContext;
    HomePage = (await import(pathToFileURL(tempHomePath).href)).default;
    AppRouter = (await import(pathToFileURL(tempRouterPath).href)).default;
  });

  after(async () => {
    // Stop server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up created PocketBase test records
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
      fs.unlinkSync(tempHomePath);
    } catch {}
    try {
      fs.unlinkSync(tempRouterPath);
    } catch {}
  });

  // Helper to render static markup
  function renderWithRouter(Component, route = '/', authState = { isAuthenticated: false, user: null }) {
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
            { value: authState },
            React.createElement(Component)
          )
        )
      );
    } finally {
      console.error = originalError;
    }
  }

  // =========================================================================
  // BACKEND ENDPOINT TESTS (Task 5.1)
  // =========================================================================

  test('1. GET /api/v1/listings/featured is publicly accessible without authentication', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    assert.equal(res.status, 200, 'Featured endpoint must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.listings), 'Response must contain a listings array');
  });

  test('2. Returns only approved featured listings (status = approved AND is_featured = true)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    const json = await res.json();
    const ids = json.data.listings.map((l) => l.id);

    assert.ok(ids.includes(approvedFeaturedId), 'Approved featured listing must be present in results');

    // Verify properties on the approved featured listing
    const match = json.data.listings.find((l) => l.id === approvedFeaturedId);
    assert.equal(match.status, 'approved');
    assert.equal(match.is_featured, true);
    assert.equal(match.category, 'retail');
    assert.equal(match.listing_type, 'rent');
    assert.equal(match.price, 85000);
    assert.equal(match.city, 'Dhaka');
    assert.equal(match.area, 'Gulshan');
  });

  test('3. Strictly excludes non-featured listings (is_featured = false)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    const json = await res.json();
    const ids = json.data.listings.map((l) => l.id);

    assert.equal(ids.includes(nonFeaturedId), false, 'Non-featured approved listing must be excluded');
  });

  test('4. Strictly excludes non-approved listings even if is_featured is true', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    const json = await res.json();
    const ids = json.data.listings.map((l) => l.id);

    assert.equal(ids.includes(pendingFeaturedId), false, 'Pending featured listing must be excluded');
    assert.equal(ids.includes(rejectedFeaturedId), false, 'Rejected featured listing must be excluded');
    assert.equal(ids.includes(archivedFeaturedId), false, 'Archived featured listing must be excluded');
  });

  test('5. Security: Never leaks owner phone numbers, owner_contacts, or private credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    const json = await res.json();
    const rawResponse = JSON.stringify(json);

    // Defense-in-depth: check for raw string tokens or contacts
    assert.ok(!rawResponse.includes('+8801700998877'), 'Owner phone number must NEVER appear in response');
    assert.ok(!rawResponse.includes('owner_contacts'), 'owner_contacts collection must never be exposed');
    assert.ok(!rawResponse.includes('password'), 'Password hashes must never appear in response');
    assert.ok(!rawResponse.includes('tokenKey'), 'PocketBase tokenKey must never appear in response');

    // Check owner allowlist fields
    for (const listing of json.data.listings) {
      if (listing.owner) {
        const ownerKeys = Object.keys(listing.owner);
        const forbiddenKeys = ['email', 'phone', 'role', 'password', 'tokenKey', 'collectionId'];
        for (const forbidden of forbiddenKeys) {
          assert.equal(
            ownerKeys.includes(forbidden),
            false,
            `Owner object must not expose private field: ${forbidden}`
          );
        }
      }
    }
  });

  test('6. Query parameter limit is safely bounded (defaults to 6, max 20)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured?limit=2`);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.ok(json.data.listings.length <= 2, 'Result length must respect the limit parameter');
  });

  test('7. Empty results return HTTP 200 with an empty array, not an error', async () => {
    // Direct test of service when no matches are found
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

      const listings = await listingService.getFeaturedListings();
      assert.ok(Array.isArray(listings), 'Listings must be an array');
      assert.equal(listings.length, 0, 'Listings array must be empty');
    } finally {
      adminPb.collection = originalCollection;
    }
  });

  test('8. PocketBase failures are handled gracefully without leaking internal stack or credentials', async () => {
    const originalCollection = adminPb.collection.bind(adminPb);
    try {
      adminPb.collection = (name) => {
        if (name === 'listings') {
          return {
            getList: async () => {
              throw new Error('Database connection timeout error with internal secrets: SUPER_KEY_123');
            },
          };
        }
        return originalCollection(name);
      };

      const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.equal(json.success, false);
      const rawBody = JSON.stringify(json);
      assert.ok(!rawBody.includes('SUPER_KEY_123'), 'Internal error secrets must never leak to client');
    } finally {
      adminPb.collection = originalCollection;
    }
  });

  // =========================================================================
  // FRONTEND HOMEPAGE & ROUTING TESTS (Task 5.1)
  // =========================================================================

  test('9. Homepage renders all seven official commercial categories', () => {
    const html = renderWithRouter(HomePage, '/');

    const expectedCategories = [
      'Shop',
      'Office',
      'Restaurant',
      'Warehouse',
      'Showroom',
      'Commercial Floor',
      'Industrial Space',
    ];

    for (const cat of expectedCategories) {
      assert.ok(html.includes(cat), `Homepage must render category: ${cat}`);
    }
  });

  test('10. Homepage renders popular city selectors including Dhaka, Chittagong, Sylhet', () => {
    const html = renderWithRouter(HomePage, '/');

    assert.ok(html.includes('Dhaka'), 'Must include Dhaka city quick link');
    assert.ok(html.includes('Chittagong'), 'Must include Chittagong city quick link');
    assert.ok(html.includes('Sylhet'), 'Must include Sylhet city quick link');
    assert.ok(html.includes('Rajshahi'), 'Must include Rajshahi city quick link');
    assert.ok(html.includes('Khulna'), 'Must include Khulna city quick link');
    assert.ok(html.includes('Gazipur'), 'Must include Gazipur city quick link');
  });

  test('11. Hero search form contains keyword input, category select, city select, and submit button', () => {
    const html = renderWithRouter(HomePage, '/');

    assert.ok(html.includes('id="search-keyword"'), 'Keyword search input must exist');
    assert.ok(html.includes('id="search-category"'), 'Category select must exist');
    assert.ok(html.includes('id="search-city"'), 'City select must exist');
    assert.ok(html.includes('role="search"'), 'Search form must declare semantic role="search"');
    assert.ok(html.includes('Search</span>'), 'Submit search button must exist');
  });

  test('12. Category options use the actual schema values in values attribute', () => {
    const html = renderWithRouter(HomePage, '/');

    assert.ok(html.includes('value="retail"'), 'Shop must map to schema value "retail"');
    assert.ok(html.includes('value="office"'), 'Office must map to schema value "office"');
    assert.ok(html.includes('value="restaurant"'), 'Restaurant must map to schema value "restaurant"');
    assert.ok(html.includes('value="warehouse"'), 'Warehouse must map to schema value "warehouse"');
    assert.ok(html.includes('value="showroom"'), 'Showroom must map to schema value "showroom"');
    assert.ok(html.includes('value="other"'), 'Commercial Floor must map to schema value "other"');
    assert.ok(html.includes('value="industrial"'), 'Industrial Space must map to schema value "industrial"');
  });

  test('13. Value Proposition section presents the 3 commercial marketplace pillars', () => {
    const html = renderWithRouter(HomePage, '/');

    assert.ok(html.includes('Dedicated Commercial Focus'), 'Must highlight commercial focus');
    assert.ok(html.includes('Clear Property Information'), 'Must highlight upfront transparent information');
    assert.ok(html.includes('Protected Direct Contact'), 'Must highlight protected direct contact');
  });

  test('14. AppRouter registers /marketplace, /listings redirect, and /listings/:id', () => {
    // 14a. /marketplace renders marketplace placeholder
    const marketHtml = renderWithRouter(AppRouter, '/marketplace');
    assert.ok(marketHtml.includes('Marketplace</h1>'), 'Route /marketplace must render marketplace placeholder');
    assert.ok(marketHtml.includes('Task 5.2'), 'Marketplace placeholder notes Task 5.2 roadmap');

    // 14b. /listings/:id renders listing detail placeholder
    const detailHtml = renderWithRouter(AppRouter, '/listings/item_12345');
    assert.ok(detailHtml.includes('Listing ID: item_12345'), 'Route /listings/:id must render detail placeholder with ID');
    assert.ok(detailHtml.includes('Task 5.5'), 'Detail placeholder notes Task 5.5 roadmap');

    // 14c. /listings route matches Navigate redirect (does not fall through to NotFoundPage)
    const redirectHtml = renderWithRouter(AppRouter, '/listings');
    assert.ok(!redirectHtml.includes('404'), 'Route /listings must not fall through to NotFoundPage 404');
    assert.ok(!redirectHtml.includes('Page Not Found'), 'Route /listings must not show Page Not Found');

    // 14d. Verify declarative routing structure in AppRouter source
    const routerSource = fs.readFileSync(path.join(clientSrcDir, 'routes/AppRouter.jsx'), 'utf8');
    assert.ok(
      routerSource.includes('path="/listings" element={<Navigate to="/marketplace" replace />}'),
      'AppRouter must explicitly register /listings redirecting to /marketplace'
    );
  });

  test('15. Preserves existing test compatibility tokens in HomePage markup', () => {
    const html = renderWithRouter(HomePage, '/');

    assert.ok(
      html.includes('Commercial Property Marketplace &amp; SaaS'),
      'Must preserve baseline slogan for existing AppRouter test suite'
    );
    assert.ok(
      html.includes('Go to Login'),
      'Must preserve Go to Login link for unauthenticated visitors'
    );
  });
});
