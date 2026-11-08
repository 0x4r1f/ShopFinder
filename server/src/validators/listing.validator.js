import { z } from 'zod';

/**
 * ShopFinder — Listing Validation Schemas (Phase 6, Task 6.1)
 *
 * Enforces strict validation and allowlisting for commercial listing operations.
 * Privileged field injections (owner, status, is_featured, rejection_note)
 * and unsupported/arbitrary attributes are strictly prohibited via .strict().
 */

export const CATEGORY_VALUES = [
  'retail',
  'office',
  'restaurant',
  'warehouse',
  'showroom',
  'industrial',
  'other',
];

export const LISTING_TYPE_VALUES = ['rent', 'sale'];

/**
 * Schema for creating a new commercial property listing (POST /api/v1/listings).
 *
 * Permitted fields:
 * - title: required, non-empty string (max 200 chars)
 * - description: required, non-empty string (max 10,000 chars)
 * - category: required, one of the 7 official categories
 * - listing_type: optional enum ('rent' | 'sale'), defaults to 'rent'
 * - price: required non-negative number
 * - area_sqft: required non-negative number
 * - address: required, non-empty string (max 500 chars)
 * - city: required, non-empty string (max 100 chars)
 * - area: required, non-empty string (max 100 chars)
 *
 * Privileged fields (owner, status, is_featured, rejection_note) and any
 * unrecognized properties are rejected with HTTP 400 via .strict().
 */
export const createListingSchema = z
  .object({
    title: z
      .string({ message: 'Title is required' })
      .trim()
      .min(1, { message: 'Title cannot be empty' })
      .max(200, { message: 'Title cannot exceed 200 characters' }),

    description: z
      .string({ message: 'Description is required' })
      .trim()
      .min(1, { message: 'Description cannot be empty' })
      .max(10000, { message: 'Description cannot exceed 10,000 characters' }),

    category: z.enum(CATEGORY_VALUES, {
      message: 'Category must be one of: retail, office, restaurant, warehouse, showroom, industrial, other',
    }),

    listing_type: z
      .enum(LISTING_TYPE_VALUES, {
        message: "Listing type must be either 'rent' or 'sale'",
      })
      .default('rent')
      .optional(),

    price: z
      .number({ message: 'Price must be a valid number' })
      .finite({ message: 'Price must be a finite number' })
      .min(0, { message: 'Price must be a non-negative number' })
      .max(1e12, { message: 'Price exceeds maximum allowable value' }),

    area_sqft: z
      .number({ message: 'Area (sqft) must be a valid number' })
      .finite({ message: 'Area (sqft) must be a finite number' })
      .min(0, { message: 'Area (sqft) must be a non-negative number' })
      .max(1e7, { message: 'Area (sqft) exceeds maximum allowable value' }),

    address: z
      .string({ message: 'Address is required' })
      .trim()
      .min(1, { message: 'Address cannot be empty' })
      .max(500, { message: 'Address cannot exceed 500 characters' }),

    city: z
      .string({ message: 'City is required' })
      .trim()
      .min(1, { message: 'City cannot be empty' })
      .max(100, { message: 'City cannot exceed 100 characters' }),

    area: z
      .string({ message: 'Area is required' })
      .trim()
      .min(1, { message: 'Area cannot be empty' })
      .max(100, { message: 'Area cannot exceed 100 characters' }),
  })
  .strict({
    message: 'Prohibited or unsupported fields in request body',
  });

/**
 * Schema for updating an existing commercial property listing (PATCH /api/v1/listings/:id).
 *
 * Permitted fields (all optional individually, but at least one must be provided):
 * - title: optional non-empty string (max 200 chars)
 * - description: optional non-empty string (max 10,000 chars)
 * - category: optional, one of the 7 official categories
 * - listing_type: optional enum ('rent' | 'sale')
 * - price: optional non-negative number
 * - area_sqft: optional non-negative number
 * - address: optional non-empty string (max 500 chars)
 * - city: optional non-empty string (max 100 chars)
 * - area: optional non-empty string (max 100 chars)
 *
 * Rejects empty payload ({}) with HTTP 400.
 * Privileged fields (owner, status, is_featured, rejection_note) and any
 * unrecognized properties are rejected with HTTP 400 via .strict().
 */
export const updateListingSchema = z
  .object({
    title: z
      .string({ message: 'Title must be a string' })
      .trim()
      .min(1, { message: 'Title cannot be empty' })
      .max(200, { message: 'Title cannot exceed 200 characters' })
      .optional(),

    description: z
      .string({ message: 'Description must be a string' })
      .trim()
      .min(1, { message: 'Description cannot be empty' })
      .max(10000, { message: 'Description cannot exceed 10,000 characters' })
      .optional(),

    category: z
      .enum(CATEGORY_VALUES, {
        message: 'Category must be one of: retail, office, restaurant, warehouse, showroom, industrial, other',
      })
      .optional(),

    listing_type: z
      .enum(LISTING_TYPE_VALUES, {
        message: "Listing type must be either 'rent' or 'sale'",
      })
      .optional(),

    price: z
      .number({ message: 'Price must be a valid number' })
      .finite({ message: 'Price must be a finite number' })
      .min(0, { message: 'Price must be a non-negative number' })
      .max(1e12, { message: 'Price exceeds maximum allowable value' })
      .optional(),

    area_sqft: z
      .number({ message: 'Area (sqft) must be a valid number' })
      .finite({ message: 'Area (sqft) must be a finite number' })
      .min(0, { message: 'Area (sqft) must be a non-negative number' })
      .max(1e7, { message: 'Area (sqft) exceeds maximum allowable value' })
      .optional(),

    address: z
      .string({ message: 'Address must be a string' })
      .trim()
      .min(1, { message: 'Address cannot be empty' })
      .max(500, { message: 'Address cannot exceed 500 characters' })
      .optional(),

    city: z
      .string({ message: 'City must be a string' })
      .trim()
      .min(1, { message: 'City cannot be empty' })
      .max(100, { message: 'City cannot exceed 100 characters' })
      .optional(),

    area: z
      .string({ message: 'Area must be a string' })
      .trim()
      .min(1, { message: 'Area cannot be empty' })
      .max(100, { message: 'Area cannot exceed 100 characters' })
      .optional(),
  })
  .strict({
    message: 'Prohibited or unsupported fields in request body',
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for reordering listing images (PUT /api/v1/listings/:id/images/order).
 * Requires an array of 15-character PocketBase record IDs.
 */
export const reorderImagesSchema = z
  .object({
    order: z
      .array(
        z
          .string({ message: 'Image ID must be a string' })
          .trim()
          .regex(/^[a-zA-Z0-9]{15}$/, { message: 'Invalid image ID format' }),
        { message: 'Order must be an array of image IDs' }
      )
      .min(1, { message: 'Order array cannot be empty' }),
  })
  .strict({
    message: 'Prohibited or unsupported fields in request body',
  });



