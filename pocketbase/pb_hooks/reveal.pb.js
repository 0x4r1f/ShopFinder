/**
 * ShopFinder — Atomic Contact Reveal Transaction Hook (D-013, D-017)
 * Phase 10, Tasks 10.1, 10.2, 10.3, 10.4, 10.5
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
 * 7. Active Subscription & Credit Verification (Task 10.4): Aggregates remaining credits
 *    across all active packages (D-001 stacking). Aborts with rollback if credits_remaining <= 0 (HTTP 402).
 * 8. Atomic Credit Deduction & Reveal Record Creation (Task 10.5):
 *    - Validates listing exists, status === 'approved', and valid active commercial owner.
 *    - Prevents customers from revealing their own listings.
 *    - Deterministically selects the oldest eligible active subscription (FIFO).
 *    - Atomically increments credits_used by exactly 1 on that subscription record.
 *    - Creates exactly one revealed_contacts record for (customer, listing, owner, revealed_at).
 *    - Both operations execute inside the SAME txApp transaction: succeed together or roll back together.
 * 9. Concurrency & Unique Constraint Protection (Task 10.5):
 *    - Backstopped by database-level unique index: idx_revealed_contacts_customer_listing.
 *    - Concurrent races roll back safely without duplicate deductions or records.
 * 10. Scope boundary: Owner phone number retrieval from owner_contacts is strictly deferred to Task 10.6.
 * 11. Executes all transaction-scoped reads and writes inside $app.runInTransaction
 *     using txApp exclusively — never outer $app.
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
  const verifyOnly = body.verifyOnly === true;

  let result = null;
  let customerRecord = null;
  let listingRecord = null;
  let ownerRecord = null;

  // 2. Transaction Boundary — Established via $app.runInTransaction
  // All transaction-scoped database operations MUST use txApp exclusively.
  try {
    $app.runInTransaction((txApp) => {
      // Step 1: Independently validate customer record inside transaction using txApp
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

      // Active status verification: strictly require is_active === true (rejects false, null, undefined, missing)
      if (customerRecord.get("is_active") !== true) {
        throw new BadRequestError("Customer account is deactivated.");
      }

      // Deliberate test simulation hook for rollback verification (Task 10.1)
      if (body.simulateRollback === true || body.testRollback === true) {
        customerRecord.set("name", "MUTATION_BEFORE_ROLLBACK");
        txApp.save(customerRecord);
        throw new Error("DELIBERATE_TEST_ROLLBACK: Simulated failure for atomicity verification.");
      }

      // Step 2: Task 10.3 Idempotent lookup for previously revealed contact
      // Scoped strictly to BOTH validated customer ID and requested listing ID
      let existingReveal = null;
      if (listingId && !body.bypassIdempotencyCheck) {
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
          task: "10.5",
          status: "already_revealed",
          alreadyRevealed: true,
          revealId: existingReveal.id,
          revealedAt: existingReveal.get("revealed_at") || existingReveal.get("created"),
          customerId: customerRecord.id,
          listingId: listingId,
          ownerId: existingReveal.get("owner") || null,
          creditsRemaining: null, // Zero credits required/checked for previously revealed contacts
          creditDeducted: false,
          creditsDeducted: 0,
          revealCreated: false,
          transactionCommitted: true,
          boundary: "D-013 & D-017 idempotent reveal lookup via txApp",
        };
        return; // Exit transaction callback cleanly with zero mutations
      }

      // Step 3: Task 10.4 Active Subscription & Available Credit Balance Verification (D-001)
      // Query active user_subscriptions belonging strictly to the validated customer
      let subscriptionRecords = [];
      try {
        subscriptionRecords = txApp.findRecordsByFilter(
          "user_subscriptions",
          "user = {:user} && status = 'active'",
          "+created",
          0,
          0,
          { user: customerRecord.id }
        );
      } catch (findSubErr) {
        subscriptionRecords = [];
      }

      // Sort deterministically: oldest purchase first (FIFO) with ID tiebreaker
      subscriptionRecords.sort((a, b) => {
        const timeA = new Date(a.get("purchased_at") || a.get("created")).getTime();
        const timeB = new Date(b.get("purchased_at") || b.get("created")).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      // Aggregate remaining credits across all active subscription packages
      // Multi-package credit stacking: remaining = max(0, credits_total - credits_used)
      let totalRemainingCredits = 0;
      let eligibleSub = null;

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

        // Select the first eligible active subscription with available balance
        if (remaining > 0 && !eligibleSub) {
          eligibleSub = sub;
        }
      }

      // Insufficient Credits: Abort with transaction rollback if credits_remaining <= 0
      if (totalRemainingCredits <= 0 || !eligibleSub) {
        throw new Error("INSUFFICIENT_CREDITS: Customer has 0 available contact reveal credits.");
      }

      // If no listingId was provided or verification-only was requested, return credits_verified without mutations
      if (!listingId || verifyOnly) {
        result = {
          task: "10.5",
          status: "credits_verified",
          alreadyRevealed: false,
          customerId: customerRecord.id,
          customerEmail: customerRecord.get("email"),
          listingId: listingId || null,
          creditsRemaining: totalRemainingCredits,
          creditDeducted: false,
          creditsDeducted: 0,
          revealCreated: false,
          transactionCommitted: true,
          boundary: "D-013 & D-017 credit balance verification via txApp",
        };
        return;
      }

      // Step 4: Listing Validation (Task 10.5)
      try {
        listingRecord = txApp.findRecordById("listings", listingId);
      } catch (listingErr) {
        throw new NotFoundError("Listing not found.");
      }

      if (!listingRecord) {
        throw new NotFoundError("Listing not found.");
      }

      // Listing status check: strictly require 'approved'
      if (listingRecord.get("status") !== "approved") {
        throw new BadRequestError("Listing is not approved for contact reveal.");
      }

      // Owner relation check
      const rawOwnerId = listingRecord.get("owner");
      if (!rawOwnerId || typeof rawOwnerId !== "string" || String(rawOwnerId).trim() === "") {
        throw new BadRequestError("Listing does not have a valid owner relation.");
      }
      const ownerId = String(rawOwnerId).trim();

      // Prevent customer from revealing their own listing
      if (ownerId === customerRecord.id) {
        throw new BadRequestError("Customer cannot reveal their own listing.");
      }

      // Validate owner exists and is active commercial owner
      try {
        ownerRecord = txApp.findRecordById("users", ownerId);
      } catch (ownerErr) {
        throw new BadRequestError("Listing owner account not found.");
      }

      if (!ownerRecord || ownerRecord.get("role") !== "owner" || ownerRecord.get("is_active") !== true) {
        throw new BadRequestError("Listing owner is invalid or inactive.");
      }

      // Deliberate test failure for credit update failure rollback testing
      if (body.simulateCreditUpdateFailure === true) {
        throw new BadRequestError("SIMULATED_CREDIT_UPDATE_FAILURE: Deliberate failure during credit deduction.");
      }

      // Step 5: Atomic Credit Deduction on eligible subscription record (Task 10.5)
      const currentUsed = Number(eligibleSub.get("credits_used") || 0);
      eligibleSub.set("credits_used", currentUsed + 1);
      txApp.save(eligibleSub);

      // Deliberate test failure for reveal save failure rollback testing
      if (body.simulateRevealSaveFailure === true) {
        throw new BadRequestError("SIMULATED_REVEAL_SAVE_FAILURE: Deliberate failure after credit deduction.");
      }

      // Step 6: Create revealed_contacts record (Task 10.5)
      const revealCol = txApp.findCollectionByNameOrId("revealed_contacts");
      const newReveal = new Record(revealCol);
      newReveal.set("customer", customerRecord.id);
      newReveal.set("listing", listingRecord.id);
      newReveal.set("owner", ownerRecord.id);
      const nowIso = new Date().toISOString();
      newReveal.set("revealed_at", nowIso);

      txApp.save(newReveal);

      // Step 7: Successful First-Time Reveal Result (Task 10.5)
      // Note: Owner phone retrieval is deferred to Task 10.6
      result = {
        task: "10.5",
        status: "revealed",
        alreadyRevealed: false,
        creditDeducted: true,
        creditsDeducted: 1,
        creditsRemaining: totalRemainingCredits - 1,
        revealId: newReveal.id,
        revealedAt: newReveal.get("revealed_at") || nowIso,
        customerId: customerRecord.id,
        listingId: listingRecord.id,
        ownerId: ownerRecord.id,
        deductedSubscriptionId: eligibleSub.id,
        transactionCommitted: true,
        boundary: "D-013 & D-017 atomic contact reveal & credit deduction via txApp",
      };
    });
  } catch (txErr) {
    // 1. Controlled insufficient-credits error handling: rollback occurred; return HTTP 402
    if (txErr && txErr.message && txErr.message.includes("INSUFFICIENT_CREDITS")) {
      return e.json(402, {
        success: false,
        status: 402,
        message: "Insufficient credits to reveal contact. Please purchase a credit package.",
        data: {
          task: "10.5",
          status: "insufficient_credits",
          creditsRemaining: 0,
          requiredCredits: 1,
          customerId: customerRecord ? customerRecord.id : customerId,
          transactionRolledBack: true,
        },
      });
    }

    // 2. Controlled unique constraint / race condition conflict handling
    if (txErr && txErr.message && /unique|constraint/i.test(txErr.message)) {
      return e.json(409, {
        success: false,
        status: 409,
        message: "Contact reveal already recorded or concurrent transaction conflict. All changes rolled back.",
        data: {
          task: "10.5",
          status: "conflict_rolled_back",
          transactionRolledBack: true,
        },
      });
    }

    // 3. Re-throw other known errors (NotFoundError, BadRequestError, test errors)
    throw txErr;
  }

  // 3. Return explicit success response only after transaction commits successfully
  return e.json(200, {
    success: true,
    message: result.alreadyRevealed
      ? "Contact previously revealed by this customer (idempotent lookup)."
      : result.status === "credits_verified"
      ? "Customer active subscription and credit balance verified (Task 10.4)."
      : "Contact revealed successfully and credit deducted atomically (Task 10.5).",
    data: result,
  });
}, $apis.requireSuperuserAuth());
