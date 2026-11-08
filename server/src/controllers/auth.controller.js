import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { setAuthCookie, clearAuthCookie } from '../config/cookie.js';

/**
 * ShopFinder — Authentication Controllers (Task 3.2 & Task 3.3)
 *
 * Implements HTTP request/response handling for registration, login, and logout.
 *
 * TOKEN & COOKIE POLICY (D-010):
 * - Auth tokens are stored and transmitted EXCLUSIVELY via server-set httpOnly cookies named 'pb_auth'.
 * - The response body contains strictly sanitized user profile data.
 * - The token is NEVER returned in the JSON response body or exposed to client JavaScript.
 * - Logout clears the 'pb_auth' cookie using matching security attributes.
 */

/**
 * Handles user registration (POST /api/v1/auth/register).
 * Creates user and issues server-set httpOnly auth cookie.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function register(req, res, next) {
  try {
    const { user, token } = await authService.register(req.body);

    // Issue httpOnly session cookie if an authenticated session was established
    if (token) {
      setAuthCookie(res, token);
    }

    return sendSuccess(res, { user }, 201, 'User registered successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * Handles user login (POST /api/v1/auth/login).
 * Authenticates user and issues server-set httpOnly auth cookie.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function login(req, res, next) {
  try {
    const { user, token } = await authService.login(req.body);

    // Issue httpOnly session cookie
    setAuthCookie(res, token);

    return sendSuccess(res, { user }, 200, 'Logged in successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * Handles user logout (POST /api/v1/auth/logout).
 * Clears the server-set httpOnly auth cookie using matching security attributes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function logout(req, res, next) {
  try {
    await authService.logout();

    // Clear httpOnly session cookie
    clearAuthCookie(res);

    return sendSuccess(res, null, 200, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

