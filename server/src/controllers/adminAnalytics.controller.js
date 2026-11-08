import * as adminAnalyticsService from '../services/adminAnalyticsService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Admin Platform Analytics Controller (Phase 12, Task 12.2)
 *
 * Handles platform-wide administrative analytics retrieval endpoints.
 * Strictly restricted to authenticated administrators (D-010, D-019, D-020, D-021).
 */

/**
 * GET /api/v1/admin/analytics
 * Retrieves aggregated platform analytics covering:
 * 1. User growth dynamics (lifetime role totals and period signups).
 * 2. Commercial listing volume (active inventory, Top 5 cities + Other, category, type, and moderation status).
 * 3. Financial revenue metrics (strictly successful BDT payments, plan breakdown, transaction volume, and daily timeline).
 * 4. Credit consumption (lifetime purchased/consumed/remaining, utilization rate, and daily reveal velocity).
 *
 * Query parameters:
 * - period: '7d' | '30d' | '90d' (defaults to '30d' when omitted)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getAdminAnalytics(req, res, next) {
  try {
    const rawPeriod = req.query.period;
    const period =
      rawPeriod === undefined || rawPeriod === null || String(rawPeriod).trim() === ''
        ? '30d'
        : String(rawPeriod).toLowerCase().trim();

    // Validate supported periods (7d, 30d, 90d per D-019)
    if (!adminAnalyticsService.VALID_PERIODS.has(period)) {
      return sendError(
        res,
        "Invalid period parameter. Supported periods: '7d', '30d', '90d'",
        400
      );
    }

    const data = await adminAnalyticsService.getAdminPlatformAnalytics({
      period,
    });

    return sendSuccess(res, data, 200, 'Admin platform analytics retrieved successfully');
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

