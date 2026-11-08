import PocketBase from 'pocketbase';
import { env } from './env.js';

/**
 * PocketBase Admin SDK Client Singleton (Task 3.1)
 *
 * CRITICAL ARCHITECTURAL SECURITY BOUNDARY:
 * ----------------------------------------
 * 1. This singleton client is EXCLUSIVELY for privileged server-to-server operations
 *    performed by the Express backend (e.g. administrative operations, background tasks,
 *    atomic contact reveal transactions, webhook verifications, and system updates).
 * 2. This singleton MUST NEVER be used for customer, owner, or admin user session
 *    verification in Task 3.4 (authenticate.js). User session verification requires a fresh,
 *    isolated PocketBase instance per incoming HTTP request to prevent race conditions,
 *    shared authentication state, and session bleeding between concurrent user requests.
 * 3. Superuser credentials and session tokens must NEVER be leaked to logs, client responses,
 *    or the frontend application.
 */

// Initialize single server-side client with validated internal database URL
export const pbAdmin = new PocketBase(env.POCKETBASE_URL);

// Disable auto-cancellation for server-side concurrent requests
pbAdmin.autoCancellation(false);

// In-flight authentication promise mutex to prevent concurrent thundering herd
let authPromise = null;

/**
 * Ensures the Admin SDK client is authenticated with PocketBase as a superuser.
 * Automatically handles initial authentication and re-authentication if the token
 * is invalid or expired.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false] - Force re-authentication even if authStore is locally valid
 * @returns {Promise<PocketBase>} Authenticated PocketBase client singleton
 */
export async function ensureAdminAuth({ force = false } = {}) {
  // If token is already valid and fresh, reuse immediately without network roundtrip
  if (!force && pbAdmin.authStore.isValid) {
    return pbAdmin;
  }

  // If authentication is already in progress from another concurrent request, await the existing promise
  if (authPromise) {
    await authPromise;
    return pbAdmin;
  }

  authPromise = (async () => {
    try {
      // Authenticate against PocketBase _superusers collection using validated credentials
      await pbAdmin.collection('_superusers').authWithPassword(
        env.POCKETBASE_ADMIN_EMAIL,
        env.POCKETBASE_ADMIN_PASSWORD
      );
      return pbAdmin;
    } catch (err) {
      // Strictly generic safe error message — never forward raw SDK error messages, tokens, credentials, or payload data
      const safeError = new Error('PocketBase Admin SDK authentication failed');
      const safeStatus = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599
        ? err.status
        : 500;
      safeError.status = safeStatus;
      throw safeError;
    } finally {
      // Release in-flight mutex
      authPromise = null;
    }
  })();

  await authPromise;
  return pbAdmin;
}

/**
 * Safe accessor returning the authenticated PocketBase Admin SDK client singleton.
 * Guarantees that the client is authenticated before returning it to caller.
 *
 * @returns {Promise<PocketBase>}
 */
export async function getAdminClient() {
  await ensureAdminAuth();
  return pbAdmin;
}

/**
 * Clears the superuser auth store.
 * Primarily used by test suites to simulate token expiration and re-authentication.
 */
export function resetAdminAuthStore() {
  pbAdmin.authStore.clear();
}

export default getAdminClient;

