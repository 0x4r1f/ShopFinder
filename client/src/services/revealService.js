import { api } from './api.js';

/**
 * ShopFinder — Contact Reveal Client API Service (Phase 10, Task 10.9)
 *
 * Communicates exclusively with the Express backend REST API.
 * Never stores authentication tokens or revealed phone numbers in browser web storage or cookies (D-007, D-010, D-014).
 * Relies strictly on server-set httpOnly cookies (pb_auth) via credentials: 'include'.
 */

/**
 * Reveals the private owner phone number for a commercial property listing.
 * Calls Express endpoint POST /api/v1/customer/reveal.
 *
 * @param {string} listingId - ID of commercial property listing
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional cancellation signal
 * @returns {Promise<{
 *   success: boolean,
 *   revealed: boolean,
 *   ownerPhone: string,
 *   alreadyRevealed: boolean,
 *   creditsRemaining: number,
 *   message?: string
 * }>}
 */
export async function revealContact(listingId, options = {}) {
  const { signal } = options;

  const response = await api.post(
    '/api/v1/customer/reveal',
    { listingId },
    { signal }
  );

  return response;
}

/**
 * Retrieves the authenticated customer's paginated contact reveal history.
 * Calls Express endpoint GET /api/v1/reveal/history.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - 1-indexed page number
 * @param {number} [options.perPage=20] - Records per page (1-100)
 * @param {AbortSignal} [options.signal] - Optional cancellation signal
 * @returns {Promise<{
 *   success: boolean,
 *   history: Array<{
 *     id: string,
 *     revealedAt: string,
 *     listing: {
 *       id: string,
 *       title: string,
 *       category: string,
 *       city: string,
 *       area: string,
 *       price: number,
 *       status: string,
 *       imageUrl?: string|null
 *     }|null
 *   }>,
 *   pagination: {
 *     page: number,
 *     perPage: number,
 *     totalItems: number,
 *     totalPages: number
 *   }
 * }>}
 */
export async function getRevealHistory(options = {}) {
  const { page = 1, perPage = 20, signal } = options;

  const response = await api.get('/api/v1/reveal/history', {
    params: { page, perPage },
    signal,
  });

  return response;
}

export default {
  revealContact,
  getRevealHistory,
};

