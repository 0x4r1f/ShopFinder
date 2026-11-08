import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as customerController from '../controllers/customer.controller.js';

const router = Router();

/**
 * Defense-in-depth: Enforce authentication and strictly 'customer' role at the router level.
 * Any route mounted on this router is strictly guarded against non-customer or unauthenticated access.
 */
router.use(authenticate, authorize('customer'));

/**
 * Customer Portal API Routes (Phase 8, Task 8.2 & Phase 9, Task 9.3)
 *
 * All routes require authentication and strictly 'customer' role.
 *
 * GET /api/v1/customer/dashboard — Retrieve customer overview data (credit balance, recent activity)
 * GET /api/v1/customer/subscriptions — Retrieve customer active subscription packages & credit breakdown
 */
router.get('/dashboard', authenticate, authorize('customer'), customerController.getCustomerDashboard);
router.get('/subscriptions', authenticate, authorize('customer'), customerController.getCustomerSubscriptions);

export default router;
