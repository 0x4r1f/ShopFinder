import PocketBase from 'pocketbase';
import { env } from '../config/env.js';
import { getAdminClient } from '../config/pocketbase.js';
import { sanitizeUser } from '../utils/apiResponse.js';

/**
 * ShopFinder — Authentication Service Layer (Task 3.2)
 *
 * Implements core registration, login, and logout business logic.
 *
 * SECURITY BOUNDARY RULES:
 * 1. User registration creates records via the server-side Admin SDK singleton (getAdminClient).
 * 2. User authentication (login) MUST use an isolated, request-scoped PocketBase client
 *    (new PocketBase(env.POCKETBASE_URL)). It NEVER uses the shared Admin SDK singleton.
 * 3. Client-supplied privileged fields are strictly rejected and stripped to prevent mass assignment.
 * 4. Deactivated accounts (is_active === false) are rejected with HTTP 401.
 */

/**
 * Registers a new user with role 'customer' or 'owner'.
 * Admin self-registration is strictly forbidden and rejected at schema validation.
 *
 * @param {Object} input - Validated registration parameters
 * @param {string} input.name
 * @param {string} input.email
 * @param {string} input.password
 * @param {string} input.passwordConfirm
 * @param {'customer'|'owner'} input.role
 * @returns {Promise<{ user: Object, token: string|null }>}
 */
export async function register(input) {
  // 1. Whitelist fields explicitly to guarantee zero mass assignment
  const userPayload = {
    name: input.name,
    email: input.email,
    password: input.password,
    passwordConfirm: input.passwordConfirm,
    role: input.role,
  };

  // 2. Obtain privileged Admin SDK client to create record in locked users collection
  const adminPb = await getAdminClient();

  let record;
  try {
    record = await adminPb.collection('users').create(userPayload);
  } catch (err) {
    // Check if error is due to duplicate email
    const isDuplicateEmail =
      Boolean(err?.data?.data?.email) ||
      Boolean(err?.data?.email) ||
      Boolean(err?.response?.data?.email) ||
      (typeof err?.message === 'string' &&
        (err.message.toLowerCase().includes('email') || err.message.toLowerCase().includes('unique')));

    if (isDuplicateEmail) {
      const conflictError = new Error('An account with this email address already exists');
      conflictError.status = 409;
      throw conflictError;
    }

    const creationError = new Error(err?.message || 'Failed to create user account');
    creationError.status = err?.status || 400;
    throw creationError;
  }

  // 3. Generate initial session token for the newly registered user using an isolated client
  let token = null;
  try {
    const userPb = new PocketBase(env.POCKETBASE_URL);
    const authData = await userPb.collection('users').authWithPassword(input.email, input.password);
    token = authData.token;
  } catch {
    // If auto-authentication fails, user record was still created successfully
  }

  return {
    user: sanitizeUser(record),
    token,
  };
}

/**
 * Authenticates user credentials against the PocketBase 'users' collection.
 * Uses an isolated PocketBase instance to ensure zero auth-state pollution.
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function login({ email, password }) {
  // 1. Instantiate an isolated client per login attempt — NEVER share Admin SDK singleton
  const userPb = new PocketBase(env.POCKETBASE_URL);

  let authData;
  try {
    authData = await userPb.collection('users').authWithPassword(email, password);
  } catch {
    // Generic error message to prevent account enumeration / timing discrepancies
    const authError = new Error('Invalid email or password');
    authError.status = 401;
    throw authError;
  }

  // 2. Verify account activation status
  if (authData.record.is_active === false) {
    const deactivatedError = new Error('Account is deactivated. Please contact support.');
    deactivatedError.status = 401;
    throw deactivatedError;
  }

  return {
    user: sanitizeUser(authData.record),
    token: authData.token,
  };
}

/**
 * Logout service foundation.
 * Prepares response for session teardown.
 *
 * @returns {Promise<{ success: boolean }>}
 */
export async function logout() {
  return { success: true };
}
