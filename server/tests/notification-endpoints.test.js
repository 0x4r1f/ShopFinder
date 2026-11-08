import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { createNotification } from '../src/services/notificationService.js';

describe('Phase 11, Task 11.8 — Notification Endpoints Integration Tests', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';

  const timestamp = Date.now();
  const testPassword = 'Password123!';
  const rand = () => Math.random().toString(36).slice(2, 7);

  let testCustomer1 = null;
  let customer1Cookie = '';
  let testCustomer2 = null;
  let customer2Cookie = '';
  let testOwner = null;
  let ownerCookie = '';
  let testAdmin = null;
  let adminCookie = '';

  const createdUserIds = [];
  const createdNotificationIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Test Customer 1
    testCustomer1 = await adminPb.collection('users').create({
      email: `cust1_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer One',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer1.id);

    const cust1Pb = new PocketBase(env.POCKETBASE_URL);
    const cust1Auth = await cust1Pb.collection('users').authWithPassword(testCustomer1.email, testPassword);
    customer1Cookie = `pb_auth=${cust1Auth.token}`;

    // 2. Create Test Customer 2 (for isolation tests)
    testCustomer2 = await adminPb.collection('users').create({
      email: `cust2_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer Two',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer2.id);

    const cust2Pb = new PocketBase(env.POCKETBASE_URL);
    const cust2Auth = await cust2Pb.collection('users').authWithPassword(testCustomer2.email, testPassword);
    customer2Cookie = `pb_auth=${cust2Auth.token}`;

    // 3. Create Test Owner
    testOwner = await adminPb.collection('users').create({
      email: `owner_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner One',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner.id);

    const ownerPb = new PocketBase(env.POCKETBASE_URL);
    const ownerAuth = await ownerPb.collection('users').authWithPassword(testOwner.email, testPassword);
    ownerCookie = `pb_auth=${ownerAuth.token}`;

    // 4. Create Test Admin
    testAdmin = await adminPb.collection('users').create({
      email: `admin_notif_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Admin One',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(testAdmin.id);

    const adminUserPb = new PocketBase(env.POCKETBASE_URL);
    const adminUserAuth = await adminUserPb.collection('users').authWithPassword(testAdmin.email, testPassword);
    adminCookie = `pb_auth=${adminUserAuth.token}`;

    // 5. Start ephemeral Express server
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

    // Teardown created notifications
    for (const notifId of createdNotificationIds) {
      try {
        await adminPb.collection('notifications').delete(notifId);
      } catch {}
    }

    // Teardown created users
    for (const userId of createdUserIds) {
      try {
        await adminPb.collection('users').delete(userId);
      } catch {}
    }
  });

  // --------------------------------------------------------------------------
  // 1. Authentication & RBAC Enforcement
  // --------------------------------------------------------------------------
  describe('Authentication & Authorization RBAC', () => {
    it('returns HTTP 401 when anonymous user calls GET /api/v1/notifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('returns HTTP 403 when admin user calls GET /api/v1/notifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('returns HTTP 200 when customer calls GET /api/v1/notifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: customer1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.data.notifications));
      assert.equal(typeof data.data.unread_count, 'number');
    });

    it('returns HTTP 200 when owner calls GET /api/v1/notifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: ownerCookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.data.notifications));
      assert.equal(typeof data.data.unread_count, 'number');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Data Isolation & Paginated Retrieval
  // --------------------------------------------------------------------------
  describe('Data Isolation and Paginated Notification Retrieval', () => {
    let notifC1A;
    let notifC1B;
    let notifC2;

    before(async () => {
      // Create 2 notifications for Customer 1
      notifC1A = await createNotification({
        userId: testCustomer1.id,
        type: 'credit_low',
        title: 'Credits Low A',
        message: 'You have low credits A',
      });
      createdNotificationIds.push(notifC1A.id);

      notifC1B = await createNotification({
        userId: testCustomer1.id,
        type: 'listing_rejected',
        title: 'Listing Update B',
        message: 'Plan rejected B',
      });
      createdNotificationIds.push(notifC1B.id);

      // Create 1 notification for Customer 2
      notifC2 = await createNotification({
        userId: testCustomer2.id,
        type: 'listing_approved',
        title: 'Listing Approved for C2',
        message: 'Your listing is active',
      });
      createdNotificationIds.push(notifC2.id);
    });

    it('Customer 1 sees only their own notifications and unread count', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: customer1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const notifs = data.data.notifications;

      assert.ok(notifs.length >= 2);
      const notifIds = notifs.map((n) => n.id);
      assert.ok(notifIds.includes(notifC1A.id));
      assert.ok(notifIds.includes(notifC1B.id));
      assert.ok(!notifIds.includes(notifC2.id), 'Must not contain Customer 2 notification');

      for (const n of notifs) {
        assert.equal(n.user, testCustomer1.id, 'Every notification must belong to Customer 1');
      }
      assert.ok(data.data.unread_count >= 2);
    });

    it('Customer 2 sees only their own notification', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: customer2Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const notifs = data.data.notifications;

      assert.ok(notifs.some((n) => n.id === notifC2.id));
      assert.ok(!notifs.some((n) => n.id === notifC1A.id));
      assert.ok(!notifs.some((n) => n.id === notifC1B.id));
      assert.equal(data.data.unread_count, 1);
    });

    it('supports pagination parameters (page=1, perPage=1)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications?page=1&perPage=1`, {
        headers: { Cookie: customer1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.data.notifications.length, 1);
      assert.equal(data.data.pagination.page, 1);
      assert.equal(data.data.pagination.perPage, 1);
      assert.ok(data.data.pagination.totalItems >= 2);
      assert.ok(data.data.pagination.totalPages >= 2);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Mark Single Notification As Read (PATCH /api/v1/notifications/:id/read)
  // --------------------------------------------------------------------------
  describe('PATCH /api/v1/notifications/:id/read', () => {
    let notifToRead;
    let notifOtherUser;

    before(async () => {
      notifToRead = await createNotification({
        userId: testCustomer1.id,
        type: 'credit_low',
        title: 'Low Credits Test',
        message: 'Mark me read',
      });
      createdNotificationIds.push(notifToRead.id);

      notifOtherUser = await createNotification({
        userId: testCustomer2.id,
        type: 'credit_low',
        title: 'Customer 2 Notif',
        message: 'Customer 2 private message',
      });
      createdNotificationIds.push(notifOtherUser.id);
    });

    it('rejects without Origin header due to CSRF protection', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/${notifToRead.id}/read`, {
        method: 'PATCH',
        headers: {
          Cookie: customer1Cookie,
        },
      });
      assert.equal(res.status, 403);
    });

    it('successfully marks own unread notification as read', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/${notifToRead.id}/read`, {
        method: 'PATCH',
        headers: {
          Cookie: customer1Cookie,
          Origin: env.CLIENT_URL,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.notification.id, notifToRead.id);
      assert.equal(data.data.notification.is_read, true);

      // Verify in DB directly
      const record = await adminPb.collection('notifications').getOne(notifToRead.id);
      assert.equal(record.is_read, true);
    });

    it('is idempotent when marking already-read notification as read', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/${notifToRead.id}/read`, {
        method: 'PATCH',
        headers: {
          Cookie: customer1Cookie,
          Origin: env.CLIENT_URL,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.notification.is_read, true);
    });

    it('enforces strict ownership: Customer 1 cannot mark Customer 2 notification as read', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/${notifOtherUser.id}/read`, {
        method: 'PATCH',
        headers: {
          Cookie: customer1Cookie,
          Origin: env.CLIENT_URL,
        },
      });
      // Should be 403 Forbidden or 404 Not Found (ownership check prevents unauthorized mutation)
      assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
      const data = await res.json();
      assert.equal(data.success, false);

      // Verify record is still unread in DB
      const record = await adminPb.collection('notifications').getOne(notifOtherUser.id);
      assert.equal(record.is_read, false);
    });

    it('returns HTTP 404 for non-existent notification ID', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/nonexistentid123/read`, {
        method: 'PATCH',
        headers: {
          Cookie: customer1Cookie,
          Origin: env.CLIENT_URL,
        },
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Mark All Notifications As Read (PATCH /api/v1/notifications/read-all)
  // --------------------------------------------------------------------------
  describe('PATCH /api/v1/notifications/read-all', () => {
    let bulkUser;
    let bulkCookie;
    let bulkNotif1;
    let bulkNotif2;
    let otherBulkNotif;

    before(async () => {
      bulkUser = await adminPb.collection('users').create({
        email: `bulk_user_${timestamp}_${rand()}@shopfinder.test`,
        password: testPassword,
        passwordConfirm: testPassword,
        name: 'Bulk User',
        role: 'customer',
        is_active: true,
      });
      createdUserIds.push(bulkUser.id);

      const bulkPb = new PocketBase(env.POCKETBASE_URL);
      const bulkAuth = await bulkPb.collection('users').authWithPassword(bulkUser.email, testPassword);
      bulkCookie = `pb_auth=${bulkAuth.token}`;

      bulkNotif1 = await createNotification({
        userId: bulkUser.id,
        type: 'credit_low',
        title: 'Bulk Notif 1',
        message: 'Message 1',
      });
      createdNotificationIds.push(bulkNotif1.id);

      bulkNotif2 = await createNotification({
        userId: bulkUser.id,
        type: 'listing_approved',
        title: 'Bulk Notif 2',
        message: 'Message 2',
      });
      createdNotificationIds.push(bulkNotif2.id);

      // Notification for another user to ensure cross-user isolation during read-all
      otherBulkNotif = await createNotification({
        userId: testCustomer2.id,
        type: 'credit_low',
        title: 'Customer 2 Unread',
        message: 'Should stay unread',
      });
      createdNotificationIds.push(otherBulkNotif.id);
    });

    it('marks all unread notifications of authenticated user as read and returns count', async () => {
      // Verify initial unread count is 2
      const checkRes = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: bulkCookie },
      });
      const checkData = await checkRes.json();
      assert.equal(checkData.data.unread_count, 2);

      // Perform read-all
      const res = await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          Cookie: bulkCookie,
          Origin: env.CLIENT_URL,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.updated_count, 2);

      // Verify unread count is now 0
      const afterRes = await fetch(`${baseUrl}/api/v1/notifications`, {
        headers: { Cookie: bulkCookie },
      });
      const afterData = await afterRes.json();
      assert.equal(afterData.data.unread_count, 0);

      // Verify that other user's notification was NOT marked as read
      const otherRecord = await adminPb.collection('notifications').getOne(otherBulkNotif.id);
      assert.equal(otherRecord.is_read, false, "Other user's notification must remain unread");
    });

    it('calling read-all when no notifications are unread succeeds with updated_count 0', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          Cookie: bulkCookie,
          Origin: env.CLIENT_URL,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.updated_count, 0);
    });
  });
});
