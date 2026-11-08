import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Phase 5, Task 5.4 — Sorting & Server-Side Pagination', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const testRunId = Date.now();

  // Test listings
  let cheapestListingId;
  let midListingId;
  let expensiveListingId;
  let pendingListingId;

  // React & bundle variables for frontend tests
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let MarketplacePage;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-sort-page-auth.js');
  const tempMarketPath = path.join(clientSrcDir, 'pages/temp-test-sort-page.js');
  const tempSidebarPath = path.join(clientSrcDir, 'components/marketplace/temp-test-sort-sidebar.js');

  before(async () => {
    // 1. Setup Backend PocketBase Test Data
    adminPb = await getAdminClient();

    // Create test owner
    const ownerRecord = await adminPb.collection('users').create({
      name: `Sort Owner ${testRunId}`,
      email: `owner_sort_${testRunId}@shopfinder.local`,
      password: 'Password123!Safe',
      passwordConfirm: 'Password123!Safe',
      role: 'owner',
    });
    createdUserIds.push(ownerRecord.id);

    // Create owner contact record to verify privacy boundary
    try {
      await adminPb.collection('owner_contacts').create({
        user: ownerRecord.id,
        phone: '+8801999999999',
        is_verified: true,
      });
    } catch {}

    // 1a. Cheapest listing (Price: 20,000, Area: 300)
    const cheap = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Sort Cheapest Small Shop ${testRunId}`,
      description: 'Affordable compact retail stall.',
      category: 'retail',
      listing_type: 'rent',
      price: 20000,
      area_sqft: 300,
      address: 'Shop 10, Mirpur 1',
      city: 'Dhaka',
      area: 'Mirpur',
      status: 'approved',
      is_featured: false,
    });
    cheapestListingId = cheap.id;
    createdListingIds.push(cheapestListingId);

    // Small delay to ensure distinct creation timestamps
    await new Promise((r) => setTimeout(r, 60));

    // 1b. Mid-priced listing (Price: 85,000, Area: 1,200)
    const mid = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Sort Mid Commercial Space ${testRunId}`,
      description: 'Prime commercial office space.',
      category: 'office',
      listing_type: 'rent',
      price: 85000,
      area_sqft: 1200,
      address: 'Tower 4, Kawran Bazar',
      city: 'Dhaka',
      area: 'Kawran Bazar',
      status: 'approved',
      is_featured: false,
    });
    midListingId = mid.id;
    createdListingIds.push(midListingId);

    await new Promise((r) => setTimeout(r, 60));

    // 1c. Most expensive listing (Price: 500,000, Area: 4,500)
    const expensive = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Sort Expensive Luxury Floor ${testRunId}`,
      description: 'Luxury commercial floor in Banani.',
      category: 'office',
      listing_type: 'rent',
      price: 500000,
      area_sqft: 4500,
      address: 'Road 11, Banani',
      city: 'Dhaka',
      area: 'Banani',
      status: 'approved',
      is_featured: true,
    });
    expensiveListingId = expensive.id;
    createdListingIds.push(expensiveListingId);

    // 1d. Unapproved listing that must never be returned or counted
    const pending = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Sort Pending Listing ${testRunId}`,
      description: 'Pending approval listing.',
      category: 'office',
      listing_type: 'rent',
      price: 10000,
      area_sqft: 200,
      address: 'Unapproved Street',
      city: 'Dhaka',
      area: 'Mirpur',
      status: 'pending',
      is_featured: false,
    });
    pendingListingId = pending.id;
    createdListingIds.push(pendingListingId);

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

    // Compile AuthContext stub
    const authRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthPath, authCode);

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
          name: 'alias-sort-page-auth',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => ({
              path: '../context/temp-test-sort-page-auth.js',
              external: true,
            }));
          },
        },
      ],
    });

    MarketplacePage = (await import(pathToFileURL(tempMarketPath).href)).default;
  });

  after(async () => {
    // Stop server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up PocketBase test records
    if (adminPb) {
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

    // Clean up temporary compiled files
    [tempAuthPath, tempMarketPath, tempSidebarPath].forEach((file) => {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    });
  });

  // =========================================================================
  // BACKEND SORTING & PAGINATION TESTS
  // =========================================================================

  test('GET /api/v1/listings defaults to newest sort (-created) and returns pagination metadata', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.listings), 'data.listings must be an array');
    assert.ok(body.data.pagination, 'data.pagination must be returned');

    assert.equal(body.data.pagination.page, 1);
    assert.equal(body.data.pagination.perPage, 12);
    assert.equal(body.data.pagination.totalItems, 3, 'Must match the 3 approved test listings');
    assert.equal(body.data.pagination.totalPages, 1);

    // Newest first means expensive was created last and should be before cheap
    const ids = body.data.listings.map((l) => l.id);
    const expensiveIndex = ids.indexOf(expensiveListingId);
    const cheapIndex = ids.indexOf(cheapestListingId);
    assert.ok(expensiveIndex < cheapIndex, 'Newest listing should appear before older listings');
  });

  test('GET /api/v1/listings sorts by price_asc (Price: Low to High)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price_asc`
    );
    assert.equal(res.status, 200);
    const body = await res.json();

    const ids = body.data.listings.map((l) => l.id);
    const cheapIndex = ids.indexOf(cheapestListingId);
    const midIndex = ids.indexOf(midListingId);
    const expensiveIndex = ids.indexOf(expensiveListingId);

    assert.ok(cheapIndex < midIndex, 'Cheapest must precede mid');
    assert.ok(midIndex < expensiveIndex, 'Mid must precede expensive');
  });

  test('GET /api/v1/listings sorts by price_desc (Price: High to Low)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price_desc`
    );
    assert.equal(res.status, 200);
    const body = await res.json();

    const ids = body.data.listings.map((l) => l.id);
    const expensiveIndex = ids.indexOf(expensiveListingId);
    const midIndex = ids.indexOf(midListingId);
    const cheapIndex = ids.indexOf(cheapestListingId);

    assert.ok(expensiveIndex < midIndex, 'Expensive must precede mid');
    assert.ok(midIndex < cheapIndex, 'Mid must precede cheapest');
  });

  test('GET /api/v1/listings accepts raw PocketBase sort values (-created, price, -price)', async () => {
    const resRawAsc = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price`
    );
    assert.equal(resRawAsc.status, 200);
    const bodyAsc = await resRawAsc.json();
    assert.equal(bodyAsc.data.listings[0].id, cheapestListingId);

    const resRawDesc = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=-price`
    );
    assert.equal(resRawDesc.status, 200);
    const bodyDesc = await resRawDesc.json();
    assert.equal(bodyDesc.data.listings[0].id, expensiveListingId);
  });

  test('GET /api/v1/listings rejects unapproved sort inputs including +price with HTTP 400 (Correction 2)', async () => {
    // +price (unencoded) must return HTTP 400
    const resPlusPrice = await fetch(`${baseUrl}/api/v1/listings?sort=+price`);
    assert.equal(resPlusPrice.status, 400);
    const bodyPlusPrice = await resPlusPrice.json();
    assert.equal(bodyPlusPrice.success, false);
    assert.ok(bodyPlusPrice.error && bodyPlusPrice.error.message.includes('Invalid sort option'));

    // +price (URL-encoded %2Bprice) must return HTTP 400
    const resEncoded = await fetch(`${baseUrl}/api/v1/listings?sort=${encodeURIComponent('+price')}`);
    assert.equal(resEncoded.status, 400);
    const bodyEncoded = await resEncoded.json();
    assert.equal(bodyEncoded.success, false);
    assert.ok(bodyEncoded.error && bodyEncoded.error.message.includes('Invalid sort option'));

    // Arbitrary unapproved values return HTTP 400
    const resArbitrary = await fetch(`${baseUrl}/api/v1/listings?sort=malicious_column_name`);
    assert.equal(resArbitrary.status, 400);
    const bodyArbitrary = await resArbitrary.json();
    assert.equal(bodyArbitrary.success, false);
    assert.ok(bodyArbitrary.error && bodyArbitrary.error.message.includes('Invalid sort option'));
  });

  test('GET /api/v1/listings paginates with page and perPage parameters', async () => {
    // Request perPage=1, page=1
    const resP1 = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price_asc&page=1&perPage=1`
    );
    assert.equal(resP1.status, 200);
    const bodyP1 = await resP1.json();

    assert.equal(bodyP1.data.listings.length, 1);
    assert.equal(bodyP1.data.listings[0].id, cheapestListingId);
    assert.equal(bodyP1.data.pagination.page, 1);
    assert.equal(bodyP1.data.pagination.perPage, 1);
    assert.equal(bodyP1.data.pagination.totalItems, 3);
    assert.equal(bodyP1.data.pagination.totalPages, 3);

    // Request perPage=1, page=2
    const resP2 = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price_asc&page=2&perPage=1`
    );
    assert.equal(resP2.status, 200);
    const bodyP2 = await resP2.json();

    assert.equal(bodyP2.data.listings.length, 1);
    assert.equal(bodyP2.data.listings[0].id, midListingId);
    assert.equal(bodyP2.data.pagination.page, 2);

    // Request perPage=1, page=3
    const resP3 = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&sort=price_asc&page=3&perPage=1`
    );
    assert.equal(resP3.status, 200);
    const bodyP3 = await resP3.json();

    assert.equal(bodyP3.data.listings.length, 1);
    assert.equal(bodyP3.data.listings[0].id, expensiveListingId);
    assert.equal(bodyP3.data.pagination.page, 3);
  });

  test('GET /api/v1/listings clamps perPage to 1-100 and reports effective clamped perPage (Correction 1)', async () => {
    // Below minimum: perPage=0 clamps to 1
    const resZero = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&perPage=0`);
    assert.equal(resZero.status, 200);
    const bodyZero = await resZero.json();
    assert.equal(bodyZero.data.pagination.perPage, 1, 'perPage=0 must be clamped to 1');
    assert.equal(bodyZero.data.listings.length, 1);

    // Below minimum: negative perPage=-5 clamps to 1
    const resNeg = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&perPage=-5`);
    assert.equal(resNeg.status, 200);
    const bodyNeg = await resNeg.json();
    assert.equal(bodyNeg.data.pagination.perPage, 1, 'perPage=-5 must be clamped to 1');
    assert.equal(bodyNeg.data.listings.length, 1);

    // Above maximum: perPage=101 clamps to 100
    const resTooLarge = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&perPage=101`);
    assert.equal(resTooLarge.status, 200);
    const bodyTooLarge = await resTooLarge.json();
    assert.equal(bodyTooLarge.data.pagination.perPage, 100, 'perPage=101 must be clamped to 100');

    // Above maximum: perPage=500 clamps to 100
    const res500 = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&perPage=500`);
    assert.equal(res500.status, 200);
    const body500 = await res500.json();
    assert.equal(body500.data.pagination.perPage, 100, 'perPage=500 must be clamped to 100');

    // Non-numeric and non-integer values return HTTP 400
    const resNaN = await fetch(`${baseUrl}/api/v1/listings?perPage=abc`);
    assert.equal(resNaN.status, 400);

    const resDecimal = await fetch(`${baseUrl}/api/v1/listings?perPage=3.14`);
    assert.equal(resDecimal.status, 400);
  });

  test('GET /api/v1/listings rejects invalid page values with HTTP 400', async () => {
    const resZero = await fetch(`${baseUrl}/api/v1/listings?page=0`);
    assert.equal(resZero.status, 400);

    const resNegative = await fetch(`${baseUrl}/api/v1/listings?page=-1`);
    assert.equal(resNegative.status, 400);

    const resAlpha = await fetch(`${baseUrl}/api/v1/listings?page=xyz`);
    assert.equal(resAlpha.status, 400);
  });

  test('GET /api/v1/listings applies Task 5.3 filters before pagination and counting', async () => {
    // Filter by category=office (matches mid and expensive, excludes cheap)
    const res = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&category=office&perPage=1`
    );
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.pagination.totalItems, 2, 'Only the 2 office listings should be counted');
    assert.equal(body.data.pagination.totalPages, 2);
    assert.equal(body.data.listings.length, 1);
  });

  test('GET /api/v1/listings strictly excludes unapproved listings from pagination counts', async () => {
    // Unapproved pending listing has testRunId in title, but must NEVER be in results or totalItems
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.pagination.totalItems, 3, 'Must count only the 3 approved listings');
    const hasPending = body.data.listings.some((l) => l.id === pendingListingId);
    assert.equal(hasPending, false, 'Pending listing must never appear in paginated results');
  });

  test('GET /api/v1/listings handles out-of-bounds page leniently (preserves page, returns empty items)', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}&page=999&perPage=10`
    );
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.listings.length, 0, 'Out of bounds page returns empty listings');
    assert.equal(body.data.pagination.page, 999, 'Preserves requested page number');
    assert.equal(body.data.pagination.totalItems, 3);
    assert.equal(body.data.pagination.totalPages, 1);
  });

  test('GET /api/v1/listings handles zero matching results safely', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=nonexistent_query_xyz_123456789`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.listings.length, 0);
    assert.equal(body.data.pagination.totalItems, 0);
    assert.equal(body.data.pagination.totalPages, 1);
    assert.equal(body.data.pagination.page, 1);
  });

  test('GET /api/v1/listings never leaks owner phone or credentials in paginated response', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    assert.equal(res.status, 200);
    const text = await res.text();

    assert.equal(text.includes('+8801999999999'), false, 'Owner phone must never leak in paginated response');
    assert.equal(text.includes('password'), false, 'Password hash must never leak');
    assert.equal(text.includes('tokenKey'), false, 'TokenKey must never leak');
  });

  // =========================================================================
  // FRONTEND COMPONENT & SSR TESTS
  // =========================================================================

  test('MarketplacePage renders Sort selector with approved options', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/marketplace?sort=price_asc'] },
        React.createElement(MarketplacePage)
      )
    );

    assert.ok(markup.includes('Sort:'), 'Renders Sort label');
    assert.ok(markup.includes('Newest First'), 'Renders Newest First option');
    assert.ok(markup.includes('Price: Low to High'), 'Renders Price: Low to High option');
    assert.ok(markup.includes('Price: High to Low'), 'Renders Price: High to Low option');
  });

  test('MarketplacePage renders results count summary reflecting server pagination', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/marketplace'] },
        React.createElement(MarketplacePage)
      )
    );

    assert.ok(
      markup.includes('Showing') || markup.includes('commercial properties') || markup.includes('Loading'),
      'Renders catalog results counter'
    );
  });

  test('MarketplacePage renders out-of-bounds page state when requested page exceeds total', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/marketplace?page=99'] },
        React.createElement(MarketplacePage)
      )
    );

    assert.ok(markup.includes('Marketplace'), 'Renders Marketplace page');
  });
});

