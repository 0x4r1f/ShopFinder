import { MockPaymentAdapter } from './providers/mockAdapter.js';
import { SSLCommerzPaymentAdapter } from './providers/sslcommerzAdapter.js';
import { PaymentProviderAdapter } from './providers/paymentProviderAdapter.js';

/**
 * Custom Error Classes for Payment Service Operations
 */
export class PaymentServiceError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'PaymentServiceError';
    this.details = details;
  }
}

export class UnsupportedProviderError extends PaymentServiceError {
  constructor(providerName) {
    super(`Unsupported payment provider: '${providerName}'`);
    this.name = 'UnsupportedProviderError';
    this.providerName = providerName;
  }
}

export class PaymentValidationError extends PaymentServiceError {
  constructor(message, details = null) {
    super(message, details);
    this.name = 'PaymentValidationError';
  }
}

export class PaymentAdapterError extends PaymentServiceError {
  constructor(message, provider = null, originalError = null) {
    super(message);
    this.name = 'PaymentAdapterError';
    this.provider = provider;
    this.originalError = originalError ? originalError.message : null;
  }
}

/**
 * Provider-Agnostic Payment Service Layer
 *
 * Orchestrates payment initiation and verification while decoupling
 * core application logic from specific payment gateways (SSLCommerz, bKash, Mock).
 */
export class PaymentService {
  constructor(options = {}) {
    this._adapters = new Map();
    this._defaultProvider = options.defaultProvider || null;

    // Register standard adapters by default
    this.registerAdapter(new MockPaymentAdapter());
    this.registerAdapter(new SSLCommerzPaymentAdapter());
  }

  /**
   * Registers a payment provider adapter.
   *
   * @param {PaymentProviderAdapter} adapter
   */
  registerAdapter(adapter) {
    if (!adapter || !(adapter instanceof PaymentProviderAdapter)) {
      throw new PaymentValidationError('Adapter must inherit from PaymentProviderAdapter');
    }
    this._adapters.set(adapter.name.toLowerCase(), adapter);
  }

  /**
   * Retrieves a registered adapter by provider name.
   *
   * @param {string} [providerName]
   * @returns {PaymentProviderAdapter}
   */
  getAdapter(providerName) {
    const target = (providerName || this.getDefaultProviderName()).toLowerCase();
    const adapter = this._adapters.get(target);

    if (!adapter) {
      throw new UnsupportedProviderError(target);
    }

    return adapter;
  }

  /**
   * Lists all registered provider names.
   * @returns {string[]}
   */
  getRegisteredProviders() {
    return Array.from(this._adapters.keys());
  }

  /**
   * Determines the default payment provider name based on env or configuration.
   * @returns {string}
   */
  getDefaultProviderName() {
    if (this._defaultProvider) {
      return this._defaultProvider.toLowerCase();
    }
    if (process.env.PAYMENT_PROVIDER) {
      return process.env.PAYMENT_PROVIDER.trim().toLowerCase();
    }
    return process.env.NODE_ENV === 'production' ? 'sslcommerz' : 'mock';
  }

  /**
   * Sets the default provider name.
   * @param {string} providerName
   */
  setDefaultProviderName(providerName) {
    if (!providerName || typeof providerName !== 'string') {
      throw new PaymentValidationError('Default provider name must be a non-empty string');
    }
    this._defaultProvider = providerName.trim().toLowerCase();
  }

  /**
   * Initiates payment through the selected adapter.
   *
   * @param {Object} params - Payment initiation parameters
   * @param {number} params.amount - Total payment amount (e.g. 299 or 999)
   * @param {string} [params.currency='BDT'] - ISO currency code
   * @param {string} [params.transactionId] - Internal unique transaction ID
   * @param {Object} [params.customer] - Customer details ({ id, name, email })
   * @param {Object} [params.plan] - Subscription plan ({ id, name, price, credits })
   * @param {Object} [params.redirectUrls] - Callback URLs
   * @param {Object} [options]
   * @param {string} [options.provider] - Explicit provider override
   * @returns {Promise<{
   *   success: boolean,
   *   provider: string,
   *   providerRef: string,
   *   redirectUrl: string,
   *   amount: number,
   *   currency: string,
   *   raw?: any
   * }>}
   */
  async initiatePayment(params = {}, options = {}) {
    // 1. Validate required initiation parameters
    if (!params || typeof params !== 'object') {
      throw new PaymentValidationError('Payment initiation parameters must be an object');
    }

    const amount = Number(params.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new PaymentValidationError('Payment amount must be a positive number');
    }

    const currency = (params.currency || 'BDT').toUpperCase();
    const transactionId = params.transactionId ? String(params.transactionId).trim() : `SF_${Date.now()}`;

    // 2. Resolve adapter
    const adapter = this.getAdapter(options.provider);

    // 3. Delegate to adapter
    let adapterResult;
    try {
      adapterResult = await adapter.initiatePayment({
        ...params,
        amount,
        currency,
        transactionId,
      });
    } catch (err) {
      throw new PaymentAdapterError(
        `Failed to initiate payment with provider '${adapter.name}': ${err.message}`,
        adapter.name,
        err
      );
    }

    // 4. Validate adapter response contract
    if (!adapterResult || typeof adapterResult !== 'object') {
      throw new PaymentAdapterError(
        `Malformed response from payment adapter '${adapter.name}': expected object`,
        adapter.name
      );
    }

    if (!adapterResult.providerRef || typeof adapterResult.providerRef !== 'string') {
      throw new PaymentAdapterError(
        `Incomplete response from payment adapter '${adapter.name}': missing 'providerRef'`,
        adapter.name
      );
    }

    if (!adapterResult.redirectUrl || typeof adapterResult.redirectUrl !== 'string') {
      throw new PaymentAdapterError(
        `Incomplete response from payment adapter '${adapter.name}': missing 'redirectUrl'`,
        adapter.name
      );
    }

    // 5. Return normalized initiation payload
    return {
      success: true,
      provider: adapter.name,
      providerRef: adapterResult.providerRef,
      redirectUrl: adapterResult.redirectUrl,
      amount,
      currency,
      raw: adapterResult.raw || undefined,
    };
  }

  /**
   * Verifies payment verification payload or webhook through the selected adapter.
   *
   * @param {Object} params - Verification parameters
   * @param {Object} [params.payload] - Parsed webhook payload / IPN body
   * @param {Buffer|string} [params.rawBody] - Raw unparsed request body for cryptographic signature checking
   * @param {Record<string, string>} [params.headers] - Request headers containing signature or digest
   * @param {Record<string, any>} [params.query] - Query parameters
   * @param {Object} [options]
   * @param {string} [options.provider] - Explicit provider override
   * @returns {Promise<{
   *   success: boolean,
   *   isValid: boolean,
   *   provider: string,
   *   providerRef: string,
   *   status: 'success' | 'failed' | 'cancelled' | 'pending',
   *   amount?: number,
   *   currency?: string,
   *   transactionTime?: string,
   *   error?: string,
   *   raw?: any
   * }>}
   */
  async verifyPayment(params = {}, options = {}) {
    if (!params || typeof params !== 'object') {
      throw new PaymentValidationError('Payment verification parameters must be an object');
    }

    // Determine target provider
    const targetProvider = options.provider ||
      (params.query && params.query.provider) ||
      (params.headers && (params.headers['x-payment-provider'] || params.headers['X-Payment-Provider'])) ||
      (params.payload && params.payload.provider) ||
      this.getDefaultProviderName();

    const adapter = this.getAdapter(targetProvider);

    let verifyResult;
    try {
      verifyResult = await adapter.verifyPayment(params);
    } catch (err) {
      throw new PaymentAdapterError(
        `Failed to verify payment with provider '${adapter.name}': ${err.message}`,
        adapter.name,
        err
      );
    }

    // Validate adapter verification contract
    if (!verifyResult || typeof verifyResult !== 'object') {
      throw new PaymentAdapterError(
        `Malformed verification response from adapter '${adapter.name}': expected object`,
        adapter.name
      );
    }

    if (typeof verifyResult.isValid !== 'boolean') {
      throw new PaymentAdapterError(
        `Incomplete verification response from adapter '${adapter.name}': missing boolean 'isValid'`,
        adapter.name
      );
    }

    // Normalize status enum
    const rawStatus = String(verifyResult.status || '').toLowerCase();
    let normalizedStatus = 'failed';
    if (rawStatus === 'success' || rawStatus === 'valid' || rawStatus === 'completed') {
      normalizedStatus = 'success';
    } else if (rawStatus === 'pending') {
      normalizedStatus = 'pending';
    } else if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
      normalizedStatus = 'cancelled';
    }

    const providerRef = verifyResult.providerRef ? String(verifyResult.providerRef) : 'UNKNOWN';

    return {
      success: true,
      isValid: verifyResult.isValid,
      provider: adapter.name,
      providerRef,
      status: normalizedStatus,
      amount: typeof verifyResult.amount === 'number' ? verifyResult.amount : undefined,
      currency: verifyResult.currency ? String(verifyResult.currency).toUpperCase() : undefined,
      transactionTime: verifyResult.transactionTime || undefined,
      error: verifyResult.error || undefined,
      raw: verifyResult.raw || undefined,
    };
  }
}

// Export singleton instance as default export and named export
export const paymentService = new PaymentService();
export default paymentService;

