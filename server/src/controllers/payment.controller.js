import { getAdminClient } from '../config/pocketbase.js';
import { paymentService, UnsupportedProviderError } from '../services/paymentService.js';
import { validatePaymentInitiateBody } from '../validators/payment.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Payment Controller (Phase 11, Task 11.3)
 *
 * Implements authenticated customer payment initiation.
 */

/**
 * Generates an internal cryptographically safe unique transaction reference.
 * @returns {string}
 */
export function generateTransactionReference() {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SF_TXN_${timestamp}_${randomPart}`;
}

/**
 * POST /api/v1/payments/initiate
 *
 * Initiates checkout for a subscription plan for the authenticated customer:
 * 1. Validates plan existence and active status against server-side database.
 * 2. Derives amount and credits exclusively from trusted database plan record.
 * 3. Creates a 'pending' payment record in PocketBase.
 * 4. Calls provider adapter via provider-agnostic paymentService.
 * 5. Safely marks payment record as 'failed' if adapter checkout fails.
 * 6. Returns normalized checkout details.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function initiatePayment(req, res, next) {
  try {
    // 1. Enforce authenticated customer identity
    const customerId = req.user?.id;
    if (!customerId) {
      return sendError(res, 'Authentication required', 401);
    }
    if (req.user?.role !== 'customer') {
      return sendError(res, 'Only customers can initiate subscription payments', 403);
    }

    // 2. Validate request body and prevent client parameter injection
    const validatedData = validatePaymentInitiateBody(req.body);
    const { planId, provider: requestedProvider } = validatedData;

    // 3. Resolve target provider adapter
    let selectedProvider;
    if (requestedProvider) {
      selectedProvider = requestedProvider.toLowerCase();
      const registered = paymentService.getRegisteredProviders();
      if (!registered.includes(selectedProvider)) {
        return sendError(
          res,
          `Unsupported payment provider: '${requestedProvider}'. Available providers: ${registered.join(', ')}`,
          400
        );
      }
    } else {
      selectedProvider = paymentService.getDefaultProviderName();
    }

    // 4. Look up plan in subscription_plans collection
    const adminPb = await getAdminClient();
    let plan;
    try {
      plan = await adminPb.collection('subscription_plans').getOne(planId);
    } catch (planErr) {
      if (planErr.status === 404) {
        return sendError(res, 'Subscription plan not found', 404);
      }
      throw planErr;
    }

    if (!plan || plan.is_active === false) {
      return sendError(res, 'Requested subscription plan is not active or available for purchase', 400);
    }

    // 5. Derive amount and credits from trusted database record
    const amount = Number(plan.price);
    if (isNaN(amount) || amount < 0) {
      return sendError(res, 'Invalid plan pricing configuration', 500);
    }
    const currency = 'BDT';
    const credits = Number(plan.credits);

    // 6. Generate server-side unique transaction reference
    const transactionRef = generateTransactionReference();

    // 7. Create pending payment record in payments collection
    let paymentRecord;
    try {
      paymentRecord = await adminPb.collection('payments').create({
        user: customerId,
        plan: plan.id,
        amount,
        currency,
        provider: selectedProvider,
        provider_ref: transactionRef,
        status: 'pending',
      });
    } catch (dbErr) {
      return sendError(res, 'Failed to create pending payment record', 500);
    }

    // 8. Delegate checkout initiation to paymentService adapter
    let checkoutResult;
    try {
      checkoutResult = await paymentService.initiatePayment(
        {
          transactionId: transactionRef,
          amount,
          currency,
          customer: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
          plan: {
            id: plan.id,
            name: plan.name,
            price: amount,
            credits,
          },
        },
        { provider: selectedProvider }
      );
    } catch (adapterErr) {
      // 9. Failure handling: update record to failed so it is not left misleadingly pending
      try {
        await adminPb.collection('payments').update(paymentRecord.id, {
          status: 'failed',
        });
      } catch (updateErr) {
        // Silently preserve primary adapter error
      }

      return sendError(
        res,
        `Payment gateway initiation failed: ${adapterErr.message}`,
        502
      );
    }

    // 10. Return normalized checkout payload
    return sendSuccess(
      res,
      {
        paymentId: paymentRecord.id,
        provider: checkoutResult.provider,
        providerRef: checkoutResult.providerRef,
        redirectUrl: checkoutResult.redirectUrl,
        amount,
        currency,
        plan: {
          id: plan.id,
          name: plan.name,
          credits,
        },
      },
      201,
      'Payment initiated successfully'
    );
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

/**
 * POST /api/v1/payments/webhook
 *
 * Receives and cryptographically verifies server-to-server payment notifications.
 *
 * Security Requirements:
 * 1. Uses the original unparsed rawBody buffer captured before JSON parsing.
 * 2. Compares HMAC signatures using crypto.timingSafeEqual in the adapter.
 * 3. Never trusts frontend redirects or client parameters.
 * 4. Preserves task boundary: DOES NOT allocate credits or process idempotency (Task 11.5 / 11.6).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function handlePaymentWebhook(req, res, next) {
  try {
    // 1. Raw body validation
    const rawBody = req.rawBody;
    if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
      return sendError(res, 'Missing or empty webhook request body', 400);
    }

    // 2. Resolve provider from query or headers or payload
    const requestedProvider = (
      req.query?.provider ||
      req.headers?.['x-payment-provider'] ||
      req.headers?.['X-Payment-Provider'] ||
      req.body?.provider
    );

    if (requestedProvider) {
      const registered = paymentService.getRegisteredProviders();
      if (!registered.includes(String(requestedProvider).toLowerCase())) {
        return sendError(
          res,
          `Unsupported payment provider: '${requestedProvider}'. Available providers: ${registered.join(', ')}`,
          400
        );
      }
    }

    const targetProvider = (
      requestedProvider || paymentService.getDefaultProviderName()
    ).toLowerCase();

    // 3. For signed webhooks (e.g. mock adapter), enforce signature header presence upfront
    if (targetProvider === 'mock') {
      const signature = req.headers['x-mock-signature'] || req.headers['X-Mock-Signature'];
      if (!signature || typeof signature !== 'string' || !signature.trim()) {
        return sendError(res, 'Missing cryptographic signature header (x-mock-signature)', 400);
      }
    }

    // 3. Delegate to paymentService.verifyPayment() with rawBody, payload, headers, and query
    let verificationResult;
    try {
      verificationResult = await paymentService.verifyPayment(
        {
          payload: req.body,
          rawBody,
          headers: req.headers,
          query: req.query,
        },
        {
          provider: requestedProvider ? String(requestedProvider).toLowerCase() : undefined,
        }
      );
    } catch (verifyErr) {
      if (verifyErr instanceof UnsupportedProviderError) {
        return sendError(res, verifyErr.message, 400);
      }
      return sendError(res, `Webhook verification failed: ${verifyErr.message}`, 400);
    }

    // 4. Check cryptographic verification result
    if (!verificationResult || !verificationResult.isValid) {
      return sendError(
        res,
        verificationResult?.error || 'Cryptographic signature verification failed',
        400
      );
    }

    // 5. Acknowledge verified webhook (Task 11.4 boundary: zero credit allocation)
    return sendSuccess(
      res,
      {
        verified: true,
        provider: verificationResult.provider,
        providerRef: verificationResult.providerRef,
        status: verificationResult.status,
      },
      200,
      'Webhook notification verified successfully'
    );
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      return sendError(res, err.message, err.status);
    }
    next(err);
  }
}

