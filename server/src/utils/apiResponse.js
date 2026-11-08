/**
 * ShopFinder — API Response Helpers & Data Sanitization
 *
 * Implements centralized response formatting and defensive sanitization
 * guaranteeing sensitive fields (passwords, tokens, internal PocketBase keys,
 * and private phone numbers) are never leaked in API responses.
 */

/**
 * Sanitizes a PocketBase user record for client consumption.
 * Defensively excludes password hashes, tokenKey, emailVisibility,
 * private phone contacts, and internal administrative artifacts.
 *
 * @param {Object} user - Raw PocketBase user record object
 * @returns {Object|null} Sanitized user profile
 */
export function sanitizeUser(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'customer',
    avatar: user.avatar || null,
    is_active: user.is_active !== undefined ? Boolean(user.is_active) : true,
    created: user.created || null,
    updated: user.updated || null,
  };
}

/**
 * Standardized success response formatter.
 *
 * @param {import('express').Response} res - Express response
 * @param {*} [data=null] - Payload data
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string|null} [message=null] - Optional human-readable message
 */
export function sendSuccess(res, data = null, statusCode = 200, message = null) {
  const payload = {
    success: true,
  };

  if (message) {
    payload.message = message;
  }

  if (data !== null && data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Standardized error response formatter.
 *
 * @param {import('express').Response} res - Express response
 * @param {string} message - Error description
 * @param {number} [statusCode=500] - HTTP status code
 * @param {*} [details=null] - Optional structured validation details
 */
export function sendError(res, message, statusCode = 500, details = null) {
  const payload = {
    success: false,
    error: {
      message: message || 'An unexpected error occurred',
    },
  };

  if (details !== null && details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

