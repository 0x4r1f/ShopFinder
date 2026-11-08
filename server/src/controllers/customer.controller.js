import * as customerService from '../services/customer.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Customer Portal Controller (Phase 8, Task 8.2 & Phase 9, Task 9.3)
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
