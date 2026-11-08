import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { paymentService } from '../src/services/paymentService.js';
import { MockPaymentAdapter } from '../src/services/providers/mockAdapter.js';

describe('Phase 11, Task 11.5 — Payment Idempotency & Duplicate Webhook Protection', () => {
  let adminPb;
  let server;
  let baseUrl;
  let mockAdapter;

  const timestamp = Date.now();
  const testSecret = 'mock_secret_key_shopfinder_test';

  let testCustomer;
  let testPlan;

  const createdUserIds = [];
  const createdPlanIds = [];
  const createdPaymentIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // Register deterministic mock adapter
    mockAdapter = new MockPaymentAdapter({ secretKey: testSecret });
    paymentService.registerAdapter(mockAdapter);
    paymentService.setDefaultProviderName('mock');

    // Create test customer & plan
    testCustomer = await adminPb.collection('users').create({
      email: `idempotency_${timestamp}@shopfinder.local`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Idempotency Test User',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer.id);

    testPlan = await adminPb.collection('subscription_plans').create({
      name: `Idempotency Plan ${timestamp}`,
      price: 299,
      credits: 10,
      is_active: true,
    });
    createdPlanIds.push(testPlan.id);

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    for (const id of createdPaymentIds) {
      try {
        await adminPb.collection('payments').delete(id);
      } catch {}
    }

    for (const id of createdPlanIds) {
      try {
        await adminPb.collection('subscription_plans').delete(id);
      } catch {}
    }

    for (const id of createdUserIds) {
      try {
        await adminPb.collection('users').delete(id);
      } catch {}
    }
  });

  beforeEach(() => {
    mockAdapter.setMode('normal');
  });

  /**
   * Helper to dispatch signed webhook request.
   */
  async function dispatchSignedWebhook(payloadObj, options = {}) {
    const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
    const signature = mockAdapter.computeSignature(rawBody);

    const url = options.query
      ? `${baseUrl}/api/v1/payments/webhook?${options.query}`
      : `${baseUrl}/api/v1/payments/webhook`;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-signature': signature,
        ...(options.headers || {}),
      },
      body: rawBody,
    });
  }

  // --------------------------------------------------------------------------
  // 1. Initial Processing & Duplicate Acknowledgment
  // --------------------------------------------------------------------------
  describe('Idempotent Lifecycle: Pending -> Success -> Duplicate Acknowledgment', () => {
    it('processes first valid webhook for a pending payment transitioning it to success', async () => {
      const ref = `SF_TXN_IDEM_${Date.now()}_1`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        currency: 'BDT',
        status: 'success',
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.alreadyProcessed, false);
      assert.equal(body.data.duplicate, false);
      assert.equal(body.data.status, 'success');
      assert.equal(body.data.transition, 'pending_to_success');

      // Verify payment record updated to success in PocketBase
      const updated = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(updated.status, 'success');
    });

    it('acknowledges duplicate webhook for already-succeeded payment with HTTP 200 without mutations', async () => {
      const ref = `SF_TXN_IDEM_${Date.now()}_DUP`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // 1. Initial delivery -> processes
      const firstRes = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });
      assert.equal(firstRes.status, 200);

      // Snapshot subscriptions and payments counts before duplicate
      const subsBefore = await adminPb.collection('user_subscriptions').getFullList();
      const paymentsBefore = await adminPb.collection('payments').getFullList();

      // 2. Duplicate delivery -> acknowledges with HTTP 200
      const dupRes = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });

      const dupBody = await dupRes.json();
      assert.equal(dupRes.status, 200);
      assert.equal(dupBody.success, true);
      assert.equal(dupBody.data.alreadyProcessed, true);
      assert.equal(dupBody.data.duplicate, true);
      assert.equal(dupBody.data.status, 'success');
      assert.equal(dupBody.message, 'Payment already processed');

      // Verify zero duplicate records created
      const subsAfter = await adminPb.collection('user_subscriptions').getFullList();
      const paymentsAfter = await adminPb.collection('payments').getFullList();

      assert.equal(subsAfter.length, subsBefore.length);
      assert.equal(paymentsAfter.length, paymentsBefore.length);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Concurrency Safety
  // --------------------------------------------------------------------------
  describe('Concurrent Duplicate Delivery Protection', () => {
    it('handles concurrent duplicate webhook deliveries atomically without race conditions', async () => {
      const ref = `SF_TXN_IDEM_CONCUR_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const payload = {
        providerRef: ref,
        amount: 299,
        currency: 'BDT',
        status: 'success',
      };

      // Fire 3 simultaneous webhook deliveries
      const [res1, res2, res3] = await Promise.all([
        dispatchSignedWebhook(payload),
        dispatchSignedWebhook(payload),
        dispatchSignedWebhook(payload),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      assert.equal(res3.status, 200);

      const [body1, body2, body3] = await Promise.all([
        res1.json(),
        res2.json(),
        res3.json(),
      ]);

      const responses = [body1, body2, body3];
      const firstProcessing = responses.filter((r) => r.data.alreadyProcessed === false);
      const duplicateAcks = responses.filter((r) => r.data.alreadyProcessed === true && r.data.duplicate === true);

      // Exactly ONE request must execute the transition, and the other TWO must be recognized duplicates
      assert.equal(firstProcessing.length, 1);
      assert.equal(duplicateAcks.length, 2);

      // Exactly ONE record remains in the database with status = 'success'
      const matches = await adminPb.collection('payments').getFullList({
        filter: adminPb.filter('provider_ref = {:ref}', { ref }),
      });
      assert.equal(matches.length, 1);
      assert.equal(matches[0].status, 'success');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Unknown References & Provider Mismatches
  // --------------------------------------------------------------------------
  describe('Unknown References and Provider Mismatch Guards', () => {
    it('returns HTTP 404 when provider reference is not found in database', async () => {
      const res = await dispatchSignedWebhook({
        providerRef: 'SF_TXN_NON_EXISTENT_99999',
        amount: 299,
        status: 'success',
      });

      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Payment record not found'));
    });

    it('rejects provider mismatch between webhook and payment record with HTTP 400', async () => {
      const ref = `SF_TXN_MISMATCH_${Date.now()}`;
      // Created with provider = 'mock'
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Set up a second mock adapter named 'bkash' to simulate provider mismatch
      class BkashMockAdapter extends MockPaymentAdapter {
        constructor() {
          super({ secretKey: testSecret });
          this._name = 'bkash';
        }
      }
      paymentService.registerAdapter(new BkashMockAdapter());

      const res = await dispatchSignedWebhook(
        {
          providerRef: ref,
          amount: 299,
          status: 'success',
        },
        { query: 'provider=bkash' }
      );

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Provider mismatch'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Pending, Failed States & Rollback
  // --------------------------------------------------------------------------
  describe('State Transitions and Rollback Safety', () => {
    it('transitions pending payment to failed when webhook reports failed status', async () => {
      const ref = `SF_TXN_FAIL_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'failed',
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.status, 'failed');
      assert.equal(body.data.transition, 'pending_to_failed');

      const updated = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(updated.status, 'failed');
    });

    it('acknowledges duplicate failure webhooks safely with HTTP 200', async () => {
      const ref = `SF_TXN_FAIL_DUP_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'failed',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'failed',
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.alreadyProcessed, true);
      assert.equal(body.data.duplicate, true);
      assert.equal(body.data.status, 'failed');
    });

    it('rejects attempt to transition an already-failed payment to success with HTTP 400', async () => {
      const ref = `SF_TXN_FAIL_IMMUTABLE_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'failed',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes("already in 'failed' status"));
    });

    it('demonstrates database transaction rollback leaving payment record status unchanged', async () => {
      const ref = `SF_TXN_ROLLBACK_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
        testRollback: true,
      });

      const body = await res.json();
      assert.ok(res.status >= 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('rollback'));

      // Check record in database: status must remain 'pending' due to SQLite rollback
      const recordAfterRollback = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(recordAfterRollback.status, 'pending');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Task Boundary Check
  // --------------------------------------------------------------------------
  describe('Boundary Preservation (Task 11.6 Deferral)', () => {
    it('guarantees zero user_subscriptions creation and zero credit allocations in Task 11.5', async () => {
      const ref = `SF_TXN_BOUNDARY_${Date.now()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: testPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const subsBefore = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: testCustomer.id }),
      });

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });

      assert.equal(res.status, 200);

      const subsAfter = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: testCustomer.id }),
      });

      // Task 11.6 boundary: user_subscriptions must not be created yet
      assert.equal(subsAfter.length, subsBefore.length);
    });
  });
});
