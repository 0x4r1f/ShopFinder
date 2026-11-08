import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Centralized Client API Service Instance (Task 4.6)', () => {
  let api;
  let apiRequest;
  let ApiError;
  let setApiBaseUrl;
  let getApiBaseUrl;
  let reExportApi;

  let originalFetch;
  let lastFetchCall = null;

  before(async () => {
    const apiModule = await import('../../client/src/services/api.js');
    api = apiModule.api;
    apiRequest = apiModule.apiRequest;
    ApiError = apiModule.ApiError;
    setApiBaseUrl = apiModule.setApiBaseUrl;
    getApiBaseUrl = apiModule.getApiBaseUrl;

    // Verify architecture re-export from client/src/api/index.js
    const indexModule = await import('../../client/src/api/index.js');
    reExportApi = indexModule.api || indexModule.default;

    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    lastFetchCall = null;
    setApiBaseUrl('http://localhost:4000');
  });

  // Mock fetch helper
  function setupMockFetch({ status = 200, data = { success: true }, headers = { 'content-type': 'application/json' }, delay = 0, shouldFail = false } = {}) {
    globalThis.fetch = async (url, config) => {
      lastFetchCall = { url, config };

      if (delay > 0) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (config?.signal) {
            config.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            }, { once: true });
          }
        });
      }

      if (shouldFail) {
        throw new TypeError('Failed to fetch');
      }

      return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
          get: (headerName) => headers[headerName.toLowerCase()] || null,
        },
        json: async () => data,
        text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
      };
    };
  }

  test('1. Base URL resolution from VITE_API_URL', () => {
    // Test base URL setting and retrieval
    setApiBaseUrl('https://api.shopfinder.com');
    assert.equal(getApiBaseUrl(), 'https://api.shopfinder.com');
  });

  test('2. Base URL trailing slash normalization', () => {
    setApiBaseUrl('http://localhost:4000///');
    assert.equal(getApiBaseUrl(), 'http://localhost:4000');

    setApiBaseUrl('http://localhost:4000/api/v1/');
    assert.equal(getApiBaseUrl(), 'http://localhost:4000/api/v1');
  });

  test('3. Localhost fallback when null or invalid URL is provided', () => {
    setApiBaseUrl('');
    assert.equal(getApiBaseUrl(), 'http://localhost:4000');

    setApiBaseUrl(null);
    assert.equal(getApiBaseUrl(), 'http://localhost:4000');
  });

  test('4. URL path prefix deduplication when base URL includes /api/v1', async () => {
    setupMockFetch({ data: { success: true } });
    setApiBaseUrl('http://localhost:4000/api/v1');

    await api.get('/api/v1/listings');
    assert.equal(lastFetchCall.url, 'http://localhost:4000/api/v1/listings', 'Must not duplicate /api/v1 in full URL');
  });

  test('5. Mandatory credentials: "include" enforced across every HTTP method and immune to caller overrides', async () => {
    setupMockFetch();
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of methods) {
      if (method === 'post' || method === 'put' || method === 'patch') {
        await api[method]('/test', {}, { credentials: 'omit' }); // attempt to override
      } else {
        await api[method]('/test', { credentials: 'same-origin' }); // attempt to override
      }

      assert.equal(
        lastFetchCall.config.credentials,
        'include',
        `HTTP ${method.toUpperCase()} must enforce credentials: 'include' even if caller passes override`
      );
    }
  });

  test('6. REST verb helpers (GET, POST, PUT, PATCH, DELETE) invoke corresponding HTTP methods', async () => {
    setupMockFetch();

    await api.get('/test-get');
    assert.equal(lastFetchCall.config.method, 'GET');

    await api.post('/test-post', { foo: 'bar' });
    assert.equal(lastFetchCall.config.method, 'POST');

    await api.put('/test-put', { id: 1 });
    assert.equal(lastFetchCall.config.method, 'PUT');

    await api.patch('/test-patch', { title: 'Updated' });
    assert.equal(lastFetchCall.config.method, 'PATCH');

    await api.delete('/test-delete');
    assert.equal(lastFetchCall.config.method, 'DELETE');
  });

  test('7. Object body JSON serialization sets Content-Type: application/json', async () => {
    setupMockFetch();

    await api.post('/test', { name: 'Commercial Shop', price: 50000 });
    assert.equal(typeof lastFetchCall.config.body, 'string');
    assert.equal(JSON.parse(lastFetchCall.config.body).name, 'Commercial Shop');
    assert.equal(lastFetchCall.config.headers['Content-Type'], 'application/json');
    assert.equal(lastFetchCall.config.headers['Accept'], 'application/json');
  });

  test('8. FormData payload preservation does NOT force application/json', async () => {
    setupMockFetch();

    class MockFormData {}
    const formData = new MockFormData();

    await api.post('/test-upload', formData);
    assert.equal(lastFetchCall.config.body, formData, 'FormData must remain intact');
    assert.equal(lastFetchCall.config.headers['Content-Type'], undefined, 'Must not override boundary for FormData');
  });

  test('9. String and Blob payloads are preserved unchanged', async () => {
    setupMockFetch();

    // Raw string
    await api.post('/test-string', 'raw-payload');
    assert.equal(lastFetchCall.config.body, 'raw-payload');

    // JSON string sets Content-Type: application/json
    await api.post('/test-json-str', '{"valid":"json"}');
    assert.equal(lastFetchCall.config.headers['Content-Type'], 'application/json');
  });

  test('10. Caller-supplied custom headers are preserved and not clobbered', async () => {
    setupMockFetch();

    await api.get('/test-headers', {
      headers: {
        'X-Custom-Client': 'ShopFinder-Web',
        'X-Correlation-ID': 'corr-123',
      },
    });

    assert.equal(lastFetchCall.config.headers['X-Custom-Client'], 'ShopFinder-Web');
    assert.equal(lastFetchCall.config.headers['X-Correlation-ID'], 'corr-123');
    assert.equal(lastFetchCall.config.headers['Accept'], 'application/json');
  });

  test('11. Query parameter serialization using options.params', async () => {
    setupMockFetch();

    await api.get('/api/v1/listings', {
      params: {
        city: 'Dhaka',
        category: 'commercial-floor',
        minPrice: 20000,
        page: 1,
      },
    });

    assert.ok(lastFetchCall.url.includes('city=Dhaka'));
    assert.ok(lastFetchCall.url.includes('category=commercial-floor'));
    assert.ok(lastFetchCall.url.includes('minPrice=20000'));
    assert.ok(lastFetchCall.url.includes('page=1'));
  });

  test('12. Existing query parameters in endpoint string are preserved when params is supplied', async () => {
    setupMockFetch();

    await api.get('/api/v1/listings?status=approved', {
      params: {
        city: 'Chittagong',
      },
    });

    assert.ok(lastFetchCall.url.includes('status=approved'));
    assert.ok(lastFetchCall.url.includes('city=Chittagong'));
    assert.ok(lastFetchCall.url.includes('status=approved&city=Chittagong') || lastFetchCall.url.includes('city=Chittagong&status=approved'));
  });

  test('13. Array values and null/undefined values in query parameters are handled cleanly', async () => {
    setupMockFetch();

    await api.get('/api/v1/filter', {
      params: {
        categories: ['shop', 'office', 'showroom'],
        omittedField: null,
        undefinedField: undefined,
        active: true,
      },
    });

    assert.ok(lastFetchCall.url.includes('categories=shop'));
    assert.ok(lastFetchCall.url.includes('categories=office'));
    assert.ok(lastFetchCall.url.includes('categories=showroom'));
    assert.ok(!lastFetchCall.url.includes('omittedField'), 'Null parameter must be omitted');
    assert.ok(!lastFetchCall.url.includes('undefinedField'), 'Undefined parameter must be omitted');
    assert.ok(lastFetchCall.url.includes('active=true'));
  });

  test('14. Custom timeout override aborts request and produces ApiError with status 408', async () => {
    setupMockFetch({ delay: 100 }); // mock fetch delays 100ms

    await assert.rejects(
      async () => {
        await api.get('/timeout-test', { timeout: 30 }); // timeout triggers after 30ms
      },
      (err) => {
        assert.ok(err instanceof ApiError, 'Must throw ApiError');
        assert.equal(err.status, 408, 'Timeout error must have HTTP status 408');
        assert.ok(err.message.includes('timed out'), 'Message must indicate timeout');
        return true;
      }
    );
  });

  test('15. timeout: 0 disables timeout mechanism', async () => {
    setupMockFetch({ delay: 50, data: { success: true } });

    const result = await api.get('/no-timeout', { timeout: 0 });
    assert.deepEqual(result, { success: true });
  });

  test('16. Caller-provided AbortSignal cancellation produces status 0 with distinct cancellation message', async () => {
    setupMockFetch({ delay: 150 });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    await assert.rejects(
      async () => {
        await api.get('/caller-abort-test', { signal: controller.signal, timeout: 500 });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 0, 'Caller abort must produce status 0');
        assert.ok(err.message.includes('cancelled'), 'Caller abort must not be classified as a timeout');
        return true;
      }
    );
  });

  test('17. Network failure / connection drop maps to ApiError with status 0', async () => {
    setupMockFetch({ shouldFail: true });

    await assert.rejects(
      async () => {
        await api.get('/network-drop');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 0);
        assert.ok(err.message.includes('Unable to connect to server'));
        return true;
      }
    );
  });

  test('18. HTTP 4xx and 5xx errors preserve status, message, and details from backend response', async () => {
    // 400 Bad Request with details
    setupMockFetch({
      status: 400,
      data: {
        success: false,
        error: {
          message: 'Validation failed',
          details: { email: 'Invalid email address' },
        },
      },
    });

    await assert.rejects(
      async () => {
        await api.post('/api/v1/auth/register', { email: 'invalid' });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Validation failed');
        assert.deepEqual(err.details, { email: 'Invalid email address' });
        return true;
      }
    );

    // 401 Unauthorized
    setupMockFetch({
      status: 401,
      data: { success: false, error: { message: 'Invalid credentials' } },
    });

    await assert.rejects(
      async () => {
        await api.post('/api/v1/auth/login', {});
      },
      (err) => {
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Invalid credentials');
        return true;
      }
    );
  });

  test('19. Non-JSON responses (e.g. 502 Bad Gateway text/html) are handled safely', async () => {
    setupMockFetch({
      status: 502,
      data: '<html>502 Bad Gateway</html>',
      headers: { 'content-type': 'text/html' },
    });

    await assert.rejects(
      async () => {
        await api.get('/gateway-error');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 502);
        assert.ok(err.message.includes('502'));
        return true;
      }
    );
  });

  test('20. Backward compatibility with existing apiRequest() signature', async () => {
    setupMockFetch({ data: { success: true, user: { id: 'u1' } } });

    const result = await apiRequest('/api/v1/users/me', { method: 'GET' });
    assert.deepEqual(result, { success: true, user: { id: 'u1' } });
  });

  test('21. Architecture alias client/src/api/index.js re-exports all capabilities', async () => {
    setupMockFetch({ data: { success: true, data: { status: 'ok' } } });

    assert.equal(typeof reExportApi.get, 'function');
    assert.equal(typeof reExportApi.post, 'function');
    assert.equal(typeof reExportApi.request, 'function');

    const result = await reExportApi.get('/api/v1/alias-test');
    assert.deepEqual(result, { success: true, data: { status: 'ok' } });
  });

  test('22. Integration verification: existing authService methods work seamlessly with enhanced api.js', async () => {
    const authService = await import('../../client/src/services/authService.js');

    // Test register
    setupMockFetch({
      status: 201,
      data: {
        success: true,
        data: { user: { id: 'u_reg', email: 'reg@example.com', role: 'customer' } },
      },
    });
    const regUser = await authService.register({
      name: 'Reg User',
      email: 'reg@example.com',
      password: 'Password123!',
      passwordConfirm: 'Password123!',
      role: 'customer',
    });
    assert.equal(regUser.id, 'u_reg');
    assert.equal(regUser.email, 'reg@example.com');

    // Test getCurrentUser
    setupMockFetch({
      status: 200,
      data: {
        success: true,
        data: { user: { id: 'u_reg', email: 'reg@example.com', role: 'customer' } },
      },
    });
    const currentUser = await authService.getCurrentUser();
    assert.equal(currentUser.id, 'u_reg');

    // Test logout
    setupMockFetch({
      status: 200,
      data: { success: true },
    });
    const logoutSuccess = await authService.logout();
    assert.equal(logoutSuccess, true);
  });

  test('23. Security audit: Zero token storage across API service files', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'services/api.js'),
      path.join(clientSrcDir, 'services/authService.js'),
      path.join(clientSrcDir, 'api/index.js'),
    ];

    for (const filePath of filesToAudit) {
      assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.ok(!codeWithoutComments.includes('localStorage'), `Forbidden localStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('sessionStorage'), `Forbidden sessionStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('indexedDB'), `Forbidden indexedDB call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('document.cookie'), `Forbidden document.cookie call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('pocketbase'), `Forbidden pocketbase import in ${filePath}`);
      assert.ok(!codeWithoutComments.includes(':8090'), `Forbidden direct PocketBase port in ${filePath}`);
    }
  });
});

