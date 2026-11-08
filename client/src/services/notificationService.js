import api from './api.js';

/**
 * ShopFinder — Notification Client API Service (Phase 11, Task 11.8)
 *
 * Communicates with backend notification endpoints with httpOnly cookie credentials.
 */

/**
 * Retrieves paginated notifications and unread count for authenticated user.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=10]
 * @returns {Promise<{
 *   notifications: Array<Object>,
 *   pagination: { page: number, perPage: number, totalItems: number, totalPages: number },
 *   unread_count: number
 * }>}
 */
export async function getNotifications({ page = 1, perPage = 10 } = {}) {
  const response = await api.get('/api/v1/notifications', {
    params: { page, perPage },
  });
  return response.data;
}

/**
 * Marks a single notification as read.
 *
 * @param {string} id - Notification ID
 * @returns {Promise<{ notification: Object }>}
 */
export async function markNotificationAsRead(id) {
  if (!id) {
    throw new Error('Notification ID is required');
  }
  const response = await api.patch(`/api/v1/notifications/${id}/read`);
  return response.data;
}

/**
 * Marks all unread notifications as read.
 *
 * @returns {Promise<{ updated_count: number }>}
 */
export async function markAllNotificationsAsRead() {
  const response = await api.patch('/api/v1/notifications/read-all');
  return response.data;
}

