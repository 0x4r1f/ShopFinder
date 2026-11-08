import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Customer Portal & Subscription Tracking Service (Phase 8, Task 8.2 & Phase 9, Task 9.3)
 *
 * Implements authoritative customer subscription tracking and credit balance aggregation:
 * - D-001 Policy: One-time credit packages. Credits never expire (expires_at = null).
 * - Multi-package aggregation: remaining = max(0, credits_total - credits_used).
 * - Total balance = sum(remaining across all active records).
 * - Excludes cancelled and expired records.
 * - Read-only query: NEVER mutates credits_used, creates, or deletes records.
 * - Customer identity derived strictly from verified session (req.user.id).
 * - D-014 Privacy: Never leaks owner phone numbers, credentials, or internal PB keys.
 */

/**
 * Retrieves authoritative subscription tracking and credit balance for a customer.
 *
 * @param {string} customerId - Authenticated customer's user ID (req.user.id)
 * @returns {Promise<{
 *   credits_remaining: number,
 *   active_subscriptions_count: number,
 *   subscriptions: Array<{
 *     id: string,
 *     plan_id: string,
 *     plan_name: string,
 *     credits_total: number,
 *     credits_used: number,
 *     credits_remaining: number,
 *     status: string,
 *     purchased_at: string,
 *     expires_at: string|null
 *   }>
 * }>}
 */
export async function getCustomerSubscriptionBalance(customerId) {
  const pb = await getAdminClient();

  let records = [];
  try {
    records = await pb.collection('user_subscriptions').getFullList({
      filter: pb.filter('user = {:userId} && status = "active"', { userId: customerId }),
      sort: '-purchased_at,-created',
      expand: 'plan',
      requestKey: null,
    });
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve subscription information');
      safeErr.status = 503;
      throw safeErr;
    }
    records = [];
  }

  const activePackages = [];
  let totalRemainingCredits = 0;

  for (const record of records) {
    // Defensively exclude non-active packages
    if (!record || record.status !== 'active') {
      continue;
    }

    // Defensive numeric parsing to prevent NaN or negative balances
    const rawTotal = Number(record.credits_total);
    const validTotal = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;

    const rawUsed = Number(record.credits_used);
    const validUsed = Number.isFinite(rawUsed) && rawUsed >= 0 ? rawUsed : 0;

    const remaining = Math.max(0, validTotal - validUsed);
    totalRemainingCredits += remaining;

    activePackages.push({
      id: record.id,
      plan_id: record.plan || '',
      plan_name: record.expand?.plan?.name || 'Credit Package',
      credits_total: validTotal,
      credits_used: validUsed,
      credits_remaining: remaining,
      status: record.status,
      purchased_at: record.purchased_at || record.created,
      expires_at: record.expires_at || null,
    });
  }

  return {
    credits_remaining: totalRemainingCredits,
    active_subscriptions_count: activePackages.length,
    subscriptions: activePackages,
  };
}

/**
 * Retrieves aggregated dashboard overview data for an authenticated customer.
 *
 * @param {string} customerId - Authenticated customer's user ID (req.user.id)
 * @returns {Promise<{
 *   credits_remaining: number,
 *   active_subscriptions_count: number,
 *   active_subscriptions: Array<Object>,
 *   recent_saved: Array<Object>,
 *   recent_reveals: Array<Object>
 * }>}
 */
export async function getCustomerDashboard(customerId) {
  const pb = await getAdminClient();

  // 1. Authoritative subscription tracking & credit balance (Phase 9, Task 9.3)
  const subInfo = await getCustomerSubscriptionBalance(customerId);

  // 2. Query recent saved listings (up to 5 items, newest first)
  let recentSaved = [];
  try {
    const savedRes = await pb.collection('saved_listings').getList(1, 5, {
      filter: pb.filter('customer = {:customerId} && listing.status = "approved"', { customerId }),
      sort: '-saved_at',
      expand: 'listing',
      requestKey: null,
    });

    recentSaved = savedRes.items
      .filter((item) => item.expand?.listing && item.expand.listing.status === 'approved')
      .map((item) => ({
        id: item.id,
        listing_id: item.listing,
        saved_at: item.saved_at || item.created,
        title: item.expand.listing.title || '',
        price: Number(item.expand.listing.price) || 0,
        city: item.expand.listing.city || '',
        area: item.expand.listing.area || '',
        category: item.expand.listing.category || '',
        listing_type: item.expand.listing.listing_type || 'rent',
      }));
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve saved listings');
      safeErr.status = 503;
      throw safeErr;
    }
    recentSaved = [];
  }

  // 3. Query recent revealed contacts (up to 5 items, newest first)
  // Strictly omits phone numbers (D-014 privacy policy)
  let recentReveals = [];
  try {
    const revealRes = await pb.collection('revealed_contacts').getList(1, 5, {
      filter: pb.filter('customer = {:customerId}', { customerId }),
      sort: '-revealed_at',
      expand: 'listing',
      requestKey: null,
    });

    recentReveals = revealRes.items.map((item) => ({
      id: item.id,
      listing_id: item.listing,
      revealed_at: item.revealed_at || item.created,
      title: item.expand?.listing?.title || 'Commercial Property',
      city: item.expand?.listing?.city || '',
      area: item.expand?.listing?.area || '',
    }));
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve reveal history');
      safeErr.status = 503;
      throw safeErr;
    }
    recentReveals = [];
  }

  return {
    credits_remaining: subInfo.credits_remaining,
    active_subscriptions_count: subInfo.active_subscriptions_count,
    active_subscriptions: subInfo.subscriptions,
    recent_saved: recentSaved,
    recent_reveals: recentReveals,
  };
}
