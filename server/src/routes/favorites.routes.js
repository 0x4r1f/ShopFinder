import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as favoritesController from '../controllers/favorites.controller.js';

const router = Router();

/**
 * Defense-in-depth: Enforce authentication and strictly 'customer' role at the router level.
 * Any route mounted on this router is strictly guarded against non-customer or unauthenticated access.
 */
router.use(authenticate, authorize('customer'));

/**
 * Customer Favorites API Routes (Phase 8, Task 8.1)
 *
 * All routes require authentication and strictly 'customer' role.
 *
 * GET    /api/v1/favorites — Retrieve paginated saved listings for authenticated customer
 * POST   /api/v1/favorites/:listingId — Save an approved commercial listing to favorites (idempotent)
 * DELETE /api/v1/favorites/:listingId — Remove a saved listing from customer favorites (idempotent)
 */
router.get('/', authenticate, authorize('customer'), favoritesController.getFavorites);
router.post('/:listingId', authenticate, authorize('customer'), favoritesController.saveFavorite);
router.delete('/:listingId', authenticate, authorize('customer'), favoritesController.removeFavorite);

export default router;

