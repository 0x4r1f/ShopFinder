import * as customerService from '../services/customer.service.js';
import * as revealService from '../services/revealService.js';
import { validateRevealHistoryQuery } from '../validators/reveal.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Customer Portal Controller (Phase 8, Task 8.2 & Phase 9, Task 9.3 & Phase 10, Tasks 10.7 & 10.8)
 *
 * Implements customer-specific portal endpoints.
 */

/**
 * GET /api/v1/customer/dashboard
 * Retrieves customer dashboard overview (credits remaining, active subscriptions, recent saved, recent reveals).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getCustomerDashboard(req, res, next) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const dashboardData = await customerService.getCustomerDashboard(customerId);
    return sendSuccess(res, dashboardData, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/customer/subscriptions
 * Retrieves authoritative active subscription tracking and credit balance for the authenticated customer.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getCustomerSubscriptions(req, res, next) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const subscriptionData = await customerService.getCustomerSubscriptionBalance(customerId);
    return sendSuccess(res, subscriptionData, 200, 'Customer subscriptions retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/customer/reveal
 * Unlocks the private owner contact for a commercial property listing (Phase 10, Task 10.7).
 * Atomically deducts 1 credit for first-time reveals; returns idempotent repeat reveals at 0 credits.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function revealContact(req, res, next) {
  try {
    // 1. Customer identity is derived exclusively from the authenticated session (D-017)
    const customerId = req.user?.id;
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      return sendError(res, 'Authentication required', 401);
    }

    // 2. Validate listingId from request body or route params
    const rawListingId = req.body?.listingId || req.params?.listingId;
    if (!rawListingId || typeof rawListingId !== 'string' || rawListingId.trim() === '') {
      return sendError(res, 'listingId is required and must be a non-empty string.', 400);
    }

    const listingId = rawListingId.trim();

    // 3. Delegate to revealService (D-013, D-014, D-017)
    const result = await revealService.revealContactForCustomer({
      customerId: customerId.trim(),
      listingId,
    });

    const message = result.alreadyRevealed
      ? 'Contact previously revealed (no credits deducted)'
      : 'Contact revealed successfully';

    return sendSuccess(res, result, 200, message);
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    if (status < 500) {
      return sendError(res, err.message, status);
    }
    next(err);
  }
}

/**
 * GET /api/v1/reveal/history
 * Retrieves paginated contact reveal history for the authenticated customer (Phase 10, Task 10.8).
 * Strictly filtered to the authenticated customer (req.user.id).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getRevealHistory(req, res, next) {
  try {
    // 1. Customer identity derived exclusively from authenticated session (req.user.id)
    const customerId = req.user?.id;
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      return sendError(res, 'Authentication required', 401);
    }

    // 2. Validate and normalize query parameters (page, perPage, limit)
    const { page, perPage } = validateRevealHistoryQuery(req.query);

    // 3. Retrieve paginated history from service layer
    const data = await revealService.getCustomerRevealHistory(customerId.trim(), { page, perPage });

    return sendSuccess(res, data, 200, 'Customer reveal history retrieved successfully');
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    if (status < 500) {
      return sendError(res, err.message, status, err.details || null);
    }
    next(err);
  }
}


