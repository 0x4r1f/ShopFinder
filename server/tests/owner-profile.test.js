import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

describe('Phase 6, Task 6.7 — Owner Business Profile Management API', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let ownerEmail;
  let otherOwnerEmail;
  let customerEmail;
  let adminEmail;

  let ownerId;
  let otherOwnerId;
  let customerId;
  let adminId;

  let ownerToken;
  let otherOwnerToken;
  let customerToken;
  let adminToken;

  const createdUserIds = [];
  const createdContactIds = [];

  // 1x1 valid transparent PNG buffer
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Owner User
    ownerEmail = `owner_prof_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Prime Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 2. Create Secondary Owner User (for isolation/IDOR checks)
    otherOwnerEmail = `other_prof_${testRunId}@shopfinder.local`;
    const otherRec = await adminPb.collection('users').create({
      name: `Other Owner ${testRunId}`,
      email: otherOwnerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    otherOwnerId = otherRec.id;
    createdUserIds.push(otherOwnerId);

    // 3. Create Customer User
    customerEmail = `cust_prof_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer User ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 4. Create Admin User
    adminEmail = `admin_prof_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin User ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 5. Authenticate users to acquire JWT tokens for pb_auth cookie
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const otherOwnerAuth = await userPb.collection('users').authWithPassword(otherOwnerEmail, testPassword);
    otherOwnerToken = otherOwnerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

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
      const pb = await getAdminClient();
      for (const id of createdContactIds) {
        try {
          await pb.collection('owner_contacts').delete(id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await pb.collection('users').delete(id);
        } catch {}
      }
    } catch {}
  });

  // =========================================================================
  // 1. Profile Retrieval (GET /api/v1/owner/profile)
  // =========================================================================

  test('1. Owner retrieves profile successfully when no contact phone is set (returns null phone)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'GET',
      headers: {
        Cookie: `pb_auth=${ownerToken}`,
      },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data?.profile, 'Must return profile object');

    const profile = json.data.profile;
    assert.equal(profile.id, ownerId);
    assert.equal(profile.email, ownerEmail);
    assert.equal(profile.role, 'owner');
    assert.equal(profile.phone, null, 'Must return null phone when no contact record exists');
    assert.ok(profile.created, 'Must include created timestamp');

    // Security sanitization check
    assert.equal(profile.password, undefined);
    assert.equal(profile.tokenKey, undefined);
    assert.equal(profile.emailVisibility, undefined);
  });

  // =========================================================================
  // 2. Profile Updates (PATCH /api/v1/owner/profile)
  // =========================================================================

  test('2. Owner updates name and sets new contact phone number (creates owner_contacts record)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Apex Commercial Properties Ltd.',
        phone: '+880 1712-345678',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.message, 'Profile updated successfully');

    const profile = json.data.profile;
    assert.equal(profile.name, 'Apex Commercial Properties Ltd.');
    assert.equal(profile.phone, '+880 1712-345678');

    // Verify database state: phone must be in owner_contacts, NOT users
    const userRec = await adminPb.collection('users').getOne(ownerId);
    assert.equal(userRec.name, 'Apex Commercial Properties Ltd.');
    assert.equal(userRec.phone, undefined, 'Phone must NOT exist on users collection');

    const contactRec = await adminPb.collection('owner_contacts').getFirstListItem(
      adminPb.filter('owner = {:owner}', { owner: ownerId })
    );
    assert.equal(contactRec.phone, '+880 1712-345678');
    createdContactIds.push(contactRec.id);
  });

  test('3. Owner updates existing phone number (updates rather than creates duplicate record)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({
        phone: '+880 1899-112233',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.profile.phone, '+880 1899-112233');

    // Verify exactly one owner_contacts record exists
    const contacts = await adminPb.collection('owner_contacts').getFullList({
      filter: adminPb.filter('owner = {:owner}', { owner: ownerId }),
    });
    assert.equal(contacts.length, 1, 'Must have exactly one contact record');
    assert.equal(contacts[0].phone, '+880 1899-112233');
  });

  test('4. Empty {} PATCH payload is rejected with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.error?.message?.includes('At least one field must be provided'));
  });

  test('5. Invalid phone formats are rejected with HTTP 400', async () => {
    const invalidPhones = [
      '123', // too short (<6)
      '1234567890123456789012345678901', // too long (>30)
      'phone-number-with-letters', // letters rejected
      '+880!1712@3456', // special symbols rejected
    ];

    for (const badPhone of invalidPhones) {
      const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${ownerToken}`,
        },
        body: JSON.stringify({ phone: badPhone }),
      });

      assert.equal(res.status, 400, `Phone "${badPhone}" should be rejected`);
      const json = await res.json();
      assert.equal(json.success, false);
    }
  });

  test('6. Privileged field injection (email, role, id, is_active, password) is rejected with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Name',
        role: 'admin',
        email: 'hacked@example.com',
        is_active: false,
      }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(
      json.error?.message?.includes('Unrecognized') ||
      json.error?.message?.includes('Prohibited') ||
      json.error?.details?.length > 0,
      'Must return validation error details'
    );
  });

  test('7. Owner uploads avatar via multipart/form-data successfully', async () => {
    const formData = new FormData();
    formData.append('name', 'Apex Holdings (Updated with Logo)');
    formData.append('avatar', new Blob([validPngBuffer], { type: 'image/png' }), 'logo.png');

    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.profile.name, 'Apex Holdings (Updated with Logo)');
    assert.ok(json.data.profile.avatar, 'Must have avatar filename');
    assert.ok(json.data.profile.avatar_url, 'Must resolve avatar_url');
  });

  // =========================================================================
  // 3. Authorization & IDOR Protection
  // =========================================================================

  test('8. Customer request to GET /api/v1/owner/profile returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'GET',
      headers: {
        Cookie: `pb_auth=${customerToken}`,
      },
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('9. Admin request to GET /api/v1/owner/profile returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'GET',
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('10. Unauthenticated request to GET /api/v1/owner/profile returns HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'GET',
    });

    assert.equal(res.status, 401);
  });

  test('11. Customer request to PATCH /api/v1/owner/profile returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${customerToken}`,
      },
      body: JSON.stringify({ name: 'Malicious Name' }),
    });

    assert.equal(res.status, 403);
  });

  test('12. Admin request to PATCH /api/v1/owner/profile returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${adminToken}`,
      },
      body: JSON.stringify({ name: 'Admin Trying To Edit Owner Profile' }),
    });

    assert.equal(res.status, 403);
  });

  test('13. Client-supplied target owner ID in body is ignored/rejected (IDOR prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({
        id: otherOwnerId,
        owner: otherOwnerId,
        name: 'Attempted IDOR Attack',
      }),
    });

    assert.equal(res.status, 400); // Strict schema rejects 'id' and 'owner'
    const json = await res.json();
    assert.equal(json.success, false);

    // Verify other owner was untouched
    const otherRec = await adminPb.collection('users').getOne(otherOwnerId);
    assert.notEqual(otherRec.name, 'Attempted IDOR Attack');
  });

  // =========================================================================
  // 4. Concurrency & Atomicity
  // =========================================================================

  test('14. Concurrent profile phone updates execute safely without duplicate contact records', async () => {
    const updates = [
      fetch(`${baseUrl}/api/v1/owner/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${otherOwnerToken}`,
        },
        body: JSON.stringify({ phone: '+880 1700-111111' }),
      }),
      fetch(`${baseUrl}/api/v1/owner/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${otherOwnerToken}`,
        },
        body: JSON.stringify({ phone: '+880 1700-222222' }),
      }),
    ];

    const responses = await Promise.all(updates);
    for (const res of responses) {
      assert.equal(res.status, 200);
    }

    // Verify otherOwner has exactly 1 contact record
    const contacts = await adminPb.collection('owner_contacts').getFullList({
      filter: adminPb.filter('owner = {:owner}', { owner: otherOwnerId }),
    });
    assert.equal(contacts.length, 1, 'Must have exactly one contact record despite concurrent creation');
    createdContactIds.push(contacts[0].id);
  });

  // =========================================================================
  // 5. Privacy Regressions
  // =========================================================================

  test('15. Generic user profile endpoint (/api/v1/users/me) does not permit updating phone or leak owner_contacts', async () => {
    // 15a. Attempt to update phone via /api/v1/users/me -> rejected with HTTP 400
    const patchRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `pb_auth=${ownerToken}`,
      },
      body: JSON.stringify({ phone: '+880 1999-000000' }),
    });
    assert.equal(patchRes.status, 400);

    // 15b. GET /api/v1/users/me does not expose phone or owner_contacts
    const getRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'GET',
      headers: {
        Cookie: `pb_auth=${ownerToken}`,
      },
    });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.data?.user?.phone, undefined);
    assert.equal(getJson.data?.user?.owner_contacts, undefined);
  });

  // =========================================================================
  // 6. Transaction Atomicity & Hook Security (Task 6.7 Corrective Verification)
  // =========================================================================

  test('16. Private PocketBase custom route rejects anonymous and non-superuser requests', async () => {
    const customRouteUrl = `${env.POCKETBASE_URL}/api/custom/owner/profile-upsert`;

    // 16a. Unauthenticated request rejected with HTTP 401
    const unauthRes = await fetch(customRouteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, name: 'Hacked Name' }),
    });
    assert.equal(unauthRes.status, 401, 'Anonymous request must return 401');

    // 16b. Ordinary owner token rejected with HTTP 403 / 401 (requires superuser)
    const userAuthRes = await fetch(customRouteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ownerToken,
      },
      body: JSON.stringify({ ownerId, name: 'Hacked Name' }),
    });
    assert.ok(
      userAuthRes.status === 401 || userAuthRes.status === 403,
      `Non-superuser request must be rejected (got ${userAuthRes.status})`
    );
  });

  test('17. Transaction rollback: failure during execution leaves both users and owner_contacts untouched', async () => {
    const { updateOwnerProfile } = await import('../src/services/ownerProfile.service.js');

    // Get current state before test
    const userBefore = await adminPb.collection('users').getOne(ownerId);
    const initialName = userBefore.name;

    let contactBefore = null;
    try {
      contactBefore = await adminPb.collection('owner_contacts').getFirstListItem(
        adminPb.filter('owner = {:owner}', { owner: ownerId })
      );
    } catch {}
    const initialPhone = contactBefore?.phone || null;

    // Attempt transactional update with simulated failure
    await assert.rejects(
      async () => {
        await updateOwnerProfile(
          ownerId,
          { name: 'Rolled Back Name', phone: '+880 1799 999999' },
          null,
          { simulateFailure: true }
        );
      },
      (err) => {
        return err.message.includes('Simulated') || err.status === 500 || err.status === 400;
      },
      'Must reject when simulation hook triggers'
    );

    // Verify user record in SQLite was rolled back to initialName
    const userAfter = await adminPb.collection('users').getOne(ownerId);
    assert.equal(userAfter.name, initialName, 'User name must NOT have changed after rolled back transaction');

    // Verify contact record in SQLite was rolled back
    let contactAfter = null;
    try {
      contactAfter = await adminPb.collection('owner_contacts').getFirstListItem(
        adminPb.filter('owner = {:owner}', { owner: ownerId })
      );
    } catch {}
    assert.equal(contactAfter?.phone || null, initialPhone, 'Contact phone must NOT have changed after rolled back transaction');
  });

  test('18. Atomic multi-collection update: updates name, avatar, and phone in single transaction', async () => {
    const { updateOwnerProfile } = await import('../src/services/ownerProfile.service.js');

    const updatedProfile = await updateOwnerProfile(
      ownerId,
      { name: 'Fully Atomic Commercial Owner', phone: '+880 1811 888888' },
      {
        buffer: validPngBuffer,
        mimetype: 'image/png',
        originalname: 'atomic_avatar.png',
      }
    );

    assert.equal(updatedProfile.name, 'Fully Atomic Commercial Owner');
    assert.equal(updatedProfile.phone, '+880 1811 888888');
    assert.ok(updatedProfile.avatar, 'Must have saved avatar');
    assert.ok(updatedProfile.avatar_url?.includes('/api/files/'), 'Must have generated avatar URL');

    // Verify in database directly
    const userInDb = await adminPb.collection('users').getOne(ownerId);
    assert.equal(userInDb.name, 'Fully Atomic Commercial Owner');
    assert.equal(userInDb.avatar, updatedProfile.avatar);

    const contactInDb = await adminPb.collection('owner_contacts').getFirstListItem(
      adminPb.filter('owner = {:owner}', { owner: ownerId })
    );
    assert.equal(contactInDb.phone, '+880 1811 888888');
  });

  test('19. D-014 rule verification: all five owner_contacts access rules remain null (deny-all)', async () => {
    const col = await adminPb.collections.getOne('owner_contacts');
    assert.equal(col.listRule, null, 'listRule must be null');
    assert.equal(col.viewRule, null, 'viewRule must be null');
    assert.equal(col.createRule, null, 'createRule must be null');
    assert.equal(col.updateRule, null, 'updateRule must be null');
    assert.equal(col.deleteRule, null, 'deleteRule must be null');
  });
});
