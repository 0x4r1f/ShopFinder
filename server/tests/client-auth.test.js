import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { getAdminClient } from '../src/config/pocketbase.js';
import * as authService from '../../client/src/services/authService.js';
import { apiRequest, ApiError, setApiBaseUrl, getApiBaseUrl } from '../../client/src/services/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Frontend Auth Service & Security Integration (Task 3.7)', () => {
  let server;
  let testPort;
  const createdUserIds = [];
  const testRunId = Date.now();

  const customerEmail = `client_cust_${testRunId}@example.com`;
  const ownerEmail = `client_owner_${testRunId}@example.com`;
  const testPassword = 'SecurePassword123!';

  let previousBaseUrl;

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        testPort = server.address().port;
        resolve();
      });
    });

    previousBaseUrl = getApiBaseUrl();
    setApiBaseUrl(`http://127.0.0.1:${testPort}`);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (previousBaseUrl) {
      setApiBaseUrl(previousBaseUrl);
    }

    // Clean up created users in PocketBase
    try {
      const adminPb = await getAdminClient();
      for (const id of createdUserIds) {
        try {
          await adminPb.collection('users').delete(id);
        } catch {
          // Ignore
        }
      }

      // Defensive cleanup for any records matching testRunId
      try {
        const remaining = await adminPb.collection('users').getFullList({
          filter: `email ~ "${testRunId}"`,
        });
        for (const u of remaining) {
          try {
            await adminPb.collection('users').delete(u.id);
          } catch {
            // Ignore
          }
        }
      } catch {
        // Ignore
      }
    } catch (err) {
      console.warn('Test cleanup error:', err.message);
    }
  });

  test('1. Security audit: Zero token storage in browser storage or client scripts', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'services/api.js'),
      path.join(clientSrcDir, 'services/authService.js'),
      path.join(clientSrcDir, 'context/AuthContext.jsx'),
      path.join(clientSrcDir, 'components/ProtectedRoute.jsx'),
      path.join(clientSrcDir, 'App.jsx'),
      path.join(clientSrcDir, 'main.jsx'),
    ];

    for (const filePath of filesToAudit) {
      const content = fs.readFileSync(filePath, 'utf8');
      // Strip comments before checking for executable token storage calls
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.ok(!codeWithoutComments.includes('localStorage'), `Forbidden localStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('sessionStorage'), `Forbidden sessionStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('indexedDB'), `Forbidden indexedDB call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('document.cookie'), `Forbidden document.cookie call in ${filePath}`);
    }
  });

  test('2. Security audit: Zero direct PocketBase access from frontend client', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'services/api.js'),
      path.join(clientSrcDir, 'services/authService.js'),
      path.join(clientSrcDir, 'context/AuthContext.jsx'),
      path.join(clientSrcDir, 'components/ProtectedRoute.jsx'),
      path.join(clientSrcDir, 'App.jsx'),
    ];

    for (const filePath of filesToAudit) {
      const content = fs.readFileSync(filePath, 'utf8');
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.ok(!codeWithoutComments.includes("from 'pocketbase'"), `Direct PocketBase import in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('8090'), `Direct PocketBase port 8090 hardcoded in ${filePath}`);
    }
  });

  test('3. API Service: register() calls Express API with credentials and returns sanitized user', async () => {
    let usedCredentials = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('/api/v1/')) {
        usedCredentials = options?.credentials;
      }
      const opts = {
        ...options,
        headers: {
          Origin: env.CLIENT_URL,
          ...options?.headers,
        },
      };
      return originalFetch(url, opts);
    };

    try {
      const user = await authService.register({
        name: 'Client Test Customer',
        email: customerEmail,
        password: testPassword,
        passwordConfirm: testPassword,
        role: 'customer',
      });

      assert.equal(usedCredentials, 'include', 'apiRequest must mandate credentials: include');
      assert.ok(user);
      assert.equal(user.email, customerEmail);
      assert.equal(user.role, 'customer');
      assert.equal(user.password, undefined);
      assert.equal(user.token, undefined);

      createdUserIds.push(user.id);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('4. API Service: login() sends credentials: include and returns sanitized user', async () => {
    let usedCredentials = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('/api/v1/')) {
        usedCredentials = options?.credentials;
      }
      const opts = {
        ...options,
        headers: {
          Origin: env.CLIENT_URL,
          ...options?.headers,
        },
      };
      return originalFetch(url, opts);
    };

    try {
      const user = await authService.login({
        email: customerEmail,
        password: testPassword,
      });

      assert.equal(usedCredentials, 'include');
      assert.ok(user);
      assert.equal(user.email, customerEmail);
      assert.equal(user.role, 'customer');
      assert.equal(user.token, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('5. API Service: getCurrentUser() throws ApiError with status 401 when unauthenticated', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const opts = {
        ...options,
        headers: {
          Origin: env.CLIENT_URL,
          ...options?.headers,
        },
      };
      return originalFetch(url, opts);
    };

    try {
      await authService.getCurrentUser();
      assert.fail('Should have thrown ApiError on unauthenticated request');
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 401);
      assert.equal(err.message, 'Authentication required');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('6. API Service: updateProfile() updates permitted fields via PATCH', async () => {
    const originalFetch = globalThis.fetch;
    let patchUrl = null;
    let patchMethod = null;
    let patchBody = null;
    let patchCredentials = null;

    globalThis.fetch = async (url, options) => {
      patchUrl = url;
      patchMethod = options?.method;
      patchBody = options?.body;
      patchCredentials = options?.credentials;
      const opts = {
        ...options,
        headers: {
          Origin: env.CLIENT_URL,
          ...options?.headers,
        },
      };
      return originalFetch(url, opts);
    };

    try {
      await authService.updateProfile({ name: 'Owner Updated Name' }).catch(() => {});
      assert.ok(patchUrl.includes('/api/v1/users/me'));
      assert.equal(patchMethod, 'PATCH');
      assert.equal(patchCredentials, 'include');
      assert.equal(JSON.parse(patchBody).name, 'Owner Updated Name');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('7. API Service: logout() executes POST /api/v1/auth/logout with credentials', async () => {
    const originalFetch = globalThis.fetch;
    let logoutUrl = null;
    let logoutMethod = null;
    let logoutCredentials = null;

    globalThis.fetch = async (url, options) => {
      logoutUrl = url;
      logoutMethod = options?.method;
      logoutCredentials = options?.credentials;
      const opts = {
        ...options,
        headers: {
          Origin: env.CLIENT_URL,
          ...options?.headers,
        },
      };
      return originalFetch(url, opts);
    };

    try {
      const result = await authService.logout();
      assert.ok(logoutUrl.includes('/api/v1/auth/logout'));
      assert.equal(logoutMethod, 'POST');
      assert.equal(logoutCredentials, 'include');
      assert.equal(result, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('8. Network error handling: API client transforms connection drop into ApiError (status 0)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };

    try {
      await apiRequest('/api/v1/health');
      assert.fail('Expected network error to be thrown');
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 0);
      assert.ok(err.message.includes('Unable to connect to server'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('9. ProtectedRoute and AuthContext modules declare the required contracts and hooks', () => {
    const authContextContent = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    assert.ok(authContextContent.includes('export const AuthContext = createContext'), 'AuthContext must be created');
    assert.ok(authContextContent.includes('export function AuthProvider'), 'AuthProvider must be exported');
    assert.ok(authContextContent.includes('export function useAuth'), 'useAuth hook must be exported');
    assert.ok(authContextContent.includes('hydrateSession'), 'hydrateSession must be declared');
    assert.ok(authContextContent.includes('isMounted'), 'Effect cleanup pattern must be present');

    const protectedRouteContent = fs.readFileSync(path.join(clientSrcDir, 'components/ProtectedRoute.jsx'), 'utf8');
    assert.ok(protectedRouteContent.includes('export default function ProtectedRoute'), 'ProtectedRoute default export');
    assert.ok(protectedRouteContent.includes('allowedRoles'), 'allowedRoles prop supported');
    assert.ok(protectedRouteContent.includes('loadingFallback'), 'loadingFallback supported');
    assert.ok(protectedRouteContent.includes('useAuth()'), 'ProtectedRoute must consume useAuth()');
    assert.ok(protectedRouteContent.includes('useLocation()'), 'ProtectedRoute must preserve return location');
  });

  test('10. ProtectedRoute component runtime verification across all authentication & role states', async () => {
    const React = (await import('../../client/node_modules/react/index.js')).default;
    const { renderToStaticMarkup } = await import('../../client/node_modules/react-dom/server.node.js');
    const { MemoryRouter } = await import('../../client/node_modules/react-router-dom/dist/index.js');
    const esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // Compile modules in client directory so relative imports resolve
    const authContextCode = esbuild.transformSync(
      fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8'),
      { loader: 'jsx' }
    ).code;
    const tempAuthContextPath = path.join(clientSrcDir, 'context/temp-test-auth-context.js');
    fs.writeFileSync(tempAuthContextPath, authContextCode);

    const protectedRouteCode = esbuild.transformSync(
      fs.readFileSync(path.join(clientSrcDir, 'components/ProtectedRoute.jsx'), 'utf8'),
      { loader: 'jsx' }
    ).code.replace('../context/AuthContext.jsx', '../context/temp-test-auth-context.js');
    const tempProtectedRoutePath = path.join(clientSrcDir, 'components/temp-test-protected-route.js');
    fs.writeFileSync(tempProtectedRoutePath, protectedRouteCode);

    try {
      const { AuthContext } = await import('../../client/src/context/temp-test-auth-context.js');
      const { default: ProtectedRoute } = await import('../../client/src/components/temp-test-protected-route.js');

      // Case A: Loading state must not render protected content
      const loadingHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: true, user: null, isAuthenticated: false, error: null } },
            React.createElement(ProtectedRoute, null, React.createElement('div', null, 'SECRET_DATA'))
          )
        )
      );
      assert.ok(!loadingHtml.includes('SECRET_DATA'), 'Loading state must never reveal protected content');
      assert.ok(loadingHtml.includes('Loading session...'), 'Must render loading indicator');

      // Case B: Unauthenticated state redirects and does not render protected content
      const unauthHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: false, user: null, isAuthenticated: false, error: null } },
            React.createElement(ProtectedRoute, null, React.createElement('div', null, 'SECRET_DATA'))
          )
        )
      );
      assert.ok(!unauthHtml.includes('SECRET_DATA'), 'Unauthenticated user must never see protected content');

      // Case C: Temporary backend outage / network error shows service unavailable without redirecting to login
      const outageHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: false, user: null, isAuthenticated: false, error: 'Database connection failed' } },
            React.createElement(ProtectedRoute, null, React.createElement('div', null, 'SECRET_DATA'))
          )
        )
      );
      assert.ok(!outageHtml.includes('SECRET_DATA'));
      assert.ok(outageHtml.includes('Service Temporarily Unavailable'));
      assert.ok(outageHtml.includes('Database connection failed'));

      // Case D: Role authorization: Customer denied on Owner/Admin route
      const customerDeniedHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: false, user: { id: 'c1', role: 'customer' }, isAuthenticated: true, error: null } },
            React.createElement(
              ProtectedRoute,
              { allowedRoles: ['owner', 'admin'] },
              React.createElement('div', null, 'OWNER_ONLY_CONTENT')
            )
          )
        )
      );
      assert.ok(!customerDeniedHtml.includes('OWNER_ONLY_CONTENT'), 'Disallowed role must not see protected content');
      assert.ok(customerDeniedHtml.includes('Access Denied'), 'Disallowed role must see Access Denied');

      // Case E: Role authorization: Owner allowed on Owner/Admin route
      const ownerAllowedHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: false, user: { id: 'o1', role: 'owner' }, isAuthenticated: true, error: null } },
            React.createElement(
              ProtectedRoute,
              { allowedRoles: ['owner', 'admin'] },
              React.createElement('div', null, 'OWNER_ONLY_CONTENT')
            )
          )
        )
      );
      assert.ok(ownerAllowedHtml.includes('OWNER_ONLY_CONTENT'), 'Permitted owner must see protected content');

      // Case F: Role authorization: Admin allowed on Owner/Admin route
      const adminAllowedHtml = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { loading: false, user: { id: 'a1', role: 'admin' }, isAuthenticated: true, error: null } },
            React.createElement(
              ProtectedRoute,
              { allowedRoles: ['owner', 'admin'] },
              React.createElement('div', null, 'OWNER_ONLY_CONTENT')
            )
          )
        )
      );
      assert.ok(adminAllowedHtml.includes('OWNER_ONLY_CONTENT'), 'Permitted admin must see protected content');
    } finally {
      try {
        fs.unlinkSync(tempAuthContextPath);
      } catch {}
      try {
        fs.unlinkSync(tempProtectedRoutePath);
      } catch {}
    }
  });

  test('11. AuthProvider under React.StrictMode deduplicates initial hydration and handles full lifecycle', async () => {
    class FakeNode {}
    class FakeElement extends FakeNode {}
    class FakeHTMLIFrameElement extends FakeElement {}

    const el = {
      nodeType: 1, tagName: 'DIV', ownerDocument: null,
      addEventListener: () => {}, removeEventListener: () => {},
      appendChild: () => {}, removeChild: () => {},
      setAttribute: () => {}, removeAttribute: () => {}, style: {}
    };
    const doc = {
      nodeType: 9,
      createElement: () => ({ ...el, ownerDocument: doc }),
      createElementNS: () => ({ ...el, ownerDocument: doc }),
      createTextNode: () => ({ nodeType: 3 }),
      createComment: () => ({ nodeType: 8 }),
      addEventListener: () => {}, removeEventListener: () => {}
    };
    el.ownerDocument = doc;
    doc.defaultView = { HTMLIFrameElement: FakeHTMLIFrameElement, HTMLElement: FakeElement, Node: FakeNode };

    const originalWindow = globalThis.window;
    const originalDoc = globalThis.document;
    const originalHTMLIFrameElement = globalThis.HTMLIFrameElement;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNode = globalThis.Node;

    globalThis.window = {
      document: doc, addEventListener: () => {}, removeEventListener: () => {},
      location: { href: 'http://localhost' },
      HTMLIFrameElement: FakeHTMLIFrameElement, HTMLElement: FakeElement, Node: FakeNode
    };
    globalThis.document = doc;
    globalThis.HTMLIFrameElement = FakeHTMLIFrameElement;
    globalThis.HTMLElement = FakeElement;
    globalThis.Node = FakeNode;

    const React = (await import('../../client/node_modules/react/index.js')).default;
    const { createRoot } = await import('../../client/node_modules/react-dom/client.js');
    const esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    let getCurrentUserCalls = 0;
    globalThis.__strictModeAuthTracker = {
      async getCurrentUser() {
        getCurrentUserCalls++;
        await new Promise((r) => setTimeout(r, 40));
        return { id: 'u_strict', email: 'strictmode@example.com', role: 'customer' };
      }
    };

    const authContextRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8')
      .replace("import * as authService from '../services/authService.js';", 'const authService = globalThis.__strictModeAuthTracker;');

    const authCode = esbuild.transformSync(authContextRaw, { loader: 'jsx' }).code;
    const tempStrictAuthPath = path.join(clientSrcDir, 'context/temp-test-strict-lifecycle.js');
    fs.writeFileSync(tempStrictAuthPath, authCode);

    try {
      const { AuthProvider, useAuth } = await import(`../../client/src/context/temp-test-strict-lifecycle.js?v=${Date.now()}`);

      let capturedAuth = null;
      function Consumer() {
        capturedAuth = useAuth();
        return null;
      }

      const root = createRoot(el);
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(AuthProvider, null, React.createElement(Consumer))
        )
      );

      // Wait for React StrictMode setup -> cleanup -> setup lifecycle and promise completion
      await new Promise((resolve) => setTimeout(resolve, 250));

      // 1. Initial hydration under StrictMode MUST be deduplicated to exactly 1 request
      assert.equal(
        getCurrentUserCalls,
        1,
        `React 18 StrictMode must deduplicate initial hydration to 1 call, but made ${getCurrentUserCalls}`
      );

      // 2. Hydration must complete and loading must resolve to false
      assert.equal(capturedAuth.loading, false, 'Loading must resolve to false after hydration');

      // 3. Final user state must be correct
      assert.ok(capturedAuth.isAuthenticated, 'User should be authenticated');
      assert.equal(capturedAuth.user?.email, 'strictmode@example.com', 'User email must match mock');
      assert.equal(capturedAuth.error, null, 'Error must be null');

      // 4. Explicit refreshSession / hydrateSession execution initiates a fresh call
      await capturedAuth.refreshSession();
      await new Promise((resolve) => setTimeout(resolve, 60));

      assert.equal(getCurrentUserCalls, 2, 'Explicit refreshSession must execute a fresh request (total 2)');
      assert.equal(capturedAuth.loading, false, 'Loading must resolve to false after refresh');
      assert.equal(capturedAuth.user?.email, 'strictmode@example.com');

      // 5. Unmounting does not cause errors or leak state
      root.unmount();
    } finally {
      try {
        fs.unlinkSync(tempStrictAuthPath);
      } catch {}
      delete globalThis.__strictModeAuthTracker;
      globalThis.window = originalWindow;
      globalThis.document = originalDoc;
      globalThis.HTMLIFrameElement = originalHTMLIFrameElement;
      globalThis.HTMLElement = originalHTMLElement;
      globalThis.Node = originalNode;
    }
  });
});
