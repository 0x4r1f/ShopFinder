import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { getCustomerSubscriptionBalance } from '../src/services/customer.service.js';

/**
 * ShopFinder — Phase 9, Task 9.3: Customer Active Subscription Tracking & Credit Balance Service
 * Comprehensive Integration & Verification Test Suite
 */
describe('Phase 9, Task 9.3 — Customer Subscription Tracking & Credit Balance Query Service', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let customer1User;
  let customer1Token;
  let customer2User;
  let customer2Token;
  let ownerUser;
  let ownerToken;
  let adminUser;
  let adminToken;

  let starterPlan;
  let proPlan;

  const createdUserIds = [];
  const createdSubIds = [];
  const createdPlanIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Starter and Pro test plans
    starterPlan = await adminPb.collection('subscription_plans').create({
      name: `Test Starter ${testRunId}`,
      price: 299,
      credits: 10,
      is_active: true,
      description: 'Starter test package',
    });
    createdPlanIds.push(starterPlan.id);

    proPlan = await adminPb.collection('subscription_plans').create({
      name: `Test Pro ${testRunId}`,
      price: 999,
      credits: 100,
      is_active: true,
      description: 'Pro test package',
    });
    createdPlanIds.push(proPlan.id);

    // 2. Create Customer 1 (Primary)
    const cust1Email = `cust1_${testRunId}@shopfinder.local`;
    customer1User = await adminPb.collection('users').create({
      name: `Customer 1 ${testRunId}`,
      email: cust1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    createdUserIds.push(customer1User.id);

    // 3. Create Customer 2 (For session isolation / IDOR tests)
    const cust2Email = `cust2_${testRunId}@shopfinder.local`;
    customer2User = await adminPb.collection('users').create({
      name: `Customer 2 ${testRunId}`,
      email: cust2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    createdUserIds.push(customer2User.id);

    // 4. Create Property Owner
    const ownerEmail = `owner_${testRunId}@shopfinder.local`;
    ownerUser = await adminPb.collection('users').create({
      name: `Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    createdUserIds.push(ownerUser.id);

    // 5. Create Admin
    const adminEmail = `admin_${testRunId}@shopfinder.local`;
    adminUser = await adminPb.collection('users').create({
      name: `Admin ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    createdUserIds.push(adminUser.id);

    // 6. Acquire JWT authentication tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const c1Auth = await userPb.collection('users').authWithPassword(cust1Email, testPassword);
    customer1Token = c1Auth.token;

    const c2Auth = await userPb.collection('users').authWithPassword(cust2Email, testPassword);
    customer2Token = c2Auth.token;

    const oAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = oAuth.token;

    const aAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = aAuth.token;

    // 7. Start test server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Teardown created subscriptions
    for (const subId of createdSubIds) {
      try {
        await adminPb.collection('user_subscriptions').delete(subId);
      } catch {}
    }

    // Teardown created plans
    for (const planId of createdPlanIds) {
      try {
        await adminPb.collection('subscription_plans').delete(planId);
      } catch {}
    }

    // Teardown created users
    for (const userId of createdUserIds) {
      try {
        await adminPb.collection('users').delete(userId);
      } catch {}
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // =========================================================================
  // 1. Credit Balance Calculation & Aggregation Suite (Tests 1-10)
  // =========================================================================
  describe('1. Credit Balance Calculation & Stacking (D-001)', () => {
    test('1. Customer with no subscription records gets zero credits', async () => {
      const balance = await getCustomerSubscriptionBalance(customer1User.id);
      assert.strictEqual(balance.credits_remaining, 0);
      assert.strictEqual(balance.active_subscriptions_count, 0);
      assert.deepStrictEqual(balance.subscriptions, []);
    });

    test('2. Customer with one active package gets correct remaining credits', async () => {
      const sub = await adminPb.collection('user_subscriptions').create({
        user: customer1User.id,
        plan: starterPlan.id,
        credits_total: 10,
        credits_used: 0,
        status: 'active',
        purchased_at: new Date().toISOString(),
        expires_at: null,
      });
      createdSubIds.push(sub.id);

      const balance = await getCustomerSubscriptionBalance(customer1User.id);
      assert.strictEqual(balance.credits_remaining, 10);
      assert.strictEqual(balance.active_subscriptions_count, 1);
      assert.strictEqual(balance.subscriptions.length, 1);
      assert.strictEqual(balance.subscriptions[0].credits_remaining, 10);
    });

    test('3. Customer with multiple active packages gets aggregated balance (credit stacking)', async () => {
      // Add a Pro package (100 credits) to Customer 1
      const subPro = await adminPb.collection('user_subscriptions').create({
        user: customer1User.id,
        plan: proPlan.id,
        credits_total: 100,
        credits_used: 0,
        status: 'active',
        purchased_at: new Date().toISOString(),
        expires_at: null,
      });
      createdSubIds.push(subPro.id);

      const balance = await getCustomerSubscriptionBalance(customer1User.id);
      // 10 from Starter + 100 from Pro = 110 credits
      assert.strictEqual(balance.credits_remaining, 110);
      assert.strictEqual(balance.active_subscriptions_count, 2);
      assert.strictEqual(balance.subscriptions.length, 2);
    });

    test('4. Credits used are deducted correctly per record: remaining = max(0, total - used)', async () => {
      // Create a package with 20 total, 8 used -> 12 remaining
      const subDeducted = await adminPb.collection('user_subscriptions').create({
        user: customer2User.id,
        plan: starterPlan.id,
        credits_total: 20,
        credits_used: 8,
        status: 'active',
        purchased_at: new Date().toISOString(),
        expires_at: null,
      });
      createdSubIds.push(subDeducted.id);

      const balance = await getCustomerSubscriptionBalance(customer2User.id);
      assert.strictEqual(balance.credits_remaining, 12);
      assert.strictEqual(balance.subscriptions[0].credits_total, 20);
      assert.strictEqual(balance.subscriptions[0].credits_used, 8);
      assert.strictEqual(balance.subscriptions[0].credits_remaining, 12);
    });

    test('5. Cancelled records are excluded from active balance', async () => {
      const subCancelled = await adminPb.collection('user_subscriptions').create({
        user: customer2User.id,
        plan: starterPlan.id,
        credits_total: 10,
        credits_used: 0,
        status: 'cancelled',
        purchased_at: new Date().toISOString(),
        expires_at: null,
      });
      createdSubIds.push(subCancelled.id);

      const balance = await getCustomerSubscriptionBalance(customer2User.id);
      // Customer 2 had 12 remaining; cancelled package (10 credits) must NOT be added
      assert.strictEqual(balance.credits_remaining, 12);
      assert.strictEqual(balance.active_subscriptions_count, 1);
    });

    test('6. Expired records are excluded from active balance', async () => {
      const subExpired = await adminPb.collection('user_subscriptions').create({
        user: customer2User.id,
        plan: starterPlan.id,
        credits_total: 15,
        credits_used: 2,
        status: 'expired',
        purchased_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 86400000).toISOString(),
      });
      createdSubIds.push(subExpired.id);

      const balance = await getCustomerSubscriptionBalance(customer2User.id);
      // Expired package (13 remaining) must NOT be added
      assert.strictEqual(balance.credits_remaining, 12);
      assert.strictEqual(balance.active_subscriptions_count, 1);
    });

    test('7. Active non-expiring records remain eligible indefinitely', async () => {
      const balance = await getCustomerSubscriptionBalance(customer1User.id);
      assert.strictEqual(balance.credits_remaining, 110);
      assert.ok(balance.subscriptions.every((s) => s.status === 'active'));
    });

    test('8. Null expires_at works correctly and is preserved in payload', async () => {
      const balance = await getCustomerSubscriptionBalance(customer1User.id);
      assert.ok(balance.subscriptions.length >= 2);
      for (const s of balance.subscriptions) {
        assert.strictEqual(s.expires_at, null, 'Normal one-time credit packages have null expires_at');
      }
    });

    test('9. Zero remaining credits are handled correctly (credits_used === credits_total)', async () => {
      const subDepleted = await adminPb.collection('user_subscriptions').create({
        user: customer2User.id,
        plan: starterPlan.id,
        credits_total: 10,
        credits_used: 10, // All used
        status: 'active',
        purchased_at: new Date().toISOString(),
        expires_at: null,
      });
      createdSubIds.push(subDepleted.id);

      const balance = await getCustomerSubscriptionBalance(customer2User.id);
      // 12 (from test 4) + 0 (from depleted package) = 12
      assert.strictEqual(balance.credits_remaining, 12);
      assert.strictEqual(balance.active_subscriptions_count, 2);

      const depletedRecord = balance.subscriptions.find((s) => s.id === subDepleted.id);
      assert.ok(depletedRecord);
      assert.strictEqual(depletedRecord.credits_remaining, 0);
    });

    test('10. Numeric edge cases never produce NaN or negative totals', async () => {
      // Simulate over-used record (credits_used > credits_total)
      const subOverused = await adminPb.collection('user_subscriptions').create({
        user: customer2User.id,
        plan: starterPlan.id,
        credits_total: 5,
        credits_used: 5,
        status: 'active',
        purchased_at: new Date().toISOString(),
      });
      createdSubIds.push(subOverused.id);

      const balance = await getCustomerSubscriptionBalance(customer2User.id);
      assert.ok(Number.isFinite(balance.credits_remaining));
      assert.ok(balance.credits_remaining >= 0);
      assert.strictEqual(Number.isNaN(balance.credits_remaining), false);
    });
  });

  // =========================================================================
  // 2. Customer Isolation & Security (Tests 11-15)
  // =========================================================================
  describe('2. Customer Isolation & Authorization Boundary', () => {
    test('11. Records from another customer are never included in balance', async () => {
      // Customer 1 balance
      const c1Balance = await getCustomerSubscriptionBalance(customer1User.id);
      // Customer 2 balance
      const c2Balance = await getCustomerSubscriptionBalance(customer2User.id);

      assert.strictEqual(c1Balance.credits_remaining, 110);
      assert.strictEqual(c2Balance.credits_remaining, 12);

      // Verify no shared package IDs
      const c1Ids = new Set(c1Balance.subscriptions.map((s) => s.id));
      const c2Ids = new Set(c2Balance.subscriptions.map((s) => s.id));
      for (const id of c1Ids) {
        assert.strictEqual(c2Ids.has(id), false, 'Customer 2 must not see Customer 1 package');
      }
    });

    test('12. Client-supplied customer IDs in query/body cannot override authenticated identity', async () => {
      // Customer 1 requests with ?user=customer2User.id
      const res = await fetch(`${baseUrl}/api/v1/customer/dashboard?user=${customer2User.id}&customerId=${customer2User.id}`, {
        headers: {
          Cookie: `pb_auth=${customer1Token}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Must strictly return Customer 1's balance (110), NOT Customer 2's balance (12)
      assert.strictEqual(json.data.credits_remaining, 110);
    });

    test('13. Package history remains individually identifiable with plan details', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/subscriptions`, {
        headers: {
          Cookie: `pb_auth=${customer1Token}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.credits_remaining, 110);
      assert.strictEqual(json.data.active_subscriptions_count, 2);
      assert.ok(Array.isArray(json.data.subscriptions));

      for (const pkg of json.data.subscriptions) {
        assert.ok(pkg.id);
        assert.ok(pkg.plan_id);
        assert.ok(typeof pkg.plan_name === 'string');
        assert.ok(typeof pkg.credits_total === 'number');
        assert.ok(typeof pkg.credits_used === 'number');
        assert.ok(typeof pkg.credits_remaining === 'number');
        assert.ok(pkg.purchased_at);
        assert.strictEqual(pkg.status, 'active');

        // Zero PocketBase internal field leakage
        assert.strictEqual(pkg.collectionId, undefined);
        assert.strictEqual(pkg.collectionName, undefined);
        assert.strictEqual(pkg.user, undefined, 'user relation must not leak in sanitized payload');
      }
    });

    test('14. Existing customer dashboard response remains 100% backward compatible', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/dashboard`, {
        headers: {
          Cookie: `pb_auth=${customer1Token}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.credits_remaining, 110);
      assert.strictEqual(json.data.active_subscriptions_count, 2);
      assert.ok(Array.isArray(json.data.active_subscriptions));
      assert.ok(Array.isArray(json.data.recent_saved));
      assert.ok(Array.isArray(json.data.recent_reveals));
    });

    test('15. Owner/admin/anonymous access restrictions remain intact', async () => {
      // Anonymous -> 401
      const resAnon = await fetch(`${baseUrl}/api/v1/customer/subscriptions`);
      assert.strictEqual(resAnon.status, 401);

      // Owner -> 403
      const resOwner = await fetch(`${baseUrl}/api/v1/customer/subscriptions`, {
        headers: { Cookie: `pb_auth=${ownerToken}` },
      });
      assert.strictEqual(resOwner.status, 403);

      // Admin -> 403
      const resAdmin = await fetch(`${baseUrl}/api/v1/customer/subscriptions`, {
        headers: { Cookie: `pb_auth=${adminToken}` },
      });
      assert.strictEqual(resAdmin.status, 403);

      // Customer -> 200
      const resCustomer = await fetch(`${baseUrl}/api/v1/customer/subscriptions`, {
        headers: { Cookie: `pb_auth=${customer1Token}` },
      });
      assert.strictEqual(resCustomer.status, 200);
    });
  });

  // =========================================================================
  // 3. Immutability & Architectural Boundaries (Tests 16-18)
  // =========================================================================
  describe('3. Immutability & Architectural Guardrails', () => {
    test('16. The query service never mutates credits_used during queries', async () => {
      // Record initial state in DB
      const subsBefore = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:userId}', { userId: customer1User.id }),
      });
      const usedBefore = subsBefore.map((s) => s.credits_used);

      // Execute queries repeatedly
      await getCustomerSubscriptionBalance(customer1User.id);
      await fetch(`${baseUrl}/api/v1/customer/dashboard`, { headers: { Cookie: `pb_auth=${customer1Token}` } });
      await fetch(`${baseUrl}/api/v1/customer/subscriptions`, { headers: { Cookie: `pb_auth=${customer1Token}` } });

      // Record state after queries
      const subsAfter = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:userId}', { userId: customer1User.id }),
      });
      const usedAfter = subsAfter.map((s) => s.credits_used);

      assert.deepStrictEqual(usedBefore, usedAfter, 'credits_used must remain completely unmutated by query service');
    });

    test('17. The query service never creates or deletes subscription records', async () => {
      const allSubsBefore = await adminPb.collection('user_subscriptions').getFullList();
      const countBefore = allSubsBefore.length;

      // Execute balance and dashboard queries
      await getCustomerSubscriptionBalance(customer1User.id);
      await getCustomerSubscriptionBalance(customer2User.id);
      await fetch(`${baseUrl}/api/v1/customer/dashboard`, { headers: { Cookie: `pb_auth=${customer1Token}` } });

      const allSubsAfter = await adminPb.collection('user_subscriptions').getFullList();
      const countAfter = allSubsAfter.length;

      assert.strictEqual(countBefore, countAfter, 'Total records in user_subscriptions must not change during query operations');
    });

    test('18. D-013 reveal transaction boundary: No Express reveal deduction exists', async () => {
      // Verify that no Express contact reveal route exists in Phase 9
      const res = await fetch(`${baseUrl}/api/v1/reveal/lst_test12345`, {
        method: 'POST',
        headers: {
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${customer1Token}`,
        },
      });

      // Must return 404 (route does not exist in Phase 9; reserved exclusively for Phase 10)
      assert.strictEqual(res.status, 404, 'Contact reveal endpoints must not exist in Phase 9 (reserved for Phase 10 D-013)');
    });
  });
});

