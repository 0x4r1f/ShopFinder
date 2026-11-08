import * as adminService from '../services/admin.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validatePendingListingsQuery,
  validateRejectListing,
  validateUsersQuery,
  validateUpdateUserStatus,
} from '../validators/admin.validator.js';

/**
 * ShopFinder — Admin Controller (Phase 7, Tasks 7.1, 7.2, 7.3)
 *
 * Handles administrative requests restricted exclusively to authenticated administrators.
 */

/**
 * GET /api/v1/admin/stats
 * Retrieves live platform statistics and recent platform activity summary (Task 7.1).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getAdminStats(req, res, next) {
  try {
    const stats = await adminService.getAdminStats();
    return sendSuccess(res, stats, 200, 'Admin statistics retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/listings/pending
 * Retrieves paginated pending commercial listings for administrative moderation (Task 7.2).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getPendingListings(req, res, next) {
  try {
    const { page, perPage, sort } = validatePendingListingsQuery(req.query);
    const { listings, pagination } = await adminService.getPendingListings({
      page,
      perPage,
      sort,
    });
    return sendSuccess(res, { listings, pagination }, 200, 'Pending listings retrieved successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    next(err);
  }
}

/**
 * POST /api/v1/admin/listings/:id/approve
 * Approves a commercial listing and clears rejection note (Task 7.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function approveListing(req, res, next) {
  try {
    const { id } = req.params;
    const listing = await adminService.approveListing(id, req.user.id);
    return sendSuccess(res, { listing }, 200, 'Listing approved successfully');
  } catch (err) {
    if (err.status === 403) {
      return sendError(res, err.message, 403);
    }
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}

/**
 * POST /api/v1/admin/listings/:id/reject
 * Rejects a commercial listing with a mandatory reason note (Task 7.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function rejectListing(req, res, next) {
  try {
    const { id } = req.params;
    const { rejection_note } = validateRejectListing(req.body);
    const listing = await adminService.rejectListing(id, req.user.id, rejection_note);
    return sendSuccess(res, { listing }, 200, 'Listing rejected successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    if (err.status === 403) {
      return sendError(res, err.message, 403);
    }
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}

/**
 * POST /api/v1/admin/listings/:id/archive
 * Archives a commercial listing (Task 7.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function archiveListing(req, res, next) {
  try {
    const { id } = req.params;
    const listing = await adminService.archiveListing(id, req.user.id);
    return sendSuccess(res, { listing }, 200, 'Listing archived successfully');
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/users
 * Retrieves paginated users for administrative user management (Task 7.5).
 * Supports search (name, email), role filter, and sorting.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getUsers(req, res, next) {
  try {
    const validated = validateUsersQuery(req.query);
    const { users, pagination } = await adminService.getUsers(validated);
    return sendSuccess(res, { users, pagination }, 200, 'Users retrieved successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/users/:id/status
 * Updates user activation status (Task 7.5).
 * Enforces anti-self-deactivation.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = validateUpdateUserStatus(req.body);
    const user = await adminService.updateUserStatus(id, req.user.id, is_active);
    return sendSuccess(res, { user }, 200, 'User status updated successfully');
  } catch (err) {
    if (err.status === 400) {
      return sendError(res, err.message, 400, err.details || null);
    }
    if (err.status === 403) {
      return sendError(res, err.message, 403);
    }
    if (err.status === 404) {
      return sendError(res, err.message, 404);
    }
    next(err);
  }
}




