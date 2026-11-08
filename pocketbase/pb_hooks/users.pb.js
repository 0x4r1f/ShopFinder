/**
 * ShopFinder — Users Collection Lifecycle Hooks
 * Phase 2, Task 2.2
 *
 * Ensures newly created user records receive `is_active: true`
 * when no value is explicitly supplied in the creation request.
 * Preserves explicit `is_active: false` on creation and subsequent deactivations.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;
  if (!body || !('is_active' in body) || body.is_active === null || body.is_active === undefined || body.is_active === '') {
    e.record.set('is_active', true);
  } else {
    e.record.set('is_active', Boolean(body.is_active));
  }
  e.next();
}, "users");

