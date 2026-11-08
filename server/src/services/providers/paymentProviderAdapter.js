/**
 * ShopFinder — Payment Provider Adapter Base Contract
 *
 * Defines the contract that every payment provider adapter (SSLCommerz,
 * bKash, Stripe, Mock) must implement to plug into the paymentService.
 */

export class PaymentProviderAdapter {
  /**
   * @param {string} name - Unique identifier for the provider (e.g. 'sslcommerz', 'mock')
   */
  constructor(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('PaymentProviderAdapter must be initialized with a non-empty name string');
    }
    this._name = name.trim().toLowerCase();
  }

  /**
   * Provider identifier.
   * @returns {string}
   */
  get name() {
    return this._name;
  }

  /**
   * Initiates a payment session with the provider.
   *
   * @param {Object} params
   * @param {string} params.transactionId - Internal transaction ID / reference
   * @param {number} params.amount - Total payment amount in transaction currency
   * @param {string} params.currency - ISO currency code (e.g. 'BDT')
   * @param {Object} [params.customer] - Customer metadata ({ id, name, email })
   * @param {Object} [params.plan] - Plan metadata ({ id, name, price, credits })
   * @param {Object} [params.redirectUrls] - Return URLs ({ successUrl, failUrl, cancelUrl })
   * @returns {Promise<{
   *   provider: string,
   *   providerRef: string,
   *   redirectUrl: string,
   *   raw?: any
   * }>}
   */
  async initiatePayment(params) { // eslint-disable-line no-unused-vars
    throw new Error(`initiatePayment() must be implemented by adapter [${this._name}]`);
  }

  /**
   * Cryptographically verifies and normalizes provider webhook / IPN payment data.
   *
   * @param {Object} params
   * @param {Object|Buffer|string} params.payload - Parsed or raw payload
   * @param {Buffer|string} [params.rawBody] - Unparsed raw request body buffer for signature calculation
   * @param {Record<string, string>} [params.headers] - Request headers containing signature/digest
   * @param {Record<string, any>} [params.query] - Query parameters if callback was GET/query
   * @returns {Promise<{
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
  async verifyPayment(params) { // eslint-disable-line no-unused-vars
    throw new Error(`verifyPayment() must be implemented by adapter [${this._name}]`);
  }
}

