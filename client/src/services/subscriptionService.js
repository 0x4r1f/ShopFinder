import { api } from './api.js';

/**
 * ShopFinder — Subscription Plans Client API Service (Phase 9, Task 9.2)
 *
 * Provides customer and public access to active commercial subscription plans.
 */

/**
 * Retrieves all active subscription plans from the public endpoint.
 *
 * @param {Object} [options={}]
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for request cancellation
 * @returns {Promise<Array<{ id: string, name: string, price: number, credits: number, description: string }>>}
 */
export async function getSubscriptionPlans(options = {}) {
  const { signal } = options;

  const response = await api.get('/api/v1/subscriptions/plans', {
    signal,
  });

  return response?.data?.plans || [];
}

export default {
  getSubscriptionPlans,
};

