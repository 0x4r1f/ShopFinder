import { env } from './env.js';

/**
 * Authentication Cookie Configuration & Policy (D-010)
 *
 * TOKEN INGRESS POLICY:
 * --------------------
 * ShopFinder enforces a strict cookie-only authentication policy.
 * 1. Auth tokens (PocketBase user session tokens) must be stored and transmitted
 *    EXCLUSIVELY via server-set httpOnly cookies named 'pb_auth'.
 * 2. The server NEVER accepts auth tokens from request bodies (e.g. { token: '...' })
 *    or URL query parameters (e.g. ?token=...).
 * 3. Frontend JavaScript NEVER stores tokens in localStorage, sessionStorage,
 *    or memory variables accessible to client-side scripts.
 * 4. All subsequent protected endpoints in Phase 3+ must inspect the 'pb_auth'
 *    cookie via req.cookies[AUTH_COOKIE_NAME] exclusively.
 */

export const AUTH_COOKIE_NAME = 'pb_auth';

/**
 * Generates centralized cookie options for the PocketBase auth cookie.
 *
 * Security attributes:
 * - httpOnly: true (prevents client-side scripts from reading the cookie / mitigates XSS)
 * - sameSite: 'Strict' (browser does not attach cookie on cross-site requests / primary CSRF defense)
 * - secure: true in production (enforces HTTPS transmission)
 * - path: '/' (cookie valid across the entire application domain)
 *
 * @param {Object} [overrides={}] - Optional property overrides
 * @param {string} [nodeEnv=env.NODE_ENV] - Target environment (defaults to validated env.NODE_ENV)
 * @returns {import('express').CookieOptions}
 */
export function getAuthCookieOptions(overrides = {}, nodeEnv = env.NODE_ENV) {
  const isProduction = nodeEnv === 'production';

  return {
    httpOnly: true,
    sameSite: 'Strict',
    secure: isProduction,
    path: '/',
    ...overrides
  };
}

/**
 * Sets the 'pb_auth' authentication cookie on the HTTP response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} token - The raw auth token to store
 * @param {Object} [options={}] - Optional cookie options overrides
 * @throws {Error} If token is missing or not a non-empty string
 */
export function setAuthCookie(res, token, options = {}) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Auth token must be a non-empty string');
  }

  const cookieOptions = getAuthCookieOptions(options);
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
}

/**
 * Clears the 'pb_auth' authentication cookie on the HTTP response using
 * identical security attributes (path, httpOnly, sameSite, secure) to ensure
 * reliable removal across all modern browsers.
 *
 * @param {import('express').Response} res - Express response object
 * @param {Object} [options={}] - Optional cookie options overrides
 */
export function clearAuthCookie(res, options = {}) {
  const cookieOptions = getAuthCookieOptions(options);
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
}

