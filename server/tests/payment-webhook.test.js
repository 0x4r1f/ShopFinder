import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { paymentService } from '../src/services/paymentService.js';
import { MockPaymentAdapter } from '../src/services/providers/mockAdapter.js';

describe('Phase 11, Task 11.4 — Payment Webhook Handler & Cryptographic Signature Verification', () => {
  let adminPb;
  let server;
  let baseUrl;
  let mockAdapter;

  let testCustomer;
  let testPlan;
  const createdUserIds = [];
  const createdPlanIds = [];
  const createdPaymentIds = [];

  const testSecret = 'mock_secret_key_shopfinder_test';

  before(async () => {
    adminPb = await getAdminClient();

    // Register deterministic mock adapter
    mockAdapter = new MockPaymentAdapter({ secretKey: testSecret });
    paymentService.registerAdapter(mockAdapter);
    paymentService.setDefaultProviderName('mock');

    // Create test customer & plan
    const timestamp = Date.now();
    testCustomer = await adminPb.collection('users').create({
      email: `webhook_test_${timestamp}@shopfinder.local`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Webhook Test User',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer.id);

    testPlan = await adminPb.collection('subscription_plans').create({
      name: `Webhook Plan ${timestamp}`,
      price: 299,
      credits: 10,
      is_active: true,
    });
    createdPlanIds.push(testPlan.id);

    // Create seeded pending payments
    const p1 = await adminPb.collection('payments').create({
      user: testCustomer.id,
      plan: testPlan.id,
      amount: 299,
      currency: 'BDT',
      provider: 'mock',
      provider_ref: 'MOCK_TXN_VERIFY_100',
      status: 'pending',
    });
    createdPaymentIds.push(p1.id);

    const p2 = await adminPb.collection('payments').create({
      user: testCustomer.id,
      plan: testPlan.id,
      amount: 999,
      currency: 'BDT',
      provider: 'mock',
      provider_ref: 'MOCK_ORDER_RAW_1',
      status: 'pending',
    });
    createdPaymentIds.push(p2.id);

    const p3 = await adminPb.collection('payments').create({
      user: testCustomer.id,
      plan: testPlan.id,
      amount: 299,
      currency: 'BDT',
      provider: 'mock',
      provider_ref: 'MOCK_TXN_NO_CREDIT_TEST',
      status: 'pending',
    });
    createdPaymentIds.push(p3.id);

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

  // --------------------------------------------------------------------------
  // 1. Valid Signed Webhook
  // --------------------------------------------------------------------------
  describe('Valid Signed Webhook Notifications', () => {
    it('accepts valid signed Mock webhook and returns HTTP 200 with normalized response', async () => {
      const payloadObj = {
        providerRef: 'MOCK_TXN_VERIFY_100',
        amount: 299,
        currency: 'BDT',
        status: 'success',
      };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      const signature = mockAdapter.computeSignature(rawBody);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.verified, true);
      assert.equal(body.data.provider, 'mock');
      assert.equal(body.data.providerRef, 'MOCK_TXN_VERIFY_100');
      assert.equal(body.data.status, 'success');
    });

    it('preserves raw body before JSON parsing without string reconstruction artifacts', async () => {
      // Create raw payload with specific key ordering and formatting
      const rawString = '{"z_last":1,"a_first":"test","amount":999,"providerRef":"MOCK_ORDER_RAW_1"}';
      const rawBody = Buffer.from(rawString, 'utf8');
      const signature = mockAdapter.computeSignature(rawBody);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.verified, true);
      assert.equal(body.data.providerRef, 'MOCK_ORDER_RAW_1');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cryptographic Signature Validations
  // --------------------------------------------------------------------------
  describe('Cryptographic Signature Validations & Rejections', () => {
    it('rejects webhook missing signature header with HTTP 400', async () => {
      const payloadObj = { providerRef: 'MOCK_UNSIGNED', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No x-mock-signature header
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Missing cryptographic signature header'));
    });

    it('rejects invalid signature with HTTP 400', async () => {
      const payloadObj = { providerRef: 'MOCK_INVALID_SIG', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      // Valid hex format (64 chars) but wrong secret/digest
      const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': forgedSignature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('signature verification failed'));
    });

    it('rejects malformed signature containing non-hex characters with HTTP 400', async () => {
      const payloadObj = { providerRef: 'MOCK_MALFORMED_SIG', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      const malformedSignature = 'not_a_valid_hex_signature_with_special_chars!@#$%^&*()_+';

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': malformedSignature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Malformed cryptographic signature format'));
    });

    it('rejects signature with length mismatch (not 64 hex chars) with HTTP 400', async () => {
      const payloadObj = { providerRef: 'MOCK_SHORT_SIG', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      // 32 hex chars instead of 64
      const shortSignature = '0123456789abcdef0123456789abcdef';

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': shortSignature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('length mismatch'));
    });

    it('rejects webhook when raw body is modified after signing with HTTP 400', async () => {
      const originalPayload = { providerRef: 'MOCK_ORDER_ORIGINAL', amount: 299 };
      const signature = mockAdapter.computeSignature(JSON.stringify(originalPayload));

      // Tamper with the body after signing
      const tamperedPayload = { providerRef: 'MOCK_ORDER_ORIGINAL', amount: 1 }; // amount altered
      const tamperedBody = Buffer.from(JSON.stringify(tamperedPayload), 'utf8');

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: tamperedBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('signature verification failed'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Body Format & Payload Errors
  // --------------------------------------------------------------------------
  describe('Body Format & Payload Rejections', () => {
    it('rejects empty request body with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        body: '',
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('body'));
    });

    it('rejects malformed non-JSON request body with HTTP 400', async () => {
      const malformedJson = '{"broken_json": [unclosed';
      const signature = mockAdapter.computeSignature(malformedJson);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: malformedJson,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
    });

    it('rejects unsupported provider parameter with HTTP 400', async () => {
      const payloadObj = { providerRef: 'MOCK_UNSUPPORTED', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      const signature = mockAdapter.computeSignature(rawBody);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook?provider=unsupported_gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Unsupported payment provider'));
    });

    it('handles provider adapter throwing an error during verification with HTTP 400', async () => {
      mockAdapter.setMode('throw_verify');

      const payloadObj = { providerRef: 'MOCK_THROW', amount: 299 };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      const signature = mockAdapter.computeSignature(rawBody);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: rawBody,
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Webhook verification failed'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Strict Boundary: No Credit Allocation or Subscription Activation
  // --------------------------------------------------------------------------
  describe('Strict Boundary Verification (No Credit or Subscription Mutation)', () => {
    it('verifies that successful webhook verification NEVER creates subscriptions or allocates credits', async () => {
      // 1. Snapshot all subscriptions in database before webhook
      const subsBefore = await adminPb.collection('user_subscriptions').getFullList();

      // 2. Send verified webhook
      const payloadObj = {
        providerRef: 'MOCK_TXN_NO_CREDIT_TEST',
        amount: 299,
        currency: 'BDT',
        status: 'success',
      };
      const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
      const signature = mockAdapter.computeSignature(rawBody);

      const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-signature': signature,
        },
        body: rawBody,
      });

      assert.equal(res.status, 200);

      // 3. Snapshot all subscriptions after webhook
      const subsAfter = await adminPb.collection('user_subscriptions').getFullList();
      assert.equal(subsAfter.length, subsBefore.length);
    });
  });
});

