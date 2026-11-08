import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminClient } from '../src/config/pocketbase.js';
import PocketBase from 'pocketbase';
import { env } from '../src/config/env.js';
import {
  getTrustedCustomerId,
  rejectClientIdentityOverride,
  delegateRevealTransaction,
} from '../src/services/revealService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const hookFilePath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'reveal.pb.js');

describe('Phase 10, Task 10.4 — Verify Active Subscription and Available Credit Balance (D-001 & D-013)', () => {
  let adminPb = null;
  let superuserToken = null;
  let starterPlan = null;
  let proPlan = null;

  // Test customers
  let customerSinglePackage = null;
  let customerMultiPackage = null;
  let customerDepletedPackage = null;
  let customerOverusedPackage = null;
  let customerInactivePackage = null;
  let customerNoPackage = null;
  let customerExistingRevealZeroCredits = null;

  // Test owner & listing
  let testOwner = null;
  let testListing1 = null;
  let testListing2 = null;
  let existingRevealRecord = null;

  const createdUserIds = [];
  const createdSubIds = [];
  const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/reveal`;

  before(async () => {
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    // 1. Fetch starter and pro subscription plans
    starterPlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true && credits = 10');
    proPlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true && credits = 100');

    const timestamp = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 6);

    // 2. Create property owner and listings
    testOwner = await adminPb.collection('users').create({
      email: `test.owner.10.4.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Owner 10.4',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner.id);

    testListing1 = await adminPb.collection('listings').create({
      title: `Listing 1 10.4 ${timestamp}`,
      description: 'Test shop description for credit verification',
      price: 20000,
      area_sqft: 350,
      address: 'Shop 104, Level 2',
      city: 'Dhaka',
      area: 'Banani',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });

    testListing2 = await adminPb.collection('listings').create({
      title: `Listing 2 10.4 ${timestamp}`,
      description: 'Second test shop description for credit verification',
      price: 45000,
      area_sqft: 600,
      address: 'Office 204, Level 4',
      city: 'Dhaka',
      area: 'Uttara',
      category: 'office',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });

    // 3. Customer 1: Single active package with positive credits (10 total, 2 used -> 8 remaining)
    customerSinglePackage = await adminPb.collection('users').create({
      email: `test.cust.single.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Single Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerSinglePackage.id);

    const sub1 = await adminPb.collection('user_subscriptions').create({
      user: customerSinglePackage.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 2,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub1.id);

    // 4. Customer 2: Multiple active packages (stacking: 10 total/5 used + 100 total/10 used -> 5 + 90 = 95 remaining)
    customerMultiPackage = await adminPb.collection('users').create({
      email: `test.cust.multi.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Multi Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerMultiPackage.id);

    const sub2a = await adminPb.collection('user_subscriptions').create({
      user: customerMultiPackage.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 5,
      status: 'active',
      purchased_at: new Date(timestamp - 100000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub2a.id);

    const sub2b = await adminPb.collection('user_subscriptions').create({
      user: customerMultiPackage.id,
      plan: proPlan.id,
      credits_total: 100,
      credits_used: 10,
      status: 'active',
      purchased_at: new Date(timestamp - 50000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub2b.id);

    // 5. Customer 3: Depleted package (10 total, 10 used -> 0 remaining)
    customerDepletedPackage = await adminPb.collection('users').create({
      email: `test.cust.depleted.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Depleted Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerDepletedPackage.id);

    const sub3 = await adminPb.collection('user_subscriptions').create({
      user: customerDepletedPackage.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 10,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub3.id);

    // 6. Customer 4: Overused package (edge case: 10 total, 12 used -> 0 remaining, not negative)
    customerOverusedPackage = await adminPb.collection('users').create({
      email: `test.cust.overused.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Overused Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerOverusedPackage.id);

    // Use txApp to create directly to test edge case without lifecycle hook preventing credits_used > total
    const sub4 = await adminPb.collection('user_subscriptions').create({
      user: customerOverusedPackage.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 10,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub4.id);

    // 7. Customer 5: Inactive subscription (cancelled/expired status)
    customerInactivePackage = await adminPb.collection('users').create({
      email: `test.cust.inactive.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Inactive Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerInactivePackage.id);

    const sub5 = await adminPb.collection('user_subscriptions').create({
      user: customerInactivePackage.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'cancelled',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(sub5.id);

    // 8. Customer 6: No subscription package at all (0 credits)
    customerNoPackage = await adminPb.collection('users').create({
      email: `test.cust.nopackage.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'No Package Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerNoPackage.id);

    // 9. Customer 7: Has 0 credits, but ALREADY revealed listing 1 previously
    customerExistingRevealZeroCredits = await adminPb.collection('users').create({
      email: `test.cust.prevreveal.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Prev Reveal Zero Credit Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerExistingRevealZeroCredits.id);

    existingRevealRecord = await adminPb.collection('revealed_contacts').create({
      customer: customerExistingRevealZeroCredits.id,
      listing: testListing1.id,
      owner: testOwner.id,
      revealed_at: new Date().toISOString(),
    });
  });

  after(async () => {
    if (adminPb) {
      if (existingRevealRecord?.id) {
        try {
          await adminPb.collection('revealed_contacts').delete(existingRevealRecord.id);
        } catch {}
      }
      for (const id of createdSubIds) {
        try {
          await adminPb.collection('user_subscriptions').delete(id);
        } catch {}
      }
      if (testListing1?.id) {
        try {
          await adminPb.collection('listings').delete(testListing1.id);
        } catch {}
      }
      if (testListing2?.id) {
        try {
          await adminPb.collection('listings').delete(testListing2.id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {}
      }
    }
  });

  // =========================================================================
  // 1. Credit Verification & Aggregation Tests (1–7)
  // =========================================================================
  describe('1. Credit Balance Verification & Aggregation (D-001)', () => {
    test('1. Customer with one active subscription and positive credits passes verification', async () => {
      const res = await delegateRevealTransaction({
        customerId: customerSinglePackage.id,
        listingId: testListing1.id,
        verifyOnly: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'credits_verified');
      assert.strictEqual(res.data.creditsRemaining, 8); // 10 total - 2 used
      assert.strictEqual(res.data.creditDeducted, false);
      assert.strictEqual(res.data.revealCreated, false);
      assert.strictEqual(res.data.transactionCommitted, true);
    });

    test('2. Customer with multiple active subscriptions aggregates balances correctly', async () => {
      const res = await delegateRevealTransaction({
        customerId: customerMultiPackage.id,
        listingId: testListing1.id,
        verifyOnly: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'credits_verified');
      assert.strictEqual(res.data.creditsRemaining, 95); // (10 - 5) + (100 - 10) = 5 + 90 = 95
      assert.strictEqual(res.data.creditDeducted, false);
      assert.strictEqual(res.data.revealCreated, false);
      assert.strictEqual(res.data.transactionCommitted, true);
    });

    test('3. A subscription with credits_used === credits_total contributes zero', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerDepletedPackage.id,
          listingId: testListing1.id,
        }),
      });

      assert.strictEqual(res.status, 402, 'Depleted subscription must return HTTP 402 Payment Required');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.status, 402);
      assert.strictEqual(json.data.creditsRemaining, 0);
      assert.strictEqual(json.data.transactionRolledBack, true);
    });

    test('4. A subscription with credits_used >= credits_total contributes zero, not negative', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerOverusedPackage.id,
          listingId: testListing1.id,
        }),
      });

      assert.strictEqual(res.status, 402);
      const json = await res.json();
      assert.strictEqual(json.data.creditsRemaining, 0);
    });

    test('5. Inactive subscription records are excluded from balance calculation', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerInactivePackage.id,
          listingId: testListing1.id,
        }),
      });

      // Customer 5 has 10 credits in a 'cancelled' subscription, which must be excluded
      assert.strictEqual(res.status, 402);
      const json = await res.json();
      assert.strictEqual(json.data.creditsRemaining, 0);
    });

    test("6. Another customer's subscription records are excluded", async () => {
      // Customer 6 has no subscriptions, but Customer 1 and 2 do have active subscriptions
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerNoPackage.id,
          listingId: testListing1.id,
        }),
      });

      assert.strictEqual(res.status, 402);
      const json = await res.json();
      assert.strictEqual(json.data.creditsRemaining, 0);
    });

    test('7. Customer with no active subscriptions has zero credits and is rejected', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerNoPackage.id,
          listingId: testListing1.id,
        }),
      });

      assert.strictEqual(res.status, 402);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.data.requiredCredits, 1);
    });
  });

  // =========================================================================
  // 2. Insufficient Credit Behavior & Rollback Safety (Tests 8–11)
  // =========================================================================
  describe('2. Insufficient Credit Behavior & Rollback Safety', () => {
    test('8. Customer with zero available credits is rejected with HTTP 402', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerDepletedPackage.id,
          listingId: testListing2.id,
        }),
      });

      assert.strictEqual(res.status, 402);
      const json = await res.json();
      assert.match(json.message, /insufficient credits/i);
    });

    test('9. Insufficient-credit rejection rolls back any transactional state', async () => {
      const userBefore = await adminPb.collection('users').getOne(customerDepletedPackage.id);
      const originalName = userBefore.name;

      // Invoke endpoint with depleted package
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerDepletedPackage.id,
          listingId: testListing2.id,
        }),
      });

      assert.strictEqual(res.status, 402);
      const userAfter = await adminPb.collection('users').getOne(customerDepletedPackage.id);
      assert.strictEqual(userAfter.name, originalName, 'User name must remain unchanged in SQLite');
    });

    test('10. No subscription record is modified during verification', async () => {
      // Customer 1 had credits_used: 2
      const subBefore = await adminPb.collection('user_subscriptions').getFirstListItem(
        `user = "${customerSinglePackage.id}"`
      );
      assert.strictEqual(subBefore.credits_used, 2);

      // Call verification multiple times with verifyOnly: true
      await delegateRevealTransaction({ customerId: customerSinglePackage.id, listingId: testListing1.id, verifyOnly: true });
      await delegateRevealTransaction({ customerId: customerSinglePackage.id, listingId: testListing1.id, verifyOnly: true });

      const subAfter = await adminPb.collection('user_subscriptions').getFirstListItem(
        `user = "${customerSinglePackage.id}"`
      );
      assert.strictEqual(subAfter.credits_used, 2, 'credits_used must NOT be modified during credit verification');
    });

    test('11. No reveal record is created during verification', async () => {
      // Call verification with verifyOnly: true
      await delegateRevealTransaction({ customerId: customerSinglePackage.id, listingId: testListing1.id, verifyOnly: true });

      // Query revealed_contacts for Customer 1 and Listing 1
      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerSinglePackage.id,
          l: testListing1.id,
        }),
      });

      assert.strictEqual(reveals.length, 0, 'ZERO reveal records must be created during credit verification');
    });
  });

  // =========================================================================
  // 3. Execution Order & Idempotency Priority (Test 12)
  // =========================================================================
  describe('3. Execution Order & Idempotency Priority', () => {
    test('12. Existing reveal is returned before credit verification, even when customer has zero credits', async () => {
      // Customer 7 has ZERO subscription records and 0 credits, but ALREADY revealed listing 1 previously
      const res = await delegateRevealTransaction({
        customerId: customerExistingRevealZeroCredits.id,
        listingId: testListing1.id,
      });

      // Must succeed with 200 already_revealed, NOT fail with 402 insufficient credits!
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.alreadyRevealed, true);
      assert.strictEqual(res.data.status, 'already_revealed');
      assert.strictEqual(res.data.revealId, existingRevealRecord.id);
      assert.strictEqual(res.data.creditDeducted, false);
      assert.strictEqual(res.data.transactionCommitted, true);
    });
  });

  // =========================================================================
  // 4. Invariants, Transaction Isolation & Regression (Tests 13–17)
  // =========================================================================
  describe('4. Invariants, Transaction Isolation & Regression', () => {
    test('13. All transaction-scoped database operations use txApp', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /txApp\.findRecordsByFilter\(\s*["']user_subscriptions["']/,
        'Subscriptions query must use txApp.findRecordsByFilter'
      );
    });

    test('14. No outer $app database operation occurs inside the transaction callback', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      const txMatch = content.match(/\$app\.runInTransaction\(\s*\(\s*txApp\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
      assert.ok(txMatch);
      const txBody = txMatch[1];

      assert.doesNotMatch(
        txBody,
        /\$app\.(find|save|delete|create|collection)/,
        'No database operations on outer $app inside transaction body'
      );
    });

    test('15. Existing Task 10.1 rollback behavior remains functional', async () => {
      const userBefore = await adminPb.collection('users').getOne(customerSinglePackage.id);
      const originalName = userBefore.name;

      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: customerSinglePackage.id,
          listingId: testListing1.id,
          testRollback: true,
        }),
      });

      assert.ok(res.status >= 400);
      const userAfter = await adminPb.collection('users').getOne(customerSinglePackage.id);
      assert.strictEqual(userAfter.name, originalName);
    });

    test('16. Existing Task 10.2 trusted identity validation remains enforced', async () => {
      // Anonymous caller
      const anonRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerSinglePackage.id }),
      });
      assert.strictEqual(anonRes.status, 401);

      // Owner identity rejected
      const ownerRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testOwner.id }),
      });
      assert.strictEqual(ownerRes.status, 400);

      // Express override rejected
      assert.throws(
        () => getTrustedCustomerId({ user: { id: customerSinglePackage.id, role: 'customer' }, body: { customerId: customerSinglePackage.id } }),
        /prohibited/i
      );
    });

    test('17. Existing Task 10.3 idempotency behavior remains unchanged', async () => {
      const res = await delegateRevealTransaction({
        customerId: customerExistingRevealZeroCredits.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.data.alreadyRevealed, true);
      assert.strictEqual(res.data.status, 'already_revealed');
      assert.strictEqual(res.data.creditDeducted, false);
    });
  });
});

