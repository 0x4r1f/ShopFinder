import { apiRequest } from './api.js';

/**
 * ShopFinder — Frontend Authentication & User API Service (Task 3.7)
 *
 * Implements client-side calls to Express authentication and user endpoints.
 * Never stores or handles raw JWT tokens. All sessions are mediated via httpOnly cookies.
 */

/**
 * Registers a new customer or owner user.
 *
 * @param {Object} input
 * @param {string} input.name
 * @param {string} input.email
 * @param {string} input.password
 * @param {string} input.passwordConfirm
 * @param {'customer'|'owner'} input.role
 * @returns {Promise<Object>} Sanitized user record
 */
export async function register(input) {
  const res = await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res?.data?.user || null;
}

/**
 * Logs in user with email and password.
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<Object>} Sanitized user record
 */
export async function login(credentials) {
  const res = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  return res?.data?.user || null;
}

/**
 * Terminates session and clears the httpOnly auth cookie on Express.
 *
 * @returns {Promise<boolean>}
 */
export async function logout() {
  const res = await apiRequest('/api/v1/auth/logout', {
    method: 'POST',
  });
  return res?.success ?? true;
}

/**
 * Hydrates current authenticated user session from GET /api/v1/users/me.
 *
 * @returns {Promise<Object>} Sanitized user record
 */
export async function getCurrentUser() {
  const res = await apiRequest('/api/v1/users/me', {
    method: 'GET',
  });
  return res?.data?.user || null;
}

/**
 * Updates permitted profile fields (name, avatar) for authenticated user.
 *
 * @param {Object} updateData - Permitted fields to update
 * @returns {Promise<Object>} Updated sanitized user record
 */
export async function updateProfile(updateData) {
  const res = await apiRequest('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  });
  return res?.data?.user || null;
}

