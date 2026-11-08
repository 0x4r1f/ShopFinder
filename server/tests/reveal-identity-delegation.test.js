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
import { createAuthenticate } from '../src/middleware/authenticate.js';
import { authorize } from '../src/middleware/authorize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const hookFilePath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'reveal.pb.js');

describe('Phase 10, Task 10.2 — Trusted Express Identity Delegation and PocketBase Customer Validation (D-017)', () => {
  let adminPb = null;
  let superuserToken = null;
  let testCustomer = null;
  let testInactiveCustomer = null;
  let testOwner = null;
  let testAdminUser = null;
  let customerToken = null;
  let ownerToken = null;
  const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/reveal`;

  before(async () => {
    // 1. Authenticate superuser admin singleton
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 6);

    // 2. Create isolated test users via Superuser Admin SDK
    // Active Customer
    testCustomer = await adminPb.collection('users').create({
      email: `test.active.cust.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Active Test Customer',
      role: 'customer',
      is_active: true,
    });

    // Inactive Customer
    testInactiveCustomer = await adminPb.collection('users').create({
      email: `test.inactive.cust.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Inactive Test Customer',
      role: 'customer',
      is_active: false,
    });

    // Owner
    testOwner = await adminPb.collection('users').create({
      email: `test.owner.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Test Owner',
      role: 'owner',
      is_active: true,
    });

    // Admin app user
    testAdminUser = await adminPb.collection('users').create({
      email: `test.admin.${timestamp}.${randomSuffix}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Test App Admin',
      role: 'admin',
      is_active: true,
    });

    // 3. Authenticate users on isolated PocketBase instances
    const customerPb = new PocketBase(env.POCKETBASE_URL);
    const custAuth = await customerPb.collection('users').authWithPassword(testCustomer.email, 'TestPassword123!');
    customerToken = custAuth.token;

    const ownerPb = new PocketBase(env.POCKETBASE_URL);
    const ownAuth = await ownerPb.collection('users').authWithPassword(testOwner.email, 'TestPassword123!');
    ownerToken = ownAuth.token;
  });

  after(async () => {
    // Clean up created test users
    const usersToDelete = [testCustomer, testInactiveCustomer, testOwner, testAdminUser];
    for (const u of usersToDelete) {
      if (u?.id && adminPb) {
        try {
          await adminPb.collection('users').delete(u.id);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

  // =========================================================================
  // 1. Express Authentication & Identity Derivation (Tests 1–10)
  // =========================================================================
  describe('1. Express Authentication & Identity Derivation (D-017 Boundary)', () => {
    test('1. Anonymous request cannot obtain a trusted customer identity', () => {
      const mockReq = { user: null };
      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 401 && /authentication required/i.test(err.message)
      );
    });

    test('2. Invalid or missing session in authenticate middleware is rejected with HTTP 401', async () => {
      const authenticateMiddleware = createAuthenticate();
      let statusCalled = null;
      let jsonPayload = null;
      let nextCalled = false;

      const mockReq = { cookies: {} };
      const mockRes = {
        status(code) {
          statusCalled = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
      };

      await authenticateMiddleware(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(statusCalled, 401);
      assert.strictEqual(jsonPayload?.success, false);
    });

    test('3. Authenticated customer identity comes exclusively from req.user.id', () => {
      const mockReq = {
        user: {
          id: testCustomer.id,
          role: 'customer',
          email: testCustomer.email,
        },
      };

      const customerId = getTrustedCustomerId(mockReq);
      assert.strictEqual(customerId, testCustomer.id);
    });

    test('4. Owner role is rejected with HTTP 403', () => {
      const mockReq = {
        user: {
          id: testOwner.id,
          role: 'owner',
          email: testOwner.email,
        },
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 403 && /forbidden/i.test(err.message)
      );
    });

    test('5. Admin role is rejected with HTTP 403', () => {
      const mockReq = {
        user: {
          id: testAdminUser.id,
          role: 'admin',
          email: testAdminUser.email,
        },
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 403 && /forbidden/i.test(err.message)
      );
    });

    test('6. Customer-supplied customerId in JSON body is rejected with HTTP 400', () => {
      const mockReq = {
        user: { id: testCustomer.id, role: 'customer' },
        body: { customerId: 'attacker_specified_id' },
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400 && /prohibited/i.test(err.message)
      );
    });

    test('7. Customer-supplied customerId in query string is rejected with HTTP 400', () => {
      const mockReq = {
        user: { id: testCustomer.id, role: 'customer' },
        query: { customerId: 'attacker_specified_id' },
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400 && /prohibited/i.test(err.message)
      );
    });

    test('8. Customer-supplied identity override in headers is rejected with HTTP 400', () => {
      const mockReq = {
        user: { id: testCustomer.id, role: 'customer' },
        headers: { 'x-customer-id': 'attacker_specified_id' },
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400 && /prohibited/i.test(err.message)
      );

      // Verify rejectClientIdentityOverride middleware behavior
      let statusCalled = null;
      let jsonPayload = null;
      const mockRes = {
        status(code) {
          statusCalled = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
      };
      let nextCalled = false;

      rejectClientIdentityOverride(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(statusCalled, 400);
      assert.strictEqual(jsonPayload?.success, false);
    });

    test('9. A conflicting customer ID cannot override req.user.id even if matching', () => {
      const mockReq = {
        user: { id: testCustomer.id, role: 'customer' },
        body: { customerId: testCustomer.id }, // even when matching
      };

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400 && /prohibited/i.test(err.message)
      );
    });

    test('10. No superuser credentials appear in client-facing responses', async () => {
      // Execute delegated reveal call through the service
      const res = await delegateRevealTransaction({ customerId: testCustomer.id });
      const serialized = JSON.stringify(res);

      assert.doesNotMatch(serialized, new RegExp(env.POCKETBASE_ADMIN_PASSWORD, 'i'));
      assert.doesNotMatch(serialized, new RegExp(superuserToken, 'i'));
      assert.strictEqual(res.success, true);
    });
  });

  // =========================================================================
  // 2. PocketBase Internal Hook Customer Validation (Tests 11–20)
  // =========================================================================
  describe('2. PocketBase Internal Hook Customer Validation (Live PocketBase)', () => {
    test('11. Missing customerId is rejected with HTTP 400', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.status, 400);
      assert.match(json.message, /customerId is required/i);
    });

    test('12. Malformed customerId is rejected with HTTP 400', async () => {
      const malformedCases = ['', '   ', null, 12345, [], {}];

      for (const val of malformedCases) {
        const res = await fetch(customRouteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: superuserToken,
          },
          body: JSON.stringify({ customerId: val }),
        });

        assert.strictEqual(res.status, 400, `Expected 400 for malformed customerId: ${JSON.stringify(val)}`);
      }
    });

    test('13. Nonexistent user is rejected with HTTP 404', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: 'nonexistent_user_999999999' }),
      });

      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.match(json.message, /customer account not found/i);
    });

    test('14. Existing owner is rejected with HTTP 400', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testOwner.id }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /not an authorized customer/i);
    });

    test('15. Existing admin is rejected with HTTP 400', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testAdminUser.id }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /not an authorized customer/i);
    });

    test('16. Inactive customer is rejected with HTTP 400', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testInactiveCustomer.id }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.match(json.message, /customer account is deactivated/i);
    });

    test('17. Active customer is accepted with HTTP 200 and customer_validated status', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testCustomer.id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.task === '10.2' || json.data.task === '10.3');
      assert.strictEqual(json.data.customerId, testCustomer.id);
      assert.strictEqual(json.data.customerEmail, testCustomer.email);
      assert.strictEqual(json.data.transactionCommitted, true);
    });

    test('18. e.requestInfo().auth.id is never used as customer identity', async () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.doesNotMatch(
        content,
        /customerId\s*=\s*e\.requestInfo\(\)\.auth/i,
        'Hook must never derive customerId from e.requestInfo().auth'
      );

      // Verify that result.customerId in response is the customer ID, not the superuser ID
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testCustomer.id }),
      });

      const json = await res.json();
      assert.strictEqual(json.data.customerId, testCustomer.id);
      assert.notStrictEqual(json.data.customerId, adminPb.authStore.record?.id);
    });

    test('19. Customer validation database reads inside the transaction use txApp', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /txApp\.findRecordById\(\s*["']users["']\s*,\s*customerId\s*\)/,
        'Customer lookup must use txApp.findRecordById("users", customerId)'
      );
    });

    test('20. No transaction-scoped database operation uses outer $app', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      const txMatch = content.match(/\$app\.runInTransaction\(\s*\(\s*txApp\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
      assert.ok(txMatch, 'Must locate transaction block');
      const txBody = txMatch[1];

      assert.doesNotMatch(
        txBody,
        /\$app\.(find|save|delete|create|collection)/,
        'Transaction body must never call database operations on outer $app'
      );
    });
  });

  // =========================================================================
  // 3. Regression & Preserved Invariants (Tests 21–25)
  // =========================================================================
  describe('3. Regression & Preserved Invariants', () => {
    test('21. Task 10.1 superuser-only authentication remains intact', async () => {
      // Anonymous request
      const anonRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: testCustomer.id }),
      });
      assert.strictEqual(anonRes.status, 401);

      // Customer token request directly to PocketBase hook
      const custRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: customerToken,
        },
        body: JSON.stringify({ customerId: testCustomer.id }),
      });
      assert.ok(custRes.status === 401 || custRes.status === 403);
    });

    test('22. Task 10.1 rollback behavior remains intact', async () => {
      const userBefore = await adminPb.collection('users').getOne(testCustomer.id);
      const originalName = userBefore.name;

      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: testCustomer.id,
          testRollback: true,
        }),
      });

      assert.ok(res.status >= 400);

      const userAfter = await adminPb.collection('users').getOne(testCustomer.id);
      assert.strictEqual(userAfter.name, originalName, 'Mutation must be completely rolled back in SQLite');
      assert.notStrictEqual(userAfter.name, 'MUTATION_BEFORE_ROLLBACK');
    });

    test('23. Successful transaction still returns only after commit', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({ customerId: testCustomer.id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.transactionCommitted, true);
    });

    test('24. Existing owner profile transaction functionality remains intact', () => {
      const ownerHookPath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'owner_profile_upsert.pb.js');
      assert.ok(fs.existsSync(ownerHookPath));
      const content = fs.readFileSync(ownerHookPath, 'utf8');
      assert.ok(content.includes('/api/custom/owner/profile-upsert'));
      assert.ok(content.includes('$apis.requireSuperuserAuth()'));
    });

    test('25. Existing authorization middleware works with customer role', () => {
      const authMiddleware = authorize('customer');
      let nextCalled = false;
      let errorStatus = null;

      const mockRes = {
        status(code) {
          errorStatus = code;
          return this;
        },
        json() {
          return this;
        },
      };

      authMiddleware(
        { user: { id: testCustomer.id, role: 'customer' } },
        mockRes,
        () => {
          nextCalled = true;
        }
      );
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(errorStatus, null);
    });
  });
});

