import * as notificationService from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Notification Controller (Phase 11, Task 11.8)
 *
 * Implements authenticated notification retrieval and read status mutation endpoints
 * for customer and owner roles.
 */

/**
 * GET /api/v1/notifications
 * Retrieves paginated in-app notifications and unread count for authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { page, perPage } = req.query;
    const result = await notificationService.getUserNotifications(userId, {
      page,
      perPage,
    });

    return sendSuccess(res, result, 200, 'Notifications retrieved successfully');
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read for authenticated user.
 * Enforces strict ownership check.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function markAsRead(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { id } = req.params;
    const notification = await notificationService.markNotificationAsRead(id, userId);

    return sendSuccess(res, { notification }, 200, 'Notification marked as read');
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all unread notifications belonging to the authenticated user as read.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const result = await notificationService.markAllNotificationsAsRead(userId);

    return sendSuccess(res, result, 200, 'All notifications marked as read');
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

