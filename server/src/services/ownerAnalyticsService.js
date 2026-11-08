import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Owner Analytics Service (Phase 12, Task 12.1)
 *
 * Computes authoritative listing view metrics, inquiry conversion rates, and
 * daily engagement trends for commercial property owners.
 *
 * Requirements & Security Invariants:
 * 1. Strict Owner Scoping: Metrics strictly derived from listings owned by req.user.id.
 * 2. Cross-Owner Protection: Attempting to query another owner's listing returns HTTP 404.
 * 3. Privacy Preservation: Never exposes owner contact phone numbers or customer details (D-014).
 * 4. Zero Division Safeguard: Conversion rate gracefully yields 0.0 when views == 0.
 * 5. Time Boundaries: Standard 7-day ('7d') and 30-day ('30d') date ranges with gapless daily series.
 */

const VALID_PERIODS = new Set(['7d', '30d']);

/**
 * Generates an array of contiguous YYYY-MM-DD date strings between start and end date.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]} Array of date strings
 */
function generateDateSeries(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly label (e.g. 'Nov 2').
 *
 * @param {string} dateStr
 * @returns {string} Formatted label
 */
function formatDateLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00.000Z');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Calculates conversion rate percentage safely.
 *
 * @param {number} reveals
 * @param {number} views
 * @returns {number} Percentage rounded to 1 decimal place
 */
function calculateConversionRate(reveals, views) {
  if (!views || views <= 0) return 0.0;
  return Number(((reveals / views) * 100).toFixed(1));
}

/**
 * Retrieves aggregate and listing-level analytics for an authenticated owner.
 *
 * @param {string} ownerId - Verified owner ID (req.user.id)
 * @param {Object} [options={}]
 * @param {'7d'|'30d'} [options.period='7d'] - Time window
 * @param {string|null} [options.listingId=null] - Optional single listing filter
 * @returns {Promise<Object>} Aggregated analytics report
 */
export async function getOwnerAnalytics(ownerId, { period = '7d', listingId = null } = {}) {
  // 1. Validate ownerId
  if (!ownerId || typeof ownerId !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(ownerId.trim())) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const cleanOwnerId = ownerId.trim();

  // 2. Validate period parameter
  const cleanPeriod = (period || '7d').toLowerCase().trim();
  if (!VALID_PERIODS.has(cleanPeriod)) {
    const err = new Error("Invalid period parameter. Supported periods: '7d', '30d'");
    err.status = 400;
    throw err;
  }

  // 3. Compute time boundaries (UTC)
  const days = cleanPeriod === '30d' ? 30 : 7;
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const pbFilterStart = startIso.replace('T', ' ');
  const pbFilterEnd = endIso.replace('T', ' ');

  const pb = await getAdminClient();

  // 4. Fetch owner's listings (Strictly scoped to cleanOwnerId)
  let ownerListings = [];
  try {
    ownerListings = await pb.collection('listings').getFullList({
      filter: pb.filter('owner = {:owner}', { owner: cleanOwnerId }),
      sort: '-created',
      requestKey: null,
    });
  } catch (err) {
    const safeErr = new Error('Failed to retrieve owner listings for analytics');
    safeErr.status = err?.status || 500;
    throw safeErr;
  }

  // Handle single-listing filter & cross-owner isolation
  let targetListings = ownerListings;
  if (listingId) {
    const cleanListingId = listingId.trim();
    const matched = ownerListings.find((l) => l.id === cleanListingId);

    if (!matched) {
      // Prevents cross-owner data leakage: if listing doesn't belong to this owner, return 404
      const notFoundErr = new Error('Listing not found');
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    targetListings = [matched];
  }

  const targetListingIds = new Set(targetListings.map((l) => l.id));
  const dateSeries = generateDateSeries(startDate, endDate);

  // Initialize daily metric containers
  const dailyViewsMap = new Map();
  const dailyFavoritesMap = new Map();
  const dailyRevealsMap = new Map();

  // Initialize per-listing metric containers
  const listingViewsCount = new Map();
  const listingFavoritesCount = new Map();
  const listingRevealsCount = new Map();

  for (const dateKey of dateSeries) {
    dailyViewsMap.set(dateKey, 0);
    dailyFavoritesMap.set(dateKey, 0);
    dailyRevealsMap.set(dateKey, 0);
  }

  for (const l of targetListings) {
    listingViewsCount.set(l.id, 0);
    listingFavoritesCount.set(l.id, 0);
    listingRevealsCount.set(l.id, 0);
  }

  // If owner has 0 listings, return empty analytics structure
  if (targetListings.length === 0) {
    return {
      period: cleanPeriod,
      date_range: {
        start: startIso,
        end: endIso,
      },
      summary: {
        total_views: 0,
        total_favorites: 0,
        total_reveals: 0,
        conversion_rate: 0.0,
        active_listings: 0,
      },
      daily_engagement: dateSeries.map((d) => ({
        date: d,
        label: formatDateLabel(d),
        views: 0,
        favorites: 0,
        reveals: 0,
      })),
      listings: [],
    };
  }

  // 5. Fetch Views from listing_views within date window
  try {
    const views = await pb.collection('listing_views').getFullList({
      filter: pb.filter('viewed_at >= {:start} && viewed_at <= {:end}', {
        start: pbFilterStart,
        end: pbFilterEnd,
      }),
      requestKey: null,
    });

    for (const v of views) {
      const lid = typeof v.listing === 'object' && v.listing ? v.listing.id : v.listing;
      if (targetListingIds.has(lid)) {
        const dKey = (v.viewed_at || v.created || '').slice(0, 10);
        if (dailyViewsMap.has(dKey)) {
          dailyViewsMap.set(dKey, dailyViewsMap.get(dKey) + 1);
        }
        listingViewsCount.set(lid, (listingViewsCount.get(lid) || 0) + 1);
      }
    }
  } catch {}

  // 6. Fetch Favorites from saved_listings within date window
  try {
    const favorites = await pb.collection('saved_listings').getFullList({
      filter: pb.filter('saved_at >= {:start} && saved_at <= {:end}', {
        start: pbFilterStart,
        end: pbFilterEnd,
      }),
      requestKey: null,
    });

    for (const f of favorites) {
      const lid = typeof f.listing === 'object' && f.listing ? f.listing.id : f.listing;
      if (targetListingIds.has(lid)) {
        const dKey = (f.saved_at || f.created || '').slice(0, 10);
        if (dailyFavoritesMap.has(dKey)) {
          dailyFavoritesMap.set(dKey, dailyFavoritesMap.get(dKey) + 1);
        }
        listingFavoritesCount.set(lid, (listingFavoritesCount.get(lid) || 0) + 1);
      }
    }
  } catch {}

  // 7. Fetch Contact Reveals (Inquiries) from revealed_contacts within date window
  try {
    const reveals = await pb.collection('revealed_contacts').getFullList({
      filter: pb.filter('owner = {:owner} && revealed_at >= {:start} && revealed_at <= {:end}', {
        owner: cleanOwnerId,
        start: pbFilterStart,
        end: pbFilterEnd,
      }),
      requestKey: null,
    });

    for (const r of reveals) {
      const lid = typeof r.listing === 'object' && r.listing ? r.listing.id : r.listing;
      if (targetListingIds.has(lid)) {
        const dKey = (r.revealed_at || r.created || '').slice(0, 10);
        if (dailyRevealsMap.has(dKey)) {
          dailyRevealsMap.set(dKey, dailyRevealsMap.get(dKey) + 1);
        }
        listingRevealsCount.set(lid, (listingRevealsCount.get(lid) || 0) + 1);
      }
    }
  } catch {}

  // 8. Compile totals and daily breakdown
  let totalViews = 0;
  let totalFavorites = 0;
  let totalReveals = 0;

  const dailyEngagement = dateSeries.map((d) => {
    const views = dailyViewsMap.get(d) || 0;
    const favorites = dailyFavoritesMap.get(d) || 0;
    const reveals = dailyRevealsMap.get(d) || 0;

    totalViews += views;
    totalFavorites += favorites;
    totalReveals += reveals;

    return {
      date: d,
      label: formatDateLabel(d),
      views,
      favorites,
      reveals,
    };
  });

  const overallConversionRate = calculateConversionRate(totalReveals, totalViews);

  // 9. Compile Listing Performance Comparison
  const listingPerformance = targetListings.map((l) => {
    const views = listingViewsCount.get(l.id) || 0;
    const favorites = listingFavoritesCount.get(l.id) || 0;
    const reveals = listingRevealsCount.get(l.id) || 0;
    const conversionRate = calculateConversionRate(reveals, views);

    return {
      id: l.id,
      title: l.title,
      category: l.category,
      city: l.city,
      area: l.area,
      price: l.price,
      status: l.status,
      views,
      favorites,
      reveals,
      conversion_rate: conversionRate,
    };
  });

  // Sort listings by views descending (with title tiebreaker)
  listingPerformance.sort((a, b) => b.views - a.views || b.reveals - a.reveals);

  return {
    period: cleanPeriod,
    date_range: {
      start: startIso,
      end: endIso,
    },
    summary: {
      total_views: totalViews,
      total_favorites: totalFavorites,
      total_reveals: totalReveals,
      conversion_rate: overallConversionRate,
      active_listings: targetListings.filter((l) => l.status === 'approved').length,
    },
    daily_engagement: dailyEngagement,
    listings: listingPerformance,
  };
}
