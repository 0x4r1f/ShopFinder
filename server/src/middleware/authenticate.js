import PocketBase from 'pocketbase';
import { env } from '../config/env.js';
import { AUTH_COOKIE_NAME, setAuthCookie } from '../config/cookie.js';
import { sanitizeUser, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Request-Scoped JWT Verification Middleware (Task 3.4)
 *
 * Verifies PocketBase JWT tokens stored in the server-set httpOnly 'pb_auth' cookie.
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Each request creates a fresh, isolated PocketBase client (new PocketBase(env.POCKETBASE_URL)).
 *    NEVER share the Admin SDK singleton or a global client across requests.
 * 2. Token authenticity is verified live via PocketBase SDK authRefresh(), not merely decoded.
 * 3. Rejects missing, empty, malformed, invalid, expired, unverifiable, or deactivated tokens with HTTP 401.
 * 4. Attaches strictly sanitized user profile (id, name, email, role, avatar, is_active) to req.user.
 * 5. Pre-existing or client-supplied req.user properties are completely overwritten.
 * 6. Never leaks raw PocketBase error messages, tokens, passwords, or internal details.
 */

/**
 * Creates an authentication middleware instance.
 * Allows client factory injection for isolated unit testing.
 *
 * @param {Object} [options={}]
 * @param {Function} [options.clientFactory] - Factory returning a PocketBase instance
 * @returns {import('express').RequestHandler}
 */
export function createAuthenticate(options = {}) {
  const getClient = options.clientFactory || (() => new PocketBase(env.POCKETBASE_URL));

  return async function authenticate(req, res, next) {
    try {
      // 1. Read the auth cookie from req.cookies
      const cookies = req.cookies;
      const token = cookies?.[AUTH_COOKIE_NAME];

      if (!token || typeof token !== 'string' || token.trim() === '') {
        return sendError(res, 'Authentication required', 401);
      }

      // 2. Create a NEW isolated PocketBase client for this individual request
      const pb = getClient();
      if (typeof pb?.autoCancellation === 'function') {
        pb.autoCancellation(false);
      }

      // 3. Save the token into the isolated client's authStore
      if (!pb?.authStore || typeof pb.authStore.save !== 'function') {
        return sendError(res, 'Authentication service temporarily unavailable', 500);
      }
      pb.authStore.save(token.trim(), null);

      // 4. Authenticate/verify the token against PocketBase
      let authData;
      try {
        authData = await pb.collection('users').authRefresh();
      } catch (err) {
        const status = err?.status;
        if (status === 401 || status === 400 || status === 404) {
          return sendError(res, 'Invalid or expired authentication token', 401);
        }

        // PocketBase unreachable, network error, or internal server error
        return sendError(res, 'Authentication service temporarily unavailable', 503);
      }

      // 5. Validate the authenticated record
      if (!authData || !authData.record || typeof authData.record !== 'object') {
        return sendError(res, 'Invalid authentication record', 401);
      }

      // 6. Reject deactivated users
      if (authData.record.is_active === false) {
        return sendError(res, 'Account is deactivated. Please contact support.', 401);
      }

      // 7. Attach sanitized user to req.user (overwriting any pre-existing req.user)
      const sanitized = sanitizeUser(authData.record);
      if (!sanitized) {
        return sendError(res, 'Invalid user profile data', 401);
      }

      req.user = sanitized;

      // 8. If PocketBase rotated/refreshed the JWT token, persist it to the pb_auth cookie
      const refreshedToken = authData.token;
      if (refreshedToken && typeof refreshedToken === 'string' && refreshedToken !== token.trim()) {
        setAuthCookie(res, refreshedToken);
      }

      // 9. Continue to the next handler
      return next();
    } catch {
      return sendError(res, 'Authentication service temporarily unavailable', 500);
    }
  };
}

export const authenticate = createAuthenticate();

/**
 * Creates an optional authentication middleware instance (Task 5.5).
 * Allows client factory injection for unit testing.
 *
 * If a valid auth token is present, attaches req.user.
 * If missing, invalid, or expired, safely sets req.user = null without throwing HTTP 401,
 * allowing public endpoints to proceed anonymously.
 *
 * @param {Object} [options={}]
 * @param {Function} [options.clientFactory]
 * @returns {import('express').RequestHandler}
 */
export function createAuthenticateOptional(options = {}) {
  const getClient = options.clientFactory || (() => new PocketBase(env.POCKETBASE_URL));

  return async function authenticateOptional(req, res, next) {
    try {
      const cookies = req.cookies;
      const token = cookies?.[AUTH_COOKIE_NAME];

      if (!token || typeof token !== 'string' || token.trim() === '') {
        req.user = null;
        return next();
      }

      const pb = getClient();
      if (typeof pb?.autoCancellation === 'function') {
        pb.autoCancellation(false);
      }

      if (!pb?.authStore || typeof pb.authStore.save !== 'function') {
        req.user = null;
        return next();
      }
      pb.authStore.save(token.trim(), null);

      let authData;
      try {
        authData = await pb.collection('users').authRefresh();
      } catch {
        req.user = null;
        return next();
      }

      if (!authData || !authData.record || typeof authData.record !== 'object' || authData.record.is_active === false) {
        req.user = null;
        return next();
      }

      const sanitized = sanitizeUser(authData.record);
      req.user = sanitized || null;

      const refreshedToken = authData.token;
      if (refreshedToken && typeof refreshedToken === 'string' && refreshedToken !== token.trim()) {
        setAuthCookie(res, refreshedToken);
      }

      return next();
    } catch {
      req.user = null;
      return next();
    }
  };
}

export const authenticateOptional = createAuthenticateOptional();
export default authenticate;

