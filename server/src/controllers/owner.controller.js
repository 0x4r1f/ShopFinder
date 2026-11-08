import * as listingService from '../services/listing.service.js';
import * as ownerProfileService from '../services/ownerProfile.service.js';
import { SORT_MAP } from './listing.controller.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Owner Portal Controller (Phase 6, Task 6.2)
 *
 * Handles owner management operations restricted to authenticated owners.
 */

/**
 * GET /api/v1/owner/listings
 * Retrieves all commercial listings belonging exclusively to the authenticated owner.
 * Returns records across all statuses (pending, approved, rejected, archived).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getOwnerListings(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    // 1. Pagination validation
    let page = 1;
    if (req.query.page !== undefined && req.query.page !== null && String(req.query.page).trim() !== '') {
      const parsedPage = Number(req.query.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return sendError(res, 'Invalid page. Must be an integer greater than or equal to 1', 400);
      }
      page = parsedPage;
    }

    let perPage = 12;
    const rawPerPage = req.query.perPage !== undefined ? req.query.perPage : req.query.limit;
    if (rawPerPage !== undefined && rawPerPage !== null && String(rawPerPage).trim() !== '') {
      const trimmed = String(rawPerPage).trim();
      const parsedPerPage = Number(trimmed);
      if (!Number.isInteger(parsedPerPage) || isNaN(parsedPerPage) || !/^-?\d+$/.test(trimmed)) {
        return sendError(res, 'Invalid perPage. Must be an integer', 400);
      }
      perPage = Math.min(Math.max(parsedPerPage, 1), 100);
    }

    // 2. Sort validation against allowlist
    let sort = '-created';
    if (req.query.sort !== undefined && req.query.sort !== null && String(req.query.sort) !== '') {
      const rawSort = String(req.query.sort);
      const mapped = SORT_MAP[rawSort];
      if (!mapped) {
        return sendError(
          res,
          'Invalid sort option. Must be one of: newest, price_asc, price_desc, -created, price, -price',
          400
        );
      }
      sort = mapped;
    }

    const { listings, pagination } = await listingService.getOwnerListings(userId, {
      page,
      perPage,
      sort,
    });

    return sendSuccess(res, { listings, pagination }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/owner/profile
 * Retrieves authenticated owner's business profile including private contact phone (Phase 6, Task 6.7).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getOwnerProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const profile = await ownerProfileService.getOwnerProfile(userId);
    return sendSuccess(res, { profile }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/owner/profile
 * Updates authenticated owner's business profile fields and private contact phone (Phase 6, Task 6.7).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateOwnerProfile(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const bodyKeys = req.body ? Object.keys(req.body) : [];
    if (bodyKeys.length === 0 && !req.file) {
      return sendError(res, 'At least one field must be provided for update', 400);
    }

    const profile = await ownerProfileService.updateOwnerProfile(userId, req.body || {}, req.file);
    return sendSuccess(res, { profile }, 200, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
}

