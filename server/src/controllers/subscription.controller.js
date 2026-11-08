import * as subscriptionService from '../services/subscription.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateCreatePlan,
  validateUpdatePlan,
  validateAdminPlansQuery,
} from '../validators/subscription.validator.js';

/**
 * ShopFinder — Subscription Plans Controller (Phase 9, Task 9.2)
 *
 * Implements public active plan discovery and administrative plan lifecycle management.
 */

/**
 * GET /api/v1/subscriptions/plans
 * Public endpoint: Retrieves all active subscription plans.
 * Authentication is NOT required.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getPublicPlans(req, res, next) {
  try {
    const plans = await subscriptionService.getActivePlans();
    return sendSuccess(res, { plans }, 200, 'Subscription plans retrieved successfully');
  } catch (err) {
    if (err.status === 503) {
      return sendError(res, err.message, 503);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/plans (also aliased at /api/v1/subscriptions/admin/plans)
 * Admin-only: Retrieves all subscription plans (active and inactive) with pagination and sorting.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getAdminPlans(req, res, next) {
  try {
    const validated = validateAdminPlansQuery(req.query);
    const { plans, pagination } = await subscriptionService.getAllPlansAdmin(validated);
    return sendSuccess(res, { plans, pagination }, 200, 'All subscription plans retrieved successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    if (err.status === 503) {
      return sendError(res, err.message, 503);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/plans/:id
 * Admin-only: Retrieves a single subscription plan by ID.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getAdminPlanById(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await subscriptionService.getPlanById(id);
    return sendSuccess(res, { plan }, 200, 'Subscription plan retrieved successfully');
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}

/**
 * POST /api/v1/admin/plans
 * Admin-only: Creates a new subscription plan with strict input validation.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createAdminPlan(req, res, next) {
  try {
    const data = validateCreatePlan(req.body);
    const plan = await subscriptionService.createPlan(data);
    return sendSuccess(res, { plan }, 201, 'Subscription plan created successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    if (err.status === 409) {
      return sendError(res, err.message, 409);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/plans/:id
 * Admin-only: Updates an existing subscription plan.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateAdminPlan(req, res, next) {
  try {
    const { id } = req.params;
    const data = validateUpdatePlan(req.body);
    const plan = await subscriptionService.updatePlan(id, data);
    return sendSuccess(res, { plan }, 200, 'Subscription plan updated successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    if (err.status === 409) {
      return sendError(res, err.message, 409);
    }
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/plans/:id (also POST /api/v1/admin/plans/:id/deactivate)
 * Admin-only: Soft-deactivates a subscription plan (sets is_active = false).
 * Never deletes records from database.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deactivateAdminPlan(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await subscriptionService.deactivatePlan(id);
    return sendSuccess(res, { plan }, 200, 'Subscription plan deactivated successfully');
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}

