import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

/**
 * ShopFinder — Subscription Plans Routes (Phase 9, Task 9.2)
 *
 * 1. Public Endpoint:
 *    GET /api/v1/subscriptions/plans — List all active subscription plans (public access)
 *
 * 2. Admin Management Endpoints (Defense-in-depth alias):
 *    All admin operations strictly require authentication and 'admin' role.
 */

// Public: Retrieve active subscription plans
router.get('/plans', subscriptionController.getPublicPlans);

// Admin-only management endpoints (aliased under subscriptions router)
router.get('/admin/plans', authenticate, authorize('admin'), subscriptionController.getAdminPlans);
router.post('/admin/plans', authenticate, authorize('admin'), subscriptionController.createAdminPlan);
router.get('/admin/plans/:id', authenticate, authorize('admin'), subscriptionController.getAdminPlanById);
router.patch('/admin/plans/:id', authenticate, authorize('admin'), subscriptionController.updateAdminPlan);
router.delete('/admin/plans/:id', authenticate, authorize('admin'), subscriptionController.deactivateAdminPlan);
router.post('/admin/plans/:id/deactivate', authenticate, authorize('admin'), subscriptionController.deactivateAdminPlan);

export default router;

