import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

describe('Phase 12, Task 12.2 — Admin Analytics API (GET /api/v1/admin/analytics)', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const testPassword = 'Password123!';

  let adminEmail;
  let ownerEmail;
  let customerEmail;

  let adminId;
  let ownerId;
  let customerId;

  let adminCookie;
  let ownerCookie;
  let customerCookie;

  const createdUserIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Admin User
    adminEmail = `adm_analytics_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin Analytics ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
      is_active: true,
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 2. Create Owner User
    ownerEmail = `own_analytics_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner Analytics ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
      is_active: true,
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 3. Create Customer User
    customerEmail = `cust_analytics_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer Analytics ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
      is_active: true,
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 4. Authenticate users to acquire JWT tokens for pb_auth cookie
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminCookie = `pb_auth=${adminAuth.token}`;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerCookie = `pb_auth=${ownerAuth.token}`;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerCookie = `pb_auth=${custAuth.token}`;

    // 5. Start Express HTTP server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Teardown HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Cleanup created users
    for (const uid of createdUserIds) {
      try {
        await adminPb.collection('users').delete(uid);
      } catch {
        // ignore teardown errors
      }
    }
  });

  describe('Role-Based Access Control (RBAC)', () => {
    test('Anonymous request returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`);
      const body = await res.json();

      assert.equal(res.status, 401);
      assert.equal(body.success, false);
      assert.ok(body.error);
    });

    test('Customer role returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: customerCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 403);
      assert.equal(body.success, false);
      assert.ok(body.error);
    });

    test('Owner role returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: ownerCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 403);
      assert.equal(body.success, false);
      assert.ok(body.error);
    });

    test('Admin role returns HTTP 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.message, 'Admin platform analytics retrieved successfully');
      assert.ok(body.data);
    });
  });

  describe('Timeframe Presets & Query Parameter Handling (D-019)', () => {
    test('Defaults to period=30d when period query param is omitted', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.period, '30d');
      assert.equal(body.data.timeframe.days, 30);
      assert.equal(body.data.userGrowth.timeline.length, 30);
      assert.equal(body.data.revenue.timeline.length, 30);
      assert.equal(body.data.creditConsumption.timeline.length, 30);
    });

    test('Accepts explicit period=7d and returns 7-day timelines', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics?period=7d`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.period, '7d');
      assert.equal(body.data.timeframe.days, 7);
      assert.equal(body.data.userGrowth.timeline.length, 7);
      assert.equal(body.data.revenue.timeline.length, 7);
      assert.equal(body.data.creditConsumption.timeline.length, 7);
    });

    test('Accepts explicit period=30d and returns 30-day timelines', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics?period=30d`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.period, '30d');
      assert.equal(body.data.timeframe.days, 30);
      assert.equal(body.data.userGrowth.timeline.length, 30);
    });

    test('Accepts explicit period=90d and returns 90-day timelines', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics?period=90d`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.data.period, '90d');
      assert.equal(body.data.timeframe.days, 90);
      assert.equal(body.data.userGrowth.timeline.length, 90);
    });

    test('Rejects invalid period with HTTP 400 and clear error message', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics?period=14d`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      const errMsg = body.error?.message || body.error;
      assert.ok(errMsg.includes("Supported periods: '7d', '30d', '90d'"));
    });
  });

  describe('Metric Semantics & Separation of Lifetime vs Period Metrics (D-019, D-020)', () => {
    test('Response clearly distinguishes lifetime totals from period-specific metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics?period=7d`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      const { summary, userGrowth, revenue, creditConsumption, listingVolume } = body.data;

      // 1. Summary separation
      assert.ok(summary.lifetime);
      assert.ok(summary.period);
      assert.ok(typeof summary.lifetime.grossRevenueBdt === 'number');
      assert.ok(typeof summary.lifetime.totalUsers === 'number');
      assert.ok(typeof summary.period.revenueBdt === 'number');
      assert.ok(typeof summary.period.newUsers === 'number');

      // 2. User growth separation
      assert.ok(userGrowth.totals.all >= userGrowth.periodNewUsers);
      assert.ok(typeof userGrowth.totals.customers === 'number');
      assert.ok(typeof userGrowth.totals.owners === 'number');
      assert.ok(typeof userGrowth.totals.admins === 'number');
      assert.ok(typeof userGrowth.totals.active === 'number');
      assert.ok(typeof userGrowth.totals.deactivated === 'number');

      // 3. Revenue separation
      assert.ok(revenue.lifetimeRevenueBdt >= revenue.periodRevenueBdt);
      assert.ok(typeof revenue.successfulTransactions === 'number');
      assert.ok(typeof revenue.pendingTransactions === 'number');
      assert.ok(typeof revenue.failedTransactions === 'number');
      assert.ok(typeof revenue.successRate === 'number');

      // 4. Credit consumption separation
      assert.ok(typeof creditConsumption.totalCreditsPurchased === 'number');
      assert.ok(typeof creditConsumption.totalCreditsConsumed === 'number');
      assert.ok(typeof creditConsumption.totalCreditsRemaining === 'number');
      assert.ok(typeof creditConsumption.utilizationRate === 'number');
      assert.ok(typeof creditConsumption.periodRevealsCount === 'number');

      // 5. Listing volume active inventory vs moderation status
      assert.ok(typeof listingVolume.totalActive === 'number');
      assert.ok(Array.isArray(listingVolume.byCity));
      assert.ok(Array.isArray(listingVolume.byCategory));
      assert.ok(listingVolume.byType.rent);
      assert.ok(listingVolume.byType.sale);
      assert.ok(listingVolume.moderationStatus);
      assert.ok(typeof listingVolume.moderationStatus.approved === 'number');
      assert.ok(typeof listingVolume.moderationStatus.pending === 'number');
      assert.ok(typeof listingVolume.moderationStatus.rejected === 'number');
      assert.ok(typeof listingVolume.moderationStatus.archived === 'number');
    });

    test('Listing creation dates are never represented as approval timestamps', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      // Ensure response contains no fabricated "approvalTimeline" or "approved_at" fields
      const rawJson = JSON.stringify(body.data);
      assert.equal(rawJson.includes('approvalTimeline'), false);
      assert.equal(rawJson.includes('approval_trends'), false);
      assert.equal(rawJson.includes('approved_at'), false);
    });
  });

  describe('Privacy & Data Protection Audit (D-014, D-010)', () => {
    test('Response does not leak phone numbers, emails, passwords, tokens, or personal identities', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      const rawJson = JSON.stringify(body);

      // Verify no passwords, hashes, tokens, or phone numbers are exposed
      assert.equal(rawJson.includes('password'), false);
      assert.equal(rawJson.includes('tokenKey'), false);
      assert.equal(rawJson.includes('owner_contacts'), false);
      assert.equal(rawJson.includes(adminEmail), false);
      assert.equal(rawJson.includes(ownerEmail), false);
      assert.equal(rawJson.includes(customerEmail), false);
    });
  });

  describe('Regression: Existing Admin Routes Remain Functional', () => {
    test('GET /api/v1/admin/stats continues to function normally', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(body.data.totalListings !== undefined);
      assert.ok(body.data.totalUsers !== undefined);
    });

    test('GET /api/v1/admin/listings/pending continues to function normally', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`, {
        headers: { Cookie: adminCookie },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.listings));
      assert.ok(body.data.pagination !== undefined);
    });
  });
});
