import { api } from './api.js';

/**
 * ShopFinder — Customer Favorites API Service (Phase 8, Task 8.3)
 *
 * Dedicated client service for managing customer saved listings.
 * Strictly communicates with backend REST endpoints:
 * - GET    /api/v1/favorites
 * - POST   /api/v1/favorites/:listingId
 * - DELETE /api/v1/favorites/:listingId
 */

/**
 * Retrieves the authenticated customer's paginated saved listings.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=20]
 * @param {string} [options.sort='-saved_at']
 * @param {AbortSignal} [options.signal]
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
 * Saves a commercial listing to the customer's favorites.
 *
 * @param {string} listingId
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function saveFavorite(listingId, options = {}) {
  const { signal } = options;

  const response = await api.post(`/api/v1/favorites/${listingId}`, undefined, {
    signal,
  });

  return response?.data || response;
}

/**
 * Removes a commercial listing from the customer's favorites.
 *
 * @param {string} listingId
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function removeFavorite(listingId, options = {}) {
  const { signal } = options;

  const response = await api.delete(`/api/v1/favorites/${listingId}`, {
    signal,
  });

  return response?.data || response;
}

export default {
  getFavorites,
  saveFavorite,
  removeFavorite,
};

