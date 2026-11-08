/**
 * ShopFinder — Secure Owner Phone Retrieval Hook (D-014, D-017)
 * Phase 10, Task 10.6
 *
 * Implements private internal route for secure owner phone retrieval
 * strictly for authenticated customers who have an existing reveal record
 * for the requested listing.
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Restricted exclusively to PocketBase Superusers via $apis.requireSuperuserAuth().
 * 2. Inaccessible to anonymous and ordinary authenticated users (HTTP 401/403).
 * 3. Never called directly by browser clients (D-007); mediated exclusively by Express.
 * 4. Customer identity is derived via Trusted Express Delegation (D-017) and independently
 *    validated by PocketBase in users collection (role === 'customer', is_active === true).
 * 5. Requires an existing revealed_contacts record for BOTH customer = customerId AND listing = listingId.
 *    Customer can NEVER retrieve another customer's revealed contact or an unrevealed listing.
 * 6. Listing existence and owner relationship are verified against listings and users.
 * 7. Phone is retrieved exclusively from private owner_contacts (D-014).
 * 8. Never logs phone numbers or exposes internal PocketBase records.
 */

routerAdd("POST", "/api/custom/contact-retrieval", (e) => {
  const body = e.requestInfo().body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Invalid payload: request body must be a valid JSON object.");
  }

  const rawCustomerId = body.customerId;
  if (!rawCustomerId || typeof rawCustomerId !== "string" || String(rawCustomerId).trim() === "") {
    throw new BadRequestError("customerId is required and must be a non-empty string.");
  }

  const rawListingId = body.listingId;
  if (!rawListingId || typeof rawListingId !== "string" || String(rawListingId).trim() === "") {
    throw new BadRequestError("listingId is required and must be a non-empty string.");
  }

  const customerId = String(rawCustomerId).trim();
  const listingId = String(rawListingId).trim();

  // 1. Validate customer account
  let customerRecord = null;
  try {
    customerRecord = $app.findRecordById("users", customerId);
  } catch (err) {
    throw new NotFoundError("Customer account not found.");
  }

  if (!customerRecord) {
    throw new NotFoundError("Customer account not found.");
  }

  if (customerRecord.get("role") !== "customer") {
    throw new BadRequestError("Target user is not an authorized customer.");
  }

  // Active status verification: strictly require is_active === true (rejects false, null, undefined, missing)
  if (customerRecord.get("is_active") !== true) {
    throw new BadRequestError("Customer account is deactivated.");
  }

  // 2. Validate listing record
  let listingRecord = null;
  try {
    listingRecord = $app.findRecordById("listings", listingId);
  } catch (err) {
    throw new NotFoundError("Listing not found.");
  }

  if (!listingRecord) {
    throw new NotFoundError("Listing not found.");
  }

  const rawOwnerId = listingRecord.get("owner");
  if (!rawOwnerId || typeof rawOwnerId !== "string" || String(rawOwnerId).trim() === "") {
    throw new BadRequestError("Listing does not have a valid owner relation.");
  }
  const ownerId = String(rawOwnerId).trim();

  // Validate owner account in users: strictly require role === 'owner' && is_active === true
  let ownerRecord = null;
  try {
    ownerRecord = $app.findRecordById("users", ownerId);
  } catch (err) {
    throw new BadRequestError("Listing owner account not found.");
  }

  if (!ownerRecord || ownerRecord.get("role") !== "owner" || ownerRecord.get("is_active") !== true) {
    throw new BadRequestError("Listing owner is invalid or inactive.");
  }

  // 3. Verify reveal record existence for exact (customer, listing) pair
  let revealRecord = null;
  try {
    revealRecord = $app.findFirstRecordByFilter(
      "revealed_contacts",
      "customer = {:customer} && listing = {:listing}",
      { customer: customerRecord.id, listing: listingRecord.id }
    );
  } catch (err) {
    revealRecord = null;
  }

  if (!revealRecord) {
    throw new ForbiddenError("Contact has not been revealed by this customer.");
  }

  // Verify that reveal record owner matches listing owner
  if (revealRecord.get("owner") !== ownerRecord.id) {
    throw new BadRequestError("Reveal record owner relation mismatch.");
  }

  // 4. Retrieve private phone number from owner_contacts (D-014)
  let contactRecord = null;
  try {
    contactRecord = $app.findFirstRecordByFilter(
      "owner_contacts",
      "owner = {:owner}",
      { owner: ownerRecord.id }
    );
  } catch (err) {
    contactRecord = null;
  }

  if (!contactRecord || !contactRecord.get("phone")) {
    throw new NotFoundError("Owner contact information is unavailable.");
  }

  const phone = contactRecord.get("phone");

  // 5. Return minimal, safe structured response (Never log phone)
  return e.json(200, {
    success: true,
    message: "Owner contact retrieved successfully.",
    data: {
      status: "contact_retrieved",
      listingId: listingRecord.id,
      ownerId: ownerRecord.id,
      phone: phone,
    },
  });
}, $apis.requireSuperuserAuth());

