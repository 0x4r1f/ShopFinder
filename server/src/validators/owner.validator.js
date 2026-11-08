import { z } from 'zod';

/**
 * ShopFinder — Owner Profile Validation Schema (Phase 6, Task 6.7)
 *
 * Enforces strict allowlisting for owner business profile updates.
 * Phone format enforces approved regex: /^\+?[0-9\s-]{6,30}$/
 * Name length is capped at 255 characters to match the database schema.
 * All privileged and unknown fields are strictly rejected with HTTP 400.
 */

export const PHONE_REGEX = /^\+?[0-9\s-]{6,30}$/;

export const updateOwnerProfileSchema = z
  .object({
    name: z
      .string({ message: 'Name must be a string' })
      .trim()
      .min(1, 'Name cannot be empty')
      .max(255, 'Name cannot exceed 255 characters')
      .optional(),
    phone: z
      .string({ message: 'Phone must be a string' })
      .trim()
      .min(6, 'Phone number must be at least 6 characters')
      .max(30, 'Phone number cannot exceed 30 characters')
      .regex(
        PHONE_REGEX,
        'Invalid phone number format. Only digits, spaces, hyphens, and an optional leading + are allowed (6-30 characters).'
      )
      .optional(),
  })
  .strict({
    message: 'Prohibited or unsupported fields in request body',
  });

