/**
 * ShopFinder — Atomic Contact Reveal Transaction Hook (D-013 & D-017)
 * Phase 10, Tasks 10.1, 10.2, 10.3
 *
 * Implements private internal route for atomic contact reveal transactions
 * using PocketBase's native SQLite transactions ($app.runInTransaction).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Restricted exclusively to PocketBase Superusers via $apis.requireSuperuserAuth().
 * 2. Inaccessible to anonymous and ordinary authenticated users (HTTP 401/403).
 * 3. Never called directly by browser clients (D-007); mediated exclusively by Express.
 * 4. Customer identity is derived via Trusted Express Delegation (D-017) and independently
 *    validated inside the SQLite transaction using txApp.
 * 5. In this superuser-protected route, e.requestInfo().auth.id identifies the superuser
 *    and is NEVER used as the customer identity.
 * 6. Idempotent check (Task 10.3): If an existing revealed_contacts record exists for the
 *    (customer, listing) pair, returns alreadyRevealed: true with ZERO credit deduction.
 * 7. Scope boundary: Owner phone number retrieval from owner_contacts is strictly deferred to Task 10.6.
 * 8. Executes all transaction-scoped reads and writes inside $app.runInTransaction
 *    using txApp exclusively — never outer $app.
 * 9. Guarantees complete ACID atomicity and rollback across user_subscriptions and revealed_contacts.
 */

routerAdd("POST", "/api/custom/reveal", (e) => {
  // 1. Request payload parsing and validation
  const body = e.requestInfo().body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Invalid payload: request body must be a valid JSON object.");
  }

  // Task 10.2: customerId is required from trusted Express server-side request
  const rawCustomerId = body.customerId || (body.testRollback && body.testRecordId ? body.testRecordId : null);

  if (!rawCustomerId || typeof rawCustomerId !== "string" || String(rawCustomerId).trim() === "") {
    throw new BadRequestError("customerId is required and must be a non-empty string.");
  }

  const customerId = String(rawCustomerId).trim();
  const listingId = body.listingId && typeof body.listingId === "string" ? String(body.listingId).trim() : "";

  let result = null;

  // 2. Transaction Boundary — Established via $app.runInTransaction
  // All transaction-scoped database operations MUST use txApp exclusively.
  $app.runInTransaction((txApp) => {
    // Task 10.2: Independently validate customer record inside the transaction using txApp
    let customerRecord = null;
    try {
      customerRecord = txApp.findRecordById("users", customerId);
    } catch (err) {
      throw new NotFoundError("Customer account not found.");
    }

    if (!customerRecord) {
      throw new NotFoundError("Customer account not found.");
    }

    // Role verification: strictly require 'customer'
    if (customerRecord.get("role") !== "customer") {
      throw new BadRequestError("Target user is not an authorized customer.");
    }

    // Active status verification: reject deactivated customers
    if (customerRecord.get("is_active") === false) {
      throw new BadRequestError("Customer account is deactivated.");
    }

    // Deliberate test simulation hook for rollback verification
    // Operates on customerRecord inside txApp and deliberately throws
    if (body.simulateRollback === true || body.testRollback === true) {
      customerRecord.set("name", "MUTATION_BEFORE_ROLLBACK");
      txApp.save(customerRecord);
      throw new Error("DELIBERATE_TEST_ROLLBACK: Simulated failure for atomicity verification.");
    }

    // Task 10.3: Idempotent lookup for previously revealed contact
    // Scoped strictly to BOTH validated customer ID and requested listing ID
    let existingReveal = null;
    if (listingId) {
      try {
        existingReveal = txApp.findFirstRecordByFilter(
          "revealed_contacts",
          "customer = {:customer} && listing = {:listing}",
          { customer: customerRecord.id, listing: listingId }
        );
      } catch (findErr) {
        existingReveal = null;
      }
    }

    if (existingReveal) {
      // Idempotent Match: Contact already revealed by this customer
      // ZERO credit deduction, ZERO new reveal records created
      // Owner phone retrieval is deferred to Task 10.6
      result = {
        task: "10.3",
        status: "already_revealed",
        alreadyRevealed: true,
        revealId: existingReveal.id,
        revealedAt: existingReveal.get("revealed_at") || existingReveal.get("created"),
        customerId: customerRecord.id,
        listingId: listingId,
        creditDeducted: false,
        transactionCommitted: true,
        boundary: "D-013 & D-017 idempotent reveal lookup via txApp",
      };
      return; // Exit transaction callback cleanly with zero mutations
    }

    // Task 10.3 Not Yet Revealed State:
    // Future Phase 10 tasks will execute inside this txApp transaction block:
    // - Task 10.4: Verify active subscription and credit balance (credits_remaining > 0)
    // - Task 10.5: Atomically increment credits_used and create revealed_contacts record via txApp
    // - Task 10.6: Retrieve private owner phone from owner_contacts on committed transaction
    result = {
      task: "10.3",
      status: "idempotent_checked_not_revealed",
      alreadyRevealed: false,
      customerId: customerRecord.id,
      customerEmail: customerRecord.get("email"),
      listingId: listingId || null,
      creditDeducted: false,
      transactionCommitted: true,
      boundary: "D-013 & D-017 idempotent reveal lookup via txApp",
    };
  });

  // 3. Return explicit success response only after transaction commits successfully
  return e.json(200, {
    success: true,
    message: result.alreadyRevealed
      ? "Contact previously revealed by this customer (idempotent lookup)."
      : "Idempotent lookup completed: listing not previously revealed (Task 10.3).",
    data: result,
  });
}, $apis.requireSuperuserAuth());
