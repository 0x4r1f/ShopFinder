import * as ownerAnalyticsService from '../services/ownerAnalyticsService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Owner Analytics Controller (Phase 12, Task 12.1)
 *
 * Handles owner analytics retrieval endpoints.
 */

/**
 * GET /api/v1/owner/analytics
 * Retrieves aggregated and listing-level analytics for authenticated property owner.
 *
 * Query params:
 * - period: '7d' | '30d' (defaults to '7d')
 * - listingId: optional string filter for single listing
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getOwnerAnalytics(req, res, next) {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { period, listingId } = req.query;

    const data = await ownerAnalyticsService.getOwnerAnalytics(ownerId, {
      period,
      listingId,
    });

    return sendSuccess(res, data, 200, 'Owner analytics retrieved successfully');
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

