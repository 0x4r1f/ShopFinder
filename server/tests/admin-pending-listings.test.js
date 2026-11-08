import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';
import * as adminService from '../src/services/admin.service.js';

describe('Phase 7, Task 7.2 — Admin Listing Review Queue API (GET /api/v1/admin/listings/pending)', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let adminEmail;
  let ownerEmail;
  let customerEmail;

  let adminId;
  let ownerId;
  let customerId;

  let adminToken;
  let ownerToken;
  let customerToken;

  let pendingListing1Id;
  let pendingListing2Id;
  let approvedListingId;
  let rejectedListingId;
  let archivedListingId;
  let imageListingId;
  let testImageRecordId;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdImageIds = [];
  const createdContactIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Admin User
    adminEmail = `adm_queue_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin Reviewer ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 2. Create Owner User
    ownerEmail = `own_queue_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Owner Seller ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 3. Create Customer User
    customerEmail = `cust_queue_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer Buyer ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 4. Create Owner Contact (phone number) in owner_contacts to test D-014 privacy
    try {
      const contactRec = await adminPb.collection('owner_contacts').create({
        owner: ownerId,
        phone: '+880 1711-998877',
      });
      createdContactIds.push(contactRec.id);
    } catch {}

    // 5. Authenticate users to acquire JWT tokens for pb_auth cookie
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    // 6. Create Listings across different statuses
    // Pending Listing 1 (older)
    const p1 = await adminPb.collection('listings').create({
      title: `Pending Listing 1 ${testRunId}`,
      description: 'First pending commercial property awaiting approval.',
      category: 'retail',
      listing_type: 'rent',
      price: 55000,
      area_sqft: 900,
      address: 'Plot 12, Gulshan Avenue',
      city: 'Dhaka',
      area: 'Gulshan',
      owner: ownerId,
      status: 'pending',
    });
    pendingListing1Id = p1.id;
    createdListingIds.push(p1.id);

    // Add a tiny delay to ensure distinct created timestamps for sorting verification
    await new Promise((r) => setTimeout(r, 100));

    // Pending Listing 2 (newer)
    const p2 = await adminPb.collection('listings').create({
      title: `Pending Listing 2 ${testRunId}`,
      description: 'Second pending commercial office space awaiting approval.',
      category: 'office',
      listing_type: 'sale',
      price: 18000000,
      area_sqft: 2500,
      address: 'Road 7, Block C',
      city: 'Dhaka',
      area: 'Banani',
      owner: ownerId,
      status: 'pending',
    });
    pendingListing2Id = p2.id;
    createdListingIds.push(p2.id);

    // Approved Listing (MUST BE EXCLUDED)
    const appListing = await adminPb.collection('listings').create({
      title: `Approved Listing ${testRunId}`,
      description: 'Already approved commercial space.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 200000,
      area_sqft: 8000,
      address: 'Tejgaon I/A',
      city: 'Dhaka',
      area: 'Tejgaon',
      owner: ownerId,
      status: 'approved',
    });
    approvedListingId = appListing.id;
    createdListingIds.push(appListing.id);

    // Rejected Listing (MUST BE EXCLUDED)
    const rejListing = await adminPb.collection('listings').create({
      title: `Rejected Listing ${testRunId}`,
      description: 'Rejected property submission.',
      category: 'retail',
      listing_type: 'rent',
      price: 35000,
      area_sqft: 600,
      address: 'Mirpur 10',
      city: 'Dhaka',
      area: 'Mirpur',
      owner: ownerId,
      status: 'rejected',
      rejection_note: 'Incomplete documentation provided.',
    });
    rejectedListingId = rejListing.id;
    createdListingIds.push(rejListing.id);

    // Archived Listing (MUST BE EXCLUDED)
    const arcListing = await adminPb.collection('listings').create({
      title: `Archived Listing ${testRunId}`,
      description: 'Archived property submission.',
      category: 'showroom',
      listing_type: 'rent',
      price: 90000,
      area_sqft: 1500,
      address: 'Uttara Sector 3',
      city: 'Dhaka',
      area: 'Uttara',
      owner: ownerId,
      status: 'archived',
    });
    archivedListingId = arcListing.id;
    createdListingIds.push(arcListing.id);

    // Pending Listing with Cover Image
    const pImg = await adminPb.collection('listings').create({
      title: `Pending Listing With Photo ${testRunId}`,
      description: 'Pending commercial property with verified cover photo.',
      category: 'office',
      listing_type: 'rent',
      price: 75000,
      area_sqft: 1200,
      address: 'Dhanmondi 27',
      city: 'Dhaka',
      area: 'Dhanmondi',
      owner: ownerId,
      status: 'pending',
    });
    imageListingId = pImg.id;
    createdListingIds.push(pImg.id);

    // Create an image in listing_images for imageListingId
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const formData = new FormData();
    formData.append('listing', imageListingId);
    formData.append('is_cover', 'true');
    formData.append('order', '0');
    formData.append('image', new Blob([tinyPng], { type: 'image/png' }), 'cover_photo.png');

    const imgRec = await adminPb.collection('listing_images').create(formData);
    testImageRecordId = imgRec.id;
    createdImageIds.push(imgRec.id);

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
      for (const id of createdImageIds) {
        try {
          await pb.collection('listing_images').delete(id);
        } catch {}
      }
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

  // =========================================================================
  // 1. Anonymous request returns HTTP 401
  // =========================================================================
  test('1. Anonymous request to GET /api/v1/admin/listings/pending returns HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`);
    assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error?.message, 'Error response must contain message');
  });

  // =========================================================================
  // 2. Customer request returns HTTP 403
  // =========================================================================
  test('2. Customer request to GET /api/v1/admin/listings/pending returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`, {
      headers: {
        Cookie: `pb_auth=${customerToken}`,
      },
    });
    assert.strictEqual(res.status, 403, 'Customer request must return HTTP 403');

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error?.message, 'Error response must contain message');
  });

  // =========================================================================
  // 3. Owner request returns HTTP 403
  // =========================================================================
  test('3. Owner request to GET /api/v1/admin/listings/pending returns HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`, {
      headers: {
        Cookie: `pb_auth=${ownerToken}`,
      },
    });
    assert.strictEqual(res.status, 403, 'Owner request must return HTTP 403');

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error?.message, 'Error response must contain message');
  });

  // =========================================================================
  // 4. Admin request returns HTTP 200 with structured data
  // =========================================================================
  test('4. Admin request to GET /api/v1/admin/listings/pending returns HTTP 200 with structured data', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200, 'Admin request must return HTTP 200');

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data?.listings), 'data.listings must be an array');
    assert.ok(body.data?.pagination, 'data.pagination must be present');
    assert.strictEqual(typeof body.data.pagination.page, 'number');
    assert.strictEqual(typeof body.data.pagination.perPage, 'number');
    assert.strictEqual(typeof body.data.pagination.totalItems, 'number');
    assert.strictEqual(typeof body.data.pagination.totalPages, 'number');
  });

  // =========================================================================
  // 5. Only pending listings are returned
  // =========================================================================
  test('5. Only pending listings are returned', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const listings = body.data.listings;
    assert.ok(listings.length > 0, 'Must return at least one pending listing');

    for (const item of listings) {
      assert.strictEqual(item.status, 'pending', `Every item must have status "pending", found: ${item.status}`);
    }
  });

  // =========================================================================
  // 6. Approved, rejected, and archived listings are excluded
  // =========================================================================
  test('6. Approved, rejected, and archived listings are strictly excluded', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=100`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const listingIds = body.data.listings.map((l) => l.id);

    assert.ok(listingIds.includes(pendingListing1Id), 'Must include pendingListing1');
    assert.ok(listingIds.includes(pendingListing2Id), 'Must include pendingListing2');
    assert.ok(!listingIds.includes(approvedListingId), 'Approved listing must NOT be included in pending review queue');
    assert.ok(!listingIds.includes(rejectedListingId), 'Rejected listing must NOT be included in pending review queue');
    assert.ok(!listingIds.includes(archivedListingId), 'Archived listing must NOT be included in pending review queue');
  });

  // =========================================================================
  // 7. Pagination works correctly
  // =========================================================================
  test('7. Pagination works correctly with page and perPage', async () => {
    // Request page 1 with 1 item per page
    const res1 = await fetch(`${baseUrl}/api/v1/admin/listings/pending?page=1&perPage=1`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(body1.data.pagination.page, 1);
    assert.strictEqual(body1.data.pagination.perPage, 1);
    assert.strictEqual(body1.data.listings.length, 1);

    // Request page 2 with 1 item per page
    const res2 = await fetch(`${baseUrl}/api/v1/admin/listings/pending?page=2&perPage=1`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(body2.data.pagination.page, 2);
    assert.strictEqual(body2.data.pagination.perPage, 1);
    assert.strictEqual(body2.data.listings.length, 1);

    // Verify distinct items across pages
    assert.notStrictEqual(
      body1.data.listings[0].id,
      body2.data.listings[0].id,
      'Page 1 and Page 2 must not return the same item'
    );
  });

  // =========================================================================
  // 8. Default sorting is newest first
  // =========================================================================
  test('8. Default sorting is newest first (-created)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const testListings = body.data.listings.filter(
      (l) => l.id === pendingListing1Id || l.id === pendingListing2Id
    );
    assert.strictEqual(testListings.length, 2, 'Both test pending listings must be present');

    const idxP1 = body.data.listings.findIndex((l) => l.id === pendingListing1Id);
    const idxP2 = body.data.listings.findIndex((l) => l.id === pendingListing2Id);

    // pendingListing2 was created after pendingListing1, so in newest-first it appears first
    assert.ok(idxP2 < idxP1, `Newer listing (${pendingListing2Id}) must appear before older (${pendingListing1Id})`);
  });

  // =========================================================================
  // 9. Oldest-first sorting works
  // =========================================================================
  test('9. Oldest-first sorting works with ?sort=oldest and ?sort=created', async () => {
    for (const sortParam of ['oldest', 'created']) {
      const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?sort=${sortParam}&perPage=50`, {
        headers: {
          Cookie: `pb_auth=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, `Sort ${sortParam} must return HTTP 200`);

      const idxP1 = body.data.listings.findIndex((l) => l.id === pendingListing1Id);
      const idxP2 = body.data.listings.findIndex((l) => l.id === pendingListing2Id);

      assert.ok(idxP1 !== -1 && idxP2 !== -1, 'Both test listings must be returned');
      assert.ok(idxP1 < idxP2, `Older listing (${pendingListing1Id}) must appear before newer (${pendingListing2Id}) with sort=${sortParam}`);
    }
  });

  // =========================================================================
  // 10. Unsupported sorting is rejected
  // =========================================================================
  test('10. Unsupported sorting option is rejected with HTTP 400', async () => {
    const invalidSorts = ['price', '-price', 'title', 'drop_table', 'rand()'];
    for (const invalidSort of invalidSorts) {
      const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?sort=${invalidSort}`, {
        headers: {
          Cookie: `pb_auth=${adminToken}`,
        },
      });
      assert.strictEqual(res.status, 400, `Sort "${invalidSort}" must return HTTP 400`);

      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message?.includes('Invalid sort option'), 'Must return informative sort error message');
    }
  });

  // =========================================================================
  // 11. Invalid pagination values are rejected
  // =========================================================================
  test('11. Invalid pagination values are rejected with HTTP 400', async () => {
    const invalidQueries = [
      'page=0',
      'page=-1',
      'page=abc',
      'page=1.5',
      'perPage=0',
      'perPage=-10',
      'perPage=101',
      'perPage=invalid',
      'limit=0',
      'limit=150',
    ];

    for (const q of invalidQueries) {
      const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?${q}`, {
        headers: {
          Cookie: `pb_auth=${adminToken}`,
        },
      });
      assert.strictEqual(res.status, 400, `Query "?${q}" must return HTTP 400`);

      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.error?.message, `Query "?${q}" must return error message`);
    }
  });

  // =========================================================================
  // 12. Owner metadata is correctly returned
  // =========================================================================
  test('12. Owner metadata (id, name, email) is correctly returned for pending listings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const targetListing = body.data.listings.find((l) => l.id === pendingListing1Id);
    assert.ok(targetListing, 'Target pending listing must be in response');

    assert.ok(targetListing.owner, 'Listing must include owner object');
    assert.strictEqual(targetListing.owner.id, ownerId, 'Owner ID must match');
    assert.strictEqual(targetListing.owner.name, `Owner Seller ${testRunId}`, 'Owner name must match');
    assert.strictEqual(targetListing.owner.email, ownerEmail, 'Owner email must match');
  });

  // =========================================================================
  // 13. Cover image metadata is correctly returned
  // =========================================================================
  test('13. Cover image metadata is correctly returned for listings with images', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const imageListing = body.data.listings.find((l) => l.id === imageListingId);
    assert.ok(imageListing, 'Listing with image must be in response');

    assert.ok(imageListing.cover_image, 'Listing must have cover_image populated');
    assert.strictEqual(imageListing.cover_image.id, testImageRecordId);
    assert.strictEqual(imageListing.cover_image.is_cover, true);
    assert.ok(imageListing.cover_image.url?.includes('/api/files/'), 'URL must reference /api/files/');
    assert.ok(imageListing.cover_image.thumb_url?.includes('thumb=400x300'), 'thumb_url must include thumb param');
  });

  // =========================================================================
  // 14. Missing owner metadata is handled safely
  // =========================================================================
  test('14. Missing owner metadata is handled safely without throwing', () => {
    // Unit test sanitizer directly with mock raw records
    const pbMock = { baseUrl: 'http://127.0.0.1:8090' };

    // Case A: Owner relation is null
    const noOwnerItem = {
      id: 'lst_test_no_owner',
      title: 'Listing With No Owner',
      owner: null,
      status: 'pending',
    };
    const sanitizedA = adminService.sanitizeAdminPendingListing(noOwnerItem, pbMock);
    assert.ok(sanitizedA, 'Sanitizer must return sanitized object');
    assert.strictEqual(sanitizedA.owner, null, 'Owner must be null when relation is null');

    // Case B: Owner is a string ID without expand
    const idOnlyItem = {
      id: 'lst_test_id_only',
      title: 'Listing With Owner ID Only',
      owner: 'usr_orphan123',
      status: 'pending',
    };
    const sanitizedB = adminService.sanitizeAdminPendingListing(idOnlyItem, pbMock);
    assert.ok(sanitizedB.owner, 'Owner object must be constructed safely');
    assert.strictEqual(sanitizedB.owner.id, 'usr_orphan123');
    assert.strictEqual(sanitizedB.owner.name, '');
    assert.strictEqual(sanitizedB.owner.email, '');

    // Case C: Null or undefined item
    assert.strictEqual(adminService.sanitizeAdminPendingListing(null, pbMock), null);
  });

  // =========================================================================
  // 15. Missing cover image is handled safely
  // =========================================================================
  test('15. Missing cover image is handled safely (returns cover_image: null)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const noPhotoListing = body.data.listings.find((l) => l.id === pendingListing1Id);
    assert.ok(noPhotoListing, 'Pending listing 1 must be in response');
    assert.strictEqual(noPhotoListing.cover_image, null, 'Listing without photo must have cover_image: null');
  });

  // =========================================================================
  // 16. Owner phone and other sensitive fields are not exposed
  // =========================================================================
  test('16. Owner phone and other sensitive fields are NEVER exposed', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending?perPage=50`, {
      headers: {
        Cookie: `pb_auth=${adminToken}`,
      },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);

    const jsonString = JSON.stringify(body);

    // Verify phone number from owner_contacts is not exposed anywhere in payload
    assert.ok(!jsonString.includes('1711-998877'), 'Phone number must NOT be in response');

    for (const listing of body.data.listings) {
      // Rejection note must not be in pending queue records
      assert.strictEqual(listing.rejection_note, undefined, 'rejection_note must not be exposed');

      // Owner object must not leak phone, passwords, or token keys
      if (listing.owner) {
        assert.strictEqual(listing.owner.phone, undefined, 'owner.phone must not be present');
        assert.strictEqual(listing.owner.password, undefined, 'owner.password must not be present');
        assert.strictEqual(listing.owner.passwordHash, undefined, 'owner.passwordHash must not be present');
        assert.strictEqual(listing.owner.tokenKey, undefined, 'owner.tokenKey must not be present');
        assert.strictEqual(listing.owner.collectionId, undefined, 'owner.collectionId must not be present');
      }

      // Listing must not leak internal PocketBase fields
      assert.strictEqual(listing.collectionId, undefined, 'listing.collectionId must not be present');
      assert.strictEqual(listing.collectionName, undefined, 'listing.collectionName must not be present');
    }
  });

  // =========================================================================
  // 17. PocketBase failures return safe errors without stack traces
  // =========================================================================
  test('17. PocketBase failures return safe errors without leaking stack traces or credentials', async () => {
    const pb = await getAdminClient();
    const originalCollection = pb.collection.bind(pb);

    // Temporarily mock pb.collection('listings') to throw on getList
    pb.collection = (name) => {
      if (name === 'listings') {
        return {
          getList: async () => {
            const err = new Error('PocketBase SQLite deadlock or network failure: internal_secret_key_123');
            err.status = 503;
            throw err;
          },
        };
      }
      return originalCollection(name);
    };

    try {
      // 17a. Direct service failure test
      await assert.rejects(
        () => adminService.getPendingListings({ page: 1, perPage: 10 }),
        (err) => {
          assert.strictEqual(err.message, 'Failed to retrieve pending listings');
          assert.strictEqual(err.status, 503);
          assert.ok(!err.message.includes('internal_secret_key_123'));
          return true;
        }
      );

      // 17b. HTTP endpoint failure test through Express pipeline
      const res = await fetch(`${baseUrl}/api/v1/admin/listings/pending`, {
        headers: {
          Cookie: `pb_auth=${adminToken}`,
        },
      });

      assert.strictEqual(res.status, 503, 'Must return HTTP 503 on service failure');
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error?.message, 'Failed to retrieve pending listings');
      assert.strictEqual('stack' in body.error, false, 'Error response must never leak stack trace');
      assert.ok(!JSON.stringify(body).includes('internal_secret_key_123'), 'Error payload must never leak internal details');
    } finally {
      pb.collection = originalCollection;
    }
  });
});
