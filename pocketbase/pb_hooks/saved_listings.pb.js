/**
 * ShopFinder — Saved Listings Collection Lifecycle Hooks
 * Phase 2, Task 2.9
 *
 * Ensures newly created saved_listings records receive:
 * - saved_at: current ISO datetime (when omitted from creation request)
 * Preserves explicit valid datetime when provided.
 *
 * Note: Phase 8 Express favorite endpoints will explicitly provide saved_at
 * when required.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('saved_at' in body) || body.saved_at === null || body.saved_at === undefined || body.saved_at === '') {
    e.record.set('saved_at', new Date().toISOString());
  }

  e.next();
}, "saved_listings");

