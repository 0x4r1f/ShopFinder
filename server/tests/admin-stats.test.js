import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

describe('Phase 7, Task 7.1 — Admin Statistics API (GET /api/v1/admin/stats)', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let adminEmail;
  let ownerEmail;
  let customerEmail;

  let adminId;
  let ownerId;
  let customerId;

  let adminToken;
  let ownerToken;
  let customerToken;

  const createdUserIds = [];
  const createdListingIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Admin User
    adminEmail = `adm_stat_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin User ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 2. Create Owner User
    ownerEmail = `own_stat_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner User ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 3. Create Customer User
    customerEmail = `cust_stat_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer User ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 4. Authenticate users to acquire JWT tokens for pb_auth cookie
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    // 5. Create known listings across different statuses
    const pendingListing = await adminPb.collection('listings').create({
      title: `Pending Shop ${testRunId}`,
      description: 'Pending commercial property awaiting admin approval.',
      category: 'retail',
      listing_type: 'rent',
      price: 45000,
      area_sqft: 850,
      address: '123 Gulshan Avenue',
      city: 'Dhaka',
      area: 'Gulshan 2',
      owner: ownerId,
      status: 'pending',
    });
    createdListingIds.push(pendingListing.id);

    const approvedListing = await adminPb.collection('listings').create({
      title: `Approved Office ${testRunId}`,
      description: 'Approved corporate commercial office space.',
      category: 'office',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 2400,
      address: '45 Banani Commercial Area',
      city: 'Dhaka',
      area: 'Banani',
      owner: ownerId,
      status: 'approved',
    });
    createdListingIds.push(approvedListing.id);

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      const pb = await getAdminClient();
      for (const id of createdListingIds) {
        try {
          await pb.collection('listings').delete(id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await pb.collection('users').delete(id);
        } catch {}
      }
    } catch {}
  });

  // =========================================================================
  // 1. Role Authorization
  // =========================================================================

  test('1. Unauthenticated request to GET /api/v1/admin/stats returns HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('2. Customer request to GET /api/v1/admin/stats returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: {
        Cookie: `pb_auth=${customerToken}`,
      },
    });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('3. Owner request to GET /api/v1/admin/stats returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: {
        Cookie: `pb_auth=${ownerToken}`,
      },
    });
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('4. Admin request to GET /api/v1/admin/stats returns HTTP 200 with structured data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data, 'Must return data object');
  });

  // =========================================================================
  // 2. Metrics & Data Accuracy
  // =========================================================================

  test('5. Total listings count includes all listing statuses and is accurate', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Cookie: `pb_auth=${adminToken}` },
    });
    const json = await res.json();
    const stats = json.data;

    // Verify against direct PocketBase count
    const pbListings = await adminPb.collection('listings').getList(1, 1);
    assert.equal(typeof stats.totalListings, 'number');
    assert.equal(stats.totalListings, pbListings.totalItems);
    assert.ok(stats.totalListings >= 2, 'Should include at least our 2 created listings');
  });

  test('6. Pending listings count matches strictly pending listings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Cookie: `pb_auth=${adminToken}` },
    });
    const json = await res.json();
    const stats = json.data;

    const pbPending = await adminPb.collection('listings').getList(1, 1, {
      filter: 'status = "pending"',
    });
    assert.equal(typeof stats.pendingListings, 'number');
    assert.equal(stats.pendingListings, pbPending.totalItems);
    assert.ok(stats.pendingListings >= 1, 'Should include our created pending listing');
    assert.ok(stats.pendingListings <= stats.totalListings, 'Pending count cannot exceed total listings');
  });

  test('7. Total users and users by role are correctly broken down', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Cookie: `pb_auth=${adminToken}` },
    });
    const json = await res.json();
    const stats = json.data;

    const pbUsers = await adminPb.collection('users').getList(1, 1);
    assert.equal(stats.totalUsers, pbUsers.totalItems);

    const pbCust = await adminPb.collection('users').getList(1, 1, { filter: 'role = "customer"' });
    const pbOwn = await adminPb.collection('users').getList(1, 1, { filter: 'role = "owner"' });
    const pbAdm = await adminPb.collection('users').getList(1, 1, { filter: 'role = "admin"' });

    assert.equal(stats.usersByRole.customers, pbCust.totalItems);
    assert.equal(stats.usersByRole.owners, pbOwn.totalItems);
    assert.equal(stats.usersByRole.admins, pbAdm.totalItems);

    const sumRoles = stats.usersByRole.customers + stats.usersByRole.owners + stats.usersByRole.admins;
    assert.equal(sumRoles, stats.totalUsers, 'Sum of role counts must equal totalUsers');
  });

  // =========================================================================
  // 3. Recent Platform Activity
  // =========================================================================

  test('8. Recent activity returns actual database records sorted newest first', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Cookie: `pb_auth=${adminToken}` },
    });
    const json = await res.json();
    const activity = json.data.recentActivity;

    assert.ok(Array.isArray(activity), 'recentActivity must be an array');
    assert.ok(activity.length > 0, 'recentActivity should contain recent items');
    assert.ok(activity.length <= 10, 'recentActivity must be capped at 10 items');

    // Verify chronological ordering (newest first)
    for (let i = 0; i < activity.length - 1; i++) {
      const current = new Date(activity[i].timestamp).getTime();
      const next = new Date(activity[i + 1].timestamp).getTime();
      assert.ok(current >= next, `Activity items must be ordered newest first (item ${i} vs ${i + 1})`);
    }

    // Verify item shapes
    const firstItem = activity[0];
    assert.ok(firstItem.id, 'Item must have an id');
    assert.ok(['listing_submission', 'user_registration'].includes(firstItem.type));
    assert.ok(firstItem.recordId, 'Item must have recordId');
    assert.ok(firstItem.title, 'Item must have title');
    assert.ok(firstItem.timestamp, 'Item must have timestamp');
  });

  test('9. Sensitive fields are never exposed in statistics or activity payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Cookie: `pb_auth=${adminToken}` },
    });
    const text = await res.text();

    assert.ok(!text.includes('Password123!'), 'No passwords in response');
    assert.ok(!text.includes('tokenKey'), 'No token keys in response');
    assert.ok(!text.includes('rejection_note'), 'No rejection notes in response');
    assert.ok(!text.includes('owner_contacts'), 'No owner_contacts in response');
  });
});

