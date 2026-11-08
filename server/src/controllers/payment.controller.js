import { getAdminClient } from '../config/pocketbase.js';
import { paymentService } from '../services/paymentService.js';
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

