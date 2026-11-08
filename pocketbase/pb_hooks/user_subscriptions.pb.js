/**
 * ShopFinder — User Subscriptions Collection Lifecycle Hooks
 * Phase 2, Task 2.7
 *
 * Ensures newly created user subscription records receive:
 * - credits_used: 0 (when omitted from creation request)
 * - status: "active" (when omitted from creation request)
 * Enforces credits_used <= credits_total constraint on creation.
 * Preserves explicit valid values.
 * Does not increment credits_used or modify purchased_at/expires_at/credits_total.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('credits_used' in body) || body.credits_used === null || body.credits_used === undefined || body.credits_used === '') {
    e.record.set('credits_used', 0);
  }

  if (!body || !('status' in body) || body.status === null || body.status === undefined || body.status === '') {
    e.record.set('status', 'active');
  }

  // Cross-field validation: credits_used <= credits_total
  const creditsUsed = e.record.get('credits_used');
  const creditsTotal = e.record.get('credits_total');
  if (creditsUsed !== null && creditsUsed !== undefined && creditsTotal !== null && creditsTotal !== undefined) {
    if (Number(creditsUsed) > Number(creditsTotal)) {
      throw new BadRequestError("credits_used cannot exceed credits_total.");
    }
  }

  e.next();
}, "user_subscriptions");

