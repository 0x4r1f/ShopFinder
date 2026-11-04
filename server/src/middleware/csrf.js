import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Sends a generic 403 Forbidden response to avoid leaking internal validation details.
 *
 * @param {import('express').Response} res
 */
function sendForbidden(res) {
  return res.status(403).json({
    success: false,
    error: {
      message: 'Forbidden'
    }
  });
}

/**
 * Factory creating CSRF protection middleware for state-changing requests.
 * Compares request Origin / Referer against the authorized CLIENT_URL origin.
 *
 * @param {string} [targetClientUrl=env.CLIENT_URL] - Base URL to authorize
 * @returns {import('express').RequestHandler}
 */
export function createCsrfProtect(targetClientUrl = env.CLIENT_URL) {
  let expectedOrigin;
  try {
    expectedOrigin = new URL(targetClientUrl).origin;
  } catch {
    throw new Error(`Invalid CLIENT_URL provided to CSRF protection: ${targetClientUrl}`);
  }

  return function csrfProtect(req, res, next) {
    // 1. Safe HTTP methods (GET, HEAD, OPTIONS) are read-only / idempotent and exempt
    const method = req.method ? req.method.toUpperCase() : '';
    if (SAFE_METHODS.has(method)) {
      return next();
    }

    // 2. Extract Origin and Referer headers (case-insensitive in Node http)
    const originHeader = req.headers['origin'];
    const refererHeader = req.headers['referer'] || req.headers['referrer'];

    let requestOrigin = null;

    // 3. Evaluate Origin header if present
    if (originHeader) {
      if (typeof originHeader !== 'string' || originHeader.trim() === '') {
        return sendForbidden(res);
      }
      try {
        const parsed = new URL(originHeader);
        requestOrigin = parsed.origin;
      } catch {
        // Malformed Origin header
        return sendForbidden(res);
      }
    } else if (refererHeader) {
      // 4. Fallback to Referer header if Origin is absent
      if (typeof refererHeader !== 'string' || refererHeader.trim() === '') {
        return sendForbidden(res);
      }
      try {
        const parsed = new URL(refererHeader);
        requestOrigin = parsed.origin;
      } catch {
        // Malformed Referer header
        return sendForbidden(res);
      }
    } else {
      // 5. Reject if both Origin and Referer are missing on state-changing methods
      return sendForbidden(res);
    }

    // 6. Enforce strict equality against configured client origin
    if (requestOrigin !== expectedOrigin) {
      return sendForbidden(res);
    }

    return next();
  };
}

export const csrfProtect = createCsrfProtect();
export default csrfProtect;

