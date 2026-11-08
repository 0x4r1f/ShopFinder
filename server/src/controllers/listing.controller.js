import * as listingService from '../services/listing.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Normalization map for incoming category query parameters (Decision 2).
 * Normalizes human-readable labels to official PocketBase schema enum values.
 */
export const CATEGORY_MAP = {
  retail: 'retail',
  shop: 'retail',
  office: 'office',
  restaurant: 'restaurant',
  warehouse: 'warehouse',
  showroom: 'showroom',
  other: 'other',
  'commercial floor': 'other',
  industrial: 'industrial',
  'industrial space': 'industrial',
};

/**
 * Normalizes a category string to the official schema enum value.
 *
 * @param {string} val
 * @returns {string|null} Normalized enum value or null if invalid
 */
export function normalizeCategory(val) {
  if (!val || typeof val !== 'string') return null;
  const key = val.trim().toLowerCase();
  return CATEGORY_MAP[key] || null;
}

/**
 * Parses and strictly validates a numeric query parameter.
 * Rejects negative values, malformed strings, NaN, Infinity, or excessive values.
 *
 * @param {string} val
 * @param {string} paramName
 * @returns {number|undefined}
 */
function parseNumericFilter(val, paramName) {
  if (val === undefined || val === null || val === '') return undefined;
  const trimmed = String(val).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    const err = new Error(`Invalid ${paramName}: must be a non-negative finite number`);
    err.status = 400;
    throw err;
  }
  const num = Number(trimmed);
  if (isNaN(num) || !isFinite(num) || num < 0 || num > 1e12) {
    const err = new Error(`Invalid ${paramName}: must be a non-negative finite number`);
    err.status = 400;
    throw err;
  }
  return num;
}

/**
 * ShopFinder — Public Listing Controller (Phase 5, Task 5.1, 5.2, 5.3)
 *
 * Implements public listing discovery endpoints.
 * All responses are sanitized to prevent sensitive data leakage.
 */

/**
 * Strict allowlist mapping of public sorting options to PocketBase sort expressions (Task 5.4).
 */
export const SORT_MAP = {
  newest: '-created',
  price_asc: 'price',
  price_desc: '-price',
  '-created': '-created',
  price: 'price',
  '-price': '-price',
};

/**
 * GET /api/v1/listings
 * Retrieves approved commercial listings with multi-parameter search, filtering, sorting, and pagination (Task 5.4).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getListings(req, res, next) {
  try {
    // 1. Pagination validation (page >= 1, perPage clamped 1-100 with integer validation)
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

    // 2. Sort validation against allowlist (Decision 1 — Option B: zero raw input reflection)
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

    // 3. Category validation & normalization (Decision 1 — Option B)
    let category;
    if (req.query.category !== undefined && req.query.category !== null && String(req.query.category).trim() !== '') {
      category = normalizeCategory(String(req.query.category));
      if (!category) {
        return sendError(
          res,
          'Invalid category. Must be one of: retail, office, restaurant, warehouse, showroom, industrial, other',
          400
        );
      }
    }

    // 4. Listing type validation (Decision 1 — Option B)
    let listing_type;
    if (req.query.listing_type !== undefined && req.query.listing_type !== null && String(req.query.listing_type).trim() !== '') {
      const type = String(req.query.listing_type).trim().toLowerCase();
      if (type !== 'rent' && type !== 'sale') {
        return sendError(res, "Invalid listing_type. Must be 'rent' or 'sale'", 400);
      }
      listing_type = type;
    }

    // 5. Numeric range validations
    let min_price;
    let max_price;
    let min_area;
    let max_area;

    try {
      min_price = parseNumericFilter(req.query.min_price, 'min_price');
      max_price = parseNumericFilter(req.query.max_price, 'max_price');
      min_area = parseNumericFilter(req.query.min_area, 'min_area');
      max_area = parseNumericFilter(req.query.max_area, 'max_area');
    } catch (numErr) {
      return sendError(res, numErr.message, 400);
    }

    if (min_price !== undefined && max_price !== undefined && min_price > max_price) {
      return sendError(res, 'Invalid price range: min_price cannot exceed max_price', 400);
    }

    if (min_area !== undefined && max_area !== undefined && min_area > max_area) {
      return sendError(res, 'Invalid area range: min_area cannot exceed max_area', 400);
    }

    // 6. Location text matching
    const city = req.query.city && String(req.query.city).trim() ? String(req.query.city).trim().slice(0, 100) : undefined;
    const area = req.query.area && String(req.query.area).trim() ? String(req.query.area).trim().slice(0, 100) : undefined;

    // 7. Keyword free-text search across title, description, address
    const search = req.query.search && String(req.query.search).trim() ? String(req.query.search).trim().slice(0, 150) : undefined;

    const listings = await listingService.getListings({
      page,
      perPage,
      sort,
      category,
      listing_type,
      min_price,
      max_price,
      min_area,
      max_area,
      city,
      area,
      search,
    });

    const pagination = listings.pagination || {
      page,
      perPage,
      totalItems: listings.length,
      totalPages: Math.max(1, Math.ceil(listings.length / perPage)),
    };

    return sendSuccess(res, { listings, pagination }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/listings/featured
 * Retrieves approved, featured commercial listings for the homepage.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getFeaturedListings(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 6;
    const listings = await listingService.getFeaturedListings({ limit });

    return sendSuccess(res, { listings }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/listings/:id
 * Retrieves a single commercial listing with image gallery (Phase 5, Task 5.5).
 * Enforces ownership/admin preview rules for unapproved listings.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getListingById(req, res, next) {
  try {
    const { id } = req.params;
    const listing = await listingService.getListingById(id, { user: req.user });

    return sendSuccess(res, { listing }, 200);
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Listing not found', 404);
    }
    next(err);
  }
}

/**
 * POST /api/v1/listings
 * Creates a new commercial property listing (Phase 6, Task 6.1).
 * Restricted to authenticated users with 'owner' role.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createListing(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const listing = await listingService.createListing(userId, req.body);
    return sendSuccess(res, { listing }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/listings/:id
 * Updates an existing commercial property listing (Phase 6, Task 6.2).
 * Restricted to authenticated owner of the listing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateListing(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    const listing = await listingService.updateListing(id, userId, req.body);
    return sendSuccess(res, { listing }, 200);
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Listing not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    next(err);
  }
}

/**
 * DELETE /api/v1/listings/:id
 * Permanently deletes a commercial property listing (Phase 6, Task 6.2).
 * Restricted to authenticated owner of the listing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteListing(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    const result = await listingService.deleteListing(id, userId);
    return sendSuccess(res, null, 200, result.message || 'Listing deleted successfully');
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Listing not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    next(err);
  }
}

/**
 * POST /api/v1/listings/:id/images
 * Uploads one or more images to an owner's listing (Phase 6, Task 6.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function uploadImages(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    const result = await listingService.uploadListingImages(id, userId, req.files);
    return sendSuccess(res, result, 201);
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Listing not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    if (err.status === 400) {
      return sendError(res, err.message || 'Bad request', 400);
    }
    next(err);
  }
}

/**
 * DELETE /api/v1/listings/:id/images/:imageId
 * Deletes an individual listing image (Phase 6, Task 6.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteImage(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id, imageId } = req.params;
    const result = await listingService.deleteListingImage(id, imageId, userId);
    return sendSuccess(res, null, 200, result.message || 'Image deleted successfully');
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/listings/:id/images/:imageId/cover
 * Sets the specified image as the cover photo for the listing (Phase 6, Task 6.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function setCoverImage(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id, imageId } = req.params;
    const result = await listingService.setCoverListingImage(id, imageId, userId);
    return sendSuccess(res, result, 200);
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    next(err);
  }
}

/**
 * PUT /api/v1/listings/:id/images/order
 * Reorders the images belonging to a listing (Phase 6, Task 6.3).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function reorderImages(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    const result = await listingService.reorderListingImages(id, userId, req.body.order);
    return sendSuccess(res, result, 200);
  } catch (err) {
    if (err.status === 404) {
      return sendError(res, err.message || 'Not found', 404);
    }
    if (err.status === 403) {
      return sendError(res, err.message || 'Access denied', 403);
    }
    if (err.status === 400) {
      return sendError(res, err.message || 'Bad request', 400);
    }
    next(err);
  }
}





