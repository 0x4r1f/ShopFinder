import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

/**
 * Phase 7, Task 7.6 — Authorization Enforcement Security Test Suite
 *
 * Verifies:
 * 1. Owners must never approve, reject, or moderate their own listings.
 * 2. All 7 Admin operations are strictly restricted to authenticated users with verified role === 'admin'.
 * 3. Anonymous requests receive HTTP 401.
 * 4. Customers receive HTTP 403.
 * 5. Owners receive HTTP 403.
 * 6. Admins succeed (HTTP 200).
 * 7. Anti-self-approval returns HTTP 403 with DB unchanged.
 * 8. Anti-self-rejection returns HTTP 403 with DB unchanged.
 * 9. Anti-self-archive returns HTTP 403 with DB unchanged.
 * 10. Anti-self-deactivation returns HTTP 403 with DB unchanged.
 * 11. Tamper-proofing: Client-supplied roles in body, query, or headers cannot bypass RBAC.
 */
describe('Phase 7, Task 7.6 — Authorization Enforcement Security Audit', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let admin1Email;
  let admin2Email;
  let ownerEmail;
  let customerEmail;

  let admin1Id;
  let admin2Id;
  let ownerId;
  let customerId;

  let admin1Token;
  let admin2Token;
  let ownerToken;
  let customerToken;

  let testListingId;
  let admin1ListingId;
  let ownerListingId;

  const createdUserIds = [];
  const createdListingIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Admin (Admin 1)
    admin1Email = `adm1_sec_${testRunId}@shopfinder.local`;
    const admin1Rec = await adminPb.collection('users').create({
      name: `Admin Primary Sec ${testRunId}`,
      email: admin1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin1Id = admin1Rec.id;
    createdUserIds.push(admin1Id);

    // 2. Create Peer Admin (Admin 2)
    admin2Email = `adm2_sec_${testRunId}@shopfinder.local`;
    const admin2Rec = await adminPb.collection('users').create({
      name: `Admin Peer Sec ${testRunId}`,
      email: admin2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin2Id = admin2Rec.id;
    createdUserIds.push(admin2Id);

    // 3. Create Regular Owner
    ownerEmail = `own_sec_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner Sec ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 4. Create Regular Customer
    customerEmail = `cust_sec_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer Sec ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 5. Authenticate test users to acquire JWT tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const admin1Auth = await userPb.collection('users').authWithPassword(admin1Email, testPassword);
    admin1Token = admin1Auth.token;

    const admin2Auth = await userPb.collection('users').authWithPassword(admin2Email, testPassword);
    admin2Token = admin2Auth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    // 6. Create Listings:
    // a) Listing owned by regular owner (for general admin moderation tests)
    const listingRec1 = await adminPb.collection('listings').create({
      title: `General Test Listing ${testRunId}`,
      description: 'Test commercial listing description for security audit.',
      category: 'retail',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 800,
      address: '12 Kemal Ataturk Ave',
      city: 'Dhaka',
      area: 'Banani',
      owner: ownerId,
      status: 'pending',
    });
    testListingId = listingRec1.id;
    createdListingIds.push(testListingId);

    // b) Listing owned by Admin 1 (to test anti-self-approval/rejection/archive)
    const listingRec2 = await adminPb.collection('listings').create({
      title: `Admin Owned Listing ${testRunId}`,
      description: 'Test commercial listing owned by admin for anti-self moderation.',
      category: 'office',
      listing_type: 'rent',
      price: 75000,
      area_sqft: 1200,
      address: '45 Gulshan Ave',
      city: 'Dhaka',
      area: 'Gulshan',
      owner: admin1Id,
      status: 'pending',
    });
    admin1ListingId = listingRec2.id;
    createdListingIds.push(admin1ListingId);

    // c) Listing owned by regular Owner (to test owner attempting self-moderation via admin API)
    const listingRec3 = await adminPb.collection('listings').create({
      title: `Owner Self Mod Listing ${testRunId}`,
      description: 'Test commercial listing owned by regular owner.',
      category: 'restaurant',
      listing_type: 'rent',
      price: 90000,
      area_sqft: 1500,
      address: '89 Dhanmondi 27',
      city: 'Dhaka',
      area: 'Dhanmondi',
      owner: ownerId,
      status: 'pending',
    });
    ownerListingId = listingRec3.id;
    createdListingIds.push(ownerListingId);

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
    // 1. Clean up created listings
    for (const lid of createdListingIds) {
      try {
        await adminPb.collection('listings').delete(lid);
      } catch {}
    }

    // 2. Clean up created users
    for (const uid of createdUserIds) {
      try {
        await adminPb.collection('users').delete(uid);
      } catch {}
    }

    // 3. Stop server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Helper function to issue HTTP requests
  async function apiRequest(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
    const reqHeaders = {
      ...headers,
    };

    if (token) {
      reqHeaders['Cookie'] = `pb_auth=${token}`;
    }

    // For state-mutating requests, include CSRF-safe Origin
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      reqHeaders['Origin'] = env.CLIENT_URL;
      if (body !== null && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const options = {
      method,
      headers: reqHeaders,
    };

    if (body !== null) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return fetch(`${baseUrl}${path}`, options);
  }

  // =========================================================================
  // 1. RBAC MATRIX AUDIT ACROSS ALL 7 ADMIN ENDPOINTS
  // =========================================================================
  describe('RBAC Matrix: All 7 Admin Endpoints Reject Anonymous, Customer, and Owner', () => {
    const endpoints = [
      {
        name: '1. Platform Statistics (Task 7.1)',
        method: 'GET',
        path: () => '/api/v1/admin/stats',
        body: null,
      },
      {
        name: '2. Pending Review Queue (Task 7.2)',
        method: 'GET',
        path: () => '/api/v1/admin/listings/pending',
        body: null,
      },
      {
        name: '3. Approve Listing (Task 7.3)',
        method: 'POST',
        path: () => `/api/v1/admin/listings/${testListingId}/approve`,
        body: {},
      },
      {
        name: '4. Reject Listing (Task 7.3)',
        method: 'POST',
        path: () => `/api/v1/admin/listings/${testListingId}/reject`,
        body: { rejection_note: 'Legitimate rejection reason for security testing.' },
      },
      {
        name: '5. Archive Listing (Task 7.3)',
        method: 'POST',
        path: () => `/api/v1/admin/listings/${testListingId}/archive`,
        body: {},
      },
      {
        name: '6. List Users (Task 7.5)',
        method: 'GET',
        path: () => '/api/v1/admin/users',
        body: null,
      },
      {
        name: '7. Update User Status (Task 7.5)',
        method: 'PATCH',
        path: () => `/api/v1/admin/users/${ownerId}/status`,
        body: { is_active: true },
      },
    ];

    for (const ep of endpoints) {
      test(`${ep.name} — Anonymous request returns HTTP 401 Unauthorized`, async () => {
        const res = await apiRequest(ep.path(), {
          method: ep.method,
          token: null,
          body: ep.body,
        });

        assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');
        const data = await res.json();
        assert.strictEqual(data.success, false);
      });

      test(`${ep.name} — Customer access returns HTTP 403 Forbidden`, async () => {
        const res = await apiRequest(ep.path(), {
          method: ep.method,
          token: customerToken,
          body: ep.body,
        });

        assert.strictEqual(res.status, 403, 'Customer role must return HTTP 403');
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.match(data.error?.message, /Forbidden|insufficient permissions/i);
      });

      test(`${ep.name} — Owner access returns HTTP 403 Forbidden`, async () => {
        const res = await apiRequest(ep.path(), {
          method: ep.method,
          token: ownerToken,
          body: ep.body,
        });

        assert.strictEqual(res.status, 403, 'Owner role must return HTTP 403');
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.match(data.error?.message, /Forbidden|insufficient permissions/i);
      });

      test(`${ep.name} — Admin access succeeds with expected status code`, async () => {
        const res = await apiRequest(ep.path(), {
          method: ep.method,
          token: admin1Token,
          body: ep.body,
        });

        assert.strictEqual(res.status, 200, 'Admin role must succeed with HTTP 200');
        const data = await res.json();
        assert.strictEqual(data.success, true);
      });
    }
  });

  // =========================================================================
  // 2. MODERATION ANTI-SELF CHECKS & ATOMIC INTEGRITY
  // =========================================================================
  describe('Listing Moderation Anti-Self Protections', () => {
    test('Admin CANNOT approve their own listing (Anti-self-approval returns HTTP 403)', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/approve`, {
        method: 'POST',
        token: admin1Token,
        body: {},
      });

      assert.strictEqual(res.status, 403, 'Must return HTTP 403 when admin approves own listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Administrators cannot approve their own listings/i);

      // Verify database record remains untouched
      const listing = await adminPb.collection('listings').getOne(admin1ListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending');
      assert.strictEqual(listing.rejection_note, '', 'Rejection note must remain unchanged');
    });

    test('Peer Admin CAN approve another admin’s listing', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/approve`, {
        method: 'POST',
        token: admin2Token,
        body: {},
      });

      assert.strictEqual(res.status, 200, 'Peer admin must succeed in approving listing');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.listing?.status, 'approved');

      // Reset to pending for subsequent tests
      await adminPb.collection('listings').update(admin1ListingId, { status: 'pending' });
    });

    test('Admin CANNOT reject their own listing (Anti-self-rejection returns HTTP 403)', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/reject`, {
        method: 'POST',
        token: admin1Token,
        body: { rejection_note: 'Malicious self rejection attempt.' },
      });

      assert.strictEqual(res.status, 403, 'Must return HTTP 403 when admin rejects own listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Administrators cannot reject their own listings/i);

      // Verify database record remains untouched
      const listing = await adminPb.collection('listings').getOne(admin1ListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending');
      assert.strictEqual(listing.rejection_note, '', 'Rejection note must not be modified');
    });

    test('Peer Admin CAN reject another admin’s listing', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/reject`, {
        method: 'POST',
        token: admin2Token,
        body: { rejection_note: 'Peer admin valid rejection reason.' },
      });

      assert.strictEqual(res.status, 200, 'Peer admin must succeed in rejecting listing');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.listing?.status, 'rejected');

      // Reset to pending for subsequent tests
      await adminPb.collection('listings').update(admin1ListingId, {
        status: 'pending',
        rejection_note: '',
      });
    });

    test('Admin CANNOT archive their own listing via moderation endpoint (HTTP 403)', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/archive`, {
        method: 'POST',
        token: admin1Token,
        body: {},
      });

      assert.strictEqual(res.status, 403, 'Must return HTTP 403 when admin archives own listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Administrators cannot archive their own listings/i);

      // Verify database record remains untouched
      const listing = await adminPb.collection('listings').getOne(admin1ListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending');
    });

    test('Peer Admin CAN archive another admin’s listing', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${admin1ListingId}/archive`, {
        method: 'POST',
        token: admin2Token,
        body: {},
      });

      assert.strictEqual(res.status, 200, 'Peer admin must succeed in archiving listing');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.listing?.status, 'archived');
    });

    test('Regular Owner CANNOT approve their own listing via Admin moderation API', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${ownerListingId}/approve`, {
        method: 'POST',
        token: ownerToken,
        body: {},
      });

      assert.strictEqual(res.status, 403, 'Owner cannot access admin approve endpoint');
      const data = await res.json();
      assert.strictEqual(data.success, false);

      const listing = await adminPb.collection('listings').getOne(ownerListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending in DB');
    });

    test('Regular Owner CANNOT reject their own listing via Admin moderation API', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${ownerListingId}/reject`, {
        method: 'POST',
        token: ownerToken,
        body: { rejection_note: 'Owner attempting self-rejection' },
      });

      assert.strictEqual(res.status, 403, 'Owner cannot access admin reject endpoint');
      const data = await res.json();
      assert.strictEqual(data.success, false);

      const listing = await adminPb.collection('listings').getOne(ownerListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending in DB');
    });

    test('Regular Owner CANNOT archive their own listing via Admin moderation API', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${ownerListingId}/archive`, {
        method: 'POST',
        token: ownerToken,
        body: {},
      });

      assert.strictEqual(res.status, 403, 'Owner cannot access admin archive endpoint');
      const data = await res.json();
      assert.strictEqual(data.success, false);

      const listing = await adminPb.collection('listings').getOne(ownerListingId);
      assert.strictEqual(listing.status, 'pending', 'Listing status must remain pending in DB');
    });
  });

  // =========================================================================
  // 3. USER MANAGEMENT ANTI-SELF-DEACTIVATION
  // =========================================================================
  describe('User Management Anti-Self-Deactivation', () => {
    test('Admin CANNOT deactivate their own account (HTTP 403, DB unchanged)', async () => {
      const res = await apiRequest(`/api/v1/admin/users/${admin1Id}/status`, {
        method: 'PATCH',
        token: admin1Token,
        body: { is_active: false },
      });

      assert.strictEqual(res.status, 403, 'Must return HTTP 403 when admin deactivates own account');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Administrators cannot deactivate their own account/i);

      // Verify DB unchanged
      const user = await adminPb.collection('users').getOne(admin1Id);
      assert.strictEqual(user.is_active, true, 'Admin account must remain active');
    });

    test('Peer Admin CAN deactivate another admin account', async () => {
      const res = await apiRequest(`/api/v1/admin/users/${admin2Id}/status`, {
        method: 'PATCH',
        token: admin1Token,
        body: { is_active: false },
      });

      assert.strictEqual(res.status, 200, 'Peer admin can deactivate another admin');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.user?.is_active, false);

      // Reactivate admin2 to preserve test isolation
      await adminPb.collection('users').update(admin2Id, { is_active: true });
    });
  });

  // =========================================================================
  // 4. REQUEST TAMPER-PROOFING & PRIVILEGE ESCALATION PREVENTION
  // =========================================================================
  describe('Tamper-Proofing: Server-Side Role Authority & Injection Immunity', () => {
    test('Customer passing { role: "admin" } in JSON body cannot access admin endpoints', async () => {
      const res = await apiRequest('/api/v1/admin/stats', {
        method: 'GET',
        token: customerToken,
        headers: {
          'X-User-Role': 'admin',
          'X-Role': 'admin',
        },
      });

      assert.strictEqual(res.status, 403, 'Injected headers must not elevate customer to admin');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('Owner passing query param ?role=admin cannot access admin endpoints', async () => {
      const res = await apiRequest('/api/v1/admin/listings/pending?role=admin', {
        method: 'GET',
        token: ownerToken,
      });

      assert.strictEqual(res.status, 403, 'Injected query param ?role=admin must not elevate owner');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('Customer sending state mutation with body tampering receives HTTP 403', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${testListingId}/approve`, {
        method: 'POST',
        token: customerToken,
        body: {
          role: 'admin',
          user: { role: 'admin', id: admin1Id },
          adminUserId: admin1Id,
        },
      });

      assert.strictEqual(res.status, 403, 'Body tampering cannot grant admin approval privileges');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('Malicious client cannot override listing owner or price in approve endpoint body', async () => {
      const res = await apiRequest(`/api/v1/admin/listings/${testListingId}/approve`, {
        method: 'POST',
        token: admin1Token,
        body: {
          owner: customerId,
          price: 1,
          status: 'rejected',
        },
      });

      assert.strictEqual(res.status, 200);
      const listing = await adminPb.collection('listings').getOne(testListingId);
      assert.strictEqual(listing.owner, ownerId, 'Owner ID must not be overwritten by body');
      assert.strictEqual(listing.price, 50000, 'Price must not be modified by body');
      assert.strictEqual(listing.status, 'approved', 'Status must be set by server moderation');
    });

    test('Malicious client cannot inject arbitrary fields into user status PATCH', async () => {
      const res = await apiRequest(`/api/v1/admin/users/${ownerId}/status`, {
        method: 'PATCH',
        token: admin1Token,
        body: {
          is_active: true,
          role: 'admin', // attempting privilege escalation
          email: 'hacked@shopfinder.local', // attempting account takeover
        },
      });

      // Zod .strict() rejects extra fields with HTTP 400
      assert.strictEqual(res.status, 400, 'Extra/tampered fields must be rejected by validator');
      const data = await res.json();
      assert.strictEqual(data.success, false);

      // Verify DB record remained untouched
      const owner = await adminPb.collection('users').getOne(ownerId);
      assert.strictEqual(owner.role, 'owner', 'Role must remain owner');
      assert.strictEqual(owner.email, ownerEmail, 'Email must remain unchanged');
    });
  });
});
