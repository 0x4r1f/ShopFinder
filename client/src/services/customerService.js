import { api } from './api.js';

/**
 * ShopFinder — Customer Portal API Service (Phase 8, Task 8.2)
 *
 * Communicates exclusively with the Express backend customer REST endpoints.
 * Never stores authentication tokens in browser storage or client-accessible cookies;
 * relies strictly on server-set httpOnly cookies (pb_auth) via credentials: 'include'.
 */

/**
 * Retrieves the customer's dashboard overview data (credits remaining, recent saved listings, recent revealed contacts).
 *
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{
 *   credits_remaining: number,
 *   active_subscriptions_count: number,
 *   recent_saved: Array<Object>,
 *   recent_reveals: Array<Object>
 * }>}
 */
export async function getCustomerDashboard(options = {}) {
  const { signal } = options;

  const response = await api.get('/api/v1/customer/dashboard', {
    signal,
  });

  return response?.data || {
    credits_remaining: 0,
    active_subscriptions_count: 0,
    active_subscriptions: [],
    recent_saved: [],
    recent_reveals: [],
  };
}

/**
 * Retrieves the authenticated customer's active subscription packages and credit breakdown (Phase 9, Task 9.3).
 *
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{
 *   credits_remaining: number,
 *   active_subscriptions_count: number,
 *   subscriptions: Array<Object>
 * }>}
 */
export async function getCustomerSubscriptions(options = {}) {
  const { signal } = options;

  const response = await api.get('/api/v1/customer/subscriptions', {
    signal,
  });

  return response?.data || {
    credits_remaining: 0,
    active_subscriptions_count: 0,
    subscriptions: [],
  };
}

/**
 * Retrieves the authenticated customer's paginated saved listings.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.perPage=20] - Number of items per page (1-100)
 * @param {string} [options.sort='-saved_at'] - Sort order
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{
 *   favorites: Array<Object>,
 *   pagination: { page: number, perPage: number, totalItems: number, totalPages: number }
 * }>}
 */
export async function getFavorites(options = {}) {
  const { page = 1, perPage = 20, sort = '-saved_at', signal } = options;

  const response = await api.get('/api/v1/favorites', {
    params: { page, perPage, sort },
    signal,
  });

  return response?.data || {
    favorites: [],
    pagination: { page: 1, perPage, totalItems: 0, totalPages: 0 },
  };
}

/**
 * Removes a listing from the authenticated customer's saved favorites.
 *
 * @param {string} listingId - ID of commercial listing to remove
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{ message?: string }>}
 */
export async function removeFavorite(listingId, options = {}) {
  const { signal } = options;

  const response = await api.delete(`/api/v1/favorites/${listingId}`, {
    signal,
  });

  return response?.data || response;
}

/**
 * Updates customer profile fields (name, avatar) via PATCH /api/v1/users/me.
 * Supports both JSON payloads { name } and FormData payloads with file uploads.
 *
 * @param {Object|FormData} updateData - Permitted profile data to update
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Updated sanitized user profile
 */
export async function updateCustomerProfile(updateData, options = {}) {
  const { signal } = options;

  const response = await api.patch('/api/v1/users/me', updateData, {
    signal,
  });

  return response?.data?.user || response;
}

export default {
  getCustomerDashboard,
  getFavorites,
  removeFavorite,
  updateCustomerProfile,
};

