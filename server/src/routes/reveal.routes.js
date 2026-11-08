import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { rejectClientContactOverrides } from '../services/revealService.js';
import { revealContact } from '../controllers/customer.controller.js';

const router = Router();

/**
 * Defense-in-depth: Enforce authentication and strictly 'customer' role at the router level.
 * Any route mounted on this router is strictly guarded against non-customer or unauthenticated access.
 */
router.use(authenticate, authorize('customer'));

/**
 * Contact Reveal API Routes (Phase 10, Task 10.7)
 *
 * All routes require authentication, customer role, and reject client-supplied identity overrides.
 *
 * POST /api/v1/reveal             — Reveal listing contact phone (listingId in request body)
 * POST /api/v1/reveal/:listingId  — Reveal listing contact phone (listingId in route parameters)
 */
router.post('/', authenticate, authorize('customer'), rejectClientContactOverrides, revealContact);
router.post('/:listingId', authenticate, authorize('customer'), rejectClientContactOverrides, revealContact);

export default router;

