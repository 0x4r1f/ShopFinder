import { z } from 'zod';

/**
 * ShopFinder — Subscription Plans Validation Schemas (Phase 9, Task 9.2)
 *
 * Strict Zod input validation for subscription plan creation, updates, and administrative queries.
 * Enforces schema constraints and rejects unknown or privileged fields.
 */

export const ADMIN_PLANS_SORT_MAP = {
  price: 'price',
  '-price': '-price',
  name: 'name',
  '-name': '-name',
  created: 'created',
  '-created': '-created',
  credits: 'credits',
  '-credits': '-credits',
};

/**
 * Schema for creating a new subscription plan (Admin only).
 * Required: name, price, credits.
 * Optional: description, is_active.
 * Strictly rejects extra / unknown properties.
 */
export const createPlanSchema = z
  .object({
    name: z
      .string({ required_error: 'Plan name is required', invalid_type_error: 'Plan name must be a string' })
      .trim()
      .min(2, 'Plan name must be between 2 and 50 characters')
      .max(50, 'Plan name must be between 2 and 50 characters'),

    price: z
      .preprocess((val) => {
        if (typeof val === 'string' && val.trim() !== '') {
          const num = Number(val.trim());
          return Number.isNaN(num) ? val : num;
        }
        return val;
      }, z.number({ required_error: 'Price is required', invalid_type_error: 'Price must be a valid number' })
          .min(0, 'Price must be greater than or equal to 0')
      ),

    credits: z
      .preprocess((val) => {
        if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) {
          return Number(val.trim());
        }
        return val;
      }, z.number({ required_error: 'Credits is required', invalid_type_error: 'Credits must be an integer' })
          .int('Credits must be an integer')
          .min(1, 'Credits must be at least 1')
      ),

    description: z
      .string({ invalid_type_error: 'Description must be a string' })
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .optional()
      .default(''),

    is_active: z
      .boolean({ invalid_type_error: 'is_active must be a boolean' })
      .optional()
      .default(true),
  })
  .strict({ message: 'Unrecognized or privileged fields are not permitted in plan creation' });

/**
 * Schema for updating an existing subscription plan (Admin only).
 * All allowed fields are optional, but at least one must be provided.
 * Strictly rejects extra / unknown / privileged fields (e.g. id, created, updated).
 */
export const updatePlanSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'Plan name must be a string' })
      .trim()
      .min(2, 'Plan name must be between 2 and 50 characters')
      .max(50, 'Plan name must be between 2 and 50 characters')
      .optional(),

    price: z
      .preprocess((val) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string' && val.trim() !== '') {
          const num = Number(val.trim());
          return Number.isNaN(num) ? val : num;
        }
        return val;
      }, z.number({ invalid_type_error: 'Price must be a valid number' })
          .min(0, 'Price must be greater than or equal to 0')
          .optional()
      ),

    credits: z
      .preprocess((val) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string' && /^-?\d+$/.test(val.trim())) {
          return Number(val.trim());
        }
        return val;
      }, z.number({ invalid_type_error: 'Credits must be an integer' })
          .int('Credits must be an integer')
          .min(1, 'Credits must be at least 1')
          .optional()
      ),

    description: z
      .string({ invalid_type_error: 'Description must be a string' })
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .optional(),

    is_active: z
      .boolean({ invalid_type_error: 'is_active must be a boolean' })
      .optional(),
  })
  .strict({ message: 'Unrecognized or privileged fields are not permitted in plan update' });

/**
 * Schema for querying admin plans list with pagination, sort, and status filter.
 */
export const adminPlansQuerySchema = z.object({
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

  sort: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return String(val).trim();
    }, z.string()
        .refine((val) => Object.prototype.hasOwnProperty.call(ADMIN_PLANS_SORT_MAP, val), {
          message: 'Invalid sort field. Allowed values: price, -price, name, -name, created, -created, credits, -credits',
        })
        .optional()
    ),

  is_active: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '' || val === 'all') return undefined;
      if (val === true || val === 'true' || val === '1') return true;
      if (val === false || val === 'false' || val === '0') return false;
      return val;
    }, z.boolean({ invalid_type_error: 'is_active filter must be true, false, or all' }).optional()
    ),
});

/**
 * Validates plan creation body.
 *
 * @param {unknown} body
 * @returns {z.infer<typeof createPlanSchema>}
 */
export function validateCreatePlan(body) {
  const result = createPlanSchema.safeParse(body);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || 'Invalid plan creation data');
    error.status = 400;
    error.details = result.error.flatten().fieldErrors;
    throw error;
  }
  return result.data;
}

/**
 * Validates plan update body.
 * Rejects empty updates (Object.keys === 0).
 *
 * @param {unknown} body
 * @returns {z.infer<typeof updatePlanSchema>}
 */
export function validateUpdatePlan(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Request body must be a JSON object');
    error.status = 400;
    throw error;
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    const error = new Error('At least one editable field (name, price, credits, description, is_active) must be provided');
    error.status = 400;
    throw error;
  }

  const result = updatePlanSchema.safeParse(body);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || 'Invalid plan update data');
    error.status = 400;
    error.details = result.error.flatten().fieldErrors;
    throw error;
  }

  // Ensure at least one allowed field is actually set
  const cleaned = result.data;
  const hasValidFields = Object.values(cleaned).some((v) => v !== undefined);
  if (!hasValidFields) {
    const error = new Error('At least one editable field (name, price, credits, description, is_active) must be provided');
    error.status = 400;
    throw error;
  }

  return cleaned;
}

/**
 * Validates admin plans query parameters.
 *
 * @param {unknown} query
 * @returns {{ page: number, perPage: number, sort: string, is_active?: boolean }}
 */
export function validateAdminPlansQuery(query = {}) {
  const result = adminPlansQuerySchema.safeParse(query);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || 'Invalid query parameters');
    error.status = 400;
    error.details = result.error.flatten().fieldErrors;
    throw error;
  }
  const { page = 1, perPage = 20, sort = 'price', is_active } = result.data;
  return {
    page,
    perPage,
    sort,
    ...(is_active !== undefined ? { is_active } : {}),
  };
}

