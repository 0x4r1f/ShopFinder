/**
 * ShopFinder — Listing Images Collection Lifecycle Hooks
 * Phase 2, Task 2.5
 *
 * Ensures newly created listing images receive:
 * - is_cover: false (when omitted from creation request)
 * - order: 0 (when omitted from creation request)
 * Preserves explicit values when provided.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('is_cover' in body) || body.is_cover === null || body.is_cover === undefined || body.is_cover === '') {
    e.record.set('is_cover', false);
  } else {
    e.record.set('is_cover', Boolean(body.is_cover));
  }

  if (!body || !('order' in body) || body.order === null || body.order === undefined || body.order === '') {
    e.record.set('order', 0);
  }

  e.next();
}, "listing_images");

