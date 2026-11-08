import { z } from 'zod';

/**
 * ShopFinder — Favorites Query & Param Validation (Phase 8, Task 8.1)
 *
 * Enforces strict validation and allowlisting for customer favorite operations:
 * - Listing ID route parameter validation
 * - Pagination parameters (page, perPage, limit)
 * - Sorting allowlist for saved listings
 */

/**
 * Approved sort options for favorites.
 */
export const FAVORITES_SORT_MAP = Object.freeze({
  '-saved_at': '-saved_at',
  saved_at: 'saved_at',
  newest: '-saved_at',
  oldest: 'saved_at',
  '-created': '-created',
  created: 'created',
});

/**
 * Route parameter schema for listingId.
 * Validates alphanumeric PocketBase record IDs (15 characters) and standard ID strings.
 */
export const listingIdParamSchema = z.object({
  listingId: z
    .string({ required_error: 'Listing ID is required' })
    .trim()
    .min(1, 'Listing ID cannot be empty')
    .max(50, 'Invalid listing ID format')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid listing ID format'),
});

/**
 * Query parameter schema for GET /api/v1/favorites.
 */
export const favoritesQuerySchema = z.object({
  page: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return Number(val.trim());
      return NaN;
    }, z.number({ invalid_type_error: 'Invalid page. Must be an integer greater than or equal to 1' })
        .int('Invalid page. Must be an integer greater than or equal to 1')
        .min(1, 'Invalid page. Must be an integer greater than or equal to 1')
        .optional()
    ),

  perPage: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return Number(val.trim());
      return NaN;
    }, z.number({ invalid_type_error: 'Invalid perPage. Must be an integer between 1 and 100' })
        .int('Invalid perPage. Must be an integer between 1 and 100')
        .min(1, 'Invalid perPage. Must be an integer between 1 and 100')
        .max(100, 'Invalid perPage. Must be an integer between 1 and 100')
        .optional()
    ),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return Number(val.trim());
      return NaN;
    }, z.number({ invalid_type_error: 'Invalid limit. Must be an integer between 1 and 100' })
        .int('Invalid limit. Must be an integer between 1 and 100')
        .min(1, 'Invalid limit. Must be an integer between 1 and 100')
        .max(100, 'Invalid limit. Must be an integer between 1 and 100')
        .optional()
    ),

  sort: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return String(val).trim();
    }, z.string()
        .refine((val) => Object.prototype.hasOwnProperty.call(FAVORITES_SORT_MAP, val), {
          message: 'Unsupported sort option. Supported: -saved_at, saved_at, newest, oldest, -created, created',
        })
        .optional()
    ),
});

/**
 * Validates the listingId route parameter.
 *
 * @param {Object} params - req.params
 * @returns {string} Sanitized listingId
 * @throws {Error} With status 400 if validation fails
 */
export function validateListingIdParam(params = {}) {
  const result = listingIdParamSchema.safeParse(params);
  if (!result.success) {
    const issue = result.error.issues[0];
    const err = new Error(issue.message);
    err.status = 400;
    err.details = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'listingId',
      message: i.message,
    }));
    throw err;
  }
  return result.data.listingId;
}

/**
 * Validates and normalizes query parameters for GET /api/v1/favorites.
 *
 * @param {Object} query - req.query
 * @returns {{ page: number, perPage: number, sort: string }}
 * @throws {Error} With status 400 if validation fails
 */
export function validateFavoritesQuery(query = {}) {
  const result = favoritesQuerySchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const err = new Error(issue.message);
    err.status = 400;
    err.details = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'query',
      message: i.message,
    }));
    throw err;
  }

  const data = result.data;
  const page = data.page !== undefined ? data.page : 1;
  const perPage = data.perPage !== undefined ? data.perPage : data.limit !== undefined ? data.limit : 10;
  const sort = data.sort ? FAVORITES_SORT_MAP[data.sort] : '-saved_at';

  return { page, perPage, sort };
}

