import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

describe('Phase 10, Task 10.7 — Public Express Reveal Endpoint (POST /api/v1/customer/reveal)', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';

  let starterPlan = null;

  // Owners
  let testOwner1 = null;
  let testOwner2NoPhone = null;

  // Customers
  let customerWithCredits = null;
  let customerWithCreditsToken = null;
  let subWithCredits = null;

  let customerZeroCredits = null;
  let customerZeroCreditsToken = null;
  let subZeroCredits = null;

  let customerInactive = null;
  let customerInactiveToken = null;

  // Non-customer roles for RBAC
  let ownerUser = null;
  let ownerUserToken = null;

  let adminUser = null;
  let adminUserToken = null;

  // Listings
  let listingApproved1 = null;
  let listingApproved2 = null;
  let listingPending = null;
  let listingNoPhone = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdContactIds = [];
  const createdSubIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 6);
  const testPassword = 'TestPassword123!';

  before(async () => {
    adminPb = await getAdminClient();
    const timestamp = Date.now();

    // 1. Fetch active subscription plan
    starterPlan = await adminPb.collection('subscription_plans').getFirstListItem('is_active = true');

    // 2. Create Commercial Owner 1 (with private contact phone)
    testOwner1 = await adminPb.collection('users').create({
      email: `owner.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner Task 10.7',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner1.id);

    const contact1 = await adminPb.collection('owner_contacts').create({
      owner: testOwner1.id,
      phone: '+8801712345678',
    });
    createdContactIds.push(contact1.id);

    // 3. Create Commercial Owner 2 (WITHOUT contact phone)
    testOwner2NoPhone = await adminPb.collection('users').create({
      email: `owner.nophone.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner No Phone 10.7',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner2NoPhone.id);

    // 4. Create Listings
    // 4a. Approved listing 1 (owned by testOwner1)
    listingApproved1 = await adminPb.collection('listings').create({
      title: `Approved Shop 1 Task 10.7 ${timestamp}`,
      description: 'Approved retail shop for customer reveal endpoint testing',
      price: 50000,
      area_sqft: 850,
      address: '100 Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(listingApproved1.id);

    // 4b. Approved listing 2 (owned by testOwner1)
    listingApproved2 = await adminPb.collection('listings').create({
      title: `Approved Shop 2 Task 10.7 ${timestamp}`,
      description: 'Second approved retail shop for repeat reveal testing',
      price: 65000,
      area_sqft: 1100,
      address: '200 Road, Gulshan',
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'showroom',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(listingApproved2.id);

    // 4c. Pending listing (status !== 'approved')
    listingPending = await adminPb.collection('listings').create({
      title: `Pending Shop Task 10.7 ${timestamp}`,
      description: 'Unapproved listing for status verification testing',
      price: 35000,
      area_sqft: 500,
      address: '300 Road, Banani',
      city: 'Dhaka',
      area: 'Banani',
      category: 'office',
      listing_type: 'rent',
      status: 'pending',
      owner: testOwner1.id,
    });
    createdListingIds.push(listingPending.id);

    // 4d. Approved listing with no phone
    listingNoPhone = await adminPb.collection('listings').create({
      title: `No Phone Shop Task 10.7 ${timestamp}`,
      description: 'Approved listing whose owner has no phone record',
      price: 40000,
      area_sqft: 600,
      address: '400 Road, Mirpur',
      city: 'Dhaka',
      area: 'Mirpur',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner2NoPhone.id,
    });
    createdListingIds.push(listingNoPhone.id);

    // 5. Create Customer with Credits (10 total, 0 used)
    customerWithCredits = await adminPb.collection('users').create({
      email: `cust.credits.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer With Credits',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerWithCredits.id);

    subWithCredits = await adminPb.collection('user_subscriptions').create({
      user: customerWithCredits.id,
      plan: starterPlan.id,
      credits_total: 10,
      credits_used: 0,
      status: 'active',
      purchased_at: new Date(timestamp - 100000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subWithCredits.id);

    // 6. Create Customer with Zero Credits (5 total, 5 used)
    customerZeroCredits = await adminPb.collection('users').create({
      email: `cust.zero.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer Zero Credits',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(customerZeroCredits.id);

    subZeroCredits = await adminPb.collection('user_subscriptions').create({
      user: customerZeroCredits.id,
      plan: starterPlan.id,
      credits_total: 5,
      credits_used: 5,
      status: 'active',
      purchased_at: new Date(timestamp - 50000).toISOString(),
      expires_at: null,
    });
    createdSubIds.push(subZeroCredits.id);

    // 7. Create Inactive Customer (is_active: false)
    customerInactive = await adminPb.collection('users').create({
      email: `cust.inactive.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer Inactive',
      role: 'customer',
      is_active: false,
    });
    createdUserIds.push(customerInactive.id);

    // 8. Create Owner User (for RBAC testing)
    ownerUser = await adminPb.collection('users').create({
      email: `owner.rbac.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner RBAC',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(ownerUser.id);

    // 9. Create Admin User (for RBAC testing)
    adminUser = await adminPb.collection('users').create({
      email: `admin.rbac.10_7.${timestamp}.${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Admin RBAC',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(adminUser.id);

    // 10. Authenticate users to obtain auth tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const cAuth = await userPb.collection('users').authWithPassword(customerWithCredits.email, testPassword);
    customerWithCreditsToken = cAuth.token;

    const zAuth = await userPb.collection('users').authWithPassword(customerZeroCredits.email, testPassword);
    customerZeroCreditsToken = zAuth.token;

    const oAuth = await userPb.collection('users').authWithPassword(ownerUser.email, testPassword);
    ownerUserToken = oAuth.token;

    const aAuth = await userPb.collection('users').authWithPassword(adminUser.email, testPassword);
    adminUserToken = aAuth.token;

    // For inactive customer: authWithPassword might fail or token might be issued before deactivation
    try {
      const inAuth = await userPb.collection('users').authWithPassword(customerInactive.email, testPassword);
      customerInactiveToken = inAuth.token;
    } catch {
      customerInactiveToken = 'invalid-or-deactivated-token';
    }

    // 11. Start ephemeral HTTP test server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Close HTTP test server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // 2. Clean up created records in reverse dependency order
    const pb = await getAdminClient();

    // Clean reveals
    const reveals = await pb.collection('revealed_contacts').getFullList({
      filter: pb.filter('customer = {:c1} || customer = {:c2}', {
        c1: customerWithCredits ? customerWithCredits.id : '',
        c2: customerZeroCredits ? customerZeroCredits.id : '',
      }),
    });
    for (const r of reveals) {
      try {
        await pb.collection('revealed_contacts').delete(r.id);
      } catch {}
    }

    // Clean subscriptions
    for (const sId of createdSubIds) {
      try {
        await pb.collection('user_subscriptions').delete(sId);
      } catch {}
    }

    // Clean listings
    for (const lId of createdListingIds) {
      try {
        await pb.collection('listings').delete(lId);
      } catch {}
    }

    // Clean owner contacts
    for (const cId of createdContactIds) {
      try {
        await pb.collection('owner_contacts').delete(cId);
      } catch {}
    }

    // Clean users
    for (const uId of createdUserIds) {
      try {
        await pb.collection('users').delete(uId);
      } catch {}
    }
  });

  // =========================================================================
  // 1. Core Reveal Functionality & Credit Invariants
  // =========================================================================
  describe('1. Core Reveal Functionality & Credit Invariants', () => {
    test('1. Authenticated active customer can reveal a valid approved listing (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 for successful first reveal');
      const body = await res.json();

      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.listingId, listingApproved1.id);
      assert.strictEqual(body.data.ownerId, testOwner1.id);
      assert.strictEqual(body.data.phone, '+8801712345678');
      assert.strictEqual(body.data.alreadyRevealed, false);
      assert.strictEqual(body.data.creditDeducted, true);
      assert.strictEqual(body.data.creditsDeducted, 1);
      assert.strictEqual(body.data.creditsRemaining, 9);
      assert.ok(body.data.revealId, 'revealId must be present in response');
      assert.ok(body.data.revealedAt, 'revealedAt timestamp must be present');
    });

    test('11. First reveal deducts exactly one credit in the database', async () => {
      // In SQLite, verify subscription credits_used was incremented from 0 to 1
      const sub = await adminPb.collection('user_subscriptions').getOne(subWithCredits.id);
      assert.strictEqual(sub.credits_used, 1, 'credits_used in SQLite must be exactly 1');
      assert.strictEqual(sub.credits_total - sub.credits_used, 9, 'credits_remaining must be 9');

      // Verify revealed_contacts record exists in database
      const reveal = await adminPb.collection('revealed_contacts').getFirstListItem(
        adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customerWithCredits.id,
          l: listingApproved1.id,
        })
      );
      assert.ok(reveal, 'revealed_contacts record must exist in database');
      assert.strictEqual(reveal.owner, testOwner1.id);
    });

    test('12. Repeated reveal does not deduct another credit (idempotent repeat reveal)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 for repeat reveal');
      const body = await res.json();

      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.listingId, listingApproved1.id);
      assert.strictEqual(body.data.ownerId, testOwner1.id);
      assert.strictEqual(body.data.phone, '+8801712345678');
      assert.strictEqual(body.data.alreadyRevealed, true, 'alreadyRevealed must be true for repeat reveal');
      assert.strictEqual(body.data.creditDeducted, false, 'creditDeducted must be false');
      assert.strictEqual(body.data.creditsDeducted, 0, 'creditsDeducted must be 0');

      // Verify in SQLite that credits_used is STILL exactly 1
      const sub = await adminPb.collection('user_subscriptions').getOne(subWithCredits.id);
      assert.strictEqual(sub.credits_used, 1, 'credits_used in SQLite must remain unchanged at 1');
    });

    test('13. Insufficient credits return HTTP 402 Payment Required', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerZeroCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved2.id,
        }),
      });

      assert.strictEqual(res.status, 402, 'Expected HTTP 402 for customer with 0 credits');
      const body = await res.json();

      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /insufficient credits/i);

      // Verify no revealed_contacts record was created
      let recordFound = false;
      try {
        await adminPb.collection('revealed_contacts').getFirstListItem(
          adminPb.filter('customer = {:c} && listing = {:l}', {
            c: customerZeroCredits.id,
            l: listingApproved2.id,
          })
        );
        recordFound = true;
      } catch {
        recordFound = false;
      }
      assert.strictEqual(recordFound, false, 'No reveal record must exist after 402 error');
    });

    test('14. Owner phone is returned only after a valid reveal; unavailable phone returns HTTP 404', async () => {
      // Reveal listing whose owner has no contact record
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingNoPhone.id,
        }),
      });

      // Contact retrieval returns HTTP 404 because owner_contacts has no phone
      assert.strictEqual(res.status, 404, 'Expected HTTP 404 when owner has no phone');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /contact information is unavailable/i);
    });
  });

  // =========================================================================
  // 2. Authentication, Authorization & RBAC Boundaries
  // =========================================================================
  describe('2. Authentication, Authorization & RBAC Boundaries', () => {
    test('2. Anonymous request is rejected with HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /authentication required/i);
    });

    test('3. Owner account is rejected with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${ownerUserToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 403, 'Owner user must be rejected with HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /forbidden|insufficient permissions/i);
    });

    test('4. Admin account is rejected with HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${adminUserToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 403, 'Admin user must be rejected with HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /forbidden|insufficient permissions/i);
    });

    test('5. Inactive customer is rejected with HTTP 400 or 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerInactiveToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.ok([400, 401].includes(res.status), `Inactive customer must return 400 or 401, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
    });
  });

  // =========================================================================
  // 3. Client Identity Override Protection (D-017)
  // =========================================================================
  describe('3. Client Identity Override Protection (D-017)', () => {
    test('6. Browser-supplied customerId is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved2.id,
          customerId: customerZeroCredits.id, // Attempt to forge customerId
        }),
      });

      assert.strictEqual(res.status, 400, 'Browser-supplied customerId must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /client-supplied customerId is strictly prohibited/i);
    });

    test('7. Browser-supplied ownerId is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved2.id,
          ownerId: 'forged_owner_id',
        }),
      });

      assert.strictEqual(res.status, 400, 'Browser-supplied ownerId must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /client-supplied ownerId is prohibited/i);
    });

    test('8. Browser-supplied phone is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingApproved2.id,
          phone: '+1 555-019-9999',
        }),
      });

      assert.strictEqual(res.status, 400, 'Browser-supplied phone must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /client-supplied phone is prohibited/i);
    });
  });

  // =========================================================================
  // 4. Request Payload & Listing Validation
  // =========================================================================
  describe('4. Request Payload & Listing Validation', () => {
    test('9. Missing listing ID is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400, 'Missing listingId must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /listingId is required/i);
    });

    test('10a. Non-string listing ID is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: 12345,
        }),
      });

      assert.strictEqual(res.status, 400, 'Non-string listingId must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /listingId is required and must be a non-empty string/i);
    });

    test('10b. Non-existent listing ID returns HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: 'nonexistent_listing_xyz',
        }),
      });

      assert.strictEqual(res.status, 404, 'Non-existent listing must return HTTP 404');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /listing not found/i);
    });

    test('10c. Unapproved listing status returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: listingPending.id,
        }),
      });

      assert.strictEqual(res.status, 400, 'Unapproved listing must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.match(body.error?.message, /listing is not approved/i);
    });
  });

  // =========================================================================
  // 5. Privacy, Security & Route Aliases
  // =========================================================================
  describe('5. Privacy, Security & Route Aliases', () => {
    test('15. Internal PocketBase errors do not leak sensitive information', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
        body: JSON.stringify({
          listingId: 'malformed"injection\'test',
        }),
      });

      const bodyText = await res.text();
      assert.doesNotMatch(bodyText, /tokenKey|password|superusers|sqlite|SQLITE_ERROR/i);
      assert.doesNotMatch(bodyText, /pocketbase_admin_password/i);
    });

    test('16. CSRF Origin validation: missing Origin/Referer on state-changing POST is rejected with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customer/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
          // No Origin or Referer header
        },
        body: JSON.stringify({
          listingId: listingApproved1.id,
        }),
      });

      assert.strictEqual(res.status, 403, 'CSRF failure must return HTTP 403');
    });

    test('17. Route alias POST /api/v1/reveal/:listingId functions identically', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reveal/${listingApproved1.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `pb_auth=${customerWithCreditsToken}`,
        },
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 for reveal route alias');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.listingId, listingApproved1.id);
      assert.strictEqual(body.data.phone, '+8801712345678');
    });
  });
});
