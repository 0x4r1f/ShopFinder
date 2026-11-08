import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminClient } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';
import {
  getRevealedOwnerContact,
  rejectClientContactOverrides,
  getTrustedCustomerId,
} from '../src/services/revealService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const hookFilePath = path.join(rootDir, 'pocketbase', 'pb_hooks', 'contact_retrieval.pb.js');

describe('Phase 10, Task 10.6 — Secure Owner Phone Retrieval (D-014 & D-017)', () => {
  let adminPb = null;
  let superuserToken = null;
  const customRetrievalUrl = `${env.POCKETBASE_URL}/api/custom/contact-retrieval`;

  let testOwner1 = null;
  let testOwner2 = null;
  let testOwnerNoPhone = null;

  let ownerContact1 = null;
  let ownerContact2 = null;

  let testListing1 = null;
  let testListing2 = null;
  let testListing3 = null;
  let testListingNoPhone = null;

  let testCustomerA = null;
  let testCustomerB = null;
  let testCustomerInactive = null;
  let testAdmin = null;

  let revealA1 = null;
  let revealB3 = null;

  const createdUserIds = [];
  const createdListingIds = [];
  const createdContactIds = [];
  const createdRevealIds = [];

  const rand = () => Math.random().toString(36).slice(2, 6);

  before(async () => {
    adminPb = await getAdminClient();
    superuserToken = adminPb.authStore.token;

    const timestamp = Date.now();

    // 1. Create commercial owners
    testOwner1 = await adminPb.collection('users').create({
      email: `test.owner1.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Owner One',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner1.id);

    ownerContact1 = await adminPb.collection('owner_contacts').create({
      owner: testOwner1.id,
      phone: '+8801711111111',
    });
    createdContactIds.push(ownerContact1.id);

    testOwner2 = await adminPb.collection('users').create({
      email: `test.owner2.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Owner Two',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwner2.id);

    ownerContact2 = await adminPb.collection('owner_contacts').create({
      owner: testOwner2.id,
      phone: '+8801822222222',
    });
    createdContactIds.push(ownerContact2.id);

    testOwnerNoPhone = await adminPb.collection('users').create({
      email: `test.owner.nophone.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Owner No Phone',
      role: 'owner',
      is_active: true,
    });
    createdUserIds.push(testOwnerNoPhone.id);

    // 2. Create listings
    testListing1 = await adminPb.collection('listings').create({
      title: `Listing 1 ${timestamp}`,
      description: 'First listing for owner 1',
      price: 35000,
      area_sqft: 600,
      address: '10 Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(testListing1.id);

    testListing2 = await adminPb.collection('listings').create({
      title: `Listing 2 ${timestamp}`,
      description: 'Second listing for owner 1 (unrevealed by Customer A)',
      price: 45000,
      area_sqft: 800,
      address: '20 Road, Dhanmondi',
      city: 'Dhaka',
      area: 'Dhanmondi',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner1.id,
    });
    createdListingIds.push(testListing2.id);

    testListing3 = await adminPb.collection('listings').create({
      title: `Listing 3 ${timestamp}`,
      description: 'Listing for owner 2',
      price: 55000,
      area_sqft: 950,
      address: '30 Road, Gulshan',
      city: 'Dhaka',
      area: 'Gulshan',
      category: 'office',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwner2.id,
    });
    createdListingIds.push(testListing3.id);

    testListingNoPhone = await adminPb.collection('listings').create({
      title: `Listing No Phone ${timestamp}`,
      description: 'Listing whose owner has no phone contact record',
      price: 25000,
      area_sqft: 400,
      address: '40 Road, Banani',
      city: 'Dhaka',
      area: 'Banani',
      category: 'retail',
      listing_type: 'rent',
      status: 'approved',
      owner: testOwnerNoPhone.id,
    });
    createdListingIds.push(testListingNoPhone.id);

    // 3. Create customers and admin
    testCustomerA = await adminPb.collection('users').create({
      email: `test.cust.a.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer A',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomerA.id);

    testCustomerB = await adminPb.collection('users').create({
      email: `test.cust.b.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer B',
      role: 'customer',
      is_active: true,
    });
    createdUserIds.push(testCustomerB.id);

    testCustomerInactive = await adminPb.collection('users').create({
      email: `test.cust.inact.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Customer Inactive',
      role: 'customer',
      is_active: false,
    });
    createdUserIds.push(testCustomerInactive.id);

    testAdmin = await adminPb.collection('users').create({
      email: `test.admin.10_6.${timestamp}.${rand()}@shopfinder.test`,
      password: 'TestPassword123!',
      passwordConfirm: 'TestPassword123!',
      name: 'Admin User',
      role: 'admin',
      is_active: true,
    });
    createdUserIds.push(testAdmin.id);

    // 4. Create reveal records:
    // Customer A has revealed Listing 1
    revealA1 = await adminPb.collection('revealed_contacts').create({
      customer: testCustomerA.id,
      listing: testListing1.id,
      owner: testOwner1.id,
      revealed_at: new Date().toISOString(),
    });
    createdRevealIds.push(revealA1.id);

    // Customer B has revealed Listing 3
    revealB3 = await adminPb.collection('revealed_contacts').create({
      customer: testCustomerB.id,
      listing: testListing3.id,
      owner: testOwner2.id,
      revealed_at: new Date().toISOString(),
    });
    createdRevealIds.push(revealB3.id);

    // Customer A has revealed testListingNoPhone (for missing phone test)
    const revealANoPhone = await adminPb.collection('revealed_contacts').create({
      customer: testCustomerA.id,
      listing: testListingNoPhone.id,
      owner: testOwnerNoPhone.id,
      revealed_at: new Date().toISOString(),
    });
    createdRevealIds.push(revealANoPhone.id);
  });

  after(async () => {
    if (adminPb) {
      for (const id of createdRevealIds) {
        try {
          await adminPb.collection('revealed_contacts').delete(id);
        } catch {}
      }
      for (const id of createdContactIds) {
        try {
          await adminPb.collection('owner_contacts').delete(id);
        } catch {}
      }
      for (const id of createdListingIds) {
        try {
          await adminPb.collection('listings').delete(id);
        } catch {}
      }
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {}
      }
    }
  });

  // =========================================================================
  // 1. Authorized Owner Phone Retrieval (Tests 1–5)
  // =========================================================================
  describe('1. Authorized Owner Phone Retrieval (D-014 & D-017)', () => {
    test('1. Authenticated customer with a matching reveal record can retrieve the correct owner phone', async () => {
      const res = await getRevealedOwnerContact({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.status, 'contact_retrieved');
      assert.strictEqual(res.data.listingId, testListing1.id);
      assert.strictEqual(res.data.ownerId, testOwner1.id);
      assert.strictEqual(res.data.phone, '+8801711111111');
    });

    test('2. Customer without a reveal record is denied with HTTP 403 Forbidden', async () => {
      // Customer B has NOT revealed Listing 1
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerB.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.match(err.message, /not been revealed/i);
          return true;
        }
      );
    });

    test("3. Customer cannot retrieve another customer's reveal", async () => {
      // Customer B revealed Listing 3, Customer A did NOT
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: testListing3.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.match(err.message, /not been revealed/i);
          return true;
        }
      );
    });

    test('4. Same customer cannot retrieve a phone for a different unrevealed listing', async () => {
      // Customer A revealed Listing 1 (same owner), but did NOT reveal Listing 2
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: testListing2.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    test('5. Different listing owner phone is never returned', async () => {
      // Customer B retrieves phone for Listing 3 -> gets Owner 2's phone (+8801822222222), never Owner 1
      const res = await getRevealedOwnerContact({
        customerId: testCustomerB.id,
        listingId: testListing3.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.ownerId, testOwner2.id);
      assert.strictEqual(res.data.phone, '+8801822222222');
      assert.notStrictEqual(res.data.phone, '+8801711111111');
    });
  });

  // =========================================================================
  // 2. Identity & Parameter Override Protection (Tests 6–10)
  // =========================================================================
  describe('2. Identity Delegation & Override Protection (D-017)', () => {
    test('6. Browser-supplied customerId is rejected by Express middleware', () => {
      const mockReq = {
        user: { id: testCustomerA.id, role: 'customer' },
        body: { customerId: 'attacker-id' },
      };

      let rejectedStatus = null;
      let errorMessage = null;
      const mockRes = {
        status(s) {
          rejectedStatus = s;
          return this;
        },
        json(j) {
          errorMessage = j.error?.message || j.message;
          return j;
        },
      };

      rejectClientContactOverrides(mockReq, mockRes, () => {});
      assert.strictEqual(rejectedStatus, 400);
      assert.match(errorMessage, /customerId is strictly prohibited/i);

      assert.throws(
        () => getTrustedCustomerId(mockReq),
        (err) => err.status === 400
      );
    });

    test('7. Browser-supplied ownerId is rejected by Express middleware', () => {
      const mockReq = {
        user: { id: testCustomerA.id, role: 'customer' },
        body: { ownerId: 'injected-owner-id' },
      };

      let rejectedStatus = null;
      let errorMessage = null;
      const mockRes = {
        status(s) {
          rejectedStatus = s;
          return this;
        },
        json(j) {
          errorMessage = j.error?.message || j.message;
          return j;
        },
      };

      rejectClientContactOverrides(mockReq, mockRes, () => {});
      assert.strictEqual(rejectedStatus, 400);
      assert.match(errorMessage, /ownerId is prohibited/i);
    });

    test('8. Browser-supplied phone is rejected by Express middleware', () => {
      const mockReq = {
        user: { id: testCustomerA.id, role: 'customer' },
        body: { phone: '+8801999999999' },
      };

      let rejectedStatus = null;
      let errorMessage = null;
      const mockRes = {
        status(s) {
          rejectedStatus = s;
          return this;
        },
        json(j) {
          errorMessage = j.error?.message || j.message;
          return j;
        },
      };

      rejectClientContactOverrides(mockReq, mockRes, () => {});
      assert.strictEqual(rejectedStatus, 400);
      assert.match(errorMessage, /phone is prohibited/i);
    });

    test('9. Owner account cannot use the customer retrieval operation', async () => {
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testOwner1.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /not an authorized customer/i);
          return true;
        }
      );
    });

    test('10. Admin account cannot use the customer retrieval operation', async () => {
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testAdmin.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /not an authorized customer/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Authorization Boundaries & Error Handling (Tests 11–15)
  // =========================================================================
  describe('3. Authorization Boundaries & Error Handling', () => {
    test('11. Anonymous access directly to PocketBase custom route is denied with HTTP 401', async () => {
      const res = await fetch(customRetrievalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomerA.id,
          listingId: testListing1.id,
        }),
      });

      assert.strictEqual(res.status, 401, 'Anonymous request must receive HTTP 401');
    });

    test('12. Inactive customer is denied with HTTP 400', async () => {
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerInactive.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );
    });

    test('13. Invalid listing is rejected with HTTP 404', async () => {
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: 'nonexistentlisting123',
          });
        },
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.match(err.message, /listing not found/i);
          return true;
        }
      );
    });

    test('14. Invalid owner relationship is rejected', async () => {
      // Listing with nonexistent owner
      const orphanListing = await adminPb.collection('listings').create({
        title: 'Orphan Listing',
        description: 'Listing with invalid owner',
        price: 30000,
        area_sqft: 500,
        address: '50 Road, Dhaka',
        city: 'Dhaka',
        area: 'Dhanmondi',
        category: 'retail',
        listing_type: 'rent',
        status: 'approved',
        owner: testCustomerInactive.id, // Not an owner
      });
      createdListingIds.push(orphanListing.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: orphanListing.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /owner is invalid/i);
          return true;
        }
      );
    });

    test('15. Missing owner_contacts record returns a controlled HTTP 404 error', async () => {
      // testCustomerA has revealed testListingNoPhone, but testOwnerNoPhone has no record in owner_contacts
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: testListingNoPhone.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 404);
          assert.match(err.message, /contact information is unavailable/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3b. Strict Active-Account Status Verification (is_active === true)
  // =========================================================================
  describe('3b. Strict Active-Account Status Verification (is_active === true)', () => {
    test('1. Active customer (true) is accepted', async () => {
      const res = await getRevealedOwnerContact({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.phone, '+8801711111111');
    });

    test('2. Inactive customer (false) is rejected with HTTP 400', async () => {
      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerInactive.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );
    });

    test('3. Customer with missing/null active status is rejected with HTTP 400', async () => {
      const timestamp = Date.now();
      // Create customer and update is_active to null
      const custNull = await adminPb.collection('users').create({
        email: `test.cust.null.${timestamp}.${rand()}@shopfinder.test`,
        password: 'TestPassword123!',
        passwordConfirm: 'TestPassword123!',
        name: 'Customer Null Active',
        role: 'customer',
        is_active: false,
      });
      createdUserIds.push(custNull.id);

      await adminPb.collection('users').update(custNull.id, { is_active: null });

      // Create reveal record for this customer on testListing1
      const revNull = await adminPb.collection('revealed_contacts').create({
        customer: custNull.id,
        listing: testListing1.id,
        owner: testOwner1.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(revNull.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: custNull.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );
    });

    test('3b. Customer record with is_active absent or undefined must be rejected', async () => {
      const timestamp = Date.now();
      // Create customer with cleared/unset active state
      const custUndef = await adminPb.collection('users').create({
        email: `test.cust.undef.${timestamp}.${rand()}@shopfinder.test`,
        password: 'TestPassword123!',
        passwordConfirm: 'TestPassword123!',
        name: 'Customer Undefined Active',
        role: 'customer',
        is_active: false,
      });
      createdUserIds.push(custUndef.id);

      await adminPb.collection('users').update(custUndef.id, { is_active: null });

      const revUndef = await adminPb.collection('revealed_contacts').create({
        customer: custUndef.id,
        listing: testListing1.id,
        owner: testOwner1.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(revUndef.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: custUndef.id,
            listingId: testListing1.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /deactivated/i);
          return true;
        }
      );

      // Static code invariant: hook must strictly require is_active !== true
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /customerRecord\.get\(["']is_active["']\)\s*!==\s*true/,
        'Hook must strictly check is_active !== true for customer'
      );
    });

    test('4. Active owner (true) is accepted', async () => {
      // testOwner1 has is_active === true and testCustomerA has revealed testListing1
      const res = await getRevealedOwnerContact({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.ownerId, testOwner1.id);
    });

    test('5. Inactive owner (false) is rejected with HTTP 400', async () => {
      const timestamp = Date.now();
      const ownerInactive = await adminPb.collection('users').create({
        email: `test.owner.inact.${timestamp}.${rand()}@shopfinder.test`,
        password: 'TestPassword123!',
        passwordConfirm: 'TestPassword123!',
        name: 'Inactive Owner',
        role: 'owner',
        is_active: false,
      });
      createdUserIds.push(ownerInactive.id);

      const contactInactive = await adminPb.collection('owner_contacts').create({
        owner: ownerInactive.id,
        phone: '+8801933333333',
      });
      createdContactIds.push(contactInactive.id);

      const listingInactiveOwner = await adminPb.collection('listings').create({
        title: `Listing Inactive Owner ${timestamp}`,
        description: 'Listing with inactive owner',
        price: 35000,
        area_sqft: 600,
        address: '60 Road, Dhaka',
        city: 'Dhaka',
        area: 'Dhanmondi',
        category: 'retail',
        listing_type: 'rent',
        status: 'approved',
        owner: ownerInactive.id,
      });
      createdListingIds.push(listingInactiveOwner.id);

      const rev = await adminPb.collection('revealed_contacts').create({
        customer: testCustomerA.id,
        listing: listingInactiveOwner.id,
        owner: ownerInactive.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(rev.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: listingInactiveOwner.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /owner is invalid or inactive/i);
          return true;
        }
      );
    });

    test('6. Owner with missing/null active status is rejected with HTTP 400', async () => {
      const timestamp = Date.now();
      const ownerNull = await adminPb.collection('users').create({
        email: `test.owner.null.${timestamp}.${rand()}@shopfinder.test`,
        password: 'TestPassword123!',
        passwordConfirm: 'TestPassword123!',
        name: 'Null Active Owner',
        role: 'owner',
        is_active: false,
      });
      createdUserIds.push(ownerNull.id);

      await adminPb.collection('users').update(ownerNull.id, { is_active: null });

      const contactNull = await adminPb.collection('owner_contacts').create({
        owner: ownerNull.id,
        phone: '+8801944444444',
      });
      createdContactIds.push(contactNull.id);

      const listingNullOwner = await adminPb.collection('listings').create({
        title: `Listing Null Active Owner ${timestamp}`,
        description: 'Listing with null active owner',
        price: 35000,
        area_sqft: 600,
        address: '70 Road, Dhaka',
        city: 'Dhaka',
        area: 'Dhanmondi',
        category: 'retail',
        listing_type: 'rent',
        status: 'approved',
        owner: ownerNull.id,
      });
      createdListingIds.push(listingNullOwner.id);

      const rev = await adminPb.collection('revealed_contacts').create({
        customer: testCustomerA.id,
        listing: listingNullOwner.id,
        owner: ownerNull.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(rev.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: listingNullOwner.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /owner is invalid or inactive/i);
          return true;
        }
      );
    });

    test('6b. Owner record with is_active absent or undefined must be rejected', async () => {
      const timestamp = Date.now();
      const ownerUndef = await adminPb.collection('users').create({
        email: `test.owner.undef.${timestamp}.${rand()}@shopfinder.test`,
        password: 'TestPassword123!',
        passwordConfirm: 'TestPassword123!',
        name: 'Undef Active Owner',
        role: 'owner',
        is_active: false,
      });
      createdUserIds.push(ownerUndef.id);

      await adminPb.collection('users').update(ownerUndef.id, { is_active: null });

      const contactUndef = await adminPb.collection('owner_contacts').create({
        owner: ownerUndef.id,
        phone: '+8801966666666',
      });
      createdContactIds.push(contactUndef.id);

      const listingUndefOwner = await adminPb.collection('listings').create({
        title: `Listing Undef Active Owner ${timestamp}`,
        description: 'Listing with undefined active owner',
        price: 35000,
        area_sqft: 600,
        address: '90 Road, Dhaka',
        city: 'Dhaka',
        area: 'Dhanmondi',
        category: 'retail',
        listing_type: 'rent',
        status: 'approved',
        owner: ownerUndef.id,
      });
      createdListingIds.push(listingUndefOwner.id);

      const rev = await adminPb.collection('revealed_contacts').create({
        customer: testCustomerA.id,
        listing: listingUndefOwner.id,
        owner: ownerUndef.id,
        revealed_at: new Date().toISOString(),
      });
      createdRevealIds.push(rev.id);

      await assert.rejects(
        async () => {
          await getRevealedOwnerContact({
            customerId: testCustomerA.id,
            listingId: listingUndefOwner.id,
          });
        },
        (err) => {
          assert.strictEqual(err.status, 400);
          assert.match(err.message, /owner is invalid or inactive/i);
          return true;
        }
      );

      // Static code invariant: hook must strictly require is_active !== true
      const content = fs.readFileSync(hookFilePath, 'utf8');
      assert.match(
        content,
        /ownerRecord\.get\(["']is_active["']\)\s*!==\s*true/,
        'Hook must strictly check is_active !== true for owner'
      );
    });
  });

  // =========================================================================
  // 4. Privacy, Schema & Security Invariants (Tests 16–21)
  // =========================================================================
  describe('4. Privacy, Schema & Security Invariants (D-014)', () => {
    test('16. Owner phone is sourced exclusively from owner_contacts', async () => {
      const res = await getRevealedOwnerContact({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      // Directly verify that this phone matches the owner_contacts record
      const dbContact = await adminPb.collection('owner_contacts').getOne(ownerContact1.id);
      assert.strictEqual(res.data.phone, dbContact.phone);

      // Verify that phone does NOT exist on the users record
      const dbOwner = await adminPb.collection('users').getOne(testOwner1.id);
      assert.strictEqual(dbOwner.phone, undefined);
    });

    test('17. Phone is not included in public listing responses', async () => {
      const listing = await adminPb.collection('listings').getOne(testListing1.id, {
        expand: 'owner',
      });

      assert.strictEqual(listing.phone, undefined);
      assert.strictEqual(listing.expand?.owner?.phone, undefined);
    });

    test('18. Phone is not included in public user responses', async () => {
      const user = await adminPb.collection('users').getOne(testOwner1.id);
      assert.strictEqual(user.phone, undefined);
    });

    test('19. owner_contacts collection access rules remain strictly deny-all (null)', async () => {
      const collection = await adminPb.collections.getOne('owner_contacts');
      assert.strictEqual(collection.listRule, null, 'listRule must be null');
      assert.strictEqual(collection.viewRule, null, 'viewRule must be null');
      assert.strictEqual(collection.createRule, null, 'createRule must be null');
      assert.strictEqual(collection.updateRule, null, 'updateRule must be null');
      assert.strictEqual(collection.deleteRule, null, 'deleteRule must be null');
    });

    test('20. PocketBase superuser credentials never appear in client responses', async () => {
      const res = await getRevealedOwnerContact({
        customerId: testCustomerA.id,
        listingId: testListing1.id,
      });

      const serialized = JSON.stringify(res);
      assert.doesNotMatch(serialized, /pb_data|admin|superuser|token|secret|password/i);
    });

    test('21. Existing Task 10.1–10.5 behavior remains unchanged and contact retrieval deducts ZERO credits', async () => {
      // In Task 10.6, retrieving the phone number MUST NOT deduct any credits
      // Check customer A's subscriptions
      const subsBefore = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:u}', { u: testCustomerA.id }),
      });

      // Perform retrieval multiple times
      await getRevealedOwnerContact({ customerId: testCustomerA.id, listingId: testListing1.id });
      await getRevealedOwnerContact({ customerId: testCustomerA.id, listingId: testListing1.id });

      const subsAfter = await adminPb.collection('user_subscriptions').getFullList({
        filter: adminPb.filter('user = {:u}', { u: testCustomerA.id }),
      });

      // No new subscriptions created or existing ones touched
      assert.strictEqual(subsBefore.length, subsAfter.length);
    });
  });
});
