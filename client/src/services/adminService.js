import { api } from './api.js';

/**
 * ShopFinder — Admin Portal API Service (Phase 7, Task 7.1)
 *
 * Communicates exclusively with the Express backend admin REST endpoints.
 * Never stores authentication tokens in browser storage or client-accessible cookies;
 * relies strictly on server-set httpOnly cookies (pb_auth) via credentials: 'include'.
 */

/**
 * Retrieves live platform statistics and recent platform activity summary.
 *
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{
 *   totalListings: number,
 *   pendingListings: number,
 *   totalUsers: number,
 *   usersByRole: { customers: number, owners: number, admins: number },
 *   recentActivity: Array<Object>
 * }>}
 */
export async function getAdminStats(options = {}) {
  const { signal } = options;

  const response = await api.get('/api/v1/admin/stats', {
    signal,
  });

  return response?.data || {
    totalListings: 0,
    pendingListings: 0,
    totalUsers: 0,
    usersByRole: {
      customers: 0,
      owners: 0,
      admins: 0,
    },
    recentActivity: [],
  };
}

/**
 * Retrieves paginated pending commercial listings for administrative review queue (Phase 7, Task 7.2).
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=10]
 * @param {string} [params.sort='-created']
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   listings: Array<Object>,
 *   pagination: { page: number, perPage: number, totalItems: number, totalPages: number }
 * }>}
 */
export async function getPendingListings(params = {}, options = {}) {
  const { signal } = options;
  const { page = 1, perPage = 10, sort = '-created' } = params;

  const response = await api.get('/api/v1/admin/listings/pending', {
    params: { page, perPage, sort },
    signal,
  });

  return response?.data || {
    listings: [],
    pagination: {
      page: 1,
      perPage: 10,
      totalItems: 0,
      totalPages: 0,
    },
  };
}

/**
 * Approves a commercial property listing (Phase 7, Task 7.3).
 *
 * @param {string} id - Listing record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ listing: Object }>}
 */
export async function approveListing(id, options = {}) {
  const { signal } = options;
  const response = await api.post(`/api/v1/admin/listings/${id}/approve`, {}, { signal });
  return response?.data || null;
}

/**
 * Rejects a commercial property listing with a required reason (Phase 7, Task 7.3).
 *
 * @param {string} id - Listing record ID
 * @param {string} rejectionNote - 1-1000 character rejection reason
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ listing: Object }>}
 */
export async function rejectListing(id, rejectionNote, options = {}) {
  const { signal } = options;
  const response = await api.post(
    `/api/v1/admin/listings/${id}/reject`,
    { rejection_note: rejectionNote },
    { signal }
  );
  return response?.data || null;
}

/**
 * Archives a commercial property listing (Phase 7, Task 7.3).
 *
 * @param {string} id - Listing record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ listing: Object }>}
 */
export async function archiveListing(id, options = {}) {
  const { signal } = options;
  const response = await api.post(`/api/v1/admin/listings/${id}/archive`, {}, { signal });
  return response?.data || null;
}

/**
 * Retrieves paginated users for administrative user management (Phase 7, Task 7.5).
 * Supports search, role filtering, sorting, and pagination.
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=10]
 * @param {string} [params.search]
 * @param {string} [params.role]
 * @param {string} [params.sort='-created']
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   users: Array<Object>,
 *   pagination: { page: number, perPage: number, totalItems: number, totalPages: number }
 * }>}
 */
export async function getUsers(params = {}, options = {}) {
  const { signal } = options;
  const { page = 1, perPage = 10, search, role, sort = '-created' } = params;

  const queryParams = { page, perPage, sort };
  if (search && String(search).trim()) queryParams.search = String(search).trim();
  if (role && role !== 'all') queryParams.role = String(role).trim();

  const response = await api.get('/api/v1/admin/users', {
    params: queryParams,
    signal,
  });

  return response?.data || {
    users: [],
    pagination: {
      page: 1,
      perPage: 10,
      totalItems: 0,
      totalPages: 0,
    },
  };
}

/**
 * Updates a user's account activation status (Phase 7, Task 7.5).
 *
 * @param {string} id - User record ID
 * @param {boolean} isActive - New is_active state
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ user: Object }>}
 */
export async function updateUserStatus(id, isActive, options = {}) {
  const { signal } = options;
  const response = await api.patch(
    `/api/v1/admin/users/${encodeURIComponent(id)}/status`,
    { is_active: Boolean(isActive) },
    { signal }
  );
  return response?.data || null;
}

/**
 * Retrieves all subscription plans for administrative management (Phase 9, Task 9.2).
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=20]
 * @param {string} [params.sort='price']
 * @param {boolean|string} [params.is_active]
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   plans: Array<Object>,
 *   pagination: { page: number, perPage: number, totalItems: number, totalPages: number }
 * }>}
 */
export async function getSubscriptionPlans(params = {}, options = {}) {
  const { signal } = options;
  const { page = 1, perPage = 20, sort = 'price', is_active } = params;

  const queryParams = { page, perPage, sort };
  if (is_active !== undefined) queryParams.is_active = is_active;

  const response = await api.get('/api/v1/admin/plans', {
    params: queryParams,
    signal,
  });

  return response?.data || {
    plans: [],
    pagination: { page: 1, perPage: 20, totalItems: 0, totalPages: 0 },
  };
}

/**
 * Retrieves a single subscription plan by ID for administrators (Phase 9, Task 9.2).
 *
 * @param {string} id - Plan record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ plan: Object }>}
 */
export async function getSubscriptionPlanById(id, options = {}) {
  const { signal } = options;
  const response = await api.get(`/api/v1/admin/plans/${encodeURIComponent(id)}`, { signal });
  return response?.data || null;
}

/**
 * Creates a new subscription plan (Phase 9, Task 9.2).
 *
 * @param {Object} data - Plan attributes { name, price, credits, description?, is_active? }
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ plan: Object }>}
 */
export async function createSubscriptionPlan(data, options = {}) {
  const { signal } = options;
  const response = await api.post('/api/v1/admin/plans', data, { signal });
  return response?.data || null;
}

/**
 * Updates an existing subscription plan (Phase 9, Task 9.2).
 *
 * @param {string} id - Plan record ID
 * @param {Object} data - Update fields { name?, price?, credits?, description?, is_active? }
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ plan: Object }>}
 */
export async function updateSubscriptionPlan(id, data, options = {}) {
  const { signal } = options;
  const response = await api.patch(`/api/v1/admin/plans/${encodeURIComponent(id)}`, data, { signal });
  return response?.data || null;
}

/**
 * Soft-deactivates a subscription plan (Phase 9, Task 9.2).
 *
 * @param {string} id - Plan record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ plan: Object }>}
 */
export async function deactivateSubscriptionPlan(id, options = {}) {
  const { signal } = options;
  const response = await api.delete(`/api/v1/admin/plans/${encodeURIComponent(id)}`, { signal });
  return response?.data || null;
}

export default {
  getAdminStats,
  getPendingListings,
  approveListing,
  rejectListing,
  archiveListing,
  getUsers,
  updateUserStatus,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
};

