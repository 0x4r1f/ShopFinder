import { api } from './api.js';

/**
 * ShopFinder — Public Listing Client Service (Phase 5, Task 5.1 & Task 5.2)
 *
 * Communicates exclusively with the Express backend REST API.
 * Never connects directly to PocketBase.
 */

/**
 * Retrieves approved commercial listings for marketplace browse page (Phase 5, Task 5.2, 5.3 & 5.4).
 * Supports multi-parameter filtering, sorting, and server-side pagination.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=12]
 * @param {number} [options.limit] - Legacy alias for perPage
 * @param {string} [options.sort='newest']
 * @param {string} [options.category]
 * @param {string} [options.listing_type]
 * @param {number|string} [options.min_price]
 * @param {number|string} [options.max_price]
 * @param {number|string} [options.min_area]
 * @param {number|string} [options.max_area]
 * @param {string} [options.city]
 * @param {string} [options.area]
 * @param {string} [options.search]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{listings: Array<Object>, pagination: {page: number, perPage: number, totalItems: number, totalPages: number}}>}
 */
export async function getListings(options = {}) {
  const {
    page,
    perPage,
    limit,
    sort,
    category,
    listing_type,
    min_price,
    max_price,
    min_area,
    max_area,
    city,
    area,
    search,
    signal,
  } = options;

  const params = {};
  if (page) params.page = page;
  if (perPage) params.perPage = perPage;
  else if (limit) params.limit = limit;
  if (sort) params.sort = sort;
  if (category) params.category = category;
  if (listing_type) params.listing_type = listing_type;
  if (min_price !== undefined && min_price !== null && String(min_price).trim() !== '') {
    params.min_price = min_price;
  }
  if (max_price !== undefined && max_price !== null && String(max_price).trim() !== '') {
    params.max_price = max_price;
  }
  if (min_area !== undefined && min_area !== null && String(min_area).trim() !== '') {
    params.min_area = min_area;
  }
  if (max_area !== undefined && max_area !== null && String(max_area).trim() !== '') {
    params.max_area = max_area;
  }
  if (city) params.city = city;
  if (area) params.area = area;
  if (search) params.search = search;

  const response = await api.get('/api/v1/listings', {
    params,
    signal,
  });

  const listings = response?.data?.listings || [];
  const pagination = response?.data?.pagination || {
    page: Number(page) || 1,
    perPage: Number(perPage || limit) || 12,
    totalItems: listings.length,
    totalPages: Math.max(1, Math.ceil(listings.length / (Number(perPage || limit) || 12))),
  };

  return {
    listings,
    pagination,
  };
}

/**
 * Retrieves approved, featured commercial listings for homepage showcase.
 *
 * @param {Object} [options={}]
 * @param {number} [options.limit=6]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<Object>>} Array of featured listings
 */
export async function getFeaturedListings(options = {}) {
  const { limit, signal } = options;
  const params = {};
  if (limit) {
    params.limit = limit;
  }

  const response = await api.get('/api/v1/listings/featured', {
    params,
    signal,
  });

  return response?.data?.listings || [];
}

/**
 * Retrieves a single commercial listing by ID with full photo gallery (Phase 5, Task 5.5).
 *
 * @param {string} id - Listing record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Listing record
 */
export async function getListingById(id, options = {}) {
  const { signal } = options;
  if (!id || typeof id !== 'string') {
    throw new Error('Listing ID is required');
  }

  const response = await api.get(`/api/v1/listings/${encodeURIComponent(id.trim())}`, {
    signal,
  });

  return response?.data?.listing || null;
}

const listingService = {
  getListings,
  getFeaturedListings,
  getListingById,
};

export default listingService;

