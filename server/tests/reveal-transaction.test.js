import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminClient } from '../src/config/pocketbase.js';
import PocketBase from 'pocketbase';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const hookFilePath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'reveal.pb.js');

describe('Phase 10, Task 10.1 — PocketBase Atomic Contact Reveal Transaction Route (D-013)', () => {
  let adminPb = null;
  let superuserToken = null;
  let testCustomer = null;
  let customerToken = null;
  const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/reveal`;

  before(async () => {
    // 1. Authenticate superuser admin singleton
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    // 2. Create isolated test customer via Superuser Admin SDK
    const uniqueEmail = `test.reveal.cust.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@shopfinder.test`;
    testCustomer = await adminPb.collection('users').create({
      email: uniqueEmail,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Initial Customer Name',
      role: 'customer',
      is_active: true,
    });

    // 3. Authenticate customer on a FRESH ISOLATED PocketBase instance
    // Never call authWithPassword on adminPb to avoid mutating superuser authStore (D-010 architecture)
    const isolatedCustomerPb = new PocketBase(env.POCKETBASE_URL);
    const customerAuth = await isolatedCustomerPb.collection('users').authWithPassword(uniqueEmail, 'TestPassword123!');
    customerToken = customerAuth.token;

    // 4. Create active user_subscriptions record for testCustomer (Task 10.4 credit verification)
    const activePlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true');
    await adminPb.collection('user_subscriptions').create({
      user: testCustomer.id,
      plan: activePlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
  });

  after(async () => {
    // Clean up only the isolated test customer
    if (adminPb && testCustomer?.id) {
      try {
        await adminPb.collection('users').delete(testCustomer.id);
      } catch (err) {
        console.warn('Test customer cleanup error:', err.message);
      }
    }
  });

  // =========================================================================
  // 1. Static & Architectural Structure Verification
  // =========================================================================
  describe('1. Static Code & Hook Architecture Verification', () => {
    test('1. Hook file exists at the correct path', () => {
      assert.ok(fs.existsSync(hookFilePath), 'pocketbase/pb_hooks/reveal.pb.js must exist');
    });

    test('2. Route registers at POST /api/custom/reveal', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /routerAdd\(\s*["']POST["']\s*,\s*["']\/api\/custom\/reveal["']/,
        'Hook must register POST /api/custom/reveal'
      );
    });

    test('3. Route requires PocketBase superuser authentication via $apis.requireSuperuserAuth()', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /\$apis\.requireSuperuserAuth\(\)/,
        'Route registration must pass $apis.requireSuperuserAuth()'
      );
    });

    test('4. Transaction uses $app.runInTransaction()', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /\$app\.runInTransaction\(\s*\(\s*txApp\s*\)\s*=>/,
        'Must establish SQLite transaction using $app.runInTransaction((txApp) => ...)'
      );
    });

    test('5. Transaction callback receives and uses txApp', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.ok(content.includes('txApp'), 'Callback must accept and use txApp');
    });

    test('6. Database operations inside the callback do not use outer $app', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      // Extract the transaction callback body
      const txMatch = content.match(/\$app\.runInTransaction\(\s*\(\s*txApp\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
      assert.ok(txMatch, 'Must find $app.runInTransaction block');

      const txBody = txMatch[1];
      // Ensure no database calls like $app.findRecord, $app.save, $app.collection inside transaction body
      assert.doesNotMatch(
        txBody,
        /\$app\.(find|save|delete|create|collection)/,
        'Transaction body must never perform DB operations using outer $app'
      );
    });

    test('13. No credit deduction logic exists outside the transaction', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      // Verify credits_used or deduction is not executed in outer scope
      const parts = content.split('$app.runInTransaction');
      assert.doesNotMatch(parts[0], /credits_used.*save|decrement|increment/i);
    });

    test('14. No reveal record creation logic is prematurely implemented in Task 10.1', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.doesNotMatch(content, /revealed_contacts.*txApp\.save/);
      assert.doesNotMatch(content, /owner_contacts.*find/);
    });

    test('15. Existing owner profile transaction hook remains unchanged and functional', () => {
      const ownerHookPath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'owner_profile_upsert.pb.js');
      assert.ok(fs.existsSync(ownerHookPath));
      const content = fs.readFileSync(ownerHookPath, 'utf8');
      assert.ok(content.includes('/api/custom/owner/profile-upsert'));
      assert.ok(content.includes('$apis.requireSuperuserAuth()'));
    });
  });

  // =========================================================================
  // 2. Authentication & Access Boundary Verification (Live PocketBase)
  // =========================================================================
  describe('2. Authentication & Authorization Boundaries', () => {
    test('10a. Anonymous request is rejected with HTTP 401', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 401, 'Anonymous caller must receive HTTP 401');
    });

    test('10b. Non-superuser authenticated request is rejected with HTTP 401 or 403', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: customerToken,
        },
        body: JSON.stringify({}),
      });

      assert.ok(
        res.status === 401 || res.status === 403,
        `Non-superuser token must be rejected with 401 or 403 (got ${res.status})`
      );
    });

    test('11. Malformed payload is rejected safely with HTTP 400', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: 'invalid-non-json-string',
      });

      assert.strictEqual(res.status, 400, 'Malformed JSON or non-object must return HTTP 400');
    });

    test('12. Error responses do not leak stack traces or secret data', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: 'null',
      });

      const json = await res.json().catch(() => ({}));
      const serialized = JSON.stringify(json);

      assert.doesNotMatch(serialized, /pb_data|node_modules|SELECT|SQLite|password/i);
    });
  });

  // =========================================================================
  // 3. Live SQLite Transaction Rollback & Commit Verification
  // =========================================================================
  describe('3. SQLite Transaction Commit and Rollback Verification', () => {
    test('7 & 8. A deliberate failure inside the transaction causes complete rollback in SQLite', async () => {
      // 1. Verify initial state before transactional attempt
      const userBefore = await adminPb.collection('users').getOne(testCustomer.id);
      const originalName = userBefore.name;
      assert.strictEqual(originalName, 'Initial Customer Name');

      // 2. Invoke /api/custom/reveal with superuser auth and simulateRollback = true
      // The hook mutates user.name to "MUTATION_BEFORE_ROLLBACK" via txApp and deliberately throws
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          testRollback: true,
          testRecordId: testCustomer.id,
        }),
      });

      // The transaction must fail and return error status (500 or 400)
      assert.ok(
        res.status >= 400,
        `Deliberate transactional error must return error status (got ${res.status})`
      );

      // 3. Inspect user in SQLite to confirm rollback occurred
      const userAfter = await adminPb.collection('users').getOne(testCustomer.id);
      assert.strictEqual(
        userAfter.name,
        originalName,
        'Record name in SQLite must remain unchanged; txApp mutation must be completely rolled back'
      );
      assert.notStrictEqual(
        userAfter.name,
        'MUTATION_BEFORE_ROLLBACK',
        'Partial mutation must never persist after transaction rollback'
      );
    });

    test('9. Successful transaction returns HTTP 200 with customer_validated data after commit', async () => {
      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          customerId: testCustomer.id,
        }),
      });

      assert.strictEqual(res.status, 200, 'Superuser request must succeed with HTTP 200');

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.customerId, testCustomer.id);
      assert.strictEqual(json.data.transactionCommitted, true);
    });
  });
});
