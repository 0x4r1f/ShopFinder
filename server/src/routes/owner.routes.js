import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { handleAvatarUpload } from '../middleware/upload.js';
import { updateOwnerProfileSchema } from '../validators/owner.validator.js';
import * as ownerController from '../controllers/owner.controller.js';

const router = Router();

/**
 * Owner Portal API Routes (Phase 6, Tasks 6.2 & 6.7)
 *
 * All routes require authentication and 'owner' role.
 *
 * GET   /api/v1/owner/listings — Retrieve authenticated owner's listings across all statuses
 * GET   /api/v1/owner/profile  — Retrieve authenticated owner's profile with private contact phone
 * PATCH /api/v1/owner/profile  — Update authenticated owner's profile fields, avatar, and contact phone
 */
router.get('/listings', authenticate, authorize('owner'), ownerController.getOwnerListings);

router.get('/profile', authenticate, authorize('owner'), ownerController.getOwnerProfile);

router.patch(
  '/profile',
  authenticate,
  authorize('owner'),
  handleAvatarUpload,
  validate(updateOwnerProfileSchema),
  ownerController.updateOwnerProfile
);

export default router;

