import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Admin Service Layer (Phase 7, Task 7.1)
 *
 * Provides backend database operations for platform administration and analytics.
 * All operations execute via the Superuser Admin SDK singleton.
 *
 * CRITICAL SECURITY & DATA CONSTRAINTS:
 * 1. Admin operations are restricted strictly to authenticated administrators.
 * 2. Never expose owner phone numbers, credentials, tokens, or internal PocketBase IDs.
 * 3. Never return mock or hardcoded statistics; calculate all counts from actual database records.
 * 4. Use efficient count queries (getList with limit 1) avoiding full record fetching for metrics.
 */

/**
 * Retrieves platform-wide statistics and recent platform activity.
 *
 * @returns {Promise<Object>} Platform statistics and recent activity
 */
export async function getAdminStats() {
  const pb = await getAdminClient();

  // 1. Efficient count queries using PocketBase native pagination totalItems
  const [
    totalListingsResult,
    pendingListingsResult,
    totalUsersResult,
    customersResult,
    ownersResult,
    adminsResult,
  ] = await Promise.all([
    // Total listings across all statuses
    pb.collection('listings').getList(1, 1, {
      requestKey: null,
    }),
    // Pending listings awaiting admin review
    pb.collection('listings').getList(1, 1, {
      filter: 'status = "pending"',
      requestKey: null,
    }),
    // Total registered platform users
    pb.collection('users').getList(1, 1, {
      requestKey: null,
    }),
    // Customers count
    pb.collection('users').getList(1, 1, {
      filter: 'role = "customer"',
      requestKey: null,
    }),
    // Owners count
    pb.collection('users').getList(1, 1, {
      filter: 'role = "owner"',
      requestKey: null,
    }),
    // Admins count
    pb.collection('users').getList(1, 1, {
      filter: 'role = "admin"',
      requestKey: null,
    }),
  ]);

  // 2. Query recent platform activity (latest 5 listings and latest 5 user registrations)
  const [recentListingsResult, recentUsersResult] = await Promise.all([
    pb.collection('listings').getList(1, 5, {
      sort: '-created',
      fields: 'id,title,category,listing_type,status,created',
      requestKey: null,
    }),
    pb.collection('users').getList(1, 5, {
      sort: '-created',
      fields: 'id,name,role,created',
      requestKey: null,
    }),
  ]);

  // 3. Format and sanitize recent activities
  const listingActivities = (recentListingsResult?.items || []).map((item) => ({
    id: `act_lst_${item.id}`,
    type: 'listing_submission',
    recordId: item.id,
    title: item.title || 'Untitled Property',
    subtitle: `${item.category || 'Commercial'} • ${item.listing_type || 'rent'}`,
    status: item.status || 'pending',
    timestamp: item.created,
  }));

  const userActivities = (recentUsersResult?.items || []).map((item) => ({
    id: `act_usr_${item.id}`,
    type: 'user_registration',
    recordId: item.id,
    title: item.name || 'New User',
    subtitle: `Registered as ${item.role || 'customer'}`,
    status: item.role || 'customer',
    timestamp: item.created,
  }));

  // Combine and sort chronologically (newest first), take top 10
  const recentActivity = [...listingActivities, ...userActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return {
    totalListings: totalListingsResult?.totalItems || 0,
    pendingListings: pendingListingsResult?.totalItems || 0,
    totalUsers: totalUsersResult?.totalItems || 0,
    usersByRole: {
      customers: customersResult?.totalItems || 0,
      owners: ownersResult?.totalItems || 0,
      admins: adminsResult?.totalItems || 0,
    },
    recentActivity,
  };
}

/**
 * Sanitizes a raw PocketBase listing record for the administrative review queue.
 *
 * Exposes core commercial listing attributes along with safe owner metadata (id, name, email)
 * and cover image details. Strictly excludes owner phone numbers, owner_contacts, passwords,
 * tokens, superuser credentials, rejection notes, and internal PocketBase attributes.
 *
 * @param {Object} item - Raw PocketBase listing record
 * @param {import('pocketbase').default} pb - PocketBase client instance
 * @returns {Object|null} Sanitized administrative pending listing
 */
export function sanitizeAdminPendingListing(item, pb) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // 1. Resolve cover image from expanded listing_images relation
  let coverImage = null;
  const rawImages = item.expand?.listing_images_via_listing;
  const images = Array.isArray(rawImages) ? rawImages : rawImages ? [rawImages] : [];
  const coverRecord = images.find((img) => img.is_cover) || images[0] || null;

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

  // 2. Resolve owner information (strict allowlist: id, name, email)
  let owner = null;
  const rawOwner = Array.isArray(item.expand?.owner) ? item.expand.owner[0] : item.expand?.owner;
  if (rawOwner && typeof rawOwner === 'object' && rawOwner.id && typeof rawOwner.id === 'string') {
    owner = {
      id: rawOwner.id,
      name: typeof rawOwner.name === 'string' ? rawOwner.name : '',
      email: typeof rawOwner.email === 'string' ? rawOwner.email : '',
    };
  } else if (item.owner) {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;
    if (ownerId && typeof ownerId === 'string') {
      owner = {
        id: ownerId,
        name: '',
        email: '',
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
    status: item.status || 'pending',
    is_featured: Boolean(item.is_featured),
    created: item.created || null,
    updated: item.updated || null,
    cover_image: coverImage,
    owner,
  };
}

/**
 * Secondary helper to populate missing cover images for pending listings.
 *
 * @param {Array<Object>} listings
 * @param {import('pocketbase').default} pb
 */
async function populateMissingCoverImages(listings, pb) {
  const missingCoverListings = listings.filter((l) => l && l.cover_image === null);
  if (missingCoverListings.length === 0) return;

  try {
    const filterExpr = missingCoverListings.map((l) => `listing = "${l.id}"`).join(' || ');
    const imageRecords = await pb.collection('listing_images').getFullList({
      filter: filterExpr,
      sort: '-is_cover,order,created',
      requestKey: null,
    });

    const imagesByListing = {};
    for (const img of imageRecords) {
      if (!imagesByListing[img.listing]) {
        imagesByListing[img.listing] = img;
      }
    }

    for (const listing of listings) {
      if (listing && !listing.cover_image && imagesByListing[listing.id]) {
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
    // Non-fatal fallback: listings are safely served without cover images
  }
}

/**
 * Secondary helper to populate missing owner name/email if relation expand was not populated.
 *
 * @param {Array<Object>} listings
 * @param {import('pocketbase').default} pb
 */
async function populateMissingOwnerDetails(listings, pb) {
  const incompleteOwnerListings = listings.filter(
    (l) => l && l.owner && l.owner.id && !l.owner.name && !l.owner.email
  );
  if (incompleteOwnerListings.length === 0) return;

  try {
    const uniqueOwnerIds = [...new Set(incompleteOwnerListings.map((l) => l.owner.id))];
    const filterExpr = uniqueOwnerIds.map((id) => `id = "${id}"`).join(' || ');
    const userRecords = await pb.collection('users').getFullList({
      filter: filterExpr,
      requestKey: null,
    });

    const usersById = {};
    for (const u of userRecords) {
      usersById[u.id] = u;
    }

    for (const listing of incompleteOwnerListings) {
      const u = usersById[listing.owner.id];
      if (u) {
        listing.owner.name = u.name || '';
        listing.owner.email = u.email || '';
      }
    }
  } catch {
    // Non-fatal fallback: listings safely keep available owner.id
  }
}

/**
 * Retrieves paginated pending commercial listings for administrative moderation (Phase 7, Task 7.2).
 *
 * Only returns listings whose status is strictly 'pending'.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=10]
 * @param {string} [options.sort='-created']
 * @returns {Promise<{ listings: Array<Object>, pagination: Object }>}
 */
export async function getPendingListings(options = {}) {
  const { page = 1, perPage = 10, sort = '-created' } = options;
  const pb = await getAdminClient();

  let result;
  try {
    result = await pb.collection('listings').getList(page, perPage, {
      filter: pb.filter('status = {:status}', { status: 'pending' }),
      sort,
      expand: 'owner,listing_images_via_listing',
      requestKey: null,
    });
  } catch (pbErr) {
    const safeErr = new Error('Failed to retrieve pending listings');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const listings = (result?.items || []).map((item) => sanitizeAdminPendingListing(item, pb));

  // Populate any missing cover images or owner details via safe secondary lookups
  await populateMissingCoverImages(listings, pb);
  await populateMissingOwnerDetails(listings, pb);

  const pagination = {
    page: result?.page || page,
    perPage: result?.perPage || perPage,
    totalItems: result?.totalItems || 0,
    totalPages: result?.totalPages || 0,
  };

  return { listings, pagination };
}

/**
 * Sanitizes a listing record for administrative moderation actions (Phase 7, Task 7.3).
 *
 * Exposes core commercial listing attributes, safe owner metadata (id, name, email),
 * cover image details, and the rejection note (if rejected). Strictly excludes owner phone numbers,
 * owner_contacts, passwords, tokens, superuser credentials, and internal PocketBase attributes.
 *
 * @param {Object} item - Raw PocketBase listing record
 * @param {import('pocketbase').default} pb - PocketBase client instance
 * @returns {Object|null} Sanitized administrative listing
 */
export function sanitizeAdminListing(item, pb) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const base = sanitizeAdminPendingListing(item, pb);
  if (!base) return null;

  return {
    ...base,
    rejection_note: item.rejection_note || null,
  };
}

/**
 * Helper to fetch a listing by ID via Superuser Admin SDK with safe 404 handling.
 *
 * @param {string} id
 * @param {import('pocketbase').default} pb
 * @returns {Promise<Object>}
 */
async function fetchListingById(id, pb) {
  if (!id || typeof id !== 'string') {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  try {
    return await pb.collection('listings').getOne(id, {
      expand: 'owner,listing_images_via_listing',
      requestKey: null,
    });
  } catch (err) {
    if (
      err.status === 404 ||
      err.message?.includes('not found') ||
      err.message?.includes('Missing required record id')
    ) {
      const notFound = new Error('Listing not found');
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

/**
 * Approves a commercial listing (Phase 7, Task 7.3).
 *
 * Requirements:
 * - Verifies listing exists (HTTP 404 if missing)
 * - Anti-self-approval: Admin cannot approve their own listing (HTTP 403)
 * - Sets status = 'approved'
 * - Clears rejection_note = ''
 * - Preserves all other listing attributes
 * - Returns sanitized listing object
 *
 * @param {string} id - Listing record ID
 * @param {string} adminUserId - Authenticated admin user ID (req.user.id)
 * @returns {Promise<Object>} Sanitized approved listing
 */
export async function approveListing(id, adminUserId) {
  const pb = await getAdminClient();
  const existing = await fetchListingById(id, pb);

  // Anti-self-approval check
  const ownerId =
    typeof existing.owner === 'object' && existing.owner !== null
      ? existing.owner.id
      : String(existing.owner || '');

  if (ownerId && ownerId === adminUserId) {
    const err = new Error('Administrators cannot approve their own listings');
    err.status = 403;
    throw err;
  }

  let updated;
  try {
    updated = await pb.collection('listings').update(
      id,
      {
        status: 'approved',
        rejection_note: '',
      },
      {
        expand: 'owner,listing_images_via_listing',
        requestKey: null,
      }
    );
  } catch (pbErr) {
    const safeErr = new Error('Failed to approve listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const sanitized = sanitizeAdminListing(updated, pb);
  await populateMissingCoverImages([sanitized], pb);
  await populateMissingOwnerDetails([sanitized], pb);

  return sanitized;
}

/**
 * Rejects a commercial property listing with a mandatory reason note (Phase 7, Task 7.3).
 *
 * Requirements:
 * - Verifies listing exists (HTTP 404 if missing)
 * - Anti-self-rejection: Admin cannot reject their own listing (HTTP 403)
 * - Sets status = 'rejected'
 * - Persists trimmed rejection_note
 * - Preserves all other listing attributes
 * - Returns sanitized listing object with saved rejection note
 *
 * @param {string} id - Listing record ID
 * @param {string} adminUserId - Authenticated admin user ID (req.user.id)
 * @param {string} rejectionNote - Validated 1-1000 char rejection reason
 * @returns {Promise<Object>} Sanitized rejected listing
 */
export async function rejectListing(id, adminUserId, rejectionNote) {
  const pb = await getAdminClient();
  const existing = await fetchListingById(id, pb);

  // Anti-self-rejection check
  const ownerId =
    typeof existing.owner === 'object' && existing.owner !== null
      ? existing.owner.id
      : String(existing.owner || '');

  if (ownerId && ownerId === adminUserId) {
    const err = new Error('Administrators cannot reject their own listings');
    err.status = 403;
    throw err;
  }

  let updated;
  try {
    updated = await pb.collection('listings').update(
      id,
      {
        status: 'rejected',
        rejection_note: rejectionNote,
      },
      {
        expand: 'owner,listing_images_via_listing',
        requestKey: null,
      }
    );
  } catch (pbErr) {
    const safeErr = new Error('Failed to reject listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const sanitized = sanitizeAdminListing(updated, pb);
  await populateMissingCoverImages([sanitized], pb);
  await populateMissingOwnerDetails([sanitized], pb);

  return sanitized;
}

/**
 * Archives a commercial property listing (Phase 7, Task 7.3).
 *
 * Requirements:
 * - Verifies listing exists (HTTP 404 if missing)
 * - Sets status = 'archived'
 * - Preserves all other listing attributes
 * - Returns sanitized listing object
 *
 * @param {string} id - Listing record ID
 * @param {string} adminUserId - Authenticated admin user ID (req.user.id)
 * @returns {Promise<Object>} Sanitized archived listing
 */
export async function archiveListing(id, adminUserId) {
  const pb = await getAdminClient();
  const existing = await fetchListingById(id, pb);

  // Anti-self-archive check
  const ownerId =
    typeof existing.owner === 'object' && existing.owner !== null
      ? existing.owner.id
      : String(existing.owner || '');

  if (ownerId && ownerId === adminUserId) {
    const err = new Error('Administrators cannot archive their own listings');
    err.status = 403;
    throw err;
  }

  let updated;
  try {
    updated = await pb.collection('listings').update(
      id,
      {
        status: 'archived',
      },
      {
        expand: 'owner,listing_images_via_listing',
        requestKey: null,
      }
    );
  } catch (pbErr) {
    const safeErr = new Error('Failed to archive listing');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const sanitized = sanitizeAdminListing(updated, pb);
  await populateMissingCoverImages([sanitized], pb);
  await populateMissingOwnerDetails([sanitized], pb);

  return sanitized;
}

/**
 * Sanitizes a user record for administrative management (Phase 7, Task 7.5).
 *
 * Strictly exposes safe UI fields: id, name, email, role, is_active, avatar, avatar_url, created.
 * Strictly excludes password, password hash, tokenKey, auth tokens, phone numbers,
 * owner_contacts relation, and internal PB attributes.
 *
 * @param {Object} item - Raw PocketBase user record
 * @param {import('pocketbase').default} pb - PocketBase client instance
 * @returns {Object|null} Sanitized user record
 */
export function sanitizeAdminUser(item, pb) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const baseUrl = pb?.baseUrl || '';
  const avatarUrl = item.avatar
    ? `${baseUrl}/api/files/_pb_users_auth_/${item.id}/${item.avatar}`
    : null;

  return {
    id: item.id,
    name: typeof item.name === 'string' ? item.name : '',
    email: typeof item.email === 'string' ? item.email : '',
    role: typeof item.role === 'string' ? item.role : 'customer',
    is_active: item.is_active !== undefined && item.is_active !== null ? Boolean(item.is_active) : true,
    avatar: item.avatar || null,
    avatar_url: avatarUrl,
    created: item.created || null,
  };
}

/**
 * Retrieves paginated users for administrative user management (Phase 7, Task 7.5).
 * Supports search (name and email), role filter, and sorting.
 *
 * @param {Object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=10]
 * @param {string} [options.sort='-created']
 * @param {string} [options.role]
 * @param {string} [options.search]
 * @returns {Promise<{ users: Array<Object>, pagination: Object }>}
 */
export async function getUsers(options = {}) {
  const { page = 1, perPage = 10, sort = '-created', role, search } = options;
  const pb = await getAdminClient();

  const filterParts = [];
  const filterParams = {};

  if (role) {
    filterParts.push('role = {:role}');
    filterParams.role = role;
  }

  if (search) {
    filterParts.push('(name ~ {:search} || email ~ {:search})');
    filterParams.search = search;
  }

  const filter = filterParts.length > 0 ? pb.filter(filterParts.join(' && '), filterParams) : '';

  let result;
  try {
    result = await pb.collection('users').getList(page, perPage, {
      filter,
      sort,
      requestKey: null,
    });
  } catch (pbErr) {
    const safeErr = new Error('Failed to retrieve users');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const users = (result?.items || []).map((item) => sanitizeAdminUser(item, pb));

  const pagination = {
    page: result?.page || page,
    perPage: result?.perPage || perPage,
    totalItems: result?.totalItems || 0,
    totalPages: result?.totalPages || 0,
  };

  return { users, pagination };
}

/**
 * Updates a user's account activation status (Phase 7, Task 7.5).
 *
 * Enforces anti-self-deactivation: an admin cannot set is_active = false on their own account.
 *
 * @param {string} id - Target user ID
 * @param {string} adminUserId - Authenticated admin user ID (req.user.id)
 * @param {boolean} isActive - New status
 * @returns {Promise<Object>} Sanitized updated user record
 */
export async function updateUserStatus(id, adminUserId, isActive) {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9]{15}$/.test(id.trim())) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const cleanId = id.trim();

  // Anti-self-deactivation guard
  if (cleanId === adminUserId && isActive === false) {
    const err = new Error('Administrators cannot deactivate their own account');
    err.status = 403;
    throw err;
  }

  const pb = await getAdminClient();

  // Verify target user exists
  try {
    await pb.collection('users').getOne(cleanId, { requestKey: null });
  } catch (pbErr) {
    if (pbErr?.status === 404 || pbErr?.status === 400) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const safeErr = new Error('Failed to retrieve user');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  // Update status in PocketBase
  let updated;
  try {
    updated = await pb.collection('users').update(
      cleanId,
      { is_active: isActive },
      { requestKey: null }
    );
  } catch (pbErr) {
    const safeErr = new Error('Failed to update user status');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  return sanitizeAdminUser(updated, pb);
}



