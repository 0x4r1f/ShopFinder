/**
 * ShopFinder — Atomic Payment Processing, Idempotency & Credit Allocation Hook (D-001, D-009, D-010, D-013, D-017)
 * Phase 11, Task 11.6
 *
 * Implements private internal route for atomic payment processing, duplicate webhook
 * detection, and server-side credit top-up / subscription activation inside PocketBase's
 * native SQLite transactions ($app.runInTransaction).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Restricted exclusively to PocketBase Superusers via $apis.requireSuperuserAuth().
 * 2. Inaccessible to anonymous and ordinary authenticated users (HTTP 401/403).
 * 3. Never called directly by browser clients (D-007); mediated exclusively by Express.
 * 4. Idempotency Key (D-009): Uses verified provider_ref to look up existing payments.
 * 5. If payment status is already 'success', safely acknowledges duplicate with HTTP 200
 *    without duplicate credit top-ups or duplicate subscription records.
 * 6. Concurrency safe: serialized inside $app.runInTransaction using txApp exclusively.
 * 7. Credit Stacking (D-001): Every successful purchase creates a separate user_subscriptions
 *    record with status 'active', expires_at = null, credits_used = 0, and credits_total
 *    derived strictly from the trusted subscription_plans record.
 * 8. Rejects inactive plans, mismatched amounts, mismatched currencies, and provider mismatches.
 * 9. Any failure triggers complete SQLite rollback with zero partial mutations.
 */

routerAdd("POST", "/api/custom/payment-process", (e) => {
  const body = e.requestInfo().body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Invalid payload: request body must be a valid JSON object.");
  }

  const rawProvider = body.provider;
  if (!rawProvider || typeof rawProvider !== "string" || String(rawProvider).trim() === "") {
    throw new BadRequestError("provider is required and must be a non-empty string.");
  }

  const rawProviderRef = body.providerRef;
  if (!rawProviderRef || typeof rawProviderRef !== "string" || String(rawProviderRef).trim() === "") {
    throw new BadRequestError("providerRef is required and must be a non-empty string.");
  }

  const provider = String(rawProvider).trim().toLowerCase();
  const providerRef = String(rawProviderRef).trim();
  const webhookStatus = String(body.status || "success").trim().toLowerCase();
  const testRollback = body.testRollback === true;
  const simulateFailureAfterSubSave = body.simulateFailureAfterSubSave === true;

  let responseData = null;

  // Database Transaction Boundary via $app.runInTransaction
  $app.runInTransaction((txApp) => {
    // 1. Resolve existing payment record using trusted server-side query
    let paymentRecord = null;
    try {
      paymentRecord = txApp.findFirstRecordByFilter(
        "payments",
        "provider_ref = {:ref}",
        { ref: providerRef }
      );
    } catch (err) {
      paymentRecord = null;
    }

    if (!paymentRecord) {
      throw new NotFoundError("Payment record not found for provider reference: '" + providerRef + "'");
    }

    // 2. Reject provider mismatches
    const recordProvider = String(paymentRecord.get("provider") || "").trim().toLowerCase();
    if (recordProvider !== provider) {
      throw new BadRequestError(
        "Provider mismatch: record provider is '" + recordProvider + "' but webhook provider is '" + provider + "'"
      );
    }

    // 3. Inspect current status for idempotency check
    const currentStatus = String(paymentRecord.get("status") || "").trim().toLowerCase();

    // Case A: Payment already succeeded -> Acknowledge duplicate immediately with 0 mutations (Task 11.5 / D-009)
    if (currentStatus === "success") {
      responseData = {
        duplicate: true,
        alreadyProcessed: true,
        provider: recordProvider,
        providerRef: providerRef,
        status: "success",
        paymentId: paymentRecord.id,
        subscriptionId: paymentRecord.get("subscription") || null,
        planId: paymentRecord.get("plan"),
        userId: paymentRecord.get("user"),
        amount: paymentRecord.get("amount"),
        creditsAllocated: 0,
        transactionCommitted: true,
      };
      return;
    }

    // Case B: Payment already marked failed
    if (currentStatus === "failed") {
      if (webhookStatus === "failed" || webhookStatus === "cancelled") {
        responseData = {
          duplicate: true,
          alreadyProcessed: true,
          provider: recordProvider,
          providerRef: providerRef,
          status: "failed",
          paymentId: paymentRecord.id,
          creditsAllocated: 0,
          transactionCommitted: true,
        };
        return;
      }
      throw new BadRequestError("Cannot process payment: record is already in 'failed' status.");
    }

    // Case C: Simulation of transaction rollback for test coverage
    if (testRollback) {
      paymentRecord.set("status", "failed");
      txApp.save(paymentRecord);
      throw new BadRequestError("Simulated database transaction rollback");
    }

    // Case D: Pending payment with non-success webhook (failed or cancelled)
    if (webhookStatus === "failed" || webhookStatus === "cancelled") {
      paymentRecord.set("status", "failed");
      txApp.save(paymentRecord);

      responseData = {
        duplicate: false,
        alreadyProcessed: false,
        provider: recordProvider,
        providerRef: providerRef,
        status: "failed",
        paymentId: paymentRecord.id,
        creditsAllocated: 0,
        transition: "pending_to_failed",
        transactionCommitted: true,
      };
      return;
    }

    // Case E: Pending payment with success webhook -> Atomic Credit Allocation & Subscription Activation (Task 11.6)
    if (webhookStatus === "success") {
      // Step 1: Validate associated subscription plan
      const planId = paymentRecord.get("plan");
      if (!planId) {
        throw new BadRequestError("Payment record is missing associated subscription plan.");
      }

      let planRecord = null;
      try {
        planRecord = txApp.findRecordById("subscription_plans", planId);
      } catch (e) {
        planRecord = null;
      }

      if (!planRecord) {
        throw new NotFoundError("Associated subscription plan not found: '" + planId + "'");
      }

      if (planRecord.get("is_active") === false) {
        throw new BadRequestError("Associated subscription plan is inactive.");
      }

      // Step 2: Validate customer account
      const userId = paymentRecord.get("user");
      if (!userId) {
        throw new BadRequestError("Payment record is missing associated user.");
      }

      let userRecord = null;
      try {
        userRecord = txApp.findRecordById("users", userId);
      } catch (e) {
        userRecord = null;
      }

      if (!userRecord) {
        throw new NotFoundError("Associated user record not found: '" + userId + "'");
      }

      if (userRecord.get("role") !== "customer") {
        throw new BadRequestError("Associated user is not a customer.");
      }

      if (userRecord.get("is_active") === false) {
        throw new BadRequestError("Associated customer account is deactivated.");
      }

      // Step 3: Validate amount and currency consistency
      const planPrice = Number(planRecord.get("price"));
      const paymentAmount = Number(paymentRecord.get("amount"));
      if (isNaN(planPrice) || isNaN(paymentAmount) || Math.abs(planPrice - paymentAmount) > 0.001) {
        throw new BadRequestError(
          "Amount mismatch: payment record amount (" + paymentAmount + ") does not match plan price (" + planPrice + ")."
        );
      }

      const paymentCurrency = String(paymentRecord.get("currency") || "").trim().toUpperCase();
      if (paymentCurrency !== "BDT") {
        throw new BadRequestError("Currency mismatch: payment record currency must be BDT.");
      }

      // If webhook explicitly reported currency, verify match
      if (body.currency !== undefined && body.currency !== null && String(body.currency).trim() !== "") {
        const webhookCurrency = String(body.currency).trim().toUpperCase();
        if (webhookCurrency !== paymentCurrency) {
          throw new BadRequestError(
            "Currency mismatch: webhook currency '" + webhookCurrency + "' does not match payment currency '" + paymentCurrency + "'."
          );
        }
      }

      // If webhook explicitly reported amount, verify match
      if (body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== "") {
        const webhookAmount = Number(body.amount);
        if (!isNaN(webhookAmount) && Math.abs(webhookAmount - paymentAmount) > 0.001) {
          throw new BadRequestError(
            "Amount mismatch: webhook amount (" + webhookAmount + ") does not match payment amount (" + paymentAmount + ")."
          );
        }
      }

      // Step 4: Derive credits total from trusted plan
      const planCredits = Number(planRecord.get("credits"));
      if (isNaN(planCredits) || planCredits < 1) {
        throw new BadRequestError("Invalid plan configuration: plan credits must be at least 1.");
      }

      // Step 5: Create new user_subscriptions record (D-001 Credit Stacking)
      const userSubCol = txApp.findCollectionByNameOrId("user_subscriptions");
      const newSub = new Record(userSubCol);
      newSub.set("user", userRecord.id);
      newSub.set("plan", planRecord.id);
      newSub.set("credits_total", planCredits);
      newSub.set("credits_used", 0);
      newSub.set("status", "active");
      const nowIso = new Date().toISOString();
      newSub.set("purchased_at", nowIso);
      newSub.set("expires_at", null);

      txApp.save(newSub);

      // Rollback simulation hook for test verification
      if (simulateFailureAfterSubSave) {
        throw new BadRequestError("Simulated failure after subscription creation");
      }

      // Step 6: Link payment to newly created subscription and mark success
      paymentRecord.set("subscription", newSub.id);
      paymentRecord.set("status", "success");
      txApp.save(paymentRecord);

      responseData = {
        duplicate: false,
        alreadyProcessed: false,
        provider: recordProvider,
        providerRef: providerRef,
        status: "success",
        paymentId: paymentRecord.id,
        subscriptionId: newSub.id,
        planId: planRecord.id,
        planName: planRecord.get("name"),
        userId: userRecord.id,
        amount: paymentAmount,
        currency: paymentCurrency,
        creditsTotal: planCredits,
        creditsUsed: 0,
        creditsAllocated: planCredits,
        transition: "pending_to_success",
        transactionCommitted: true,
      };
      return;
    }

    // Default pending response
    responseData = {
      duplicate: false,
      alreadyProcessed: false,
      provider: recordProvider,
      providerRef: providerRef,
      status: "pending",
      paymentId: paymentRecord.id,
      creditsAllocated: 0,
      transactionCommitted: true,
    };
  });

  return e.json(200, {
    success: true,
    message: responseData.alreadyProcessed ? "Payment already processed" : "Payment processed successfully",
    data: responseData,
  });
}, $apis.requireSuperuserAuth());
