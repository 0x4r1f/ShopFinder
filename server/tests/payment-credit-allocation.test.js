import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { paymentService } from '../src/services/paymentService.js';
import { getCustomerSubscriptionBalance } from '../src/services/customer.service.js';
import { revealContactForCustomer } from '../src/services/revealService.js';

describe('Phase 11, Task 11.6 — Server-Side Credit Top-Up & Subscription Activation', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';
  let mockAdapter = null;

  let testCustomer = null;
  let testOwner = null;
  let testListing = null;
  let testContact = null;

  let starterPlan = null;
  let proPlan = null;
  let inactivePlan = null;

  const createdUserIds = [];
  const createdPlanIds = [];
  const createdPaymentIds = [];
  const createdSubIds = [];
  const createdListingIds = [];
  const createdContactIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 7);

  async function dispatchSignedWebhook(payloadObj, headers = {}) {
    const rawBody = Buffer.from(JSON.stringify(payloadObj), 'utf8');
    const signature = mockAdapter.computeSignature(rawBody);

    const res = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mock-signature': signature,
        ...headers,
      },
      body: rawBody,
    });

    return res;
  }

  before(async () => {
    adminPb = await getAdminClient();
    paymentService.setDefaultProviderName('mock');
    mockAdapter = paymentService.getAdapter('mock');

    const timestamp = Date.now();

    // 1. Create test customer
    testCustomer = await adminPb.collection('users').create({
      email: `customer_topup_${timestamp}_${rand()}@shopfinder.test`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Credit TopUp Customer',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer.id);

    // 2. Create test commercial owner with private contact and approved listing (for reveal test)
    testOwner = await adminPb.collection('users').create({
      email: `owner_topup_${timestamp}_${rand()}@shopfinder.test`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Owner TopUp Commercial',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner.id);

    testContact = await adminPb.collection('owner_contacts').create({
      owner: testOwner.id,
      phone: '+8801712345678',
    });
    createdContactIds.push(testContact.id);

    testListing = await adminPb.collection('listings').create({
      title: `Listing For TopUp Verification ${timestamp}`,
      description: 'A commercial retail space for contact reveal integration test',
      owner: testOwner.id,
      status: 'approved',
      city: 'Dhaka',
      area: 'Gulshan',
      address: '102 Gulshan Avenue, Dhaka',
      price: 45000,
      area_sqft: 850,
      category: 'retail',
      listing_type: 'rent',
    });
    createdListingIds.push(testListing.id);

    // 3. Create test subscription plans
    starterPlan = await adminPb.collection('subscription_plans').create({
      name: `Starter Plan ${timestamp}`,
      price: 299,
      credits: 10,
      is_active: true,
      description: 'Starter 10 credits package',
    });
    createdPlanIds.push(starterPlan.id);

    proPlan = await adminPb.collection('subscription_plans').create({
      name: `Pro Plan ${timestamp}`,
      price: 999,
      credits: 100,
      is_active: true,
      description: 'Pro 100 credits package',
    });
    createdPlanIds.push(proPlan.id);

    inactivePlan = await adminPb.collection('subscription_plans').create({
      name: `Inactive Plan ${timestamp}`,
      price: 499,
      credits: 25,
      is_active: false,
      description: 'Inactive test package',
    });
    createdPlanIds.push(inactivePlan.id);

    // 4. Start ephemeral server
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

    // Cleanup created test records
    for (const id of createdRevealIds) {
      try { await adminPb.collection('revealed_contacts').delete(id); } catch {}
    }
    for (const id of createdListingIds) {
      try { await adminPb.collection('listings').delete(id); } catch {}
    }
    for (const id of createdContactIds) {
      try { await adminPb.collection('owner_contacts').delete(id); } catch {}
    }
    for (const id of createdPaymentIds) {
      try { await adminPb.collection('payments').delete(id); } catch {}
    }
    for (const id of createdSubIds) {
      try { await adminPb.collection('user_subscriptions').delete(id); } catch {}
    }
    for (const id of createdPlanIds) {
      try { await adminPb.collection('subscription_plans').delete(id); } catch {}
    }
    for (const id of createdUserIds) {
      try { await adminPb.collection('users').delete(id); } catch {}
    }
  });

  beforeEach(() => {
    mockAdapter.setMode('normal');
  });

  // --------------------------------------------------------------------------
  // 1-5. Core Subscription Activation & Field Invariants
  // --------------------------------------------------------------------------
  describe('Core Subscription Activation & Field Invariants', () => {
    it('1. Successful payment creates exactly one subscription', async () => {
      const ref = `SF_TEST_SUB_CREATE_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
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
        currency: 'BDT',
        status: 'success',
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.duplicate, false);
      assert.equal(body.data.alreadyProcessed, false);
      assert.equal(body.data.status, 'success');
      assert.ok(body.data.subscriptionId, 'response must include created subscriptionId');
      createdSubIds.push(body.data.subscriptionId);

      const subsAfter = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: testCustomer.id }),
      });

      assert.equal(subsAfter.length, subsBefore.length + 1);
    });

    it('2. Correct credits are allocated from the trusted plan', async () => {
      const ref = `SF_TEST_CREDITS_TOTAL_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
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

      assert.equal(res.status, 200);
      const body = await res.json();
      createdSubIds.push(body.data.subscriptionId);

      const subRecord = await adminPb.collection('user_subscriptions').getOne(body.data.subscriptionId);
      assert.equal(subRecord.credits_total, 10);
      assert.equal(body.data.creditsTotal, 10);
      assert.equal(body.data.creditsAllocated, 10);
    });

    it('3. credits_used = 0 on newly created subscription', async () => {
      const ref = `SF_TEST_CREDITS_USED_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
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

      assert.equal(res.status, 200);
      const body = await res.json();
      createdSubIds.push(body.data.subscriptionId);

      const subRecord = await adminPb.collection('user_subscriptions').getOne(body.data.subscriptionId);
      assert.equal(subRecord.credits_used, 0);
      assert.equal(subRecord.status, 'active');
      assert.equal(body.data.creditsUsed, 0);
    });

    it('4. expires_at = null (credits never expire per D-001)', async () => {
      const ref = `SF_TEST_EXPIRES_NULL_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
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

      assert.equal(res.status, 200);
      const body = await res.json();
      createdSubIds.push(body.data.subscriptionId);

      const subRecord = await adminPb.collection('user_subscriptions').getOne(body.data.subscriptionId);
      assert.ok(subRecord.expires_at === null || subRecord.expires_at === '', 'expires_at must be null or empty');
      assert.ok(subRecord.purchased_at, 'purchased_at must be populated');
    });

    it('5. Payment is linked to the new subscription and marked success', async () => {
      const ref = `SF_TEST_LINK_PAYMENT_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
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

      assert.equal(res.status, 200);
      const body = await res.json();
      createdSubIds.push(body.data.subscriptionId);

      const updatedPayment = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(updatedPayment.status, 'success');
      assert.equal(updatedPayment.subscription, body.data.subscriptionId);
    });
  });

  // --------------------------------------------------------------------------
  // 6-7. D-001 Credit Stacking Invariants
  // --------------------------------------------------------------------------
  describe('D-001 Credit Stacking Invariants', () => {
    it('6. Existing subscription records remain unchanged when a new package is purchased', async () => {
      // Create dedicated customer for strict stacking verification
      const stackCustomer = await adminPb.collection('users').create({
        email: `stack_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Stack Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(stackCustomer.id);

      // Pre-seed an existing active subscription with partially used credits
      const existingSub = await adminPb.collection('user_subscriptions').create({
        user: stackCustomer.id,
        plan: starterPlan.id,
        credits_total: 10,
        credits_used: 4,
        status: 'active',
        purchased_at: new Date(Date.now() - 86400000).toISOString(),
      });
      createdSubIds.push(existingSub.id);

      // New payment for Pro plan
      const ref = `SF_STACK_PURCHASE_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: stackCustomer.id,
        plan: proPlan.id,
        amount: 999,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 999,
        currency: 'BDT',
        status: 'success',
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      createdSubIds.push(body.data.subscriptionId);

      // Verify the previous subscription record was NOT mutated
      const reloadedExistingSub = await adminPb.collection('user_subscriptions').getOne(existingSub.id);
      assert.equal(reloadedExistingSub.credits_total, 10);
      assert.equal(reloadedExistingSub.credits_used, 4);
      assert.equal(reloadedExistingSub.status, 'active');
    });

    it('7. Multiple purchases stack correctly (sum of remaining credits across all active packages)', async () => {
      const multiCustomer = await adminPb.collection('users').create({
        email: `multi_stack_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Multi Stack Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(multiCustomer.id);

      // 1. Purchase Starter (10 credits)
      const ref1 = `SF_MULTI_1_${Date.now()}_${rand()}`;
      const p1 = await adminPb.collection('payments').create({
        user: multiCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref1,
        status: 'pending',
      });
      createdPaymentIds.push(p1.id);

      const res1 = await dispatchSignedWebhook({
        providerRef: ref1,
        amount: 299,
        status: 'success',
      });
      assert.equal(res1.status, 200);
      const body1 = await res1.json();
      createdSubIds.push(body1.data.subscriptionId);

      // 2. Purchase Pro (100 credits)
      const ref2 = `SF_MULTI_2_${Date.now()}_${rand()}`;
      const p2 = await adminPb.collection('payments').create({
        user: multiCustomer.id,
        plan: proPlan.id,
        amount: 999,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref2,
        status: 'pending',
      });
      createdPaymentIds.push(p2.id);

      const res2 = await dispatchSignedWebhook({
        providerRef: ref2,
        amount: 999,
        status: 'success',
      });
      assert.equal(res2.status, 200);
      const body2 = await res2.json();
      createdSubIds.push(body2.data.subscriptionId);

      // Authoritative customer subscription balance query
      const balance = await getCustomerSubscriptionBalance(multiCustomer.id);
      assert.equal(balance.active_subscriptions_count, 2);
      assert.equal(balance.credits_remaining, 110); // 10 + 100
      assert.equal(balance.subscriptions.length, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 8-10. Idempotency, Concurrency & Failed Payment
  // --------------------------------------------------------------------------
  describe('Idempotency, Concurrency & Failed Payment', () => {
    it('8. Duplicate webhook does not allocate credits twice', async () => {
      const idempCustomer = await adminPb.collection('users').create({
        email: `idemp_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Idempotency Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(idempCustomer.id);

      const ref = `SF_DUP_TEST_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: idempCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // First webhook
      const res1 = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });
      assert.equal(res1.status, 200);
      const body1 = await res1.json();
      assert.equal(body1.data.alreadyProcessed, false);
      assert.equal(body1.data.creditsAllocated, 10);
      createdSubIds.push(body1.data.subscriptionId);

      const balance1 = await getCustomerSubscriptionBalance(idempCustomer.id);
      assert.equal(balance1.credits_remaining, 10);
      assert.equal(balance1.active_subscriptions_count, 1);

      // Second (duplicate) webhook
      const res2 = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });
      assert.equal(res2.status, 200);
      const body2 = await res2.json();
      assert.equal(body2.data.duplicate, true);
      assert.equal(body2.data.alreadyProcessed, true);
      assert.equal(body2.data.creditsAllocated, 0);

      const balance2 = await getCustomerSubscriptionBalance(idempCustomer.id);
      assert.equal(balance2.credits_remaining, 10);
      assert.equal(balance2.active_subscriptions_count, 1);
    });

    it('9. Concurrent duplicate webhooks produce exactly one allocation', async () => {
      const raceCustomer = await adminPb.collection('users').create({
        email: `race_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Race Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(raceCustomer.id);

      const ref = `SF_RACE_TEST_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: raceCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Dispatch 3 concurrent webhook requests with identical provider_ref
      const [res1, res2, res3] = await Promise.all([
        dispatchSignedWebhook({ providerRef: ref, amount: 299, status: 'success' }),
        dispatchSignedWebhook({ providerRef: ref, amount: 299, status: 'success' }),
        dispatchSignedWebhook({ providerRef: ref, amount: 299, status: 'success' }),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      assert.equal(res3.status, 200);

      const [body1, body2, body3] = await Promise.all([res1.json(), res2.json(), res3.json()]);

      const newProcessingCount = [body1, body2, body3].filter(
        (b) => b.data?.alreadyProcessed === false && b.data?.duplicate === false
      ).length;
      const duplicateCount = [body1, body2, body3].filter(
        (b) => b.data?.alreadyProcessed === true && b.data?.duplicate === true
      ).length;

      assert.equal(newProcessingCount, 1, 'Exactly one webhook must process as new');
      assert.equal(duplicateCount, 2, 'The other 2 webhooks must be caught as duplicates');

      // Verify database state: exactly 1 subscription created
      const subs = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: raceCustomer.id }),
      });
      assert.equal(subs.length, 1);
      createdSubIds.push(subs[0].id);

      const balance = await getCustomerSubscriptionBalance(raceCustomer.id);
      assert.equal(balance.credits_remaining, 10);
      assert.equal(balance.active_subscriptions_count, 1);
    });

    it('10. Failed payment allocates zero credits and creates zero subscriptions', async () => {
      const failCustomer = await adminPb.collection('users').create({
        email: `fail_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Fail Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(failCustomer.id);

      const ref = `SF_FAIL_TEST_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: failCustomer.id,
        plan: starterPlan.id,
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

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.status, 'failed');
      assert.equal(body.data.creditsAllocated, 0);

      const subs = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: failCustomer.id }),
      });
      assert.equal(subs.length, 0);

      const balance = await getCustomerSubscriptionBalance(failCustomer.id);
      assert.equal(balance.credits_remaining, 0);
      assert.equal(balance.active_subscriptions_count, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 11-15. Guard Validations & Transaction Rollback
  // --------------------------------------------------------------------------
  describe('Guard Validations & Transaction Rollback', () => {
    it('11. Amount mismatch between webhook/plan and payment is rejected with HTTP 400', async () => {
      const ref = `SF_AMT_MISMATCH_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Webhook claims amount is 199 instead of 299
      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 199,
        status: 'success',
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Amount mismatch'));

      // Payment remains pending, zero subscriptions created
      const reloadedPayment = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(reloadedPayment.status, 'pending');
      assert.ok(!reloadedPayment.subscription);
    });

    it('12. Currency mismatch between webhook and payment is rejected with HTTP 400', async () => {
      const ref = `SF_CURR_MISMATCH_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Webhook claims currency is USD
      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        currency: 'USD',
        status: 'success',
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Currency mismatch'));

      const reloadedPayment = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(reloadedPayment.status, 'pending');
    });

    it('13. Inactive plan is rejected with HTTP 400', async () => {
      const ref = `SF_INACTIVE_PLAN_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: inactivePlan.id,
        amount: 499,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 499,
        currency: 'BDT',
        status: 'success',
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('inactive'));

      const reloadedPayment = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(reloadedPayment.status, 'pending');
    });

    it('14. Provider mismatch is rejected with HTTP 400', async () => {
      const ref = `SF_PROV_MISMATCH_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: testCustomer.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'sslcommerz', // record provider is sslcommerz
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Webhook arrives via mock provider
      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Provider mismatch'));
    });

    it('15. Transaction failure rolls back payment and subscription mutations', async () => {
      const rollbackCust = await adminPb.collection('users').create({
        email: `rollback_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Rollback Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(rollbackCust.id);

      const ref = `SF_TXN_FAIL_ROLLBACK_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: rollbackCust.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref,
        status: 'pending',
      });
      createdPaymentIds.push(payment.id);

      // Webhook with simulated failure after subscription save
      const res = await dispatchSignedWebhook({
        providerRef: ref,
        amount: 299,
        status: 'success',
        simulateFailureAfterSubSave: true,
      });

      assert.ok(res.status >= 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.message.includes('Simulated failure after subscription creation'));

      // Check SQLite transaction rollback:
      // 1. Payment status remains pending
      const reloadedPayment = await adminPb.collection('payments').getOne(payment.id);
      assert.equal(reloadedPayment.status, 'pending');
      assert.ok(!reloadedPayment.subscription);

      // 2. Zero user_subscriptions exist for this customer
      const subs = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:user}', { user: rollbackCust.id }),
      });
      assert.equal(subs.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 16-17. Integration with Reveal Engine & Balance Aggregation
  // --------------------------------------------------------------------------
  describe('Integration with Reveal Engine & Balance Aggregation', () => {
    it('16. Existing reveal credit consumption still works correctly after payment top-up', async () => {
      const revealCust = await adminPb.collection('users').create({
        email: `reveal_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Reveal Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(revealCust.id);

      // 1. Top up 10 credits via successful payment
      const ref = `SF_REVEAL_PAY_${Date.now()}_${rand()}`;
      const payment = await adminPb.collection('payments').create({
        user: revealCust.id,
        plan: starterPlan.id,
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
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      const subId = body.data.subscriptionId;
      createdSubIds.push(subId);

      // 2. Execute contact reveal using Phase 10 reveal workflow
      const revealResult = await revealContactForCustomer({
        customerId: revealCust.id,
        listingId: testListing.id,
      });
      assert.equal(revealResult.creditDeducted, true);
      assert.equal(revealResult.creditsDeducted, 1);
      assert.equal(revealResult.creditsRemaining, 9);
      assert.equal(revealResult.phone, '+8801712345678');
      createdRevealIds.push(revealResult.revealId);

      // 3. Verify underlying subscription has credits_used = 1
      const updatedSub = await adminPb.collection('user_subscriptions').getOne(subId);
      assert.equal(updatedSub.credits_used, 1);
      assert.equal(updatedSub.credits_total, 10);
    });

    it('17. Existing customer credit balance aggregation remains correct across all packages', async () => {
      const aggCust = await adminPb.collection('users').create({
        email: `agg_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Agg Customer',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(aggCust.id);

      // Check balance when 0 packages exist
      const initialBal = await getCustomerSubscriptionBalance(aggCust.id);
      assert.equal(initialBal.credits_remaining, 0);
      assert.equal(initialBal.active_subscriptions_count, 0);

      // Top up first package (Starter: 10 credits)
      const ref1 = `SF_AGG_1_${Date.now()}_${rand()}`;
      const p1 = await adminPb.collection('payments').create({
        user: aggCust.id,
        plan: starterPlan.id,
        amount: 299,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref1,
        status: 'pending',
      });
      createdPaymentIds.push(p1.id);

      await dispatchSignedWebhook({ providerRef: ref1, amount: 299, status: 'success' });

      const balAfterP1 = await getCustomerSubscriptionBalance(aggCust.id);
      assert.equal(balAfterP1.credits_remaining, 10);
      assert.equal(balAfterP1.active_subscriptions_count, 1);

      // Top up second package (Pro: 100 credits)
      const ref2 = `SF_AGG_2_${Date.now()}_${rand()}`;
      const p2 = await adminPb.collection('payments').create({
        user: aggCust.id,
        plan: proPlan.id,
        amount: 999,
        currency: 'BDT',
        provider: 'mock',
        provider_ref: ref2,
        status: 'pending',
      });
      createdPaymentIds.push(p2.id);

      await dispatchSignedWebhook({ providerRef: ref2, amount: 999, status: 'success' });

      const balAfterP2 = await getCustomerSubscriptionBalance(aggCust.id);
      assert.equal(balAfterP2.credits_remaining, 110);
      assert.equal(balAfterP2.active_subscriptions_count, 2);

      // Cleanly track created subscriptions for teardown
      for (const s of balAfterP2.subscriptions) {
        createdSubIds.push(s.id);
      }
    });
  });
});
