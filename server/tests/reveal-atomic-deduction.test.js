import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';
import {
  delegateRevealTransaction,
  getTrustedCustomerId,
  rejectClientIdentityOverride,
} from '../src/services/revealService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const hookFilePath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'reveal.pb.js');

describe('Phase 10, Task 10.5 — Atomic Credit Deduction & Reveal Record Creation (D-001 & D-013)', () => {
  let adminPb = null;
  let superuserToken = null;
  const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/reveal`;

  let starterPlan = null;
  let proPlan = null;

  let testOwner = null;
  let testListingApproved = null;
  let testListingPending = null;
  let testListingSecond = null;
  let testListingConcurrent = null;

  let customerSingle = null;
  let subSingle = null;

  let customerMulti = null;
  let subMultiOld = null;
  let subMultiNew = null;

  let customerZero = null;
  let subZero = null;

  let customerOther = null;
  let subOther = null;

  let customerConcurrent = null;
  let subConcurrent = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdSubIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 6);

  before(async () => {
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    const timestamp = Date.now();

    // 1. Fetch active subscription plans
    starterPlan = await adminPb.collection('subscription_plans').getFirstListItem('name = "Starter" && is_active = true');
    proPlan = await adminPb.collection('subscription_plans').getFirstListItem('name = "Pro" && is_active = true');

    // 2. Create test commercial owner and contact phone
    testOwner = await adminPb.collection('users').create({
      email: `test.owner.10_5.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Owner Task 10.5',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner.id);

    await adminPb.collection('owner_contacts').create({
      owner: testOwner.id,
      phone: '+8801712345678',
    });

    // 3. Create listings for testOwner
    testListingApproved = await adminPb.collection('listings').create({
      title: `Approved Shop Task 10.5 ${timestamp}`,
      description: 'Approved retail shop for atomic reveal testing',
      price: 45000,
      area_sqft: 800,
      address: '100 Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });
    createdListingIds.push(testListingApproved.id);

    testListingPending = await adminPb.collection('listings').create({
      title: `Pending Shop Task 10.5 ${timestamp}`,
      description: 'Unapproved listing for status rejection testing',
      price: 30000,
      area_sqft: 500,
      address: '200 Road, Gulshan',
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'office',
      listing_type: 'rent',
      status: 'pending',
      owner: testOwner.id,
    });
    createdListingIds.push(testListingPending.id);

    testListingSecond = await adminPb.collection('listings').create({
      title: `Second Approved Shop ${timestamp}`,
      description: 'Second approved listing for multi-package testing',
      price: 60000,
      area_sqft: 1200,
      address: '300 Road, Banani',
      city: 'Dhaka',
      area: 'Banani',
      category: 'showroom',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });
    createdListingIds.push(testListingSecond.id);

    testListingConcurrent = await adminPb.collection('listings').create({
      title: `Concurrent Reveal Shop ${timestamp}`,
      description: 'Listing for concurrency and race condition testing',
      price: 75000,
      area_sqft: 1500,
      address: '400 Road, Uttara',
      city: 'Dhaka',
      area: 'Uttara',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner.id,
    });
    createdListingIds.push(testListingConcurrent.id);

    // 4. Customer Single: 1 active Starter subscription (10 total, 0 used -> 10 available)
    customerSingle = await adminPb.collection('users').create({
      email: `test.cust.single.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Single Package',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerSingle.id);

    subSingle = await adminPb.collection('user_subscriptions').create({
      user: customerSingle.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'active',
      purchased_at: new Date(timestamp - 200000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subSingle.id);

    // 5. Customer Multi: 2 active subscriptions (FIFO: older Starter 10 total/5 used -> 5 rem; newer Pro 100 total/10 used -> 90 rem. Aggregate: 95)
    customerMulti = await adminPb.collection('users').create({
      email: `test.cust.multi.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Multi Package',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerMulti.id);

    subMultiOld = await adminPb.collection('user_subscriptions').create({
      user: customerMulti.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 5,
      status: 'active',
      purchased_at: new Date(timestamp - 300000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subMultiOld.id);

    subMultiNew = await adminPb.collection('user_subscriptions').create({
      user: customerMulti.id,
      plan: proPlan.id,
      credits_total: 100,
      credits_used: 10,
      status: 'active',
      purchased_at: new Date(timestamp - 100000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subMultiNew.id);

    // 6. Customer Zero: Depleted package (10 total, 10 used -> 0 remaining)
    customerZero = await adminPb.collection('users').create({
      email: `test.cust.zero.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Zero Credits',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerZero.id);

    subZero = await adminPb.collection('user_subscriptions').create({
      user: customerZero.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 10,
      status: 'active',
      purchased_at: new Date(timestamp - 400000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subZero.id);

    // 7. Customer Other: Isolated customer to verify isolation
    customerOther = await adminPb.collection('users').create({
      email: `test.cust.other.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Other',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerOther.id);

    subOther = await adminPb.collection('user_subscriptions').create({
      user: customerOther.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subOther.id);

    // 8. Customer Concurrent: Fresh customer for concurrency tests
    customerConcurrent = await adminPb.collection('users').create({
      email: `test.cust.concur.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Concurrent',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerConcurrent.id);

    subConcurrent = await adminPb.collection('user_subscriptions').create({
      user: customerConcurrent.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'active',
      purchased_at: new Date().toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subConcurrent.id);
  });

  after(async () => {
    if (adminPb) {
      // Clean up reveals created during testing
      for (const id of createdRevealIds) {
        try {
          await adminPb.collection('revealed_contacts').delete(id);
        } catch {}
      }
      // Clean up any other reveals for our test customers
      for (const uId of createdUserIds) {
        try {
          const revs = await adminPb.collection('revealed_contacts').getFullList({
            filter: adminPb.filter('customer = {:u}', { u: uId }),
          });
          for (const r of revs) {
            try {
              await adminPb.collection('revealed_contacts').delete(r.id);
            } catch {}
          }
        } catch {}
      }

      // Clean up subscriptions
      for (const sId of createdSubIds) {
        try {
          await adminPb.collection('user_subscriptions').delete(sId);
        } catch {}
      }

      // Clean up listings
      for (const lId of createdListingIds) {
        try {
          await adminPb.collection('listings').delete(lId);
        } catch {}
      }

      // Clean up owner_contacts
      if (testOwner?.id) {
        try {
          const contact = await adminPb.collection('owner_contacts').getFirstListItem(`owner = "${testOwner.id}"`);
          if (contact) {
            await adminPb.collection('owner_contacts').delete(contact.id);
          }
        } catch {}
      }

      // Clean up users
      for (const uId of createdUserIds) {
        try {
          await adminPb.collection('users').delete(uId);
        } catch {}
      }
    }
  });

  // =========================================================================
  // 1. Atomic Reveal & Credit Deduction (Tests 1–8)
  // =========================================================================
  describe('1. Atomic Reveal & Single Credit Deduction', () => {
    let firstRevealResult = null;

    test('1. First-time reveal deducts exactly one credit', async () => {
      // Customer single had 0 credits used (10 remaining)
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      assert.strictEqual(subBefore.credits_used, 0);

      const res = await delegateRevealTransaction({
        customerId: customerSingle.id,
        listingId: testListingApproved.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'revealed');
      assert.strictEqual(res.data.alreadyRevealed, false);
      assert.strictEqual(res.data.creditDeducted, true);
      assert.strictEqual(res.data.creditsDeducted, 1);
      assert.strictEqual(res.data.transactionCommitted, true);
      firstRevealResult = res.data;
      createdRevealIds.push(res.data.revealId);

      // Verify in SQLite: credits_used incremented by exactly 1
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      assert.strictEqual(subAfter.credits_used, 1, 'credits_used must be incremented from 0 to exactly 1');
    });

    test('2. Exactly one reveal record is created in SQLite', async () => {
      const records = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerSingle.id,
          l: testListingApproved.id,
        }),
      });

      assert.strictEqual(records.length, 1, 'Exactly one revealed_contacts record must exist');
      assert.strictEqual(records[0].id, firstRevealResult.revealId);
    });

    test('3. Correct customer, listing, and owner relations are stored', async () => {
      const revealRecord = await adminPb.collection('revealed_contacts').getOne(firstRevealResult.revealId);
      assert.strictEqual(revealRecord.customer, customerSingle.id);
      assert.strictEqual(revealRecord.listing, testListingApproved.id);
      assert.strictEqual(revealRecord.owner, testOwner.id);
      assert.ok(revealRecord.revealed_at, 'revealed_at must be populated');
    });

    test('4. credits_remaining is accurate after deduction', async () => {
      // 10 initial - 1 used = 9 remaining
      assert.strictEqual(firstRevealResult.creditsRemaining, 9);

      // Verify query via independent subscription check
      const sub = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      const remaining = sub.credits_total - sub.credits_used;
      assert.strictEqual(remaining, 9);
    });

    test('5. Deduction uses exactly one eligible active subscription (FIFO)', async () => {
      // Customer Multi has:
      // - subMultiOld (Starter): 10 total, 5 used -> 5 remaining
      // - subMultiNew (Pro): 100 total, 10 used -> 90 remaining
      const oldBefore = await adminPb.collection('user_subscriptions').getOne(subMultiOld.id);
      const newBefore = await adminPb.collection('user_subscriptions').getOne(subMultiNew.id);
      assert.strictEqual(oldBefore.credits_used, 5);
      assert.strictEqual(newBefore.credits_used, 10);

      const res = await delegateRevealTransaction({
        customerId: customerMulti.id,
        listingId: testListingApproved.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'revealed');
      assert.strictEqual(res.data.deductedSubscriptionId, subMultiOld.id, 'Oldest eligible subscription must be deducted');
      createdRevealIds.push(res.data.revealId);

      // Inspect SQLite: only subMultiOld was incremented by 1
      const oldAfter = await adminPb.collection('user_subscriptions').getOne(subMultiOld.id);
      const newAfter = await adminPb.collection('user_subscriptions').getOne(subMultiNew.id);
      assert.strictEqual(oldAfter.credits_used, 6, 'Old subscription credits_used must become 6');
      assert.strictEqual(newAfter.credits_used, 10, 'New subscription credits_used must remain untouched at 10');
    });

    test('6. Multiple active subscriptions retain correct aggregate balance', async () => {
      // Customer Multi had 95 total remaining. Deducting 1 makes it 94.
      // Reveal another listing (testListingSecond)
      const res = await delegateRevealTransaction({
        customerId: customerMulti.id,
        listingId: testListingSecond.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.creditsDeducted, 1);
      assert.strictEqual(res.data.creditsRemaining, 93); // 95 - 1 (test 5) - 1 (test 6) = 93
      createdRevealIds.push(res.data.revealId);

      const oldAfter = await adminPb.collection('user_subscriptions').getOne(subMultiOld.id);
      const newAfter = await adminPb.collection('user_subscriptions').getOne(subMultiNew.id);
      assert.strictEqual(oldAfter.credits_used, 7);
      assert.strictEqual(newAfter.credits_used, 10);
    });

    test('7. Inactive subscriptions are not deducted', async () => {
      // Create cancelled subscription for customerSingle
      const cancelledSub = await adminPb.collection('user_subscriptions').create({
        user: customerSingle.id,
        plan: starterPlan.id,
        credits_total: 10,
        credits_used: 0,
        status: 'cancelled',
        purchased_at: new Date(Date.now() - 500000).toISOString(), // older than subSingle
        expires_at: null,
      });
      createdSubIds.push(cancelledSub.id);

      // Reveal testListingSecond for customerSingle
      const res = await delegateRevealTransaction({
        customerId: customerSingle.id,
        listingId: testListingSecond.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.deductedSubscriptionId, subSingle.id, 'Active subscription must be deducted, never cancelled');
      createdRevealIds.push(res.data.revealId);

      const cancelledAfter = await adminPb.collection('user_subscriptions').getOne(cancelledSub.id);
      assert.strictEqual(cancelledAfter.credits_used, 0, 'Cancelled subscription credits_used must remain 0');
    });

    test("8. Other customers' subscription records are never modified", async () => {
      const otherSub = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(otherSub.credits_used, 0);
    });
  });

  // =========================================================================
  // 2. Repeat Reveal & Idempotency Invariants (Tests 9–10)
  // =========================================================================
  describe('2. Idempotency & Repeat Reveal Safety', () => {
    test('9. Repeated reveal does not deduct another credit', async () => {
      // customerSingle has revealed testListingApproved (subSingle.credits_used is currently 2)
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      const usedBefore = subBefore.credits_used;

      // Repeat reveal for the SAME listing
      const res = await delegateRevealTransaction({
        customerId: customerSingle.id,
        listingId: testListingApproved.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'already_revealed');
      assert.strictEqual(res.data.alreadyRevealed, true);
      assert.strictEqual(res.data.creditDeducted, false);
      assert.strictEqual(res.data.creditsDeducted, 0);

      // Verify in SQLite: credits_used is completely unchanged
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      assert.strictEqual(subAfter.credits_used, usedBefore, 'credits_used must NOT be incremented on duplicate reveal');
    });

    test('10. Repeated reveal does not create another record', async () => {
      const records = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerSingle.id,
          l: testListingApproved.id,
        }),
      });

      assert.strictEqual(records.length, 1, 'Only one reveal record must exist for this (customer, listing)');
    });
  });

  // =========================================================================
  // 3. Rollback & Atomic Failure Safety (Tests 11–15)
  // =========================================================================
  describe('3. Transaction Rollback & Failure Protection (Live SQLite)', () => {
    test('11. Insufficient credits cause no mutation and return HTTP 402', async () => {
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subZero.id);
      assert.strictEqual(subBefore.credits_used, 10);

      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerZero.id,
            listingId: testListingApproved.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 402);
          assert.match(err.message, /insufficient credits/i);
          return true;
        }
      );

      // Confirm no records created and no credit changes in SQLite
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subZero.id);
      assert.strictEqual(subAfter.credits_used, 10);

      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerZero.id,
          l: testListingApproved.id,
        }),
      });
      assert.strictEqual(reveals.length, 0);
    });

    test('12. Credit update failure rolls back the transaction', async () => {
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subBefore.credits_used, 0);

      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerOther.id,
            listingId: testListingApproved.id,
            simulateCreditUpdateFailure: true,
          });
        },
        (err) => {
          assert.match(err.message, /SIMULATED_CREDIT_UPDATE_FAILURE/);
          return true;
        }
      );

      // Verify in SQLite: subOther was NOT modified and NO reveal record was created
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subAfter.credits_used, 0, 'credits_used must remain 0 after rollback');

      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerOther.id,
          l: testListingApproved.id,
        }),
      });
      assert.strictEqual(reveals.length, 0, 'No reveal record must exist');
    });

    test('13. Reveal creation failure rolls back the prior credit update', async () => {
      // In this test, credits are incremented on subOther inside txApp before the failure triggers!
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subBefore.credits_used, 0);

      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerOther.id,
            listingId: testListingApproved.id,
            simulateRevealSaveFailure: true,
          });
        },
        (err) => {
          assert.match(err.message, /SIMULATED_REVEAL_SAVE_FAILURE/);
          return true;
        }
      );

      // Verify that the credit increment in txApp was completely rolled back!
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(
        subAfter.credits_used,
        0,
        'credits_used must be rolled back to 0 even though txApp.save(sub) was called before failure'
      );

      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerOther.id,
          l: testListingApproved.id,
        }),
      });
      assert.strictEqual(reveals.length, 0);
    });

    test('14. Unique constraint conflict causes safe rollback and HTTP 409', async () => {
      // customerSingle has already revealed testListingApproved.
      // Bypass the application-level idempotency check to force txApp.save(newReveal)
      // to collide with the SQLite unique index idx_revealed_contacts_customer_listing!
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      const usedBefore = subBefore.credits_used;

      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerSingle.id,
            listingId: testListingApproved.id,
            bypassIdempotencyCheck: true,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 409);
          assert.match(err.message, /already recorded|conflict|rolled back/i);
          return true;
        }
      );

      // Verify in SQLite: credit increment was rolled back!
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subSingle.id);
      assert.strictEqual(subAfter.credits_used, usedBefore, 'Credit increment must be rolled back on unique index collision');

      // Still exactly 1 reveal record in SQLite
      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerSingle.id,
          l: testListingApproved.id,
        }),
      });
      assert.strictEqual(reveals.length, 1);
    });

    test('15. Invalid or unapproved listing causes no mutation', async () => {
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subBefore.credits_used, 0);

      // Nonexistent listing
      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerOther.id,
            listingId: 'nonexistent12345',
          });
        },
        (err) => {
          assert.strictEqual(err.status, 404);
          return true;
        }
      );

      // Unapproved listing (status: 'pending')
      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerOther.id,
            listingId: testListingPending.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /not approved/i);
          return true;
        }
      );

      // Customer trying to reveal own listing
      // Create listing owned by customerOther
      const selfListing = await adminPb.collection('listings').create({
        title: 'Customer Self Listing',
        description: 'Listing owned by customer',
        price: 20000,
        area_sqft: 400,
        address: '500 Road, Mirpur',
        city: 'Dhaka',
        area: 'Mirpur',
        category: 'retail',
        listing_type: 'rent',
        status: 'approved',
        owner: customerOther.id,
      });
      createdListingIds.push(selfListing.id);

      await assert.rejects(
        async () => {
          await delegateRevealTransaction({
            customerId: customerOther.id,
            listingId: selfListing.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /cannot reveal their own listing/i);
          return true;
        }
      );

      // In SQLite: subOther.credits_used remains 0
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subAfter.credits_used, 0);
    });
  });

  // =========================================================================
  // 4. Concurrency & Race Condition Verification (Live Simultaneous Requests)
  // =========================================================================
  describe('4. Live SQLite Concurrency & Race Condition Verification', () => {
    test('Live Concurrency Test: Multiple simultaneous reveal requests result in at most 1 reveal and 1 credit deduction', async () => {
      // customerConcurrent has 10 credits (subConcurrent.credits_used === 0)
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subConcurrent.id);
      assert.strictEqual(subBefore.credits_used, 0);

      // Fire 3 simultaneous reveal requests for the same (customer, listing) pair
      const promises = [
        delegateRevealTransaction({
          customerId: customerConcurrent.id,
          listingId: testListingConcurrent.id,
        }),
        delegateRevealTransaction({
          customerId: customerConcurrent.id,
          listingId: testListingConcurrent.id,
        }),
        delegateRevealTransaction({
          customerId: customerConcurrent.id,
          listingId: testListingConcurrent.id,
        }),
      ];

      const results = await Promise.allSettled(promises);

      // Check results: at least one must have succeeded
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.ok(fulfilled.length >= 1, 'At least one concurrent request must succeed');

      // Count how many reported creditDeducted === true
      const deductedCount = fulfilled.filter((r) => r.value.data.creditDeducted === true).length;
      assert.strictEqual(deductedCount, 1, 'Exactly ONE request must deduct a credit');

      // Any other fulfilled requests must report alreadyRevealed === true with 0 credits deducted
      for (const f of fulfilled) {
        if (f.value.data.creditDeducted === false) {
          assert.strictEqual(f.value.data.alreadyRevealed, true);
          assert.strictEqual(f.value.data.creditsDeducted, 0);
        }
      }

      // Any rejected requests must have rolled back safely with 409 conflict
      for (const rej of rejected) {
        assert.ok(
          rej.reason.status === 409 || rej.reason.status === 400,
          `Rejected concurrent request must return controlled error (got ${rej.reason.status})`
        );
      }

      // SQLite verification:
      // 1. Exactly ONE revealed_contacts record exists in the database
      const reveals = await adminPb.collection('revealed_contacts').getFullList({
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerConcurrent.id,
          l: testListingConcurrent.id,
        }),
      });
      assert.strictEqual(reveals.length, 1, 'At most and exactly ONE reveal record must persist in SQLite');

      // 2. Exactly ONE credit was deducted in SQLite
      const subAfter = await adminPb.collection('user_subscriptions').getOne(subConcurrent.id);
      assert.strictEqual(subAfter.credits_used, 1, 'credits_used in SQLite must be exactly 1 (not 2 or 3)');

      // 3. Aggregate balance in SQLite is exactly 9
      assert.strictEqual(subAfter.credits_total - subAfter.credits_used, 9);
    });
  });

  // =========================================================================
  // 5. Invariants, Regressions & Scope Boundaries (Tests 16–21)
  // =========================================================================
  describe('5. Invariants, Regressions & Scope Boundaries', () => {
    test('16. Customer identity remains trusted according to D-017', () => {
      const mockReq = {
        user: { id: customerSingle.id, role: 'customer' },
        body: { customerId: 'attacker-id' },
      };

      // 1. rejectClientIdentityOverride is middleware
      let rejectedStatus = null;
      const mockRes = {
        status(s) {
          rejectedStatus = s;
          return this;
        },
        json(j) {
          return j;
        },
      };
      rejectClientIdentityOverride(mockReq, mockRes, () => {});
      assert.strictEqual(rejectedStatus, 400);

      // 2. getTrustedCustomerId throws on override attempt
      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400
      );

      // 3. Clean request derives customerId from session
      const cleanReq = { user: { id: customerSingle.id, role: 'customer' } };
      const trustedId = getTrustedCustomerId(cleanReq);
      assert.strictEqual(trustedId, customerSingle.id);
    });

    test('17. All transaction-scoped DB operations use txApp', () => {
      const content = fs.readFileSync(hookFilePath, 'utf8');
      const txMatch = content.match(/\$app\.runInTransaction\(\s*\(\s*txApp\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
      assert.ok(txMatch, 'Must find $app.runInTransaction');
      const txBody = txMatch[1];
      assert.doesNotMatch(txBody, /\$app\.(find|save|delete|create|collection)/);
    });

    test('18. Task 10.1 rollback behavior remains functional', async () => {
      const userBefore = await adminPb.collection('users').getOne(customerOther.id);
      const originalName = userBefore.name;

      const res = await fetch(customRouteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: superuserToken,
        },
        body: JSON.stringify({
          testRollback: true,
          testRecordId: customerOther.id,
        }),
      });

      assert.ok(res.status >= 400);
      const userAfter = await adminPb.collection('users').getOne(customerOther.id);
      assert.strictEqual(userAfter.name, originalName);
    });

    test('19. Task 10.2 identity validation remains functional', async () => {
      // Anonymous request rejected
      const anonRes = await fetch(customRouteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerSingle.id }),
      });
      assert.strictEqual(anonRes.status, 401);

      // Nonexistent customer rejected
      await assert.rejects(
        async () => {
          await delegateRevealTransaction({ customerId: 'nonexistent99999' });
        },
        (err) => err.status === 404
      );
    });

    test('20. Task 10.3 idempotency remains functional', async () => {
      const res = await delegateRevealTransaction({
        customerId: customerSingle.id,
        listingId: testListingApproved.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.alreadyRevealed, true);
      assert.strictEqual(res.data.status, 'already_revealed');
      assert.strictEqual(res.data.creditDeducted, false);
    });

    test('21. Task 10.4 aggregate credit verification remains functional', async () => {
      // Calling with verifyOnly: true returns credits_verified with zero deductions
      const subBefore = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subBefore.credits_used, 0);

      const res = await delegateRevealTransaction({
        customerId: customerOther.id,
        listingId: testListingApproved.id,
        verifyOnly: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'credits_verified');
      assert.strictEqual(res.data.creditsRemaining, 10);
      assert.strictEqual(res.data.creditDeducted, false);

      const subAfter = await adminPb.collection('user_subscriptions').getOne(subOther.id);
      assert.strictEqual(subAfter.credits_used, 0);
    });

    test('22. Owner phone retrieval is strictly NOT implemented in Task 10.5', async () => {
      const res = await delegateRevealTransaction({
        customerId: customerSingle.id,
        listingId: testListingApproved.id,
      });

      // No phone field is returned in data payload
      assert.strictEqual(res.data.phone, undefined);
      assert.strictEqual(res.data.ownerPhone, undefined);

      // Hook content check: owner_contacts collection is never queried in executable code
      const content = fs.readFileSync(hookFilePath, 'utf8');
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.doesNotMatch(codeWithoutComments, /owner_contacts/);
    });
  });
});
