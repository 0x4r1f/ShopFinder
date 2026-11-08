import { getAdminClient } from '../config/pocketbase.js';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import { notifyCreditLow } from './notificationService.js';

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

/**
 * Executes full contact reveal workflow for an authenticated customer (Phase 10, Task 10.7).
 *
 * 1. Delegates atomic reveal transaction to PocketBase hook (D-013 & D-017).
 *    Handles credit deduction (or idempotent repeat reveal check) atomically in PocketBase SQLite.
 * 2. Retrieves private owner phone from owner_contacts hook (D-014).
 * 3. Never logs phone numbers or exposes superuser credentials.
 *
 * @param {Object} params
 * @param {string} params.customerId - Verified customer ID from authenticated session (req.user.id)
 * @param {string} params.listingId - Target listing identifier
 * @returns {Promise<{
 *   listingId: string,
 *   ownerId: string,
 *   phone: string,
 *   alreadyRevealed: boolean,
 *   creditDeducted: boolean,
 *   creditsDeducted: number,
 *   creditsRemaining: number|null,
 *   revealId: string|null,
 *   revealedAt: string|null
 * }>}
 */
export async function revealContactForCustomer({ customerId, listingId } = {}) {
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

  // 1. Delegate atomic reveal transaction (D-013 & D-017)
  const revealResponse = await delegateRevealTransaction({
    customerId: cleanCustomerId,
    listingId: cleanListingId,
  });

  const revealData = revealResponse?.data || {};

  // 2. Retrieve authorized owner phone from private owner_contacts (D-014)
  const contactResponse = await getRevealedOwnerContact({
    customerId: cleanCustomerId,
    listingId: cleanListingId,
  });

  const contactData = contactResponse?.data || {};

  // 3. Assemble unified customer payload
  const result = {
    listingId: cleanListingId,
    ownerId: revealData.ownerId || contactData.ownerId || null,
    phone: contactData.phone || '',
    alreadyRevealed: Boolean(revealData.alreadyRevealed),
    creditDeducted: Boolean(revealData.creditDeducted),
    creditsDeducted: Number.isFinite(revealData.creditsDeducted) ? revealData.creditsDeducted : 0,
    creditsRemaining: revealData.creditsRemaining !== undefined ? revealData.creditsRemaining : null,
    revealId: revealData.revealId || null,
    revealedAt: revealData.revealedAt || null,
  };

  // 4. Trigger low-credit in-app notification if legitimate credit deduction caused balance to drop to <= threshold (Phase 11, Task 11.7)
  if (result.creditDeducted && typeof result.creditsRemaining === 'number') {
    try {
      await notifyCreditLow(cleanCustomerId, result.creditsRemaining);
    } catch (notifErr) {
      // Non-fatal: notification delivery failure must never disrupt successful contact reveal
    }
  }

  return result;
}

/**
 * Strictly serializes a revealed_contacts record and its expanded listing for customer history (Phase 10, Task 10.8).
 *
 * PRIVACY & SECURITY RULES:
 * 1. Owner phone numbers are NEVER returned.
 * 2. owner_contacts collection is NEVER queried or exposed.
 * 3. PocketBase superuser credentials and internal tokens are NEVER exposed.
 * 4. Private owner fields (email, password, etc.) are NEVER returned.
 * 5. Deleted or unavailable listings return listing: null without fabricated data.
 *
 * @param {Object} item - Raw PocketBase revealed_contacts record
 * @param {import('pocketbase').default} [pb] - Optional PocketBase client instance
 * @returns {Object|null}
 */
export function serializeRevealHistoryEntry(item, pb) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const revealId = item.id;
  const listingId = item.listing || (typeof item.expand?.listing?.id === 'string' ? item.expand.listing.id : '');
  const revealedAt = item.revealed_at || item.created || null;
  const rawListing = item.expand?.listing;

  // Handle deleted or unavailable listing gracefully without leaking private details or fabricating data
  if (!rawListing || typeof rawListing !== 'object') {
    return {
      id: revealId,
      listing_id: listingId,
      revealed_at: revealedAt,
      created: item.created || null,
      title: null,
      category: null,
      listing_type: null,
      price: null,
      area_sqft: null,
      city: null,
      area: null,
      status: null,
      cover_image: null,
      listing: null,
    };
  }

  // Resolve cover image from expanded images if present
  let coverImage = null;
  const rawImages = rawListing.expand?.listing_images_via_listing;
  const images = Array.isArray(rawImages) ? rawImages : rawImages ? [rawImages] : [];
  const coverRecord = images.find((img) => img.is_cover) || images[0] || null;

  if (coverRecord && coverRecord.image) {
    const baseUrl = pb?.baseUrl || env.POCKETBASE_URL || '';
    const collection = coverRecord.collectionId || coverRecord.collectionName || 'listing_images';
    coverImage = {
      id: coverRecord.id,
      image: coverRecord.image,
      is_cover: Boolean(coverRecord.is_cover),
      url: `${baseUrl}/api/files/${collection}/${coverRecord.id}/${coverRecord.image}`,
      thumb_url: `${baseUrl}/api/files/${collection}/${coverRecord.id}/${coverRecord.image}?thumb=400x300`,
    };
  }

  const safeListing = {
    id: rawListing.id,
    title: rawListing.title || '',
    category: rawListing.category || 'other',
    listing_type: rawListing.listing_type || 'rent',
    price: Number(rawListing.price) || 0,
    area_sqft: rawListing.area_sqft !== undefined && rawListing.area_sqft !== null ? Number(rawListing.area_sqft) : null,
    address: rawListing.address || '',
    city: rawListing.city || '',
    area: rawListing.area || '',
    status: rawListing.status || 'unknown',
    cover_image: coverImage,
  };

  return {
    id: revealId,
    listing_id: rawListing.id || listingId,
    revealed_at: revealedAt,
    created: item.created || null,
    title: safeListing.title,
    category: safeListing.category,
    listing_type: safeListing.listing_type,
    price: safeListing.price,
    area_sqft: safeListing.area_sqft,
    city: safeListing.city,
    area: safeListing.area,
    status: safeListing.status,
    cover_image: safeListing.cover_image,
    listing: safeListing,
  };
}

/**
 * Retrieves paginated contact reveal history strictly scoped to the authenticated customer (Phase 10, Task 10.8).
 *
 * @param {string} customerId - Verified customer ID from authenticated session (req.user.id)
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.perPage=10] - Number of items per page (bounded between 1 and 100)
 * @returns {Promise<{
 *   history: Array<Object>,
 *   pagination: {
 *     page: number,
 *     perPage: number,
 *     totalItems: number,
 *     totalPages: number
 *   }
 * }>}
 */
export async function getCustomerRevealHistory(customerId, { page = 1, perPage = 10 } = {}) {
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    const err = new Error('customerId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  const cleanCustomerId = customerId.trim();
  const validPage = Math.max(1, Number(page) || 1);
  const validPerPage = Math.min(100, Math.max(1, Number(perPage) || 10));

  const pb = await getAdminClient();

  let result;
  try {
    result = await pb.collection('revealed_contacts').getList(validPage, validPerPage, {
      filter: pb.filter('customer = {:customerId}', { customerId: cleanCustomerId }),
      sort: '-revealed_at,-id',
      expand: 'listing,listing.listing_images_via_listing',
      requestKey: null,
    });
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve reveal history');
      safeErr.status = 503;
      throw safeErr;
    }
    const safeErr = new Error('Failed to retrieve reveal history');
    safeErr.status = err?.status || 500;
    throw safeErr;
  }

  const history = (result?.items || []).map((item) => serializeRevealHistoryEntry(item, pb));

  return {
    history,
    pagination: {
      page: result?.page || validPage,
      perPage: result?.perPage || validPerPage,
      totalItems: result?.totalItems || 0,
      totalPages: result?.totalPages || 0,
    },
  };
}



