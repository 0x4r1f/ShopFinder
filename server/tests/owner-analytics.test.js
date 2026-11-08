import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { hashIp, recordListingView } from '../src/services/listingViewService.js';
import { getOwnerAnalytics } from '../src/services/ownerAnalyticsService.js';

describe('Phase 12, Task 12.1 — Owner Analytics & Listing View Tracking Tests', () => {
  let adminPb = null;
  let server = null;
  let baseUrl = '';

  const timestamp = Date.now();
  const testPassword = 'Password123!';
  const rand = () => Math.random().toString(36).slice(2, 7);

  let testOwner1 = null;
  let owner1Cookie = '';
  let testOwner2 = null;
  let owner2Cookie = '';
  let testCustomer = null;
  let customerCookie = '';
  let testAdmin = null;
  let adminCookie = '';

  let listingApproved1 = null;
  let listingApproved2 = null;
  let listingPending = null;
  let listingOwner2 = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdViewIds = [];
  const createdSaveIds = [];
  const createdRevealIds = [];

  before(async () => {
    adminPb = await getAdminClient();

    // 1. Create Test Owner 1
    testOwner1 = await adminPb.collection('users').create({
      email: `owner1_analytics_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner One',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner1.id);

    const o1Pb = new PocketBase(env.POCKETBASE_URL);
    const o1Auth = await o1Pb.collection('users').authWithPassword(testOwner1.email, testPassword);
    owner1Cookie = `pb_auth=${o1Auth.token}`;

    // 2. Create Test Owner 2 (for cross-owner isolation checks)
    testOwner2 = await adminPb.collection('users').create({
      email: `owner2_analytics_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Owner Two',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner2.id);

    const o2Pb = new PocketBase(env.POCKETBASE_URL);
    const o2Auth = await o2Pb.collection('users').authWithPassword(testOwner2.email, testPassword);
    owner2Cookie = `pb_auth=${o2Auth.token}`;

    // 3. Create Test Customer
    testCustomer = await adminPb.collection('users').create({
      email: `customer_analytics_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Customer One',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomer.id);

    const custPb = new PocketBase(env.POCKETBASE_URL);
    const custAuth = await custPb.collection('users').authWithPassword(testCustomer.email, testPassword);
    customerCookie = `pb_auth=${custAuth.token}`;

    // 4. Create Test Admin
    testAdmin = await adminPb.collection('users').create({
      email: `admin_analytics_${timestamp}_${rand()}@shopfinder.test`,
      password: testPassword,
      passwordConfirm: testPassword,
      name: 'Admin One',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(testAdmin.id);

    const admPb = new PocketBase(env.POCKETBASE_URL);
    const admAuth = await admPb.collection('users').authWithPassword(testAdmin.email, testPassword);
    adminCookie = `pb_auth=${admAuth.token}`;

    // 5. Create Listings for Owner 1
    listingApproved1 = await adminPb.collection('listings').create({
      owner: testOwner1.id,
      title: 'Gulshan High-Rise Retail Space',
      description: 'Prime retail corner location in Gulshan 2 commercial hub.',
      category: 'retail',
      listing_type: 'rent',
      price: 120000,
      area_sqft: 1800,
      address: 'Plot 4, Road 11',
      city: 'Dhaka',
      area: 'Gulshan',
      status: 'approved',
    });
    createdListingIds.push(listingApproved1.id);

    listingApproved2 = await adminPb.collection('listings').create({
      owner: testOwner1.id,
      title: 'Banani Executive Corporate Office',
      description: 'Modern corporate office floor with dedicated reception.',
      category: 'office',
      listing_type: 'rent',
      price: 250000,
      area_sqft: 3500,
      address: 'Kemal Ataturk Avenue',
      city: 'Dhaka',
      area: 'Banani',
      status: 'approved',
    });
    createdListingIds.push(listingApproved2.id);

    listingPending = await adminPb.collection('listings').create({
      owner: testOwner1.id,
      title: 'Tejgaon Industrial Warehouse',
      description: 'Spacious industrial logistics warehouse.',
      category: 'warehouse',
      listing_type: 'rent',
      price: 90000,
      area_sqft: 5000,
      address: 'Tejgaon I/A',
      city: 'Dhaka',
      area: 'Tejgaon',
      status: 'pending',
    });
    createdListingIds.push(listingPending.id);

    // 6. Create Listing for Owner 2
    listingOwner2 = await adminPb.collection('listings').create({
      owner: testOwner2.id,
      title: 'Dhanmondi Diagnostic Center Clinic',
      description: 'Fully equipped medical commercial space in Dhanmondi.',
      category: 'office',
      listing_type: 'rent',
      price: 175000,
      area_sqft: 2800,
      address: 'Road 27',
      city: 'Dhaka',
      area: 'Dhanmondi',
      status: 'approved',
    });
    createdListingIds.push(listingOwner2.id);

    // 7. Start ephemeral Express server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up created views
    for (const id of createdViewIds) {
      try {
        await adminPb.collection('listing_views').delete(id);
      } catch {}
    }

    // Clean up saves
    for (const id of createdSaveIds) {
      try {
        await adminPb.collection('saved_listings').delete(id);
      } catch {}
    }

    // Clean up reveals
    for (const id of createdRevealIds) {
      try {
        await adminPb.collection('revealed_contacts').delete(id);
      } catch {}
    }

    // Clean up listings
    for (const id of createdListingIds) {
      try {
        await adminPb.collection('listings').delete(id);
      } catch {}
    }

    // Clean up users
    for (const id of createdUserIds) {
      try {
        await adminPb.collection('users').delete(id);
      } catch {}
    }
  });

  // --------------------------------------------------------------------------
  // 1. Listing View Tracking & Deduplication Logic
  // --------------------------------------------------------------------------
  describe('Listing View Tracking & Privacy Protection', () => {
    it('hashes IP addresses with SHA-256 and never returns raw IP', () => {
      const rawIp = '192.168.1.100';
      const hashed = hashIp(rawIp);
      assert.notEqual(hashed, rawIp);
      assert.equal(hashed.length, 64, 'SHA-256 hex string must be 64 characters');
      // Deterministic hashing for identical IP
      assert.equal(hashIp(rawIp), hashed);
    });

    it('records view on approved listing viewed by customer', async () => {
      const res = await recordListingView({
        listingId: listingApproved1.id,
        listingOwnerId: testOwner1.id,
        status: 'approved',
        user: { id: testCustomer.id, role: 'customer' },
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      });

      assert.equal(res.recorded, true);
      assert.ok(res.id);
      createdViewIds.push(res.id);

      // Verify in PocketBase
      const record = await adminPb.collection('listing_views').getOne(res.id);
      assert.equal(record.listing, listingApproved1.id);
      assert.equal(record.viewer, testCustomer.id);
      assert.equal(record.ip_hash, hashIp('10.0.0.1'));
    });

    it('deduplicates rapid repeat views by same viewer within 30 minutes', async () => {
      const res = await recordListingView({
        listingId: listingApproved1.id,
        listingOwnerId: testOwner1.id,
        status: 'approved',
        user: { id: testCustomer.id, role: 'customer' },
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      });

      assert.equal(res.recorded, false);
      assert.equal(res.reason, 'deduplicated_auth_viewer');
    });

    it('does NOT record view when owner views their own listing', async () => {
      const res = await recordListingView({
        listingId: listingApproved1.id,
        listingOwnerId: testOwner1.id,
        status: 'approved',
        user: { id: testOwner1.id, role: 'owner' },
        ip: '10.0.0.2',
        userAgent: 'Mozilla/5.0 Owner Browser',
      });

      assert.equal(res.recorded, false);
      assert.equal(res.reason, 'owner_self_view');
    });

    it('does NOT record view when admin inspects a listing', async () => {
      const res = await recordListingView({
        listingId: listingApproved1.id,
        listingOwnerId: testOwner1.id,
        status: 'approved',
        user: { id: testAdmin.id, role: 'admin' },
        ip: '10.0.0.3',
        userAgent: 'Mozilla/5.0 Admin Browser',
      });

      assert.equal(res.recorded, false);
      assert.equal(res.reason, 'admin_preview');
    });

    it('does NOT record view on unapproved (pending) listing', async () => {
      const res = await recordListingView({
        listingId: listingPending.id,
        listingOwnerId: testOwner1.id,
        status: 'pending',
        user: { id: testCustomer.id, role: 'customer' },
        ip: '10.0.0.4',
        userAgent: 'Mozilla/5.0 Test Browser',
      });

      assert.equal(res.recorded, false);
      assert.equal(res.reason, 'unapproved_listing');
    });

    it('records view via public GET /api/v1/listings/:id endpoint integration using socket IP', async () => {
      const res = await fetch(`${baseUrl}/api/v1/listings/${listingApproved2.id}`, {
        headers: {
          'User-Agent': 'TestRunner/1.0',
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.listing.id, listingApproved2.id);

      // Verify listing_views record was created in PocketBase
      const views = await adminPb.collection('listing_views').getList(1, 10, {
        filter: adminPb.filter('listing = {:id}', {
          id: listingApproved2.id,
        }),
      });

      assert.ok(views.items.length >= 1, 'View must be recorded in listing_views collection');
      createdViewIds.push(...views.items.map((i) => i.id));
    });

    it('security regression: ignores spoofed X-Forwarded-For header when trust proxy is disabled', async () => {
      const spoofedIp = '198.51.100.99';
      const res = await fetch(`${baseUrl}/api/v1/listings/${listingApproved2.id}`, {
        headers: {
          'X-Forwarded-For': spoofedIp,
          'User-Agent': 'SpoofTester/1.0',
        },
      });

      assert.equal(res.status, 200);

      // Ensure NO view record exists with the spoofed IP's hash
      const spoofedViews = await adminPb.collection('listing_views').getList(1, 1, {
        filter: adminPb.filter('listing = {:id} && ip_hash = {:hash}', {
          id: listingApproved2.id,
          hash: hashIp(spoofedIp),
        }),
      });

      assert.equal(
        spoofedViews.items.length,
        0,
        'Recorded ip_hash must NEVER match client-spoofed X-Forwarded-For header while trust proxy is disabled'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. Authentication, Authorization & Cross-Owner Isolation
  // --------------------------------------------------------------------------
  describe('Owner Analytics Authorization & Scoping', () => {
    it('returns HTTP 401 when unauthenticated visitor calls GET /api/v1/owner/analytics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('returns HTTP 403 when customer role calls GET /api/v1/owner/analytics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics`, {
        headers: { Cookie: customerCookie },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('returns HTTP 403 when admin role calls GET /api/v1/owner/analytics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics`, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('returns HTTP 200 when authenticated owner calls GET /api/v1/owner/analytics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics`, {
        headers: { Cookie: owner1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.summary);
      assert.ok(Array.isArray(data.data.daily_engagement));
      assert.ok(Array.isArray(data.data.listings));
    });

    it('enforces cross-owner isolation: Owner 1 cannot query Owner 2 listing (returns 404)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics?listingId=${listingOwner2.id}`, {
        headers: { Cookie: owner1Cookie },
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    it('rejects invalid period parameter with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics?period=99days`, {
        headers: { Cookie: owner1Cookie },
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.message.includes('Invalid period'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Metric Calculations, Conversion Rates & Time Boundaries
  // --------------------------------------------------------------------------
  describe('Authoritative Metric Calculations & Conversion Rates', () => {
    before(async () => {
      // Seed an inquiry / reveal for Owner 1 listingApproved1
      const reveal = await adminPb.collection('revealed_contacts').create({
        customer: testCustomer.id,
        listing: listingApproved1.id,
        owner: testOwner1.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(reveal.id);

      // Seed a bookmark / save for Owner 1 listingApproved1
      const save = await adminPb.collection('saved_listings').create({
        customer: testCustomer.id,
        listing: listingApproved1.id,
        saved_at: new Date().toISOString(),
      });
      createdSaveIds.push(save.id);
    });

    it('computes accurate aggregate metrics and conversion rate', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics?period=7d`, {
        headers: { Cookie: owner1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const analytics = data.data;

      assert.equal(analytics.period, '7d');
      assert.equal(analytics.daily_engagement.length, 7, '7d period must return exactly 7 daily items');

      // Check summary
      assert.ok(analytics.summary.total_views >= 1);
      assert.ok(analytics.summary.total_reveals >= 1);
      assert.ok(analytics.summary.total_favorites >= 1);
      assert.ok(analytics.summary.conversion_rate > 0);

      // Verify math: (reveals / views) * 100
      const expectedRate = Number(
        ((analytics.summary.total_reveals / analytics.summary.total_views) * 100).toFixed(1)
      );
      assert.equal(analytics.summary.conversion_rate, expectedRate);
    });

    it('handles 30-day period with 30 daily data points', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics?period=30d`, {
        headers: { Cookie: owner1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.period, '30d');
      assert.equal(data.data.daily_engagement.length, 30);
    });

    it('handles zero-view listings gracefully with 0.0 conversion rate (no NaN)', async () => {
      // Owner 2 has a listing with 0 views, 0 reveals
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics?period=7d`, {
        headers: { Cookie: owner2Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const analytics = data.data;

      assert.equal(analytics.summary.total_views, 0);
      assert.equal(analytics.summary.total_reveals, 0);
      assert.equal(analytics.summary.conversion_rate, 0.0);

      const listing = analytics.listings.find((l) => l.id === listingOwner2.id);
      assert.ok(listing);
      assert.equal(listing.views, 0);
      assert.equal(listing.reveals, 0);
      assert.equal(listing.conversion_rate, 0.0);
    });

    it('D-014 Privacy Audit: response contains zero private phone numbers or customer identities', async () => {
      const res = await fetch(`${baseUrl}/api/v1/owner/analytics`, {
        headers: { Cookie: owner1Cookie },
      });
      const text = await res.text();

      assert.ok(!text.includes('phone'), 'Analytics response must never contain phone property');
      assert.ok(!text.includes('017'), 'Analytics response must not leak phone numbers');
      assert.ok(!text.includes(testCustomer.email), 'Customer emails must not be exposed');
    });
  });
});
