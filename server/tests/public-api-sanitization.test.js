import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';
import { getAdminClient } from '../src/config/pocketbase.js';

describe('Phase 5, Task 5.7 — Public API Response Sanitization', () => {
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

  let approvedFeaturedId;
  let approvedRegularId;
  let pendingListingId;
  let rejectedListingId;

  const EXPECTED_COLLECTION_LISTING_KEYS = [
    'id',
    'title',
    'description',
    'category',
    'listing_type',
    'price',
    'area_sqft',
    'address',
    'city',
    'area',
    'status',
    'is_featured',
    'created',
    'updated',
    'cover_image',
    'owner',
  ].sort();

  const EXPECTED_DETAIL_LISTING_KEYS = [
    ...EXPECTED_COLLECTION_LISTING_KEYS,
    'images',
  ].sort();

  const EXPECTED_OWNER_KEYS = ['id', 'name', 'created'].sort();

  const EXPECTED_COVER_IMAGE_KEYS = ['id', 'image', 'is_cover', 'url', 'thumb_url'].sort();

  const EXPECTED_GALLERY_IMAGE_KEYS = ['id', 'image', 'is_cover', 'order', 'url', 'thumb_url'].sort();

  const EXPECTED_PAGINATION_KEYS = ['page', 'perPage', 'totalItems', 'totalPages'].sort();

  const FORBIDDEN_KEYS = new Set([
    'phone',
    'email',
    'password',
    'passwordHash',
    'token',
    'tokenKey',
    'owner_contacts',
    'rejection_note',
    'collectionId',
    'collectionName',
    'expand',
  ]);

  /**
   * Recursively inspects any JavaScript value (object or array) and collects all object keys.
   *
   * @param {*} val
   * @param {Set<string>} [keys=new Set()]
   * @returns {Set<string>}
   */
  function collectAllObjectKeys(val, keys = new Set()) {
    if (!val || typeof val !== 'object') return keys;

    if (Array.isArray(val)) {
      for (const item of val) {
        collectAllObjectKeys(item, keys);
      }
      return keys;
    }

    for (const key of Object.keys(val)) {
      keys.add(key);
      collectAllObjectKeys(val[key], keys);
    }

    return keys;
  }

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Test Accounts
    ownerEmail = `sanit_owner_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Sanitization Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    otherOwnerEmail = `sanit_other_${testRunId}@shopfinder.local`;
    const otherRec = await adminPb.collection('users').create({
      name: `Sanitization Other ${testRunId}`,
      email: otherOwnerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    otherOwnerId = otherRec.id;
    createdUserIds.push(otherOwnerId);

    adminEmail = `sanit_admin_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Sanitization Admin ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 2. Obtain Session Tokens
    const loginPb = new PocketBase(env.POCKETBASE_URL);
    const ownerAuth = await loginPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const otherAuth = await loginPb.collection('users').authWithPassword(otherOwnerEmail, testPassword);
    otherOwnerToken = otherAuth.token;

    const adminAuth = await loginPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    // 3. Create Test Listings
    // 3a. Approved & Featured
    const approvedFeatured = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Sanitized Approved Featured Floor ${testRunId}`,
      description: 'Fully approved featured commercial property for sanitization testing.',
      category: 'office',
      listing_type: 'rent',
      price: 180000,
      area_sqft: 3200,
      address: 'Tower A, Gulshan Avenue',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
      is_featured: true,
      rejection_note: 'Internal test rejection note should never leak',
    });
    approvedFeaturedId = approvedFeatured.id;
    createdListingIds.push(approvedFeaturedId);

    // 3b. Approved & Non-Featured
    const approvedRegular = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Sanitized Approved Regular Shop ${testRunId}`,
      description: 'Regular commercial shop for marketplace browse testing.',
      category: 'retail',
      listing_type: 'rent',
      price: 65000,
      area_sqft: 800,
      address: 'Shop 12, Dhanmondi Plaza',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
      is_featured: false,
    });
    approvedRegularId = approvedRegular.id;
    createdListingIds.push(approvedRegularId);

    // 3c. Pending Listing
    const pendingRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Sanitized Pending Showroom ${testRunId}`,
      description: 'Draft showroom pending moderation.',
      category: 'showroom',
      listing_type: 'rent',
      price: 250000,
      area_sqft: 4000,
      address: 'Airport Road, Uttara',
      city: 'Dhaka',
      area: 'Uttara',
      status: 'pending',
      is_featured: false,
    });
    pendingListingId = pendingRec.id;
    createdListingIds.push(pendingListingId);

    // 3d. Rejected Listing with explicit rejection_note (Decision 2)
    const rejectedRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Sanitized Rejected Warehouse ${testRunId}`,
      description: 'Warehouse rejected by moderation.',
      category: 'warehouse',
      listing_type: 'sale',
      price: 20000000,
      area_sqft: 7500,
      address: 'Station Road, Tejgaon',
      city: 'Dhaka',
      area: 'Tejgaon',
      status: 'rejected',
      is_featured: false,
      rejection_note: 'Confidential admin rejection rationale: incomplete commercial trade license document.',
    });
    rejectedListingId = rejectedRec.id;
    createdListingIds.push(rejectedListingId);

    // 4. Attach Valid Images
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const form1 = new FormData();
    form1.append('listing', approvedFeaturedId);
    form1.append('is_cover', 'true');
    form1.append('order', '1');
    form1.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'cover.png');
    const img1 = await adminPb.collection('listing_images').create(form1);
    createdImageIds.push(img1.id);

    const form2 = new FormData();
    form2.append('listing', approvedFeaturedId);
    form2.append('is_cover', 'false');
    form2.append('order', '2');
    form2.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'interior.png');
    const img2 = await adminPb.collection('listing_images').create(form2);
    createdImageIds.push(img2.id);

    // 5. Start Server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (adminPb) {
      for (const id of createdImageIds) {
        try {
          await adminPb.collection('listing_images').delete(id);
        } catch {
          // ignore
        }
      }

      for (const id of createdListingIds) {
        try {
          await adminPb.collection('listings').delete(id);
        } catch {
          // ignore
        }
      }

      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {
          // ignore
        }
      }
    }
  });

  // =========================================================================
  // 1. LISTING COLLECTION SANITIZATION (GET /api/v1/listings)
  // =========================================================================

  test('1. GET /api/v1/listings: Strict allowlist compliance on top-level listing fields', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.listings));
    assert.ok(body.data.listings.length > 0);

    for (const listing of body.data.listings) {
      const keys = Object.keys(listing).sort();
      assert.deepStrictEqual(
        keys,
        EXPECTED_COLLECTION_LISTING_KEYS,
        'Listing in collection must match exact allowlist keys'
      );
      assert.strictEqual(listing.status, 'approved', 'Every public listing must be status = approved');
      assert.strictEqual(typeof listing.id, 'string');
      assert.strictEqual(typeof listing.price, 'number');
    }
  });

  test('2. GET /api/v1/listings: Strict allowlist compliance on nested owner object', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    const body = await res.json();

    for (const listing of body.data.listings) {
      assert.ok(listing.owner, 'Listing must include owner object');
      const ownerKeys = Object.keys(listing.owner).sort();
      assert.deepStrictEqual(
        ownerKeys,
        EXPECTED_OWNER_KEYS,
        'Nested owner object must contain strictly id, name, and created'
      );
      assert.strictEqual(listing.owner.id, ownerId);
      assert.strictEqual(typeof listing.owner.name, 'string');
    }
  });

  test('3. GET /api/v1/listings: Strict allowlist compliance on nested cover_image object', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?search=${encodeURIComponent(testRunId)}`);
    const body = await res.json();

    const featuredListing = body.data.listings.find((l) => l.id === approvedFeaturedId);
    assert.ok(featuredListing, 'Featured listing must be in response');
    assert.ok(featuredListing.cover_image, 'Listing must have cover_image');

    const coverKeys = Object.keys(featuredListing.cover_image).sort();
    assert.deepStrictEqual(
      coverKeys,
      EXPECTED_COVER_IMAGE_KEYS,
      'Cover image must contain strictly id, image, is_cover, url, thumb_url'
    );
  });

  // =========================================================================
  // 2. FEATURED LISTINGS SANITIZATION (GET /api/v1/listings/featured)
  // =========================================================================

  test('4. GET /api/v1/listings/featured: Strict allowlist compliance & approved-only status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/featured`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.listings));

    for (const listing of body.data.listings) {
      const keys = Object.keys(listing).sort();
      assert.deepStrictEqual(
        keys,
        EXPECTED_COLLECTION_LISTING_KEYS,
        'Featured listing must match exact allowlist keys'
      );
      assert.strictEqual(listing.status, 'approved', 'Featured listing must have status = approved');
      assert.strictEqual(listing.is_featured, true, 'Featured listing must have is_featured = true');

      if (listing.owner) {
        assert.deepStrictEqual(Object.keys(listing.owner).sort(), EXPECTED_OWNER_KEYS);
      }
      if (listing.cover_image) {
        assert.deepStrictEqual(Object.keys(listing.cover_image).sort(), EXPECTED_COVER_IMAGE_KEYS);
      }
    }
  });

  // =========================================================================
  // 3. LISTING DETAILS SANITIZATION (GET /api/v1/listings/:id)
  // =========================================================================

  test('5. GET /api/v1/listings/:id: Strict allowlist compliance for public approved listing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/${approvedFeaturedId}`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.listing);

    const listing = body.data.listing;
    const keys = Object.keys(listing).sort();
    assert.deepStrictEqual(
      keys,
      EXPECTED_DETAIL_LISTING_KEYS,
      'Listing details must contain strictly the 17 allowlisted keys'
    );

    // Verify images array
    assert.ok(Array.isArray(listing.images));
    assert.strictEqual(listing.images.length, 2);
    for (const img of listing.images) {
      assert.deepStrictEqual(
        Object.keys(img).sort(),
        EXPECTED_GALLERY_IMAGE_KEYS,
        'Gallery images must contain strictly id, image, is_cover, order, url, thumb_url'
      );
    }
  });

  test('6. Decision 2: rejection_note is NEVER exposed in public, owner-preview, or admin-preview responses', async () => {
    // 6a. Public call on rejected listing returns 404 (zero leakage)
    const pubRes = await fetch(`${baseUrl}/api/v1/listings/${rejectedListingId}`);
    assert.strictEqual(pubRes.status, 404);
    const pubBody = await pubRes.json();
    assert.strictEqual(JSON.stringify(pubBody).includes('rejection_note'), false);

    // 6b. Owner preview on rejected listing returns 200, but rejection_note MUST NOT exist
    const ownerRes = await fetch(`${baseUrl}/api/v1/listings/${rejectedListingId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${ownerToken}` },
    });
    assert.strictEqual(ownerRes.status, 200);
    const ownerBody = await ownerRes.json();
    assert.strictEqual(ownerBody.data.listing.id, rejectedListingId);
    assert.strictEqual(ownerBody.data.listing.status, 'rejected');
    assert.strictEqual(
      'rejection_note' in ownerBody.data.listing,
      false,
      'rejection_note must NEVER be present on owner preview response (Decision 2)'
    );
    assert.strictEqual(
      JSON.stringify(ownerBody).includes('trade license'),
      false,
      'Raw response must not contain any rejection rationale'
    );

    // 6c. Admin preview on rejected listing returns 200, but rejection_note MUST NOT exist
    const adminRes = await fetch(`${baseUrl}/api/v1/listings/${rejectedListingId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${adminToken}` },
    });
    assert.strictEqual(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.strictEqual(
      'rejection_note' in adminBody.data.listing,
      false,
      'rejection_note must NEVER be present on admin preview response (Decision 2)'
    );
  });

  // =========================================================================
  // 4. PAGINATION METADATA SANITIZATION
  // =========================================================================

  test('7. Pagination metadata contains strictly { page, perPage, totalItems, totalPages } as finite numbers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings?perPage=5`);
    const body = await res.json();

    assert.ok(body.data.pagination, 'Pagination object must be present');
    const paginationKeys = Object.keys(body.data.pagination).sort();
    assert.deepStrictEqual(
      paginationKeys,
      EXPECTED_PAGINATION_KEYS,
      'Pagination must contain strictly page, perPage, totalItems, totalPages'
    );

    assert.strictEqual(typeof body.data.pagination.page, 'number');
    assert.strictEqual(typeof body.data.pagination.perPage, 'number');
    assert.strictEqual(typeof body.data.pagination.totalItems, 'number');
    assert.strictEqual(typeof body.data.pagination.totalPages, 'number');

    assert.ok(Number.isFinite(body.data.pagination.page));
    assert.ok(Number.isFinite(body.data.pagination.perPage));
    assert.ok(Number.isFinite(body.data.pagination.totalItems));
    assert.ok(Number.isFinite(body.data.pagination.totalPages));
  });

  // =========================================================================
  // 5. RECURSIVE FORBIDDEN-FIELD AUDIT
  // =========================================================================

  test('8. Recursive inspection verifies zero forbidden keys across all public endpoints', async () => {
    const endpoints = [
      `${baseUrl}/api/v1/listings`,
      `${baseUrl}/api/v1/listings/featured`,
      `${baseUrl}/api/v1/listings/${approvedFeaturedId}`,
    ];

    for (const url of endpoints) {
      const res = await fetch(url);
      const body = await res.json();

      const allKeys = collectAllObjectKeys(body);

      for (const forbidden of FORBIDDEN_KEYS) {
        assert.strictEqual(
          allKeys.has(forbidden),
          false,
          `Endpoint ${url} must NEVER contain forbidden key '${forbidden}' anywhere in response structure`
        );
      }

      // Check raw JSON string for sensitive leakages
      const raw = JSON.stringify(body);
      assert.strictEqual(raw.includes(ownerEmail), false, 'Raw JSON must never contain owner email');
      assert.strictEqual(raw.includes(testPassword), false, 'Raw JSON must never contain passwords');
      assert.strictEqual(raw.includes('passwordHash'), false, 'Raw JSON must never contain passwordHash');
      assert.strictEqual(raw.includes('tokenKey'), false, 'Raw JSON must never contain tokenKey');
      assert.strictEqual(raw.includes('owner_contacts'), false, 'Raw JSON must never contain owner_contacts');
    }
  });

  // =========================================================================
  // 6. ERROR RESPONSES SANITIZATION (Decision 1 — Option B & Error Stacks)
  // =========================================================================

  test('9. Decision 1 — Option B: HTTP 400 validation errors NEVER reflect raw query values', async () => {
    const massiveString = 'ATTACKER_PAYLOAD_' + 'X'.repeat(2000);

    // 9a. Oversized invalid sort
    const resSort = await fetch(`${baseUrl}/api/v1/listings?sort=${encodeURIComponent(massiveString)}`);
    assert.strictEqual(resSort.status, 400);
    const bodySort = await resSort.json();
    assert.strictEqual(bodySort.success, false);
    assert.strictEqual(
      bodySort.error.message,
      'Invalid sort option. Must be one of: newest, price_asc, price_desc, -created, price, -price'
    );
    assert.strictEqual(
      JSON.stringify(bodySort).includes('ATTACKER_PAYLOAD'),
      false,
      'HTTP 400 must NEVER echo user query parameter payload'
    );

    // 9b. Invalid category
    const resCat = await fetch(`${baseUrl}/api/v1/listings?category=${encodeURIComponent(massiveString)}`);
    assert.strictEqual(resCat.status, 400);
    const bodyCat = await resCat.json();
    assert.strictEqual(
      bodyCat.error.message,
      'Invalid category. Must be one of: retail, office, restaurant, warehouse, showroom, industrial, other'
    );
    assert.strictEqual(JSON.stringify(bodyCat).includes('ATTACKER_PAYLOAD'), false);

    // 9c. Invalid page
    const resPage = await fetch(`${baseUrl}/api/v1/listings?page=${encodeURIComponent(massiveString)}`);
    assert.strictEqual(resPage.status, 400);
    const bodyPage = await resPage.json();
    assert.strictEqual(
      bodyPage.error.message,
      'Invalid page. Must be an integer greater than or equal to 1'
    );
    assert.strictEqual(JSON.stringify(bodyPage).includes('ATTACKER_PAYLOAD'), false);

    // 9d. Invalid perPage
    const resPerPage = await fetch(`${baseUrl}/api/v1/listings?perPage=${encodeURIComponent(massiveString)}`);
    assert.strictEqual(resPerPage.status, 400);
    const bodyPerPage = await resPerPage.json();
    assert.strictEqual(bodyPerPage.error.message, 'Invalid perPage. Must be an integer');
    assert.strictEqual(JSON.stringify(bodyPerPage).includes('ATTACKER_PAYLOAD'), false);

    // 9e. Invalid listing_type
    const resType = await fetch(`${baseUrl}/api/v1/listings?listing_type=${encodeURIComponent(massiveString)}`);
    assert.strictEqual(resType.status, 400);
    const bodyType = await resType.json();
    assert.strictEqual(bodyType.error.message, "Invalid listing_type. Must be 'rent' or 'sale'");
    assert.strictEqual(JSON.stringify(bodyType).includes('ATTACKER_PAYLOAD'), false);

    // 9f. Inverted range values do not echo numeric inputs
    const resRange = await fetch(`${baseUrl}/api/v1/listings?min_price=10000&max_price=5000`);
    assert.strictEqual(resRange.status, 400);
    const bodyRange = await resRange.json();
    assert.strictEqual(bodyRange.error.message, 'Invalid price range: min_price cannot exceed max_price');
  });

  test('10. HTTP 404 responses are generic and do not leak query errors or existence', async () => {
    const res = await fetch(`${baseUrl}/api/v1/listings/nonexistent9999`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.message, 'Listing not found');

    const keys = Object.keys(body.error);
    assert.deepStrictEqual(keys, ['message'], '404 error object must contain only message');
  });

  test('11. HTTP responses NEVER return stack traces across any environment', async () => {
    // Non-existent route
    const res404 = await fetch(`${baseUrl}/api/v1/nonexistent-route-for-stack-test`);
    assert.strictEqual(res404.status, 404);
    const body404 = await res404.json();
    assert.strictEqual('stack' in body404.error, false, 'Route not found must never return stack');

    // Validation error
    const res400 = await fetch(`${baseUrl}/api/v1/listings?page=invalid`);
    assert.strictEqual(res400.status, 400);
    const body400 = await res400.json();
    assert.strictEqual('stack' in body400.error, false, 'Validation error must never return stack');

    // Confirm raw string has no directory paths
    const raw400 = JSON.stringify(body400);
    assert.strictEqual(raw400.includes('server\\src'), false);
    assert.strictEqual(raw400.includes('node_modules'), false);
  });

  // =========================================================================
  // 7. AUTHORIZATION REGRESSION TESTS
  // =========================================================================

  test('12. Authorization regression: Task 5.5 preview rules are fully preserved', async () => {
    // 12a. Anonymous user can view approved listing
    const appRes = await fetch(`${baseUrl}/api/v1/listings/${approvedFeaturedId}`);
    assert.strictEqual(appRes.status, 200);

    // 12b. Anonymous user cannot view pending listing (404)
    const anonPendRes = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`);
    assert.strictEqual(anonPendRes.status, 404);

    // 12c. Owner can preview own pending listing (200)
    const ownerPendRes = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${ownerToken}` },
    });
    assert.strictEqual(ownerPendRes.status, 200);
    const ownerPendBody = await ownerPendRes.json();
    assert.strictEqual(ownerPendBody.data.listing.id, pendingListingId);

    // 12d. Different owner receives 404 for another owner's pending listing
    const diffOwnerRes = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${otherOwnerToken}` },
    });
    assert.strictEqual(diffOwnerRes.status, 404);

    // 12e. Admin can preview pending listing (200)
    const adminPendRes = await fetch(`${baseUrl}/api/v1/listings/${pendingListingId}`, {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${adminToken}` },
    });
    assert.strictEqual(adminPendRes.status, 200);
  });
});

