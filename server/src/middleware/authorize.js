import { sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Role-Based Authorization Middleware Factory (Task 3.5)
 *
 * Enforces role-based access control (RBAC) on protected endpoints.
 * Operates strictly on the verified user profile attached to `req.user`
 * by the `authenticate` middleware (Task 3.4).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Role information is read EXCLUSIVELY from `req.user.role` (verified by PocketBase).
 * 2. Client-supplied role data in body, query, params, or headers is NEVER trusted.
 * 3. Missing or invalid `req.user` returns HTTP 401 Unauthorized.
 * 4. Missing, malformed, unrecognized, or unauthorized roles return HTTP 403 Forbidden.
 * 5. Role comparison is strict and case-sensitive against approved roles ('customer', 'owner', 'admin').
 * 6. Empty or invalid permitted-role configuration fails closed (HTTP 403 Forbidden).
 * 7. Never silently defaults to a privileged role.
 */

/**
 * Valid approved user roles in ShopFinder.
 */
export const VALID_ROLES = Object.freeze(['customer', 'owner', 'admin']);
const VALID_ROLES_SET = new Set(VALID_ROLES);

/**
 * Creates an Express middleware restricting route access to one or more permitted roles.
 *
 * @param {...(string|string[])} allowedRoles - One or more permitted role strings or arrays
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/owner-dashboard', authenticate, authorize('owner'), controller);
 * router.get('/admin-dashboard', authenticate, authorize('admin'), controller);
 * router.get('/shared', authenticate, authorize('owner', 'admin'), controller);
 */
export function authorize(...allowedRoles) {
  // Flatten array/spread arguments and filter for valid recognized roles
  const flattened = allowedRoles.flat();
  const permittedRoles = new Set(
    flattened.filter((role) => typeof role === 'string' && VALID_ROLES_SET.has(role))
  );

  return function authorizeMiddleware(req, res, next) {
    // 1. Verify that req.user exists and was attached by authenticate middleware
    if (!req.user || typeof req.user !== 'object' || Array.isArray(req.user)) {
      return sendError(res, 'Authentication required', 401);
    }

    // 2. Read and validate verified user role
    const userRole = req.user.role;
    if (!userRole || typeof userRole !== 'string' || !VALID_ROLES_SET.has(userRole)) {
      return sendError(res, 'Forbidden: insufficient permissions', 403);
    }

    // 3. Check if user's role is in the permitted roles set
    if (!permittedRoles.has(userRole)) {
      return sendError(res, 'Forbidden: insufficient permissions', 403);
    }

    // 4. Authorized — continue to next handler
    return next();
  };
}

export default authorize;

