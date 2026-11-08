/**
 * ShopFinder — Atomic Contact Reveal Transaction Hook (D-013 & D-017)
 * Phase 10, Tasks 10.1, 10.2, 10.3, 10.4
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
 * 7. Active Subscription & Credit Verification (Task 10.4): If no previous reveal exists,
 *    aggregates remaining credits across active packages (D-001). Aborts with transaction rollback
 *    if credits_remaining <= 0 (HTTP 402). Verification-only; zero deduction in Task 10.4.
 * 8. Scope boundary: Owner phone number retrieval from owner_contacts is strictly deferred to Task 10.6.
 * 9. Executes all transaction-scoped reads and writes inside $app.runInTransaction
 *    using txApp exclusively — never outer $app.
 * 10. Guarantees complete ACID atomicity and rollback across user_subscriptions and revealed_contacts.
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
  let customerRecord = null;

  // 2. Transaction Boundary — Established via $app.runInTransaction
  // All transaction-scoped database operations MUST use txApp exclusively.
  try {
    $app.runInTransaction((txApp) => {
      // Step 1 & 2: Independently validate customer record inside transaction using txApp
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

      // Step 3 & 4: Task 10.3 Idempotent lookup for previously revealed contact
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
          task: "10.4",
          status: "already_revealed",
          alreadyRevealed: true,
          revealId: existingReveal.id,
          revealedAt: existingReveal.get("revealed_at") || existingReveal.get("created"),
          customerId: customerRecord.id,
          listingId: listingId,
          creditsRemaining: null, // Zero credits required/checked for previously revealed contacts
          creditDeducted: false,
          revealCreated: false,
          transactionCommitted: true,
          boundary: "D-013 & D-017 idempotent reveal lookup via txApp",
        };
        return; // Exit transaction callback cleanly with zero mutations
      }

      // Step 5 & 6: Task 10.4 Active Subscription & Available Credit Balance Verification (D-001)
      // Query active user_subscriptions belonging strictly to the validated customer
      let subscriptionRecords = [];
      try {
        subscriptionRecords = txApp.findRecordsByFilter(
          "user_subscriptions",
          "user = {:user} && status = 'active'",
          "-created",
          0,
          0,
          { user: customerRecord.id }
        );
      } catch (findSubErr) {
        subscriptionRecords = [];
      }

      // Aggregate remaining credits across all active subscription packages
      // Multi-package credit stacking: remaining = max(0, credits_total - credits_used)
      let totalRemainingCredits = 0;
      for (let i = 0; i < subscriptionRecords.length; i++) {
        const sub = subscriptionRecords[i];
        if (!sub || sub.get("status") !== "active") {
          continue;
        }

        const rawTotal = Number(sub.get("credits_total") || 0);
        const rawUsed = Number(sub.get("credits_used") || 0);
        const validTotal = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;
        const validUsed = Number.isFinite(rawUsed) && rawUsed >= 0 ? rawUsed : 0;

        const remaining = Math.max(0, validTotal - validUsed);
        totalRemainingCredits += remaining;
      }

      // Insufficient Credits: Abort with transaction rollback if credits_remaining <= 0
      if (totalRemainingCredits <= 0) {
        throw new Error("INSUFFICIENT_CREDITS: Customer has 0 available contact reveal credits.");
      }

      // Sufficient Credits: Verification-only success state for Task 10.4
      // ZERO credit deduction and ZERO reveal record creation in Task 10.4 (deferred to Task 10.5)
      // Owner phone retrieval is deferred to Task 10.6
      result = {
        task: "10.4",
        status: "credits_verified",
        alreadyRevealed: false,
        customerId: customerRecord.id,
        customerEmail: customerRecord.get("email"),
        listingId: listingId || null,
        creditsRemaining: totalRemainingCredits,
        creditDeducted: false,
        revealCreated: false,
        transactionCommitted: true,
        boundary: "D-013 & D-017 credit balance verification via txApp",
      };
    });
  } catch (txErr) {
    // Controlled insufficient-credits error handling: rollback occurred; return HTTP 402
    if (txErr && txErr.message && txErr.message.includes("INSUFFICIENT_CREDITS")) {
      return e.json(402, {
        success: false,
        status: 402,
        message: "Insufficient credits to reveal contact. Please purchase a credit package.",
        data: {
          task: "10.4",
          status: "insufficient_credits",
          creditsRemaining: 0,
          requiredCredits: 1,
          customerId: customerRecord ? customerRecord.id : customerId,
          transactionRolledBack: true,
        },
      });
    }

    // Rethrow all other errors (NotFoundError, BadRequestError, DELIBERATE_TEST_ROLLBACK, etc.)
    throw txErr;
  }

  // 3. Return explicit success response only after transaction commits successfully
  return e.json(200, {
    success: true,
    message: result.alreadyRevealed
      ? "Contact previously revealed by this customer (idempotent lookup)."
      : "Customer active subscription and credit balance verified (Task 10.4).",
    data: result,
  });
}, $apis.requireSuperuserAuth());
