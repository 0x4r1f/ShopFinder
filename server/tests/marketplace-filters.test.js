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

describe('Phase 5, Task 5.3 — Multi-Parameter Search & Filtering', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const testRunId = Date.now();

  let retailShopId;
  let corporateOfficeId;
  let chittagongWarehouseId;
  let pendingListingId;

  // React & bundle variables for frontend tests
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let MarketplacePage;
  let FilterSidebar;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-filters-auth.js');
  const tempMarketPath = path.join(clientSrcDir, 'pages/temp-test-filters-page.js');
  const tempSidebarPath = path.join(clientSrcDir, 'components/marketplace/temp-test-filters-sidebar.js');

  before(async () => {
    // 1. Setup Backend PocketBase Test Data
    adminPb = await getAdminClient();

    // Create test owner
    const ownerRecord = await adminPb.collection('users').create({
      name: `Filters Owner ${testRunId}`,
      email: `owner_filters_${testRunId}@shopfinder.local`,
      password: 'Password123!Safe',
      passwordConfirm: 'Password123!Safe',
      role: 'owner',
    });
    createdUserIds.push(ownerRecord.id);

    // 1a. Retail Shop in Dhaka (Price: 50,000, Area: 600 sq ft)
    const retailRecord = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Boutique Fashion Retail Shop ${testRunId}`,
      description: 'Modern glass front retail store on Satmasjid Road.',
      category: 'retail',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 600,
      address: 'Plot 10, Satmasjid Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
      is_featured: true,
    });
    retailShopId = retailRecord.id;
    createdListingIds.push(retailShopId);

    // 1b. Corporate Office in Dhaka (Price: 150,000, Area: 2,500 sq ft)
    const officeRecord = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Executive Corporate Office Floor ${testRunId}`,
      description: 'Panoramic views and fully fitted commercial floor.',
      category: 'office',
      listing_type: 'rent',
      price: 150000,
      area_sqft: 2500,
      address: 'Level 8, Crystal Palace, Gulshan 2',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
      is_featured: false,
    });
    corporateOfficeId = officeRecord.id;
    createdListingIds.push(corporateOfficeId);

    // 1c. Industrial Warehouse in Chittagong (Price: 25,000,000 sale, Area: 10,000 sq ft)
    const warehouseRecord = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Heavy Industrial Logistics Warehouse ${testRunId}`,
      description: 'Massive warehouse with direct highway and port access.',
      category: 'warehouse',
      listing_type: 'sale',
      price: 25000000,
      area_sqft: 10000,
      address: 'Port Connecting Road, Halishahar',
      city: 'Chittagong',
      area: 'Halishahar',
      status: 'approved',
      is_featured: false,
    });
    chittagongWarehouseId = warehouseRecord.id;
    createdListingIds.push(chittagongWarehouseId);

    // 1d. Pending listing matching keywords to ensure unapproved listings are NEVER returned
    const pendingRecord = await adminPb.collection('listings').create({
      owner: ownerRecord.id,
      title: `Pending Boutique Fashion Outlet ${testRunId}`,
      description: 'Awaiting admin approval on Satmasjid Road.',
      category: 'retail',
      listing_type: 'rent',
      price: 45000,
      area_sqft: 500,
      address: 'Satmasjid Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'pending',
      is_featured: false,
    });
    pendingListingId = pendingRecord.id;
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
          name: 'alias-market-auth',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => ({
              path: '../context/temp-test-filters-auth.js',
              external: true,
            }));
          },
        },
      ],
    });

    FilterSidebar = (await import(pathToFileURL(tempSidebarPath).href)).default;
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
  // BACKEND FILTERING TESTS
  // =========================================================================

  test('GET /api/v1/listings filters by category enum', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?category=retail`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data && Array.isArray(body.data.listings));

    const retailFound = body.data.listings.some((l) => l.id === retailShopId);
    const officeFound = body.data.listings.some((l) => l.id === corporateOfficeId);
    assert.equal(retailFound, true, 'Retail listing should be returned');
    assert.equal(officeFound, false, 'Office listing should be excluded');
  });

  test('GET /api/v1/listings normalizes human-readable category labels (Decision 2)', async () => {
    // "Shop" should normalize to "retail"
    const resShop = await fetch(`${baseUrl}/api/v1/listings?category=Shop`);
    assert.equal(resShop.status, 200);
    const bodyShop = await resShop.json();
    const retailFound = bodyShop.data.listings.some((l) => l.id === retailShopId);
    assert.equal(retailFound, true, '"Shop" category should map to retail listing');

    // "Warehouse" should normalize to "warehouse"
    const resWh = await fetch(`${baseUrl}/api/v1/listings?category=Warehouse`);
    assert.equal(resWh.status, 200);
    const bodyWh = await resWh.json();
    const whFound = bodyWh.data.listings.some((l) => l.id === chittagongWarehouseId);
    assert.equal(whFound, true, '"Warehouse" category should map to warehouse listing');
  });

  test('GET /api/v1/listings rejects invalid category with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?category=invalid_category_xyz`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error && body.error.message.includes('Invalid category'));
  });

  test('GET /api/v1/listings filters by listing_type (rent vs sale)', async () => {
    const resRent = await fetch(`${baseUrl}/api/v1/listings?listing_type=rent`);
    assert.equal(resRent.status, 200);
    const bodyRent = await resRent.json();
    const hasRetailRent = bodyRent.data.listings.some((l) => l.id === retailShopId);
    const hasWhSale = bodyRent.data.listings.some((l) => l.id === chittagongWarehouseId);
    assert.equal(hasRetailRent, true, 'Rent query should include retail rent');
    assert.equal(hasWhSale, false, 'Rent query should exclude warehouse sale');

    const resSale = await fetch(`${baseUrl}/api/v1/listings?listing_type=sale`);
    assert.equal(resSale.status, 200);
    const bodySale = await resSale.json();
    const hasWhInSale = bodySale.data.listings.some((l) => l.id === chittagongWarehouseId);
    assert.equal(hasWhInSale, true, 'Sale query should include warehouse sale');
  });

  test('GET /api/v1/listings rejects invalid listing_type with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?listing_type=lease_to_own`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error && body.error.message.includes('Invalid listing_type'));
  });

  test('GET /api/v1/listings filters by min_price and max_price range', async () => {
    // Price between 40,000 and 70,000 (matches retail at 50,000, excludes office at 150,000)
    const res = await fetch(`${baseUrl}/api/v1/listings?min_price=40000&max_price=70000`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const retailFound = body.data.listings.some((l) => l.id === retailShopId);
    const officeFound = body.data.listings.some((l) => l.id === corporateOfficeId);
    assert.equal(retailFound, true, 'Retail at 50,000 should be included');
    assert.equal(officeFound, false, 'Office at 150,000 should be excluded');
  });

  test('GET /api/v1/listings rejects inverted price range (min_price > max_price) with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?min_price=100000&max_price=50000`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error && body.error.message.includes('cannot exceed max_price'));
  });

  test('GET /api/v1/listings rejects malformed numeric filter with HTTP 400', async () => {
    const resAlpha = await fetch(`${baseUrl}/api/v1/listings?min_price=abc`);
    assert.equal(resAlpha.status, 400);

    const resNeg = await fetch(`${baseUrl}/api/v1/listings?max_price=-500`);
    assert.equal(resNeg.status, 400);
  });

  test('GET /api/v1/listings filters by min_area and max_area range', async () => {
    // Area between 500 and 1000 sq ft (matches retail at 600, excludes office at 2500)
    const res = await fetch(`${baseUrl}/api/v1/listings?min_area=500&max_area=1000`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const retailFound = body.data.listings.some((l) => l.id === retailShopId);
    const officeFound = body.data.listings.some((l) => l.id === corporateOfficeId);
    assert.equal(retailFound, true, 'Retail at 600 sq ft should be included');
    assert.equal(officeFound, false, 'Office at 2500 sq ft should be excluded');
  });

  test('GET /api/v1/listings rejects inverted area range (min_area > max_area) with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?min_area=2000&max_area=1000`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error && body.error.message.includes('cannot exceed max_area'));
  });

  test('GET /api/v1/listings filters by city and area', async () => {
    const resCity = await fetch(`${baseUrl}/api/v1/listings?city=Chittagong`);
    assert.equal(resCity.status, 200);
    const bodyCity = await resCity.json();
    const whFound = bodyCity.data.listings.some((l) => l.id === chittagongWarehouseId);
    const dhakaFound = bodyCity.data.listings.some((l) => l.id === retailShopId);
    assert.equal(whFound, true, 'Chittagong listing should be returned');
    assert.equal(dhakaFound, false, 'Dhaka listing should be excluded');

    const resArea = await fetch(`${baseUrl}/api/v1/listings?area=Gulshan`);
    assert.equal(resArea.status, 200);
    const bodyArea = await resArea.json();
    const officeFound = bodyArea.data.listings.some((l) => l.id === corporateOfficeId);
    assert.equal(officeFound, true, 'Gulshan listing should be returned');
  });

  test('GET /api/v1/listings searches by keyword across title, description, and address', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=Satmasjid`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const retailFound = body.data.listings.some((l) => l.id === retailShopId);
    assert.equal(retailFound, true, 'Satmasjid search should match retail shop');
  });

  test('GET /api/v1/listings handles special characters safely without crashing or SQL injection', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent('test"\'\\();--')}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data && Array.isArray(body.data.listings));
  });

  test('GET /api/v1/listings strictly excludes unapproved listings regardless of search filters', async () => {
    // Search "Satmasjid" matches both approved retailShop and pendingListing
    const res = await fetch(`${baseUrl}/api/v1/listings?search=Satmasjid`);
    assert.equal(res.status, 200);
    const body = await res.json();

    const pendingFound = body.data.listings.some((l) => l.id === pendingListingId);
    assert.equal(pendingFound, false, 'Pending listings must never be returned in marketplace results');
  });

  test('GET /api/v1/listings combines multiple filters correctly', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/listings?category=office&city=Dhaka&min_price=100000&max_price=200000`
    );
    assert.equal(res.status, 200);
    const body = await res.json();

    const officeFound = body.data.listings.some((l) => l.id === corporateOfficeId);
    const retailFound = body.data.listings.some((l) => l.id === retailShopId);
    assert.equal(officeFound, true, 'Office matches all combined filters');
    assert.equal(retailFound, false, 'Retail does not match category or price');
  });

  // =========================================================================
  // FRONTEND COMPONENT & SSR TESTS
  // =========================================================================

  test('MarketplacePage renders active filter chips from URL search parameters', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/marketplace?category=office&city=Dhaka&min_price=50000'] },
        React.createElement(MarketplacePage)
      )
    );

    assert.ok(markup.includes('Active Filters:'), 'Should render Active Filters bar');
    assert.ok(markup.includes('Category: Office'), 'Should render Office category chip');
    assert.ok(markup.includes('City: Dhaka'), 'Should render Dhaka city chip');
    assert.ok(markup.includes('Min Price: ৳50,000'), 'Should render Min Price chip');
    assert.ok(markup.includes('Clear all'), 'Should render Clear all button');
  });

  test('MarketplacePage normalizes human-readable category labels in URL parameters', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/marketplace?category=Shop'] },
        React.createElement(MarketplacePage)
      )
    );

    assert.ok(markup.includes('Active Filters:'), 'Should render Active Filters bar');
    assert.ok(
      markup.includes('Category: Shop (Retail)'),
      'Should normalize "Shop" to "retail" and display "Shop (Retail)" label'
    );
  });

  test('FilterSidebar renders all controlled input fields and action buttons', () => {
    const markup = renderToStaticMarkup(
      React.createElement(FilterSidebar, {
        filters: {
          search: 'Apex Plaza',
          category: 'retail',
          listing_type: 'rent',
          min_price: '20000',
          max_price: '80000',
          city: 'Dhaka',
        },
      })
    );

    assert.ok(markup.includes('Search Keyword'), 'Renders keyword search field');
    assert.ok(markup.includes('Property Category'), 'Renders category selector');
    assert.ok(markup.includes('Listing Type'), 'Renders listing type toggle');
    assert.ok(markup.includes('Price Range (BDT)'), 'Renders price range inputs');
    assert.ok(markup.includes('Floor Area (sqft)'), 'Renders area range inputs');
    assert.ok(markup.includes('City'), 'Renders city selector');
    assert.ok(markup.includes('Area / Locality'), 'Renders neighborhood input');
    assert.ok(markup.includes('Apply Filters'), 'Renders Apply Filters button');
    assert.ok(markup.includes('Clear All Filters'), 'Renders Clear All Filters button');
  });
});
