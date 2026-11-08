import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { getAuthCookieOptions, setAuthCookie, clearAuthCookie, AUTH_COOKIE_NAME } from '../src/config/cookie.js';

describe('Express Authentication Endpoints & Cookie Integration (Task 3.2 & 3.3)', () => {
  let server;
  let baseUrl;
  const createdUserIds = [];
  const testRunId = Date.now();

  const customerEmail = `auth_test_cust_${testRunId}@example.com`;
  const ownerEmail = `auth_test_owner_${testRunId}@example.com`;
  const testPassword = 'SecurePassword123!';

  before(async () => {
    // Start ephemeral server on random available port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Close server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Cleanup created test user records via Admin SDK to leave 0 residual records
    try {
      const adminPb = await getAdminClient();
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {
          // Ignore deletion error if already removed
        }
      }
    } catch (err) {
      console.warn('Test cleanup warning:', err.message);
    }
  });

  // Helper for making requests with required CSRF Origin header
  async function makeRequest(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Origin: env.CLIENT_URL,
        ...options.headers,
      },
    });
    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  // Helper to extract Set-Cookie header strings from fetch response
  function getSetCookieHeaders(headers) {
    if (!headers) return [];
    if (typeof headers.getSetCookie === 'function') {
      return headers.getSetCookie();
    }
    const raw = headers.get('set-cookie');
    return raw ? [raw] : [];
  }

  function findCookie(headers, cookieName = AUTH_COOKIE_NAME) {
    const cookies = getSetCookieHeaders(headers);
    return cookies.find((c) => c.startsWith(`${cookieName}=`)) || null;
  }

  // --- Registration Tests ---

  test('1. Successful customer registration returns sanitized user profile and sets pb_auth cookie', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Customer',
        email: customerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });

    assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.success, true);
    assert.equal(res.data.message, 'User registered successfully');
    assert.ok(res.data.data?.user?.id, 'User record must have an id');
    assert.equal(res.data.data.user.email, customerEmail);
    assert.equal(res.data.data.user.role, 'customer');
    assert.equal(res.data.data.user.name, 'Test Customer');
    assert.equal(res.data.data.user.is_active, true);

    // Track for cleanup
    createdUserIds.push(res.data.data.user.id);

    // CRITICAL SECURITY ASSERTIONS: Zero sensitive data in response body
    assert.equal(res.data.data.user.password, undefined, 'Password must NEVER be returned');
    assert.equal(res.data.data.user.passwordHash, undefined, 'Password hash must NEVER be returned');
    assert.equal(res.data.data.user.tokenKey, undefined, 'tokenKey must NEVER be returned');
    assert.equal(res.data.data.user.phone, undefined, 'Phone must NEVER be returned in users profile');
    assert.equal(res.data.data.token, undefined, 'Token must NOT be exposed in response body (D-010)');

    // COOKIE SECURITY ASSERTIONS (Task 3.3)
    const cookie = findCookie(res.headers, 'pb_auth');
    assert.ok(cookie, 'Registration must issue pb_auth Set-Cookie header');
    assert.ok(cookie.includes('HttpOnly'), 'Cookie must have HttpOnly flag');
    assert.ok(cookie.includes('SameSite=Strict'), 'Cookie must have SameSite=Strict flag');
    assert.ok(cookie.includes('Path=/'), 'Cookie must have Path=/');
    assert.ok(!cookie.includes('Secure'), 'Cookie must not have Secure flag in test/development');
  });

  test('2. Successful owner registration returns sanitized profile and sets pb_auth cookie', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Shop Owner',
        email: ownerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'owner',
      }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.role, 'owner');
    assert.equal(res.data.data.user.email, ownerEmail);

    createdUserIds.push(res.data.data.user.id);

    // Cookie verification
    const cookie = findCookie(res.headers, 'pb_auth');
    assert.ok(cookie, 'Owner registration must issue pb_auth Set-Cookie header');
    assert.ok(cookie.includes('HttpOnly'));
    assert.ok(cookie.includes('SameSite=Strict'));
    assert.ok(cookie.includes('Path=/'));
  });

  test('3. Admin self-registration is explicitly rejected with HTTP 400 without issuing cookies', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Malicious Admin Wannabe',
        email: `hacker_${testRunId}@example.com`,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'admin',
      }),
    });

    assert.equal(res.status, 400, 'Admin registration must return HTTP 400 Bad Request');
    assert.equal(res.data.success, false);
    assert.ok(
      res.data.error.message.includes('Admin accounts cannot be self-registered'),
      `Expected Admin error message, got: ${res.data.error.message}`
    );

    const cookie = findCookie(res.headers, 'pb_auth');
    assert.equal(cookie, null, 'Rejected registration must NOT issue cookie');
  });

  test('4. Registration with invalid or unapproved role is rejected with HTTP 400 without cookie', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Invalid Role User',
        email: `bad_role_${testRunId}@example.com`,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'superuser',
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes("Role must be either 'customer' or 'owner'"));

    const cookie = findCookie(res.headers, 'pb_auth');
    assert.equal(cookie, null);
  });

  test('5. Registration with missing required fields is rejected with HTTP 400', async () => {
    // Missing email
    const res1 = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'No Email User',
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });
    assert.equal(res1.status, 400);
    assert.equal(findCookie(res1.headers, 'pb_auth'), null);

    // Missing password
    const res2 = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'No Password User',
        email: `nopass_${testRunId}@example.com`,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });
    assert.equal(res2.status, 400);
    assert.equal(findCookie(res2.headers, 'pb_auth'), null);

    // Missing name
    const res3 = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `noname_${testRunId}@example.com`,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });
    assert.equal(res3.status, 400);
    assert.equal(findCookie(res3.headers, 'pb_auth'), null);
  });

  test('6. Registration with mismatched password confirmation is rejected with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Mismatch User',
        email: `mismatch_${testRunId}@example.com`,
        password: testPassword,
        passwordConfirm: 'DifferentPassword123!',
        role: 'customer',
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('Passwords do not match'));
    assert.equal(findCookie(res.headers, 'pb_auth'), null);
  });

  test('7. Registration with password under 8 characters is rejected with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Short Password User',
        email: `shortpass_${testRunId}@example.com`,
        password: 'short',
        passwordConfirm: 'short',
        role: 'customer',
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('at least 8 characters'));
    assert.equal(findCookie(res.headers, 'pb_auth'), null);
  });

  test('8. Registration prevents privileged-field mass assignment', async () => {
    const massAssignmentEmail = `mass_assign_${testRunId}@example.com`;
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Mass Assign User',
        email: massAssignmentEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
        // Attempting to inject privileged fields
        id: 'fake_custom_id_9999',
        verified: true,
        is_active: false,
        tokenKey: 'injected_token_key',
        admin: true,
      }),
    });

    assert.equal(res.status, 201);
    createdUserIds.push(res.data.data.user.id);

    // Verify injected id was discarded and real generated PocketBase id was assigned
    assert.notEqual(res.data.data.user.id, 'fake_custom_id_9999');
    // Verify default active state was applied by lifecycle hook, not client injection
    assert.equal(res.data.data.user.is_active, true);
    // Verify no injected properties exist in response
    assert.equal(res.data.data.user.admin, undefined);
    assert.equal(res.data.data.user.tokenKey, undefined);

    // Verify cookie was issued
    assert.ok(findCookie(res.headers, 'pb_auth'));
  });

  test('9. Duplicate email registration is rejected with HTTP 409 Conflict without cookie', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Email Attempt',
        email: customerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });

    assert.equal(res.status, 409);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.message.includes('already exists'));
    assert.equal(findCookie(res.headers, 'pb_auth'), null);
  });

  // --- Login & Cookie Tests ---

  test('10. Successful login sets pb_auth httpOnly cookie with strict security flags and no token in body', async () => {
    const res = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: customerEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.message, 'Logged in successfully');
    assert.ok(res.data.data?.user?.id);
    assert.equal(res.data.data.user.email, customerEmail);
    assert.equal(res.data.data.user.role, 'customer');

    // CRITICAL SECURITY ASSERTIONS: Zero sensitive tokens or credentials in body
    assert.equal(res.data.data.token, undefined, 'Auth token must NOT be returned in response body (D-010)');
    assert.equal(res.data.data.user.password, undefined, 'Password must NOT be returned');
    assert.equal(res.data.data.user.tokenKey, undefined, 'tokenKey must NOT be returned');

    // COOKIE SECURITY ATTRIBUTES (Task 3.3)
    const cookie = findCookie(res.headers, 'pb_auth');
    assert.ok(cookie, 'Login response must include pb_auth Set-Cookie header');
    assert.ok(cookie.includes('HttpOnly'), 'pb_auth must have HttpOnly attribute');
    assert.ok(cookie.includes('SameSite=Strict'), 'pb_auth must have SameSite=Strict attribute');
    assert.ok(cookie.includes('Path=/'), 'pb_auth must have Path=/ attribute');
    assert.ok(!cookie.includes('Secure'), 'pb_auth must not have Secure flag in test/development');
  });

  test('11. Login with incorrect password is rejected with HTTP 401 and sets no cookie', async () => {
    const res = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: customerEmail,
        password: 'IncorrectPassword999!',
      }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid email or password');
    assert.equal(findCookie(res.headers, 'pb_auth'), null, 'Failed login must not set pb_auth cookie');
  });

  test('12. Login with non-existent email is rejected with HTTP 401 and sets no cookie', async () => {
    const res = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `nonexistent_${testRunId}@example.com`,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid email or password');
    assert.equal(findCookie(res.headers, 'pb_auth'), null, 'Failed login must not set pb_auth cookie');
  });

  test('13. Login with malformed or missing credentials is rejected with HTTP 400 and sets no cookie', async () => {
    // Missing password
    const res1 = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: customerEmail,
      }),
    });
    assert.equal(res1.status, 400);
    assert.equal(findCookie(res1.headers, 'pb_auth'), null);

    // Invalid email format
    const res2 = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: testPassword,
      }),
    });
    assert.equal(res2.status, 400);
    assert.equal(findCookie(res2.headers, 'pb_auth'), null);
  });

  test('14. Login with deactivated account (is_active: false) is rejected with HTTP 401 and sets no cookie', async () => {
    const deactivatedEmail = `deactivated_${testRunId}@example.com`;

    // 1. Register account
    const regRes = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Deactivated User',
        email: deactivatedEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      }),
    });
    assert.equal(regRes.status, 201);
    const userId = regRes.data.data.user.id;
    createdUserIds.push(userId);

    // 2. Deactivate account using Admin SDK
    const adminPb = await getAdminClient();
    await adminPb.collection('users').update(userId, { is_active: false });

    // 3. Attempt login with correct password
    const loginRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: deactivatedEmail,
        password: testPassword,
      }),
    });

    assert.equal(loginRes.status, 401);
    assert.equal(loginRes.data.success, false);
    assert.ok(loginRes.data.error.message.includes('Account is deactivated'));
    assert.equal(findCookie(loginRes.headers, 'pb_auth'), null, 'Deactivated account must not receive auth cookie');
  });

  // --- Logout & Cookie Clearing Tests ---

  test('15. Logout endpoint clears pb_auth cookie using matching security attributes and standard response', async () => {
    const res = await makeRequest('/api/v1/auth/logout', {
      method: 'POST',
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.message, 'Logged out successfully');

    // COOKIE CLEARING ASSERTIONS (Task 3.3)
    const cookie = findCookie(res.headers, 'pb_auth');
    assert.ok(cookie, 'Logout response must include Set-Cookie header for pb_auth');
    assert.ok(cookie.includes('Path=/'), 'Cookie clearing must match Path=/');
    assert.ok(cookie.includes('HttpOnly'), 'Cookie clearing must match HttpOnly');
    assert.ok(cookie.includes('SameSite=Strict'), 'Cookie clearing must match SameSite=Strict');

    // In Express, res.clearCookie sets value to empty string and epoch expiry (Thu, 01 Jan 1970) or Max-Age=0
    const isCleared =
      cookie.includes('pb_auth=;') ||
      cookie.includes('Expires=Thu, 01 Jan 1970') ||
      cookie.includes('Max-Age=0');
    assert.ok(isCleared, `Cookie must be expired/cleared: ${cookie}`);

    assert.equal(res.data.data, undefined, 'Logout must not return data payload');
    assert.equal(res.data.token, undefined, 'Logout must never expose tokens');
  });

  // --- Cookie Configuration & Security Attribute Unit Tests ---

  test('16. Cookie helper enforces Secure=true in production and Secure=false in development/test', () => {
    const prodOptions = getAuthCookieOptions({}, 'production');
    assert.equal(prodOptions.httpOnly, true, 'Production cookie must be HttpOnly');
    assert.equal(prodOptions.sameSite, 'Strict', 'Production cookie must be SameSite=Strict');
    assert.equal(prodOptions.path, '/', 'Production cookie must have path /');
    assert.equal(prodOptions.secure, true, 'Production cookie MUST enforce Secure=true');

    const devOptions = getAuthCookieOptions({}, 'development');
    assert.equal(devOptions.secure, false, 'Development cookie must have Secure=false for localhost testing');

    const testOptions = getAuthCookieOptions({}, 'test');
    assert.equal(testOptions.secure, false, 'Test cookie must have Secure=false for test runners');
  });

  test('17. setAuthCookie helper strictly rejects empty, null, or non-string tokens', () => {
    const mockRes = { cookie: () => {} };
    assert.throws(() => setAuthCookie(mockRes, ''), /non-empty string/);
    assert.throws(() => setAuthCookie(mockRes, '   '), /non-empty string/);
    assert.throws(() => setAuthCookie(mockRes, null), /non-empty string/);
    assert.throws(() => setAuthCookie(mockRes, undefined), /non-empty string/);
    assert.throws(() => setAuthCookie(mockRes, 12345), /non-empty string/);
  });

  test('18. State-changing auth endpoints enforce CSRF origin protection against missing Origin header', async () => {
    // Attempt login without Origin header
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customerEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 403, 'Request missing Origin must be blocked with HTTP 403 Forbidden');
    const cookie = findCookie(res.headers, 'pb_auth');
    assert.equal(cookie, null, 'CSRF-blocked request must never issue an auth cookie');
  });
});
