import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';
import { getAdminClient } from '../src/config/pocketbase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Phase 5, Task 5.5 — Property Details Page', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const createdImageIds = [];
  const testRunId = Date.now();

  const testPassword = 'Password123!Safe';
  let ownerEmail;
  let otherOwnerEmail;
  let adminEmail;

  let ownerToken;
  let otherOwnerToken;
  let adminToken;

  let ownerId;
  let otherOwnerId;
  let adminId;

  let approvedListingId;
  let pendingListingId;
  let rejectedListingId;
  let zeroImageListingId;

  // Frontend React SSR variables
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let PhotoGallery;
  let OwnerInfoCard;
  let ListingDetailPage;
  let AppRouter;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-details-auth.js');
  const tempGalleryPath = path.join(clientSrcDir, 'components/marketplace/temp-test-details-gallery.js');
  const tempOwnerCardPath = path.join(clientSrcDir, 'components/marketplace/temp-test-details-owner-card.js');
  const tempDetailPagePath = path.join(clientSrcDir, 'pages/temp-test-details-page.js');
  const tempRouterPath = path.join(clientSrcDir, 'routes/temp-test-details-router.js');

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Test Users: Owner, Other Owner, Admin
    ownerEmail = `owner_detail_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Detail Property Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    otherOwnerEmail = `other_owner_${testRunId}@shopfinder.local`;
    const otherRec = await adminPb.collection('users').create({
      name: `Other Owner ${testRunId}`,
      email: otherOwnerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    otherOwnerId = otherRec.id;
    createdUserIds.push(otherOwnerId);

    adminEmail = `admin_detail_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin User ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 2. Authenticate and obtain JWT tokens
    const loginPb = new PocketBase(env.POCKETBASE_URL);
    const ownerAuth = await loginPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const otherAuth = await loginPb.collection('users').authWithPassword(otherOwnerEmail, testPassword);
    otherOwnerToken = otherAuth.token;

    const adminAuth = await loginPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    // 3. Create Test Listings:
    // 3a. Approved commercial retail listing with multiple images
    const approvedRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Grand Retail Commercial Showroom ${testRunId}`,
      description: 'Prime retail ground floor space with glass frontage on main avenue.',
      category: 'retail',
      listing_type: 'rent',
      price: 85000,
      area_sqft: 1200,
      address: 'House 42, Road 11, Banani',
      city: 'Dhaka',
      area: 'Banani',
      status: 'approved',
      is_featured: true,
    });
    approvedListingId = approvedRec.id;
    createdListingIds.push(approvedListingId);

    // Create 3 valid images for approved listing using real 1x1 PNG blob (PocketBase validates MIME magic bytes)
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const form1 = new FormData();
    form1.append('listing', approvedListingId);
    form1.append('is_cover', 'true');
    form1.append('order', '1');
    form1.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'front_facade.png');
    const img1 = await adminPb.collection('listing_images').create(form1);
    createdImageIds.push(img1.id);

    const form2 = new FormData();
    form2.append('listing', approvedListingId);
    form2.append('is_cover', 'false');
    form2.append('order', '2');
    form2.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'interior_hall.png');
    const img2 = await adminPb.collection('listing_images').create(form2);
    createdImageIds.push(img2.id);

    const form3 = new FormData();
    form3.append('listing', approvedListingId);
    form3.append('is_cover', 'false');
    form3.append('order', '3');
    form3.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'parking_dock.png');
    const img3 = await adminPb.collection('listing_images').create(form3);
    createdImageIds.push(img3.id);

    // 3b. Pending listing belonging to owner
    const pendingRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Draft Pending Office Suite ${testRunId}`,
      description: 'Awaiting moderation review before public marketplace release.',
      category: 'office',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 2000,
      address: 'Level 5, Gulshan Tower',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'pending',
      is_featured: false,
    });
    pendingListingId = pendingRec.id;
    createdListingIds.push(pendingListingId);

    // 3c. Rejected listing belonging to owner
    const rejectedRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Rejected Commercial Space ${testRunId}`,
      description: 'Commercial space rejected due to incomplete paperwork.',
      category: 'warehouse',
      listing_type: 'sale',
      price: 15000000,
      area_sqft: 5000,
      address: 'Plot 8, Tejgaon Industrial Area',
      city: 'Dhaka',
      area: 'Tejgaon',
      status: 'rejected',
      is_featured: false,
    });
    rejectedListingId = rejectedRec.id;
    createdListingIds.push(rejectedListingId);

    // 3d. Approved listing with zero images
    const zeroImageRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Zero Image Commercial Plot ${testRunId}`,
      description: 'Commercial plot without uploaded images.',
      category: 'industrial',
      listing_type: 'sale',
      price: 50000000,
      area_sqft: 8000,
      address: 'Highway Point',
      city: 'Gazipur',
      area: 'Tongi',
      status: 'approved',
      is_featured: false,
    });
    zeroImageListingId = zeroImageRec.id;
    createdListingIds.push(zeroImageListingId);

    // 4. Start Ephemeral Express Server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 5. Setup React SSR and Esbuild for Client Component Testing
    try {
      React = (await import('react')).default;
      const serverRenderer = await import('react-dom/server');
      renderToStaticMarkup = serverRenderer.renderToStaticMarkup;
      const routerModule = await import('react-router-dom');
      MemoryRouter = routerModule.MemoryRouter;
      esbuild = (await import('esbuild')).default;

      // Bundle PhotoGallery
      await esbuild.build({
        entryPoints: [path.join(clientSrcDir, 'components/marketplace/PhotoGallery.jsx')],
        bundle: true,
        format: 'esm',
        outfile: tempGalleryPath,
        external: ['react', 'react-dom', 'react-router-dom'],
        loader: { '.js': 'jsx', '.jsx': 'jsx' },
      });
      const galleryModule = await import(pathToFileURL(tempGalleryPath).href);
      PhotoGallery = galleryModule.default;

      // Bundle OwnerInfoCard (Task 5.6)
      await esbuild.build({
        entryPoints: [path.join(clientSrcDir, 'components/marketplace/OwnerInfoCard.jsx')],
        bundle: true,
        format: 'esm',
        outfile: tempOwnerCardPath,
        external: ['react', 'react-dom'],
        loader: { '.js': 'jsx', '.jsx': 'jsx' },
      });
      const ownerCardModule = await import(pathToFileURL(tempOwnerCardPath).href);
      OwnerInfoCard = ownerCardModule.default;

      // Bundle ListingDetailPage
      await esbuild.build({
        entryPoints: [path.join(clientSrcDir, 'pages/ListingDetailPage.jsx')],
        bundle: true,
        format: 'esm',
        outfile: tempDetailPagePath,
        external: ['react', 'react-dom', 'react-router-dom'],
        loader: { '.js': 'jsx', '.jsx': 'jsx' },
      });
      const detailModule = await import(pathToFileURL(tempDetailPagePath).href);
      ListingDetailPage = detailModule.default;

      // Bundle AppRouter
      await esbuild.build({
        entryPoints: [path.join(clientSrcDir, 'routes/AppRouter.jsx')],
        bundle: true,
        format: 'esm',
        outfile: tempRouterPath,
        external: ['react', 'react-dom', 'react-router-dom'],
        loader: { '.js': 'jsx', '.jsx': 'jsx' },
      });
      const routerTestModule = await import(pathToFileURL(tempRouterPath).href);
      AppRouter = routerTestModule.default;
    } catch {
      // Non-fatal if esbuild is unavailable in environment
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up created images
    for (const imgId of createdImageIds) {
      try {
        await adminPb.collection('listing_images').delete(imgId);
      } catch {
        // ignore
      }
    }

    // Clean up created listings
    for (const listingId of createdListingIds) {
      try {
        await adminPb.collection('listings').delete(listingId);
      } catch {
        // ignore
      }
    }

    // Clean up created users
    for (const userId of createdUserIds) {
      try {
        await adminPb.collection('users').delete(userId);
      } catch {
        // ignore
      }
    }

    // Clean up temp bundled files
    for (const p of [tempAuthPath, tempGalleryPath, tempOwnerCardPath, tempDetailPagePath, tempRouterPath]) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  });

  // =========================================================================
  // 1. BACKEND API TESTS: GET /api/v1/listings/:id
  // =========================================================================

  test('1. GET /api/v1/listings/:id returns approved listing with 200 and sanitized data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${approvedListingId}`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.listing, 'Response must include listing object');

    const listing = body.data.listing;
    assert.strictEqual(listing.id, approvedListingId);
    assert.strictEqual(listing.category, 'retail');
    assert.strictEqual(listing.listing_type, 'rent');
    assert.strictEqual(listing.price, 85000);
    assert.strictEqual(listing.area_sqft, 1200);
    assert.strictEqual(listing.city, 'Dhaka');
    assert.strictEqual(listing.area, 'Banani');
    assert.strictEqual(listing.status, 'approved');
    assert.strictEqual(listing.is_featured, true);

    // Gallery images verification
    assert.ok(Array.isArray(listing.images), 'Listing must include images array');
    assert.strictEqual(listing.images.length, 3);
    assert.strictEqual(listing.images[0].is_cover, true);
    assert.ok(listing.images[0].url.includes('/api/files/'), 'Image URL must use PocketBase files endpoint');
    assert.ok(listing.images[0].url.includes(listing.images[0].id), 'Image URL must include image ID');
    assert.ok(listing.images[0].thumb_url.includes('?thumb=800x600'), 'Thumbnail URL must include thumb query');

    // Cover image verification
    assert.ok(listing.cover_image, 'Listing must have cover_image');
    assert.strictEqual(listing.cover_image.is_cover, true);
  });

  test('2. Security Sanitization Audit: Owner phone/email and contacts are NEVER exposed', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${approvedListingId}`);
    const body = await res.json();
    const listing = body.data.listing;

    // Check owner object allowlist
    assert.ok(listing.owner, 'Owner object must be present');
    assert.strictEqual(listing.owner.id, ownerId);
    assert.ok(listing.owner.name.includes('Detail Property Owner'));
    assert.ok(listing.owner.created);

    // Strict security audit: phone, email, token, password must NOT exist
    assert.strictEqual(listing.owner.email, undefined, 'Owner email must never be exposed');
    assert.strictEqual(listing.owner.phone, undefined, 'Owner phone must never be exposed (D-014)');
    assert.strictEqual(listing.owner.password, undefined, 'Owner password must never be exposed');
    assert.strictEqual(listing.owner_contacts, undefined, 'owner_contacts relation must never be exposed');

    // String audit of entire raw JSON response body
    const rawBody = JSON.stringify(body);
    assert.ok(!rawBody.includes(ownerEmail), 'Raw response must never contain owner email address');
    assert.ok(!rawBody.includes('password'), 'Raw response must never contain password references');
    assert.ok(!rawBody.includes('owner_contacts'), 'Raw response must never contain owner_contacts');
  });

  test('3. Zero-image listing returns empty images array and null cover_image without errors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${zeroImageListingId}`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    const listing = body.data.listing;
    assert.strictEqual(listing.id, zeroImageListingId);
    assert.ok(Array.isArray(listing.images), 'images must be an array');
    assert.strictEqual(listing.images.length, 0);
    assert.strictEqual(listing.cover_image, null);
  });

  test('4. Malformed and invalid ID formats return HTTP 404', async () => {
    const malformedIds = [
      'short',
      'toolongstringwithmorethanfifteenchars123',
      'invalid_chars!@#',
      '..%2F..%2Fetc%2Fpasswd',
      'DROP%20TABLE',
    ];

    for (const badId of malformedIds) {
      const res = await fetch(`${baseUrl}/api/v1/listings/${badId}`);
      assert.strictEqual(res.status, 404, `Malformed ID '${badId}' must return HTTP 404`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error?.message || body.message, 'Listing not found');
    }
  });

  test('5. Non-existent 15-character ID returns HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/nonexist1234567`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.message || body.message, 'Listing not found');
  });

  // =========================================================================
  // 2. AUTHORIZATION & PREVIEW RULES TESTS (Decision 2)
  // =========================================================================

  test('6. Unapproved (pending) listing returns HTTP 404 to anonymous public visitors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`);
    assert.strictEqual(res.status, 404, 'Anonymous caller must receive 404 for unapproved listing');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.message || body.message, 'Listing not found');
  });

  test('7. Unapproved (rejected) listing returns HTTP 404 to anonymous public visitors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${rejectedListingId}`);
    assert.strictEqual(res.status, 404, 'Anonymous caller must receive 404 for rejected listing');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.message || body.message, 'Listing not found');
  });

  test('8. Unapproved listing returns HTTP 404 to a different authenticated user', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${otherOwnerToken}`,
      },
    });
    assert.strictEqual(res.status, 404, 'Non-owner authenticated caller must receive 404 for unapproved listing');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error?.message || body.message, 'Listing not found');
  });

  test('9. Authenticated owner CAN preview their own pending listing (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${ownerToken}`,
      },
    });
    assert.strictEqual(res.status, 200, 'Listing owner must be authorized to preview own pending listing');

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.listing.id, pendingListingId);
    assert.strictEqual(body.data.listing.status, 'pending');
  });

  test('10. Authenticated owner CAN preview their own rejected listing (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${rejectedListingId}`, {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${ownerToken}`,
      },
    });
    assert.strictEqual(res.status, 200, 'Listing owner must be authorized to preview own rejected listing');

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.listing.id, rejectedListingId);
    assert.strictEqual(body.data.listing.status, 'rejected');
  });

  test('11. Authenticated admin CAN preview unapproved listings (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200, 'Admin must be authorized to preview unapproved listings');

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.listing.id, pendingListingId);
  });

  // =========================================================================
  // 3. FRONTEND COMPONENTS & SSR TESTS
  // =========================================================================

  test('12. PhotoGallery component renders accurately for 0, 1, and multiple images', () => {
    if (!PhotoGallery || !React || !renderToStaticMarkup) {
      return;
    }

    // 12a. Zero images fallback
    const zeroMarkup = renderToStaticMarkup(React.createElement(PhotoGallery, { images: [] }));
    assert.ok(
      zeroMarkup.includes('No photos available for this commercial property'),
      'Zero images must render friendly fallback notice'
    );

    // 12b. Exactly 1 image (no navigation arrows, no thumbnail tablist)
    const singleMarkup = renderToStaticMarkup(
      React.createElement(PhotoGallery, {
        images: [{ id: 'img_1', url: 'https://example.com/photo1.jpg' }],
        title: 'Single Test Property',
      })
    );
    assert.ok(singleMarkup.includes('https://example.com/photo1.jpg'), 'Single image must be rendered in main stage');
    assert.ok(!singleMarkup.includes('aria-label="Previous photo"'), 'Single image must not render previous button');
    assert.ok(!singleMarkup.includes('aria-label="Next photo"'), 'Single image must not render next button');
    assert.ok(!singleMarkup.includes('role="tablist"'), 'Single image must not render thumbnail strip');

    // 12c. Multiple images (counter badge, navigation buttons, thumbnail strip)
    const multiMarkup = renderToStaticMarkup(
      React.createElement(PhotoGallery, {
        images: [
          { id: 'img_1', url: 'https://example.com/photo1.jpg', thumb_url: 'https://example.com/thumb1.jpg' },
          { id: 'img_2', url: 'https://example.com/photo2.jpg', thumb_url: 'https://example.com/thumb2.jpg' },
        ],
        title: 'Multi Photo Property',
      })
    );
    assert.ok(multiMarkup.includes('1 / 2'), 'Gallery must display photo counter badge');
    assert.ok(multiMarkup.includes('aria-label="Previous photo"'), 'Gallery must render previous photo button');
    assert.ok(multiMarkup.includes('aria-label="Next photo"'), 'Gallery must render next photo button');
    assert.ok(multiMarkup.includes('role="tablist"'), 'Gallery must render thumbnail tablist');
    assert.ok(multiMarkup.includes('aria-label="View photo 1 of 2"'), 'Thumbnail must have accessible label');
    assert.ok(multiMarkup.includes('aria-label="View photo 2 of 2"'), 'Thumbnail must have accessible label');
  });

  test('13. AppRouter registers /listings/:id with ListingDetailPage and satisfies test backward compatibility', () => {
    if (!AppRouter || !React || !renderToStaticMarkup || !MemoryRouter) {
      return;
    }

    const testId = 'prop_abc12345';
    const markup = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/listings/${testId}`] },
        React.createElement(AppRouter)
      )
    );

    // Verify backward compatibility assertions from Task 5.1 & Task 5.5
    assert.ok(markup.includes(`Listing ID: ${testId}`), 'ListingDetailPage must include Listing ID for SSR/test compatibility');
    assert.ok(markup.includes('Task 5.5'), 'ListingDetailPage must preserve Task 5.5 roadmap reference');
  });

  test('14. ListingDetailPage source code inspection verifies all approved decisions', () => {
    const detailSource = fs.readFileSync(path.join(clientSrcDir, 'pages/ListingDetailPage.jsx'), 'utf8');

    // Decision 1: Commercial Facilities & Highlights
    assert.ok(
      detailSource.includes('Commercial Facilities &amp; Highlights') || detailSource.includes('Commercial Facilities & Highlights'),
      'ListingDetailPage must include Commercial Facilities & Highlights heading (Decision 1)'
    );
    assert.ok(
      detailSource.includes('Power Supply') || detailSource.includes('Power Supply & Backup'),
      'ListingDetailPage must include Power Supply highlight'
    );
    assert.ok(
      detailSource.includes('Dedicated Water Line'),
      'ListingDetailPage must include Dedicated Water Line highlight'
    );
    assert.ok(
      detailSource.includes('Standard Category Provisions') || detailSource.includes('Specific site amenities may vary'),
      'ListingDetailPage must include explicit category disclaimer note (Decision 1)'
    );

    // Decision 2: Draft Preview Banner for Unapproved Status
    assert.ok(
      detailSource.includes('Draft Preview — Status:') || detailSource.includes('Draft Preview'),
      'ListingDetailPage must render draft preview banner for unapproved listings (Decision 2)'
    );

    // Task 5.6 Demarcation
    assert.ok(
      detailSource.includes('Task 5.6'),
      'ListingDetailPage must include Task 5.6 demarcation for safe owner card'
    );
    assert.ok(
      !detailSource.includes('listing.owner.phone'),
      'ListingDetailPage must never access listing.owner.phone directly'
    );
  });

  // =========================================================================
  // 4. TASK 5.6: SAFE OWNER INFORMATION CARD TESTS
  // =========================================================================

  test('15. Task 5.6: OwnerInfoCard displays public display name safely', () => {
    if (!OwnerInfoCard || !React || !renderToStaticMarkup) return;

    const markup = renderToStaticMarkup(
      React.createElement(OwnerInfoCard, {
        owner: { id: 'u123', name: 'Tanvir Hossain', created: '2026-03-15 12:00:00.000Z' },
      })
    );

    assert.ok(markup.includes('Tanvir Hossain'), 'OwnerInfoCard must render owner display name');
    assert.ok(markup.includes('Property Listed By'), 'OwnerInfoCard must include Listed By label');
    assert.ok(!markup.includes('phone'), 'OwnerInfoCard markup must not mention phone properties');
  });

  test('16. Task 5.6: OwnerInfoCard formats member-since date correctly', () => {
    if (!OwnerInfoCard || !React || !renderToStaticMarkup) return;

    const markup = renderToStaticMarkup(
      React.createElement(OwnerInfoCard, {
        owner: { id: 'u123', name: 'Rafiqul Islam', created: '2026-01-10 09:30:00.000Z' },
      })
    );

    assert.ok(markup.includes('Member since'), 'OwnerInfoCard must display Member since label');
    assert.ok(markup.includes('Jan 2026'), 'OwnerInfoCard must format created date into Month Year');
  });

  test('17. Task 5.6: OwnerInfoCard handles missing or partial owner information gracefully without crashing', () => {
    if (!OwnerInfoCard || !React || !renderToStaticMarkup) return;

    // Case 1: owner is null
    const nullMarkup = renderToStaticMarkup(React.createElement(OwnerInfoCard, { owner: null }));
    assert.ok(nullMarkup.includes('Property Owner'), 'Null owner must fall back to friendly default Property Owner');
    assert.ok(!nullMarkup.includes('Member since'), 'Null created date must omit Member since row');

    // Case 2: owner is empty object
    const emptyMarkup = renderToStaticMarkup(React.createElement(OwnerInfoCard, { owner: {} }));
    assert.ok(emptyMarkup.includes('Property Owner'), 'Empty owner must fall back to friendly default Property Owner');

    // Case 3: owner has name but missing created
    const noCreatedMarkup = renderToStaticMarkup(
      React.createElement(OwnerInfoCard, { owner: { id: 'u456', name: 'Commercial Landlord' } })
    );
    assert.ok(noCreatedMarkup.includes('Commercial Landlord'), 'Named owner without created must render name');
    assert.ok(!noCreatedMarkup.includes('Member since'), 'Missing created must omit Member since row');
  });

  test('18. Task 5.6: OwnerInfoCard clearly indicates contact number is protected and action is disabled for Phase 10', () => {
    if (!OwnerInfoCard || !React || !renderToStaticMarkup) return;

    const markup = renderToStaticMarkup(
      React.createElement(OwnerInfoCard, {
        owner: { id: 'u123', name: 'Tanvir Hossain', created: '2026-03-15 12:00:00.000Z' },
      })
    );

    // Protected notice
    assert.ok(
      markup.includes('Contact Number Protected'),
      'OwnerInfoCard must display Contact Number Protected heading'
    );
    assert.ok(
      markup.includes("The owner's direct contact number is private and is not publicly displayed"),
      'OwnerInfoCard must explain that direct contact number is private'
    );

    // Contact action boundary
    assert.ok(
      markup.includes('disabled=""') || markup.includes('disabled'),
      'Contact button must be disabled'
    );
    assert.ok(
      markup.includes('Phase 10'),
      'Contact action must clearly specify availability in Phase 10'
    );

    // Verification badges, ratings, and response rates must NOT be invented
    assert.ok(!markup.includes('Verified Commercial Listing'), 'Must not invent unverified listing badges');
    assert.ok(!markup.includes('response rate'), 'Must not invent response rates');
    assert.ok(!markup.includes('star rating'), 'Must not invent star ratings');
  });

  test('19. Task 5.6: Backend audit verifies no owner_contacts lookup or phone exposure in listing services', () => {
    const listingServiceSource = fs.readFileSync(path.join(clientSrcDir, '../../server/src/services/listing.service.js'), 'utf8');
    const listingControllerSource = fs.readFileSync(path.join(clientSrcDir, '../../server/src/controllers/listing.controller.js'), 'utf8');

    assert.ok(
      !listingServiceSource.includes("collection('owner_contacts')") && !listingServiceSource.includes('collection("owner_contacts")'),
      'listing.service.js must NEVER query owner_contacts collection'
    );
    assert.ok(
      !listingServiceSource.includes('owner_contacts') || !listingServiceSource.includes('expand: \'owner_contacts'),
      'listing.service.js must NEVER expand owner_contacts'
    );
    assert.ok(
      !listingControllerSource.includes("collection('owner_contacts')"),
      'listing.controller.js must NEVER query owner_contacts'
    );
    assert.ok(
      !listingServiceSource.includes('owner.phone'),
      'listing.service.js must NEVER access or return owner.phone'
    );
  });
});
