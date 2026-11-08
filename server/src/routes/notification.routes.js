import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';

/**
 * ShopFinder — Notification Routes (Phase 11, Task 11.8)
 *
 * Provides endpoints for customers and owners to view and mark in-app notifications.
 * Protected by authenticate and authorize('customer', 'owner').
 */

const router = Router();

// Enforce authentication and RBAC for all notification routes
router.use(authenticate);
router.use(authorize('customer', 'owner'));

// GET /api/v1/notifications — Paginated list and unread count
router.get('/', getNotifications);

// PATCH /api/v1/notifications/read-all — Mark all unread notifications read (mounted before :id)
router.patch('/read-all', markAllAsRead);

// PATCH /api/v1/notifications/:id/read — Mark single notification read
router.patch('/:id/read', markAsRead);

export default router;

