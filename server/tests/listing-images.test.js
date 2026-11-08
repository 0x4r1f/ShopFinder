import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';
import { getAdminClient } from '../src/config/pocketbase.js';

describe('Phase 6, Task 6.3 — Listing Image Upload & Management System', () => {
  let server;
  let baseUrl;
  let adminPb;
  const createdUserIds = [];
  const createdListingIds = [];
  const testRunId = Date.now();

  const testPassword = 'Password123!Safe';
  let ownerEmail;
  let otherOwnerEmail;
  let customerEmail;

  let ownerToken;
  let otherOwnerToken;
  let customerToken;

  let ownerId;
  let otherOwnerId;
  let customerId;

  // Pre-created test listings
  let approvedListingId;
  let pendingListingId;
  let rejectedListingId;
  let archivedListingId;
  let otherOwnerListingId;

  // Valid binary fixtures
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const jpgBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );
  const webpBuffer = Buffer.from(
    'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
    'base64'
  );

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Owner
    ownerEmail = `owner_images_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Image Test Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 2. Create Other Owner (IDOR checks)
    otherOwnerEmail = `other_images_${testRunId}@shopfinder.local`;
    const otherRec = await adminPb.collection('users').create({
      name: `Other Image Owner ${testRunId}`,
      email: otherOwnerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    otherOwnerId = otherRec.id;
    createdUserIds.push(otherOwnerId);

    // 3. Create Customer
    customerEmail = `customer_images_${testRunId}@shopfinder.local`;
    const custRec = await adminPb.collection('users').create({
      name: `Customer Images ${testRunId}`,
      email: customerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customerId = custRec.id;
    createdUserIds.push(customerId);

    // Log in users to get tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const otherAuth = await userPb.collection('users').authWithPassword(otherOwnerEmail, testPassword);
    otherOwnerToken = otherAuth.token;

    const custAuth = await userPb.collection('users').authWithPassword(customerEmail, testPassword);
    customerToken = custAuth.token;

    // 4. Create Listings with various statuses
    const appListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Approved Listing For Images ${testRunId}`,
      description: 'Commercial showroom space.',
      category: 'showroom',
      listing_type: 'rent',
      price: 110000,
      area_sqft: 1600,
      address: 'Gulshan 1',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
    });
    approvedListingId = appListing.id;
    createdListingIds.push(approvedListingId);

    const pendListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Pending Listing For Images ${testRunId}`,
      description: 'Pending commercial floor.',
      category: 'office',
      listing_type: 'rent',
      price: 95000,
      area_sqft: 1400,
      address: 'Banani 11',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });
    pendingListingId = pendListing.id;
    createdListingIds.push(pendingListingId);

    const rejListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Rejected Listing For Images ${testRunId}`,
      description: 'Rejected commercial warehouse.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 80000,
      area_sqft: 2000,
      address: 'Tejgaon',
      city: 'Dhaka',
      area: 'Tejgaon',
      status: 'rejected',
      rejection_note: 'Clarification needed',
    });
    rejectedListingId = rejListing.id;
    createdListingIds.push(rejectedListingId);

    const archListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Archived Listing For Images ${testRunId}`,
      description: 'Archived shop.',
      category: 'retail',
      listing_type: 'rent',
      price: 40000,
      area_sqft: 500,
      address: 'Mirpur',
      city: 'Dhaka',
      area: 'Mirpur',
      status: 'archived',
    });
    archivedListingId = archListing.id;
    createdListingIds.push(archivedListingId);

    const otherListing = await adminPb.collection('listings').create({
      owner: otherOwnerId,
      title: `Other Owner Listing ${testRunId}`,
      description: 'Belongs to other owner.',
      category: 'retail',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 600,
      address: 'Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
    });
    otherOwnerListingId = otherListing.id;
    createdListingIds.push(otherOwnerListingId);

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

  async function makeMultipartRequest(path, formData, token) {
    const headers = {
      Origin: env.CLIENT_URL,
    };
    if (token) {
      headers['Cookie'] = `${AUTH_COOKIE_NAME}=${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
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

  async function makeJsonRequest(path, options = {}) {
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

  // =========================================================================
  // 1. Upload Operations & Formats
  // =========================================================================

  test('1. Owner uploads one valid PNG image successfully (auto cover designated)', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'first_image.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.images));
    assert.equal(res.data.data.images.length, 1);

    const img = res.data.data.images[0];
    assert.ok(img.id);
    assert.equal(img.is_cover, true, 'First image on a listing must automatically be cover');
    assert.equal(img.order, 0);
    assert.ok(img.url.includes(img.id));
    assert.ok(img.thumb_url.includes('thumb=400x300'));

    // Verify in database
    const dbRec = await adminPb.collection('listing_images').getOne(img.id);
    assert.equal(dbRec.listing, pendingListingId);
    assert.equal(dbRec.is_cover, true);
  });

  test('2. Owner uploads valid JPEG image successfully', async () => {
    const form = new FormData();
    form.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'photo.jpg');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 201);
    assert.equal(res.data.data.images.length, 1);
    const img = res.data.data.images[0];
    assert.equal(img.is_cover, false, 'Subsequent image must not overwrite existing cover');
    assert.equal(img.order, 1, 'Subsequent image must have order incremented');
  });

  test('3. Owner uploads valid WebP image successfully', async () => {
    const form = new FormData();
    form.append('images', new Blob([webpBuffer], { type: 'image/webp' }), 'banner.webp');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 201);
    assert.equal(res.data.data.images.length, 1);
    const img = res.data.data.images[0];
    assert.equal(img.is_cover, false);
    assert.equal(img.order, 2);
  });

  test('4. Multiple image upload in single request succeeds and assigns deterministic order', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'batch1.png');
    form.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'batch2.jpg');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 201);
    assert.equal(res.data.data.images.length, 2);
    assert.equal(res.data.data.images[0].order, 3);
    assert.equal(res.data.data.images[1].order, 4);
  });

  test('5. Empty upload request (0 files attached) is rejected with HTTP 400', async () => {
    const form = new FormData();
    // Do not append any file under 'images'
    form.append('notes', 'some note');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('No image files provided') || res.data.error.message.includes('images'));
  });

  // =========================================================================
  // 2. Content Validation & Safeguards
  // =========================================================================

  test('6. Unsupported declared MIME type (GIF) is rejected with HTTP 400', async () => {
    const gifBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const form = new FormData();
    form.append('images', new Blob([gifBuffer], { type: 'image/gif' }), 'animation.gif');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Invalid file format') || res.data.error.message.includes('JPEG'));
  });

  test('7. Spoofed MIME type rejected by magic-byte signature validation (HTML disguised as PNG)', async () => {
    const fakePng = Buffer.from('<html><body><script>alert("xss")</script></body></html>', 'utf-8');
    const form = new FormData();
    form.append('images', new Blob([fakePng], { type: 'image/png' }), 'malicious.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(
      res.data.error.message.includes('Invalid file content') ||
        res.data.error.message.includes('signature') ||
        res.data.error.message.includes('valid')
    );
  });

  test('8. Empty file (0 bytes) is rejected with HTTP 400', async () => {
    const form = new FormData();
    form.append('images', new Blob([Buffer.alloc(0)], { type: 'image/png' }), 'empty.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  test('9. Oversized individual file (>5MB) is rejected with HTTP 400', async () => {
    // 5.5 MB buffer
    const bigBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    bigBuffer[0] = 0x89;
    bigBuffer[1] = 0x50;
    bigBuffer[2] = 0x4e;
    bigBuffer[3] = 0x47;
    bigBuffer[4] = 0x0d;
    bigBuffer[5] = 0x0a;
    bigBuffer[6] = 0x1a;
    bigBuffer[7] = 0x0a;

    const form = new FormData();
    form.append('images', new Blob([bigBuffer], { type: 'image/png' }), 'big.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('5MB') || res.data.error.message.includes('large'));
  });

  test('10. More than 20 files in a single request is rejected with HTTP 400', async () => {
    const form = new FormData();
    for (let i = 0; i < 21; i++) {
      form.append('images', new Blob([pngBuffer], { type: 'image/png' }), `img_${i}.png`);
    }

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  test('11. Upload exceeding 20 total images on listing is rejected with HTTP 400', async () => {
    // Create dedicated listing to fill up to 20 images
    const capListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Capacity Test Listing ${testRunId}`,
      description: 'Testing 20-image capacity limit.',
      category: 'retail',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 500,
      address: 'Test Addr',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });
    createdListingIds.push(capListing.id);

    // Upload 18 images via two requests
    const form1 = new FormData();
    for (let i = 0; i < 10; i++) {
      form1.append('images', new Blob([pngBuffer], { type: 'image/png' }), `test_${i}.png`);
    }
    const res1 = await makeMultipartRequest(`/api/v1/listings/${capListing.id}/images`, form1, ownerToken);
    assert.equal(res1.status, 201);

    const form2 = new FormData();
    for (let i = 10; i < 18; i++) {
      form2.append('images', new Blob([pngBuffer], { type: 'image/png' }), `test_${i}.png`);
    }
    const res2 = await makeMultipartRequest(`/api/v1/listings/${capListing.id}/images`, form2, ownerToken);
    assert.equal(res2.status, 201);

    // Current total is 18. Attempting to upload 3 more (18 + 3 = 21) must be rejected with HTTP 400
    const form3 = new FormData();
    form3.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test_18.png');
    form3.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test_19.png');
    form3.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test_20.png');

    const res3 = await makeMultipartRequest(`/api/v1/listings/${capListing.id}/images`, form3, ownerToken);
    assert.equal(res3.status, 400);
    assert.equal(res3.data.success, false);
    assert.ok(res3.data.error.message.includes('20') || res3.data.error.message.includes('Maximum'));
  });

  // =========================================================================
  // 3. Authorization & IDOR Protection
  // =========================================================================

  test('12. Unauthenticated upload request returns HTTP 401', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, null);
    assert.equal(res.status, 401);
  });

  test('13. Customer upload request returns HTTP 403', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');

    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, customerToken);
    assert.equal(res.status, 403);
  });

  test('14. Upload to another owner listing returns HTTP 403 (IDOR check)', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');

    // owner attempts to upload to otherOwnerListingId
    const res = await makeMultipartRequest(`/api/v1/listings/${otherOwnerListingId}/images`, form, ownerToken);
    assert.equal(res.status, 403);
  });

  test('15. Upload to non-existent listing returns HTTP 404', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');

    const res = await makeMultipartRequest('/api/v1/listings/nonexistent12345/images', form, ownerToken);
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // 4. Cover Image Selection
  // =========================================================================

  test('16. Set cover image sets target as is_cover: true and clears other images', async () => {
    // Get all images on pendingListingId
    const existing = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
      sort: 'order',
    });
    assert.ok(existing.length >= 3);

    const targetImage = existing[2]; // Pick 3rd image
    assert.equal(targetImage.is_cover, false);

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/${targetImage.id}/cover`, {
      method: 'PATCH',
      token: ownerToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.images));

    // Verify target is cover in returned response
    const updatedTarget = res.data.data.images.find((img) => img.id === targetImage.id);
    assert.equal(updatedTarget.is_cover, true);

    // Verify all other images have is_cover: false
    const covers = res.data.data.images.filter((img) => img.is_cover);
    assert.equal(covers.length, 1, 'Exactly one cover image must exist');

    // Verify in database
    const dbImages = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    const dbCovers = dbImages.filter((img) => img.is_cover);
    assert.equal(dbCovers.length, 1);
    assert.equal(dbCovers[0].id, targetImage.id);
  });

  test('17. Setting cover on foreign image (belonging to another listing) returns HTTP 404', async () => {
    // Upload image to otherOwnerListingId
    const form = new FormData();
    form.append('listing', otherOwnerListingId);
    form.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'other.png');
    const foreignImage = await adminPb.collection('listing_images').create(form);

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/${foreignImage.id}/cover`, {
      method: 'PATCH',
      token: ownerToken,
    });

    assert.equal(res.status, 404);
  });

  // =========================================================================
  // 5. Image Reordering
  // =========================================================================

  test('18. Valid reorder succeeds and assigns deterministic zero-based order values', async () => {
    const existing = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
      sort: 'order',
    });
    const reversedIds = existing.map((img) => img.id).reverse();

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/order`, {
      method: 'PUT',
      token: ownerToken,
      body: JSON.stringify({ order: reversedIds }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    // Verify database reflects new order
    for (let i = 0; i < reversedIds.length; i++) {
      const rec = await adminPb.collection('listing_images').getOne(reversedIds[i]);
      assert.equal(rec.order, i);
    }
  });

  test('19. Reorder with duplicate IDs is rejected with HTTP 400', async () => {
    const existing = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    const dupes = [existing[0].id, existing[0].id];

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/order`, {
      method: 'PUT',
      token: ownerToken,
      body: JSON.stringify({ order: dupes }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Duplicate'));
  });

  test('20. Reorder with incomplete image set is rejected with HTTP 400', async () => {
    const existing = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    // Omit last image
    const incomplete = existing.slice(0, -1).map((img) => img.id);

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/order`, {
      method: 'PUT',
      token: ownerToken,
      body: JSON.stringify({ order: incomplete }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('all listing images'));
  });

  test('21. Reorder with foreign image ID is rejected with HTTP 400', async () => {
    const existing = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    const ids = existing.map((img) => img.id);
    ids[0] = 'fake12345678901';

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/order`, {
      method: 'PUT',
      token: ownerToken,
      body: JSON.stringify({ order: ids }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  // =========================================================================
  // 6. Delete Individual Image & Cover Promotion
  // =========================================================================

  test('22. Deleting cover image promotes remaining image with lowest order to cover', async () => {
    // Dedicated listing to test cover deletion
    const delCoverListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Cover Delete Listing ${testRunId}`,
      description: 'Testing cover promotion.',
      category: 'office',
      listing_type: 'rent',
      price: 60000,
      area_sqft: 700,
      address: 'Test Addr',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });
    createdListingIds.push(delCoverListing.id);

    // Upload 3 images
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'img1.png');
    form.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'img2.jpg');
    form.append('images', new Blob([webpBuffer], { type: 'image/webp' }), 'img3.webp');
    const uploadRes = await makeMultipartRequest(`/api/v1/listings/${delCoverListing.id}/images`, form, ownerToken);
    assert.equal(uploadRes.status, 201);

    const [img1, img2, img3] = uploadRes.data.data.images;
    assert.equal(img1.is_cover, true);

    // Delete img1 (the cover)
    const delRes = await makeJsonRequest(`/api/v1/listings/${delCoverListing.id}/images/${img1.id}`, {
      method: 'DELETE',
      token: ownerToken,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.message, 'Image deleted successfully');

    // Verify img2 was promoted to cover in database
    const dbImg2 = await adminPb.collection('listing_images').getOne(img2.id);
    assert.equal(dbImg2.is_cover, true, 'Next remaining image must be promoted to cover');

    const dbImg3 = await adminPb.collection('listing_images').getOne(img3.id);
    assert.equal(dbImg3.is_cover, false);
  });

  test('23. Deleting last remaining image leaves listing with zero cover and zero images', async () => {
    const singleListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Single Image Listing ${testRunId}`,
      description: 'Testing single image delete.',
      category: 'office',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 500,
      address: 'Test Addr',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });
    createdListingIds.push(singleListing.id);

    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'only.png');
    const upRes = await makeMultipartRequest(`/api/v1/listings/${singleListing.id}/images`, form, ownerToken);
    const imgId = upRes.data.data.images[0].id;

    const delRes = await makeJsonRequest(`/api/v1/listings/${singleListing.id}/images/${imgId}`, {
      method: 'DELETE',
      token: ownerToken,
    });
    assert.equal(delRes.status, 200);

    const remaining = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: singleListing.id }),
    });
    assert.equal(remaining.length, 0);
  });

  test('24. Cross-listing image deletion returns HTTP 404', async () => {
    // Attempt to delete foreign image using pendingListingId route
    const form = new FormData();
    form.append('listing', otherOwnerListingId);
    form.append('image', new Blob([pngBuffer], { type: 'image/png' }), 'foreign.png');
    const foreignImage = await adminPb.collection('listing_images').create(form);

    const res = await makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/${foreignImage.id}`, {
      method: 'DELETE',
      token: ownerToken,
    });
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // 7. D-002 Re-approval Policy for Images
  // =========================================================================

  test('25. Approved listing reverts to pending after image upload (D-002)', async () => {
    // approvedListingId is approved
    const before = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(before.status, 'approved');

    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'app_test.png');
    const res = await makeMultipartRequest(`/api/v1/listings/${approvedListingId}/images`, form, ownerToken);
    assert.equal(res.status, 201);

    const after = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(after.status, 'pending', 'Listing status must revert to pending after image upload');
  });

  test('26. Approved listing reverts to pending after image deletion (D-002)', async () => {
    // Reset listing to approved
    await adminPb.collection('listings').update(approvedListingId, { status: 'approved' });
    const checkApp = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(checkApp.status, 'approved');

    const images = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: approvedListingId }),
    });
    assert.ok(images.length > 0);

    const res = await makeJsonRequest(`/api/v1/listings/${approvedListingId}/images/${images[0].id}`, {
      method: 'DELETE',
      token: ownerToken,
    });
    assert.equal(res.status, 200);

    const after = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(after.status, 'pending', 'Listing status must revert to pending after image delete');
  });

  test('27. Approved listing reverts to pending after cover change (D-002)', async () => {
    // Upload 2 images to approved listing
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'cov1.png');
    form.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'cov2.jpg');
    const upRes = await makeMultipartRequest(`/api/v1/listings/${approvedListingId}/images`, form, ownerToken);

    // Set listing to approved
    await adminPb.collection('listings').update(approvedListingId, { status: 'approved' });
    const target = upRes.data.data.images[1];

    const res = await makeJsonRequest(`/api/v1/listings/${approvedListingId}/images/${target.id}/cover`, {
      method: 'PATCH',
      token: ownerToken,
    });
    assert.equal(res.status, 200);

    const after = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(after.status, 'pending', 'Listing status must revert to pending after cover change');
  });

  test('28. Approved listing reverts to pending after reordering (D-002)', async () => {
    // Set listing to approved
    await adminPb.collection('listings').update(approvedListingId, { status: 'approved' });

    const images = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: approvedListingId }),
    });
    const reversed = images.map((img) => img.id).reverse();

    const res = await makeJsonRequest(`/api/v1/listings/${approvedListingId}/images/order`, {
      method: 'PUT',
      token: ownerToken,
      body: JSON.stringify({ order: reversed }),
    });
    assert.equal(res.status, 200);

    const after = await adminPb.collection('listings').getOne(approvedListingId);
    assert.equal(after.status, 'pending', 'Listing status must revert to pending after reordering');
  });

  test('29. Pending listing remains pending after image upload', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'pend.png');
    const res = await makeMultipartRequest(`/api/v1/listings/${pendingListingId}/images`, form, ownerToken);
    assert.equal(res.status, 201);

    const dbListing = await adminPb.collection('listings').getOne(pendingListingId);
    assert.equal(dbListing.status, 'pending');
  });

  test('30. Rejected listing remains rejected after image upload', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'rej.png');
    const res = await makeMultipartRequest(`/api/v1/listings/${rejectedListingId}/images`, form, ownerToken);
    assert.equal(res.status, 201);

    const dbListing = await adminPb.collection('listings').getOne(rejectedListingId);
    assert.equal(dbListing.status, 'rejected');
  });

  test('31. Archived listing remains archived after image upload', async () => {
    const form = new FormData();
    form.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'arch.png');
    const res = await makeMultipartRequest(`/api/v1/listings/${archivedListingId}/images`, form, ownerToken);
    assert.equal(res.status, 201);

    const dbListing = await adminPb.collection('listings').getOne(archivedListingId);
    assert.equal(dbListing.status, 'archived');
  });

  // =========================================================================
  // 8. Concurrency & Locking Safeguards
  // =========================================================================

  test('32. Concurrent uploads on same listing do not exceed capacity or create duplicate covers', async () => {
    const concListing = await adminPb.collection('listings').create({
      owner: ownerId,
      title: `Concurrent Test Listing ${testRunId}`,
      description: 'Testing concurrency serialization.',
      category: 'office',
      listing_type: 'rent',
      price: 70000,
      area_sqft: 800,
      address: 'Test Addr',
      city: 'Dhaka',
      area: 'Banani',
      status: 'pending',
    });
    createdListingIds.push(concListing.id);

    // Launch two parallel uploads simultaneously
    const formA = new FormData();
    formA.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'parA1.png');
    formA.append('images', new Blob([pngBuffer], { type: 'image/png' }), 'parA2.png');

    const formB = new FormData();
    formB.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'parB1.jpg');
    formB.append('images', new Blob([jpgBuffer], { type: 'image/jpeg' }), 'parB2.jpg');

    const [resA, resB] = await Promise.all([
      makeMultipartRequest(`/api/v1/listings/${concListing.id}/images`, formA, ownerToken),
      makeMultipartRequest(`/api/v1/listings/${concListing.id}/images`, formB, ownerToken),
    ]);

    assert.equal(resA.status, 201);
    assert.equal(resB.status, 201);

    const allDbImages = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: concListing.id }),
      sort: 'order',
    });

    assert.equal(allDbImages.length, 4);

    // Exactly one image must be cover
    const covers = allDbImages.filter((img) => img.is_cover);
    assert.equal(covers.length, 1, 'Concurrent uploads must result in exactly one cover image');

    // Distinct orders
    const orders = allDbImages.map((img) => img.order);
    assert.equal(new Set(orders).size, 4, 'All images must have distinct order numbers');
  });

  test('33. Concurrent cover changes result in exactly one cover image', async () => {
    const images = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    assert.ok(images.length >= 2);

    const imgA = images[0].id;
    const imgB = images[1].id;

    // Trigger parallel cover changes
    await Promise.all([
      makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/${imgA}/cover`, {
        method: 'PATCH',
        token: ownerToken,
      }),
      makeJsonRequest(`/api/v1/listings/${pendingListingId}/images/${imgB}/cover`, {
        method: 'PATCH',
        token: ownerToken,
      }),
    ]);

    const freshImages = await adminPb.collection('listing_images').getFullList({
      filter: adminPb.filter('listing = {:id}', { id: pendingListingId }),
    });
    const covers = freshImages.filter((img) => img.is_cover);
    assert.equal(covers.length, 1, 'Parallel cover updates must leave exactly one cover image');
  });
});

