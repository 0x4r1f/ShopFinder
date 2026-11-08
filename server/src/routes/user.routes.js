import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { handleAvatarUpload } from '../middleware/upload.js';
import { updateProfileSchema } from '../validators/user.validator.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

/**
 * User Profile API Endpoints (Phase 3, Task 3.6 & Phase 8, Task 8.4)
 *
 * GET /api/v1/users/me — Retrieve authenticated user profile
 * PATCH /api/v1/users/me — Update authenticated user profile
 *
 * Both routes strictly require authentication and derive identity from req.user.
 */

// Retrieve authenticated user's own profile
router.get('/me', authenticate, userController.getProfile);

// Update authenticated user's own profile fields (JSON or multipart avatar upload)
router.patch(
  '/me',
  authenticate,
  handleAvatarUpload,
  validate(updateProfileSchema),
  userController.updateProfile
);

export default router;

