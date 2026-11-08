import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — In-App Notification Service (Phase 11, Task 11.7)
 *
 * Implements centralized in-app notification creation for listing moderation
 * and customer credit events:
 * 1. listing_approved: Notifies listing owner upon successful admin approval.
 * 2. listing_rejected: Notifies listing owner upon successful admin rejection.
 * 3. credit_low: Notifies customer when available balance drops to <= threshold (2 credits).
 *
 * ARCHITECTURAL INVARIANTS:
 * - Creates records via PocketBase Superuser Admin SDK singleton.
 * - Validates recipient user ID, supported notification types, and non-empty messages.
 * - Protects against notification spam / duplicate deliveries.
 * - Never leaks superuser credentials, tokens, or private owner phone numbers.
 * - Non-fatal: notification failures never fail or roll back primary business operations.
 */

export const SUPPORTED_NOTIFICATION_TYPES = Object.freeze([
  'listing_approved',
  'listing_rejected',
  'credit_low',
]);

/**
 * Approved threshold for customer credit-low alert.
 * Triggers when credits_remaining <= 2 after a legitimate credit deduction.
 */
export const DEFAULT_CREDIT_LOW_THRESHOLD = 2;

/**
 * Creates an in-app notification record in the PocketBase notifications collection.
 *
 * @param {Object} params
 * @param {string} params.userId - Recipient user ID (relation to users)
 * @param {string} params.type - One of 'listing_approved', 'listing_rejected', 'credit_low'
 * @param {string} params.message - Safe human-readable message text
 * @returns {Promise<{
 *   id: string,
 *   user: string,
 *   type: string,
 *   message: string,
 *   is_read: boolean,
 *   created: string
 * }>}
 */
export async function createNotification({ userId, type, message }) {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    const err = new Error('Recipient userId is required and must be a non-empty string');
    err.status = 400;
    throw err;
  }

  if (!type || typeof type !== 'string' || !SUPPORTED_NOTIFICATION_TYPES.includes(type.trim())) {
    const err = new Error(
      `Invalid notification type: '${type}'. Supported types: ${SUPPORTED_NOTIFICATION_TYPES.join(', ')}`
    );
    err.status = 400;
    throw err;
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    const err = new Error('Notification message is required and must be a non-empty string');
    err.status = 400;
    throw err;
  }

  const cleanUserId = userId.trim();
  const cleanType = type.trim();
  const cleanMessage = message.trim();

  const pb = await getAdminClient();

  // Validate recipient user existence in users collection
  try {
    await pb.collection('users').getOne(cleanUserId);
  } catch (userErr) {
    const err = new Error(`Recipient user not found: '${cleanUserId}'`);
    err.status = 404;
    throw err;
  }

  try {
    const record = await pb.collection('notifications').create({
      user: cleanUserId,
      type: cleanType,
      message: cleanMessage,
      is_read: false,
    });

    return {
      id: record.id,
      user: record.user,
      type: record.type,
      message: record.message,
      is_read: Boolean(record.is_read),
      created: record.created,
    };
  } catch (dbErr) {
    const safeErr = new Error(`Failed to create notification: ${dbErr.message}`);
    safeErr.status = dbErr.status || 500;
    throw safeErr;
  }
}

/**
 * Notifies a property owner that their commercial listing has been approved.
 * Includes anti-duplicate protection for identical unread approval alerts.
 *
 * @param {Object} listing - Listing record or object
 * @param {string} [ownerIdOverride] - Optional explicit owner ID
 * @returns {Promise<{ duplicate: boolean, skipped: boolean, notification?: Object }>}
 */
export async function notifyListingApproved(listing, ownerIdOverride) {
  if (!listing || typeof listing !== 'object') {
    throw new Error('Listing object is required to notify approval');
  }

  const ownerId =
    ownerIdOverride ||
    (typeof listing.owner === 'object' && listing.owner !== null ? listing.owner.id : listing.owner);

  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Listing owner ID is required to notify approval');
  }

  const title = listing.title || 'Commercial Property';
  const message = `Your listing "${title}" has been approved and is now live on ShopFinder.`;

  // Deduplication check: check if an unread approval notification already exists for this owner and listing
  const pb = await getAdminClient();
  try {
    const existing = await pb.collection('notifications').getList(1, 1, {
      filter: pb.filter('user = {:owner} && type = "listing_approved" && message ~ {:title} && is_read = false', {
        owner: ownerId,
        title: title,
      }),
      requestKey: null,
    });
    if (existing.totalItems > 0) {
      return { duplicate: true, skipped: true, notification: existing.items[0] };
    }
  } catch {
    // Non-fatal check error, proceed to create
  }

  const notif = await createNotification({
    userId: ownerId,
    type: 'listing_approved',
    message,
  });

  return { duplicate: false, skipped: false, notification: notif };
}

/**
 * Notifies a property owner that their commercial listing was rejected.
 * Includes safe rejection reason without leaking administrative internal details.
 *
 * @param {Object} listing - Listing record or object
 * @param {string} [ownerIdOverride] - Optional explicit owner ID
 * @param {string} [rejectionNote] - Admin-provided rejection note
 * @returns {Promise<{ duplicate: boolean, skipped: boolean, notification?: Object }>}
 */
export async function notifyListingRejected(listing, ownerIdOverride, rejectionNote) {
  if (!listing || typeof listing !== 'object') {
    throw new Error('Listing object is required to notify rejection');
  }

  const ownerId =
    ownerIdOverride ||
    (typeof listing.owner === 'object' && listing.owner !== null ? listing.owner.id : listing.owner);

  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('Listing owner ID is required to notify rejection');
  }

  const safeNote =
    rejectionNote && typeof rejectionNote === 'string' && rejectionNote.trim() !== ''
      ? rejectionNote.trim()
      : 'Does not meet our commercial listing guidelines.';

  const title = listing.title || 'Commercial Property';
  const message = `Your listing "${title}" was not approved. Reason: ${safeNote}`;

  // Deduplication check
  const pb = await getAdminClient();
  try {
    const existing = await pb.collection('notifications').getList(1, 1, {
      filter: pb.filter('user = {:owner} && type = "listing_rejected" && message ~ {:title} && is_read = false', {
        owner: ownerId,
        title: title,
      }),
      requestKey: null,
    });
    if (existing.totalItems > 0) {
      return { duplicate: true, skipped: true, notification: existing.items[0] };
    }
  } catch {
    // Non-fatal
  }

  const notif = await createNotification({
    userId: ownerId,
    type: 'listing_rejected',
    message,
  });

  return { duplicate: false, skipped: false, notification: notif };
}

/**
 * Notifies a customer when their available credit balance drops to or below the low threshold (<= 2).
 * Prevents notification spam if an unread low-credit notification already exists.
 *
 * @param {string} customerId - Authenticated customer ID
 * @param {number} creditsRemaining - Current remaining balance after deduction
 * @param {number} [threshold=DEFAULT_CREDIT_LOW_THRESHOLD] - Threshold limit (default: 2)
 * @returns {Promise<{ duplicate?: boolean, skipped: boolean, reason?: string, notification?: Object }>}
 */
export async function notifyCreditLow(customerId, creditsRemaining, threshold = DEFAULT_CREDIT_LOW_THRESHOLD) {
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    throw new Error('Customer ID is required to notify credit balance');
  }

  const numericRemaining = Number(creditsRemaining);
  if (!Number.isFinite(numericRemaining)) {
    throw new Error('creditsRemaining must be a valid number');
  }

  // Only trigger if creditsRemaining <= threshold
  if (numericRemaining > threshold) {
    return { skipped: true, reason: 'above_threshold', creditsRemaining: numericRemaining };
  }

  const pb = await getAdminClient();

  // Deduplication spam prevention: Do not spam notifications if an unread credit_low alert already exists
  try {
    const existing = await pb.collection('notifications').getList(1, 1, {
      filter: pb.filter('user = {:user} && type = "credit_low" && is_read = false', {
        user: customerId.trim(),
      }),
      requestKey: null,
    });
    if (existing.totalItems > 0) {
      return {
        duplicate: true,
        skipped: true,
        reason: 'unread_alert_exists',
        notification: existing.items[0],
      };
    }
  } catch {
    // Non-fatal
  }

  const plural = numericRemaining === 1 ? 'credit' : 'credits';
  const message = `Your credit balance is low (${numericRemaining} ${plural} remaining). Top up your credits to continue revealing commercial property owner contacts.`;

  const notif = await createNotification({
    userId: customerId.trim(),
    type: 'credit_low',
    message,
  });

  return { duplicate: false, skipped: false, notification: notif };
}

