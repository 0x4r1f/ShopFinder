import { z } from 'zod';

/**
 * ShopFinder — Admin Query Validation (Phase 7, Task 7.2)
 *
 * Strict validation and allowlisting for administrative review queue queries.
 */

export const ADMIN_SORT_MAP = {
  newest: '-created',
  oldest: 'created',
  '-created': '-created',
  created: 'created',
};

export const pendingListingsQuerySchema = z.object({
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
        .refine((val) => Object.prototype.hasOwnProperty.call(ADMIN_SORT_MAP, val), {
          message: 'Invalid sort option. Must be one of: newest, oldest, -created, created',
        })
        .optional()
    ),
});

/**
 * Validates and normalizes administrative pending listings query parameters.
 *
 * @param {Object} query - Incoming req.query object
 * @returns {{ page: number, perPage: number, sort: string }}
 * @throws {Error} If query parameters fail validation (status 400)
 */
export function validatePendingListingsQuery(query = {}) {
  const result = pendingListingsQuerySchema.safeParse(query);
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
  const sort = data.sort ? ADMIN_SORT_MAP[data.sort] : '-created';

  return { page, perPage, sort };
}

/**
 * Schema for listing rejection request body (POST /api/v1/admin/listings/:id/reject).
 *
 * Requirements:
 * - rejection_note is required string
 * - Trims whitespace before length validation
 * - Must contain 1 to 1000 characters after trimming
 * - Missing, empty, whitespace-only, or > 1000 characters are rejected with HTTP 400
 */
export const rejectListingSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object') return val;
    const note =
      val.rejection_note !== undefined
        ? val.rejection_note
        : val.reason !== undefined
        ? val.reason
        : val.note;
    return {
      ...val,
      rejection_note: note,
    };
  },
  z.object({
    rejection_note: z
      .string({
        message: 'Rejection note is required',
      })
      .transform((val) => val.trim())
      .refine((val) => val.length >= 1, {
        message: 'Rejection note cannot be empty',
      })
      .refine((val) => val.length <= 1000, {
        message: 'Rejection note cannot exceed 1000 characters',
      }),
  })
);

/**
 * Validates and normalizes listing rejection request body.
 *
 * @param {Object} body - Incoming req.body object
 * @returns {{ rejection_note: string }}
 * @throws {Error} If validation fails (status 400)
 */
export function validateRejectListing(body = {}) {
  const result = rejectListingSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const err = new Error(issue.message);
    err.status = 400;
    err.details = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'rejection_note',
      message: i.message,
    }));
    throw err;
  }

  return result.data;
}

/**
 * ShopFinder — Admin User Management Query Validation (Phase 7, Task 7.5)
 */

export const ADMIN_USERS_SORT_MAP = {
  newest: '-created',
  oldest: 'created',
  '-created': '-created',
  created: 'created',
  name: 'name',
  '-name': '-name',
  role: 'role',
  '-role': '-role',
  is_active: 'is_active',
  '-is_active': '-is_active',
};

export const SUPPORTED_ROLES = ['customer', 'owner', 'admin'];

export const usersQuerySchema = z.object({
  page: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) return Number(val.trim());
      return NaN;
    }, z.number({ message: 'Invalid page. Must be an integer greater than or equal to 1' })
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
    }, z.number({ message: 'Invalid perPage. Must be an integer between 1 and 100' })
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
    }, z.number({ message: 'Invalid limit. Must be an integer between 1 and 100' })
        .int('Invalid limit. Must be an integer between 1 and 100')
        .min(1, 'Invalid limit. Must be an integer between 1 and 100')
        .max(100, 'Invalid limit. Must be an integer between 1 and 100')
        .optional()
    ),

  search: z
    .preprocess((val) => {
      if (val === undefined || val === null) return undefined;
      const str = String(val).trim();
      return str === '' ? undefined : str;
    }, z.string().max(100, 'Search term too long').optional()),

  role: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return String(val).trim().toLowerCase();
    }, z.string()
        .refine((val) => SUPPORTED_ROLES.includes(val), {
          message: 'Invalid role filter. Must be one of: customer, owner, admin',
        })
        .optional()
    ),

  sort: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return String(val).trim();
    }, z.string()
        .refine((val) => Object.prototype.hasOwnProperty.call(ADMIN_USERS_SORT_MAP, val), {
          message: 'Invalid sort option. Must be one of: newest, oldest, -created, created, name, -name, role, -role, is_active, -is_active',
        })
        .optional()
    ),
});

/**
 * Validates and normalizes administrative user listing query parameters.
 *
 * @param {Object} query - Incoming req.query object
 * @returns {{ page: number, perPage: number, sort: string, role?: string, search?: string }}
 * @throws {Error} If query parameters fail validation (status 400)
 */
export function validateUsersQuery(query = {}) {
  const result = usersQuerySchema.safeParse(query);
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
  const sort = data.sort ? ADMIN_USERS_SORT_MAP[data.sort] : '-created';
  const role = data.role || undefined;
  const search = data.search || undefined;

  return { page, perPage, sort, role, search };
}

/**
 * Schema for user status update request body (PATCH /api/v1/admin/users/:id/status).
 *
 * Strict validation:
 * - is_active is required boolean
 * - Rejects non-boolean is_active
 * - Rejects any extra fields (role, password, email, name, etc.)
 */
export const updateUserStatusSchema = z
  .object({
    is_active: z.boolean({
      message: 'is_active is required and must be a boolean',
    }),
  })
  .strict({
    message: 'Extra fields are not permitted in user status update',
  });

/**
 * Validates user status update request body.
 *
 * @param {Object} body - Incoming req.body object
 * @returns {{ is_active: boolean }}
 * @throws {Error} If validation fails (status 400)
 */
export function validateUpdateUserStatus(body = {}) {
  const result = updateUserStatusSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const err = new Error(issue.message);
    err.status = 400;
    err.details = result.error.issues.map((i) => ({
      field: i.path.join('.') || 'is_active',
      message: i.message,
    }));
    throw err;
  }

  return result.data;
}



