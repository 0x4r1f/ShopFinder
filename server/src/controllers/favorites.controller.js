import * as favoritesService from '../services/favorites.service.js';
import {
  validateListingIdParam,
  validateFavoritesQuery,
} from '../validators/favorites.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Customer Favorites Controller (Phase 8, Task 8.1)
 *
 * Implements endpoints for customer favorites:
 * - POST   /api/v1/favorites/:listingId
 * - DELETE /api/v1/favorites/:listingId
 * - GET    /api/v1/favorites
 */

/**
 * POST /api/v1/favorites/:listingId
 * Saves an approved commercial listing to customer favorites.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveFavorite(req, res, next) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const listingId = validateListingIdParam(req.params);
    const { favorite, alreadySaved } = await favoritesService.saveFavorite(customerId, listingId);

    if (alreadySaved) {
      return sendSuccess(
        res,
        { favorite, already_saved: true },
        200,
        'Listing is already in your favorites'
      );
    }

    return sendSuccess(
      res,
      { favorite, already_saved: false },
      201,
      'Listing saved to favorites successfully'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/favorites/:listingId
 * Removes a saved listing from customer favorites (idempotent).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function removeFavorite(req, res, next) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const listingId = validateListingIdParam(req.params);
    const { removed } = await favoritesService.removeFavorite(customerId, listingId);

    const message = removed
      ? 'Listing removed from favorites successfully'
      : 'Listing is not in your favorites';

    return sendSuccess(res, null, 200, message);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/favorites
 * Retrieves paginated saved listings for the authenticated customer.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getFavorites(req, res, next) {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { page, perPage, sort } = validateFavoritesQuery(req.query);
    const data = await favoritesService.getFavorites(customerId, { page, perPage, sort });

    return sendSuccess(res, data, 200);
  } catch (err) {
    next(err);
  }
}

