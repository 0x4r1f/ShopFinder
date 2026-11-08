import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as adminController from '../controllers/admin.controller.js';
import * as adminAnalyticsController from '../controllers/adminAnalytics.controller.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

/**
 * Defense-in-depth: Enforce authentication and strictly 'admin' role at the router level.
 * Any route mounted on this router is strictly guarded against non-admin or unauthenticated access.
 */
router.use(authenticate, authorize('admin'));

/**
 * Admin API Routes (Phase 7, Tasks 7.1, 7.2, 7.3, 7.5; Phase 9, Task 9.2)
 *
 * All routes require authentication and strictly 'admin' role.
 *
 * GET  /api/v1/admin/stats — Retrieve platform statistics and recent activity (Task 7.1)
 * GET  /api/v1/admin/analytics — Retrieve platform analytics across 7d/30d/90d (Task 12.2)
 * GET  /api/v1/admin/listings/pending — Retrieve pending listings review queue (Task 7.2)
 * POST /api/v1/admin/listings/:id/approve — Approve a commercial listing (Task 7.3)
 * POST /api/v1/admin/listings/:id/reject — Reject a commercial listing with reason (Task 7.3)
 * POST /api/v1/admin/listings/:id/archive — Archive a commercial listing (Task 7.3)
 * GET  /api/v1/admin/users — Retrieve paginated users with filtering & search (Task 7.5)
 * PATCH /api/v1/admin/users/:id/status — Activate/deactivate user account (Task 7.5)
 * GET  /api/v1/admin/plans — Retrieve all subscription plans (Task 9.2)
 * POST /api/v1/admin/plans — Create a new subscription plan (Task 9.2)
 * GET  /api/v1/admin/plans/:id — Retrieve single subscription plan (Task 9.2)
 * PATCH /api/v1/admin/plans/:id — Update subscription plan (Task 9.2)
 * DELETE /api/v1/admin/plans/:id — Soft-deactivate subscription plan (Task 9.2)
 * POST /api/v1/admin/plans/:id/deactivate — Soft-deactivate subscription plan (Task 9.2)
 */
router.get('/stats', authenticate, authorize('admin'), adminController.getAdminStats);
router.get('/analytics', authenticate, authorize('admin'), adminAnalyticsController.getAdminAnalytics);
router.get('/listings/pending', authenticate, authorize('admin'), adminController.getPendingListings);
router.post('/listings/:id/approve', authenticate, authorize('admin'), adminController.approveListing);
router.post('/listings/:id/reject', authenticate, authorize('admin'), adminController.rejectListing);
router.post('/listings/:id/archive', authenticate, authorize('admin'), adminController.archiveListing);
router.get('/users', authenticate, authorize('admin'), adminController.getUsers);
router.patch('/users/:id/status', authenticate, authorize('admin'), adminController.updateUserStatus);

// Subscription Plans Management (Phase 9, Task 9.2)
router.get('/plans', authenticate, authorize('admin'), subscriptionController.getAdminPlans);
router.post('/plans', authenticate, authorize('admin'), subscriptionController.createAdminPlan);
router.get('/plans/:id', authenticate, authorize('admin'), subscriptionController.getAdminPlanById);
router.patch('/plans/:id', authenticate, authorize('admin'), subscriptionController.updateAdminPlan);
router.delete('/plans/:id', authenticate, authorize('admin'), subscriptionController.deactivateAdminPlan);
router.post('/plans/:id/deactivate', authenticate, authorize('admin'), subscriptionController.deactivateAdminPlan);

export default router;

