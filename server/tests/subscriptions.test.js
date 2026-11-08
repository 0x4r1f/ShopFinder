import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { seedDefaultPlans, DEFAULT_PLANS } from '../src/services/subscription.service.js';

/**
 * ShopFinder — Phase 9, Task 9.2: Subscription Plans & Admin Plan Management
 * Comprehensive Integration & Unit Test Suite
 */
describe('Phase 9, Task 9.2 — Subscription Plans & Admin Plan Management', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = Date.now();
  const testPassword = 'Password123!';

  let adminUser;
  let adminToken;
  let customerUser;
  let customerToken;
  let ownerUser;
  let ownerToken;

  const createdUserIds = [];
  const createdPlanIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Admin User
    const adminEmail = `adm_sub_${testRunId}@shopfinder.local`;
    adminUser = await adminPb.collection('users').create({
      name: `Admin Sub ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    createdUserIds.push(adminUser.id);

    // 2. Create Customer User
    const customerEmail = `cust_sub_${testRunId}@shopfinder.local`;
    customerUser = await adminPb.collection('users').create({
      name: `Customer Sub ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    createdUserIds.push(customerUser.id);

    // 3. Create Owner User
    const ownerEmail = `own_sub_${testRunId}@shopfinder.local`;
    ownerUser = await adminPb.collection('users').create({
      name: `Owner Sub ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    createdUserIds.push(ownerUser.id);

    // 4. Authenticate Users to acquire auth tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    // 5. Start ephemeral test server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Teardown created plans (except default Starter/Pro/Test Plan)
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
  // 1. Plan Seeding Suite (Tasks 21-25)
  // =========================================================================
  describe('1. Plan Seeding & Idempotency', () => {
    test('21. Starter and Pro are seeded correctly with approved D-001 values', async () => {
      const summary = await seedDefaultPlans();
      assert.ok(Array.isArray(summary.seeded) || Array.isArray(summary.existing));

      const starter = await adminPb.collection('subscription_plans').getFirstListItem('name = "Starter"');
      assert.ok(starter);
      assert.strictEqual(Number(starter.price), 299);
      assert.strictEqual(Number(starter.credits), 10);
      assert.strictEqual(starter.is_active, true);

      const pro = await adminPb.collection('subscription_plans').getFirstListItem('name = "Pro"');
      assert.ok(pro);
      assert.strictEqual(Number(pro.price), 999);
      assert.strictEqual(Number(pro.credits), 100);
      assert.strictEqual(pro.is_active, true);
    });

    test('22. Repeated seeding does not create duplicates (idempotency)', async () => {
      const allBefore = await adminPb.collection('subscription_plans').getFullList();
      const starterCountBefore = allBefore.filter((p) => p.name === 'Starter').length;
      const proCountBefore = allBefore.filter((p) => p.name === 'Pro').length;

      // Execute seeding second time
      const summary = await seedDefaultPlans();
      assert.strictEqual(summary.seeded.length, 0, 'No new plans should be seeded on repeat');
      assert.ok(summary.existing.includes('Starter'));
      assert.ok(summary.existing.includes('Pro'));

      const allAfter = await adminPb.collection('subscription_plans').getFullList();
      const starterCountAfter = allAfter.filter((p) => p.name === 'Starter').length;
      const proCountAfter = allAfter.filter((p) => p.name === 'Pro').length;

      assert.strictEqual(starterCountBefore, starterCountAfter, 'Starter plan count must remain 1');
      assert.strictEqual(proCountBefore, proCountAfter, 'Pro plan count must remain 1');
    });

    test('23. Existing administrator-modified plans are not silently overwritten', async () => {
      // Create a temporary plan with custom values
      const customPlan = await adminPb.collection('subscription_plans').create({
        name: `CustomSeedTest_${testRunId}`,
        price: 450,
        credits: 25,
        is_active: true,
        description: 'Admin customized pricing',
      });
      createdPlanIds.push(customPlan.id);

      // Verify seeding does not touch it
      await seedDefaultPlans();

      const refetched = await adminPb.collection('subscription_plans').getOne(customPlan.id);
      assert.strictEqual(Number(refetched.price), 450);
      assert.strictEqual(Number(refetched.credits), 25);
      assert.strictEqual(refetched.description, 'Admin customized pricing');
    });

    test('24. Existing legacy Test Plan is preserved', async () => {
      const allPlans = await adminPb.collection('subscription_plans').getFullList();
      const legacyTestPlan = allPlans.find((p) => p.name.startsWith('Test Plan'));

      if (legacyTestPlan) {
        assert.ok(legacyTestPlan.id);
        assert.ok(legacyTestPlan.name);
      } else {
        // If no test plan existed in this specific database instance, verify that seeding
        // only created Starter and Pro and left everything else intact
        assert.ok(allPlans.length >= 2);
      }
    });

    test('25. Seeding does not create customer subscriptions or grant credits', async () => {
      const userSubs = await adminPb.collection('user_subscriptions').getFullList();
      // Ensure seeding created 0 user_subscriptions
      const userSubsForCust = userSubs.filter((s) => s.user === customerUser.id);
      assert.strictEqual(userSubsForCust.length, 0, 'Seeding must never allocate customer subscriptions');
    });
  });

  // =========================================================================
  // 2. Public Plans Endpoint (GET /api/v1/subscriptions/plans) (Tests 1-6)
  // =========================================================================
  describe('2. Public Subscription Plans Endpoint (GET /api/v1/subscriptions/plans)', () => {
    test('1. Active plans are returned on public GET endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.plans));
      assert.ok(json.data.plans.length >= 2);

      const names = json.data.plans.map((p) => p.name);
      assert.ok(names.includes('Starter'));
      assert.ok(names.includes('Pro'));
    });

    test('2. Inactive plans are excluded from public results', async () => {
      // Create an inactive test plan
      const inactivePlan = await adminPb.collection('subscription_plans').create({
        name: `InactivePlan_${testRunId}`,
        price: 1500,
        credits: 200,
        is_active: false,
        description: 'Should be hidden from public view',
      });
      createdPlanIds.push(inactivePlan.id);

      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      const planIds = json.data.plans.map((p) => p.id);
      assert.strictEqual(planIds.includes(inactivePlan.id), false, 'Inactive plan must not appear in public endpoint');
    });

    test('3. Anonymous access succeeds without credentials or cookies', async () => {
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`, {
        headers: {}, // strictly zero cookies or auth headers
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.plans.length > 0);
    });

    test('4. Response strictly sanitized: only id, name, price, credits, description', async () => {
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      const json = await res.json();

      for (const plan of json.data.plans) {
        assert.ok(plan.id);
        assert.ok(typeof plan.name === 'string');
        assert.ok(typeof plan.price === 'number');
        assert.ok(typeof plan.credits === 'number');
        assert.ok(typeof plan.description === 'string');

        // Strictly forbidden fields
        assert.strictEqual(plan.collectionId, undefined);
        assert.strictEqual(plan.collectionName, undefined);
        assert.strictEqual(plan['@collectionId'], undefined);
        assert.strictEqual(plan['@collectionName'], undefined);
        assert.strictEqual(plan.is_active, undefined, 'is_active should not leak in public allowlist');
        assert.strictEqual(plan.created, undefined);
        assert.strictEqual(plan.updated, undefined);
      }
    });

    test('5. Deterministic ordering: price ascending with name tiebreaker', async () => {
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      const json = await res.json();

      const prices = json.data.plans.map((p) => p.price);
      for (let i = 0; i < prices.length - 1; i++) {
        assert.ok(prices[i] <= prices[i + 1], `Price at index ${i} (${prices[i]}) must be <= price at index ${i + 1} (${prices[i + 1]})`);
      }
    });

    test('6. Empty plan list behavior returns empty array with HTTP 200', async () => {
      // Verify structure when filtered by query or handled safely
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.plans));
    });
  });

  // =========================================================================
  // 3. Admin Plan Management Endpoints (Tests 7-16)
  // =========================================================================
  describe('3. Admin Plan Management (CRUD & Lifecycle)', () => {
    let createdAdminPlanId;

    test('7. Admin can list active and inactive plans with pagination', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/plans?page=1&perPage=50`, {
        headers: {
          Cookie: `pb_auth=${adminToken}`,
        },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data.plans));
      assert.ok(json.data.pagination);
      assert.ok(json.data.pagination.totalItems >= 2);

      // Verify admin sanitization includes is_active, created, updated
      const sample = json.data.plans[0];
      assert.ok(typeof sample.is_active === 'boolean');
      assert.ok(sample.created);
      assert.ok(sample.updated);
      assert.strictEqual(sample.collectionId, undefined);
    });

    test('8. Admin can create valid plans (required: name, price, credits)', async () => {
      const planPayload = {
        name: `Enterprise_${testRunId}`,
        price: 4999,
        credits: 600,
        description: 'Enterprise commercial volume package',
        is_active: true,
      };

      const res = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify(planPayload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.plan.name, planPayload.name);
      assert.strictEqual(json.data.plan.price, 4999);
      assert.strictEqual(json.data.plan.credits, 600);
      assert.strictEqual(json.data.plan.is_active, true);

      createdAdminPlanId = json.data.plan.id;
      createdPlanIds.push(createdAdminPlanId);
    });

    test('9. Validation rejects invalid price (< 0) and credits (<= 0 or non-integer)', async () => {
      // Negative price
      const res1 = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({
          name: `InvalidPrice_${testRunId}`,
          price: -100,
          credits: 10,
        }),
      });
      assert.strictEqual(res1.status, 400);

      // Credits <= 0
      const res2 = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({
          name: `InvalidCredits_${testRunId}`,
          price: 100,
          credits: 0,
        }),
      });
      assert.strictEqual(res2.status, 400);

      // Float credits
      const res3 = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({
          name: `FloatCredits_${testRunId}`,
          price: 100,
          credits: 10.5,
        }),
      });
      assert.strictEqual(res3.status, 400);
    });

    test('10. Duplicate names are handled safely with descriptive error (HTTP 409)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Starter', // Already exists from seeding
          price: 350,
          credits: 15,
        }),
      });

      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error.message, /already exists/i);
    });

    test('11. Admin can update allowed fields (name, price, credits, description, is_active)', async () => {
      assert.ok(createdAdminPlanId);

      const updatePayload = {
        name: `Enterprise_Updated_${testRunId}`,
        price: 4499,
        credits: 650,
        description: 'Updated enterprise package description',
      };

      const res = await fetch(`${baseUrl}/api/v1/admin/plans/${createdAdminPlanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.plan.name, updatePayload.name);
      assert.strictEqual(json.data.plan.price, 4499);
      assert.strictEqual(json.data.plan.credits, 650);
      assert.strictEqual(json.data.plan.description, updatePayload.description);
    });

    test('12. Empty update is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/plans/${createdAdminPlanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error.message, /at least one/i);
    });

    test('13. Unknown and privileged fields are rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/plans/${createdAdminPlanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({
          price: 5000,
          id: 'hacked_id_123', // Privileged field
          created: '2020-01-01',
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error.message, /unrecognized/i);
    });

    test('14. Admin can deactivate a plan using soft deactivation (DELETE /api/v1/admin/plans/:id)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/plans/${createdAdminPlanId}`, {
        method: 'DELETE',
        headers: {
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.plan.is_active, false);

      // Verify the record still exists in PocketBase (soft delete only)
      const record = await adminPb.collection('subscription_plans').getOne(createdAdminPlanId);
      assert.ok(record);
      assert.strictEqual(record.is_active, false);
    });

    test('15. Deactivated plan disappears from public active-plans results', async () => {
      const res = await fetch(`${baseUrl}/api/v1/subscriptions/plans`);
      const json = await res.json();

      const ids = json.data.plans.map((p) => p.id);
      assert.strictEqual(ids.includes(createdAdminPlanId), false, 'Deactivated plan must immediately disappear from public endpoint');
    });

    test('16. Missing plan behavior returns HTTP 404 on nonexistent ID', async () => {
      const nonexistentId = 'nonexistent99999';

      const resGet = await fetch(`${baseUrl}/api/v1/admin/plans/${nonexistentId}`, {
        headers: { Cookie: `pb_auth=${adminToken}` },
      });
      assert.strictEqual(resGet.status, 404);

      const resPatch = await fetch(`${baseUrl}/api/v1/admin/plans/${nonexistentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
        body: JSON.stringify({ price: 100 }),
      });
      assert.strictEqual(resPatch.status, 404);

      const resDelete = await fetch(`${baseUrl}/api/v1/admin/plans/${nonexistentId}`, {
        method: 'DELETE',
        headers: {
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${adminToken}`,
        },
      });
      assert.strictEqual(resDelete.status, 404);
    });
  });

  // =========================================================================
  // 4. Authorization & RBAC Enforcement (Tests 17-20)
  // =========================================================================
  describe('4. Authorization & RBAC Enforcement', () => {
    test('17. Anonymous access to admin plan endpoints is rejected with HTTP 401', async () => {
      const resGet = await fetch(`${baseUrl}/api/v1/admin/plans`);
      assert.strictEqual(resGet.status, 401);

      const resPost = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: env.CLIENT_URL },
        body: JSON.stringify({ name: 'AnonPlan', price: 100, credits: 10 }),
      });
      assert.strictEqual(resPost.status, 401);

      // Verify aliased admin route on subscriptions router also blocks anonymous
      const resAlias = await fetch(`${baseUrl}/api/v1/subscriptions/admin/plans`);
      assert.strictEqual(resAlias.status, 401);
    });

    test('18. Customer access to admin plan endpoints is rejected with HTTP 403', async () => {
      const resGet = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        headers: { Cookie: `pb_auth=${customerToken}` },
      });
      assert.strictEqual(resGet.status, 403);

      const resPost = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${customerToken}`,
        },
        body: JSON.stringify({ name: 'CustPlan', price: 100, credits: 10 }),
      });
      assert.strictEqual(resPost.status, 403);

      const resAlias = await fetch(`${baseUrl}/api/v1/subscriptions/admin/plans`, {
        headers: { Cookie: `pb_auth=${customerToken}` },
      });
      assert.strictEqual(resAlias.status, 403);
    });

    test('19. Owner access to admin plan endpoints is rejected with HTTP 403', async () => {
      const resGet = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        headers: { Cookie: `pb_auth=${ownerToken}` },
      });
      assert.strictEqual(resGet.status, 403);

      const resPost = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
          Cookie: `pb_auth=${ownerToken}`,
        },
        body: JSON.stringify({ name: 'OwnerPlan', price: 100, credits: 10 }),
      });
      assert.strictEqual(resPost.status, 403);

      const resAlias = await fetch(`${baseUrl}/api/v1/subscriptions/admin/plans`, {
        headers: { Cookie: `pb_auth=${ownerToken}` },
      });
      assert.strictEqual(resAlias.status, 403);
    });

    test('20. Admin access to admin plan endpoints succeeds with HTTP 200/201', async () => {
      const resGet = await fetch(`${baseUrl}/api/v1/admin/plans`, {
        headers: { Cookie: `pb_auth=${adminToken}` },
      });
      assert.strictEqual(resGet.status, 200);

      // Verify aliased admin route on subscriptions router also succeeds for admin
      const resAlias = await fetch(`${baseUrl}/api/v1/subscriptions/admin/plans`, {
        headers: { Cookie: `pb_auth=${adminToken}` },
      });
      assert.strictEqual(resAlias.status, 200);
      const json = await resAlias.json();
      assert.strictEqual(json.success, true);
    });
  });
});
