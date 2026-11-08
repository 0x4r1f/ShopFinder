import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

/**
 * Phase 8, Task 8.1 — Customer Favorites / Saved Listings API Tests
 *
 * Verifies:
 * 1. POST /api/v1/favorites/:listingId (Save approved listing, idempotency, non-approved rejection, CSRF, RBAC)
 * 2. DELETE /api/v1/favorites/:listingId (Remove bookmark, customer isolation, idempotency, CSRF, RBAC)
 * 3. GET /api/v1/favorites (Customer isolation, pagination, sorting allowlist, D-014 privacy sanitization, RBAC)
 */
describe('Phase 8, Task 8.1 — Customer Favorites / Saved Listings API', () => {
  let server;
  let baseUrl;
  let adminPb;

  const testRunId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const testPassword = 'Password123!';

  let customer1Email;
  let customer2Email;
  let ownerEmail;
  let adminEmail;

  let customer1Id;
  let customer2Id;
  let ownerId;
  let adminId;

  let customer1Token;
  let customer2Token;
  let ownerToken;
  let adminToken;

  let approvedListing1Id;
  let approvedListing2Id;
  let approvedListing3Id;
  let unsavedApprovedListingId;
  let pendingListingId;
  let rejectedListingId;
  let archivedListingId;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdFavoriteIds = [];
  const createdContactIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Primary Customer (Customer 1)
    customer1Email = `cust1_fav_${testRunId}@shopfinder.local`;
    const cust1Rec = await adminPb.collection('users').create({
      name: `Customer Primary ${testRunId}`,
      email: customer1Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customer1Id = cust1Rec.id;
    createdUserIds.push(customer1Id);

    // 2. Create Secondary Customer (Customer 2 - to test bookmark isolation)
    customer2Email = `cust2_fav_${testRunId}@shopfinder.local`;
    const cust2Rec = await adminPb.collection('users').create({
      name: `Customer Secondary ${testRunId}`,
      email: customer2Email,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    customer2Id = cust2Rec.id;
    createdUserIds.push(customer2Id);

    // 3. Create Property Owner
    ownerEmail = `own_fav_${testRunId}@shopfinder.local`;
    const ownerRec = await adminPb.collection('users').create({
      name: `Property Owner ${testRunId}`,
      email: ownerEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'owner',
    });
    ownerId = ownerRec.id;
    createdUserIds.push(ownerId);

    // 4. Create Owner Contact (Phone number in owner_contacts) to verify D-014 privacy
    try {
      const contactRec = await adminPb.collection('owner_contacts').create({
        owner: ownerId,
        phone: '+880 1812-998877',
      });
      createdContactIds.push(contactRec.id);
    } catch {}

    // 5. Create Admin
    adminEmail = `adm_fav_${testRunId}@shopfinder.local`;
    const adminRec = await adminPb.collection('users').create({
      name: `Admin User ${testRunId}`,
      email: adminEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'admin',
    });
    adminId = adminRec.id;
    createdUserIds.push(adminId);

    // 6. Authenticate test users to acquire JWT tokens
    const userPb = new PocketBase(env.POCKETBASE_URL);
    userPb.autoCancellation(false);

    const cust1Auth = await userPb.collection('users').authWithPassword(customer1Email, testPassword);
    customer1Token = cust1Auth.token;

    const cust2Auth = await userPb.collection('users').authWithPassword(customer2Email, testPassword);
    customer2Token = cust2Auth.token;

    const ownerAuth = await userPb.collection('users').authWithPassword(ownerEmail, testPassword);
    ownerToken = ownerAuth.token;

    const adminAuth = await userPb.collection('users').authWithPassword(adminEmail, testPassword);
    adminToken = adminAuth.token;

    // 7. Create Listings in various statuses
    // a) Approved Listing 1
    const l1 = await adminPb.collection('listings').create({
      title: `Banani Commercial Shop ${testRunId}`,
      description: 'Prime retail shop on Road 11 Banani.',
      category: 'retail',
      listing_type: 'rent',
      price: 65000,
      area_sqft: 850,
      address: 'Plot 45, Road 11',
      city: 'Dhaka',
      area: 'Banani',
      owner: ownerId,
      status: 'approved',
    });
    approvedListing1Id = l1.id;
    createdListingIds.push(approvedListing1Id);

    // b) Approved Listing 2
    const l2 = await adminPb.collection('listings').create({
      title: `Gulshan Corporate Office ${testRunId}`,
      description: 'Modern office floor with lake view in Gulshan 2.',
      category: 'office',
      listing_type: 'rent',
      price: 180000,
      area_sqft: 2200,
      address: 'Gulshan Avenue 102',
      city: 'Dhaka',
      area: 'Gulshan',
      owner: ownerId,
      status: 'approved',
    });
    approvedListing2Id = l2.id;
    createdListingIds.push(approvedListing2Id);

    // c) Approved Listing 3
    const l3 = await adminPb.collection('listings').create({
      title: `Dhanmondi Restaurant Space ${testRunId}`,
      description: 'Fully fitted commercial restaurant space.',
      category: 'restaurant',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 1800,
      address: 'Satmasjid Road 27',
      city: 'Dhaka',
      area: 'Dhanmondi',
      owner: ownerId,
      status: 'approved',
    });
    approvedListing3Id = l3.id;
    createdListingIds.push(approvedListing3Id);

    // d) Unsaved Approved Listing (to verify it never appears in customer favorites)
    const l4 = await adminPb.collection('listings').create({
      title: `Unsaved Commercial Space ${testRunId}`,
      description: 'Commercial space never bookmarked by test customer.',
      category: 'office',
      listing_type: 'rent',
      price: 50000,
      area_sqft: 900,
      address: 'Panthapath 15',
      city: 'Dhaka',
      area: 'Panthapath',
      owner: ownerId,
      status: 'approved',
    });
    unsavedApprovedListingId = l4.id;
    createdListingIds.push(unsavedApprovedListingId);

    // e) Pending Listing
    const lp = await adminPb.collection('listings').create({
      title: `Pending Warehouse Space ${testRunId}`,
      description: 'Warehouse awaiting administrative approval.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 95000,
      area_sqft: 3500,
      address: 'Tejgaon Industrial Area',
      city: 'Dhaka',
      area: 'Tejgaon',
      owner: ownerId,
      status: 'pending',
    });
    pendingListingId = lp.id;
    createdListingIds.push(pendingListingId);

    // e) Rejected Listing
    const lr = await adminPb.collection('listings').create({
      title: `Rejected Retail Kiosk ${testRunId}`,
      description: 'Kiosk that was rejected by moderator.',
      category: 'retail',
      listing_type: 'rent',
      price: 25000,
      area_sqft: 200,
      address: 'Mirpur 10 Circle',
      city: 'Dhaka',
      area: 'Mirpur',
      owner: ownerId,
      status: 'rejected',
      rejection_note: 'Inadequate commercial documentation.',
    });
    rejectedListingId = lr.id;
    createdListingIds.push(rejectedListingId);

    // f) Archived Listing
    const la = await adminPb.collection('listings').create({
      title: `Archived Showroom ${testRunId}`,
      description: 'Showroom archived by administration.',
      category: 'showroom',
      listing_type: 'rent',
      price: 150000,
      area_sqft: 2500,
      address: 'Uttara Sector 3',
      city: 'Dhaka',
      area: 'Uttara',
      owner: ownerId,
      status: 'archived',
    });
    archivedListingId = la.id;
    createdListingIds.push(archivedListingId);

    // 8. Start ephemeral HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Clean up saved_listings bookmarks
    for (const fid of createdFavoriteIds) {
      try {
        await adminPb.collection('saved_listings').delete(fid);
      } catch {}
    }

    // 2. Clean up listings
    for (const lid of createdListingIds) {
      try {
        await adminPb.collection('listings').delete(lid);
      } catch {}
    }

    // 3. Clean up owner contacts
    for (const cid of createdContactIds) {
      try {
        await adminPb.collection('owner_contacts').delete(cid);
      } catch {}
    }

    // 4. Clean up test users
    for (const uid of createdUserIds) {
      try {
        await adminPb.collection('users').delete(uid);
      } catch {}
    }

    // 5. Close HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Helper function to issue HTTP requests
  async function apiRequest(path, { method = 'GET', token = null, body = null, headers = {} } = {}) {
    const reqHeaders = {
      ...headers,
    };

    if (token) {
      reqHeaders['Cookie'] = `pb_auth=${token}`;
    }

    // For state-mutating requests, include CSRF-safe Origin by default unless overridden
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && reqHeaders['Origin'] === undefined) {
      reqHeaders['Origin'] = env.CLIENT_URL;
    }

    if (body !== null && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers: reqHeaders,
    };

    if (body !== null) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return fetch(`${baseUrl}${path}`, options);
  }

  // =========================================================================
  // 1. POST /api/v1/favorites/:listingId
  // =========================================================================
  describe('POST /api/v1/favorites/:listingId (Save Listing)', () => {
    test('1. Customer can successfully save an approved listing (HTTP 201)', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing1Id}`, {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 201, 'Must return HTTP 201 Created on first save');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.already_saved, false);
      assert.strictEqual(data.data?.favorite?.listing_id, approvedListing1Id);
      assert.ok(data.data?.favorite?.id, 'Must return bookmark ID');
      assert.ok(data.data?.favorite?.saved_at, 'Must have saved_at timestamp');

      createdFavoriteIds.push(data.data.favorite.id);

      // Verify database record
      const dbRecord = await adminPb.collection('saved_listings').getOne(data.data.favorite.id);
      assert.strictEqual(dbRecord.customer, customer1Id);
      assert.strictEqual(dbRecord.listing, approvedListing1Id);
      assert.ok(dbRecord.saved_at);
    });

    test('2. Duplicate save is idempotent (HTTP 200, already_saved: true)', async () => {
      // Customer 1 saves listing 1 again
      const res = await apiRequest(`/api/v1/favorites/${approvedListing1Id}`, {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 on duplicate save');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.already_saved, true);
      assert.strictEqual(data.data?.favorite?.listing_id, approvedListing1Id);

      // Verify no duplicate record was created in database
      const list = await adminPb.collection('saved_listings').getList(1, 10, {
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customer1Id,
          l: approvedListing1Id,
        }),
      });
      assert.strictEqual(list.totalItems, 1, 'Database must have exactly 1 record for this pair');
    });

    test('3. Nonexistent listing is rejected with HTTP 404', async () => {
      const res = await apiRequest('/api/v1/favorites/nonexistent12345', {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 404, 'Must return HTTP 404 for missing listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Listing not found/i);
    });

    test('4. Pending listing is rejected with HTTP 400', async () => {
      const res = await apiRequest(`/api/v1/favorites/${pendingListingId}`, {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400, 'Must return HTTP 400 for pending listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Only approved listings can be saved/i);
    });

    test('5. Rejected listing is rejected with HTTP 400', async () => {
      const res = await apiRequest(`/api/v1/favorites/${rejectedListingId}`, {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400, 'Must return HTTP 400 for rejected listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Only approved listings can be saved/i);
    });

    test('6. Archived listing is rejected with HTTP 400', async () => {
      const res = await apiRequest(`/api/v1/favorites/${archivedListingId}`, {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400, 'Must return HTTP 400 for archived listing');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Only approved listings can be saved/i);
    });

    test('7. Customer cannot save on behalf of another customer through body tampering', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing2Id}`, {
        method: 'POST',
        token: customer1Token,
        body: {
          customer: customer2Id, // Attempting to bookmark for customer 2
          customerId: customer2Id,
          user: { id: customer2Id },
        },
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      createdFavoriteIds.push(data.data?.favorite?.id);

      // Verify that the bookmark was attributed strictly to Customer 1
      const record = await adminPb.collection('saved_listings').getOne(data.data.favorite.id);
      assert.strictEqual(record.customer, customer1Id, 'Customer ID must come exclusively from verified session');
      assert.notStrictEqual(record.customer, customer2Id);
    });

    test('8. Anonymous request to save favorite returns HTTP 401', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: null,
      });

      assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('9. Owner access to save favorite returns HTTP 403', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: ownerToken,
      });

      assert.strictEqual(res.status, 403, 'Owner role must return HTTP 403');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('10. Admin access to save favorite returns HTTP 403', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: adminToken,
      });

      assert.strictEqual(res.status, 403, 'Admin role must return HTTP 403');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('11. CSRF protection is enforced (missing Origin on POST returns HTTP 403)', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: customer1Token,
        headers: {
          Origin: '', // Omitting origin to simulate cross-origin browser request
        },
      });

      assert.strictEqual(res.status, 403, 'Missing Origin on POST must trigger CSRF protection');
    });

    test('12. Malformed listing ID returns HTTP 400', async () => {
      const res = await apiRequest('/api/v1/favorites/invalid@id#format', {
        method: 'POST',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400, 'Malformed listing ID must return HTTP 400');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });
  });

  // =========================================================================
  // 2. DELETE /api/v1/favorites/:listingId
  // =========================================================================
  describe('DELETE /api/v1/favorites/:listingId (Remove Favorite)', () => {
    test('13. Customer can successfully remove their own bookmark (HTTP 200)', async () => {
      // First ensure listing 1 is saved by customer 1
      const res = await apiRequest(`/api/v1/favorites/${approvedListing1Id}`, {
        method: 'DELETE',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 on successful removal');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data, undefined);

      // Verify record is gone from database
      const list = await adminPb.collection('saved_listings').getList(1, 1, {
        filter: adminPb.filter('customer = {:c} && listing = {:l}', {
          c: customer1Id,
          l: approvedListing1Id,
        }),
      });
      assert.strictEqual(list.totalItems, 0, 'Database record must be deleted');
    });

    test('14. Repeated deletion is idempotent (HTTP 200, data: null)', async () => {
      // Deleting again when record no longer exists
      const res = await apiRequest(`/api/v1/favorites/${approvedListing1Id}`, {
        method: 'DELETE',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200, 'Repeated delete must return HTTP 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    test('15. Customer CANNOT delete another customer’s bookmark', async () => {
      // Step a: Customer 2 saves listing 3
      const saveRes = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: customer2Token,
      });
      assert.strictEqual(saveRes.status, 201);
      const saveData = await saveRes.json();
      const customer2FavoriteId = saveData.data.favorite.id;
      createdFavoriteIds.push(customer2FavoriteId);

      // Step b: Customer 1 attempts to delete listing 3
      const delRes = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'DELETE',
        token: customer1Token,
      });
      assert.strictEqual(delRes.status, 200, 'Returns 200 for caller idempotent');

      // Step c: Verify Customer 2 bookmark is STILL in database untouched!
      const cust2Bookmark = await adminPb.collection('saved_listings').getOne(customer2FavoriteId);
      assert.strictEqual(cust2Bookmark.customer, customer2Id, 'Customer 2 bookmark must remain intact');
      assert.strictEqual(cust2Bookmark.listing, approvedListing3Id);
    });

    test('16. Anonymous request to delete favorite returns HTTP 401', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'DELETE',
        token: null,
      });

      assert.strictEqual(res.status, 401, 'Anonymous request must return HTTP 401');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('17. Owner and Admin cannot delete favorites (HTTP 403)', async () => {
      const ownerRes = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'DELETE',
        token: ownerToken,
      });
      assert.strictEqual(ownerRes.status, 403);

      const adminRes = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'DELETE',
        token: adminToken,
      });
      assert.strictEqual(adminRes.status, 403);
    });

    test('18. CSRF protection is enforced on DELETE (missing Origin returns HTTP 403)', async () => {
      const res = await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'DELETE',
        token: customer1Token,
        headers: {
          Origin: '',
        },
      });

      assert.strictEqual(res.status, 403, 'Missing Origin on DELETE must trigger CSRF protection');
    });

    test('19. Malformed listing ID on DELETE returns HTTP 400', async () => {
      const res = await apiRequest('/api/v1/favorites/malformed!!id', {
        method: 'DELETE',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });
  });

  // =========================================================================
  // 3. GET /api/v1/favorites (List Saved Listings)
  // =========================================================================
  describe('GET /api/v1/favorites (Retrieve Saved Listings)', () => {
    before(async () => {
      // Set up specific bookmarks for Customer 1:
      // Customer 1 saves listing 1 and listing 3
      await apiRequest(`/api/v1/favorites/${approvedListing1Id}`, {
        method: 'POST',
        token: customer1Token,
      });
      await apiRequest(`/api/v1/favorites/${approvedListing3Id}`, {
        method: 'POST',
        token: customer1Token,
      });
    });

    test('20. Customer retrieves only their own saved listings', async () => {
      const res = await apiRequest('/api/v1/favorites', {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data?.favorites), 'Must return favorites array');

      const returnedListingIds = data.data.favorites.map((f) => f.listing_id);
      assert.ok(returnedListingIds.includes(approvedListing1Id), 'Must include saved listing 1');
      assert.ok(returnedListingIds.includes(approvedListing2Id), 'Must include saved listing 2');
      assert.ok(returnedListingIds.includes(approvedListing3Id), 'Must include saved listing 3');
      assert.ok(
        !returnedListingIds.includes(unsavedApprovedListingId),
        'Must NOT include unsaved listing'
      );

      // Each favorite item structure
      const item = data.data.favorites[0];
      assert.ok(item.id, 'Item must have bookmark ID');
      assert.ok(item.saved_at, 'Item must have saved_at');
      assert.ok(item.listing, 'Item must contain listing object');
      assert.strictEqual(item.listing.status, 'approved');
      assert.ok(item.listing.title);
      assert.ok(item.listing.price);
    });

    test('21. Pagination metadata is correct', async () => {
      const res = await apiRequest('/api/v1/favorites?page=1&perPage=1', {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.pagination.page, 1);
      assert.strictEqual(data.data.pagination.perPage, 1);
      assert.strictEqual(data.data.favorites.length, 1);
      assert.ok(data.data.pagination.totalItems >= 2);
      assert.ok(data.data.pagination.totalPages >= 2);
    });

    test('22. Default sorting is newest saved first (-saved_at)', async () => {
      const res = await apiRequest('/api/v1/favorites', {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const favs = data.data.favorites;
      if (favs.length >= 2) {
        const time0 = new Date(favs[0].saved_at).getTime();
        const time1 = new Date(favs[1].saved_at).getTime();
        assert.ok(time0 >= time1, 'Newest saved must appear first');
      }
    });

    test('23. Allowlisted sorting options work correctly (saved_at, -created, created)', async () => {
      for (const sortOpt of ['saved_at', '-created', 'created', 'oldest', 'newest']) {
        const res = await apiRequest(`/api/v1/favorites?sort=${sortOpt}`, {
          method: 'GET',
          token: customer1Token,
        });
        assert.strictEqual(res.status, 200, `Sort option "${sortOpt}" must return HTTP 200`);
        const data = await res.json();
        assert.strictEqual(data.success, true);
      }
    });

    test('24. Unsupported sorting option is rejected with HTTP 400', async () => {
      const res = await apiRequest('/api/v1/favorites?sort=unsupported_sort', {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.error?.message, /Unsupported sort option/i);
    });

    test('25. Invalid pagination values are rejected with HTTP 400', async () => {
      // Negative page
      const res1 = await apiRequest('/api/v1/favorites?page=-1', {
        method: 'GET',
        token: customer1Token,
      });
      assert.strictEqual(res1.status, 400);

      // Zero page
      const res2 = await apiRequest('/api/v1/favorites?page=0', {
        method: 'GET',
        token: customer1Token,
      });
      assert.strictEqual(res2.status, 400);

      // Oversized perPage > 100
      const res3 = await apiRequest('/api/v1/favorites?perPage=500', {
        method: 'GET',
        token: customer1Token,
      });
      assert.strictEqual(res3.status, 400);

      // Non-integer page
      const res4 = await apiRequest('/api/v1/favorites?page=abc', {
        method: 'GET',
        token: customer1Token,
      });
      assert.strictEqual(res4.status, 400);
    });

    test('26. D-014 Privacy Policy: Responses NEVER expose owner phone numbers, credentials, or internal PB fields', async () => {
      const res = await apiRequest('/api/v1/favorites', {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const rawText = await res.text();

      // Check for phone number leak
      assert.ok(!rawText.includes('1812-998877'), 'Owner phone number must not be leaked');
      assert.ok(!rawText.includes('owner_contacts'), 'owner_contacts collection must not be referenced');

      const data = JSON.parse(rawText);
      for (const item of data.data.favorites) {
        const l = item.listing;
        assert.strictEqual(l.collectionId, undefined);
        assert.strictEqual(l.collectionName, undefined);
        if (l.owner) {
          assert.strictEqual(l.owner.phone, undefined);
          assert.strictEqual(l.owner.password, undefined);
          assert.strictEqual(l.owner.passwordHash, undefined);
          assert.strictEqual(l.owner.tokenKey, undefined);
          assert.strictEqual(l.owner.collectionId, undefined);
        }
      }
    });

    test('27. Customer-supplied query parameters (?customer=...) cannot override session isolation', async () => {
      const res = await apiRequest(`/api/v1/favorites?customer=${customer2Id}&customerId=${customer2Id}`, {
        method: 'GET',
        token: customer1Token,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      // Must still be customer 1's favorites, not customer 2's
      const returnedListingIds = data.data.favorites.map((f) => f.listing_id);
      assert.ok(returnedListingIds.includes(approvedListing1Id));
    });

    test('28. Anonymous user, owner, and admin cannot access GET /api/v1/favorites', async () => {
      const anonRes = await apiRequest('/api/v1/favorites', { method: 'GET', token: null });
      assert.strictEqual(anonRes.status, 401);

      const ownerRes = await apiRequest('/api/v1/favorites', { method: 'GET', token: ownerToken });
      assert.strictEqual(ownerRes.status, 403);

      const adminRes = await apiRequest('/api/v1/favorites', { method: 'GET', token: adminToken });
      assert.strictEqual(adminRes.status, 403);
    });
  });
});
