/**
 * ShopFinder — Centralized Client API Service Instance (Task 4.6)
 *
 * Communicates exclusively with the Express backend REST API.
 * Never stores authentication tokens in browser web storage or client-accessible cookies.
 * Relies strictly on server-set httpOnly cookies (pb_auth) via mandatory credentials: 'include' (D-007, D-010).
 *
 * Provides standardized URL resolution, REST verb helpers, automatic JSON serialization,
 * FormData/Blob preservation, query parameter formatting, timeout management, and structured error handling.
 */

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Normalizes a base URL by trimming whitespace and removing trailing slashes.
 *
 * @param {string} url
 * @returns {string}
 */
function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'http://localhost:4000';
  }
  return url.trim().replace(/\/+$/, '');
}

/**
 * Resolves the initial API base URL from Vite or Node environment variables.
 * Prioritizes VITE_API_URL, then VITE_API_BASE_URL, defaulting to http://localhost:4000.
 *
 * @returns {string}
 */
function resolveInitialBaseUrl() {
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};

  const candidate =
    metaEnv.VITE_API_URL ||
    metaEnv.VITE_API_BASE_URL ||
    procEnv.VITE_API_URL ||
    procEnv.VITE_API_BASE_URL;

  return normalizeBaseUrl(candidate);
}

let apiBaseUrl = resolveInitialBaseUrl();

/**
 * Updates the base API URL (useful for runtime config and tests).
 * Automatically normalizes trailing slashes.
 *
 * @param {string} url
 */
export function setApiBaseUrl(url) {
  apiBaseUrl = normalizeBaseUrl(url);
}

/**
 * Returns the currently configured base API URL.
 *
 * @returns {string}
 */
export function getApiBaseUrl() {
  return apiBaseUrl;
}

/**
 * Standardized API error wrapper preserving HTTP status and backend message.
 */
export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Appends query parameters to a URL string using URLSearchParams.
 * Preserves existing query parameters and skips null/undefined values.
 *
 * @param {string} url
 * @param {Object} [params]
 * @returns {string}
 */
function appendQueryParams(url, params) {
  if (!params || typeof params !== 'object') {
    return url;
  }

  const [baseUrl, existingQuery] = url.split('?');
  const searchParams = new URLSearchParams(existingQuery || '');

  for (const [key, val] of Object.entries(params)) {
    if (val === null || val === undefined) {
      continue;
    }

    if (Array.isArray(val)) {
      for (const item of val) {
        if (item !== null && item !== undefined) {
          searchParams.append(key, String(item));
        }
      }
    } else {
      searchParams.set(key, String(val));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Determines whether a value is a plain JavaScript object (not FormData, Blob, Array, etc.).
 *
 * @param {*} val
 * @returns {boolean}
 */
function isPlainObject(val) {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/**
 * Executes an HTTP request to the Express backend.
 *
 * @param {string} endpoint - API path (e.g. '/api/v1/users/me')
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {*} [options.body] - Request payload
 * @param {Object} [options.params] - URL query parameters
 * @param {number} [options.timeout=15000] - Request timeout in ms (0 to disable)
 * @param {AbortSignal} [options.signal] - Optional caller AbortSignal
 * @param {Object} [options.headers] - Additional HTTP headers
 * @returns {Promise<any>} Response payload
 */
export async function apiRequest(endpoint, options = {}) {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If base ends with /api/v1 and path also starts with /api/v1, prevent duplication
  let fullUrl;
  if (base.endsWith('/api/v1') && path.startsWith('/api/v1/')) {
    fullUrl = `${base}${path.slice('/api/v1'.length)}`;
  } else if (base.endsWith('/api/v1') && path === '/api/v1') {
    fullUrl = base;
  } else {
    fullUrl = `${base}${path}`;
  }

  // Append query parameters if provided
  fullUrl = appendQueryParams(fullUrl, options.params);

  // Payload processing: auto-serialize plain objects; preserve strings, FormData, and Blobs
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let processedBody = options.body;
  if (isPlainObject(processedBody)) {
    processedBody = JSON.stringify(processedBody);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (typeof processedBody === 'string') {
    // If body is already a JSON string and no Content-Type was set, add application/json
    if (!headers['Content-Type']) {
      try {
        JSON.parse(processedBody);
        headers['Content-Type'] = 'application/json';
      } catch {
        // Non-JSON string, leave headers untouched
      }
    }
  }

  // Timeout and Cancellation handling
  const timeoutMs = options.timeout !== undefined ? options.timeout : DEFAULT_TIMEOUT_MS;
  const abortController = new AbortController();
  let isTimeout = false;
  let timeoutId = null;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      isTimeout = true;
      abortController.abort();
    }, timeoutMs);
  }

  let callerAbortListener = null;
  if (options.signal) {
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason);
    } else {
      callerAbortListener = () => {
        abortController.abort(options.signal.reason);
      };
      options.signal.addEventListener('abort', callerAbortListener, { once: true });
    }
  }

  const config = {
    ...options,
    method: options.method || 'GET',
    body: processedBody,
    headers,
    signal: abortController.signal,
    credentials: 'include', // Security invariant: always send httpOnly cookies (D-010)
  };

  let response;
  try {
    response = await fetch(fullUrl, config);
  } catch (err) {
    if (isTimeout) {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    if (options.signal && options.signal.aborted) {
      throw new ApiError('Request was cancelled.', 0);
    }
    throw new ApiError('Unable to connect to server. Please check your network connection.', 0);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (options.signal && callerAbortListener) {
      options.signal.removeEventListener('abort', callerAbortListener);
    }
  }

  // Parse response
  let data = null;
  const contentType = response.headers ? response.headers.get('content-type') : null;
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const errorDetails = data?.error?.details || null;
    throw new ApiError(errorMessage, response.status, errorDetails);
  }

  return data;
}

/**
 * Fluent REST API client instance.
 */
export const api = Object.assign(apiRequest, {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? body : options.body,
    }),
  put: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? body : options.body,
    }),
  patch: (endpoint, body, options = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? body : options.body,
    }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
  request: apiRequest,
  setBaseUrl: setApiBaseUrl,
  getBaseUrl: getApiBaseUrl,
});

export default api;
