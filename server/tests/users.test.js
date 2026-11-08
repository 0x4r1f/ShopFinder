import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';

describe('User Profile Endpoints (Task 3.6)', () => {
  let server;
  let baseUrl;
  const createdUserIds = [];
  const testRunId = Date.now();

  const customerEmail = `user_cust_${testRunId}@example.com`;
  const ownerEmail = `user_owner_${testRunId}@example.com`;
  const adminEmail = `user_admin_${testRunId}@example.com`;
  const victimEmail = `user_victim_${testRunId}@example.com`;
  const testPassword = 'SecurePassword123!';

  let customerToken;
  let ownerToken;
  let adminToken;
  let customerId;
  let ownerId;
  let adminId;
  let victimId;

  before(async () => {
    const adminPb = await getAdminClient();

    // 1. Create customer user
    const custRecord = await adminPb.collection('users').create({
      name: 'Initial Customer',
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRecord.id;
    createdUserIds.push(customerId);

    // 2. Create owner user
    const ownerRecord = await adminPb.collection('users').create({
      name: 'Initial Owner',
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRecord.id;
    createdUserIds.push(ownerId);

    // 3. Create admin user
    const adminRecord = await adminPb.collection('users').create({
      name: 'Initial Admin',
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRecord.id;
    createdUserIds.push(adminId);

    // 4. Create victim user (for IDOR attack test)
    const victimRecord = await adminPb.collection('users').create({
      name: 'Victim User',
      email: victimEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    victimId = victimRecord.id;
    createdUserIds.push(victimId);

    // Authenticate users to obtain session tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      const adminPb = await getAdminClient();
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      console.warn('Test cleanup error:', err.message);
    }
  });

  async function makeRequest(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Origin: env.CLIENT_URL,
      ...options.headers,
    };
    if (options.token) {
      headers['Cookie'] = `${AUTH_COOKIE_NAME}=${options.token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  // ==========================================
  // GET /api/v1/users/me Tests
  // ==========================================

  test('1. Authenticated customer can retrieve their profile via GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: customerToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.id, customerId);
    assert.equal(res.data.data.user.email, customerEmail);
    assert.equal(res.data.data.user.role, 'customer');
    assert.equal(res.data.data.user.is_active, true);
  });

  test('2. Authenticated owner can retrieve their profile via GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: ownerToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.id, ownerId);
    assert.equal(res.data.data.user.email, ownerEmail);
    assert.equal(res.data.data.user.role, 'owner');
  });

  test('3. Authenticated admin can retrieve their profile via GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.id, adminId);
    assert.equal(res.data.data.user.email, adminEmail);
    assert.equal(res.data.data.user.role, 'admin');
  });

  test('4. Missing authentication returns HTTP 401 on GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me');
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Authentication required');
  });

  test('5. Invalid authentication token returns HTTP 401 on GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: 'invalid.jwt.token' });
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid or expired authentication token');
  });

  test('6. Response contains only approved profile fields on GET /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: customerToken });
    assert.equal(res.status, 200);
    const user = res.data.data.user;

    const allowedKeys = new Set(['id', 'name', 'email', 'role', 'avatar', 'is_active', 'created', 'updated']);
    for (const key of Object.keys(user)) {
      assert.ok(allowedKeys.has(key), `Field "${key}" is not in approved response allowlist`);
    }
  });

  test('7. Response never includes phone, token, password, or internal fields on GET', async () => {
    const res = await makeRequest('/api/v1/users/me', { token: ownerToken });
    const jsonStr = JSON.stringify(res.data);

    assert.ok(!jsonStr.includes('password'), 'Password must never be in response');
    assert.ok(!jsonStr.includes('passwordConfirm'), 'PasswordConfirm must never be in response');
    assert.ok(!jsonStr.includes('tokenKey'), 'tokenKey must never be in response');
    assert.ok(!jsonStr.includes('phone'), 'phone must never be in response');
    assert.ok(!jsonStr.includes('emailVisibility'), 'emailVisibility must never be in response');
    assert.equal(res.data.data.user.phone, undefined);
    assert.equal(res.data.data.user.token, undefined);
  });

  // ==========================================
  // PATCH /api/v1/users/me Tests
  // ==========================================

  test('8. Customer can update permitted profile fields (name) via PATCH /api/v1/users/me', async () => {
    const updatedName = 'Updated Customer Name';
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ name: updatedName }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.name, updatedName);
    assert.equal(res.data.data.user.id, customerId);
  });

  test('9. Owner can update permitted profile fields (name, avatar) via PATCH /api/v1/users/me', async () => {
    const updatedName = 'Updated Owner Name';
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ name: updatedName, avatar: null }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.name, updatedName);
    assert.equal(res.data.data.user.id, ownerId);
  });

  test('10. Admin can update permitted profile fields without changing privileged fields', async () => {
    const updatedName = 'Updated Admin Name';
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: adminToken,
      body: JSON.stringify({ name: updatedName }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.name, updatedName);
    assert.equal(res.data.data.user.role, 'admin');
    assert.equal(res.data.data.user.is_active, true);
  });

  test('11. Missing authentication returns HTTP 401 on PATCH /api/v1/users/me', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacker Name' }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Authentication required');
  });

  test('12. Invalid input returns HTTP 400 on PATCH /api/v1/users/me', async () => {
    // Empty name
    const emptyNameRes = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(emptyNameRes.status, 400);
    assert.equal(emptyNameRes.data.success, false);

    // Non-string name
    const nonStringRes = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ name: 12345 }),
    });
    assert.equal(nonStringRes.status, 400);
    assert.equal(nonStringRes.data.success, false);
  });

  test('13. Empty update payload ({}) is handled safely without error', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.id, customerId);
  });

  test('14. Attempts to change role are rejected with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ role: 'admin' }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('role'));

    // Verify role was not changed in PocketBase
    const adminPb = await getAdminClient();
    const freshRecord = await adminPb.collection('users').getOne(customerId);
    assert.equal(freshRecord.role, 'customer', 'Role must remain customer');
  });

  test('15. Attempts to change is_active are rejected with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ is_active: false }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);

    // Verify is_active was not modified
    const adminPb = await getAdminClient();
    const freshRecord = await adminPb.collection('users').getOne(customerId);
    assert.equal(freshRecord.is_active, true);
  });

  test('16. Attempts to change id or other privileged fields are rejected with HTTP 400', async () => {
    const privilegedPayloads = [
      { id: 'new-custom-id' },
      { email: 'newemail@example.com' },
      { password: 'NewPassword123!' },
      { tokenKey: 'new-token-key' },
      { verified: true },
      { created: '2020-01-01' },
      { updated: '2020-01-01' },
    ];

    for (const payload of privilegedPayloads) {
      const res = await makeRequest('/api/v1/users/me', {
        method: 'PATCH',
        token: customerToken,
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 400, `Payload ${JSON.stringify(payload)} must be rejected`);
      assert.equal(res.data.success, false);
    }
  });

  test('17. Attempts to inject owner phone/contact information are rejected with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ phone: '+8801700000000' }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('phone'));
  });

  test('18. Client-supplied user IDs cannot change another user record (IDOR defense)', async () => {
    // Customer attempts to modify victim user record
    // 1. Through body.id (rejected by Zod schema)
    const bodyAttempt = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ id: victimId, name: 'Hacked Name' }),
    });
    assert.equal(bodyAttempt.status, 400);

    // 2. Through query param ?id=victimId
    const queryAttempt = await makeRequest(`/api/v1/users/me?id=${victimId}`, {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    // Controller derives ID strictly from req.user.id, ignoring query params
    assert.equal(queryAttempt.status, 200);
    assert.equal(queryAttempt.data.data.user.id, customerId, 'Only customer own record was modified');

    // Confirm victim record remains completely unchanged in PocketBase
    const adminPb = await getAdminClient();
    const victimRecord = await adminPb.collection('users').getOne(victimId);
    assert.equal(victimRecord.name, 'Victim User', 'Victim record must remain untouched');
  });

  test('19. Response contains the updated sanitized profile on PATCH', async () => {
    const res = await makeRequest('/api/v1/users/me', {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ name: 'Final Customer Name' }),
    });

    assert.equal(res.status, 200);
    const user = res.data.data.user;

    assert.equal(user.name, 'Final Customer Name');
    assert.equal(user.id, customerId);
    assert.equal(user.email, customerEmail);
    assert.equal(user.role, 'customer');
    assert.equal(user.is_active, true);
    assert.ok('created' in user);
    assert.ok('updated' in user);
    assert.equal(user.password, undefined);
    assert.equal(user.token, undefined);
  });

  test('20. Missing PocketBase record is handled safely with HTTP 404', async () => {
    // Create an ephemeral user, get their token, then delete the record
    const adminPb = await getAdminClient();
    const tempUser = await adminPb.collection('users').create({
      name: 'Temp Deletion User',
      email: `temp_del_${testRunId}@example.com`,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });

    const userPb = new PocketBase(env.POCKETBASE_URL);
    const tempAuth = await userPb.collection('users').authWithPassword(tempUser.email, testPassword);
    const tempToken = tempAuth.token;

    // Delete user from PocketBase
    await adminPb.collection('users').delete(tempUser.id);

    // Try to access profile: authenticate middleware catches deleted user and rejects with 401
    const res = await makeRequest('/api/v1/users/me', { token: tempToken });
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
  });

  test('21. Unexpected errors do not leak sensitive details, tokens, or credentials', async () => {
    // Test with malformed JSON
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: env.CLIENT_URL,
        Cookie: `${AUTH_COOKIE_NAME}=${customerToken}`,
      },
      body: '{"name": invalid_json_here}',
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    const jsonStr = JSON.stringify(data);

    assert.ok(!jsonStr.includes('password'));
    assert.ok(!jsonStr.includes('POCKETBASE'));
    assert.ok(!jsonStr.includes('admin@shopfinder.local'));
  });

  // =========================================================================
  // Multipart Avatar Upload Tests (Phase 8, Task 8.4)
  // =========================================================================

  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  test('22. Customer uploads avatar via multipart/form-data successfully on PATCH /api/v1/users/me', async () => {
    const formData = new FormData();
    formData.append('name', 'Rahim Customer Updated');
    formData.append(
      'avatar',
      new Blob([validPngBuffer], { type: 'image/png' }),
      'customer_avatar.png'
    );

    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        Origin: env.CLIENT_URL,
        Cookie: `${AUTH_COOKIE_NAME}=${customerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.name, 'Rahim Customer Updated');
    assert.ok(json.data.user.avatar, 'User must have an avatar filename');

    // Verify directly in PocketBase
    const adminPb = await getAdminClient();
    const userInDb = await adminPb.collection('users').getOne(customerId);
    assert.equal(userInDb.name, 'Rahim Customer Updated');
    assert.equal(userInDb.avatar, json.data.user.avatar);
  });

  test('23. Uploading an invalid avatar image signature is rejected with HTTP 400', async () => {
    const fakeImageBuffer = Buffer.from('NOT_A_REAL_IMAGE_BUFFER_CONTENT_123456');
    const formData = new FormData();
    formData.append(
      'avatar',
      new Blob([fakeImageBuffer], { type: 'image/png' }),
      'fake.png'
    );

    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        Origin: env.CLIENT_URL,
        Cookie: `${AUTH_COOKIE_NAME}=${customerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error?.message, /Invalid file content|signature/i);
  });

  test('24. Avatar file exceeding 5MB limit is rejected with HTTP 400', async () => {
    // 5.5 MB fake buffer
    const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0);
    const formData = new FormData();
    formData.append(
      'avatar',
      new Blob([oversizedBuffer], { type: 'image/png' }),
      'huge.png'
    );

    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        Origin: env.CLIENT_URL,
        Cookie: `${AUTH_COOKIE_NAME}=${customerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error?.message, /Avatar file too large|5MB/i);
  });

  test('25. Unexpected multipart field is rejected with HTTP 400', async () => {
    const formData = new FormData();
    formData.append(
      'photo',
      new Blob([validPngBuffer], { type: 'image/png' }),
      'avatar.png'
    );

    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        Origin: env.CLIENT_URL,
        Cookie: `${AUTH_COOKIE_NAME}=${customerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error?.message, /Unexpected field/i);
  });
});

