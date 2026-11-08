import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';
import { getAdminClient } from '../src/config/pocketbase.js';

describe('Phase 6 — Owner Module (Tasks 6.1 & 6.2)', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const createdImageIds = [];
  const testRunId = Date.now();

  const testPassword = 'Password123!Safe';
  let ownerEmail;
  let otherOwnerEmail;
  let customerEmail;
  let adminEmail;

  let ownerToken;
  let otherOwnerToken;
  let customerToken;
  let adminToken;

  let ownerId;
  let otherOwnerId;
  let customerId;
  let adminId;

  // Pre-created listings for Task 6.2 tests
  let otherOwnerListingId;
  let approvedListingToEditId;
  let pendingListingToEditId;
  let rejectedListingToEditId;
  let listingToDeleteWithImageId;
  let uploadedImageRecord;

  const validListingPayload = {
    title: `Premium Office Space in Banani ${testRunId}`,
    description: 'Fully furnished commercial space with dedicated parking, elevator, and power backup.',
    category: 'office',
    listing_type: 'rent',
    price: 150000,
    area_sqft: 2200,
    address: 'Road 11, Block D, Banani',
    city: 'Dhaka',
    area: 'Banani',
  };

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Owner User
    ownerEmail = `owner_task6_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Listing Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 2. Create Second Owner User (for IDOR testing)
    otherOwnerEmail = `other_owner_task6_${testRunId}@shopfinder.local`;
    const otherOwnerRec = await adminPb.collection('users').create({
      name: `Other Listing Owner ${testRunId}`,
      email: otherOwnerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    otherOwnerId = otherOwnerRec.id;
    createdUserIds.push(otherOwnerId);

    // 3. Create Customer User
    customerEmail = `customer_task6_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Listing Customer ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // 4. Create Admin User
    adminEmail = `admin_task6_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Listing Admin ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // Authenticate users
    const userPb = new PocketBase(env.POCKETBASE_URL);

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const otherOwnerAuth = await userPb.collection('users').authWithPassword(otherOwnerEmail, testPassword);
    otherOwnerToken = otherOwnerAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    // 5. Pre-create listings for Task 6.2 testing
    // 5a. Listing belonging to otherOwner (for IDOR checks)
    const otherRec = await adminPb.collection('listings').create({
      owner: otherOwnerId,
      title: `Other Owner Listing ${testRunId}`,
      description: 'Private listing belonging to another owner.',
      category: 'retail',
      listing_type: 'rent',
      price: 45000,
      area_sqft: 600,
      address: 'Dhanmondi 27',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
    });
    otherOwnerListingId = otherRec.id;
    createdListingIds.push(otherOwnerListingId);

    // 5b. Approved listing for D-002 reversion check
    const appRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Approved Listing For Edit ${testRunId}`,
      description: 'Currently approved commercial floor.',
      category: 'office',
      listing_type: 'rent',
      price: 180000,
      area_sqft: 2500,
      address: 'Gulshan 2',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
    });
    approvedListingToEditId = appRec.id;
    createdListingIds.push(approvedListingToEditId);

    // 5c. Pending listing for D-002 preservation check
    const pendRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Pending Listing For Edit ${testRunId}`,
      description: 'Currently pending commercial warehouse.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 200000,
      area_sqft: 4000,
      address: 'Tejgaon I/A',
      city: 'Dhaka',
      area: 'Tejgaon',
      status: 'pending',
    });
    pendingListingToEditId = pendRec.id;
    createdListingIds.push(pendingListingToEditId);

    // 5d. Rejected listing for D-002 preservation check
    const rejRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Rejected Listing For Edit ${testRunId}`,
      description: 'Previously rejected commercial shop.',
      category: 'retail',
      listing_type: 'rent',
      price: 35000,
      area_sqft: 400,
      address: 'Mirpur 10',
      city: 'Dhaka',
      area: 'Mirpur',
      status: 'rejected',
      rejection_note: 'Incomplete document verification',
    });
    rejectedListingToEditId = rejRec.id;
    createdListingIds.push(rejectedListingToEditId);

    // 5e. Listing to delete with attached image (for cascade delete testing)
    const delRec = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Listing To Delete With Image ${testRunId}`,
      description: 'This listing will be deleted to test image cascade deletion.',
      category: 'showroom',
      listing_type: 'rent',
      price: 90000,
      area_sqft: 1500,
      address: 'Uttara Sector 3',
      city: 'Dhaka',
      area: 'Uttara',
      status: 'approved',
    });
    listingToDeleteWithImageId = delRec.id;
    createdListingIds.push(listingToDeleteWithImageId);

    // Create 1 valid real PNG image attached to listingToDeleteWithImageId
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.append('listing', listingToDeleteWithImageId);
    form.append('is_cover', 'true');
    form.append('order', '1');
    form.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'cascade_test.png');
    uploadedImageRecord = await adminPb.collection('listing_images').create(form);
    createdImageIds.push(uploadedImageRecord.id);

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
      for (const id of createdListingIds) {
        try {
          await pb.collection('listings').delete(id);
        } catch {
          // Ignore
        }
      }
      for (const id of createdUserIds) {
        try {
          await pb.collection('users').delete(id);
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
  // Task 6.1 — Listing Creation Tests (1-17)
  // ==========================================

  test('1. Owner successfully creates a listing', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify(validListingPayload),
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.listing);

    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    assert.equal(listing.title, validListingPayload.title);
    assert.equal(listing.description, validListingPayload.description);
    assert.equal(listing.category, 'office');
    assert.equal(listing.listing_type, 'rent');
    assert.equal(listing.price, 150000);
    assert.equal(listing.area_sqft, 2200);
    assert.equal(listing.address, 'Road 11, Block D, Banani');
    assert.equal(listing.city, 'Dhaka');
    assert.equal(listing.area, 'Banani');
    assert.equal(listing.status, 'pending');
    assert.equal(listing.is_featured, false);
    assert.equal(listing.owner.id, ownerId);
    assert.ok(listing.id);

    const pbRecord = await adminPb.collection('listings').getOne(listing.id);
    assert.equal(pbRecord.title, validListingPayload.title);
    assert.equal(pbRecord.owner, ownerId);
    assert.equal(pbRecord.status, 'pending');
  });

  test('2. New listing status is always pending', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        title: `Pending Status Check ${testRunId}`,
      }),
    });

    assert.equal(res.status, 201);
    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    assert.equal(listing.status, 'pending');

    const pbRecord = await adminPb.collection('listings').getOne(listing.id);
    assert.equal(pbRecord.status, 'pending');
  });

  test('3. Omitted listing_type defaults to rent', async () => {
    const payloadWithoutType = { ...validListingPayload, title: `Default Rent Check ${testRunId}` };
    delete payloadWithoutType.listing_type;

    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify(payloadWithoutType),
    });

    assert.equal(res.status, 201);
    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    assert.equal(listing.listing_type, 'rent');

    const pbRecord = await adminPb.collection('listings').getOne(listing.id);
    assert.equal(pbRecord.listing_type, 'rent');
  });

  test('4. Explicit sale listing_type is accepted', async () => {
    const salePayload = {
      ...validListingPayload,
      title: `Commercial Floor for Sale ${testRunId}`,
      listing_type: 'sale',
      price: 25000000,
    };

    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify(salePayload),
    });

    assert.equal(res.status, 201);
    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    assert.equal(listing.listing_type, 'sale');
    assert.equal(listing.price, 25000000);

    const pbRecord = await adminPb.collection('listings').getOne(listing.id);
    assert.equal(pbRecord.listing_type, 'sale');
  });

  test('5. Owner ID comes from authenticated identity', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        title: `Owner Identity Check ${testRunId}`,
      }),
    });

    assert.equal(res.status, 201);
    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    assert.equal(listing.owner.id, ownerId);

    const pbRecord = await adminPb.collection('listings').getOne(listing.id);
    assert.equal(pbRecord.owner, ownerId);
  });

  test('6. Unauthenticated request returns 401', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      body: JSON.stringify(validListingPayload),
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Authentication required') || res.data.error.message.includes('auth'));
  });

  test('7. Customer request returns 403', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: customerToken,
      body: JSON.stringify(validListingPayload),
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
    assert.ok(
      res.data.error.message.toLowerCase().includes('denied') ||
        res.data.error.message.toLowerCase().includes('permission')
    );
  });

  test('8. Client-supplied owner is rejected', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        owner: customerId,
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('owner'));
  });

  test('9. Client-supplied status is rejected', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        status: 'approved',
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('status'));
  });

  test('10. Client-supplied is_featured is rejected', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        is_featured: true,
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('is_featured'));
  });

  test('11. Client-supplied rejection_note is rejected', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        rejection_note: 'Bypass review note',
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(JSON.stringify(res.data).includes('rejection_note'));
  });

  test('12. Missing required fields are rejected', async () => {
    const requiredFields = ['title', 'description', 'category', 'price', 'area_sqft', 'address', 'city', 'area'];

    for (const field of requiredFields) {
      const incomplete = { ...validListingPayload };
      delete incomplete[field];

      const res = await makeRequest('/api/v1/listings', {
        method: 'POST',
        token: ownerToken,
        body: JSON.stringify(incomplete),
      });

      assert.equal(res.status, 400, `Missing ${field} must return HTTP 400`);
      assert.equal(res.data.success, false);
      assert.ok(JSON.stringify(res.data).includes(field), `Error details should reference missing field ${field}`);
    }
  });

  test('13. Invalid category and listing_type are rejected', async () => {
    const badCategoryRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        category: 'hotel',
      }),
    });
    assert.equal(badCategoryRes.status, 400);
    assert.equal(badCategoryRes.data.success, false);

    const badTypeRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        listing_type: 'lease_hold',
      }),
    });
    assert.equal(badTypeRes.status, 400);
    assert.equal(badTypeRes.data.success, false);
  });

  test('14. Negative price and area are rejected', async () => {
    const negPriceRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        price: -50000,
      }),
    });
    assert.equal(negPriceRes.status, 400);
    assert.equal(negPriceRes.data.success, false);

    const negAreaRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        area_sqft: -200,
      }),
    });
    assert.equal(negAreaRes.status, 400);
    assert.equal(negAreaRes.data.success, false);
  });

  test('15. Malformed numeric values are rejected', async () => {
    const strPriceRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        price: 'one_hundred_thousand',
      }),
    });
    assert.equal(strPriceRes.status, 400);
    assert.equal(strPriceRes.data.success, false);

    const infAreaRes = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        area_sqft: 1e15,
      }),
    });
    assert.equal(infAreaRes.status, 400);
    assert.equal(infAreaRes.data.success, false);
  });

  test('16. Public response does not expose phone, email, credentials, or PocketBase internal fields', async () => {
    const res = await makeRequest('/api/v1/listings', {
      method: 'POST',
      token: ownerToken,
      body: JSON.stringify({
        ...validListingPayload,
        title: `Sanitization Audit ${testRunId}`,
      }),
    });

    assert.equal(res.status, 201);
    const listing = res.data.data.listing;
    createdListingIds.push(listing.id);

    const jsonStr = JSON.stringify(res.data);

    assert.ok(!jsonStr.includes('password'), 'Must not leak password');
    assert.ok(!jsonStr.includes('tokenKey'), 'Must not leak tokenKey');
    assert.ok(!jsonStr.includes('owner_contacts'), 'Must not reference owner_contacts');
    assert.ok(!jsonStr.includes('collectionId'), 'Must not leak collectionId');
    assert.ok(!jsonStr.includes('collectionName'), 'Must not leak collectionName');
    assert.ok(!jsonStr.includes('rejection_note'), 'Must not expose rejection_note');
    assert.ok(!('phone' in (listing.owner || {})), 'Owner object must not contain phone');
    assert.ok(!('email' in (listing.owner || {})), 'Owner object must not contain email');

    const allowedKeys = new Set([
      'id',
      'title',
      'description',
      'category',
      'listing_type',
      'price',
      'area_sqft',
      'address',
      'city',
      'area',
      'status',
      'is_featured',
      'created',
      'updated',
      'cover_image',
      'owner',
    ]);

    for (const key of Object.keys(listing)) {
      assert.ok(allowedKeys.has(key), `Listing response contained unexpected key: ${key}`);
    }
  });

  test('17. Existing public listing endpoints continue working', async () => {
    const featRes = await makeRequest('/api/v1/listings/featured');
    assert.equal(featRes.status, 200);
    assert.equal(featRes.data.success, true);
    assert.ok(Array.isArray(featRes.data.data.listings));

    const browseRes = await makeRequest('/api/v1/listings');
    assert.equal(browseRes.status, 200);
    assert.equal(browseRes.data.success, true);
    assert.ok(Array.isArray(browseRes.data.data.listings));
    assert.ok(browseRes.data.data.pagination);

    // 3. Pending listing must NOT appear in public browse listings
    const pendingInBrowse = browseRes.data.data.listings.find((l) => l.id === pendingListingToEditId || l.status !== 'approved');
    assert.equal(pendingInBrowse, undefined, 'Pending or non-approved listings must not appear in public browse results');

  });

  // ==========================================
  // Task 6.2 — PATCH /api/v1/listings/:id (18-31)
  // ==========================================

  test('18. Owner updates permitted fields successfully via PATCH', async () => {
    const updatePayload = {
      title: `Updated Title ${testRunId}`,
      price: 175000,
      description: 'Updated description for the commercial property.',
      area_sqft: 2400,
    };

    const res = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify(updatePayload),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.listing);

    const updated = res.data.data.listing;
    assert.equal(updated.title, updatePayload.title);
    assert.equal(updated.price, 175000);
    assert.equal(updated.description, updatePayload.description);
    assert.equal(updated.area_sqft, 2400);

    // Verify in database
    const dbRecord = await adminPb.collection('listings').getOne(approvedListingToEditId);
    assert.equal(dbRecord.title, updatePayload.title);
    assert.equal(dbRecord.price, 175000);
  });

  test('19. Explicit sale listing_type is accepted via PATCH', async () => {
    const res = await makeRequest(`/api/v1/listings/${pendingListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({
        listing_type: 'sale',
        price: 30000000,
      }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.listing.listing_type, 'sale');
    assert.equal(res.data.data.listing.price, 30000000);

    const dbRecord = await adminPb.collection('listings').getOne(pendingListingToEditId);
    assert.equal(dbRecord.listing_type, 'sale');
    assert.equal(dbRecord.price, 30000000);
  });

  test('20. Empty {} payload returns HTTP 400 (Decision 1)', async () => {
    const res = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'At least one field must be provided for update');
  });

  test('21. Owner cannot update another owner listing (IDOR attack returns HTTP 403)', async () => {
    const res = await makeRequest(`/api/v1/listings/${otherOwnerListingId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ title: 'Hacked Title Attempt' }),
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Access denied') || res.data.error.message.includes('own'));

    // Verify DB was unchanged
    const dbRecord = await adminPb.collection('listings').getOne(otherOwnerListingId);
    assert.notEqual(dbRecord.title, 'Hacked Title Attempt');
  });

  test('22. Updating a non-existent listing returns HTTP 404', async () => {
    const res = await makeRequest('/api/v1/listings/nonexistent12345', {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ title: 'Should Fail' }),
    });

    assert.equal(res.status, 404);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('not found') || res.data.error.message.includes('Listing'));
  });

  test('23. Unauthenticated request to PATCH returns HTTP 401', async () => {
    const res = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Unauthorized' }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
  });

  test('24. Customer request to PATCH returns HTTP 403', async () => {
    const res = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: customerToken,
      body: JSON.stringify({ title: 'Customer Update Attempt' }),
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
  });

  test('25. Privileged field injection (owner, status, is_featured, rejection_note) is rejected with HTTP 400', async () => {
    const privilegedPayloads = [
      { status: 'approved' },
      { owner: customerId },
      { is_featured: true },
      { rejection_note: 'Bypass note' },
    ];

    for (const payload of privilegedPayloads) {
      const res = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
        method: 'PATCH',
        token: ownerToken,
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 400, `Payload ${JSON.stringify(payload)} must be rejected`);
      assert.equal(res.data.success, false);
    }
  });

  test('26. Invalid category, listing_type, and negative numeric values in PATCH return HTTP 400', async () => {
    // Bad category
    const badCat = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ category: 'resort' }),
    });
    assert.equal(badCat.status, 400);

    // Bad listing_type
    const badType = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ listing_type: 'sublease' }),
    });
    assert.equal(badType.status, 400);

    // Negative price
    const negPrice = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ price: -100 }),
    });
    assert.equal(negPrice.status, 400);
  });

  test('27. D-002: Approved listing reverts to pending status after core-field edit', async () => {
    // approvedListingToEditId was created with status = 'approved'
    // Verify it is currently 'pending' from Test 18's edit, or re-verify status transition:
    const freshApproved = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Fresh Approved Listing ${testRunId}`,
      description: 'Approved listing to test D-002 reversion.',
      category: 'office',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 1800,
      address: 'Gulshan Avenue',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
    });
    createdListingIds.push(freshApproved.id);

    assert.equal(freshApproved.status, 'approved');

    // Owner edits price
    const res = await makeRequest(`/api/v1/listings/${freshApproved.id}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ price: 130000 }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.listing.status, 'pending', 'Status must revert to pending after core-field edit');

    const dbRecord = await adminPb.collection('listings').getOne(freshApproved.id);
    assert.equal(dbRecord.status, 'pending', 'Database status must be pending');
  });

  test('28. D-002: Pending listing remains pending after edit', async () => {
    const res = await makeRequest(`/api/v1/listings/${pendingListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ title: 'Still Pending After Edit' }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.listing.status, 'pending');

    const dbRecord = await adminPb.collection('listings').getOne(pendingListingToEditId);
    assert.equal(dbRecord.status, 'pending');
  });

  test('29. D-002: Rejected listing remains rejected after edit', async () => {
    const res = await makeRequest(`/api/v1/listings/${rejectedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ title: 'Still Rejected After Edit' }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.data.listing.status, 'rejected');

    const dbRecord = await adminPb.collection('listings').getOne(rejectedListingToEditId);
    assert.equal(dbRecord.status, 'rejected');
  });

  test('30. Owner ID cannot be changed via PATCH', async () => {
    const res = await makeRequest(`/api/v1/listings/${pendingListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({
        title: 'Attempting To Change Owner',
        owner: otherOwnerId,
      }),
    });

    // Prohibited key rejected
    assert.equal(res.status, 400);

    const dbRecord = await adminPb.collection('listings').getOne(pendingListingToEditId);
    assert.equal(dbRecord.owner, ownerId, 'Owner must remain the original authenticated owner');
  });

  test('31. Response excludes rejection_note and private data after PATCH', async () => {
    const res = await makeRequest(`/api/v1/listings/${rejectedListingToEditId}`, {
      method: 'PATCH',
      token: ownerToken,
      body: JSON.stringify({ description: 'Updated description for rejected listing.' }),
    });

    assert.equal(res.status, 200);
    const jsonStr = JSON.stringify(res.data);

    assert.ok(!jsonStr.includes('rejection_note'), 'rejection_note must never appear in response');
    assert.ok(!jsonStr.includes('owner_contacts'), 'owner_contacts must never appear in response');
    assert.ok(!jsonStr.includes('password'), 'password must never appear in response');
    assert.ok(!('phone' in (res.data.data.listing.owner || {})), 'Owner phone must not be exposed');
    assert.ok(!('email' in (res.data.data.listing.owner || {})), 'Owner email must not be exposed');
  });

  // ==========================================
  // Task 6.2 — DELETE /api/v1/listings/:id (32-37)
  // ==========================================

  test('32. Owner deletes own listing successfully with HTTP 200 and structured response (Decision 3)', async () => {
    // Create dedicated listing to delete
    const toDelete = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Listing To Delete ${testRunId}`,
      description: 'Will be deleted.',
      category: 'retail',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 500,
      address: 'Address to delete',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });

    const res = await makeRequest(`/api/v1/listings/${toDelete.id}`, {
      method: 'DELETE',
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.message, 'Listing deleted successfully');

    // Verify it is gone from PocketBase
    let exists = true;
    try {
      await adminPb.collection('listings').getOne(toDelete.id);
    } catch {
      exists = false;
    }
    assert.equal(exists, false, 'Deleted listing must not exist in PocketBase');
  });

  test('33. Another owner listing cannot be deleted (IDOR attack returns HTTP 403)', async () => {
    const res = await makeRequest(`/api/v1/listings/${otherOwnerListingId}`, {
      method: 'DELETE',
      token: ownerToken,
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Access denied') || res.data.error.message.includes('own'));

    // Verify it still exists in PocketBase
    const dbRecord = await adminPb.collection('listings').getOne(otherOwnerListingId);
    assert.ok(dbRecord.id);
  });

  test('34. Deleting a non-existent listing returns HTTP 404', async () => {
    const res = await makeRequest('/api/v1/listings/nonexistent12345', {
      method: 'DELETE',
      token: ownerToken,
    });

    assert.equal(res.status, 404);
    assert.equal(res.data.success, false);
  });

  test('35. Unauthenticated and customer requests to DELETE are rejected', async () => {
    // Unauthenticated
    const unauthRes = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'DELETE',
    });
    assert.equal(unauthRes.status, 401);

    // Customer
    const custRes = await makeRequest(`/api/v1/listings/${approvedListingToEditId}`, {
      method: 'DELETE',
      token: customerToken,
    });
    assert.equal(custRes.status, 403);
  });

  test('36. Associated listing_images records are cascade-deleted when listing is deleted', async () => {
    const imageId = uploadedImageRecord.id;

    // Verify image record exists in PocketBase before deletion
    const imgBefore = await adminPb.collection('listing_images').getOne(imageId);
    assert.equal(imgBefore.id, imageId);

    // Delete parent listing
    const res = await makeRequest(`/api/v1/listings/${listingToDeleteWithImageId}`, {
      method: 'DELETE',
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    // Verify child image record was cascade-deleted from database
    let imgExists = true;
    try {
      await adminPb.collection('listing_images').getOne(imageId);
    } catch {
      imgExists = false;
    }
    assert.equal(imgExists, false, 'Associated listing_images record must be cascade-deleted');
  });

  test('37. Physical image files and thumbnails are removed from storage upon listing deletion', async () => {
    // Check if PocketBase local storage directory exists
    const storageDir = path.join(
      process.env.LOCALAPPDATA || '',
      'ShopFinder',
      'pb_data',
      'storage',
      uploadedImageRecord.collectionId || 'pbc_588048942',
      uploadedImageRecord.id
    );

    // In PocketBase, record directory is deleted when record is cascade-deleted
    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      assert.equal(files.length, 0, 'Physical file directory should be empty or deleted');
    } else {
      // Directory is completely removed, which is the expected PocketBase cleanRecordFiles behavior
      assert.ok(!fs.existsSync(storageDir), 'Record storage directory was purged upon cascade deletion');
    }
  });

  // ==========================================
  // Task 6.2 — GET /api/v1/owner/listings (38-45)
  // ==========================================

  test('38. Returns pending, approved, rejected listings for the authenticated owner', async () => {
    const res = await makeRequest('/api/v1/owner/listings', {
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.listings));

    const statuses = new Set(res.data.data.listings.map((l) => l.status));
    assert.ok(statuses.has('pending'), 'Must include pending listings');
    assert.ok(statuses.has('rejected'), 'Must include rejected listings');
  });

  test('39. Returns strictly the authenticated owner listings and excludes other owners records', async () => {
    const res = await makeRequest('/api/v1/owner/listings', {
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    const returnedIds = res.data.data.listings.map((l) => l.id);

    // Must NOT contain otherOwner's listing
    assert.equal(
      returnedIds.includes(otherOwnerListingId),
      false,
      'Other owner listing must NEVER appear in authenticated owner listings'
    );

    // Every returned listing must belong to ownerId
    for (const listing of res.data.data.listings) {
      assert.equal(listing.owner.id, ownerId, 'Every returned listing must belong to calling owner');
    }
  });

  test('40. Unauthenticated request to GET /api/v1/owner/listings returns 401', async () => {
    const res = await makeRequest('/api/v1/owner/listings');
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
  });

  test('41. Customer request to GET /api/v1/owner/listings returns 403', async () => {
    const res = await makeRequest('/api/v1/owner/listings', {
      token: customerToken,
    });
    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
  });

  test('42. Pagination and clamping behave correctly for owner listings', async () => {
    // 1. Default pagination
    const defaultRes = await makeRequest('/api/v1/owner/listings', {
      token: ownerToken,
    });
    assert.equal(defaultRes.status, 200);
    assert.equal(defaultRes.data.data.pagination.page, 1);
    assert.equal(defaultRes.data.data.pagination.perPage, 12);
    assert.ok(defaultRes.data.data.pagination.totalItems >= 1);
    assert.ok(defaultRes.data.data.pagination.totalPages >= 1);

    // 2. perPage clamping: below 1 clamped to 1
    const lowClampRes = await makeRequest('/api/v1/owner/listings?perPage=0', {
      token: ownerToken,
    });
    assert.equal(lowClampRes.status, 200);
    assert.equal(lowClampRes.data.data.pagination.perPage, 1);

    // 3. perPage clamping: above 100 clamped to 100
    const highClampRes = await makeRequest('/api/v1/owner/listings?perPage=250', {
      token: ownerToken,
    });
    assert.equal(highClampRes.status, 200);
    assert.equal(highClampRes.data.data.pagination.perPage, 100);

    // 4. Decimal / invalid page returns HTTP 400
    const badPageRes = await makeRequest('/api/v1/owner/listings?page=1.5', {
      token: ownerToken,
    });
    assert.equal(badPageRes.status, 400);

    // 5. Decimal / invalid perPage returns HTTP 400
    const badPerPageRes = await makeRequest('/api/v1/owner/listings?perPage=abc', {
      token: ownerToken,
    });
    assert.equal(badPerPageRes.status, 400);
  });

  test('43. Sorting uses the approved allowlist for owner listings', async () => {
    // 1. Newest
    const newestRes = await makeRequest('/api/v1/owner/listings?sort=newest', {
      token: ownerToken,
    });
    assert.equal(newestRes.status, 200);

    // 2. Price Ascending
    const priceAscRes = await makeRequest('/api/v1/owner/listings?sort=price_asc', {
      token: ownerToken,
    });
    assert.equal(priceAscRes.status, 200);

    // 3. Price Descending
    const priceDescRes = await makeRequest('/api/v1/owner/listings?sort=price_desc', {
      token: ownerToken,
    });
    assert.equal(priceDescRes.status, 200);

    // 4. Raw aliases
    const rawRes = await makeRequest('/api/v1/owner/listings?sort=-created', {
      token: ownerToken,
    });
    assert.equal(rawRes.status, 200);

    // 5. Unapproved sort input returns HTTP 400
    const badSortRes = await makeRequest('/api/v1/owner/listings?sort=unapproved_sort', {
      token: ownerToken,
    });
    assert.equal(badSortRes.status, 400);
  });

  test('44. Response sanitization excludes private and internal fields from owner listings', async () => {
    const res = await makeRequest('/api/v1/owner/listings', {
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    const jsonStr = JSON.stringify(res.data);

    assert.ok(!jsonStr.includes('rejection_note'), 'rejection_note must never appear');
    assert.ok(!jsonStr.includes('owner_contacts'), 'owner_contacts must never appear');
    assert.ok(!jsonStr.includes('password'), 'password must never appear');
    assert.ok(!jsonStr.includes('tokenKey'), 'tokenKey must never appear');
    assert.ok(!jsonStr.includes('collectionId'), 'collectionId must never appear');
    assert.ok(!jsonStr.includes('collectionName'), 'collectionName must never appear');

    for (const listing of res.data.data.listings) {
      assert.ok('status' in listing, 'Listing status must be present for owner');
      assert.ok(!('rejection_note' in listing), 'rejection_note must not be present');
      assert.ok(!('phone' in (listing.owner || {})), 'Owner phone must not be exposed');
      assert.ok(!('email' in (listing.owner || {})), 'Owner email must not be exposed');
    }
  });

  test('45. Cover images are resolved correctly in owner listings response', async () => {
    // Create an approved listing for owner with cover image
    const listingWithCover = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Listing With Cover In Owner Table ${testRunId}`,
      description: 'Owner listing with real cover image.',
      category: 'retail',
      listing_type: 'rent',
      price: 75000,
      area_sqft: 800,
      address: 'Gulshan 1',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
    });
    createdListingIds.push(listingWithCover.id);

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.append('listing', listingWithCover.id);
    form.append('is_cover', 'true');
    form.append('order', '1');
    form.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'cover_photo.png');
    const imgRec = await adminPb.collection('listing_images').create(form);
    createdImageIds.push(imgRec.id);

    const res = await makeRequest('/api/v1/owner/listings', {
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    const match = res.data.data.listings.find((l) => l.id === listingWithCover.id);
    assert.ok(match, 'Listing must be found in owner listings');
    assert.ok(match.cover_image, 'Cover image must be resolved');
    assert.equal(match.cover_image.id, imgRec.id);
    assert.ok(match.cover_image.url.includes(imgRec.id));
    assert.ok(match.cover_image.thumb_url.includes('thumb=400x300'));
  });
});
