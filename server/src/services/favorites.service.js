import { getAdminClient } from '../config/pocketbase.js';
import { sanitizePublicListing } from './listing.service.js';

/**
 * ShopFinder — Customer Favorites / Saved Listings Service (Phase 8, Task 8.1)
 *
 * Implements business logic for bookmarking, removing, and retrieving customer favorites:
 * - Enforces customer ownership and isolation
 * - Verifies listing existence and strict 'approved' status
 * - Enforces duplicate bookmark prevention and idempotent operations (FR-053)
 * - Guarantees D-014 privacy policy (owner contact numbers never leaked)
 * - Provides server-side pagination, allowlist sorting, and safe sanitization
 */

/**
 * Populates missing cover images for a list of listings using secondary lookup.
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
      requestKey: null,
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
    // Non-fatal: listings are served safely even if secondary image fetch fails
  }
}

/**
 * Saves a commercial listing to the customer's favorites (POST /api/v1/favorites/:listingId).
 *
 * Requirements:
 * - Listing must exist (HTTP 404 if missing)
 * - Listing status must be 'approved' (HTTP 400 if pending, rejected, or archived)
 * - Idempotent: if already saved by this customer, returns existing record with alreadySaved = true
 * - Safe from unhandled SQLite unique-constraint errors
 * - Automatically timestamps saved_at via pb_hooks/saved_listings.pb.js
 *
 * @param {string} customerId - Authenticated customer's user ID (req.user.id)
 * @param {string} listingId - ID of commercial listing to save
 * @returns {Promise<{ favorite: Object, alreadySaved: boolean }>}
 */
export async function saveFavorite(customerId, listingId) {
  const pb = await getAdminClient();

  // 1. Verify listing existence
  let listing;
  try {
    listing = await pb.collection('listings').getOne(listingId, { requestKey: null });
  } catch (err) {
    if (err?.status === 404) {
      const notFound = new Error('Listing not found');
      notFound.status = 404;
      throw notFound;
    }
    const dbErr = new Error('Failed to verify listing');
    dbErr.status = err?.status || 500;
    throw dbErr;
  }

  // 2. Verify listing is approved
  if (listing.status !== 'approved') {
    const unapprovedErr = new Error('Only approved listings can be saved to favorites');
    unapprovedErr.status = 400;
    throw unapprovedErr;
  }

  // 3. Check for existing bookmark (Idempotency check)
  try {
    const existing = await pb.collection('saved_listings').getFirstListItem(
      pb.filter('customer = {:customerId} && listing = {:listingId}', { customerId, listingId }),
      { requestKey: null }
    );

    if (existing) {
      return {
        favorite: {
          id: existing.id,
          listing_id: existing.listing,
          saved_at: existing.saved_at,
          created: existing.created,
        },
        alreadySaved: true,
      };
    }
  } catch (err) {
    // getFirstListItem throws 404 if no record exists, which is expected
    if (err?.status !== 404) {
      const lookupErr = new Error('Failed to check existing favorite');
      lookupErr.status = err?.status || 500;
      throw lookupErr;
    }
  }

  // 4. Create new bookmark in saved_listings
  try {
    const record = await pb.collection('saved_listings').create(
      {
        customer: customerId,
        listing: listingId,
      },
      { requestKey: null }
    );

    return {
      favorite: {
        id: record.id,
        listing_id: record.listing,
        saved_at: record.saved_at,
        created: record.created,
      },
      alreadySaved: false,
    };
  } catch (createErr) {
    // Handle unique constraint race condition idempotently
    if (createErr?.status === 400 || createErr?.message?.includes('UNIQUE') || createErr?.data?.data?.listing) {
      try {
        const existing = await pb.collection('saved_listings').getFirstListItem(
          pb.filter('customer = {:customerId} && listing = {:listingId}', { customerId, listingId }),
          { requestKey: null }
        );
        if (existing) {
          return {
            favorite: {
              id: existing.id,
              listing_id: existing.listing,
              saved_at: existing.saved_at,
              created: existing.created,
            },
            alreadySaved: true,
          };
        }
      } catch {}
    }

    const safeErr = new Error('Failed to save listing to favorites');
    safeErr.status = createErr?.status || 500;
    throw safeErr;
  }
}

/**
 * Removes a saved listing from the customer's favorites (DELETE /api/v1/favorites/:listingId).
 *
 * Requirements:
 * - Matches strictly customer = req.user.id AND listing = listingId
 * - Never touches another customer's bookmark
 * - Idempotent: returns success even if record does not exist or was already removed
 *
 * @param {string} customerId - Authenticated customer's user ID (req.user.id)
 * @param {string} listingId - ID of commercial listing to remove
 * @returns {Promise<{ removed: boolean }>}
 */
export async function removeFavorite(customerId, listingId) {
  const pb = await getAdminClient();

  let existing = null;
  try {
    existing = await pb.collection('saved_listings').getFirstListItem(
      pb.filter('customer = {:customerId} && listing = {:listingId}', { customerId, listingId }),
      { requestKey: null }
    );
  } catch (err) {
    if (err?.status !== 404) {
      const lookupErr = new Error('Failed to lookup saved listing');
      lookupErr.status = err?.status || 500;
      throw lookupErr;
    }
  }

  // Idempotent: If no record found, return removed = false cleanly
  if (!existing) {
    return { removed: false };
  }

  try {
    await pb.collection('saved_listings').delete(existing.id, { requestKey: null });
    return { removed: true };
  } catch (delErr) {
    const safeErr = new Error('Failed to remove saved listing');
    safeErr.status = delErr?.status || 500;
    throw safeErr;
  }
}

/**
 * Retrieves paginated saved listings for the authenticated customer (GET /api/v1/favorites).
 *
 * Requirements:
 * - Customer role only, strictly filtered to customer = req.user.id
 * - Excludes non-approved listings defensively
 * - Safely resolves listing details and cover image
 * - Strictly excludes sensitive owner contacts, credentials, and internal fields
 *
 * @param {string} customerId - Authenticated customer's user ID (req.user.id)
 * @param {Object} [options={}]
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.perPage=10] - Number of items per page (1-100)
 * @param {string} [options.sort='-saved_at'] - Sort order
 * @returns {Promise<{ favorites: Array<Object>, pagination: Object }>}
 */
export async function getFavorites(customerId, { page = 1, perPage = 10, sort = '-saved_at' } = {}) {
  const pb = await getAdminClient();

  let result;
  try {
    result = await pb.collection('saved_listings').getList(page, perPage, {
      filter: pb.filter('customer = {:customerId} && listing.status = "approved"', { customerId }),
      sort,
      expand: 'listing,listing.owner',
      requestKey: null,
    });
  } catch (err) {
    const safeErr = new Error('Failed to retrieve saved listings');
    safeErr.status = err?.status || 500;
    throw safeErr;
  }

  // Sanitize each listing and populate cover images
  const sanitizedListings = [];
  const validFavorites = [];

  for (const item of result.items) {
    const rawListing = item.expand?.listing;

    // Defensively skip missing or unapproved listings
    if (!rawListing || rawListing.status !== 'approved') {
      continue;
    }

    const sanitizedListing = sanitizePublicListing(rawListing, pb);
    if (!sanitizedListing) {
      continue;
    }

    sanitizedListings.push(sanitizedListing);
    validFavorites.push({
      id: item.id,
      listing_id: item.listing,
      saved_at: item.saved_at,
      created: item.created,
      listing: sanitizedListing,
    });
  }

  // Secondary cover image lookup if needed
  await populateMissingCoverImages(sanitizedListings, pb);

  return {
    favorites: validFavorites,
    pagination: {
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    },
  };
}

