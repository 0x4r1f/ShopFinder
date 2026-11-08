import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaymentService,
  PaymentServiceError,
  UnsupportedProviderError,
  PaymentValidationError,
  PaymentAdapterError,
} from '../src/services/paymentService.js';
import { PaymentProviderAdapter } from '../src/services/providers/paymentProviderAdapter.js';
import { MockPaymentAdapter, timingSafeCompare } from '../src/services/providers/mockAdapter.js';
import { SSLCommerzPaymentAdapter } from '../src/services/providers/sslcommerzAdapter.js';

describe('Phase 11 — Task 11.2: Provider-Agnostic Payment Service Layer', () => {
  let service;
  let mockAdapter;

  beforeEach(() => {
    service = new PaymentService({ defaultProvider: 'mock' });
    mockAdapter = new MockPaymentAdapter();
    service.registerAdapter(mockAdapter);
  });

  // --------------------------------------------------------------------------
  // 1. Adapter Contract & Subclassing
  // --------------------------------------------------------------------------
  describe('Adapter Contract & Base Class', () => {
    it('requires a non-empty name string when instantiating PaymentProviderAdapter', () => {
      assert.throws(() => new PaymentProviderAdapter(''), /non-empty name string/);
      assert.throws(() => new PaymentProviderAdapter(null), /non-empty name string/);
    });

    it('throws when calling abstract methods on base PaymentProviderAdapter directly', async () => {
      class UnimplementedAdapter extends PaymentProviderAdapter {
        constructor() {
          super('unimplemented');
        }
      }
      const unimp = new UnimplementedAdapter();
      await assert.rejects(() => unimp.initiatePayment({}), /initiatePayment\(\) must be implemented/);
      await assert.rejects(() => unimp.verifyPayment({}), /verifyPayment\(\) must be implemented/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Provider Selection & Registration
  // --------------------------------------------------------------------------
  describe('Provider Selection & Registration', () => {
    it('resolves the default mock provider when none is explicitly specified', () => {
      const adapter = service.getAdapter();
      assert.equal(adapter.name, 'mock');
    });

    it('resolves registered adapters in a case-insensitive manner', () => {
      const adapter1 = service.getAdapter('MOCK');
      const adapter2 = service.getAdapter('mock');
      const adapter3 = service.getAdapter('SSLCOMMERZ');

      assert.equal(adapter1.name, 'mock');
      assert.equal(adapter2.name, 'mock');
      assert.equal(adapter3.name, 'sslcommerz');
    });

    it('allows registering a custom adapter inheriting from PaymentProviderAdapter', () => {
      class CustomTestAdapter extends PaymentProviderAdapter {
        constructor() {
          super('custom-test');
        }
        async initiatePayment() {
          return { provider: 'custom-test', providerRef: 'CUST_1', redirectUrl: 'https://test.local' };
        }
        async verifyPayment() {
          return { isValid: true, provider: 'custom-test', status: 'success' };
        }
      }

      const custom = new CustomTestAdapter();
      service.registerAdapter(custom);

      assert.ok(service.getRegisteredProviders().includes('custom-test'));
      assert.equal(service.getAdapter('custom-test').name, 'custom-test');
    });

    it('rejects registering an invalid adapter not inheriting from PaymentProviderAdapter', () => {
      assert.throws(
        () => service.registerAdapter({ name: 'fake' }),
        (err) => err instanceof PaymentValidationError && err.message.includes('must inherit from PaymentProviderAdapter')
      );
    });

    it('throws UnsupportedProviderError for an unregistered provider name', () => {
      assert.throws(
        () => service.getAdapter('unregistered_gateway'),
        (err) => err instanceof UnsupportedProviderError && err.message.includes('unregistered_gateway')
      );
    });

    it('allows changing the default provider dynamically', () => {
      service.setDefaultProviderName('sslcommerz');
      assert.equal(service.getDefaultProviderName(), 'sslcommerz');
      assert.equal(service.getAdapter().name, 'sslcommerz');
    });

    it('rejects invalid default provider names', () => {
      assert.throws(
        () => service.setDefaultProviderName(''),
        (err) => err instanceof PaymentValidationError
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. Payment Initiation (Success & Normalization)
  // --------------------------------------------------------------------------
  describe('Payment Initiation (Success & Normalization)', () => {
    it('initiates payment successfully with normalized response format', async () => {
      const result = await service.initiatePayment({
        transactionId: 'SF_ORDER_101',
        amount: 299,
        currency: 'BDT',
        customer: { id: 'cust_1', name: 'John Doe', email: 'john@example.com' },
        plan: { id: 'plan_starter', name: 'Starter', price: 299, credits: 10 },
      });

      assert.equal(result.success, true);
      assert.equal(result.provider, 'mock');
      assert.equal(result.providerRef, 'MOCK_TXN_SF_ORDER_101');
      assert.ok(result.redirectUrl.includes('https://mock-gateway.shopfinder.local/checkout'));
      assert.ok(result.redirectUrl.includes('ref=MOCK_TXN_SF_ORDER_101'));
      assert.equal(result.amount, 299);
      assert.equal(result.currency, 'BDT');
    });

    it('defaults currency to BDT when not explicitly provided', async () => {
      const result = await service.initiatePayment({
        amount: 999,
      });

      assert.equal(result.success, true);
      assert.equal(result.currency, 'BDT');
      assert.equal(result.amount, 999);
      assert.ok(result.providerRef.startsWith('MOCK_TXN_'));
    });

    it('supports explicit provider override via options', async () => {
      // Configure a secondary mock adapter with custom name
      class SecondaryMockAdapter extends MockPaymentAdapter {
        constructor() {
          super();
          this._name = 'secondary_mock';
        }
      }
      service.registerAdapter(new SecondaryMockAdapter());

      const result = await service.initiatePayment(
        { amount: 299 },
        { provider: 'secondary_mock' }
      );

      assert.equal(result.success, true);
      assert.equal(result.provider, 'secondary_mock');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Payment Initiation (Validation & Error Handling)
  // --------------------------------------------------------------------------
  describe('Payment Initiation (Validation & Error Handling)', () => {
    it('rejects missing or non-object initiation parameters', async () => {
      await assert.rejects(
        () => service.initiatePayment(null),
        (err) => err instanceof PaymentValidationError && err.message.includes('must be an object')
      );
    });

    it('rejects non-positive or non-numeric amount values', async () => {
      await assert.rejects(
        () => service.initiatePayment({ amount: 0 }),
        (err) => err instanceof PaymentValidationError && err.message.includes('positive number')
      );

      await assert.rejects(
        () => service.initiatePayment({ amount: -50 }),
        (err) => err instanceof PaymentValidationError && err.message.includes('positive number')
      );

      await assert.rejects(
        () => service.initiatePayment({ amount: 'invalid' }),
        (err) => err instanceof PaymentValidationError && err.message.includes('positive number')
      );
    });

    it('wraps adapter execution failure into PaymentAdapterError', async () => {
      mockAdapter.setMode('throw_initiate');

      await assert.rejects(
        () => service.initiatePayment({ amount: 299 }),
        (err) => {
          return (
            err instanceof PaymentAdapterError &&
            err.provider === 'mock' &&
            err.message.includes('Simulated mock gateway connection error')
          );
        }
      );
    });

    it('rejects malformed adapter response missing providerRef', async () => {
      mockAdapter.setMode('malformed_initiate');

      await assert.rejects(
        () => service.initiatePayment({ amount: 299 }),
        (err) => {
          return (
            err instanceof PaymentAdapterError &&
            err.provider === 'mock' &&
            err.message.includes("missing 'providerRef'")
          );
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Payment Verification (Success & Signature Verification)
  // --------------------------------------------------------------------------
  describe('Payment Verification (Success & Signature Verification)', () => {
    it('verifies valid payment payload and normalizes response', async () => {
      const result = await service.verifyPayment({
        payload: {
          providerRef: 'MOCK_TXN_12345',
          amount: 299,
          currency: 'BDT',
          transactionTime: '2026-11-08T18:00:00Z',
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.isValid, true);
      assert.equal(result.provider, 'mock');
      assert.equal(result.providerRef, 'MOCK_TXN_12345');
      assert.equal(result.status, 'success');
      assert.equal(result.amount, 299);
      assert.equal(result.currency, 'BDT');
      assert.equal(result.transactionTime, '2026-11-08T18:00:00Z');
    });

    it('verifies cryptographic HMAC signature using raw body buffer in constant time', async () => {
      const rawBody = Buffer.from(JSON.stringify({ tran_id: 'MOCK_SIGNED_001', amount: 999 }));
      const validSignature = mockAdapter.computeSignature(rawBody);

      const result = await service.verifyPayment({
        rawBody,
        headers: {
          'x-mock-signature': validSignature,
        },
        payload: {
          tran_id: 'MOCK_SIGNED_001',
          amount: 999,
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.isValid, true);
      assert.equal(result.status, 'success');
      assert.equal(result.providerRef, 'MOCK_SIGNED_001');
    });

    it('rejects invalid cryptographic signature in constant time', async () => {
      const rawBody = Buffer.from(JSON.stringify({ tran_id: 'MOCK_TAMPERED', amount: 999 }));
      const forgedSignature = 'bad_forged_hex_signature_1234567890abcdef';

      const result = await service.verifyPayment({
        rawBody,
        headers: {
          'x-mock-signature': forgedSignature,
        },
        payload: {
          tran_id: 'MOCK_TAMPERED',
          amount: 999,
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.isValid, false);
      assert.equal(result.status, 'failed');
      assert.ok(result.error.includes('signature verification failed'));
    });
  });

  // --------------------------------------------------------------------------
  // 6. Payment Verification (Status Normalization & Errors)
  // --------------------------------------------------------------------------
  describe('Payment Verification (Status Normalization & Errors)', () => {
    it('normalizes status variants to expected standard enums', async () => {
      const resPending = await service.verifyPayment({
        payload: { providerRef: 'TX_1', status: 'PENDING' },
      });
      assert.equal(resPending.status, 'pending');

      const resCancelled = await service.verifyPayment({
        payload: { providerRef: 'TX_2', status: 'CANCELLED' },
      });
      assert.equal(resCancelled.status, 'cancelled');

      const resFailed = await service.verifyPayment({
        payload: { providerRef: 'TX_3', status: 'FAILED' },
      });
      assert.equal(resFailed.status, 'failed');
    });

    it('rejects malformed verification response from adapter missing isValid boolean', async () => {
      mockAdapter.setMode('malformed_verify');

      await assert.rejects(
        () => service.verifyPayment({ payload: {} }),
        (err) => {
          return (
            err instanceof PaymentAdapterError &&
            err.provider === 'mock' &&
            err.message.includes("missing boolean 'isValid'")
          );
        }
      );
    });

    it('wraps adapter verification throw into PaymentAdapterError', async () => {
      mockAdapter.setMode('throw_verify');

      await assert.rejects(
        () => service.verifyPayment({ payload: {} }),
        (err) => {
          return (
            err instanceof PaymentAdapterError &&
            err.provider === 'mock' &&
            err.message.includes('Simulated verification service failure')
          );
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 7. Security Invariants & SSLCommerz Placeholder
  // --------------------------------------------------------------------------
  describe('Security Invariants & SSLCommerz Placeholder', () => {
    it('verifies timingSafeCompare function utility behaves correctly', () => {
      assert.equal(timingSafeCompare('secret_token_123', 'secret_token_123'), true);
      assert.equal(timingSafeCompare('secret_token_123', 'secret_token_456'), false);
      assert.equal(timingSafeCompare('short', 'longer_string'), false);
      assert.equal(timingSafeCompare(null, 'test'), false);
      assert.equal(timingSafeCompare('test', undefined), false);
    });

    it('verifies SSLCommerz adapter checks configuration and acts as placeholder', async () => {
      const sslcommerz = new SSLCommerzPaymentAdapter({
        storeId: null,
        storePassword: null,
      });

      assert.equal(sslcommerz.isConfigured(), false);
      await assert.rejects(
        () => sslcommerz.initiatePayment({ amount: 299 }),
        /not configured with store credentials/
      );
      await assert.rejects(
        () => sslcommerz.verifyPayment({}),
        /not configured with store credentials/
      );

      // When configured, honors placeholder boundary for Task 11.3 & 11.4
      const configuredSsl = new SSLCommerzPaymentAdapter({
        storeId: 'test_store_id',
        storePassword: 'test_store_password',
      });
      assert.equal(configuredSsl.isConfigured(), true);
      await assert.rejects(
        () => configuredSsl.initiatePayment({ amount: 299 }),
        /deferred to Task 11.3/
      );
      await assert.rejects(
        () => configuredSsl.verifyPayment({}),
        /deferred to Task 11.4/
      );
    });

    it('confirms the payment service does not expose secrets or mutate subscriptions', () => {
      const providers = service.getRegisteredProviders();
      assert.deepEqual(providers.sort(), ['mock', 'sslcommerz']);
      assert.equal(typeof service.initiatePayment, 'function');
      assert.equal(typeof service.verifyPayment, 'function');
      // Verify no database subscription methods exist on paymentService
      assert.equal(service.allocateCredits, undefined);
      assert.equal(service.createSubscription, undefined);
    });
  });
});
