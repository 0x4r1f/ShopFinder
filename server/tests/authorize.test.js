import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import PocketBase from 'pocketbase';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import { AUTH_COOKIE_NAME, setAuthCookie } from '../src/config/cookie.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { authorize, VALID_ROLES } from '../src/middleware/authorize.js';

describe('Role-Based Authorization Middleware Factory (Task 3.5)', () => {
  describe('Unit & Behavioral Tests', () => {
    function createMockRes() {
      const res = {
        statusCode: null,
        jsonData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        },
      };
      return res;
    }

    test('1. Missing req.user rejects with HTTP 401', () => {
      const req = {};
      const res = createMockRes();
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const mw = authorize('customer');
      mw(req, res, next);

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.success, false);
      assert.equal(res.jsonData.error.message, 'Authentication required');
      assert.equal(nextCalled, false, 'next() must never be called when unauthenticated');
    });

    test('2. Null or non-object req.user rejects with HTTP 401', () => {
      const cases = [null, undefined, 'not-an-object', 123, true, []];

      for (const val of cases) {
        const req = { user: val };
        const res = createMockRes();
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
        };

        const mw = authorize('owner');
        mw(req, res, next);

        assert.equal(res.statusCode, 401, `Failed for value: ${JSON.stringify(val)}`);
        assert.equal(res.jsonData.success, false);
        assert.equal(res.jsonData.error.message, 'Authentication required');
        assert.equal(nextCalled, false);
      }
    });

    test('3. Missing user role on req.user rejects with HTTP 403', () => {
      const cases = [
        { user: {} },
        { user: { id: 'u1', role: '' } },
        { user: { id: 'u1', role: null } },
        { user: { id: 'u1', role: undefined } },
      ];

      for (const req of cases) {
        const res = createMockRes();
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
        };

        const mw = authorize('customer');
        mw(req, res, next);

        assert.equal(res.statusCode, 403);
        assert.equal(res.jsonData.success, false);
        assert.equal(res.jsonData.error.message, 'Forbidden: insufficient permissions');
        assert.equal(nextCalled, false);
      }
    });

    test('4. Invalid or unrecognized user role rejects with HTTP 403', () => {
      const invalidRoles = ['superadmin', 'guest', 'moderator', 'root', 'user', 123, {}];

      for (const role of invalidRoles) {
        const req = { user: { id: 'u1', role } };
        const res = createMockRes();
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
        };

        const mw = authorize('admin');
        mw(req, res, next);

        assert.equal(res.statusCode, 403, `Failed for unrecognized role: ${role}`);
        assert.equal(res.jsonData.success, false);
        assert.equal(res.jsonData.error.message, 'Forbidden: insufficient permissions');
        assert.equal(nextCalled, false);
      }
    });

    test('5. Customer allowed on customer-only route', () => {
      const req = { user: { id: 'c1', role: 'customer' } };
      const res = createMockRes();
      let nextCalls = 0;
      const next = () => {
        nextCalls++;
      };

      const mw = authorize('customer');
      mw(req, res, next);

      assert.equal(nextCalls, 1, 'next() must be called exactly once for permitted role');
      assert.equal(res.statusCode, null, 'Response should not be terminated when authorized');
    });

    test('6. Owner allowed on owner-only route', () => {
      const req = { user: { id: 'o1', role: 'owner' } };
      const res = createMockRes();
      let nextCalls = 0;
      const next = () => {
        nextCalls++;
      };

      const mw = authorize('owner');
      mw(req, res, next);

      assert.equal(nextCalls, 1);
      assert.equal(res.statusCode, null);
    });

    test('7. Admin allowed on admin-only route', () => {
      const req = { user: { id: 'a1', role: 'admin' } };
      const res = createMockRes();
      let nextCalls = 0;
      const next = () => {
        nextCalls++;
      };

      const mw = authorize('admin');
      mw(req, res, next);

      assert.equal(nextCalls, 1);
      assert.equal(res.statusCode, null);
    });

    test('8. Customer rejected on owner-only route with HTTP 403', () => {
      const req = { user: { id: 'c1', role: 'customer' } };
      const res = createMockRes();
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const mw = authorize('owner');
      mw(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.success, false);
      assert.equal(res.jsonData.error.message, 'Forbidden: insufficient permissions');
      assert.equal(nextCalled, false);
    });

    test('9. Owner rejected on admin-only route with HTTP 403', () => {
      const req = { user: { id: 'o1', role: 'owner' } };
      const res = createMockRes();
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const mw = authorize('admin');
      mw(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.success, false);
      assert.equal(res.jsonData.error.message, 'Forbidden: insufficient permissions');
      assert.equal(nextCalled, false);
    });

    test('10. Multiple allowed roles work correctly (both spread and array arguments)', () => {
      // Tested via spread: authorize('owner', 'admin')
      const mwSpread = authorize('owner', 'admin');

      // Tested via array: authorize(['owner', 'admin'])
      const mwArray = authorize(['owner', 'admin']);

      for (const mw of [mwSpread, mwArray]) {
        // Owner permitted
        let nextOwner = 0;
        mw({ user: { id: 'o1', role: 'owner' } }, createMockRes(), () => nextOwner++);
        assert.equal(nextOwner, 1);

        // Admin permitted
        let nextAdmin = 0;
        mw({ user: { id: 'a1', role: 'admin' } }, createMockRes(), () => nextAdmin++);
        assert.equal(nextAdmin, 1);

        // Customer rejected
        const resCust = createMockRes();
        let nextCust = 0;
        mw({ user: { id: 'c1', role: 'customer' } }, resCust, () => nextCust++);
        assert.equal(nextCust, 0);
        assert.equal(resCust.statusCode, 403);
      }
    });

    test('11. Empty permitted-role configuration fails safely (closed)', () => {
      const emptyMws = [authorize(), authorize([]), authorize('', null)];

      for (const mw of emptyMws) {
        for (const role of VALID_ROLES) {
          const res = createMockRes();
          let nextCalled = false;
          mw({ user: { id: 'u1', role } }, res, () => {
            nextCalled = true;
          });

          assert.equal(res.statusCode, 403, 'Empty configuration must fail closed');
          assert.equal(nextCalled, false);
        }
      }
    });

    test('12. Invalid configured roles fail safely without allowing access', () => {
      const mw = authorize('unrecognized_role', 'non_existent');
      const res = createMockRes();
      let nextCalled = false;

      mw({ user: { id: 'admin1', role: 'admin' } }, res, () => {
        nextCalled = true;
      });

      assert.equal(res.statusCode, 403);
      assert.equal(nextCalled, false);
    });

    test('13. Case-sensitive role matching strictly enforced', () => {
      const mw = authorize('admin');

      const casingMismatches = ['Admin', 'ADMIN', 'aDmin', ' admin', 'admin '];
      for (const role of casingMismatches) {
        const res = createMockRes();
        let nextCalled = false;
        mw({ user: { id: 'u1', role } }, res, () => {
          nextCalled = true;
        });

        assert.equal(res.statusCode, 403, `Case mismatch "${role}" must be rejected`);
        assert.equal(nextCalled, false);
      }
    });

    test('14. Client-supplied role in body/query/headers cannot override req.user', () => {
      const mw = authorize('admin');

      // Attacker sends body.role = 'admin', query.role = 'admin', headers['x-role'] = 'admin'
      // but verified req.user.role is 'customer'
      const req = {
        user: { id: 'c1', role: 'customer' },
        body: { role: 'admin' },
        query: { role: 'admin' },
        params: { role: 'admin' },
        headers: { 'x-role': 'admin', 'x-user-role': 'admin' },
      };
      const res = createMockRes();
      let nextCalled = false;

      mw(req, res, () => {
        nextCalled = true;
      });

      assert.equal(res.statusCode, 403, 'Client parameters must never influence authorization');
      assert.equal(nextCalled, false);
    });

    test('15. Successful authorization calls next() exactly once', () => {
      const mw = authorize('customer');
      let calls = 0;
      mw({ user: { id: 'c1', role: 'customer' } }, createMockRes(), () => calls++);
      assert.equal(calls, 1);
    });

    test('16. Rejected authorization never calls next()', () => {
      const mw = authorize('admin');
      let calls = 0;
      mw({ user: { id: 'c1', role: 'customer' } }, createMockRes(), () => calls++);
      assert.equal(calls, 0);
    });
  });

  describe('Integration with HTTP Server & Middleware Pipeline (authenticate + authorize)', () => {
    let server;
    let baseUrl;
    const createdUserIds = [];
    const testRunId = Date.now();

    const customerEmail = `authz_cust_${testRunId}@example.com`;
    const ownerEmail = `authz_owner_${testRunId}@example.com`;
    const adminEmail = `authz_admin_${testRunId}@example.com`;
    const testPassword = 'SecurePassword123!';

    let customerToken;
    let ownerToken;
    let adminToken;

    before(async () => {
      const adminPb = await getAdminClient();

      // Create test users
      const custRecord = await adminPb.collection('users').create({
        name: 'Test Customer',
        email: customerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      });
      createdUserIds.push(custRecord.id);

      const ownerRecord = await adminPb.collection('users').create({
        name: 'Test Owner',
        email: ownerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'owner',
      });
      createdUserIds.push(ownerRecord.id);

      const adminRecord = await adminPb.collection('users').create({
        name: 'Test Admin',
        email: adminEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'admin',
      });
      createdUserIds.push(adminRecord.id);

      // Authenticate to get live tokens
      const loginPb = new PocketBase(env.POCKETBASE_URL);

      const custAuth = await loginPb.collection('users').authWithPassword(customerEmail, testPassword);
      customerToken = custAuth.token;

      const ownerAuth = await loginPb.collection('users').authWithPassword(ownerEmail, testPassword);
      ownerToken = ownerAuth.token;

      const adminAuth = await loginPb.collection('users').authWithPassword(adminEmail, testPassword);
      adminToken = adminAuth.token;

      // Build ephemeral Express app demonstrating correct middleware ordering
      const app = express();
      app.use(cookieParser());
      app.use(express.json());

      // Customer-only endpoint
      app.get('/api/test/customer-only', authenticate, authorize('customer'), (req, res) => {
        res.status(200).json({ success: true, message: 'Welcome customer', role: req.user.role });
      });

      // Owner-only endpoint
      app.get('/api/test/owner-only', authenticate, authorize('owner'), (req, res) => {
        res.status(200).json({ success: true, message: 'Welcome owner', role: req.user.role });
      });

      // Admin-only endpoint
      app.get('/api/test/admin-only', authenticate, authorize('admin'), (req, res) => {
        res.status(200).json({ success: true, message: 'Welcome admin', role: req.user.role });
      });

      // Multi-role endpoint (owner or admin)
      app.get('/api/test/owner-or-admin', authenticate, authorize('owner', 'admin'), (req, res) => {
        res.status(200).json({ success: true, message: 'Welcome privileged user', role: req.user.role });
      });

      // Endpoint testing attempt to bypass authenticate
      app.get('/api/test/unauthenticated-guard', authorize('admin'), (req, res) => {
        res.status(200).json({ success: true });
      });

      // Start server
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

      try {
        const adminPb = await getAdminClient();
        for (const id of createdUserIds) {
          try {
            await adminPb.collection('users').delete(id);
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        console.warn('Test cleanup warning:', err.message);
      }
    });

    async function makeRequest(path, token = null, extraHeaders = {}) {
      const headers = { ...extraHeaders };
      if (token) {
        headers['Cookie'] = `${AUTH_COOKIE_NAME}=${token}`;
      }
      const res = await fetch(`${baseUrl}${path}`, { headers });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data };
    }

    test('17. Authentication followed by authorization produces correct 401 vs 403 behavior', async () => {
      // 1. Missing cookie -> 401 from authenticate
      const noAuthRes = await makeRequest('/api/test/owner-only');
      assert.equal(noAuthRes.status, 401);
      assert.equal(noAuthRes.data.error.message, 'Authentication required');

      // 2. Customer token on owner-only route -> 403 from authorize
      const custRes = await makeRequest('/api/test/owner-only', customerToken);
      assert.equal(custRes.status, 403);
      assert.equal(custRes.data.error.message, 'Forbidden: insufficient permissions');

      // 3. Owner token on owner-only route -> 200 OK
      const ownerRes = await makeRequest('/api/test/owner-only', ownerToken);
      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.data.success, true);
      assert.equal(ownerRes.data.role, 'owner');

      // 4. Admin token on owner-only route -> 403 (owner-only means owner only)
      const adminOnOwnerRes = await makeRequest('/api/test/owner-only', adminToken);
      assert.equal(adminOnOwnerRes.status, 403);

      // 5. Admin token on admin-only route -> 200 OK
      const adminRes = await makeRequest('/api/test/admin-only', adminToken);
      assert.equal(adminRes.status, 200);
      assert.equal(adminRes.data.role, 'admin');

      // 6. Owner on admin route -> 403
      const ownerOnAdminRes = await makeRequest('/api/test/admin-only', ownerToken);
      assert.equal(ownerOnAdminRes.status, 403);

      // 7. Multi-role endpoint (owner or admin):
      // Customer -> 403
      const custMulti = await makeRequest('/api/test/owner-or-admin', customerToken);
      assert.equal(custMulti.status, 403);
      // Owner -> 200
      const ownerMulti = await makeRequest('/api/test/owner-or-admin', ownerToken);
      assert.equal(ownerMulti.status, 200);
      // Admin -> 200
      const adminMulti = await makeRequest('/api/test/owner-or-admin', adminToken);
      assert.equal(adminMulti.status, 200);

      // 8. Unauthenticated guard (if developer forgot authenticate) -> 401
      const unauthRes = await makeRequest('/api/test/unauthenticated-guard');
      assert.equal(unauthRes.status, 401);
    });
  });
});

