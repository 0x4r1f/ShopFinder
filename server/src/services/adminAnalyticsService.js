import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Admin Platform Analytics Service (Phase 12, Task 12.2)
 *
 * Implements platform-wide administrative analytics aggregating:
 * 1. User growth dynamics (lifetime role totals & period daily signups).
 * 2. Commercial listing volume (active inventory, Top 5 cities + Other, category, type, and moderation status).
 * 3. Revenue metrics (strictly successful BDT payments, plan breakdown, transaction volume, and daily trends).
 * 4. Credit consumption (lifetime purchased/used/remaining, utilization rate, and daily reveal velocity).
 *
 * Requirements & Architectural Decisions:
 * - D-019: Standard timeframe presets ('7d', '30d', '90d') with continuous zero-filled daily timelines.
 * - D-019: Clearly distinguish lifetime cumulative metrics from period-specific metrics.
 * - D-020: Top 5 cities individually listed + aggregated 'Other' with percentages based on complete approved inventory.
 * - Metric Semantics: Listing `created` timestamps denote creation dates, NOT approval dates.
 * - Financial Invariant: Only `status === 'success'` payments contribute to gross revenue; pending/failed are strictly excluded.
 * - Credit Invariant: 1 reveal event in `revealed_contacts` consumes exactly 1 credit in `user_subscriptions`; zero double counting.
 * - Security & Privacy (D-007, D-010, D-014): Expose zero personal phone numbers, emails, passwords, tokens, or customer IDs.
 */

export const VALID_PERIODS = new Set(['7d', '30d', '90d']);

export const STANDARD_CATEGORIES = [
  'retail',
  'office',
  'warehouse',
  'showroom',
  'restaurant',
  'industrial',
  'other',
];

/**
 * Computes UTC date boundaries for a given timeframe period.
 *
 * @param {'7d'|'30d'|'90d'} period
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ days: number, startDate: Date, endDate: Date, startIso: string, endIso: string, pbFilterStart: string, pbFilterEnd: string }}
 */
export function getTimeframeBoundaries(period = '30d', referenceDate = new Date()) {
  const effectivePeriod = period === undefined || period === null ? '30d' : period;
  const cleanPeriod = String(effectivePeriod).toLowerCase().trim();
  if (!VALID_PERIODS.has(cleanPeriod)) {
    const err = new Error("Invalid period parameter. Supported periods: '7d', '30d', '90d'");
    err.status = 400;
    throw err;
  }

  const days = cleanPeriod === '90d' ? 90 : cleanPeriod === '7d' ? 7 : 30;

  const ref = new Date(referenceDate);
  const startDate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - (days - 1), 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 23, 59, 59, 999));

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  // PocketBase SQLite comparison format uses a space rather than 'T'
  const pbFilterStart = startIso.replace('T', ' ');
  const pbFilterEnd = endIso.replace('T', ' ');

  return {
    days,
    startDate,
    endDate,
    startIso,
    endIso,
    pbFilterStart,
    pbFilterEnd,
  };
}

/**
 * Generates an array of contiguous YYYY-MM-DD date strings between start and end date.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]} Array of YYYY-MM-DD date strings
 */
export function generateDateSeries(startDate, endDate) {
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
export function formatDateLabel(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates percentage safely rounded to 1 decimal place.
 * Returns 0.0 when denominator is zero or invalid.
 *
 * @param {number} part
 * @param {number} total
 * @returns {number} Percentage rounded to 1 decimal place
 */
export function calculatePercentage(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0 || p <= 0) {
    return 0.0;
  }
  return Number(((p / t) * 100).toFixed(1));
}

/**
 * Aggregates user accounts into lifetime role totals and a continuous daily registration timeline.
 *
 * @param {Array<Object>} users
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} User growth analytics
 */
export function aggregateUserGrowth(users = [], startDate, endDate) {
  const safeUsers = Array.isArray(users) ? users : [];

  let totalCustomers = 0;
  let totalOwners = 0;
  let totalAdmins = 0;
  let totalActive = 0;
  let totalDeactivated = 0;

  const dateSeries = generateDateSeries(startDate, endDate);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const dailyMap = new Map();
  for (const d of dateSeries) {
    dailyMap.set(d, {
      date: d,
      label: formatDateLabel(d),
      customer: 0,
      owner: 0,
      admin: 0,
      total: 0,
    });
  }

  let periodNewUsers = 0;

  for (const u of safeUsers) {
    if (!u) continue;

    const role = (u.role || 'customer').toLowerCase().trim();
    if (role === 'owner') {
      totalOwners++;
    } else if (role === 'admin') {
      totalAdmins++;
    } else {
      totalCustomers++;
    }

    if (u.is_active === false) {
      totalDeactivated++;
    } else {
      totalActive++;
    }

    const createdStr = (u.created || '').slice(0, 10);
    if (createdStr >= startDateStr && createdStr <= endDateStr) {
      periodNewUsers++;
      const bucket = dailyMap.get(createdStr);
      if (bucket) {
        if (role === 'owner') {
          bucket.owner++;
        } else if (role === 'admin') {
          bucket.admin++;
        } else {
          bucket.customer++;
        }
        bucket.total++;
      }
    }
  }

  return {
    totals: {
      all: safeUsers.length,
      customers: totalCustomers,
      owners: totalOwners,
      admins: totalAdmins,
      active: totalActive,
      deactivated: totalDeactivated,
    },
    periodNewUsers,
    timeline: dateSeries.map((d) => dailyMap.get(d)),
  };
}

/**
 * Aggregates approved commercial listings by city:
 * Returns Top 5 cities individually + aggregated 'Other' category (D-020).
 * Percentages are calculated using the complete approved inventory.
 *
 * @param {Array<Object>} approvedListings
 * @param {number} [topN=5]
 * @returns {Array<{ city: string, count: number, percentage: number }>}
 */
export function aggregateTopCities(approvedListings = [], topN = 5) {
  const safeListings = Array.isArray(approvedListings) ? approvedListings : [];
  const totalApproved = safeListings.length;

  if (totalApproved === 0) {
    return [];
  }

  const cityCounts = new Map();
  for (const item of safeListings) {
    const rawCity = (item?.city || '').trim();
    const city = rawCity.length > 0 ? rawCity : 'Unknown';
    cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
  }

  // Sort descending by count, then alphabetically by name for deterministic ordering
  const sorted = Array.from(cityCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const topCities = sorted.slice(0, topN);
  const remainingCities = sorted.slice(topN);

  const result = topCities.map(([city, count]) => ({
    city,
    count,
    percentage: calculatePercentage(count, totalApproved),
  }));

  if (remainingCities.length > 0) {
    const otherCount = remainingCities.reduce((sum, [, count]) => sum + count, 0);
    result.push({
      city: 'Other',
      count: otherCount,
      percentage: calculatePercentage(otherCount, totalApproved),
    });
  }

  return result;
}

/**
 * Aggregates approved commercial listings by property category.
 *
 * @param {Array<Object>} approvedListings
 * @returns {Array<{ category: string, count: number, percentage: number }>}
 */
export function aggregateCategories(approvedListings = []) {
  const safeListings = Array.isArray(approvedListings) ? approvedListings : [];
  const totalApproved = safeListings.length;

  const categoryCounts = new Map();
  for (const cat of STANDARD_CATEGORIES) {
    categoryCounts.set(cat, 0);
  }

  for (const item of safeListings) {
    const cat = (item?.category || 'other').toLowerCase().trim();
    if (categoryCounts.has(cat)) {
      categoryCounts.set(cat, categoryCounts.get(cat) + 1);
    } else {
      categoryCounts.set('other', (categoryCounts.get('other') || 0) + 1);
    }
  }

  return STANDARD_CATEGORIES.map((category) => {
    const count = categoryCounts.get(category) || 0;
    return {
      category,
      count,
      percentage: calculatePercentage(count, totalApproved),
    };
  });
}

/**
 * Aggregates approved commercial listings by listing type (rent vs sale).
 *
 * @param {Array<Object>} approvedListings
 * @returns {{ rent: { count: number, percentage: number }, sale: { count: number, percentage: number } }}
 */
export function aggregateListingTypes(approvedListings = []) {
  const safeListings = Array.isArray(approvedListings) ? approvedListings : [];
  const totalApproved = safeListings.length;

  let rentCount = 0;
  let saleCount = 0;

  for (const item of safeListings) {
    const type = (item?.listing_type || 'rent').toLowerCase().trim();
    if (type === 'sale') {
      saleCount++;
    } else {
      rentCount++;
    }
  }

  return {
    rent: {
      count: rentCount,
      percentage: calculatePercentage(rentCount, totalApproved),
    },
    sale: {
      count: saleCount,
      percentage: calculatePercentage(saleCount, totalApproved),
    },
  };
}

/**
 * Aggregates all commercial listings by administrative moderation status.
 *
 * @param {Array<Object>} allListings
 * @returns {{ approved: number, pending: number, rejected: number, archived: number, total: number }}
 */
export function aggregateModerationStatus(allListings = []) {
  const safeListings = Array.isArray(allListings) ? allListings : [];

  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let archived = 0;

  for (const item of safeListings) {
    const status = (item?.status || 'pending').toLowerCase().trim();
    if (status === 'approved') {
      approved++;
    } else if (status === 'rejected') {
      rejected++;
    } else if (status === 'archived') {
      archived++;
    } else {
      pending++;
    }
  }

  return {
    approved,
    pending,
    rejected,
    archived,
    total: safeListings.length,
  };
}

/**
 * Aggregates payment records into gross revenue, status counts, plan breakdown, and daily timeline.
 * Strictly guarantees that pending and failed payments NEVER contribute to gross revenue.
 *
 * @param {Array<Object>} payments
 * @param {Map<string, Object>} plansMap
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} Financial revenue analytics
 */
export function aggregateRevenue(payments = [], plansMap = new Map(), startDate, endDate) {
  const safePayments = Array.isArray(payments) ? payments : [];

  let lifetimeRevenueBdt = 0;
  let successfulTransactions = 0;
  let pendingTransactions = 0;
  let failedTransactions = 0;

  let periodRevenueBdt = 0;
  let periodSuccessfulTransactions = 0;

  const dateSeries = generateDateSeries(startDate, endDate);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const dailyMap = new Map();
  for (const d of dateSeries) {
    dailyMap.set(d, {
      date: d,
      label: formatDateLabel(d),
      revenueBdt: 0,
      transactions: 0,
    });
  }

  // Plan breakdown for successful payments
  const planBreakdownMap = new Map();

  for (const p of safePayments) {
    if (!p) continue;

    const status = (p.status || '').toLowerCase().trim();
    const rawAmount = Number(p.amount);
    const validAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
    const createdStr = (p.created || '').slice(0, 10);

    if (status === 'success') {
      // 1. Authoritative financial contribution: strictly successful
      lifetimeRevenueBdt += validAmount;
      successfulTransactions++;

      // Tally plan breakdown
      const planId = p.plan || 'unknown_plan';
      const planMeta = plansMap.get(planId);
      const planName = planMeta?.name || (validAmount >= 900 ? 'Pro' : 'Starter');
      const planPrice = planMeta?.price || validAmount;

      if (!planBreakdownMap.has(planId)) {
        planBreakdownMap.set(planId, {
          planId,
          name: planName,
          price: planPrice,
          count: 0,
          revenueBdt: 0,
        });
      }
      const planEntry = planBreakdownMap.get(planId);
      planEntry.count++;
      planEntry.revenueBdt += validAmount;

      // Check if within selected timeframe
      if (createdStr >= startDateStr && createdStr <= endDateStr) {
        periodRevenueBdt += validAmount;
        periodSuccessfulTransactions++;

        const bucket = dailyMap.get(createdStr);
        if (bucket) {
          bucket.revenueBdt += validAmount;
          bucket.transactions++;
        }
      }
    } else if (status === 'pending') {
      pendingTransactions++;
    } else {
      failedTransactions++;
    }
  }

  const totalTransactions = successfulTransactions + pendingTransactions + failedTransactions;
  const successRate = calculatePercentage(successfulTransactions, totalTransactions);

  // Calculate percentage of revenue per plan
  const byPlan = Array.from(planBreakdownMap.values()).map((item) => ({
    ...item,
    revenuePercentage: calculatePercentage(item.revenueBdt, lifetimeRevenueBdt),
  }));

  // Sort plans descending by revenue
  byPlan.sort((a, b) => b.revenueBdt - a.revenueBdt);

  return {
    lifetimeRevenueBdt,
    successfulTransactions,
    pendingTransactions,
    failedTransactions,
    totalTransactions,
    successRate,
    periodRevenueBdt,
    periodSuccessfulTransactions,
    byPlan,
    timeline: dateSeries.map((d) => dailyMap.get(d)),
  };
}

/**
 * Aggregates user subscriptions and reveal events into credit consumption metrics and daily timeline.
 * Preserves the 1-reveal = 1-credit invariant and avoids double counting.
 *
 * @param {Array<Object>} subscriptions
 * @param {Array<Object>} periodReveals
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} Credit consumption analytics
 */
export function aggregateCreditConsumption(subscriptions = [], periodReveals = [], startDate, endDate) {
  const safeSubs = Array.isArray(subscriptions) ? subscriptions : [];
  const safeReveals = Array.isArray(periodReveals) ? periodReveals : [];

  let totalCreditsPurchased = 0;
  let totalCreditsConsumed = 0;

  for (const s of safeSubs) {
    if (!s) continue;

    const rawTotal = Number(s.credits_total);
    const validTotal = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;

    const rawUsed = Number(s.credits_used);
    const validUsed = Number.isFinite(rawUsed) && rawUsed >= 0 ? rawUsed : 0;

    totalCreditsPurchased += validTotal;
    totalCreditsConsumed += validUsed;
  }

  const totalCreditsRemaining = Math.max(0, totalCreditsPurchased - totalCreditsConsumed);
  const utilizationRate = calculatePercentage(totalCreditsConsumed, totalCreditsPurchased);

  const dateSeries = generateDateSeries(startDate, endDate);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const dailyMap = new Map();
  for (const d of dateSeries) {
    dailyMap.set(d, {
      date: d,
      label: formatDateLabel(d),
      reveals: 0,
    });
  }

  let periodRevealsCount = 0;

  for (const r of safeReveals) {
    if (!r) continue;

    const revealDateStr = (r.revealed_at || r.created || '').slice(0, 10);
    if (revealDateStr >= startDateStr && revealDateStr <= endDateStr) {
      periodRevealsCount++;
      const bucket = dailyMap.get(revealDateStr);
      if (bucket) {
        bucket.reveals++;
      }
    }
  }

  const days = dateSeries.length > 0 ? dateSeries.length : 1;
  const averageDailyReveals = Number((periodRevealsCount / days).toFixed(1));

  return {
    totalCreditsPurchased,
    totalCreditsConsumed,
    totalCreditsRemaining,
    utilizationRate,
    periodRevealsCount,
    averageDailyReveals,
    timeline: dateSeries.map((d) => dailyMap.get(d)),
  };
}

/**
 * Primary Administrative Platform Analytics Orchestrator (Phase 12, Task 12.2)
 *
 * Retrieves live platform metrics, aggregates user growth, inventory volume,
 * financial revenue, and credit consumption across the requested timeframe preset.
 *
 * @param {Object} [options={}]
 * @param {'7d'|'30d'|'90d'} [options.period='30d'] - Timeframe preset
 * @returns {Promise<Object>} Aggregated admin platform analytics report
 */
export async function getAdminPlatformAnalytics({ period = '30d' } = {}) {
  // 1. Compute timeframe boundaries and daily series
  const boundaries = getTimeframeBoundaries(period);
  const { startDate, endDate, pbFilterStart, pbFilterEnd } = boundaries;

  const pb = await getAdminClient();

  // 2. Fetch required platform collections concurrently via Admin SDK
  let rawUsers = [];
  let rawListings = [];
  let rawPayments = [];
  let rawPlans = [];
  let rawSubs = [];
  let rawReveals = [];

  try {
    const [
      usersResult,
      listingsResult,
      paymentsResult,
      plansResult,
      subsResult,
      revealsResult,
    ] = await Promise.all([
      // A. Platform Users (fields: id, role, is_active, created)
      pb.collection('users').getFullList({
        fields: 'id,role,is_active,created',
        requestKey: null,
      }),

      // B. Commercial Listings (fields: id, city, category, listing_type, status, created)
      pb.collection('listings').getFullList({
        fields: 'id,city,category,listing_type,status,created',
        requestKey: null,
      }),

      // C. Payments (fields: id, amount, currency, status, plan, created)
      pb.collection('payments').getFullList({
        fields: 'id,amount,currency,status,plan,created',
        requestKey: null,
      }),

      // D. Subscription Plans catalog (fields: id, name, price, credits)
      pb.collection('subscription_plans').getFullList({
        fields: 'id,name,price,credits',
        requestKey: null,
      }),

      // E. User Subscriptions (fields: id, credits_total, credits_used, status)
      pb.collection('user_subscriptions').getFullList({
        fields: 'id,credits_total,credits_used,status',
        requestKey: null,
      }),

      // F. Revealed Contacts within period (fields: id, customer, listing, revealed_at, created)
      pb.collection('revealed_contacts').getFullList({
        filter: pb.filter(
          '(revealed_at >= {:start} && revealed_at <= {:end}) || (created >= {:start} && created <= {:end})',
          { start: pbFilterStart, end: pbFilterEnd }
        ),
        fields: 'id,revealed_at,created',
        requestKey: null,
      }),
    ]);

    rawUsers = usersResult || [];
    rawListings = listingsResult || [];
    rawPayments = paymentsResult || [];
    rawPlans = plansResult || [];
    rawSubs = subsResult || [];
    rawReveals = revealsResult || [];
  } catch (err) {
    const safeError = new Error('Failed to retrieve platform analytics from database');
    safeError.status = err?.status || 500;
    throw safeError;
  }

  // 3. Build plans lookup map
  const plansMap = new Map();
  for (const pl of rawPlans) {
    if (pl?.id) {
      plansMap.set(pl.id, {
        id: pl.id,
        name: pl.name,
        price: Number(pl.price) || 0,
        credits: Number(pl.credits) || 0,
      });
    }
  }

  // 4. Calculate User Growth metrics
  const userGrowth = aggregateUserGrowth(rawUsers, startDate, endDate);

  // 5. Calculate Commercial Listing metrics
  const moderationStatus = aggregateModerationStatus(rawListings);
  const approvedListings = rawListings.filter((l) => (l.status || '').toLowerCase().trim() === 'approved');
  const topCities = aggregateTopCities(approvedListings, 5);
  const categories = aggregateCategories(approvedListings);
  const listingTypes = aggregateListingTypes(approvedListings);

  // 6. Calculate Financial Revenue metrics
  const revenue = aggregateRevenue(rawPayments, plansMap, startDate, endDate);

  // 7. Calculate Credit Consumption metrics
  const creditConsumption = aggregateCreditConsumption(rawSubs, rawReveals, startDate, endDate);

  // 8. Construct unified response payload
  return {
    period: String(period || '30d').toLowerCase().trim(),
    timeframe: {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      days: boundaries.days,
    },
    summary: {
      lifetime: {
        grossRevenueBdt: revenue.lifetimeRevenueBdt,
        totalUsers: userGrowth.totals.all,
        activeListings: approvedListings.length,
        creditsConsumed: creditConsumption.totalCreditsConsumed,
        utilizationRate: creditConsumption.utilizationRate,
      },
      period: {
        revenueBdt: revenue.periodRevenueBdt,
        newUsers: userGrowth.periodNewUsers,
        contactReveals: creditConsumption.periodRevealsCount,
        successfulTransactions: revenue.periodSuccessfulTransactions,
      },
    },
    userGrowth,
    listingVolume: {
      totalActive: approvedListings.length,
      byCity: topCities,
      byCategory: categories,
      byType: listingTypes,
      moderationStatus,
    },
    revenue,
    creditConsumption,
  };
}
