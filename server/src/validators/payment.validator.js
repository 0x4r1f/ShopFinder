import { z } from 'zod';

/**
 * Forbidden fields that clients must never supply in payment requests.
 */
const FORBIDDEN_CLIENT_OVERRIDE_FIELDS = [
  'amount',
  'price',
  'currency',
  'credits',
  'status',
  'user',
  'userId',
  'customerId',
  'provider_ref',
  'providerRef',
  'transactionId',
  'subscription',
  'subscriptionId',
];

export const paymentInitiateSchema = z.object({
  planId: z
    .string({ message: 'Plan ID is required' })
    .trim()
    .min(1, 'Plan ID cannot be empty'),
  provider: z
    .string()
    .trim()
    .min(1, 'Provider name cannot be empty')
    .optional(),
});

/**
 * Validates the body of POST /api/v1/payments/initiate.
 * Defensively rejects client attempts to inject privileged fields.
 *
 * @param {Object} body
 * @returns {{ planId: string, provider?: string }}
 */
export function validatePaymentInitiateBody(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const err = new Error('Request body must be a JSON object');
    err.status = 400;
    throw err;
  }

  // Anti-tampering check: reject attempts to override authoritative fields
  for (const forbiddenKey of FORBIDDEN_CLIENT_OVERRIDE_FIELDS) {
    if (body[forbiddenKey] !== undefined) {
      const err = new Error(
        `Client cannot override trusted payment attribute '${forbiddenKey}'. Price, credits, user, and status are derived exclusively server-side.`
      );
      err.status = 400;
      throw err;
    }
  }

  const result = paymentInitiateSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const err = new Error(firstIssue.message);
    err.status = 400;
    throw err;
  }

  return result.data;
}

