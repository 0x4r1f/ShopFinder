import { getAdminClient } from '../config/pocketbase.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Contact Reveal Service Layer (Phase 10, Task 10.2)
 *
 * Implements Trusted Express Identity Delegation (D-017) and internal
 * communication with PocketBase's atomic reveal transaction hook (D-013).
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Customer identity is derived exclusively from the authenticated session (req.user.id).
 * 2. Any browser-supplied customerId (body, query, headers) is strictly rejected (HTTP 400),
 *    even if it matches req.user.id. Client identity overrides are never permitted.
 * 3. Enforces customer role authorization (req.user.role === 'customer').
 * 4. Calls the internal PocketBase route (/api/custom/reveal) via the Superuser Admin SDK singleton.
 * 5. In the internal route, e.requestInfo().auth.id is the superuser; the customer identity
 *    is delegated in the internal payload and validated by txApp in PocketBase.
 * 6. Never leaks PocketBase superuser credentials, internal tokens, or stack traces to client responses.
 */

/**
 * Express middleware that strictly rejects any client-supplied customerId in request body,
 * query parameters, or custom identity headers to prevent identity override attempts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function rejectClientIdentityOverride(req, res, next) {
  if (
    req.body?.customerId !== undefined ||
    req.query?.customerId !== undefined ||
    req.headers?.['x-customer-id'] !== undefined ||
    req.headers?.['customer-id'] !== undefined
  ) {
    return sendError(
      res,
      'Client-supplied customerId is strictly prohibited. Identity is derived exclusively from your authenticated session.',
      400
    );
  }
  return next();
}

/**
 * Express middleware to strictly reject client attempts to provide or override
 * customerId, ownerId, or phone in body, query, or headers (Task 10.6).
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export function rejectClientContactOverrides(req, res, next) {
  if (
    req.body?.customerId !== undefined ||
    req.query?.customerId !== undefined ||
    req.headers?.['x-customer-id'] !== undefined ||
    req.headers?.['customer-id'] !== undefined
  ) {
    return sendError(
      res,
      'Client-supplied customerId is strictly prohibited. Identity is derived exclusively from your authenticated session.',
      400
    );
  }

  if (req.body?.ownerId !== undefined || req.query?.ownerId !== undefined) {
    return sendError(
      res,
      'Client-supplied ownerId is prohibited. Owner relation is derived from verified listing records.',
      400
    );
  }

  if (req.body?.phone !== undefined || req.query?.phone !== undefined) {
    return sendError(
      res,
      'Client-supplied phone is prohibited.',
      400
    );
  }

  return next();
}

/**
 * Extracts and validates the trusted customer ID exclusively from authenticated req.user.id.
 * Rejects any client-supplied customerId overrides in body, query, or headers.
 *
 * @param {import('express').Request} req - Express request object
 * @returns {string} Verified customer ID
 * @throws {Error} If unauthenticated (401), unauthorized (403), or override attempted (400)
 */
export function getTrustedCustomerId(req) {
  // 1. Strictly reject any client-supplied customerId override in body, query, or headers
  if (
    req.body?.customerId !== undefined ||
    req.query?.customerId !== undefined ||
    req.headers?.['x-customer-id'] !== undefined ||
    req.headers?.['customer-id'] !== undefined
  ) {
    const err = new Error(
      'Client-supplied customerId is strictly prohibited. Identity is derived exclusively from your authenticated session.'
    );
    err.status = 400;
    throw err;
  }

  // 2. Validate authentication context attached by authenticate middleware
  if (!req?.user || typeof req.user !== 'object' || Array.isArray(req.user)) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  // 3. Enforce customer role (reject owner and admin)
  if (req.user.role !== 'customer') {
    const err = new Error('Forbidden: insufficient permissions');
    err.status = 403;
    throw err;
  }

  // 4. Validate customer ID format
  const customerId = req.user.id;
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    const err = new Error('Invalid authenticated customer identifier');
    err.status = 401;
    throw err;
  }

  return customerId.trim();
}

/**
 * Invokes the internal PocketBase atomic contact reveal transaction route
 * using the server-side Superuser Admin SDK singleton (D-013 & D-017).
 *
 * @param {Object} params
 * @param {string} params.customerId - Verified customer ID derived from req.user.id
 * @param {string} [params.listingId] - Target listing ID
 * @param {boolean} [params.testRollback=false] - Testing simulation flag for atomicity verification
 * @param {string} [params.testRecordId=null] - Test record identifier for rollback mutation
 * @returns {Promise<Object>} Response from the PocketBase internal transaction route
 */
export async function delegateRevealTransaction({
  customerId,
  listingId,
  verifyOnly = false,
  testRollback = false,
  testRecordId = null,
  simulateCreditUpdateFailure = false,
  simulateRevealSaveFailure = false,
  bypassIdempotencyCheck = false,
} = {}) {
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    const err = new Error('customerId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  const cleanCustomerId = customerId.trim();
  const pb = await getAdminClient();

  const payload = {
    customerId: cleanCustomerId,
    ...(listingId ? { listingId: String(listingId).trim() } : {}),
    ...(verifyOnly ? { verifyOnly: true } : {}),
    ...(testRollback ? { testRollback: true, ...(testRecordId ? { testRecordId } : {}) } : {}),
    ...(simulateCreditUpdateFailure ? { simulateCreditUpdateFailure: true } : {}),
    ...(simulateRevealSaveFailure ? { simulateRevealSaveFailure: true } : {}),
    ...(bypassIdempotencyCheck ? { bypassIdempotencyCheck: true } : {}),
  };

  try {
    const response = await pb.send('/api/custom/reveal', {
      method: 'POST',
      body: payload,
    });
    return response;
  } catch (pbErr) {
    const status = pbErr?.status || 500;
    const message = pbErr?.response?.message || pbErr?.message || 'Contact reveal transaction failed';
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

/**
 * Retrieves the private owner phone for an authorized customer who has an existing reveal
 * record for the requested listing (D-014 & D-017).
 *
 * @param {Object} params
 * @param {string} params.customerId - Authenticated customer's user ID (req.user.id)
 * @param {string} params.listingId - Listing ID
 * @returns {Promise<{ success: boolean, message: string, data: { status: string, listingId: string, ownerId: string, phone: string } }>}
 */
export async function getRevealedOwnerContact({ customerId, listingId } = {}) {
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    const err = new Error('customerId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  if (!listingId || typeof listingId !== 'string' || listingId.trim() === '') {
    const err = new Error('listingId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  const cleanCustomerId = customerId.trim();
  const cleanListingId = listingId.trim();
  const pb = await getAdminClient();

  try {
    const response = await pb.send('/api/custom/contact-retrieval', {
      method: 'POST',
      body: {
        customerId: cleanCustomerId,
        listingId: cleanListingId,
      },
    });
    return response;
  } catch (pbErr) {
    const status = pbErr?.status || 500;
    const message = pbErr?.response?.message || pbErr?.message || 'Failed to retrieve owner contact';
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

