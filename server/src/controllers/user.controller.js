import * as userService from '../services/user.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — User Profile Controller (Task 3.6)
 *
 * Implements GET /api/v1/users/me and PATCH /api/v1/users/me.
 * All operations derive user identity exclusively from req.user.id established by authenticate.
 */

/**
 * GET /api/v1/users/me
 * Retrieves current authenticated user's profile.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getProfile(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 'Authentication required', 401);
    }

    const user = await userService.getProfile(req.user.id);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/users/me
 * Updates permitted profile fields for the authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateProfile(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 'Authentication required', 401);
    }

    const user = await userService.updateProfile(req.user.id, req.body || {}, req.file);
    return sendSuccess(res, { user }, 200, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
}

