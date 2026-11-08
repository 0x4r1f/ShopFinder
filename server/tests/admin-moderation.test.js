import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';
import * as adminService from '../src/services/admin.service.js';

describe('Phase 7, Task 7.3 — Admin Listing Moderation Actions (Approve, Reject, Archive)', () => {
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
  const createdListingIds = [];
  const createdContactIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Admin User 1
    admin1Email = `adm1_mod_${testRunId}@shopfinder.local`;
    const admin1Rec = await adminPb.collection('users').create({
      name: `Admin Primary ${testRunId}`,
      email: admin1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin1Id = admin1Rec.id;
    createdUserIds.push(admin1Id);

    // 2. Create Admin User 2 (for independent review of admin1 listings)
    admin2Email = `adm2_mod_${testRunId}@shopfinder.local`;
    const admin2Rec = await adminPb.collection('users').create({
      name: `Admin Peer ${testRunId}`,
      email: admin2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    admin2Id = admin2Rec.id;
    createdUserIds.push(admin2Id);

    // 3. Create Regular Owner User
    ownerEmail = `own_mod_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner Moderation ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 4. Create Regular Customer User
    customerEmail = `cust_mod_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer Moderation ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 5. Create Owner Contact (phone number) in owner_contacts to test D-014 privacy
    try {
      const contactRec = await adminPb.collection('owner_contacts').create({
        owner: ownerId,
        phone: '+880 1819-554433',
      });
      createdContactIds.push(contactRec.id);
    } catch {}

    // 6. Authenticate users to acquire JWT tokens for pb_auth cookie
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

  // Helper to make CSRF-compliant requests to Express backend
  async function apiPost(path, { token, body } = {}) {
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
      method: 'POST',
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  }

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
      for (const id of createdListingIds) {
        try {
          await pb.collection('listings').delete(id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await pb.collection('users').delete(id);
        } catch {}
      }
    } catch {}
  });

  // Helper to create fresh test listings
  async function createTestListing(overrides = {}) {
    const defaultData = {
      title: `Moderation Property ${Date.now()}`,
      description: 'Test commercial property description for moderation actions testing.',
      category: 'office',
      listing_type: 'rent',
      price: 60000,
      area_sqft: 1100,
      address: '78 Gulshan 1',
      city: 'Dhaka',
      area: 'Gulshan',
      owner: ownerId,
      status: 'pending',
      ...overrides,
    };
    const rec = await adminPb.collection('listings').create(defaultData);
    createdListingIds.push(rec.id);
    return rec;
  }

  // =========================================================================
  // APPROVE TESTS (1 - 6)
  // =========================================================================
  describe('Approve Listing (POST /api/v1/admin/listings/:id/approve)', () => {
    test('1. Admin can approve an existing listing', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/approve`, {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 on approval');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data?.listing, 'Must return approved listing data');
      assert.strictEqual(body.data.listing.id, listing.id);
    });

    test('2. Status becomes "approved" in database', async () => {
      const listing = await createTestListing({ status: 'pending' });

      await apiPost(`/api/v1/admin/listings/${listing.id}/approve`, {
        token: admin1Token,
      });

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.status, 'approved', 'Database record status must be "approved"');
    });

    test('3. Existing rejection note is cleared on approval', async () => {
      const listing = await createTestListing({
        status: 'rejected',
        rejection_note: 'Previous rejection note from past review.',
      });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/approve`, {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.listing.status, 'approved');
      assert.strictEqual(body.data.listing.rejection_note, null, 'rejection_note must be null or empty in response');

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.rejection_note, '', 'Database rejection_note must be cleared to empty string');
    });

    test('4. Missing listing returns HTTP 404', async () => {
      const res = await apiPost('/api/v1/admin/listings/nonexistent_lst_id/approve', {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 404, 'Missing listing must return HTTP 404');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error?.message, 'Listing not found');
    });

    test('5. Admin CANNOT approve their own listing (Anti-self-approval returns HTTP 403)', async () => {
      // Create listing owned by admin1
      const selfListing = await createTestListing({
        owner: admin1Id,
        status: 'pending',
      });

      const res = await apiPost(`/api/v1/admin/listings/${selfListing.id}/approve`, {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 403, 'Self-approval must be rejected with HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('cannot approve their own listings'));
    });

    test('6. Self-approval attempt leaves listing unchanged in database', async () => {
      const selfListing = await createTestListing({
        owner: admin1Id,
        status: 'pending',
        rejection_note: 'Initial note',
      });

      await apiPost(`/api/v1/admin/listings/${selfListing.id}/approve`, {
        token: admin1Token,
      });

      const dbListing = await adminPb.collection('listings').getOne(selfListing.id);
      assert.strictEqual(dbListing.status, 'pending', 'Listing status must remain pending');
      assert.strictEqual(dbListing.rejection_note, 'Initial note', 'Rejection note must remain unchanged');
    });
  });

  // =========================================================================
  // REJECT TESTS (7 - 16)
  // =========================================================================
  describe('Reject Listing (POST /api/v1/admin/listings/:id/reject)', () => {
    test('7. Admin can reject an existing listing with a valid note', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'The floor plan documentation is unclear and needs re-upload.',
        },
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 on rejection');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data?.listing?.status, 'rejected');
      assert.strictEqual(
        body.data?.listing?.rejection_note,
        'The floor plan documentation is unclear and needs re-upload.'
      );
    });

    test('8. Status becomes "rejected" in database', async () => {
      const listing = await createTestListing({ status: 'pending' });

      await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'Invalid commercial zoning permit.',
        },
      });

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.status, 'rejected');
    });

    test('9. Rejection note is persisted correctly in database', async () => {
      const listing = await createTestListing({ status: 'pending' });
      const testNote = 'Price exceeds permitted municipal ceiling for this category.';

      await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: testNote,
        },
      });

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.rejection_note, testNote);
    });

    test('10. Missing rejection note returns HTTP 400', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {},
      });

      assert.strictEqual(res.status, 400, 'Missing rejection note must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('Rejection note is required'));
    });

    test('11. Empty rejection note returns HTTP 400', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: '',
        },
      });

      assert.strictEqual(res.status, 400, 'Empty rejection note must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('Rejection note cannot be empty'));
    });

    test('12. Whitespace-only rejection note returns HTTP 400', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: '     \n\t   ',
        },
      });

      assert.strictEqual(res.status, 400, 'Whitespace-only note must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('Rejection note cannot be empty'));
    });

    test('13. Note exceeding 1000 characters returns HTTP 400', async () => {
      const listing = await createTestListing({ status: 'pending' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'A'.repeat(1001),
        },
      });

      assert.strictEqual(res.status, 400, 'Oversized note must return HTTP 400');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('cannot exceed 1000 characters'));
    });

    test('14. A note with surrounding whitespace is trimmed before saving', async () => {
      const listing = await createTestListing({ status: 'pending' });
      const rawNote = '   Please provide valid trade license copy.   \n';

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: rawNote,
        },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.listing.rejection_note, 'Please provide valid trade license copy.');

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.rejection_note, 'Please provide valid trade license copy.');
    });

    test('15. Admin CANNOT reject their own listing (Anti-self-rejection returns HTTP 403)', async () => {
      const selfListing = await createTestListing({
        owner: admin1Id,
        status: 'pending',
      });

      const res = await apiPost(`/api/v1/admin/listings/${selfListing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'Self rejection attempt.',
        },
      });

      assert.strictEqual(res.status, 403, 'Self-rejection must return HTTP 403');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('cannot reject their own listings'));
    });

    test('16. Self-rejection attempt leaves listing unchanged in database', async () => {
      const selfListing = await createTestListing({
        owner: admin1Id,
        status: 'pending',
        rejection_note: '',
      });

      await apiPost(`/api/v1/admin/listings/${selfListing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'Attempting to self-reject.',
        },
      });

      const dbListing = await adminPb.collection('listings').getOne(selfListing.id);
      assert.strictEqual(dbListing.status, 'pending', 'Listing status must remain pending');
      assert.strictEqual(dbListing.rejection_note, '', 'Rejection note must remain empty string');
    });
  });

  // =========================================================================
  // ARCHIVE TESTS (17 - 19)
  // =========================================================================
  describe('Archive Listing (POST /api/v1/admin/listings/:id/archive)', () => {
    test('17. Admin can archive an existing listing', async () => {
      const listing = await createTestListing({ status: 'approved' });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/archive`, {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 on archive');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data?.listing?.status, 'archived');
    });

    test('18. Status becomes "archived" in database', async () => {
      const listing = await createTestListing({ status: 'pending' });

      await apiPost(`/api/v1/admin/listings/${listing.id}/archive`, {
        token: admin1Token,
      });

      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.status, 'archived', 'Database record status must be "archived"');
    });

    test('19. Missing listing returns HTTP 404 for archive', async () => {
      const res = await apiPost('/api/v1/admin/listings/nonexistent_archive_id/archive', {
        token: admin1Token,
      });

      assert.strictEqual(res.status, 404, 'Missing listing must return HTTP 404');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error?.message, 'Listing not found');
    });
  });

  // =========================================================================
  // AUTHORIZATION & SECURITY TESTS (20 - 25)
  // =========================================================================
  describe('Authorization and Security across moderation actions', () => {
    const endpoints = [
      { action: 'approve', body: null },
      { action: 'reject', body: { rejection_note: 'Valid rejection note' } },
      { action: 'archive', body: null },
    ];

    for (const ep of endpoints) {
      test(`20. Anonymous request to /api/v1/admin/listings/:id/${ep.action} returns HTTP 401`, async () => {
        const listing = await createTestListing();
        const res = await apiPost(`/api/v1/admin/listings/${listing.id}/${ep.action}`, {
          token: null,
          body: ep.body,
        });

        assert.strictEqual(res.status, 401, `Anonymous ${ep.action} must return 401`);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      test(`21. Customer request to /api/v1/admin/listings/:id/${ep.action} returns HTTP 403`, async () => {
        const listing = await createTestListing();
        const res = await apiPost(`/api/v1/admin/listings/${listing.id}/${ep.action}`, {
          token: customerToken,
          body: ep.body,
        });

        assert.strictEqual(res.status, 403, `Customer ${ep.action} must return 403`);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });

      test(`22. Owner request to /api/v1/admin/listings/:id/${ep.action} returns HTTP 403`, async () => {
        const listing = await createTestListing();
        const res = await apiPost(`/api/v1/admin/listings/${listing.id}/${ep.action}`, {
          token: ownerToken,
          body: ep.body,
        });

        assert.strictEqual(res.status, 403, `Owner ${ep.action} must return 403`);
        const body = await res.json();
        assert.strictEqual(body.success, false);
      });
    }

    test('23. Client cannot override status or owner through request body', async () => {
      const listing = await createTestListing({ status: 'pending', owner: ownerId });

      // Client sends malicious overrides in body to approve endpoint
      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/approve`, {
        token: admin1Token,
        body: {
          status: 'rejected', // attempting to force rejected instead of approve
          owner: customerId, // attempting to reassign owner
          price: 1, // attempting to modify price
        },
      });

      assert.strictEqual(res.status, 200);
      const dbListing = await adminPb.collection('listings').getOne(listing.id);
      assert.strictEqual(dbListing.status, 'approved', 'Status must be set by server (approved), not client body');
      assert.strictEqual(dbListing.owner, ownerId, 'Owner ID must remain original owner');
      assert.strictEqual(dbListing.price, 60000, 'Price must not be modified by moderation endpoint');
    });

    test('24. Responses do not expose sensitive fields (passwords, tokens, phone numbers, internal IDs)', async () => {
      const listing = await createTestListing({ status: 'pending', owner: ownerId });

      const res = await apiPost(`/api/v1/admin/listings/${listing.id}/reject`, {
        token: admin1Token,
        body: {
          rejection_note: 'Sanitization check rejection reason.',
        },
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const rawText = JSON.stringify(body);

      // Verify no phone leakage
      assert.ok(!rawText.includes('1819-554433'), 'Owner phone number must not be exposed');
      assert.ok(!rawText.includes('owner_contacts'), 'owner_contacts collection must not be referenced');

      // Verify listing object sanitization
      const l = body.data.listing;
      assert.strictEqual(l.collectionId, undefined);
      assert.strictEqual(l.collectionName, undefined);

      // Verify owner object sanitization
      if (l.owner) {
        assert.strictEqual(l.owner.phone, undefined);
        assert.strictEqual(l.owner.password, undefined);
        assert.strictEqual(l.owner.passwordHash, undefined);
        assert.strictEqual(l.owner.tokenKey, undefined);
        assert.strictEqual(l.owner.collectionId, undefined);
      }
    });

    test('25. PocketBase failures return safe errors without leaking stack traces or internal queries', async () => {
      const listing = await createTestListing();
      const pb = await getAdminClient();
      const originalCollection = pb.collection.bind(pb);

      // Mock pb.collection('listings').update to throw internal error
      pb.collection = (name) => {
        if (name === 'listings') {
          return {
            ...originalCollection(name),
            getOne: async (...args) => originalCollection(name).getOne(...args),
            update: async () => {
              const err = new Error('SQLite write lock timeout: SECRET_DB_CONNECTION_STRING_007');
              err.status = 500;
              throw err;
            },
          };
        }
        return originalCollection(name);
      };

      try {
        const res = await apiPost(`/api/v1/admin/listings/${listing.id}/approve`, {
          token: admin1Token,
        });

        assert.strictEqual(res.status, 500, 'Must return HTTP 500 on database failure');
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.strictEqual('stack' in body.error, false, 'Error response must never contain stack trace');
        assert.ok(
          !JSON.stringify(body).includes('SECRET_DB_CONNECTION_STRING_007'),
          'Internal secrets must never be exposed'
        );
      } finally {
        pb.collection = originalCollection;
      }
    });
  });
});
