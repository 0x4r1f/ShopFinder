/**
 * ShopFinder — Listings Collection Lifecycle Hooks
 * Phase 2, Task 2.4
 *
 * Ensures newly created listings receive:
 * - status: "pending" (when omitted from creation request)
 * - listing_type: "rent" (when omitted from creation request)
 * Preserves explicit values when provided.
 */

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;

  if (!body || !('status' in body) || body.status === null || body.status === undefined || body.status === '') {
    e.record.set('status', 'pending');
  }

  if (!body || !('listing_type' in body) || body.listing_type === null || body.listing_type === undefined || body.listing_type === '') {
    e.record.set('listing_type', 'rent');
  }

  e.next();
}, "listings");

