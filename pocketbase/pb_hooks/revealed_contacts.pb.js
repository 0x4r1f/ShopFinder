/**
 * ShopFinder — Revealed Contacts Collection Lifecycle Hooks
 * Phase 2, Task 2.8
 *
 * Ensures newly created revealed_contacts records receive:
 * - revealed_at: current ISO datetime (when omitted from creation request)
 * Preserves explicit valid datetime when provided.
 *
 * Note: Phase 10 atomic reveal transaction will explicitly provide revealed_at
 * inside txApp.save(record).
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('revealed_at' in body) || body.revealed_at === null || body.revealed_at === undefined || body.revealed_at === '') {
    e.record.set('revealed_at', new Date().toISOString());
  }

  e.next();
}, "revealed_contacts");

