import { z } from 'zod';

/**
 * ShopFinder — User Input Validation Schemas (Task 3.6)
 *
 * Enforces strict allowlisting for user profile operations.
 * Mass assignment and privileged-field modifications are strictly prohibited.
 */

/**
 * Validation schema for updating user profile (PATCH /api/v1/users/me).
 *
 * Only permitted profile fields (name, avatar) may be provided.
 * All privileged fields (id, role, is_active, email, password, phone, tokenKey, verified)
 * are rejected with HTTP 400 via strict schema validation.
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string({ message: 'Name must be a string' })
      .trim()
      .min(1, 'Name cannot be empty')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    avatar: z
      .string({ message: 'Avatar must be a string' })
      .nullable()
      .optional(),
  })
  .strict({
    message: 'Prohibited or unsupported fields in request body',
  });

