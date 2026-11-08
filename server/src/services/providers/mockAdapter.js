import crypto from 'node:crypto';
import { PaymentProviderAdapter } from './paymentProviderAdapter.js';

/**
 * Constant-time string comparison preventing timing side-channel attacks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Deterministic Mock Payment Adapter for local testing and CI environments.
 */
export class MockPaymentAdapter extends PaymentProviderAdapter {
  constructor(options = {}) {
    super('mock');
    this.secretKey = options.secretKey || 'mock_secret_key_shopfinder_test';
    this.mode = options.mode || 'normal';
    this.redirectBaseUrl = options.redirectBaseUrl || 'https://mock-gateway.shopfinder.local/checkout';
  }

  /**
   * Adjust test behavior mode.
   * @param {'normal' | 'failure' | 'malformed_initiate' | 'malformed_verify' | 'throw_initiate' | 'throw_verify'} mode
   */
  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Generates HMAC-SHA256 signature for test webhook payloads.
   *
   * @param {string|Buffer} rawBody
   * @returns {string} Hex signature
   */
  computeSignature(rawBody) {
    const data = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    return crypto.createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  /**
   * Initiates simulated payment session.
   */
  async initiatePayment(params) {
    if (this.mode === 'throw_initiate') {
      throw new Error('Simulated mock gateway connection error');
    }

    if (this.mode === 'malformed_initiate') {
      // Incomplete payload: missing redirectUrl and providerRef
      return {
        provider: this.name,
      };
    }

    if (this.mode === 'failure') {
      throw new Error('Mock payment initiation rejected by provider');
    }

    const providerRef = `MOCK_TXN_${params.transactionId || Date.now()}`;
    const redirectUrl = `${this.redirectBaseUrl}?ref=${providerRef}&amount=${params.amount}&currency=${params.currency || 'BDT'}`;

    return {
      provider: this.name,
      providerRef,
      redirectUrl,
      raw: {
        simulated: true,
        transactionId: params.transactionId,
      },
    };
  }

  /**
   * Verifies simulated payment webhook or IPN.
   */
  async verifyPayment(params = {}) {
    if (this.mode === 'throw_verify') {
      throw new Error('Simulated verification service failure');
    }

    if (this.mode === 'malformed_verify') {
      // Incomplete verification response
      return {
        provider: this.name,
      };
    }

    const { payload = {}, rawBody, headers = {} } = params;

    // If signature header and rawBody are provided, perform cryptographic verification
    const receivedSignature = headers['x-mock-signature'] || headers['X-Mock-Signature'];
    if (receivedSignature && rawBody) {
      const expectedSignature = this.computeSignature(rawBody);
      const isSignatureValid = timingSafeCompare(receivedSignature, expectedSignature);

      if (!isSignatureValid) {
        return {
          isValid: false,
          provider: this.name,
          providerRef: payload.providerRef || payload.tran_id || 'UNKNOWN',
          status: 'failed',
          error: 'Cryptographic signature verification failed',
        };
      }
    }

    // Check for explicit failure simulation
    if (this.mode === 'failure' || payload.simulateFailure || payload.status === 'FAILED') {
      return {
        isValid: true,
        provider: this.name,
        providerRef: payload.providerRef || payload.tran_id || `MOCK_TXN_${Date.now()}`,
        status: 'failed',
        amount: Number(payload.amount) || 0,
        currency: payload.currency || 'BDT',
        error: payload.errorMessage || 'Mock transaction reported as failed',
        transactionTime: new Date().toISOString(),
      };
    }

    const providerRef = payload.providerRef || payload.tran_id || `MOCK_TXN_${Date.now()}`;
    const amount = Number(payload.amount) || 0;
    const currency = payload.currency || 'BDT';

    return {
      isValid: true,
      provider: this.name,
      providerRef,
      status: payload.status || 'success',
      amount,
      currency,
      transactionTime: payload.transactionTime || new Date().toISOString(),
      raw: {
        simulated: true,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}
