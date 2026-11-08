/**
 * ShopFinder — Subscription Plans Collection Lifecycle Hooks
 * Phase 2, Task 2.6
 *
 * Ensures:
 * - price is explicitly provided (since PocketBase number field required:true rejects 0 as blank)
 * - is_active defaults to true when omitted
 * Preserves explicit is_active: false when provided.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('price' in body) || body.price === null || body.price === undefined || body.price === '') {
    throw new BadRequestError("The price field is required.");
  }

  if (!('is_active' in body) || body.is_active === null || body.is_active === undefined || body.is_active === '') {
    e.record.set('is_active', true);
  } else {
    e.record.set('is_active', Boolean(body.is_active));
  }

  e.next();
}, "subscription_plans");
