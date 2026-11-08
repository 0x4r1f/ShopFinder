import { getAdminClient } from '../config/pocketbase.js';
import { sanitizeUser } from '../utils/apiResponse.js';

/**
 * ShopFinder — User Service Layer (Task 3.6)
 *
 * Handles retrieving and updating the authenticated user's own profile.
 *
 * ARCHITECTURAL SECURITY RULES:
 * 1. Always receives verified userId from req.user.id (never client-supplied ID).
 * 2. Uses the server-side Admin SDK client to access the locked users collection.
 * 3. Never accepts or updates prohibited/privileged fields (role, is_active, id, phone, password).
 * 4. Always returns sanitized user profiles via sanitizeUser() explicit allowlist.
 * 5. Masks raw PocketBase errors and handles 404 (user not found) safely.
 */

/**
 * Retrieves the current authenticated user's profile from PocketBase.
 *
 * @param {string} userId - Verified user ID from req.user.id
 * @returns {Promise<Object>} Sanitized user profile
 */
export async function getProfile(userId) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Invalid user identifier');
    err.status = 400;
    throw err;
  }

  const adminPb = await getAdminClient();

  let record;
  try {
    record = await adminPb.collection('users').getOne(userId);
  } catch (pbErr) {
    if (pbErr?.status === 404) {
      const notFoundErr = new Error('User not found');
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    const safeErr = new Error('Failed to retrieve user profile');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const sanitized = sanitizeUser(record);
  if (!sanitized) {
    const err = new Error('User profile unavailable');
    err.status = 404;
    throw err;
  }

  return sanitized;
}

/**
 * Updates permitted profile fields for the authenticated user.
 * Supports updating name and avatar (via filename/null or uploaded avatar file).
 *
 * @param {string} userId - Verified user ID from req.user.id
 * @param {Object} updateData - Validated permitted update payload
 * @param {string} [updateData.name]
 * @param {string|null} [updateData.avatar]
 * @param {Express.Multer.File} [avatarFile] - Optional avatar file from multipart upload
 * @returns {Promise<Object>} Updated sanitized user profile
 */
export async function updateProfile(userId, updateData = {}, avatarFile = null) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Invalid user identifier');
    err.status = 400;
    throw err;
  }

  // Explicit allowlist filtering: only permitted fields are forwarded to PocketBase
  const payload = {};
  if (updateData.name !== undefined) {
    payload.name = updateData.name;
  }
  if (updateData.avatar !== undefined) {
    payload.avatar = updateData.avatar;
  }

  const hasAvatarFile = Boolean(avatarFile && avatarFile.buffer && avatarFile.buffer.length > 0);

  // If payload is empty and no avatar file provided, return current profile safely
  if (Object.keys(payload).length === 0 && !hasAvatarFile) {
    return getProfile(userId);
  }

  const adminPb = await getAdminClient();

  let updatedRecord;
  try {
    if (hasAvatarFile) {
      const formData = new FormData();
      if (payload.name !== undefined) {
        formData.append('name', payload.name);
      }
      formData.append(
        'avatar',
        new Blob([avatarFile.buffer], { type: avatarFile.mimetype }),
        avatarFile.originalname || `avatar_${userId}_${Date.now()}.png`
      );
      updatedRecord = await adminPb.collection('users').update(userId, formData);
    } else {
      updatedRecord = await adminPb.collection('users').update(userId, payload);
    }
  } catch (pbErr) {
    if (pbErr?.status === 404) {
      const notFoundErr = new Error('User not found');
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    const safeErr = new Error('Failed to update user profile');
    safeErr.status = pbErr?.status || 500;
    throw safeErr;
  }

  const sanitized = sanitizeUser(updatedRecord);
  if (!sanitized) {
    const err = new Error('Updated profile unavailable');
    err.status = 500;
    throw err;
  }

  return sanitized;
}

