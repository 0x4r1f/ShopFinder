import { getAdminClient } from '../config/pocketbase.js';
import { env } from '../config/env.js';

/**
 * ShopFinder — Owner Profile Service Layer (Phase 6, Task 6.7 Corrective Task)
 *
 * Implements owner business profile retrieval and updates with D-014 privacy separation.
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Owner identity is derived exclusively from verified req.user.id.
 * 2. Contact phone numbers are stored strictly in the locked `owner_contacts` collection.
 * 3. Generic users collection only stores name and avatar.
 * 4. Updates execute atomically inside a single SQLite transaction ($app.runInTransaction)
 *    via the private custom PocketBase route (/api/custom/owner/profile-upsert).
 * 5. Multi-process concurrency and complete ACID rollback are guaranteed at the database engine level.
 * 6. Sanitizes output ensuring no passwords, token keys, or internal PocketBase metadata are leaked.
 */

/**
 * Retrieves the authenticated owner's business profile and private contact phone.
 *
 * @param {string} ownerId - Verified user ID from req.user.id
 * @returns {Promise<Object>} Sanitized owner profile
 */
export async function getOwnerProfile(ownerId) {
  if (!ownerId || typeof ownerId !== 'string') {
    const err = new Error('Invalid owner identifier');
    err.status = 400;
    throw err;
  }

  const cleanId = ownerId.trim();
  const pb = await getAdminClient();

  // 1. Fetch owner user record
  let userRecord;
  try {
    userRecord = await pb.collection('users').getOne(cleanId);
  } catch (pbErr) {
    if (pbErr?.status === 404) {
      const err = new Error('Owner account not found');
      err.status = 404;
      throw err;
    }
    const err = new Error('Failed to retrieve owner account');
    err.status = pbErr?.status || 500;
    throw err;
  }

  // 2. Fetch private phone from owner_contacts
  let contactRecord = null;
  try {
    contactRecord = await pb.collection('owner_contacts').getFirstListItem(
      pb.filter('owner = {:owner}', { owner: cleanId })
    );
  } catch (pbErr) {
    // 404 indicates owner has not configured a contact record yet
    if (pbErr?.status !== 404) {
      const err = new Error('Failed to retrieve owner contact information');
      err.status = pbErr?.status || 500;
      throw err;
    }
  }

  // 3. Resolve avatar URL
  const baseUrl = pb.baseUrl || env.POCKETBASE_URL || '';
  const avatarUrl = userRecord.avatar
    ? `${baseUrl}/api/files/_pb_users_auth_/${userRecord.id}/${userRecord.avatar}`
    : null;

  return {
    id: userRecord.id,
    name: userRecord.name || '',
    email: userRecord.email || '',
    role: userRecord.role || 'owner',
    avatar: userRecord.avatar || null,
    avatar_url: avatarUrl,
    phone: contactRecord?.phone || null,
    created: userRecord.created || null,
    updated: userRecord.updated || null,
  };
}

/**
 * Updates the authenticated owner's business profile and contact phone atomically
 * using the private PocketBase transaction custom route ($app.runInTransaction).
 *
 * @param {string} ownerId - Verified user ID from req.user.id
 * @param {Object} updateData - Validated payload { name?: string, phone?: string }
 * @param {Express.Multer.File} [avatarFile] - Optional avatar image file
 * @param {Object} [options] - Optional settings (e.g. simulateFailure for testing)
 * @returns {Promise<Object>} Updated sanitized owner profile
 */
export async function updateOwnerProfile(ownerId, updateData = {}, avatarFile = null, options = {}) {
  if (!ownerId || typeof ownerId !== 'string') {
    const err = new Error('Invalid owner identifier');
    err.status = 400;
    throw err;
  }

  const cleanId = ownerId.trim();
  const pb = await getAdminClient();

  const hasName = updateData.name !== undefined && String(updateData.name).trim() !== '';
  const hasPhone = updateData.phone !== undefined && String(updateData.phone).trim() !== '';
  const hasAvatar = Boolean(avatarFile && avatarFile.buffer && avatarFile.buffer.length > 0);

  if (!hasName && !hasPhone && !hasAvatar) {
    const err = new Error('At least one field must be provided for update');
    err.status = 400;
    throw err;
  }

  let hookResponse;
  try {
    if (hasAvatar) {
      const formData = new FormData();
      formData.append('ownerId', cleanId);
      if (hasName) {
        formData.append('name', updateData.name.trim());
      }
      if (hasPhone) {
        formData.append('phone', updateData.phone.trim());
      }
      formData.append(
        'avatar',
        new Blob([avatarFile.buffer], { type: avatarFile.mimetype }),
        avatarFile.originalname || `avatar_${cleanId}_${Date.now()}.png`
      );
      if (options.simulateFailure) {
        formData.append('simulateFailure', 'true');
      }

      hookResponse = await pb.send('/api/custom/owner/profile-upsert', {
        method: 'POST',
        body: formData,
      });
    } else {
      hookResponse = await pb.send('/api/custom/owner/profile-upsert', {
        method: 'POST',
        body: {
          ownerId: cleanId,
          ...(hasName ? { name: updateData.name.trim() } : {}),
          ...(hasPhone ? { phone: updateData.phone.trim() } : {}),
          ...(options.simulateFailure ? { simulateFailure: true } : {}),
        },
      });
    }
  } catch (pbErr) {
    const status = pbErr?.status || 500;
    let message = pbErr?.message || 'Failed to update owner profile details';
    if (status === 404) {
      message = 'Owner account not found';
    } else if (status === 400 && pbErr?.response?.message) {
      message = pbErr.response.message;
    }
    const err = new Error(message);
    err.status = status;
    throw err;
  }

  const record = hookResponse?.data || hookResponse;
  if (!record || !record.id) {
    return getOwnerProfile(cleanId);
  }

  const baseUrl = pb.baseUrl || env.POCKETBASE_URL || '';
  const avatarUrl = record.avatar
    ? `${baseUrl}/api/files/_pb_users_auth_/${record.id}/${record.avatar}`
    : null;

  return {
    id: record.id,
    name: record.name || '',
    email: record.email || '',
    role: record.role || 'owner',
    avatar: record.avatar || null,
    avatar_url: avatarUrl,
    phone: record.phone || null,
    created: record.created || null,
    updated: record.updated || null,
  };
}
