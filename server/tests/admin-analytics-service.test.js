import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_PERIODS,
  STANDARD_CATEGORIES,
  getTimeframeBoundaries,
  generateDateSeries,
  formatDateLabel,
  calculatePercentage,
  aggregateUserGrowth,
  aggregateTopCities,
  aggregateCategories,
  aggregateListingTypes,
  aggregateModerationStatus,
  aggregateRevenue,
  aggregateCreditConsumption,
  getAdminPlatformAnalytics,
} from '../src/services/adminAnalyticsService.js';
import { getAdminClient } from '../src/config/pocketbase.js';

describe('Phase 12, Task 12.2 — Admin Analytics Service Tests', () => {
  describe('Timeframe Boundaries & Date Utilities (D-019)', () => {
    it('supports 7d, 30d, and 90d periods', () => {
      assert.equal(VALID_PERIODS.has('7d'), true);
      assert.equal(VALID_PERIODS.has('30d'), true);
      assert.equal(VALID_PERIODS.has('90d'), true);
      assert.equal(VALID_PERIODS.has('14d'), false);
    });

    it('computes correct day count and UTC boundaries for 7d', () => {
      const ref = new Date('2026-11-08T15:30:00.000Z');
      const b = getTimeframeBoundaries('7d', ref);

      assert.equal(b.days, 7);
      assert.equal(b.startDate.toISOString().slice(0, 10), '2026-11-02');
      assert.equal(b.endDate.toISOString().slice(0, 10), '2026-11-08');
      assert.ok(b.pbFilterStart.includes('2026-11-02 00:00:00'));
      assert.ok(b.pbFilterEnd.includes('2026-11-08 23:59:59'));
    });

    it('computes correct day count and UTC boundaries for 30d', () => {
      const ref = new Date('2026-11-08T15:30:00.000Z');
      const b = getTimeframeBoundaries('30d', ref);

      assert.equal(b.days, 30);
      assert.equal(b.startDate.toISOString().slice(0, 10), '2026-10-10');
      assert.equal(b.endDate.toISOString().slice(0, 10), '2026-11-08');
    });

    it('computes correct day count and UTC boundaries for 90d', () => {
      const ref = new Date('2026-11-08T15:30:00.000Z');
      const b = getTimeframeBoundaries('90d', ref);

      assert.equal(b.days, 90);
      assert.equal(b.endDate.toISOString().slice(0, 10), '2026-11-08');
    });

    it('rejects unsupported periods with HTTP 400', () => {
      assert.throws(
        () => getTimeframeBoundaries('1y'),
        (err) => err.status === 400 && err.message.includes("Supported periods: '7d', '30d', '90d'")
      );
      assert.throws(
        () => getTimeframeBoundaries(''),
        (err) => err.status === 400
      );
    });

    it('generates contiguous day series without gaps', () => {
      const start = new Date('2026-11-01T00:00:00.000Z');
      const end = new Date('2026-11-07T23:59:59.999Z');
      const series = generateDateSeries(start, end);

      assert.equal(series.length, 7);
      assert.deepEqual(series, [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ]);
    });

    it('formats date labels safely', () => {
      assert.equal(formatDateLabel('2026-11-02'), 'Nov 2');
      assert.equal(formatDateLabel('invalid-date'), 'invalid-date');
    });

    it('calculates percentages safely and avoids NaN on zero denominator', () => {
      assert.equal(calculatePercentage(5, 10), 50.0);
      assert.equal(calculatePercentage(1, 3), 33.3);
      assert.equal(calculatePercentage(0, 10), 0.0);
      assert.equal(calculatePercentage(10, 0), 0.0);
      assert.equal(calculatePercentage(0, 0), 0.0);
      assert.equal(calculatePercentage(-5, 10), 0.0);
      assert.equal(calculatePercentage(null, 10), 0.0);
    });
  });

  describe('User Growth Aggregation', () => {
    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-11-03T23:59:59.999Z');

    it('handles empty user array gracefully', () => {
      const res = aggregateUserGrowth([], start, end);
      assert.equal(res.totals.all, 0);
      assert.equal(res.totals.customers, 0);
      assert.equal(res.totals.owners, 0);
      assert.equal(res.totals.admins, 0);
      assert.equal(res.totals.active, 0);
      assert.equal(res.totals.deactivated, 0);
      assert.equal(res.periodNewUsers, 0);
      assert.equal(res.timeline.length, 3);
      assert.deepEqual(res.timeline[0], {
        date: '2026-11-01',
        label: 'Nov 1',
        customer: 0,
        owner: 0,
        admin: 0,
        total: 0,
      });
    });

    it('aggregates role totals and maps timeline registrations accurately', () => {
      const users = [
        { id: 'u1', role: 'customer', is_active: true, created: '2026-11-01 10:00:00.000Z' },
        { id: 'u2', role: 'customer', is_active: false, created: '2026-11-01 12:00:00.000Z' },
        { id: 'u3', role: 'owner', is_active: true, created: '2026-11-02 14:00:00.000Z' },
        { id: 'u4', role: 'admin', is_active: true, created: '2026-10-25 08:00:00.000Z' }, // Outside period
      ];

      const res = aggregateUserGrowth(users, start, end);
      assert.equal(res.totals.all, 4);
      assert.equal(res.totals.customers, 2);
      assert.equal(res.totals.owners, 1);
      assert.equal(res.totals.admins, 1);
      assert.equal(res.totals.active, 3);
      assert.equal(res.totals.deactivated, 1);
      assert.equal(res.periodNewUsers, 3);

      assert.equal(res.timeline[0].customer, 2);
      assert.equal(res.timeline[0].total, 2);
      assert.equal(res.timeline[1].owner, 1);
      assert.equal(res.timeline[1].total, 1);
      assert.equal(res.timeline[2].total, 0);
    });
  });

  describe('Commercial Listing Volume Aggregations (D-020)', () => {
    it('aggregates top 5 cities and groups remaining into Other with full-inventory percentage', () => {
      const listings = [
        { city: 'Dhaka' },
        { city: 'Dhaka' },
        { city: 'Dhaka' },
        { city: 'Dhaka' },
        { city: 'Chittagong' },
        { city: 'Chittagong' },
        { city: 'Sylhet' },
        { city: 'Rajshahi' },
        { city: 'Khulna' },
        { city: 'Barisal' }, // 6th city -> should be in Other
        { city: 'Rangpur' }, // 7th city -> should be in Other
      ];

      const topCities = aggregateTopCities(listings, 5);
      assert.equal(topCities.length, 6); // 5 top cities + Other

      assert.equal(topCities[0].city, 'Dhaka');
      assert.equal(topCities[0].count, 4);
      assert.equal(topCities[0].percentage, 36.4); // 4 / 11 * 100

      assert.equal(topCities[1].city, 'Chittagong');
      assert.equal(topCities[1].count, 2);

      const other = topCities.find((c) => c.city === 'Other');
      assert.ok(other);
      assert.equal(other.count, 2); // Barisal (1) + Rangpur (1)
      assert.equal(other.percentage, 18.2); // 2 / 11 * 100

      // Sum of percentages across full inventory should equal 100% (+/- rounding)
      const sumPercentage = topCities.reduce((sum, c) => sum + c.percentage, 0);
      assert.ok(sumPercentage >= 99.5 && sumPercentage <= 100.5);
    });

    it('does not create Other bucket if total cities <= 5', () => {
      const listings = [{ city: 'Dhaka' }, { city: 'Chittagong' }, { city: 'Sylhet' }];

      const topCities = aggregateTopCities(listings, 5);
      assert.equal(topCities.length, 3);
      assert.equal(topCities.some((c) => c.city === 'Other'), false);
    });

    it('handles empty listing array for cities gracefully', () => {
      const res = aggregateTopCities([]);
      assert.deepEqual(res, []);
    });

    it('aggregates commercial categories across all 7 standard categories', () => {
      const listings = [
        { category: 'retail' },
        { category: 'retail' },
        { category: 'office' },
        { category: 'custom_type' }, // Falls back to other
      ];

      const cats = aggregateCategories(listings);
      assert.equal(cats.length, STANDARD_CATEGORIES.length);

      const retail = cats.find((c) => c.category === 'retail');
      assert.equal(retail.count, 2);
      assert.equal(retail.percentage, 50.0);

      const office = cats.find((c) => c.category === 'office');
      assert.equal(office.count, 1);
      assert.equal(office.percentage, 25.0);

      const other = cats.find((c) => c.category === 'other');
      assert.equal(other.count, 1);
      assert.equal(other.percentage, 25.0);
    });

    it('aggregates rent vs sale listing types accurately', () => {
      const listings = [
        { listing_type: 'rent' },
        { listing_type: 'rent' },
        { listing_type: 'sale' },
      ];

      const types = aggregateListingTypes(listings);
      assert.equal(types.rent.count, 2);
      assert.equal(types.rent.percentage, 66.7);
      assert.equal(types.sale.count, 1);
      assert.equal(types.sale.percentage, 33.3);
    });

    it('aggregates moderation status counts independently', () => {
      const listings = [
        { status: 'approved' },
        { status: 'approved' },
        { status: 'pending' },
        { status: 'rejected' },
        { status: 'archived' },
      ];

      const mod = aggregateModerationStatus(listings);
      assert.equal(mod.approved, 2);
      assert.equal(mod.pending, 1);
      assert.equal(mod.rejected, 1);
      assert.equal(mod.archived, 1);
      assert.equal(mod.total, 5);
    });
  });

  describe('Financial Revenue Aggregations (Strict Success Filter)', () => {
    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-11-03T23:59:59.999Z');

    const plansMap = new Map([
      ['p_starter', { id: 'p_starter', name: 'Starter', price: 299, credits: 10 }],
      ['p_pro', { id: 'p_pro', name: 'Pro', price: 999, credits: 100 }],
    ]);

    it('STRICT FINANCIAL INVARIANT: pending and failed payments NEVER contribute to revenue', () => {
      const payments = [
        // Successful payment within period -> Contributes 299
        {
          id: 'pay_1',
          amount: 299,
          currency: 'BDT',
          status: 'success',
          plan: 'p_starter',
          created: '2026-11-01 10:00:00.000Z',
        },
        // Successful payment outside period -> Contributes to lifetime (999), not period
        {
          id: 'pay_2',
          amount: 999,
          currency: 'BDT',
          status: 'success',
          plan: 'p_pro',
          created: '2026-10-20 10:00:00.000Z',
        },
        // Pending payment (5000) -> MUST NOT BE INCLUDED IN REVENUE
        {
          id: 'pay_3',
          amount: 5000,
          currency: 'BDT',
          status: 'pending',
          plan: 'p_starter',
          created: '2026-11-01 11:00:00.000Z',
        },
        // Failed payment (10000) -> MUST NOT BE INCLUDED IN REVENUE
        {
          id: 'pay_4',
          amount: 10000,
          currency: 'BDT',
          status: 'failed',
          plan: 'p_pro',
          created: '2026-11-02 11:00:00.000Z',
        },
      ];

      const res = aggregateRevenue(payments, plansMap, start, end);

      // Lifetime gross revenue = 299 + 999 = 1298 (ZERO from 5000 pending or 10000 failed)
      assert.equal(res.lifetimeRevenueBdt, 1298);
      assert.equal(res.successfulTransactions, 2);
      assert.equal(res.pendingTransactions, 1);
      assert.equal(res.failedTransactions, 1);
      assert.equal(res.totalTransactions, 4);
      assert.equal(res.successRate, 50.0);

      // Period revenue = only pay_1 = 299
      assert.equal(res.periodRevenueBdt, 299);
      assert.equal(res.periodSuccessfulTransactions, 1);

      // Timeline check
      assert.equal(res.timeline[0].revenueBdt, 299);
      assert.equal(res.timeline[0].transactions, 1);
      assert.equal(res.timeline[1].revenueBdt, 0); // pay_4 failed on 11-02 -> 0 revenue
      assert.equal(res.timeline[1].transactions, 0);

      // Plan breakdown
      const starter = res.byPlan.find((p) => p.name === 'Starter');
      assert.equal(starter.count, 1);
      assert.equal(starter.revenueBdt, 299);

      const pro = res.byPlan.find((p) => p.name === 'Pro');
      assert.equal(pro.count, 1);
      assert.equal(pro.revenueBdt, 999);
    });

    it('handles empty payments list without NaN', () => {
      const res = aggregateRevenue([], plansMap, start, end);
      assert.equal(res.lifetimeRevenueBdt, 0);
      assert.equal(res.successfulTransactions, 0);
      assert.equal(res.pendingTransactions, 0);
      assert.equal(res.failedTransactions, 0);
      assert.equal(res.successRate, 0.0);
      assert.equal(res.periodRevenueBdt, 0);
      assert.deepEqual(res.byPlan, []);
    });
  });

  describe('Credit Consumption & Reveal Velocity', () => {
    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-11-03T23:59:59.999Z');

    it('aggregates purchased, consumed, and remaining credits accurately', () => {
      const subscriptions = [
        { id: 's1', credits_total: 10, credits_used: 4 },
        { id: 's2', credits_total: 100, credits_used: 20 },
      ];

      const periodReveals = [
        { id: 'r1', revealed_at: '2026-11-01 09:00:00.000Z' },
        { id: 'r2', revealed_at: '2026-11-01 10:00:00.000Z' },
        { id: 'r3', revealed_at: '2026-11-03 14:00:00.000Z' },
      ];

      const res = aggregateCreditConsumption(subscriptions, periodReveals, start, end);

      assert.equal(res.totalCreditsPurchased, 110);
      assert.equal(res.totalCreditsConsumed, 24);
      assert.equal(res.totalCreditsRemaining, 86);
      assert.equal(res.utilizationRate, 21.8); // 24 / 110 * 100

      assert.equal(res.periodRevealsCount, 3);
      assert.equal(res.averageDailyReveals, 1.0); // 3 / 3 days

      assert.equal(res.timeline[0].reveals, 2);
      assert.equal(res.timeline[1].reveals, 0);
      assert.equal(res.timeline[2].reveals, 1);
    });

    it('handles zero subscriptions without NaN', () => {
      const res = aggregateCreditConsumption([], [], start, end);
      assert.equal(res.totalCreditsPurchased, 0);
      assert.equal(res.totalCreditsConsumed, 0);
      assert.equal(res.totalCreditsRemaining, 0);
      assert.equal(res.utilizationRate, 0.0);
      assert.equal(res.periodRevealsCount, 0);
    });
  });

  describe('Integrated getAdminPlatformAnalytics Orchestrator', () => {
    it('executes end-to-end against database and returns standardized payload structure', async () => {
      const analytics = await getAdminPlatformAnalytics({ period: '7d' });

      assert.equal(analytics.period, '7d');
      assert.equal(analytics.timeframe.days, 7);
      assert.ok(analytics.timeframe.startDate);
      assert.ok(analytics.timeframe.endDate);

      // Summary checks
      assert.ok(typeof analytics.summary.lifetime.grossRevenueBdt === 'number');
      assert.ok(typeof analytics.summary.lifetime.totalUsers === 'number');
      assert.ok(typeof analytics.summary.lifetime.activeListings === 'number');
      assert.ok(typeof analytics.summary.lifetime.creditsConsumed === 'number');
      assert.ok(typeof analytics.summary.lifetime.utilizationRate === 'number');

      // User growth checks
      assert.ok(typeof analytics.userGrowth.totals.all === 'number');
      assert.equal(analytics.userGrowth.timeline.length, 7);

      // Listing volume checks
      assert.ok(Array.isArray(analytics.listingVolume.byCity));
      assert.equal(analytics.listingVolume.byCategory.length, STANDARD_CATEGORIES.length);
      assert.ok(typeof analytics.listingVolume.byType.rent.count === 'number');
      assert.ok(typeof analytics.listingVolume.moderationStatus.total === 'number');

      // Revenue checks
      assert.ok(typeof analytics.revenue.lifetimeRevenueBdt === 'number');
      assert.equal(analytics.revenue.timeline.length, 7);

      // Credit consumption checks
      assert.ok(typeof analytics.creditConsumption.totalCreditsPurchased === 'number');
      assert.equal(analytics.creditConsumption.timeline.length, 7);
    });

    it('rejects invalid period with status 400', async () => {
      await assert.rejects(
        () => getAdminPlatformAnalytics({ period: '15d' }),
        (err) => err.status === 400
      );
    });
  });
});

