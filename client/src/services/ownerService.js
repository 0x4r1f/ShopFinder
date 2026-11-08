import { api } from './api.js';

/**
 * ShopFinder — Owner Portal API Service (Phase 6, Tasks 6.5 & 6.6)
 *
 * Communicates exclusively with the Express backend owner REST endpoints.
 * Never stores authentication tokens in browser storage or client-accessible cookies;
 * relies strictly on server-set httpOnly cookies (pb_auth) via credentials: 'include'.
 */

/**
 * Retrieves commercial listings belonging exclusively to the authenticated owner.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - 1-based page number
 * @param {number} [options.perPage=12] - Items per page (clamped 1-100 on backend)
 * @param {string} [options.sort='-created'] - Sort option ('-created', 'price', '-price')
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<{listings: Array<Object>, pagination: {page: number, perPage: number, totalItems: number, totalPages: number}}>}
 */
export async function getOwnerListings(options = {}) {
  const { page = 1, perPage = 12, sort = '-created', signal } = options;

  const params = {
    page,
    perPage,
    sort,
  };

  const response = await api.get('/api/v1/owner/listings', {
    params,
    signal,
  });

  const listings = response?.data?.listings || [];
  const pagination = response?.data?.pagination || {
    page: Number(page) || 1,
    perPage: Number(perPage) || 12,
    totalItems: listings.length,
    totalPages: Math.max(1, Math.ceil(listings.length / (Number(perPage) || 12))),
  };

  return {
    listings,
    pagination,
  };
}

/**
 * Permanently deletes a commercial listing owned by the authenticated owner.
 *
 * @param {string} id - 15-character PocketBase listing record ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteListing(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Listing ID is required for deletion');
  }

  const cleanId = id.trim();
  const response = await api.delete(`/api/v1/listings/${encodeURIComponent(cleanId)}`);

  return {
    success: response?.success ?? true,
    message: response?.message || 'Listing deleted successfully',
  };
}

/**
 * Creates a new commercial property listing (Phase 6, Task 6.6).
 *
 * @param {Object} data - Validated listing payload
 * @param {string} data.title
 * @param {string} data.description
 * @param {string} data.category
 * @param {string} [data.listing_type='rent']
 * @param {number} data.price
 * @param {number} data.area_sqft
 * @param {string} data.address
 * @param {string} data.city
 * @param {string} data.area
 * @returns {Promise<Object>} Created listing record
 */
export async function createListing(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Listing payload is required');
  }

  const response = await api.post('/api/v1/listings', {
    body: data,
  });

  return response?.data?.listing || null;
}

/**
 * Updates an existing commercial property listing (Phase 6, Task 6.6).
 *
 * @param {string} id - Listing record ID
 * @param {Object} data - Changed permitted listing fields
 * @returns {Promise<Object>} Updated listing record
 */
export async function updateListing(id, data) {
  if (!id || typeof id !== 'string') {
    throw new Error('Listing ID is required for update');
  }
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  const cleanId = id.trim();
  const response = await api.patch(`/api/v1/listings/${encodeURIComponent(cleanId)}`, {
    body: data,
  });

  return response?.data?.listing || null;
}

/**
 * Retrieves an owner's commercial listing by ID for editing (Phase 6, Task 6.6).
 * Uses GET /api/v1/listings/:id which permits owner preview across all statuses.
 *
 * @param {string} id - Listing record ID
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Listing record with images
 */
export async function getListingForEdit(id, options = {}) {
  if (!id || typeof id !== 'string') {
    throw new Error('Listing ID is required');
  }

  const cleanId = id.trim();
  const response = await api.get(`/api/v1/listings/${encodeURIComponent(cleanId)}`, {
    signal: options.signal,
  });

  return response?.data?.listing || null;
}

/**
 * Uploads one or multiple images to a listing (Phase 6, Task 6.6).
 *
 * @param {string} listingId - Listing record ID
 * @param {Array<File>|FileList} files - Array or FileList of image files
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function uploadListingImages(listingId, files) {
  if (!listingId || typeof listingId !== 'string') {
    throw new Error('Listing ID is required for image upload');
  }

  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) {
    throw new Error('At least one image file is required');
  }

  const formData = new FormData();
  for (const file of fileArray) {
    formData.append('images', file);
  }

  const cleanId = listingId.trim();
  const response = await api.post(`/api/v1/listings/${encodeURIComponent(cleanId)}/images`, {
    body: formData,
  });

  return {
    images: response?.data?.images || [],
  };
}

/**
 * Deletes an individual listing image (Phase 6, Task 6.6).
 *
 * @param {string} listingId - Listing record ID
 * @param {string} imageId - Image record ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteListingImage(listingId, imageId) {
  if (!listingId || !imageId) {
    throw new Error('Listing ID and Image ID are required for image deletion');
  }

  const cleanListingId = listingId.trim();
  const cleanImageId = imageId.trim();

  const response = await api.delete(
    `/api/v1/listings/${encodeURIComponent(cleanListingId)}/images/${encodeURIComponent(cleanImageId)}`
  );

  return {
    success: response?.success ?? true,
    message: response?.message || 'Image deleted successfully',
  };
}

/**
 * Designates a specific image as the cover image for the listing (Phase 6, Task 6.6).
 *
 * @param {string} listingId - Listing record ID
 * @param {string} imageId - Image record ID
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function setCoverListingImage(listingId, imageId) {
  if (!listingId || !imageId) {
    throw new Error('Listing ID and Image ID are required for cover update');
  }

  const cleanListingId = listingId.trim();
  const cleanImageId = imageId.trim();

  const response = await api.patch(
    `/api/v1/listings/${encodeURIComponent(cleanListingId)}/images/${encodeURIComponent(cleanImageId)}/cover`
  );

  return {
    images: response?.data?.images || [],
  };
}

/**
 * Reorders listing images using a complete array of image IDs (Phase 6, Task 6.6).
 *
 * @param {string} listingId - Listing record ID
 * @param {Array<string>} order - Ordered array of all image IDs for this listing
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function reorderListingImages(listingId, order) {
  if (!listingId || !Array.isArray(order) || order.length === 0) {
    throw new Error('Listing ID and ordered array of image IDs are required');
  }

  const cleanListingId = listingId.trim();
  const response = await api.put(
    `/api/v1/listings/${encodeURIComponent(cleanListingId)}/images/order`,
    {
      body: { order },
    }
  );

  return {
    images: response?.data?.images || [],
  };
}

/**
 * Retrieves the authenticated owner's business profile and private contact phone (Phase 6, Task 6.7).
 *
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Owner profile record
 */
export async function getOwnerProfile(options = {}) {
  const response = await api.get('/api/v1/owner/profile', {
    signal: options.signal,
  });

  return response?.data?.profile || null;
}

/**
 * Updates the authenticated owner's business profile and contact phone (Phase 6, Task 6.7).
 * Accepts either a plain object { name?, phone? } or FormData (with optional avatar file).
 *
 * @param {Object|FormData} payload
 * @returns {Promise<Object>} Updated owner profile record
 */
export async function updateOwnerProfile(payload) {
  if (!payload) {
    throw new Error('Update payload is required');
  }

  const response = await api.patch('/api/v1/owner/profile', {
    body: payload,
  });

  return response?.data?.profile || null;
}

/**
 * Retrieves aggregate and listing-level analytics for the authenticated owner (Phase 12, Task 12.1).
 *
 * @param {Object} [options={}]
 * @param {'7d'|'30d'} [options.period='7d'] - Time window ('7d' or '30d')
 * @param {string|null} [options.listingId=null] - Optional single listing filter
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Owner analytics payload
 */
export async function getOwnerAnalytics(options = {}) {
  const { period = '7d', listingId = null, signal } = options;
  const params = { period };
  if (listingId) {
    params.listingId = listingId;
  }

  const response = await api.get('/api/v1/owner/analytics', {
    params,
    signal,
  });

  return response?.data || null;
}

const ownerService = {
  getOwnerListings,
  deleteListing,
  createListing,
  updateListing,
  getListingForEdit,
  uploadListingImages,
  deleteListingImage,
  setCoverListingImage,
  reorderListingImages,
  getOwnerProfile,
  updateOwnerProfile,
  getOwnerAnalytics,
};

export default ownerService;
