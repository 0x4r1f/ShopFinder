import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

describe('Phase 7, Task 7.5 — Admin User Management API (GET & PATCH /api/v1/admin/users)', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let admin1Email;
  let admin2Email;
  let ownerEmail;
  let customerEmail;

  let admin1Id;
  let admin2Id;
  let ownerId;
  let customerId;

  let admin1Token;
  let admin2Token;
  let ownerToken;
  let customerToken;

  const createdUserIds = [];
  const createdContactIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Admin (Admin 1)
    admin1Email = `adm1_usr_${testRunId}@shopfinder.local`;
    const admin1Rec = await adminPb.collection('users').create({
      name: `Admin Primary ${testRunId}`,
      email: admin1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin1Id = admin1Rec.id;
    createdUserIds.push(admin1Id);

    // 2. Create Peer Admin (Admin 2 - for testing peer admin management)
    admin2Email = `adm2_usr_${testRunId}@shopfinder.local`;
    const admin2Rec = await adminPb.collection('users').create({
      name: `Admin Peer ${testRunId}`,
      email: admin2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin2Id = admin2Rec.id;
    createdUserIds.push(admin2Id);

    // 3. Create Property Owner
    ownerEmail = `own_usr_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner UniqueName ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 4. Create Customer
    customerEmail = `cust_usr_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer UniqueSearch ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 5. Create Owner Contact (Phone number in owner_contacts) to verify D-014 privacy
    try {
      const contactRec = await adminPb.collection('owner_contacts').create({
        owner: ownerId,
        phone: '+880 1711-223344',
      });
      createdContactIds.push(contactRec.id);
    } catch {}

    // 6. Authenticate test users to acquire JWT tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const admin1Auth = await userPb.collection('users').authWithPassword(admin1Email, testPassword);
    admin1Token = admin1Auth.token;

    const admin2Auth = await userPb.collection('users').authWithPassword(admin2Email, testPassword);
    admin2Token = admin2Auth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Clean up contacts
    for (const cid of createdContactIds) {
      try {
        await adminPb.collection('owner_contacts').delete(cid);
      } catch {}
    }

    // 2. Clean up test users
    for (const uid of createdUserIds) {
      try {
        await adminPb.collection('users').delete(uid);
      } catch {}
    }

    // 3. Close ephemeral server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Helper for GET requests
  async function apiGet(path, { token, query } = {}) {
    const headers = {
      Origin: env.CLIENT_URL,
    };
    if (token) {
      headers.Cookie = `pb_auth=${token}`;
    }

    let url = `${baseUrl}${path}`;
    if (query) {
      const q = new URLSearchParams(query).toString();
      if (q) url += `?${q}`;
    }

    return fetch(url, { method: 'GET', headers });
  }

  // Helper for PATCH requests
  async function apiPatch(path, { token, body } = {}) {
    const headers = {
      Origin: env.CLIENT_URL,
    };
    if (token) {
      headers.Cookie = `pb_auth=${token}`;
    }
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Part 1: User List (Tests 1 - 12)                                          */
  /* -------------------------------------------------------------------------- */
  describe('User List (GET /api/v1/admin/users)', () => {
    test('1. Admin can retrieve paginated users', async () => {
      const res = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { perPage: 10 } });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.users));
      assert.ok(data.data.users.length >= 4);
    });

    test('2. Pagination metadata is correct', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { page: 1, perPage: 2 },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const { pagination } = data.data;
      assert.strictEqual(pagination.page, 1);
      assert.strictEqual(pagination.perPage, 2);
      assert.ok(pagination.totalItems >= 4);
      assert.strictEqual(pagination.totalPages, Math.ceil(pagination.totalItems / 2));
    });

    test('3. Search matches user names', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { search: `UniqueSearch ${testRunId}` },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const users = data.data.users;
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, customerId);
      assert.match(users[0].name, /UniqueSearch/);
    });

    test('4. Search matches email', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { search: ownerEmail },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const users = data.data.users;
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, ownerId);
      assert.strictEqual(users[0].email, ownerEmail);
    });

    test('5. Role filtering works for customer, owner and admin', async () => {
      // Filter customer
      const resCust = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { role: 'customer', search: testRunId },
      });
      assert.strictEqual(resCust.status, 200);
      const dataCust = await resCust.json();
      assert.strictEqual(dataCust.data.users.length, 1);
      assert.strictEqual(dataCust.data.users[0].role, 'customer');

      // Filter owner
      const resOwn = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { role: 'owner', search: testRunId },
      });
      assert.strictEqual(resOwn.status, 200);
      const dataOwn = await resOwn.json();
      assert.strictEqual(dataOwn.data.users.length, 1);
      assert.strictEqual(dataOwn.data.users[0].role, 'owner');

      // Filter admin
      const resAdm = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { role: 'admin', search: testRunId },
      });
      assert.strictEqual(resAdm.status, 200);
      const dataAdm = await resAdm.json();
      assert.ok(dataAdm.data.users.length >= 2);
      assert.ok(dataAdm.data.users.every((u) => u.role === 'admin'));
    });

    test('6. Search and role filtering work together', async () => {
      // Search matches name, but filter role is different -> 0 results
      const resMismatch = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { role: 'admin', search: `UniqueSearch ${testRunId}` }, // this is a customer
      });
      assert.strictEqual(resMismatch.status, 200);
      const dataMismatch = await resMismatch.json();
      assert.strictEqual(dataMismatch.data.users.length, 0);

      // Search matches name AND role matches -> 1 result
      const resMatch = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { role: 'customer', search: `UniqueSearch ${testRunId}` },
      });
      assert.strictEqual(resMatch.status, 200);
      const dataMatch = await resMatch.json();
      assert.strictEqual(dataMatch.data.users.length, 1);
      assert.strictEqual(dataMatch.data.users[0].id, customerId);
    });

    test('7. Only approved fields are returned', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { search: ownerEmail },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      const user = data.data.users[0];

      // Approved fields
      assert.ok('id' in user);
      assert.ok('name' in user);
      assert.ok('email' in user);
      assert.ok('role' in user);
      assert.ok('is_active' in user);
      assert.ok('avatar' in user);
      assert.ok('avatar_url' in user);
      assert.ok('created' in user);
    });

    test('8. Passwords and tokenKey are excluded', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { search: testRunId },
      });
      const data = await res.json();

      for (const u of data.data.users) {
        assert.strictEqual(u.password, undefined);
        assert.strictEqual(u.passwordHash, undefined);
        assert.strictEqual(u.tokenKey, undefined);
        assert.strictEqual(u.authProviders, undefined);
      }
    });

    test('9. Owner phone numbers are excluded', async () => {
      const res = await apiGet('/api/v1/admin/users', {
        token: admin1Token,
        query: { search: ownerEmail },
      });
      const data = await res.json();
      const rawJson = JSON.stringify(data);

      assert.doesNotMatch(rawJson, /\+880\s?1711-223344/);
      assert.doesNotMatch(rawJson, /owner_contacts/);
      assert.strictEqual(data.data.users[0].phone, undefined);
    });

    test('10. Invalid pagination values return HTTP 400', async () => {
      const resZero = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { page: 0 } });
      assert.strictEqual(resZero.status, 400);

      const resNeg = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { page: -5 } });
      assert.strictEqual(resNeg.status, 400);

      const resOversized = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { perPage: 150 } });
      assert.strictEqual(resOversized.status, 400);

      const resString = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { page: 'invalid' } });
      assert.strictEqual(resString.status, 400);
    });

    test('11. Unsupported role filters return HTTP 400', async () => {
      const resInvalid = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { role: 'superadmin' } });
      assert.strictEqual(resInvalid.status, 400);

      const resGuest = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { role: 'guest' } });
      assert.strictEqual(resGuest.status, 400);
    });

    test('12. Invalid sorting values return HTTP 400 if sorting is supported', async () => {
      const resBadSort = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { sort: 'dangerous;drop' } });
      assert.strictEqual(resBadSort.status, 400);

      const resValidSort = await apiGet('/api/v1/admin/users', { token: admin1Token, query: { sort: 'name' } });
      assert.strictEqual(resValidSort.status, 200);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Part 2: User Status (Tests 13 - 24)                                        */
  /* -------------------------------------------------------------------------- */
  describe('User Status (PATCH /api/v1/admin/users/:id/status)', () => {
    test('13. Admin can deactivate an active user', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: false },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.id, customerId);
      assert.strictEqual(data.data.user.is_active, false);
    });

    test('14. Admin can activate an inactive user', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: true },
      });
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.id, customerId);
      assert.strictEqual(data.data.user.is_active, true);
    });

    test('15. Updated status persists in PocketBase', async () => {
      // Deactivate owner
      await apiPatch(`/api/v1/admin/users/${ownerId}/status`, {
        token: admin1Token,
        body: { is_active: false },
      });

      // Verify directly via Admin SDK
      const record = await adminPb.collection('users').getOne(ownerId);
      assert.strictEqual(record.is_active, false);

      // Re-activate owner
      await apiPatch(`/api/v1/admin/users/${ownerId}/status`, {
        token: admin1Token,
        body: { is_active: true },
      });
      const recordActive = await adminPb.collection('users').getOne(ownerId);
      assert.strictEqual(recordActive.is_active, true);
    });

    test('16. Missing user returns HTTP 404', async () => {
      const fakeId = 'usr_notexist000';
      const res = await apiPatch(`/api/v1/admin/users/${fakeId}/status`, {
        token: admin1Token,
        body: { is_active: false },
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('17. Missing is_active returns HTTP 400', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: {},
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('18. Non-boolean is_active returns HTTP 400', async () => {
      const resStr = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: 'false' },
      });
      assert.strictEqual(resStr.status, 400);

      const resNum = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: 0 },
      });
      assert.strictEqual(resNum.status, 400);
    });

    test('19. Extra fields such as role are rejected', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: false, role: 'admin' },
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('20. Extra fields such as password are rejected', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: admin1Token,
        body: { is_active: false, password: 'HackedPassword123!' },
      });
      assert.strictEqual(res.status, 400);
    });

    test('21. Admin cannot deactivate their own account (HTTP 403)', async () => {
      const res = await apiPatch(`/api/v1/admin/users/${admin1Id}/status`, {
        token: admin1Token,
        body: { is_active: false },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error.message, /cannot deactivate their own account/i);
    });

    test('22. Self-deactivation attempt leaves account unchanged in PocketBase', async () => {
      const record = await adminPb.collection('users').getOne(admin1Id);
      assert.strictEqual(record.is_active, true);
    });

    test('23. Other administrators can manage the target admin account', async () => {
      // Admin 2 deactivates Admin 1
      const resDeact = await apiPatch(`/api/v1/admin/users/${admin1Id}/status`, {
        token: admin2Token,
        body: { is_active: false },
      });
      assert.strictEqual(resDeact.status, 200);

      // Verify status persisted
      const record = await adminPb.collection('users').getOne(admin1Id);
      assert.strictEqual(record.is_active, false);

      // Admin 2 reactivates Admin 1
      const resAct = await apiPatch(`/api/v1/admin/users/${admin1Id}/status`, {
        token: admin2Token,
        body: { is_active: true },
      });
      assert.strictEqual(resAct.status, 200);

      const recordActive = await adminPb.collection('users').getOne(admin1Id);
      assert.strictEqual(recordActive.is_active, true);
    });

    test('24. PocketBase failures return safe errors without leaking internal queries', async () => {
      const originalUpdate = adminPb.collection('users').update;
      adminPb.collection('users').update = async () => {
        const err = new Error('Database connection failed');
        err.status = 500;
        throw err;
      };

      try {
        const res = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
          token: admin1Token,
          body: { is_active: false },
        });
        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error.message, 'Failed to update user status');
      } finally {
        adminPb.collection('users').update = originalUpdate;
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Part 3: Authorization (Tests 25 - 27)                                      */
  /* -------------------------------------------------------------------------- */
  describe('Authorization across user management', () => {
    test('25. Anonymous requests return HTTP 401', async () => {
      const resGet = await apiGet('/api/v1/admin/users');
      assert.strictEqual(resGet.status, 401);

      const resPatch = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        body: { is_active: false },
      });
      assert.strictEqual(resPatch.status, 401);
    });

    test('26. Customer requests return HTTP 403', async () => {
      const resGet = await apiGet('/api/v1/admin/users', { token: customerToken });
      assert.strictEqual(resGet.status, 403);

      const resPatch = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: customerToken,
        body: { is_active: false },
      });
      assert.strictEqual(resPatch.status, 403);
    });

    test('27. Owner requests return HTTP 403', async () => {
      const resGet = await apiGet('/api/v1/admin/users', { token: ownerToken });
      assert.strictEqual(resGet.status, 403);

      const resPatch = await apiPatch(`/api/v1/admin/users/${customerId}/status`, {
        token: ownerToken,
        body: { is_active: false },
      });
      assert.strictEqual(resPatch.status, 403);
    });
  });
});

