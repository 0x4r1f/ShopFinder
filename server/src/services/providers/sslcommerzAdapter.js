import { PaymentProviderAdapter } from './paymentProviderAdapter.js';

/**
 * SSLCommerz Payment Gateway Adapter (Placeholder for Task 11.3 & 11.4)
 *
 * Implements the PaymentProviderAdapter interface for the Bangladesh-focused
 * SSLCommerz hosted checkout and Instant Payment Notification (IPN) webhooks.
 *
 * Live network API calls and production merchant authentication are strictly
 * deferred to Tasks 11.3 and 11.4 per Phase 11 roadmap boundaries.
 */
export class SSLCommerzPaymentAdapter extends PaymentProviderAdapter {
  constructor(options = {}) {
    super('sslcommerz');
    this.storeId = options.storeId || process.env.SSLCOMMERZ_STORE_ID || null;
    this.storePassword = options.storePassword || process.env.SSLCOMMERZ_STORE_PASSWORD || null;
    this.isSandbox = options.isSandbox !== undefined ? options.isSandbox : process.env.NODE_ENV !== 'production';
  }

  /**
   * Checks whether required merchant credentials are present.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.storeId && this.storePassword);
  }

  /**
   * Initiates payment session with SSLCommerz.
   * Full gateway session creation is implemented in Task 11.3.
   */
  async initiatePayment(params) { // eslint-disable-line no-unused-vars
    if (!this.isConfigured()) {
      throw new Error(
        'SSLCommerz adapter is not configured with store credentials (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD)'
      );
    }

    throw new Error('SSLCommerz gateway session initiation is deferred to Task 11.3');
  }

  /**
   * Validates IPN webhook with SSLCommerz.
   * Full signature verification & IPN validation is implemented in Task 11.4.
   */
  async verifyPayment(params) { // eslint-disable-line no-unused-vars
    if (!this.isConfigured()) {
      throw new Error(
        'SSLCommerz adapter is not configured with store credentials (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD)'
      );
    }

    throw new Error('SSLCommerz IPN verification is deferred to Task 11.4');
  }
}

