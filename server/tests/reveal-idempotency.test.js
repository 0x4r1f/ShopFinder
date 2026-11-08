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

describe('Phase 10, Task 10.3 — Idempotent Previous-Reveal Check (D-013 & D-017)', () => {
  let adminPb = null;
  let superuserToken = null;
  let testCustomerA = null;
  let testCustomerB = null;
  let testOwner = null;
  let testAdminUser = null;
  let testListing1 = null;
  let testListing2 = null;
  let testSubscriptionA = null;
  let existingRevealA1 = null;
  const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/reveal`;

  before(async () => {
    // 1. Authenticate superuser admin singleton
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 6);

    // 2. Create isolated test users
    // Customer A (has revealed listing 1)
    testCustomerA = await adminPb.collection('users').create({
      email: `test.cust.a.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer A',
      role: 'customer',
      is_active: true,
    });

    // Customer B (has NOT revealed listing 1)
    testCustomerB = await adminPb.collection('users').create({
      email: `test.cust.b.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer B',
      role: 'customer',
      is_active: true,
    });

    // Property Owner
    testOwner = await adminPb.collection('users').create({
      email: `test.owner.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Listing Owner',
      role: 'owner',
      is_active: true,
    });

    // Admin App User
    testAdminUser = await adminPb.collection('users').create({
      email: `test.admin.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Admin User',
      role: 'admin',
      is_active: true,
    });

    // 3. Create isolated listings for testOwner
    testListing1 = await adminPb.collection('listings').create({
      title: `Test Shop 1 ${timestamp}`,
      description: 'Test shop description for reveal test',
      price: 25000,
      area_sqft: 450,
      address: '123 Test Street, Road 4',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });

    testListing2 = await adminPb.collection('listings').create({
      title: `Test Shop 2 ${timestamp}`,
      description: 'Second test shop description for reveal test',
      price: 35000,
      area_sqft: 600,
      address: '456 Test Avenue, Block B',
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'office',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });

    // 4. Load an active subscription plan and create active user_subscriptions record for Customer A
    const activePlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true');
    testSubscriptionA = await adminPb.collection('user_subscriptions').create({
      user: testCustomerA.id,
      plan: activePlan.id,
      credits_total: 10,
      credits_used: 2,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });

    // 5. Create existing revealed_contacts record for (Customer A, Listing 1)
    existingRevealA1 = await adminPb.collection('revealed_contacts').create({
      customer: testCustomerA.id,
      listing: testListing1.id,
      owner: testOwner.id,
      revealed_at: '2026-11-01T10:00:00.000Z',
    });
  });

  after(async () => {
    // Clean up created records
    if (adminPb) {
      if (existingRevealA1?.id) {
        try {
          await adminPb.collection('revealed_contacts').delete(existingRevealA1.id);
        } catch {}
      }
      if (testSubscriptionA?.id) {
        try {
          await adminPb.collection('user_subscriptions').delete(testSubscriptionA.id);
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
      for (const u of [testCustomerA, testCustomerB, testOwner, testAdminUser]) {
        if (u?.id) {
          try {
            await adminPb.collection('users').delete(u.id);
          } catch {}
        }
      }
    }
  });

  // =========================================================================
  // 1. Idempotent Previous-Reveal Lookup (Tests 1–7)
  // =========================================================================
  describe('1. Idempotent Previous-Reveal Verification (Live SQLite)', () => {
    test('1. Existing reveal for the same customer and listing returns already_revealed', async () => {
      const res = await delegateRevealTransaction({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.alreadyRevealed, true);
      assert.strictEqual(res.data.status, 'already_revealed');
      assert.strictEqual(res.data.revealId, existingRevealA1.id);
      assert.strictEqual(res.data.customerId, testCustomerA.id);
      assert.strictEqual(res.data.listingId, testListing1.id);
      assert.strictEqual(res.data.creditDeducted, false);
      assert.strictEqual(res.data.transactionCommitted, true);
    });

    test('2. Existing reveal lookup uses both customer and listing', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /customer\s*=\s*\{:customer\}\s*&&\s*listing\s*=\s*\{:listing\}/,
        'Filter must require both customer and listing parameters'
      );
    });

    test("3. A different customer's reveal record is never treated as a match", async () => {
      const res = await delegateRevealTransaction({
        customerId: testCustomerB.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.alreadyRevealed, false);
      assert.strictEqual(res.data.status, 'idempotent_checked_not_revealed');
      assert.strictEqual(res.data.customerId, testCustomerB.id);
    });

    test("4. A different listing's reveal record is never treated as a match", async () => {
      const res = await delegateRevealTransaction({
        customerId: testCustomerA.id,
        listingId: testListing2.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.alreadyRevealed, false);
      assert.strictEqual(res.data.status, 'idempotent_checked_not_revealed');
      assert.strictEqual(res.data.customerId, testCustomerA.id);
    });

    test('5. Repeated same-customer/same-listing lookup does not increment credits_used', async () => {
      // 1. Check initial subscription state
      const subBefore = await adminPb.collection('user_subscriptions').getOne(testSubscriptionA.id);
      assert.strictEqual(subBefore.credits_used, 2);

      // 2. Perform repeated reveal lookups for (Customer A, Listing 1)
      await delegateRevealTransaction({ customerId: testCustomerA.id, listingId: testListing1.id });
      await delegateRevealTransaction({ customerId: testCustomerA.id, listingId: testListing1.id });
      await delegateRevealTransaction({ customerId: testCustomerA.id, listingId: testListing1.id });

      // 3. Confirm credits_used remained untouched
      const subAfter = await adminPb.collection('user_subscriptions').getOne(testSubscriptionA.id);
      assert.strictEqual(
        subAfter.credits_used,
        2,
        'credits_used must NOT be incremented on an already-revealed listing'
      );
    });

    test('6. Repeated lookup does not create another reveal record', async () => {
      // Query all reveal records for this (customer, listing) pair
      const records = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: testCustomerA.id,
          l: testListing1.id,
        }),
      });

      assert.strictEqual(records.length, 1, 'Only the single existing record must exist in SQLite');
      assert.strictEqual(records[0].id, existingRevealA1.id);
    });

    test('7. Existing record ID and timestamp remain unchanged', async () => {
      const currentRecord = await adminPb.collection('revealed_contacts').getOne(existingRevealA1.id);
      assert.strictEqual(currentRecord.id, existingRevealA1.id);
      assert.strictEqual(currentRecord.customer, testCustomerA.id);
      assert.strictEqual(currentRecord.listing, testListing1.id);
      assert.strictEqual(currentRecord.revealed_at, existingRevealA1.revealed_at);
    });
  });

  // =========================================================================
  // 2. Security Boundaries & D-017 Delegation Integrity (Tests 8–11)
  // =========================================================================
  describe('2. Security Boundaries & Delegation Integrity', () => {
    test('8. Customer identity is still derived according to D-017', () => {
      const mockReq = {
        user: { id: testCustomerA.id, role: 'customer' },
      };
      const customerId = getTrustedCustomerId(mockReq);
      assert.strictEqual(customerId, testCustomerA.id);
    });

    test('9. Browser-supplied customer identity remains rejected', () => {
      const mockReqWithBody = {
        user: { id: testCustomerA.id, role: 'customer' },
        body: { customerId: testCustomerA.id },
      };
      assert.throws(() => getTrustedCustomerId(mockReqWithBody), /prohibited/i);

      const mockReqWithQuery = {
        user: { id: testCustomerA.id, role: 'customer' },
        query: { customerId: testCustomerA.id },
      };
      assert.throws(() => getTrustedCustomerId(mockReqWithQuery), /prohibited/i);
    });

    test('10. Owner and admin identities remain rejected', async () => {
      // Owner lookup attempt
      const ownerRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testOwner.id, listingId: testListing1.id }),
      });
      assert.strictEqual(ownerRes.status, 400);

      // Admin user lookup attempt
      const adminRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testAdminUser.id, listingId: testListing1.id }),
      });
      assert.strictEqual(adminRes.status, 400);
    });

    test('11. Customer validation still occurs before idempotency lookup', async () => {
      // Pass nonexistent customer with a valid listing ID
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: 'nonexistent_customer_id_999999', listingId: testListing1.id }),
      });

      assert.strictEqual(res.status, 404, 'Must fail on customer validation before lookup');
    });
  });

  // =========================================================================
  // 3. Transaction Rules & Scope Guardrails (Tests 12–18)
  // =========================================================================
  describe('3. Transaction Rules & Scope Guardrails', () => {
    test('12. All transaction-scoped database reads use txApp', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /txApp\.findFirstRecordByFilter\(\s*["']revealed_contacts["']/,
        'Revealed contacts lookup must use txApp.findFirstRecordByFilter'
      );
    });

    test('13. No transaction-scoped database operations use outer $app', () => {
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

    test('14. Task 10.1 rollback behavior remains functional', async () => {
      const userBefore = await adminPb.collection('users').getOne(testCustomerA.id);
      const originalName = userBefore.name;

      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: testCustomerA.id,
          listingId: testListing2.id,
          testRollback: true,
        }),
      });

      assert.ok(res.status >= 400);

      const userAfter = await adminPb.collection('users').getOne(testCustomerA.id);
      assert.strictEqual(userAfter.name, originalName);
    });

    test('15. Existing owner profile transaction behavior remains functional', () => {
      const ownerHookPath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'owner_profile_upsert.pb.js');
      assert.ok(fs.existsSync(ownerHookPath));
      const content = fs.readFileSync(ownerHookPath, 'utf8');
      assert.ok(content.includes('/api/custom/owner/profile-upsert'));
      assert.ok(content.includes('$apis.requireSuperuserAuth()'));
    });

    test('16. No owner phone retrieval is implemented in Task 10.3', async () => {
      const res = await delegateRevealTransaction({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      // Confirm phone is strictly NOT returned in Task 10.3 (deferred to Task 10.6)
      assert.strictEqual(res.data.phone, undefined);
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.doesNotMatch(content, /owner_contacts.*find/);
    });

    test('17. No credit validation or deduction is implemented in Task 10.3', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      // Strip comments to inspect only active executable code
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.doesNotMatch(codeWithoutComments, /user_subscriptions/);
      assert.doesNotMatch(codeWithoutComments, /credits_used/);
    });

    test('18. Database unique index prevents duplicate reveal record creation', async () => {
      // Attempting to insert a duplicate record for (testCustomerA, testListing1) at the DB level throws 400
      await assert.rejects(
        async () => {
          await adminPb.collection('revealed_contacts').create({
            customer: testCustomerA.id,
            listing: testListing1.id,
            owner: testOwner.id,
          });
        },
        (err) => {
          // PocketBase rejects duplicate key on unique index
          return err?.status === 400 || /unique|constraint/i.test(err?.message);
        }
      );
    });
  });
});
