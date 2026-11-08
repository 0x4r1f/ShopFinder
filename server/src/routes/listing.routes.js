import { Router } from 'express';
import * as listingController from '../controllers/listing.controller.js';
import { authenticate, authenticateOptional } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createListingSchema,
  updateListingSchema,
  reorderImagesSchema,
} from '../validators/listing.validator.js';
import {
  uploadConcurrencyGuard,
  handleListingImageUpload,
} from '../middleware/upload.js';

const router = Router();

/**
 * Public Listing API Routes (Phase 5, Task 5.1, Task 5.2 & Task 5.5)
 *
 * GET /api/v1/listings/featured — Featured commercial properties for homepage
 * GET /api/v1/listings          — Approved commercial properties for marketplace browse
 * GET /api/v1/listings/:id      — Single commercial property details with image gallery
 */

router.get('/featured', listingController.getFeaturedListings);
router.get('/', listingController.getListings);
router.get('/:id', authenticateOptional, listingController.getListingById);

/**
 * Owner Listing API Routes (Phase 6, Task 6.1, Task 6.2 & Task 6.3)
 *
 * POST   /api/v1/listings                  — Create a new commercial property listing (owner role only)
 * PATCH  /api/v1/listings/:id              — Update an existing commercial listing (owner role only)
 * DELETE /api/v1/listings/:id              — Permanently delete a commercial listing (owner role only)
 * POST   /api/v1/listings/:id/images       — Upload multiple images (owner role only)
 * DELETE /api/v1/listings/:id/images/:imageId — Delete an individual image (owner role only)
 * PATCH  /api/v1/listings/:id/images/:imageId/cover — Set cover image (owner role only)
 * PUT    /api/v1/listings/:id/images/order — Reorder listing images (owner role only)
 */
router.post(
  '/',
  authenticate,
  authorize('owner'),
  validate(createListingSchema),
  listingController.createListing
);

router.patch(
  '/:id',
  authenticate,
  authorize('owner'),
  validate(updateListingSchema),
  listingController.updateListing
);

router.delete(
  '/:id',
  authenticate,
  authorize('owner'),
  listingController.deleteListing
);

// Image management routes (Task 6.3)
router.post(
  '/:id/images',
  authenticate,
  authorize('owner'),
  uploadConcurrencyGuard,
  handleListingImageUpload,
  listingController.uploadImages
);

router.delete(
  '/:id/images/:imageId',
  authenticate,
  authorize('owner'),
  listingController.deleteImage
);

router.patch(
  '/:id/images/:imageId/cover',
  authenticate,
  authorize('owner'),
  listingController.setCoverImage
);

router.put(
  '/:id/images/order',
  authenticate,
  authorize('owner'),
  validate(reorderImagesSchema),
  listingController.reorderImages
);

export default router;




