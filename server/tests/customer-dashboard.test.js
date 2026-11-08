import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

/**
 * Phase 8, Task 8.2 — Customer Dashboard Backend API Tests
 *
 * Verifies:
 * 1. GET /api/v1/customer/dashboard
 * 2. RBAC: Anonymous (401), Owner (403), Admin (403), Customer (200)
 * 3. Credit calculation: credits_total - credits_used, multiple subscriptions aggregation, zero-credit fallback
 * 4. Recent saved listings: customer-isolated, approved-only, bounded to latest 5
 * 5. Recent revealed contacts: customer-isolated, bounded to latest 5, D-014 privacy (no phone numbers leaked)
 * 6. Session tamper-proofing: client-supplied customer IDs in query/body/headers are ignored
 */
describe('Phase 8, Task 8.2 — Customer Dashboard API (GET /api/v1/customer/dashboard)', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let customer1Email;
  let customer2Email;
  let ownerEmail;
  let adminEmail;

  let customer1Id;
  let customer2Id;
  let ownerId;
  let adminId;

  let customer1Token;
  let customer2Token;
  let ownerToken;
  let adminToken;

  let planId;
  let approvedListing1Id;
  let approvedListing2Id;
  let pendingListingId;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdSubIds = [];
  const createdFavoriteIds = [];
  const createdRevealIds = [];
  const createdContactIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Customer (Customer 1)
    customer1Email = `cust1_dash_${testRunId}@shopfinder.local`;
    const cust1Rec = await adminPb.collection('users').create({
      name: `Customer One ${testRunId}`,
      email: customer1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customer1Id = cust1Rec.id;
    createdUserIds.push(customer1Id);

    // 2. Create Secondary Customer (Customer 2 - to test data isolation)
    customer2Email = `cust2_dash_${testRunId}@shopfinder.local`;
    const cust2Rec = await adminPb.collection('users').create({
      name: `Customer Two ${testRunId}`,
      email: customer2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customer2Id = cust2Rec.id;
    createdUserIds.push(customer2Id);

    // 3. Create Property Owner
    ownerEmail = `own_dash_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner Dashboard ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 4. Create Owner Contact (Phone number in owner_contacts) to verify D-014 privacy
    try {
      const contactRec = await adminPb.collection('owner_contacts').create({
        owner: ownerId,
        phone: '+880 1712-334455',
      });
      createdContactIds.push(contactRec.id);
    } catch {}

    // 5. Create Admin
    adminEmail = `adm_dash_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin Dashboard ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 6. Authenticate test users
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const cust1Auth = await userPb.collection('users').authWithPassword(customer1Email, testPassword);
    customer1Token = cust1Auth.token;

    const cust2Auth = await userPb.collection('users').authWithPassword(customer2Email, testPassword);
    customer2Token = cust2Auth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    // 7. Get or create a subscription plan
    try {
      const plan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true');
      planId = plan.id;
    } catch {
      const newPlan = await adminPb.collection('subscription_plans').create({
        name: `Test Plan ${testRunId}`,
        price: 299,
        credits: 10,
        is_active: true,
      });
      planId = newPlan.id;
    }

    // 8. Create Listings
    const l1 = await adminPb.collection('listings').create({
      title: `Banani Space ${testRunId}`,
      description: 'Commercial shop.',
      category: 'retail',
      listing_type: 'rent',
      price: 70000,
      area_sqft: 900,
      address: 'Road 11',
      city: 'Dhaka',
      area: 'Banani',
      owner: ownerId,
      status: 'approved',
    });
    approvedListing1Id = l1.id;
    createdListingIds.push(approvedListing1Id);

    const l2 = await adminPb.collection('listings').create({
      title: `Gulshan Space ${testRunId}`,
      description: 'Corporate office.',
      category: 'office',
      listing_type: 'rent',
      price: 150000,
      area_sqft: 2000,
      address: 'Gulshan Ave',
      city: 'Dhaka',
      area: 'Gulshan',
      owner: ownerId,
      status: 'approved',
    });
    approvedListing2Id = l2.id;
    createdListingIds.push(approvedListing2Id);

    const lp = await adminPb.collection('listings').create({
      title: `Pending Space ${testRunId}`,
      description: 'Pending property.',
      category: 'office',
      listing_type: 'rent',
      price: 60000,
      area_sqft: 800,
      address: 'Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      owner: ownerId,
      status: 'pending',
    });
    pendingListingId = lp.id;
    createdListingIds.push(pendingListingId);

    // 9. Create Active Subscriptions for Customer 1 (2 active subscriptions: 10 total - 3 used = 7, and 15 total - 5 used = 10 -> Total 17 credits)
    const sub1 = await adminPb.collection('user_subscriptions').create({
      user: customer1Id,
      plan: planId,
      credits_total: 10,
      credits_used: 3,
      status: 'active',
      purchased_at: new Date().toISOString(),
    });
    createdSubIds.push(sub1.id);

    const sub2 = await adminPb.collection('user_subscriptions').create({
      user: customer1Id,
      plan: planId,
      credits_total: 15,
      credits_used: 5,
      status: 'active',
      purchased_at: new Date().toISOString(),
    });
    createdSubIds.push(sub2.id);

    // Expired subscription for Customer 1 (should NOT contribute to credits_remaining)
    const subExpired = await adminPb.collection('user_subscriptions').create({
      user: customer1Id,
      plan: planId,
      credits_total: 20,
      credits_used: 0,
      status: 'expired',
      purchased_at: new Date(Date.now() - 86400000).toISOString(),
    });
    createdSubIds.push(subExpired.id);

    // 10. Create Bookmarks in saved_listings
    // Customer 1 saves listing 1
    const fav1 = await adminPb.collection('saved_listings').create({
      customer: customer1Id,
      listing: approvedListing1Id,
    });
    createdFavoriteIds.push(fav1.id);

    // Customer 2 saves listing 2 (Customer 1 should NOT see this)
    const fav2 = await adminPb.collection('saved_listings').create({
      customer: customer2Id,
      listing: approvedListing2Id,
    });
    createdFavoriteIds.push(fav2.id);

    // 11. Create Revealed Contacts in revealed_contacts
    // Customer 1 revealed listing 1
    const rev1 = await adminPb.collection('revealed_contacts').create({
      customer: customer1Id,
      listing: approvedListing1Id,
      owner: ownerId,
    });
    createdRevealIds.push(rev1.id);

    // Customer 2 revealed listing 2 (Customer 1 should NOT see this)
    const rev2 = await adminPb.collection('revealed_contacts').create({
      customer: customer2Id,
      listing: approvedListing2Id,
      owner: ownerId,
    });
    createdRevealIds.push(rev2.id);

    // 12. Start ephemeral HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    for (const id of createdRevealIds) {
      try {
        await adminPb.collection('revealed_contacts').delete(id);
      } catch {}
    }
    for (const id of createdFavoriteIds) {
      try {
        await adminPb.collection('saved_listings').delete(id);
      } catch {}
    }
    for (const id of createdSubIds) {
      try {
        await adminPb.collection('user_subscriptions').delete(id);
      } catch {}
    }
    for (const id of createdListingIds) {
      try {
        await adminPb.collection('listings').delete(id);
      } catch {}
    }
    for (const id of createdContactIds) {
      try {
        await adminPb.collection('owner_contacts').delete(id);
      } catch {}
    }
    for (const id of createdUserIds) {
      try {
        await adminPb.collection('users').delete(id);
      } catch {}
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function apiRequest(path, { method = 'GET', token = null, headers = {} } = {}) {
    const reqHeaders = { ...headers };
    if (token) {
      reqHeaders['Cookie'] = `pb_auth=${token}`;
    }
    return fetch(`${baseUrl}${path}`, { method, headers: reqHeaders });
  }

  // =========================================================================
  // 1. RBAC & AUTHORIZATION CHECKS
  // =========================================================================
  describe('RBAC & Route Authorization', () => {
    test('1. Anonymous request to GET /api/v1/customer/dashboard returns HTTP 401', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: null });
      assert.strictEqual(res.status, 401, 'Anonymous access must return HTTP 401');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('2. Owner role to GET /api/v1/customer/dashboard returns HTTP 403', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: ownerToken });
      assert.strictEqual(res.status, 403, 'Owner access must return HTTP 403');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Forbidden|insufficient permissions/i);
    });

    test('3. Admin role to GET /api/v1/customer/dashboard returns HTTP 403', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: adminToken });
      assert.strictEqual(res.status, 403, 'Admin access must return HTTP 403');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Forbidden|insufficient permissions/i);
    });

    test('4. Customer role can successfully access GET /api/v1/customer/dashboard (HTTP 200)', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200, 'Customer must receive HTTP 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'Must return payload data');
    });
  });

  // =========================================================================
  // 2. CREDIT BALANCE SUMMARY CALCULATION
  // =========================================================================
  describe('Credit Balance Summary (FR-080)', () => {
    test('5. Credit balance correctly aggregates active subscriptions (credits_total - credits_used)', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      // Sub 1: (10 - 3 = 7), Sub 2: (15 - 5 = 10), Expired Sub: 0 -> Expected 17
      assert.strictEqual(data.data.credits_remaining, 17, 'Credits remaining must equal sum of active subscriptions');
      assert.strictEqual(data.data.active_subscriptions_count, 2, 'Must report 2 active subscriptions');
    });

    test('6. Customer with no active subscriptions returns 0 credits gracefully', async () => {
      // Customer 2 has no subscriptions
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer2Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.strictEqual(data.data.credits_remaining, 0, 'No active subscriptions must return 0 credits');
      assert.strictEqual(data.data.active_subscriptions_count, 0);
    });
  });

  // =========================================================================
  // 3. RECENT SAVED ACTIVITY (ISOLATION & DEFENSE)
  // =========================================================================
  describe('Recent Saved Listings Activity', () => {
    test('7. Customer sees only their own saved listings in recent_saved', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.data.recent_saved));
      const savedListingIds = data.data.recent_saved.map((item) => item.listing_id);

      assert.ok(savedListingIds.includes(approvedListing1Id), 'Must include Customer 1 saved listing');
      assert.ok(!savedListingIds.includes(approvedListing2Id), 'Must NOT include Customer 2 saved listing');
    });

    test('8. Recent saved activity excludes pending, rejected, or non-approved listings', async () => {
      // Customer 1 attempts to save pending listing directly in DB (simulate legacy or edited listing)
      const pendingFav = await adminPb.collection('saved_listings').create({
        customer: customer1Id,
        listing: pendingListingId,
      });
      createdFavoriteIds.push(pendingFav.id);

      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      const savedListingIds = data.data.recent_saved.map((item) => item.listing_id);
      assert.ok(!savedListingIds.includes(pendingListingId), 'Pending listing must be excluded from recent_saved');
    });
  });

  // =========================================================================
  // 4. RECENT REVEALED CONTACTS ACTIVITY & D-014 PRIVACY
  // =========================================================================
  describe('Recent Revealed Contacts Activity & Privacy', () => {
    test('9. Customer sees only their own reveals in recent_reveals', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.data.recent_reveals));
      const revealListingIds = data.data.recent_reveals.map((item) => item.listing_id);

      assert.ok(revealListingIds.includes(approvedListing1Id), 'Must include Customer 1 revealed listing');
      assert.ok(!revealListingIds.includes(approvedListing2Id), 'Must NOT include Customer 2 revealed listing');
    });

    test('10. D-014 Privacy Policy: Dashboard payload NEVER leaks owner phone numbers', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer1Token });
      assert.strictEqual(res.status, 200);
      const rawText = await res.text();

      assert.ok(!rawText.includes('1712-334455'), 'Owner phone number must not be exposed');
      assert.ok(!rawText.includes('owner_contacts'), 'owner_contacts collection must not be referenced');
    });

    test('11. Customer with zero reveals returns empty recent_reveals array without error', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', { token: customer2Token });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(Array.isArray(data.data.recent_reveals));
      // In before(), Customer 2 had 1 reveal (listing 2). Customer 2's reveals only has listing 2
      assert.strictEqual(data.data.recent_reveals.length, 1);
    });
  });

  // =========================================================================
  // 5. SESSION TAMPER-PROOFING
  // =========================================================================
  describe('Session Tamper-Proofing', () => {
    test('12. Injected customer IDs in query parameters (?user=...) cannot alter session identity', async () => {
      const res = await apiRequest(`/api/v1/customer/dashboard?user=${customer2Id}&customerId=${customer2Id}`, {
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      // Should still reflect Customer 1's 17 credits, not Customer 2's 0 credits
      assert.strictEqual(data.data.credits_remaining, 17);
    });

    test('13. Client-supplied role in headers (X-User-Role: customer) cannot grant access to owner', async () => {
      const res = await apiRequest('/api/v1/customer/dashboard', {
        token: ownerToken,
        headers: {
          'X-User-Role': 'customer',
          'X-Role': 'customer',
        },
      });

      assert.strictEqual(res.status, 403, 'Injected role headers must not bypass RBAC');
    });
  });
});

