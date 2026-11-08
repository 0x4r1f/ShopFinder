import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import {
  createNotification,
  notifyListingApproved,
  notifyListingRejected,
  notifyCreditLow,
  SUPPORTED_NOTIFICATION_TYPES,
  DEFAULT_CREDIT_LOW_THRESHOLD,
} from '../src/services/notificationService.js';
import * as adminService from '../src/services/admin.service.js';
import { revealContactForCustomer } from '../src/services/revealService.js';

describe('Phase 11, Task 11.7 — In-App Notification Service', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';

  let adminUser = null;
  let ownerUser = null;
  let customerUser = null;

  let testListingPending = null;
  let testListingForReject = null;
  let testListingForReveal = null;
  let testOwnerContact = null;
  let testPlan = null;
  let customerSub = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdContactIds = [];
  const createdSubIds = [];
  const createdPlanIds = [];
  const createdNotificationIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 7);

  before(async () => {
    adminPb = await getAdminClient();
    const timestamp = Date.now();

    // 1. Create Admin
    adminUser = await adminPb.collection('users').create({
      email: `admin_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Admin Notif',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(adminUser.id);

    // 2. Create Commercial Owner
    ownerUser = await adminPb.collection('users').create({
      email: `owner_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Owner Notif',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(ownerUser.id);

    testOwnerContact = await adminPb.collection('owner_contacts').create({
      owner: ownerUser.id,
      phone: '+8801799999999',
    });
    createdContactIds.push(testOwnerContact.id);

    // 3. Create Customer
    customerUser = await adminPb.collection('users').create({
      email: `cust_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      name: 'Customer Notif',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerUser.id);

    // 4. Create Listings
    testListingPending = await adminPb.collection('listings').create({
      title: `Pending Office ${timestamp}`,
      description: 'Office space pending administrative review',
      owner: ownerUser.id,
      status: 'pending',
      city: 'Dhaka',
      area: 'Banani',
      address: 'Plot 45, Road 11, Banani',
      price: 75000,
      area_sqft: 1400,
      category: 'office',
      listing_type: 'rent',
    });
    createdListingIds.push(testListingPending.id);

    testListingForReject = await adminPb.collection('listings').create({
      title: `Defective Shop ${timestamp}`,
      description: 'Shop with policy violation for rejection testing',
      owner: ownerUser.id,
      status: 'pending',
      city: 'Dhaka',
      area: 'Mirpur',
      address: 'Mirpur 10 Circle',
      price: 30000,
      area_sqft: 400,
      category: 'retail',
      listing_type: 'rent',
    });
    createdListingIds.push(testListingForReject.id);

    testListingForReveal = await adminPb.collection('listings').create({
      title: `Approved Showroom ${timestamp}`,
      description: 'Approved commercial space for contact reveal and credit alert testing',
      owner: ownerUser.id,
      status: 'approved',
      city: 'Dhaka',
      area: 'Uttara',
      address: 'Sector 3, Uttara',
      price: 120000,
      area_sqft: 2200,
      category: 'showroom',
      listing_type: 'rent',
    });
    createdListingIds.push(testListingForReveal.id);

    // 5. Create Subscription Plan & Customer Subscription with 3 credits
    testPlan = await adminPb.collection('subscription_plans').create({
      name: `Notif Test Plan ${timestamp}`,
      price: 299,
      credits: 10,
      is_active: true,
    });
    createdPlanIds.push(testPlan.id);

    customerSub = await adminPb.collection('user_subscriptions').create({
      user: customerUser.id,
      plan: testPlan.id,
      credits_total: 10,
      credits_used: 7, // 10 - 7 = 3 remaining credits
      status: 'active',
      purchased_at: new Date().toISOString(),
    });
    createdSubIds.push(customerSub.id);

    // 6. Start server
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

    // Cleanup notifications
    for (const id of createdNotificationIds) {
      try { await adminPb.collection('notifications').delete(id); } catch {}
    }
    // Cleanup any extra notifications for test users
    for (const uid of createdUserIds) {
      try {
        const notifs = await adminPb.collection('notifications').getFullList({
          filter: adminPb.filter('user = {:u}', { u: uid }),
        });
        for (const n of notifs) {
          try { await adminPb.collection('notifications').delete(n.id); } catch {}
        }
      } catch {}
    }

    for (const id of createdRevealIds) {
      try { await adminPb.collection('revealed_contacts').delete(id); } catch {}
    }
    for (const id of createdListingIds) {
      try { await adminPb.collection('listings').delete(id); } catch {}
    }
    for (const id of createdContactIds) {
      try { await adminPb.collection('owner_contacts').delete(id); } catch {}
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

  // --------------------------------------------------------------------------
  // 1. Core Service Unit Functions & Validations
  // --------------------------------------------------------------------------
  describe('Core Service Unit Functions & Validations', () => {
    it('1. Rejects missing, empty, or non-string recipient userId with HTTP 400', async () => {
      await assert.rejects(
        createNotification({ userId: '', type: 'listing_approved', message: 'Hello' }),
        (err) => err.status === 400 && err.message.includes('Recipient userId is required')
      );

      await assert.rejects(
        createNotification({ userId: null, type: 'listing_approved', message: 'Hello' }),
        (err) => err.status === 400 && err.message.includes('Recipient userId is required')
      );
    });

    it('2. Rejects invalid or unsupported notification type with HTTP 400', async () => {
      await assert.rejects(
        createNotification({ userId: ownerUser.id, type: 'unknown_type', message: 'Hello' }),
        (err) => err.status === 400 && err.message.includes('Invalid notification type')
      );
    });

    it('3. Rejects missing, empty, or non-string message with HTTP 400', async () => {
      await assert.rejects(
        createNotification({ userId: ownerUser.id, type: 'listing_approved', message: '' }),
        (err) => err.status === 400 && err.message.includes('Notification message is required')
      );
    });

    it('4. Rejects nonexistent recipient user with HTTP 404', async () => {
      await assert.rejects(
        createNotification({ userId: 'nonexistent_usr_123', type: 'listing_approved', message: 'Hello' }),
        (err) => err.status === 404 && err.message.includes('Recipient user not found')
      );
    });

    it('5. Successfully creates a valid notification record in PocketBase with is_read = false', async () => {
      const notif = await createNotification({
        userId: ownerUser.id,
        type: 'listing_approved',
        message: 'Your commercial listing has been approved.',
      });

      assert.ok(notif.id);
      assert.equal(notif.user, ownerUser.id);
      assert.equal(notif.type, 'listing_approved');
      assert.equal(notif.is_read, false);
      assert.ok(notif.created);
      createdNotificationIds.push(notif.id);

      const dbRecord = await adminPb.collection('notifications').getOne(notif.id);
      assert.equal(dbRecord.user, ownerUser.id);
      assert.equal(dbRecord.is_read, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Listing Moderation Notification Events
  // --------------------------------------------------------------------------
  describe('Listing Moderation Notification Events', () => {
    it('6. notifyListingApproved creates a listing_approved notification addressed to owner', async () => {
      const res = await notifyListingApproved(testListingPending, ownerUser.id);
      assert.equal(res.skipped, false);
      assert.equal(res.duplicate, false);
      assert.ok(res.notification?.id);
      assert.equal(res.notification.type, 'listing_approved');
      assert.equal(res.notification.user, ownerUser.id);
      assert.ok(res.notification.message.includes(testListingPending.title));
      createdNotificationIds.push(res.notification.id);
    });

    it('7. notifyListingApproved prevents duplicate spam for identical unread approval alert', async () => {
      // First call already created unread notification in test 6
      const secondCall = await notifyListingApproved(testListingPending, ownerUser.id);
      assert.equal(secondCall.skipped, true);
      assert.equal(secondCall.duplicate, true);
    });

    it('8. notifyListingRejected creates a listing_rejected notification with safe reason', async () => {
      const reason = 'High resolution exterior photos are required.';
      const res = await notifyListingRejected(testListingForReject, ownerUser.id, reason);
      assert.equal(res.skipped, false);
      assert.equal(res.duplicate, false);
      assert.ok(res.notification?.id);
      assert.equal(res.notification.type, 'listing_rejected');
      assert.equal(res.notification.user, ownerUser.id);
      assert.ok(res.notification.message.includes(testListingForReject.title));
      assert.ok(res.notification.message.includes(reason));
      createdNotificationIds.push(res.notification.id);
    });

    it('9. notifyListingRejected prevents duplicate spam for identical unread rejection alert', async () => {
      const secondCall = await notifyListingRejected(
        testListingForReject,
        ownerUser.id,
        'High resolution exterior photos are required.'
      );
      assert.equal(secondCall.skipped, true);
      assert.equal(secondCall.duplicate, true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Customer Credit-Low Alert & Deduplication
  // --------------------------------------------------------------------------
  describe('Customer Credit-Low Alert & Deduplication', () => {
    it('10. Does NOT notify when credit balance is above threshold (remaining > 2)', async () => {
      const res = await notifyCreditLow(customerUser.id, 5);
      assert.equal(res.skipped, true);
      assert.equal(res.reason, 'above_threshold');

      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "credit_low"', { u: customerUser.id }),
      });
      assert.equal(notifs.length, 0);
    });

    it('11. Notifies customer when credit balance drops to <= threshold (2 credits remaining)', async () => {
      const res = await notifyCreditLow(customerUser.id, 2);
      assert.equal(res.skipped, false);
      assert.equal(res.duplicate, false);
      assert.ok(res.notification?.id);
      assert.equal(res.notification.type, 'credit_low');
      assert.equal(res.notification.user, customerUser.id);
      assert.ok(res.notification.message.includes('2 credits remaining'));
      createdNotificationIds.push(res.notification.id);
    });

    it('12. Prevents duplicate credit_low notification spam while unread alert exists', async () => {
      // Balance drops to 1, but unread credit_low alert from test 11 already exists
      const res = await notifyCreditLow(customerUser.id, 1);
      assert.equal(res.skipped, true);
      assert.equal(res.duplicate, true);
      assert.equal(res.reason, 'unread_alert_exists');

      // Verify still exactly 1 credit_low notification exists for customer
      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "credit_low"', { u: customerUser.id }),
      });
      assert.equal(notifs.length, 1);
    });

    it('13. Uses singular "1 credit remaining" phrasing when 1 credit remains after marking prior read', async () => {
      // Mark prior notification read
      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "credit_low"', { u: customerUser.id }),
      });
      for (const n of notifs) {
        await adminPb.collection('notifications').update(n.id, { is_read: true });
      }

      // Now notify for 1 credit
      const res = await notifyCreditLow(customerUser.id, 1);
      assert.equal(res.skipped, false);
      assert.equal(res.duplicate, false);
      assert.ok(res.notification.message.includes('1 credit remaining'));
      createdNotificationIds.push(res.notification.id);
    });
  });

  // --------------------------------------------------------------------------
  // 4. End-to-End Business Operation Integrations
  // --------------------------------------------------------------------------
  describe('End-to-End Business Operation Integrations', () => {
    it('14. Successful admin listing approval automatically triggers in-app notification to owner', async () => {
      // Create fresh pending listing for end-to-end test
      const freshListing = await adminPb.collection('listings').create({
        title: `Auto Approval Listing ${Date.now()}`,
        description: 'Testing automatic notification on admin approval',
        owner: ownerUser.id,
        status: 'pending',
        city: 'Dhaka',
        area: 'Dhanmondi',
        address: 'Road 27, Dhanmondi',
        price: 55000,
        area_sqft: 900,
        category: 'retail',
        listing_type: 'rent',
      });
      createdListingIds.push(freshListing.id);

      // Admin approves listing
      await adminService.approveListing(freshListing.id, adminUser.id);

      // Verify notification created for owner
      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "listing_approved" && message ~ {:t}', {
          u: ownerUser.id,
          t: freshListing.title,
        }),
      });

      assert.equal(notifs.length, 1);
      assert.equal(notifs[0].user, ownerUser.id);
      assert.equal(notifs[0].type, 'listing_approved');
      createdNotificationIds.push(notifs[0].id);
    });

    it('15. Successful admin listing rejection automatically triggers in-app notification to owner', async () => {
      const freshListing = await adminPb.collection('listings').create({
        title: `Auto Rejection Listing ${Date.now()}`,
        description: 'Testing automatic notification on admin rejection',
        owner: ownerUser.id,
        status: 'pending',
        city: 'Dhaka',
        area: 'Dhanmondi',
        address: 'Road 15, Dhanmondi',
        price: 45000,
        area_sqft: 600,
        category: 'office',
        listing_type: 'rent',
      });
      createdListingIds.push(freshListing.id);

      const rejectionReason = 'Incomplete commercial license documentation.';
      await adminService.rejectListing(freshListing.id, adminUser.id, rejectionReason);

      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "listing_rejected" && message ~ {:t}', {
          u: ownerUser.id,
          t: freshListing.title,
        }),
      });

      assert.equal(notifs.length, 1);
      assert.equal(notifs[0].user, ownerUser.id);
      assert.equal(notifs[0].type, 'listing_rejected');
      assert.ok(notifs[0].message.includes(rejectionReason));
      createdNotificationIds.push(notifs[0].id);
    });

    it('16. Failed admin approval (e.g. anti-self-approval) creates ZERO notifications', async () => {
      // Listing owned by adminUser
      const adminListing = await adminPb.collection('listings').create({
        title: `Admin Owned Listing ${Date.now()}`,
        description: 'Testing anti-self-approval failure produces zero notifications',
        owner: adminUser.id,
        status: 'pending',
        city: 'Dhaka',
        area: 'Banani',
        address: 'Banani Block D',
        price: 80000,
        area_sqft: 1200,
        category: 'office',
        listing_type: 'rent',
      });
      createdListingIds.push(adminListing.id);

      await assert.rejects(
        adminService.approveListing(adminListing.id, adminUser.id),
        (err) => err.status === 403
      );

      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && message ~ {:t}', {
          u: adminUser.id,
          t: adminListing.title,
        }),
      });
      assert.equal(notifs.length, 0);
    });

    it('17. Legitimate reveal credit deduction triggering <= 2 balance automatically creates credit_low notification', async () => {
      // Create fresh customer with exactly 3 credits
      const revealCustomer = await adminPb.collection('users').create({
        email: `reveal_notif_cust_${Date.now()}_${rand()}@shopfinder.test`,
        password: 'Password123!',
        passwordConfirm: 'Password123!',
        name: 'Reveal Notif Cust',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(revealCustomer.id);

      const sub = await adminPb.collection('user_subscriptions').create({
        user: revealCustomer.id,
        plan: testPlan.id,
        credits_total: 10,
        credits_used: 7, // 10 - 7 = 3 remaining credits
        status: 'active',
        purchased_at: new Date().toISOString(),
      });
      createdSubIds.push(sub.id);

      // Perform reveal: deducts 1 credit -> remaining drops to 2 (triggering threshold <= 2)
      const revealRes = await revealContactForCustomer({
        customerId: revealCustomer.id,
        listingId: testListingForReveal.id,
      });

      assert.equal(revealRes.creditDeducted, true);
      assert.equal(revealRes.creditsRemaining, 2);
      createdRevealIds.push(revealRes.revealId);

      // Check notification created
      const notifs = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "credit_low"', { u: revealCustomer.id }),
      });

      assert.equal(notifs.length, 1);
      assert.equal(notifs[0].user, revealCustomer.id);
      assert.equal(notifs[0].type, 'credit_low');
      assert.ok(notifs[0].message.includes('2 credits remaining'));
      createdNotificationIds.push(notifs[0].id);

      // Repeat reveal on the same listing (idempotent, creditDeducted === false)
      const repeatRes = await revealContactForCustomer({
        customerId: revealCustomer.id,
        listingId: testListingForReveal.id,
      });
      assert.equal(repeatRes.creditDeducted, false);
      assert.equal(repeatRes.alreadyRevealed, true);

      // Verify no extra notifications created
      const notifsAfterRepeat = await adminPb.collection('notifications').getFullList({
        filter: adminPb.filter('user = {:u} && type = "credit_low"', { u: revealCustomer.id }),
      });
      assert.equal(notifsAfterRepeat.length, 1);
    });
  });
});
