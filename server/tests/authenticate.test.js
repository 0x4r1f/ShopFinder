import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import PocketBase from 'pocketbase';
import { env } from '../src/config/env.js';
import { getAdminClient, pbAdmin } from '../src/config/pocketbase.js';
import { AUTH_COOKIE_NAME } from '../src/config/cookie.js';
import { authenticate, createAuthenticate } from '../src/middleware/authenticate.js';

describe('Request-Scoped JWT Verification Middleware (Task 3.4)', () => {
  let server;
  let baseUrl;
  const createdUserIds = [];
  const testRunId = Date.now();

  const activeUserEmail = `auth_mw_active_${testRunId}@example.com`;
  const deactivatedUserEmail = `auth_mw_deact_${testRunId}@example.com`;
  const deletedUserEmail = `auth_mw_del_${testRunId}@example.com`;
  const testPassword = 'SecurePassword123!';

  let activeToken;
  let deactivatedToken;
  let deletedUserToken;
  let activeUserId;
  let deactivatedUserId;

  before(async () => {
    // 1. Create real test accounts in PocketBase
    const adminPb = await getAdminClient();

    // Active customer user
    const activeRecord = await adminPb.collection('users').create({
      name: 'Active Middleware User',
      email: activeUserEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    activeUserId = activeRecord.id;
    createdUserIds.push(activeUserId);

    // Deactivated user
    const deactRecord = await adminPb.collection('users').create({
      name: 'Deactivated Middleware User',
      email: deactivatedUserEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    deactivatedUserId = deactRecord.id;
    createdUserIds.push(deactivatedUserId);

    // Deleted user (will be deleted after obtaining token)
    const delRecord = await adminPb.collection('users').create({
      name: 'Deleted Middleware User',
      email: deletedUserEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      role: 'customer',
    });
    createdUserIds.push(delRecord.id);

    // 2. Obtain JWT tokens via isolated PocketBase authWithPassword
    const loginPb = new PocketBase(env.POCKETBASE_URL);

    const activeAuth = await loginPb.collection('users').authWithPassword(activeUserEmail, testPassword);
    activeToken = activeAuth.token;

    const deactAuth = await loginPb.collection('users').authWithPassword(deactivatedUserEmail, testPassword);
    deactivatedToken = deactAuth.token;

    const delAuth = await loginPb.collection('users').authWithPassword(deletedUserEmail, testPassword);
    deletedUserToken = delAuth.token;

    // Now deactivate the second user
    await adminPb.collection('users').update(deactivatedUserId, { is_active: false });

    // Now delete the third user from PocketBase
    await adminPb.collection('users').delete(delRecord.id);

    // 3. Build test Express application
    const app = express();
    app.use(cookieParser());
    app.use(express.json());

    // Standard protected route using default authenticate middleware
    app.get('/test-protected', authenticate, (req, res) => {
      res.status(200).json({
        success: true,
        user: req.user,
      });
    });

    // Route testing client-supplied identity overwrite defense
    app.get(
      '/test-spoof-defense',
      (req, res, next) => {
        // Pre-populate req.user with attacker-controlled privileged role
        req.user = { id: 'spoofed-id', role: 'admin', name: 'Hacker' };
        next();
      },
      authenticate,
      (req, res) => {
        res.status(200).json({
          success: true,
          user: req.user,
        });
      }
    );

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up created users in PocketBase
    try {
      const adminPb = await getAdminClient();
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {
          // Already deleted is fine
        }
      }
    } catch (err) {
      console.warn('Test cleanup error:', err.message);
    }
  });

  async function makeRequest(path, cookieValue = null) {
    const headers = {};
    if (cookieValue !== null) {
      headers['Cookie'] = `${AUTH_COOKIE_NAME}=${cookieValue}`;
    }

    const res = await fetch(`${baseUrl}${path}`, { headers });
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

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

  test('1. Missing pb_auth cookie rejects with HTTP 401', async () => {
    const res = await makeRequest('/test-protected');
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Authentication required');
  });

  test('2. Empty or whitespace-only pb_auth cookie rejects with HTTP 401', async () => {
    const emptyRes = await makeRequest('/test-protected', '');
    assert.equal(emptyRes.status, 401);
    assert.equal(emptyRes.data.success, false);
    assert.equal(emptyRes.data.error.message, 'Authentication required');

    const whitespaceRes = await makeRequest('/test-protected', '   ');
    assert.equal(whitespaceRes.status, 401);
    assert.equal(whitespaceRes.data.success, false);
    assert.equal(whitespaceRes.data.error.message, 'Authentication required');
  });

  test('3. Malformed token rejects with HTTP 401', async () => {
    const res = await makeRequest('/test-protected', 'not.a.valid.jwt');
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid or expired authentication token');
  });

  test('4. Invalid token with invalid signature rejects with HTTP 401', async () => {
    // Valid looking base64 payload but signed with wrong secret
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImV4cCI6OTk5OTk5OTk5OX0.invalid_signature_xyz';
    const res = await makeRequest('/test-protected', fakeToken);
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid or expired authentication token');
  });

  test('5. Expired token rejects with HTTP 401', async () => {
    // Expired payload (exp: 1000000000 -> Sep 2001)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImV4cCI6MTAwMDAwMDAwMH0.signature';
    const res = await makeRequest('/test-protected', expiredToken);
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid or expired authentication token');
  });

  test('6. Valid token allows request to continue (HTTP 200)', async () => {
    const res = await makeRequest('/test-protected', activeToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.user);
  });

  test('7. Valid token attaches sanitized req.user with strictly approved fields', async () => {
    const res = await makeRequest('/test-protected', activeToken);
    assert.equal(res.status, 200);
    const user = res.data.user;

    // Verified approved fields
    assert.equal(user.id, activeUserId);
    assert.equal(user.email, activeUserEmail);
    assert.equal(user.name, 'Active Middleware User');
    assert.equal(user.role, 'customer');
    assert.equal(user.is_active, true);
    assert.ok('created' in user);
    assert.ok('updated' in user);

    // Forbidden / sensitive fields strictly excluded
    assert.equal(user.password, undefined);
    assert.equal(user.passwordConfirm, undefined);
    assert.equal(user.tokenKey, undefined);
    assert.equal(user.token, undefined);
    assert.equal(user.phone, undefined);
    assert.equal(user.emailVisibility, undefined);
  });

  test('8. Deactivated user (is_active: false) rejects with HTTP 401', async () => {
    const res = await makeRequest('/test-protected', deactivatedToken);
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Account is deactivated. Please contact support.');
  });

  test('9. User record unavailable (deleted user) rejects with HTTP 401', async () => {
    const res = await makeRequest('/test-protected', deletedUserToken);
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
    assert.equal(res.data.error.message, 'Invalid or expired authentication token');
  });

  test('10. Unexpected PocketBase failure returns safe generic error response (HTTP 503)', async () => {
    // Custom authenticate middleware with client factory returning a broken client
    const failingAuth = createAuthenticate({
      clientFactory: () => ({
        autoCancellation: () => {},
        authStore: { save: () => {} },
        collection: () => ({
          authRefresh: async () => {
            const networkError = new Error('connect ECONNREFUSED 127.0.0.1:8090');
            networkError.status = 0; // PocketBase fetch network error code
            throw networkError;
          },
        }),
      }),
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-failing-pb', failingAuth, (req, res) => res.json({ ok: true }));

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      const res = await fetch(`${tempUrl}/test-failing-pb`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      const data = await res.json();

      assert.equal(res.status, 503);
      assert.equal(data.success, false);
      assert.equal(data.error.message, 'Authentication service temporarily unavailable');
      // Assert no raw internal network details leaked
      assert.ok(!JSON.stringify(data).includes('ECONNREFUSED'));
      assert.ok(!JSON.stringify(data).includes('8090'));
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('11. Two separate requests use separate PocketBase client instances', async () => {
    const createdClients = [];

    const trackingAuth = createAuthenticate({
      clientFactory: () => {
        const client = new PocketBase(env.POCKETBASE_URL);
        createdClients.push(client);
        return client;
      },
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-isolation', trackingAuth, (req, res) => res.json({ ok: true }));

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      await fetch(`${tempUrl}/test-isolation`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      await fetch(`${tempUrl}/test-isolation`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });

      assert.equal(createdClients.length, 2, 'Exactly two client instances must be created');
      assert.notEqual(
        createdClients[0],
        createdClients[1],
        'Request 1 and Request 2 must have distinct, isolated PocketBase client instances'
      );
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('12. No shared Admin SDK session state is used or polluted during verification', async () => {
    // Before running request, check Admin SDK state
    const adminPbBefore = await getAdminClient();
    const adminTokenBefore = adminPbBefore.authStore.token;

    // Run verification with customer token
    const res = await makeRequest('/test-protected', activeToken);
    assert.equal(res.status, 200);

    // Ensure pbAdmin was never polluted with customer token
    assert.notEqual(pbAdmin.authStore.token, activeToken, 'pbAdmin authStore must never hold customer token');
    assert.equal(pbAdmin.authStore.token, adminTokenBefore, 'pbAdmin token must remain untouched');
  });

  test('13. No token or sensitive data leaks into responses or error payloads', async () => {
    const invalidRes = await makeRequest('/test-protected', 'leaked.secret.token.xyz');
    const jsonStr = JSON.stringify(invalidRes.data);

    assert.ok(!jsonStr.includes('leaked.secret.token.xyz'), 'Token must not leak in error response');
    assert.ok(!jsonStr.includes('password'), 'Password must not appear in response');
    assert.ok(!jsonStr.includes('tokenKey'), 'tokenKey must not appear in response');
  });

  test('14. Client-supplied user identity or role cannot override verified identity', async () => {
    // /test-spoof-defense pre-sets req.user = { id: 'spoofed-id', role: 'admin', name: 'Hacker' }
    // before authenticate runs
    const res = await makeRequest('/test-spoof-defense', activeToken);
    assert.equal(res.status, 200);

    // Verified token must strictly overwrite the spoofed values
    assert.equal(res.data.user.id, activeUserId, 'User id must match verified PocketBase record');
    assert.equal(res.data.user.role, 'customer', 'Role must match verified token (customer, NOT admin)');
    assert.equal(res.data.user.name, 'Active Middleware User', 'Name must match verified record');
  });

  test('15. Successful refresh updates the pb_auth cookie when token is rotated', async () => {
    const rotatedToken = 'rotated.refreshed.jwt.token';
    const rotatingAuth = createAuthenticate({
      clientFactory: () => ({
        autoCancellation: () => {},
        authStore: { save: () => {} },
        collection: () => ({
          authRefresh: async () => ({
            token: rotatedToken,
            record: {
              id: activeUserId,
              name: 'Active Middleware User',
              email: activeUserEmail,
              role: 'customer',
              is_active: true,
            },
          }),
        }),
      }),
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-refresh-cookie', rotatingAuth, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      const res = await fetch(`${tempUrl}/test-refresh-cookie`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      const data = await res.json();
      const cookieHeader = findCookie(res.headers);

      assert.equal(res.status, 200);
      assert.ok(cookieHeader, 'Set-Cookie header must be issued when token rotates');
      assert.ok(cookieHeader.startsWith(`${AUTH_COOKIE_NAME}=${rotatedToken}`), 'Cookie must contain rotated token');
      assert.ok(cookieHeader.includes('HttpOnly'), 'Refreshed cookie must have HttpOnly');
      assert.ok(cookieHeader.includes('SameSite=Strict'), 'Refreshed cookie must have SameSite=Strict');
      assert.ok(cookieHeader.includes('Path=/'), 'Refreshed cookie must have Path=/');
      assert.equal(data.user.id, activeUserId);
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('16. Unchanged token does not re-issue redundant Set-Cookie header', async () => {
    const staticAuth = createAuthenticate({
      clientFactory: () => ({
        autoCancellation: () => {},
        authStore: { save: () => {} },
        collection: () => ({
          authRefresh: async () => ({
            token: activeToken, // Same token as incoming
            record: {
              id: activeUserId,
              name: 'Active Middleware User',
              email: activeUserEmail,
              role: 'customer',
              is_active: true,
            },
          }),
        }),
      }),
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-static-token', staticAuth, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      const res = await fetch(`${tempUrl}/test-static-token`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      const cookieHeader = findCookie(res.headers);

      assert.equal(res.status, 200);
      assert.equal(cookieHeader, null, 'Unchanged token must not produce redundant Set-Cookie header');
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('17. Refreshed token is never exposed in the response body or data payload', async () => {
    const rotatedToken = 'secret.rotated.token.value';
    const rotatingAuth = createAuthenticate({
      clientFactory: () => ({
        autoCancellation: () => {},
        authStore: { save: () => {} },
        collection: () => ({
          authRefresh: async () => ({
            token: rotatedToken,
            record: {
              id: activeUserId,
              name: 'Active Middleware User',
              email: activeUserEmail,
              role: 'customer',
              is_active: true,
            },
          }),
        }),
      }),
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-body-token-leak', rotatingAuth, (req, res) => {
      res.status(200).json({ success: true, user: req.user });
    });

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      const res = await fetch(`${tempUrl}/test-body-token-leak`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      const data = await res.json();
      const bodyStr = JSON.stringify(data);

      assert.equal(res.status, 200);
      assert.ok(!bodyStr.includes(rotatedToken), 'Refreshed token must NEVER appear anywhere in the response body');
      assert.equal(data.user.token, undefined);
      assert.equal(data.token, undefined);
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('18. Failed refresh does not issue a new authentication cookie', async () => {
    const failedAuth = createAuthenticate({
      clientFactory: () => ({
        autoCancellation: () => {},
        authStore: { save: () => {} },
        collection: () => ({
          authRefresh: async () => {
            const err = new Error('Token expired');
            err.status = 401;
            throw err;
          },
        }),
      }),
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-failed-refresh', failedAuth, (req, res) => res.json({ ok: true }));

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      const res = await fetch(`${tempUrl}/test-failed-refresh`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      const cookieHeader = findCookie(res.headers);

      assert.equal(res.status, 401);
      assert.equal(cookieHeader, null, 'Failed authentication must never issue a cookie');
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });

  test('19. Request-scoped client isolation remains intact during token rotation', async () => {
    const clients = [];
    const rotatingAuth = createAuthenticate({
      clientFactory: () => {
        const client = {
          id: Math.random(),
          autoCancellation: () => {},
          authStore: { save: () => {} },
          collection: () => ({
            authRefresh: async () => ({
              token: `rotated_${Math.random()}`,
              record: {
                id: activeUserId,
                name: 'User',
                email: activeUserEmail,
                role: 'customer',
                is_active: true,
              },
            }),
          }),
        };
        clients.push(client);
        return client;
      },
    });

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get('/test-rotation-isolation', rotatingAuth, (req, res) => res.json({ ok: true }));

    const tempServer = await new Promise((resolve) => {
      const s = testApp.listen(0, () => resolve(s));
    });
    const tempUrl = `http://127.0.0.1:${tempServer.address().port}`;

    try {
      await fetch(`${tempUrl}/test-rotation-isolation`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });
      await fetch(`${tempUrl}/test-rotation-isolation`, {
        headers: { Cookie: `${AUTH_COOKIE_NAME}=${activeToken}` },
      });

      assert.equal(clients.length, 2);
      assert.notEqual(clients[0], clients[1], 'Each request must receive its own isolated client');
      assert.notEqual(clients[0].id, clients[1].id);
    } finally {
      await new Promise((resolve) => tempServer.close(resolve));
    }
  });
});

