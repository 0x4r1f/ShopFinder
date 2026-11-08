import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { rejectClientContactOverrides } from '../services/revealService.js';
import * as customerController from '../controllers/customer.controller.js';

const router = Router();

/**
 * Defense-in-depth: Enforce authentication and strictly 'customer' role at the router level.
 * Any route mounted on this router is strictly guarded against non-customer or unauthenticated access.
 */
router.use(authenticate, authorize('customer'));

/**
 * Customer Portal API Routes (Phase 8, Task 8.2 & Phase 9, Task 9.3 & Phase 10, Task 10.7)
 *
 * All routes require authentication and strictly 'customer' role.
 *
 * GET  /api/v1/customer/dashboard      — Retrieve customer overview data (credit balance, recent activity)
 * GET  /api/v1/customer/subscriptions  — Retrieve customer active subscription packages & credit breakdown
 * GET  /api/v1/customer/reveal/history — Retrieve customer contact reveal history (Task 10.8)
 * POST /api/v1/customer/reveal         — Reveal listing contact phone (atomically deduct 1 credit or 0 if repeat)
 */
router.get('/dashboard', authenticate, authorize('customer'), customerController.getCustomerDashboard);
router.get('/subscriptions', authenticate, authorize('customer'), customerController.getCustomerSubscriptions);
router.get('/reveal/history', authenticate, authorize('customer'), rejectClientContactOverrides, customerController.getRevealHistory);
router.get('/reveals', authenticate, authorize('customer'), rejectClientContactOverrides, customerController.getRevealHistory);
router.post('/reveal', authenticate, authorize('customer'), rejectClientContactOverrides, customerController.revealContact);
router.post('/reveal/:listingId', authenticate, authorize('customer'), rejectClientContactOverrides, customerController.revealContact);

export default router;
