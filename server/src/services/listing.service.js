import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Public Listing Service (Phase 5, Task 5.1)
 *
 * Provides backend database operations for public listing discovery.
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. Only listings with status = 'approved' may be returned to public consumers.
 * 2. Never fetch, join, or expose owner_contacts or owner phone numbers.
 * 3. Sanitizes user relations to safe public profile fields (id, name, created).
 * 4. Extracts cover images safely from the listing_images relation.
 */

/**
 * Sanitizes a raw PocketBase listing record for public API response.
 *
 * @param {Object} item - Raw PocketBase listing record
 * @param {import('pocketbase').default} pb - PocketBase client instance for URL generation
 * @returns {Object|null} Sanitized listing object
 */
export function sanitizePublicListing(item, pb) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // 1. Resolve cover image from expanded listing_images relation
  const rawImages = item.expand?.listing_images_via_listing;
  const images = Array.isArray(rawImages) ? rawImages : rawImages ? [rawImages] : [];
  const coverRecord = images.find((img) => img.is_cover) || images[0] || null;

  let coverImage = null;
  if (coverRecord && coverRecord.image) {
    const baseUrl = pb?.baseUrl || '';
    const collection = coverRecord.collectionId || coverRecord.collectionName || 'listing_images';
    coverImage = {
      id: coverRecord.id,
      image: coverRecord.image,
      is_cover: Boolean(coverRecord.is_cover),
      url: `${baseUrl}/api/files/${collection}/${coverRecord.id}/${coverRecord.image}`,
      thumb_url: `${baseUrl}/api/files/${collection}/${coverRecord.id}/${coverRecord.image}?thumb=400x300`,
    };
  }

  // 2. Resolve safe public owner information (strict allowlist with defensive shape unwrapping)
  let owner = null;
  const rawOwner = Array.isArray(item.expand?.owner) ? item.expand.owner[0] : item.expand?.owner;
  if (rawOwner && typeof rawOwner === 'object' && rawOwner.id && typeof rawOwner.id === 'string') {
    owner = {
      id: rawOwner.id,
      name: typeof rawOwner.name === 'string' ? rawOwner.name : '',
      created: rawOwner.created || null,
    };
  } else if (item.owner) {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;
    if (ownerId && typeof ownerId === 'string') {
      owner = {
        id: ownerId,
      };
    }
  }

  return {
    id: item.id,
    title: item.title || '',
    description: item.description || '',
    category: item.category || 'other',
    listing_type: item.listing_type || 'rent',
    price: Number(item.price) || 0,
    area_sqft: item.area_sqft !== undefined && item.area_sqft !== null ? Number(item.area_sqft) : null,
    address: item.address || '',
    city: item.city || '',
    area: item.area || '',
    status: item.status,
    is_featured: Boolean(item.is_featured),
    created: item.created || null,
    updated: item.updated || null,
    cover_image: coverImage,
    owner,
  };
}

/**
 * Helper to populate missing cover images on listing objects using secondary fallback lookup.
 *
 * @param {Array<Object>} listings
 * @param {import('pocketbase').default} pb
 */
async function populateMissingCoverImages(listings, pb) {
  const missingCoverListings = listings.filter((l) => l.cover_image === null);
  if (missingCoverListings.length === 0) return;

  try {
    const listingIds = missingCoverListings.map((l) => `listing = "${l.id}"`).join(' || ');
    const imageRecords = await pb.collection('listing_images').getFullList({
      filter: listingIds,
      sort: '-is_cover,order,created',
    });

    const imagesByListing = {};
    for (const img of imageRecords) {
      if (!imagesByListing[img.listing]) {
        imagesByListing[img.listing] = img;
      }
    }

    for (const listing of listings) {
      if (!listing.cover_image && imagesByListing[listing.id]) {
        const img = imagesByListing[listing.id];
        const collection = img.collectionId || img.collectionName || 'listing_images';
        listing.cover_image = {
          id: img.id,
          image: img.image,
          is_cover: Boolean(img.is_cover),
          url: `${pb.baseUrl}/api/files/${collection}/${img.id}/${img.image}`,
          thumb_url: `${pb.baseUrl}/api/files/${collection}/${img.id}/${img.image}?thumb=400x300`,
        };
      }
    }
  } catch {
    // Non-fatal: if secondary image fetch fails, listings are still safely served without images
  }
}

/**
 * Retrieves approved commercial listings for the public marketplace browse page (Phase 5, Task 5.2, 5.3 & 5.4).
 * Supports multi-parameter search, filtering, approved sorting, and server-side pagination.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - Requested page number (1-indexed)
 * @param {number} [options.perPage=12] - Number of items per page (1-100)
 * @param {number} [options.limit] - Legacy alias for perPage
 * @param {string} [options.sort='-created'] - PocketBase sort string (-created, price, -price)
 * @param {string} [options.category] - Commercial category (retail, office, etc.)
 * @param {string} [options.listing_type] - Listing type (rent, sale)
 * @param {number} [options.min_price] - Minimum price (BDT)
 * @param {number} [options.max_price] - Maximum price (BDT)
 * @param {number} [options.min_area] - Minimum area (sqft)
 * @param {number} [options.max_area] - Maximum area (sqft)
 * @param {string} [options.city] - City name
 * @param {string} [options.area] - Area/neighborhood name
 * @param {string} [options.search] - Free-text keyword search across title, description, address
 * @returns {Promise<Array<Object>>} Array of sanitized approved commercial listings with attached .pagination metadata
 */
export async function getListings(options = {}) {
  const {
    page = 1,
    perPage = 12,
    limit,
    sort = '-created',
    category,
    listing_type,
    min_price,
    max_price,
    min_area,
    max_area,
    city,
    area,
    search,
  } = options;

  const pb = await getAdminClient();
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePerPage = Math.min(Math.max(parseInt(perPage || limit, 10) || 12, 1), 100);
  const safeSort = typeof sort === 'string' && sort.trim() ? sort.trim() : '-created';

  // CRITICAL SECURITY INVARIANT: status = "approved" is always mandatory
  const filterParts = ['status = "approved"'];
  const filterParams = {};

  if (category) {
    filterParts.push('category = {:category}');
    filterParams.category = category;
  }

  if (listing_type) {
    filterParts.push('listing_type = {:listing_type}');
    filterParams.listing_type = listing_type;
  }

  if (min_price !== undefined && min_price !== null) {
    filterParts.push('price >= {:min_price}');
    filterParams.min_price = Number(min_price);
  }

  if (max_price !== undefined && max_price !== null) {
    filterParts.push('price <= {:max_price}');
    filterParams.max_price = Number(max_price);
  }

  if (min_area !== undefined && min_area !== null) {
    filterParts.push('area_sqft >= {:min_area}');
    filterParams.min_area = Number(min_area);
  }

  if (max_area !== undefined && max_area !== null) {
    filterParts.push('area_sqft <= {:max_area}');
    filterParams.max_area = Number(max_area);
  }

  if (city) {
    filterParts.push('city ~ {:city}');
    filterParams.city = String(city).trim();
  }

  if (area) {
    filterParts.push('area ~ {:area}');
    filterParams.area = String(area).trim();
  }

  if (search) {
    filterParts.push('(title ~ {:search} || description ~ {:search} || address ~ {:search})');
    filterParams.search = String(search).trim();
  }

  // Construct secure parameterized PocketBase filter expression
  const filter = pb.filter(filterParts.join(' && '), filterParams);

  let result;
  try {
    result = await pb.collection('listings').getList(safePage, safePerPage, {
      filter,
      sort: safeSort,
      expand: 'listing_images_via_listing,owner',
    });
  } catch (pbErr) {
    const safeErr = new Error('Failed to retrieve commercial listings');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const listings = (result.items || []).map((item) => sanitizePublicListing(item, pb));
  await populateMissingCoverImages(listings, pb);

  // Attach pagination metadata while preserving Array type for backward compatibility
  listings.pagination = {
    page: result.page || safePage,
    perPage: result.perPage || safePerPage,
    totalItems: typeof result.totalItems === 'number' ? result.totalItems : listings.length,
    totalPages: Math.max(1, typeof result.totalPages === 'number' ? result.totalPages : 1),
  };
  listings.page = listings.pagination.page;
  listings.perPage = listings.pagination.perPage;
  listings.totalItems = listings.pagination.totalItems;
  listings.totalPages = listings.pagination.totalPages;

  return listings;
}

/**
 * Retrieves approved, featured commercial listings for homepage showcase.
 *
 * @param {Object} [options={}]
 * @param {number} [options.limit=6] - Number of featured listings to return (max 20)
 * @returns {Promise<Array<Object>>} Array of sanitized featured listings
 */
export async function getFeaturedListings({ limit = 6 } = {}) {
  const pb = await getAdminClient();

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 20);

  // Strict query: approved status AND is_featured flag
  let result;
  try {
    result = await pb.collection('listings').getList(1, safeLimit, {
      filter: 'status = "approved" && is_featured = true',
      sort: '-created',
      expand: 'listing_images_via_listing,owner',
    });
  } catch (pbErr) {
    const safeErr = new Error('Failed to retrieve featured commercial listings');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const listings = (result.items || []).map((item) => sanitizePublicListing(item, pb));
  await populateMissingCoverImages(listings, pb);

  return listings;
}

/**
 * Retrieves a single commercial listing by ID with full photo gallery (Phase 5, Task 5.5).
 *
 * ACCESS & AUTHORIZATION RULES (Decision 2):
 * - Public visitors and other users can ONLY access listings with status = 'approved'.
 * - Authenticated owner of the listing can preview their own 'pending' or 'rejected' listing.
 * - Authenticated admin can preview any listing regardless of status.
 * - Unauthorized requests for unapproved listings receive HTTP 404 (not 403, preventing enumeration).
 *
 * @param {string} id - 15-character PocketBase record ID
 * @param {Object} [options={}]
 * @param {Object|null} [options.user=null] - Authenticated user record (if any)
 * @returns {Promise<Object>} Sanitized listing details with images array
 */
export async function getListingById(id, { user = null } = {}) {
  // Validate ID format (PocketBase IDs are 15 alphanumeric characters)
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(id.trim())) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const cleanId = id.trim();
  const pb = await getAdminClient();

  let record;
  try {
    record = await pb.collection('listings').getOne(cleanId, {
      expand: 'owner',
    });
  } catch (pbErr) {
    if (pbErr?.status === 404 || pbErr?.status === 400) {
      const err = new Error('Listing not found');
      err.status = 404;
      throw err;
    }
    const safeErr = new Error('Failed to retrieve listing details');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  // Authorization check (Decision 2):
  // If not approved, only the listing owner or an admin may view it.
  const ownerId = typeof record.owner === 'object' && record.owner ? record.owner.id : record.owner;
  const isOwner = Boolean(user && user.id && user.id === ownerId);
  const isAdmin = Boolean(user && user.role === 'admin');

  if (record.status !== 'approved' && !isOwner && !isAdmin) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  // Fetch full gallery of listing images sorted by cover, display order, creation
  let images = [];
  try {
    const imageRecords = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:id}', { id: cleanId }),
      sort: '-is_cover,order,created',
    });
    const baseUrl = pb.baseUrl || '';
    images = imageRecords.map((img) => {
      const collection = img.collectionId || img.collectionName || 'listing_images';
      return {
        id: img.id,
        image: img.image,
        is_cover: Boolean(img.is_cover),
        order: typeof img.order === 'number' ? img.order : 0,
        url: `${baseUrl}/api/files/${collection}/${img.id}/${img.image}`,
        thumb_url: `${baseUrl}/api/files/${collection}/${img.id}/${img.image}?thumb=800x600`,
      };
    });
  } catch {
    images = [];
  }

  const sanitized = sanitizePublicListing(record, pb);
  if (!sanitized) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  sanitized.images = images;
  if (!sanitized.cover_image && images.length > 0) {
    const coverRecord = images.find((img) => img.is_cover) || images[0];
    sanitized.cover_image = {
      id: coverRecord.id,
      image: coverRecord.image,
      is_cover: Boolean(coverRecord.is_cover),
      url: coverRecord.url,
      thumb_url: coverRecord.thumb_url,
    };
  }

  return sanitized;
}

/**
 * Creates a new commercial property listing in PocketBase (Phase 6, Task 6.1).
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. Owner is strictly set from verified userId (req.user.id), never client-provided.
 * 2. New listings always receive status = 'pending'.
 * 3. listing_type defaults to 'rent' when omitted.
 * 4. Uses server-side Admin SDK singleton to write to locked listings collection.
 * 5. Returns sanitized listing response with zero sensitive data or credentials.
 *
 * @param {string} userId - Verified owner user ID from req.user.id
 * @param {Object} data - Validated listing payload
 * @returns {Promise<Object>} Sanitized listing record
 */
export async function createListing(userId, data) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Invalid owner identifier');
    err.status = 400;
    throw err;
  }

  const pb = await getAdminClient();

  const payload = {
    owner: userId,
    title: data.title,
    description: data.description,
    category: data.category,
    listing_type: data.listing_type || 'rent',
    price: data.price,
    area_sqft: data.area_sqft,
    address: data.address,
    city: data.city,
    area: data.area,
    status: 'pending',
  };

  let record;
  try {
    record = await pb.collection('listings').create(payload, {
      expand: 'owner',
    });
  } catch (pbErr) {
    const safeErr = new Error(pbErr?.message || 'Failed to create listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  return sanitizePublicListing(record, pb);
}

/**
 * Updates an existing commercial property listing in PocketBase (Phase 6, Task 6.2).
 *
 * CRITICAL SECURITY & BUSINESS RULES:
 * 1. Strict ownership verification: listing.owner must equal userId (req.user.id).
 * 2. Non-existent listing returns HTTP 404; non-owned listing returns HTTP 403.
 * 3. D-002 Re-approval Policy: If existing status is 'approved', any core-field update
 *    automatically resets status to 'pending'.
 * 4. Pending listings remain 'pending'; rejected listings remain 'rejected'.
 * 5. Returns sanitized listing response with zero sensitive data or credentials.
 *
 * @param {string} id - 15-character PocketBase record ID
 * @param {string} userId - Verified owner user ID from req.user.id
 * @param {Object} data - Validated update payload
 * @returns {Promise<Object>} Sanitized updated listing record
 */
export async function updateListing(id, userId, data = {}) {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(id.trim())) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const cleanId = id.trim();
  const pb = await getAdminClient();

  // Retrieve existing listing to verify existence and ownership
  let existing;
  try {
    existing = await pb.collection('listings').getOne(cleanId);
  } catch (pbErr) {
    if (pbErr?.status === 404 || pbErr?.status === 400) {
      const err = new Error('Listing not found');
      err.status = 404;
      throw err;
    }
    const safeErr = new Error('Failed to retrieve listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  // Verify ownership (IDOR defense)
  const ownerId = typeof existing.owner === 'object' && existing.owner ? existing.owner.id : existing.owner;
  if (ownerId !== userId) {
    const err = new Error('Access denied: you do not own this listing');
    err.status = 403;
    throw err;
  }

  // Explicitly map permitted update fields
  const payload = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.category !== undefined) payload.category = data.category;
  if (data.listing_type !== undefined) payload.listing_type = data.listing_type;
  if (data.price !== undefined) payload.price = data.price;
  if (data.area_sqft !== undefined) payload.area_sqft = data.area_sqft;
  if (data.address !== undefined) payload.address = data.address;
  if (data.city !== undefined) payload.city = data.city;
  if (data.area !== undefined) payload.area = data.area;

  // D-002 Re-approval Policy:
  // If status was 'approved', any core-field edit reverts it to 'pending'.
  // If status was 'pending' or 'rejected', preserve existing status.
  if (existing.status === 'approved') {
    payload.status = 'pending';
  }

  let updatedRecord;
  try {
    updatedRecord = await pb.collection('listings').update(cleanId, payload, {
      expand: 'owner',
    });
  } catch (pbErr) {
    const safeErr = new Error(pbErr?.message || 'Failed to update listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  return sanitizePublicListing(updatedRecord, pb);
}

/**
 * Deletes an existing commercial property listing in PocketBase (Phase 6, Task 6.2).
 *
 * CRITICAL SECURITY & BUSINESS RULES:
 * 1. Strict ownership verification: listing.owner must equal userId (req.user.id).
 * 2. Non-existent listing returns HTTP 404; non-owned listing returns HTTP 403.
 * 3. Cascade deletes associated listing_images records and storage files via PocketBase relation.
 *
 * @param {string} id - 15-character PocketBase record ID
 * @param {string} userId - Verified owner user ID from req.user.id
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteListing(id, userId) {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(id.trim())) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const cleanId = id.trim();
  const pb = await getAdminClient();

  // Retrieve existing listing to verify existence and ownership
  let existing;
  try {
    existing = await pb.collection('listings').getOne(cleanId);
  } catch (pbErr) {
    if (pbErr?.status === 404 || pbErr?.status === 400) {
      const err = new Error('Listing not found');
      err.status = 404;
      throw err;
    }
    const safeErr = new Error('Failed to retrieve listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  // Verify ownership (IDOR defense)
  const ownerId = typeof existing.owner === 'object' && existing.owner ? existing.owner.id : existing.owner;
  if (ownerId !== userId) {
    const err = new Error('Access denied: you do not own this listing');
    err.status = 403;
    throw err;
  }

  try {
    await pb.collection('listings').delete(cleanId);
  } catch (pbErr) {
    const safeErr = new Error(pbErr?.message || 'Failed to delete listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  return { success: true, message: 'Listing deleted successfully' };
}

/**
 * Retrieves all commercial listings belonging exclusively to the authenticated owner (Phase 6, Task 6.2).
 * Returns records across all statuses (pending, approved, rejected, archived) with pagination.
 *
 * @param {string} userId - Verified owner user ID from req.user.id
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=12]
 * @param {string} [options.sort='-created']
 * @returns {Promise<{listings: Array<Object>, pagination: Object}>}
 */
export async function getOwnerListings(userId, options = {}) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const { page = 1, perPage = 12, sort = '-created' } = options;
  const pb = await getAdminClient();

  let result;
  try {
    result = await pb.collection('listings').getList(page, perPage, {
      filter: pb.filter('owner = {:owner}', { owner: userId }),
      sort,
      expand: 'owner,listing_images_via_listing',
    });
  } catch (pbErr) {
    const safeErr = new Error('Failed to retrieve owner listings');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const listings = result.items.map((item) => sanitizePublicListing(item, pb));
  await populateMissingCoverImages(listings, pb);

  const pagination = {
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };

  return { listings, pagination };
}

// =========================================================================
// Image Management Services (Phase 6, Task 6.3)
// =========================================================================

/**
 * In-memory serialization queue per listing ID to prevent race conditions
 * on concurrent image uploads, reorders, cover selections, and deletions.
 */
const listingLocks = new Map();

/**
 * Runs an asynchronous operation within a per-listing mutual exclusion lock.
 *
 * @template T
 * @param {string} listingId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withListingLock(listingId, fn) {
  const currentLock = listingLocks.get(listingId) || Promise.resolve();
  let release;
  const newLock = new Promise((resolve) => {
    release = resolve;
  });

  listingLocks.set(listingId, currentLock.then(() => newLock, () => newLock));

  await currentLock.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (listingLocks.get(listingId) === newLock) {
      listingLocks.delete(listingId);
    }
  }
}

/**
 * Serializes a PocketBase listing_images record into a safe, client-usable format.
 *
 * @param {Object} img - Raw PocketBase image record
 * @param {import('pocketbase').default} pb - PocketBase client instance
 * @returns {Object}
 */
export function formatImageRecord(img, pb) {
  const baseUrl = pb?.baseUrl || '';
  const collection = img.collectionId || img.collectionName || 'listing_images';
  return {
    id: img.id,
    image: img.image,
    is_cover: Boolean(img.is_cover),
    order: typeof img.order === 'number' ? img.order : 0,
    url: `${baseUrl}/api/files/${collection}/${img.id}/${img.image}`,
    thumb_url: `${baseUrl}/api/files/${collection}/${img.id}/${img.image}?thumb=400x300`,
  };
}

/**
 * Retrieves a listing and verifies that the authenticated user owns it.
 * Throws HTTP 404 if missing or ID malformed; throws HTTP 403 if owned by another user.
 *
 * @param {string} id - 15-character PocketBase record ID
 * @param {string} userId - Authenticated user ID
 * @param {import('pocketbase').default} pb - Admin SDK client
 * @returns {Promise<Object>}
 */
async function getOwnedListing(id, userId, pb) {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(id.trim())) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  const cleanId = id.trim();
  let existing;
  try {
    existing = await pb.collection('listings').getOne(cleanId);
  } catch (pbErr) {
    if (pbErr?.status === 404 || pbErr?.status === 400) {
      const err = new Error('Listing not found');
      err.status = 404;
      throw err;
    }
    const safeErr = new Error('Failed to retrieve listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const ownerId = typeof existing.owner === 'object' && existing.owner ? existing.owner.id : existing.owner;
  if (ownerId !== userId) {
    const err = new Error('Access denied: you do not own this listing');
    err.status = 403;
    throw err;
  }

  return existing;
}

/**
 * Applies D-002 Re-approval Policy to listing image modifications:
 * Reverts 'approved' listings to 'pending'; preserves 'pending', 'rejected', or 'archived'.
 *
 * @param {Object} listing - Existing listing record before modification
 * @param {string} cleanId - 15-character listing ID
 * @param {import('pocketbase').default} pb - Admin SDK client
 */
async function applyImageStatusTransition(listing, cleanId, pb) {
  if (listing.status === 'approved') {
    await pb.collection('listings').update(cleanId, { status: 'pending' });
  }
}

/**
 * Uploads one or multiple images to an owner's listing (Phase 6, Task 6.3).
 *
 * Constraints:
 * - Enforces per-listing capacity limit of 20 images total.
 * - If listing has no images, the first uploaded image is automatically marked as cover.
 * - Sequential upload with automatic rollback: if any image fails midway,
 *   all records created during this batch are deleted.
 * - Reverts 'approved' listings to 'pending' upon successful upload (D-002).
 *
 * @param {string} listingId
 * @param {string} userId
 * @param {Array<Express.Multer.File>} files
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function uploadListingImages(listingId, userId, files) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    const err = new Error('No image files provided');
    err.status = 400;
    throw err;
  }

  const cleanId = (listingId || '').trim();
  const pb = await getAdminClient();

  return withListingLock(cleanId, async () => {
    const listing = await getOwnedListing(cleanId, userId, pb);

    // Fetch existing images to check capacity and determine next order
    const existingImages = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:id}', { id: cleanId }),
      sort: 'order,created',
    });

    if (existingImages.length + files.length > 20) {
      const err = new Error(
        `Maximum of 20 images per listing allowed. Current: ${existingImages.length}, incoming: ${files.length}.`
      );
      err.status = 400;
      throw err;
    }

    const hasCover = existingImages.some((img) => img.is_cover);
    const maxOrder = existingImages.reduce(
      (max, img) => Math.max(max, typeof img.order === 'number' ? img.order : 0),
      -1
    );
    const nextOrder = maxOrder + 1;

    const createdBatchRecords = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isCover = !hasCover && i === 0;
        const order = nextOrder + i;

        const formData = new FormData();
        formData.append('listing', cleanId);
        formData.append('is_cover', isCover ? 'true' : 'false');
        formData.append('order', String(order));
        formData.append(
          'image',
          new Blob([file.buffer], { type: file.mimetype }),
          file.originalname || `image_${Date.now()}_${i}.png`
        );

        const record = await pb.collection('listing_images').create(formData);
        createdBatchRecords.push(record);
      }
    } catch (uploadErr) {
      // Rollback: purge all image records created during this batch
      for (const rec of createdBatchRecords) {
        try {
          await pb.collection('listing_images').delete(rec.id);
        } catch {
          // Ignore secondary cleanup error
        }
      }
      const safeErr = new Error('Failed to upload image batch');
      safeErr.status = uploadErr?.status || 500;
      throw safeErr;
    }

    // Apply D-002 status transition after successful upload
    await applyImageStatusTransition(listing, cleanId, pb);

    const formattedImages = createdBatchRecords.map((r) => formatImageRecord(r, pb));
    return { images: formattedImages };
  });
}

/**
 * Deletes an individual listing image (Phase 6, Task 6.3).
 *
 * Constraints:
 * - Verifies listing ownership and verifies image belongs to this listing.
 * - If deleted image was cover, automatically promotes remaining image with lowest order to cover.
 * - Reverts 'approved' listings to 'pending' upon successful deletion (D-002).
 *
 * @param {string} listingId
 * @param {string} imageId
 * @param {string} userId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteListingImage(listingId, imageId, userId) {
  const cleanId = (listingId || '').trim();
  const cleanImageId = (imageId || '').trim();

  if (!cleanImageId || !/^[a-zA-Z0-9]{15}$/.test(cleanImageId)) {
    const err = new Error('Image not found');
    err.status = 404;
    throw err;
  }

  const pb = await getAdminClient();

  return withListingLock(cleanId, async () => {
    const listing = await getOwnedListing(cleanId, userId, pb);

    let targetImage;
    try {
      targetImage = await pb.collection('listing_images').getOne(cleanImageId);
    } catch {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const imageListingId =
      typeof targetImage.listing === 'object' && targetImage.listing ? targetImage.listing.id : targetImage.listing;

    if (imageListingId !== cleanId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const wasCover = Boolean(targetImage.is_cover);

    // Delete image record (cascade purges disk file and thumbnails)
    try {
      await pb.collection('listing_images').delete(cleanImageId);
    } catch (pbErr) {
      const safeErr = new Error(pbErr?.message || 'Failed to delete image');
      safeErr.status = pbErr?.status || 500;
      throw safeErr;
    }

    // If deleted image was the cover, promote the remaining image with lowest order
    if (wasCover) {
      const remaining = await pb.collection('listing_images').getFullList({
        filter: pb.filter('listing = {:listing}', { listing: cleanId }),
        sort: 'order,created',
      });

      if (remaining.length > 0) {
        await pb.collection('listing_images').update(remaining[0].id, { is_cover: true });
      }
    }

    // Apply D-002 status transition after successful deletion
    await applyImageStatusTransition(listing, cleanId, pb);

    return { success: true, message: 'Image deleted successfully' };
  });
}

/**
 * Designates a specific image as the cover image for the listing (Phase 6, Task 6.3).
 * Clears cover designation on all other images of this listing.
 * Reverts 'approved' listings to 'pending' upon successful cover change (D-002).
 *
 * @param {string} listingId
 * @param {string} imageId
 * @param {string} userId
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function setCoverListingImage(listingId, imageId, userId) {
  const cleanId = (listingId || '').trim();
  const cleanImageId = (imageId || '').trim();

  if (!cleanImageId || !/^[a-zA-Z0-9]{15}$/.test(cleanImageId)) {
    const err = new Error('Image not found');
    err.status = 404;
    throw err;
  }

  const pb = await getAdminClient();

  return withListingLock(cleanId, async () => {
    const listing = await getOwnedListing(cleanId, userId, pb);

    let targetImage;
    try {
      targetImage = await pb.collection('listing_images').getOne(cleanImageId);
    } catch {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const imageListingId =
      typeof targetImage.listing === 'object' && targetImage.listing ? targetImage.listing.id : targetImage.listing;

    if (imageListingId !== cleanId) {
      const err = new Error('Image not found');
      err.status = 404;
      throw err;
    }

    const allImages = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:listing}', { listing: cleanId }),
      sort: 'order,created',
    });

    for (const img of allImages) {
      if (img.id === cleanImageId && !img.is_cover) {
        await pb.collection('listing_images').update(img.id, { is_cover: true });
      } else if (img.id !== cleanImageId && img.is_cover) {
        await pb.collection('listing_images').update(img.id, { is_cover: false });
      }
    }

    // Apply D-002 status transition after successful cover update
    await applyImageStatusTransition(listing, cleanId, pb);

    const updatedImages = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:listing}', { listing: cleanId }),
      sort: '-is_cover,order,created',
    });

    return { images: updatedImages.map((img) => formatImageRecord(img, pb)) };
  });
}

/**
 * Reorders all images for a listing using deterministic zero-based order (Phase 6, Task 6.3).
 *
 * Requirements:
 * - Submitted order array must contain all image IDs belonging to this listing.
 * - Rejects empty arrays, duplicates, missing IDs, or foreign IDs with HTTP 400.
 * - Reverts 'approved' listings to 'pending' upon successful reorder (D-002).
 *
 * @param {string} listingId
 * @param {string} userId
 * @param {Array<string>} orderedIds
 * @returns {Promise<{images: Array<Object>}>}
 */
export async function reorderListingImages(listingId, userId, orderedIds) {
  if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    const err = new Error('Order array cannot be empty');
    err.status = 400;
    throw err;
  }

  // Check for duplicate IDs
  if (new Set(orderedIds).size !== orderedIds.length) {
    const err = new Error('Duplicate image IDs in order array');
    err.status = 400;
    throw err;
  }

  const cleanId = (listingId || '').trim();
  const pb = await getAdminClient();

  return withListingLock(cleanId, async () => {
    const listing = await getOwnedListing(cleanId, userId, pb);

    const currentImages = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:listing}', { listing: cleanId }),
    });

    if (orderedIds.length !== currentImages.length) {
      const err = new Error('Order array must include all listing images');
      err.status = 400;
      throw err;
    }

    const currentIds = new Set(currentImages.map((img) => img.id));
    for (const id of orderedIds) {
      if (!currentIds.has(id)) {
        const err = new Error('Order array contains invalid or foreign image IDs');
        err.status = 400;
        throw err;
      }
    }

    // Update each record with its zero-based index
    for (let i = 0; i < orderedIds.length; i++) {
      await pb.collection('listing_images').update(orderedIds[i], { order: i });
    }

    // Apply D-002 status transition after successful reorder
    await applyImageStatusTransition(listing, cleanId, pb);

    const updatedImages = await pb.collection('listing_images').getFullList({
      filter: pb.filter('listing = {:listing}', { listing: cleanId }),
      sort: '-is_cover,order,created',
    });

    return { images: updatedImages.map((img) => formatImageRecord(img, pb)) };
  });
}




