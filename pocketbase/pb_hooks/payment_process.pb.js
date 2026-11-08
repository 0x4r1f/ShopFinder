/**
 * ShopFinder — Atomic Payment Processing & Idempotency Hook (D-009, D-013)
 * Phase 11, Task 11.5
 *
 * Implements private internal route for atomic payment processing and duplicate
 * webhook detection using PocketBase's native SQLite transactions ($app.runInTransaction).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Restricted exclusively to PocketBase Superusers via $apis.requireSuperuserAuth().
 * 2. Inaccessible to anonymous and ordinary authenticated users (HTTP 401/403).
 * 3. Never called directly by browser clients (D-007); mediated exclusively by Express.
 * 4. Idempotency Key (D-009): Uses verified provider_ref to look up existing payments.
 * 5. If payment status is already 'success', safely acknowledges duplicate with HTTP 200
 *    without duplicate credit top-ups or duplicate subscription records.
 * 6. Concurrency safe: serialized inside $app.runInTransaction using txApp exclusively.
 * 7. Credit allocation and subscription activation are strictly deferred to Task 11.6.
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

    // Case A: Payment already succeeded -> Acknowledge duplicate immediately with 0 mutations
    if (currentStatus === "success") {
      responseData = {
        duplicate: true,
        alreadyProcessed: true,
        provider: recordProvider,
        providerRef: providerRef,
        status: "success",
        paymentId: paymentRecord.id,
        planId: paymentRecord.get("plan"),
        userId: paymentRecord.get("user"),
        amount: paymentRecord.get("amount"),
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

    // Case D: Payment is pending -> transition status
    if (webhookStatus === "success") {
      paymentRecord.set("status", "success");
      txApp.save(paymentRecord);

      // NOTE for Task 11.6: Server-side credit top-up and user_subscriptions activation
      // will be executed here inside this same transaction.
      responseData = {
        duplicate: false,
        alreadyProcessed: false,
        provider: recordProvider,
        providerRef: providerRef,
        status: "success",
        paymentId: paymentRecord.id,
        planId: paymentRecord.get("plan"),
        userId: paymentRecord.get("user"),
        amount: paymentRecord.get("amount"),
        transition: "pending_to_success",
        transactionCommitted: true,
      };
      return;
    } else if (webhookStatus === "failed" || webhookStatus === "cancelled") {
      paymentRecord.set("status", "failed");
      txApp.save(paymentRecord);

      responseData = {
        duplicate: false,
        alreadyProcessed: false,
        provider: recordProvider,
        providerRef: providerRef,
        status: "failed",
        paymentId: paymentRecord.id,
        transition: "pending_to_failed",
        transactionCommitted: true,
      };
      return;
    } else {
      responseData = {
        duplicate: false,
        alreadyProcessed: false,
        provider: recordProvider,
        providerRef: providerRef,
        status: "pending",
        paymentId: paymentRecord.id,
        transactionCommitted: true,
      };
      return;
    }
  });

  return e.json(200, {
    success: true,
    message: responseData.alreadyProcessed ? "Payment already processed" : "Payment processed successfully",
    data: responseData,
  });
}, $apis.requireSuperuserAuth());
