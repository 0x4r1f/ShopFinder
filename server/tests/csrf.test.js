import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from '../src/config/env.js';
import { csrfProtect, createCsrfProtect } from '../src/middleware/csrf.js';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie
} from '../src/config/cookie.js';
import mainApp from '../src/app.js';

describe('Security & Cookie Infrastructure (Task 1.5)', () => {
  let server;
  let baseUrl;
  const clientUrl = env.CLIENT_URL; // e.g. http://localhost:5173

  before(async () => {
    // Build a dedicated test app that mirrors main app middleware order
    // plus dedicated test endpoints for all state-changing methods & cookies
    const testApp = express();

    testApp.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || origin === clientUrl) {
            callback(null, true);
          } else {
            const corsError = new Error('Not allowed by CORS policy');
            corsError.status = 403;
            callback(corsError);
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      })
    );

    testApp.use(express.json());
    testApp.use(cookieParser());
    testApp.use(csrfProtect);

    // Test routes for safe and state-changing HTTP methods
    testApp.get('/api/test-safe', (req, res) => {
      res.status(200).json({ success: true, method: 'GET' });
    });

    testApp.post('/api/test-state', (req, res) => {
      res.status(200).json({ success: true, method: 'POST', body: req.body });
    });

    testApp.put('/api/test-state', (req, res) => {
      res.status(200).json({ success: true, method: 'PUT', body: req.body });
    });

    testApp.patch('/api/test-state', (req, res) => {
      res.status(200).json({ success: true, method: 'PATCH', body: req.body });
    });

    testApp.delete('/api/test-state', (req, res) => {
      res.status(200).json({ success: true, method: 'DELETE' });
    });

    // Test routes for cookie setting and clearing helpers
    testApp.post('/api/test-cookie-set', (req, res) => {
      setAuthCookie(res, 'sample.jwt.token');
      res.status(200).json({ success: true });
    });

    testApp.post('/api/test-cookie-clear', (req, res) => {
      clearAuthCookie(res);
      res.status(200).json({ success: true });
    });

    // Centralized error handler
    testApp.use((err, req, res, next) => {
      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: { message: err.message || 'Internal Server Error' }
      });
    });

    await new Promise((resolve) => {
      server = testApp.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ==========================================
  // 1. CSRF Protection Tests
  // ==========================================
  describe('CSRF Origin & Referer Validation', () => {
    test('POST with matching Origin is accepted', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: clientUrl
        },
        body: JSON.stringify({ action: 'create' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.method, 'POST');
    });

    test('POST with mismatched Origin is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://malicious-site.com'
        },
        body: JSON.stringify({ action: 'attack' })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error);
    });

    test('POST with missing Origin but matching Referer is accepted', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: `${clientUrl}/dashboard/properties`
        },
        body: JSON.stringify({ action: 'create' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    test('POST with mismatched Referer is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'http://malicious-site.com/phish'
        },
        body: JSON.stringify({ action: 'attack' })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('POST with malformed Referer is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'not-a-valid-url-format'
        },
        body: JSON.stringify({ action: 'malformed' })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('POST with malformed Origin is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'null'
        },
        body: JSON.stringify({ action: 'null-origin' })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('POST with both Origin and Referer missing is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'no-headers' })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.message, 'Forbidden');
    });

    test('GET, HEAD, and OPTIONS are exempted from CSRF blocking without Origin or Referer', async () => {
      // GET
      const getRes = await fetch(`${baseUrl}/api/test-safe`);
      assert.equal(getRes.status, 200);

      // HEAD
      const headRes = await fetch(`${baseUrl}/api/test-safe`, { method: 'HEAD' });
      assert.equal(headRes.status, 200);

      // OPTIONS (handled by CORS)
      const optionsRes = await fetch(`${baseUrl}/api/test-state`, {
        method: 'OPTIONS',
        headers: {
          Origin: clientUrl,
          'Access-Control-Request-Method': 'POST'
        }
      });
      assert.ok([200, 204].includes(optionsRes.status));
    });

    test('PUT, PATCH, and DELETE are strictly protected by CSRF check', async () => {
      // PUT without Origin/Referer -> 403
      const putResBad = await fetch(`${baseUrl}/api/test-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1 })
      });
      assert.equal(putResBad.status, 403);

      // PUT with matching Origin -> 200
      const putResGood = await fetch(`${baseUrl}/api/test-state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: clientUrl
        },
        body: JSON.stringify({ id: 1 })
      });
      assert.equal(putResGood.status, 200);

      // PATCH without Origin/Referer -> 403
      const patchResBad = await fetch(`${baseUrl}/api/test-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'updated' })
      });
      assert.equal(patchResBad.status, 403);

      // PATCH with matching Origin -> 200
      const patchResGood = await fetch(`${baseUrl}/api/test-state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: clientUrl
        },
        body: JSON.stringify({ name: 'updated' })
      });
      assert.equal(patchResGood.status, 200);

      // DELETE without Origin/Referer -> 403
      const deleteResBad = await fetch(`${baseUrl}/api/test-state`, {
        method: 'DELETE'
      });
      assert.equal(deleteResBad.status, 403);

      // DELETE with matching Origin -> 200
      const deleteResGood = await fetch(`${baseUrl}/api/test-state`, {
        method: 'DELETE',
        headers: {
          Origin: clientUrl
        }
      });
      assert.equal(deleteResGood.status, 200);
    });
  });

  // ==========================================
  // 2. Cookie Configuration & Helpers Tests
  // ==========================================
  describe('Cookie Configuration & Helper Utilities', () => {
    test('Cookie configuration sets required attributes: HttpOnly, SameSite=Strict, Path=/', () => {
      const options = getAuthCookieOptions();
      assert.equal(options.httpOnly, true, 'HttpOnly must be true');
      assert.equal(options.sameSite, 'Strict', 'SameSite must be Strict');
      assert.equal(options.path, '/', 'Path must be /');
    });

    test('Secure flag is true in production environment', () => {
      const prodOptions = getAuthCookieOptions({}, 'production');
      assert.equal(prodOptions.secure, true, 'Secure must be true in production');
    });

    test('Secure flag is false in development/test environment for localhost testing', () => {
      const devOptions = getAuthCookieOptions({}, 'development');
      assert.equal(devOptions.secure, false, 'Secure should be false in local development');

      const testOptions = getAuthCookieOptions({}, 'test');
      assert.equal(testOptions.secure, false, 'Secure should be false in test');
    });

    test('setAuthCookie helper sets pb_auth cookie on response header', async () => {
      const res = await fetch(`${baseUrl}/api/test-cookie-set`, {
        method: 'POST',
        headers: {
          Origin: clientUrl
        }
      });

      assert.equal(res.status, 200);
      const setCookieHeader = res.headers.get('set-cookie');
      assert.ok(setCookieHeader, 'Set-Cookie header must be present');
      assert.ok(setCookieHeader.includes('pb_auth=sample.jwt.token'));
      assert.ok(setCookieHeader.toLowerCase().includes('httponly'));
      assert.ok(setCookieHeader.toLowerCase().includes('samesite=strict'));
      assert.ok(setCookieHeader.toLowerCase().includes('path=/'));
    });

    test('setAuthCookie helper rejects empty or non-string tokens', () => {
      const fakeRes = { cookie: () => {} };
      assert.throws(() => setAuthCookie(fakeRes, ''), /Auth token must be a non-empty string/);
      assert.throws(() => setAuthCookie(fakeRes, null), /Auth token must be a non-empty string/);
      assert.throws(() => setAuthCookie(fakeRes, 123), /Auth token must be a non-empty string/);
    });

    test('clearAuthCookie helper clears pb_auth with matching security attributes', async () => {
      const res = await fetch(`${baseUrl}/api/test-cookie-clear`, {
        method: 'POST',
        headers: {
          Origin: clientUrl
        }
      });

      assert.equal(res.status, 200);
      const setCookieHeader = res.headers.get('set-cookie');
      assert.ok(setCookieHeader, 'Set-Cookie header must be present');
      assert.ok(setCookieHeader.includes('pb_auth=;'));
      assert.ok(setCookieHeader.toLowerCase().includes('path=/'));
      assert.ok(setCookieHeader.toLowerCase().includes('httponly'));
      assert.ok(setCookieHeader.toLowerCase().includes('samesite=strict'));
    });
  });

  // ==========================================
  // 3. CORS Configuration Tests
  // ==========================================
  describe('CORS Whitelist & Preflight', () => {
    test('Allowed origin receives Access-Control-Allow-Origin and Credentials headers', async () => {
      const res = await fetch(`${baseUrl}/api/test-safe`, {
        headers: {
          Origin: clientUrl
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), clientUrl);
      assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    });

    test('OPTIONS preflight request responds with permitted methods and origin', async () => {
      const res = await fetch(`${baseUrl}/api/test-state`, {
        method: 'OPTIONS',
        headers: {
          Origin: clientUrl,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      assert.ok([200, 204].includes(res.status));
      assert.equal(res.headers.get('access-control-allow-origin'), clientUrl);
      assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
      const allowMethods = res.headers.get('access-control-allow-methods') || '';
      assert.ok(allowMethods.includes('POST'));
    });

    test('Untrusted origin is rejected and receives no permissive CORS header', async () => {
      const res = await fetch(`${baseUrl}/api/test-safe`, {
        headers: {
          Origin: 'http://untrusted-external-domain.org'
        }
      });

      assert.equal(res.status, 403);
      // Untrusted origin must never receive matching allow-origin
      assert.notEqual(res.headers.get('access-control-allow-origin'), 'http://untrusted-external-domain.org');
      assert.notEqual(res.headers.get('access-control-allow-origin'), '*');
    });
  });

  // ==========================================
  // 4. Main App Verification
  // ==========================================
  describe('Main Express App Integration', () => {
    let mainServer;
    let mainBaseUrl;

    before(async () => {
      await new Promise((resolve) => {
        mainServer = mainApp.listen(0, () => {
          mainBaseUrl = `http://127.0.0.1:${mainServer.address().port}`;
          resolve();
        });
      });
    });

    after(async () => {
      if (mainServer) {
        await new Promise((resolve) => mainServer.close(resolve));
      }
    });

    test('GET /health on main app continues passing without CSRF blockage', async () => {
      const res = await fetch(`${mainBaseUrl}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
    });

    test('POST to non-existent route without Origin header on main app is blocked by CSRF with 403', async () => {
      const res = await fetch(`${mainBaseUrl}/api/v1/unknown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 1 })
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.message, 'Forbidden');
    });
  });
});

