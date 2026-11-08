import { z } from 'zod';

/**
 * ShopFinder — Reveal Query & Payload Validators (Phase 10, Tasks 10.7 & 10.8)
 *
 * Implements strict allowlist validation for contact reveal operations:
 * - Reveal history pagination parameters (page, perPage, limit)
 * - Reveal request body validation (listingId)
 */

export const revealHistoryQuerySchema = z.object({
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
    }, z.number({ invalid_type_error: 'Invalid perPage. Must be an integer greater than or equal to 1' })
        .int('Invalid perPage. Must be an integer greater than or equal to 1')
        .min(1, 'Invalid perPage. Must be an integer greater than or equal to 1')
        .optional()
    ),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return Number(val.trim());
      return NaN;
    }, z.number({ invalid_type_error: 'Invalid limit. Must be an integer greater than or equal to 1' })
        .int('Invalid limit. Must be an integer greater than or equal to 1')
        .min(1, 'Invalid limit. Must be an integer greater than or equal to 1')
        .optional()
    ),
});

/**
 * Validates and normalizes query parameters for GET /api/v1/reveal/history (Task 10.8).
 *
 * @param {Object} query - Express req.query
 * @returns {{ page: number, perPage: number }}
 * @throws {Error} With status 400 if validation fails
 */
export function validateRevealHistoryQuery(query = {}) {
  const result = revealHistoryQuerySchema.safeParse(query);
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
  const rawPerPage = data.perPage !== undefined ? data.perPage : data.limit !== undefined ? data.limit : 10;
  // Bounded safe limits: max 100 per page to avoid unbounded database loads
  const perPage = Math.min(rawPerPage, 100);

  return { page, perPage };
}

