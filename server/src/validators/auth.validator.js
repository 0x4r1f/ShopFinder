import { z } from 'zod';

/**
 * Registration Input Validation Schema
 *
 * Rules:
 * - name: required, non-empty, max 100 characters
 * - email: required, valid email format, lowercased
 * - password: required, minimum 8 characters, max 128 characters
 * - passwordConfirm: required, must match password
 * - role: required, strictly 'customer' or 'owner'. 'admin' self-registration is explicitly rejected with HTTP 400.
 */
export const registerSchema = z
  .object({
    name: z
      .string({ message: 'Name is required' })
      .trim()
      .min(1, { message: 'Name cannot be empty' })
      .max(100, { message: 'Name cannot exceed 100 characters' }),

    email: z
      .string({ message: 'Email is required' })
      .trim()
      .toLowerCase()
      .min(1, { message: 'Email cannot be empty' })
      .email({ message: 'A valid email address is required' }),

    password: z
      .string({ message: 'Password is required' })
      .min(8, { message: 'Password must be at least 8 characters long' })
      .max(128, { message: 'Password cannot exceed 128 characters' }),

    passwordConfirm: z
      .string({ message: 'Password confirmation is required' }),

    role: z
      .string({ message: 'Role is required' })
      .refine((val) => val !== 'admin', {
        message: 'Admin accounts cannot be self-registered',
      })
      .refine((val) => ['customer', 'owner'].includes(val), {
        message: "Role must be either 'customer' or 'owner'",
      }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

/**
 * Login Credentials Validation Schema
 *
 * Rules:
 * - email: required, valid email format, lowercased
 * - password: required, non-empty string
 */
export const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, { message: 'Email cannot be empty' })
    .email({ message: 'A valid email address is required' }),

  password: z
    .string({ message: 'Password is required' })
    .min(1, { message: 'Password cannot be empty' }),
});

