import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';
import { serializeRevealHistoryEntry } from '../src/services/revealService.js';

describe('Phase 10, Task 10.8 — Customer Reveal History API (GET /api/v1/reveal/history)', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';

  let starterPlan = null;

  // Owners
  let testOwner1 = null;
  let testOwner2 = null;

  // Customers
  let customerA = null;
  let customerAToken = null;
  let subA = null;

  let customerB = null;
  let customerBToken = null;
  let subB = null;

  let customerEmpty = null;
  let customerEmptyToken = null;

  // Non-customer roles for RBAC
  let ownerUser = null;
  let ownerUserToken = null;

  let adminUser = null;
  let adminUserToken = null;

  // Listings
  let listingAlpha = null;
  let listingBeta = null;
  let listingGamma = null;
  let listingDeletedId = null;

  // Reveal records
  let revealA1 = null;
  let revealA2 = null;
  let revealA3 = null;
  let revealADeleted = null;
  let revealB1 = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdContactIds = [];
  const createdSubIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 6);
  const testPassword = 'TestPassword123!';

  before(async () => {
    adminPb = await getAdminClient();
    const timestamp = Date.now();

    // 1. Fetch active subscription plan
    starterPlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true');

    // 2. Create Commercial Owners
    testOwner1 = await adminPb.collection('users').create({
      email: `owner1.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner Alpha 10.8',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner1.id);

    const contact1 = await adminPb.collection('owner_contacts').create({
      owner: testOwner1.id,
      phone: '+8801712345678',
    });
    createdContactIds.push(contact1.id);

    testOwner2 = await adminPb.collection('users').create({
      email: `owner2.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner Beta 10.8',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner2.id);

    const contact2 = await adminPb.collection('owner_contacts').create({
      owner: testOwner2.id,
      phone: '+8801799999999',
    });
    createdContactIds.push(contact2.id);

    // 3. Create Commercial Listings
    listingAlpha = await adminPb.collection('listings').create({
      title: `Listing Alpha ${timestamp}`,
      description: 'Alpha shop in Dhanmondi',
      price: 55000,
      area_sqft: 900,
      address: '12 Dhanmondi Rd',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(listingAlpha.id);

    listingBeta = await adminPb.collection('listings').create({
      title: `Listing Beta ${timestamp}`,
      description: 'Beta showroom in Gulshan',
      price: 85000,
      area_sqft: 1400,
      address: '45 Gulshan Ave',
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'showroom',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(listingBeta.id);

    listingGamma = await adminPb.collection('listings').create({
      title: `Listing Gamma ${timestamp}`,
      description: 'Gamma office space in Banani',
      price: 110000,
      area_sqft: 2000,
      address: '78 Banani 11',
      city: 'Dhaka',
      area: 'Banani',
      category: 'office',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner2.id,
    });
    createdListingIds.push(listingGamma.id);

    // 4. Create Customers
    // Customer A (has multiple reveals)
    customerA = await adminPb.collection('users').create({
      email: `cust.a.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer A History',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerA.id);

    subA = await adminPb.collection('user_subscriptions').create({
      user: customerA.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 3,
      status: 'active',
      purchased_at: new Date(timestamp - 500000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subA.id);

    // Customer B (has 1 reveal for isolation testing)
    customerB = await adminPb.collection('users').create({
      email: `cust.b.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer B History',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerB.id);

    subB = await adminPb.collection('user_subscriptions').create({
      user: customerB.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 1,
      status: 'active',
      purchased_at: new Date(timestamp - 500000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subB.id);

    // Customer Empty (has 0 reveals)
    customerEmpty = await adminPb.collection('users').create({
      email: `cust.empty.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer Empty History',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerEmpty.id);

    // Owner and Admin users for RBAC
    ownerUser = await adminPb.collection('users').create({
      email: `owner.rbac.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner RBAC 10.8',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(ownerUser.id);

    adminUser = await adminPb.collection('users').create({
      email: `admin.rbac.10_8.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Admin RBAC 10.8',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(adminUser.id);

    // 5. Populate revealed_contacts records
    // Customer A reveals (oldest to newest):
    // A1: 3 hours ago -> listingAlpha
    revealA1 = await adminPb.collection('revealed_contacts').create({
      customer: customerA.id,
      listing: listingAlpha.id,
      owner: testOwner1.id,
      revealed_at: new Date(timestamp - 3 * 3600 * 1000).toISOString(),
    });
    createdRevealIds.push(revealA1.id);

    // A2: 2 hours ago -> listingBeta
    revealA2 = await adminPb.collection('revealed_contacts').create({
      customer: customerA.id,
      listing: listingBeta.id,
      owner: testOwner1.id,
      revealed_at: new Date(timestamp - 2 * 3600 * 1000).toISOString(),
    });
    createdRevealIds.push(revealA2.id);

    // A3: 1 hour ago -> listingGamma (newest)
    revealA3 = await adminPb.collection('revealed_contacts').create({
      customer: customerA.id,
      listing: listingGamma.id,
      owner: testOwner2.id,
      revealed_at: new Date(timestamp - 1 * 3600 * 1000).toISOString(),
    });
    createdRevealIds.push(revealA3.id);

    // Customer B reveal: listingAlpha
    revealB1 = await adminPb.collection('revealed_contacts').create({
      customer: customerB.id,
      listing: listingAlpha.id,
      owner: testOwner1.id,
      revealed_at: new Date(timestamp - 2 * 3600 * 1000).toISOString(),
    });
    createdRevealIds.push(revealB1.id);

    // 6. Obtain JWT tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const aAuth = await userPb.collection('users').authWithPassword(customerA.email, testPassword);
    customerAToken = aAuth.token;

    const bAuth = await userPb.collection('users').authWithPassword(customerB.email, testPassword);
    customerBToken = bAuth.token;

    const eAuth = await userPb.collection('users').authWithPassword(customerEmpty.email, testPassword);
    customerEmptyToken = eAuth.token;

    const oAuth = await userPb.collection('users').authWithPassword(ownerUser.email, testPassword);
    ownerUserToken = oAuth.token;

    const admAuth = await userPb.collection('users').authWithPassword(adminUser.email, testPassword);
    adminUserToken = admAuth.token;

    // 7. Start ephemeral HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Close HTTP test server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // 2. Clean up created records
    const pb = await getAdminClient();

    for (const rId of createdRevealIds) {
      try {
        await pb.collection('revealed_contacts').delete(rId);
      } catch {}
    }

    for (const sId of createdSubIds) {
      try {
        await pb.collection('user_subscriptions').delete(sId);
      } catch {}
    }

    for (const lId of createdListingIds) {
      try {
        await pb.collection('listings').delete(lId);
      } catch {}
    }

    for (const cId of createdContactIds) {
      try {
        await pb.collection('owner_contacts').delete(cId);
      } catch {}
    }

    for (const uId of createdUserIds) {
      try {
        await pb.collection('users').delete(uId);
      } catch {}
    }
  });

  // =========================================================================
  // 1. Core History Retrieval & Ordering
  // =========================================================================
  describe('1. Core History Retrieval & Ordering', () => {
    test('1. Authenticated customer can retrieve their reveal history (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200');
      const body = await res.json();

      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.history), 'data.history must be an array');
      assert.strictEqual(body.data.history.length, 3, 'Customer A should have 3 reveal records');
      assert.strictEqual(body.data.pagination.totalItems, 3);
    });

    test('8. Multiple reveal records are returned newest first (revealed_at descending)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      const body = await res.json();
      const history = body.data.history;

      // Verify timestamps are strictly descending
      for (let i = 0; i < history.length - 1; i++) {
        const timeCurrent = new Date(history[i].revealed_at).getTime();
        const timeNext = new Date(history[i + 1].revealed_at).getTime();
        assert.ok(
          timeCurrent >= timeNext,
          `Record ${i} (${history[i].revealed_at}) must be newer or equal to record ${i + 1} (${history[i + 1].revealed_at})`
        );
      }

      // Check order of known listings: A3/Gamma (1h ago) -> A2/Beta (2h ago) -> A1/Alpha (3h ago)
      assert.strictEqual(history[0].id, revealA3.id, 'Newest reveal should be revealA3 (Gamma)');
      assert.strictEqual(history[1].id, revealA2.id, 'Second newest reveal should be revealA2 (Beta)');
      assert.strictEqual(history[2].id, revealA1.id, 'Oldest reveal should be revealA1 (Alpha)');
    });

    test('7. Empty history returns a valid empty response (HTTP 200 with empty array)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerEmptyToken}`,
        },
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 for empty history');
      const body = await res.json();

      assert.strictEqual(body.success, true);
      assert.deepStrictEqual(body.data.history, [], 'history array must be empty');
      assert.strictEqual(body.data.pagination.totalItems, 0);
      assert.strictEqual(body.data.pagination.page, 1);
    });
  });

  // =========================================================================
  // 2. Authentication, Authorization & Customer Isolation
  // =========================================================================
  describe('2. Authentication, Authorization & Customer Isolation', () => {
    test('2. Anonymous user receives HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
      });

      assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /authentication required/i);
    });

    test('3. Owner receives HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${ownerUserToken}`,
        },
      });

      assert.strictEqual(res.status, 403, 'Owner must receive HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /forbidden|insufficient permissions/i);
    });

    test('4. Admin receives HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${adminUserToken}`,
        },
      });

      assert.strictEqual(res.status, 403, 'Admin must receive HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /forbidden|insufficient permissions/i);
    });

    test('5. Customer A cannot retrieve Customer B\'s history (Strict Customer Isolation)', async () => {
      // Customer B should have exactly 1 record (revealB1)
      const resB = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerBToken}`,
        },
      });

      assert.strictEqual(resB.status, 200);
      const bodyB = await resB.json();
      assert.strictEqual(bodyB.data.history.length, 1);
      assert.strictEqual(bodyB.data.history[0].id, revealB1.id);

      // Verify that Customer A's reveals are NOT present in Customer B's history
      const revealIdsInB = bodyB.data.history.map((h) => h.id);
      assert.ok(!revealIdsInB.includes(revealA1.id));
      assert.ok(!revealIdsInB.includes(revealA2.id));
      assert.ok(!revealIdsInB.includes(revealA3.id));

      // Customer A's history must NOT contain Customer B's reveal
      const resA = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });
      const bodyA = await resA.json();
      const revealIdsInA = bodyA.data.history.map((h) => h.id);
      assert.ok(!revealIdsInA.includes(revealB1.id));
    });

    test('6. Customer identity query/header overrides are strictly rejected (HTTP 400)', async () => {
      // 6a. Attempt customerId override via query param
      const resQuery = await fetch(`${baseUrl}/api/v1/reveal/history?customerId=${customerB.id}`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(resQuery.status, 400, 'Query override must return HTTP 400');
      const bodyQuery = await resQuery.json();
      assert.strictEqual(bodyQuery.success, false);
      assert.match(bodyQuery.error?.message, /client-supplied customerId is strictly prohibited/i);

      // 6b. Attempt customerId override via header
      const resHeader = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
          'x-customer-id': customerB.id,
        },
      });

      assert.strictEqual(resHeader.status, 400, 'Header override must return HTTP 400');
      const bodyHeader = await resHeader.json();
      assert.strictEqual(bodyHeader.success, false);
      assert.match(bodyHeader.error?.message, /client-supplied customerId is strictly prohibited/i);
    });
  });

  // =========================================================================
  // 3. Server-Side Pagination & Bounded Limits
  // =========================================================================
  describe('3. Server-Side Pagination & Bounded Limits', () => {
    test('9. Pagination returns the correct page records and metadata', async () => {
      // Page 1 with perPage=2
      const resPage1 = await fetch(`${baseUrl}/api/v1/reveal/history?page=1&perPage=2`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(resPage1.status, 200);
      const body1 = await resPage1.json();
      assert.strictEqual(body1.data.history.length, 2);
      assert.strictEqual(body1.data.pagination.page, 1);
      assert.strictEqual(body1.data.pagination.perPage, 2);
      assert.strictEqual(body1.data.pagination.totalItems, 3);
      assert.strictEqual(body1.data.pagination.totalPages, 2);
      assert.strictEqual(body1.data.history[0].id, revealA3.id);
      assert.strictEqual(body1.data.history[1].id, revealA2.id);

      // Page 2 with perPage=2
      const resPage2 = await fetch(`${baseUrl}/api/v1/reveal/history?page=2&perPage=2`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(resPage2.status, 200);
      const body2 = await resPage2.json();
      assert.strictEqual(body2.data.history.length, 1);
      assert.strictEqual(body2.data.pagination.page, 2);
      assert.strictEqual(body2.data.pagination.perPage, 2);
      assert.strictEqual(body2.data.pagination.totalItems, 3);
      assert.strictEqual(body2.data.pagination.totalPages, 2);
      assert.strictEqual(body2.data.history[0].id, revealA1.id);
    });

    test('10. Invalid page and per-page values are rejected with HTTP 400', async () => {
      // Invalid page: negative or non-integer
      const resBadPage = await fetch(`${baseUrl}/api/v1/reveal/history?page=-1`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });
      assert.strictEqual(resBadPage.status, 400, 'Negative page must return 400');

      const resStringPage = await fetch(`${baseUrl}/api/v1/reveal/history?page=abc`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });
      assert.strictEqual(resStringPage.status, 400, 'Non-numeric page must return 400');

      // Invalid perPage: zero or negative
      const resBadPerPage = await fetch(`${baseUrl}/api/v1/reveal/history?perPage=0`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });
      assert.strictEqual(resBadPerPage.status, 400, 'Zero perPage must return 400');
    });

    test('11. Excessive per-page values are bounded safely to 100', async () => {
      const resBounded = await fetch(`${baseUrl}/api/v1/reveal/history?perPage=500`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(resBounded.status, 200, 'Excessive perPage should be bounded and succeed');
      const body = await resBounded.json();
      assert.strictEqual(body.data.pagination.perPage, 100, 'perPage must be bounded to 100');
    });
  });

  // =========================================================================
  // 4. Privacy Invariants, Allowlist Serialization & Error Safety
  // =========================================================================
  describe('4. Privacy Invariants, Allowlist Serialization & Error Safety', () => {
    test('12. Listing details are serialized using a strict allowlist', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      const body = await res.json();
      const gammaEntry = body.data.history.find((h) => h.id === revealA3.id);

      assert.ok(gammaEntry, 'Gamma reveal entry must be present');
      assert.strictEqual(gammaEntry.listing_id, listingGamma.id);
      assert.strictEqual(gammaEntry.title, `Listing Gamma ${listingGamma.title.split(' ').pop()}`);
      assert.strictEqual(gammaEntry.category, 'office');
      assert.strictEqual(gammaEntry.listing_type, 'rent');
      assert.strictEqual(gammaEntry.price, 110000);
      assert.strictEqual(gammaEntry.area_sqft, 2000);
      assert.strictEqual(gammaEntry.city, 'Dhaka');
      assert.strictEqual(gammaEntry.area, 'Banani');
      assert.strictEqual(gammaEntry.status, 'approved');

      // Nested listing object check
      assert.ok(gammaEntry.listing, 'Nested listing object must be present');
      assert.strictEqual(gammaEntry.listing.title, gammaEntry.title);
      assert.strictEqual(gammaEntry.listing.price, 110000);
    });

    test('13. Owner phone numbers are NEVER returned in history responses', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      const rawJson = await res.text();
      // Neither owner1 phone (+8801712345678) nor owner2 phone (+8801799999999) must be in the response
      assert.strictEqual(rawJson.includes('+8801712345678'), false, 'Owner 1 phone must not be leaked');
      assert.strictEqual(rawJson.includes('+8801799999999'), false, 'Owner 2 phone must not be leaked');

      const body = JSON.parse(rawJson);
      for (const entry of body.data.history) {
        assert.strictEqual(entry.phone, undefined, 'entry.phone must be undefined');
        if (entry.listing) {
          assert.strictEqual(entry.listing.phone, undefined, 'entry.listing.phone must be undefined');
        }
      }
    });

    test('14. owner_contacts collection is never queried or exposed by history endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      const rawJson = await res.text();
      assert.strictEqual(rawJson.includes('owner_contacts'), false, 'owner_contacts must not be mentioned');
    });

    test('15. Unavailable or deleted listings are handled safely (listing: null, no dummy data)', () => {
      // Test serialization of reveal record whose listing is deleted / unavailable
      const mockUnavailableEntry = {
        id: 'rev_mock_del_999',
        listing: 'deleted_listing_xyz',
        revealed_at: new Date().toISOString(),
        created: new Date().toISOString(),
        expand: {}, // listing record is unavailable / deleted
      };

      const serialized = serializeRevealHistoryEntry(mockUnavailableEntry, adminPb);
      assert.strictEqual(serialized.id, 'rev_mock_del_999');
      assert.strictEqual(serialized.listing_id, 'deleted_listing_xyz');
      assert.strictEqual(serialized.listing, null, 'Deleted listing must return listing: null');
      assert.strictEqual(serialized.title, null, 'Deleted listing must return title: null (not fabricated)');
      assert.strictEqual(serialized.price, null, 'Deleted listing must return price: null');
      assert.strictEqual(serialized.category, null);
      assert.strictEqual(serialized.cover_image, null);
    });

    test('16. Internal PocketBase errors do not leak sensitive information', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/history?page=1`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      const bodyText = await res.text();
      assert.doesNotMatch(bodyText, /tokenKey|password|superusers|sqlite|SQLITE_ERROR/i);
    });

    test('17. Route alias GET /api/v1/customer/reveal/history functions identically', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal/history`, {
        method: 'GET',
        headers: {
          Cookie: `pb_auth=${customerAToken}`,
        },
      });

      assert.strictEqual(res.status, 200, 'Alias endpoint must return HTTP 200');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.history.length, 3);
    });
  });
});
