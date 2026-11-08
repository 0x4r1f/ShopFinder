import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { paymentService } from '../src/services/paymentService.js';
import { MockPaymentAdapter } from '../src/services/providers/mockAdapter.js';

describe('Phase 11, Task 11.3 — Payment Initiation Endpoint (POST /api/v1/payments/initiate)', () => {
  let adminPb;
  let server;
  let baseUrl;
  let mockAdapter;

  const timestamp = Date.now();
  const testPassword = 'Password123!';

  let testCustomer;
  let customerCookie;
  let testOwner;
  let ownerCookie;
  let testAdmin;
  let adminCookie;

  let activePlan;
  let inactivePlan;

  const createdUserIds = [];
  const createdPlanIds = [];
  const createdPaymentIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // Set up and register mock adapter for deterministic testing
    mockAdapter = new MockPaymentAdapter();
    paymentService.registerAdapter(mockAdapter);
    paymentService.setDefaultProviderName('mock');

    // 1. Create Active Test Plan (Starter: ৳299, 10 credits)
    activePlan = await adminPb.collection('subscription_plans').create({
      name: `Active Starter ${timestamp}`,
      price: 299,
      credits: 10,
      is_active: true,
      description: 'Active test plan',
    });
    createdPlanIds.push(activePlan.id);

    // 2. Create Inactive Test Plan
    inactivePlan = await adminPb.collection('subscription_plans').create({
      name: `Inactive Plan ${timestamp}`,
      price: 999,
      credits: 100,
      is_active: false,
      description: 'Inactive test plan',
    });
    createdPlanIds.push(inactivePlan.id);

    // 3. Create Test Customer
    testCustomer = await adminPb.collection('users').create({
      email: `cust_${timestamp}@shopfinder.local`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Test Customer 11.3',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer.id);

    // Authenticate Customer to obtain pb_auth token
    const custPb = new PocketBase(env.POCKETBASE_URL);
    const custAuth = await custPb.collection('users').authWithPassword(testCustomer.email, testPassword);
    customerCookie = `pb_auth=${custAuth.token}`;

    // 4. Create Test Owner
    testOwner = await adminPb.collection('users').create({
      email: `owner_${timestamp}@shopfinder.local`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Test Owner 11.3',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner.id);

    const ownerPb = new PocketBase(env.POCKETBASE_URL);
    const ownerAuth = await ownerPb.collection('users').authWithPassword(testOwner.email, testPassword);
    ownerCookie = `pb_auth=${ownerAuth.token}`;

    // 5. Create Test Admin
    testAdmin = await adminPb.collection('users').create({
      email: `admin_${timestamp}@shopfinder.local`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Test Admin 11.3',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(testAdmin.id);

    const adminUserPb = new PocketBase(env.POCKETBASE_URL);
    const adminUserAuth = await adminUserPb.collection('users').authWithPassword(testAdmin.email, testPassword);
    adminCookie = `pb_auth=${adminUserAuth.token}`;

    // 6. Start ephemeral Express server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Teardown HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Teardown created payments
    for (const id of createdPaymentIds) {
      try {
        await adminPb.collection('payments').delete(id);
      } catch {}
    }

    // Teardown plans
    for (const id of createdPlanIds) {
      try {
        await adminPb.collection('subscription_plans').delete(id);
      } catch {}
    }

    // Teardown users
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
  // 1. Successful Payment Initiation
  // --------------------------------------------------------------------------
  describe('Successful Payment Initiation', () => {
    it('initiates payment successfully with HTTP 201 and normalized response', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.ok(body.data.paymentId);
      assert.equal(body.data.provider, 'mock');
      assert.ok(body.data.providerRef.startsWith('MOCK_TXN_SF_TXN_'));
      assert.ok(body.data.redirectUrl.includes('https://mock-gateway.shopfinder.local/checkout'));
      assert.equal(body.data.amount, 299);
      assert.equal(body.data.currency, 'BDT');
      assert.equal(body.data.plan.id, activePlan.id);
      assert.equal(body.data.plan.credits, 10);

      createdPaymentIds.push(body.data.paymentId);

      // Verify payment record in PocketBase
      const record = await adminPb.collection('payments').getOne(body.data.paymentId);
      assert.equal(record.user, testCustomer.id);
      assert.equal(record.plan, activePlan.id);
      assert.equal(record.amount, 299);
      assert.equal(record.currency, 'BDT');
      assert.equal(record.status, 'pending');
      assert.equal(record.provider, 'mock');
      assert.ok(record.provider_ref);
    });

    it('verifies amount and currency are derived strictly from database plan record', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      createdPaymentIds.push(body.data.paymentId);

      assert.equal(body.data.amount, activePlan.price);
      assert.equal(body.data.currency, 'BDT');
    });

    it('confirms zero subscription creation and zero credit allocation during initiation', async () => {
      const subsBefore = await adminPb.collection('user_subscriptions').getFullList({
        filter: `user = "${testCustomer.id}"`,
      });

      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      createdPaymentIds.push(body.data.paymentId);

      const subsAfter = await adminPb.collection('user_subscriptions').getFullList({
        filter: `user = "${testCustomer.id}"`,
      });

      assert.equal(subsAfter.length, subsBefore.length);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Authentication and Authorization (RBAC)
  // --------------------------------------------------------------------------
  describe('Authentication and RBAC Guards', () => {
    it('rejects unauthenticated request with HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 401);
      assert.equal(body.success, false);
    });

    it('rejects owner role with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.success, false);
    });

    it('rejects admin role with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Plan Validation
  // --------------------------------------------------------------------------
  describe('Plan Existence and Active Status Validation', () => {
    it('rejects missing planId with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Plan ID is required'));
    });

    it('rejects nonexistent planId with HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: 'nonexistent_plan_id' }),
      });

      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Subscription plan not found'));
    });

    it('rejects inactive plan with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: inactivePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('not active'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Anti-Tampering & Client Override Protection
  // --------------------------------------------------------------------------
  describe('Anti-Tampering & Client Override Protection', () => {
    it('rejects client attempt to inject amount override with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
          amount: 1, // Tampered amount
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('cannot override trusted payment attribute'));
    });

    it('rejects client attempt to inject user/customerId with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
          customerId: 'other_user_id',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('cannot override trusted payment attribute'));
    });

    it('rejects client attempt to inject provider_ref or status with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
          provider_ref: 'FORGED_REF',
          status: 'success',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('cannot override trusted payment attribute'));
    });
  });

  // --------------------------------------------------------------------------
  // 5. Provider Failure Handling
  // --------------------------------------------------------------------------
  describe('Provider Adapter Failure Handling', () => {
    it('marks payment record as failed and returns HTTP 502 when gateway throws', async () => {
      mockAdapter.setMode('throw_initiate');

      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 502);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Payment gateway initiation failed'));

      // Check payments collection for the failed record
      const recentPayments = await adminPb.collection('payments').getList(1, 1, {
        filter: adminPb.filter('user = {:user} && status = {:status}', {
          user: testCustomer.id,
          status: 'failed',
        }),
        sort: '-created',
      });

      assert.ok(recentPayments.items.length > 0);
      const failedRecord = recentPayments.items[0];
      createdPaymentIds.push(failedRecord.id);
      assert.equal(failedRecord.status, 'failed');
    });

    it('rejects unsupported provider name with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: env.CLIENT_URL,
        },
        body: JSON.stringify({
          planId: activePlan.id,
          provider: 'unsupported_provider',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Unsupported payment provider'));
    });
  });

  // --------------------------------------------------------------------------
  // 6. CSRF & Origin Enforcement
  // --------------------------------------------------------------------------
  describe('CSRF & Origin Protection', () => {
    it('rejects POST request with mismatched Origin header with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
          Origin: 'http://malicious-site.example.com',
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.success, false);
    });

    it('rejects POST request with missing Origin and Referer with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: customerCookie,
        },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.success, false);
    });
  });
});
