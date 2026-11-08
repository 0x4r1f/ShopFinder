import { getAdminClient } from '../config/pocketbase.js';

/**
 * ShopFinder — Subscription Plans Service (Phase 9, Task 9.2)
 *
 * Implements catalog plan management and public querying using the
 * trusted server-side PocketBase Admin SDK client singleton.
 * Strictly enforces D-001 one-time credit package policy and response allowlisting.
 */

/**
 * Approved official default plans (D-001).
 * Starter: ৳299 -> 10 contact reveals
 * Pro: ৳999 -> 100 contact reveals
 */
export const DEFAULT_PLANS = [
  {
    name: 'Starter',
    price: 299,
    credits: 10,
    is_active: true,
    description: 'Starter credit package: 10 verified property owner contact reveals.',
  },
  {
    name: 'Pro',
    price: 999,
    credits: 100,
    is_active: true,
    description: 'Pro credit package: 100 verified property owner contact reveals with maximum savings.',
  },
];

/**
 * Sanitizes a plan record for public client consumption.
 * Strictly allowlists safe catalog fields and excludes internal PocketBase keys,
 * collection IDs, or administrative metadata.
 *
 * @param {Object} plan - Raw PocketBase record
 * @returns {Object|null}
 */
export function sanitizePublicPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return null;
  }

  return {
    id: plan.id,
    name: plan.name,
    price: Number(plan.price),
    credits: Number(plan.credits),
    description: plan.description || '',
  };
}

/**
 * Sanitizes a plan record for administrative client consumption.
 * Includes status and lifecycle timestamps without leaking credentials or internal database keys.
 *
 * @param {Object} plan - Raw PocketBase record
 * @returns {Object|null}
 */
export function sanitizeAdminPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return null;
  }

  return {
    id: plan.id,
    name: plan.name,
    price: Number(plan.price),
    credits: Number(plan.credits),
    description: plan.description || '',
    is_active: Boolean(plan.is_active),
    created: plan.created || null,
    updated: plan.updated || null,
  };
}

/**
 * Seeds default Starter and Pro subscription plans idempotently.
 *
 * Safeguards:
 * - Checks if plans already exist by exact case-insensitive name.
 * - Does NOT create duplicates on repeated executions.
 * - If an existing plan was customized by an administrator, preserves the custom values
 *   and records a warning rather than silently overwriting.
 * - Preserves existing legacy test plans without modification or deletion.
 * - Does NOT create customer subscriptions or touch user credit records.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.logger=console] - Logger instance
 * @returns {Promise<{ seeded: string[], existing: string[], warnings: string[] }>}
 */
export async function seedDefaultPlans({ logger = console } = {}) {
  const pb = await getAdminClient();
  const summary = {
    seeded: [],
    existing: [],
    warnings: [],
  };

  let existingRecords = [];
  try {
    existingRecords = await pb.collection('subscription_plans').getFullList({
      requestKey: null,
    });
  } catch (err) {
    logger.warn(`Failed to inspect subscription_plans for seeding: ${err.message}`);
    throw err;
  }

  const existingByName = new Map();
  for (const record of existingRecords) {
    if (record?.name) {
      existingByName.set(record.name.trim().toLowerCase(), record);
    }
  }

  for (const targetPlan of DEFAULT_PLANS) {
    const key = targetPlan.name.trim().toLowerCase();
    const existing = existingByName.get(key);

    if (!existing) {
      try {
        const created = await pb.collection('subscription_plans').create(targetPlan, {
          requestKey: null,
        });
        summary.seeded.push(created.name);
        existingByName.set(key, created);
        logger.info?.(`Seeded default subscription plan: "${created.name}" (৳${created.price} / ${created.credits} credits)`);
      } catch (err) {
        logger.error?.(`Failed to seed plan "${targetPlan.name}": ${err.message}`);
        throw err;
      }
    } else {
      summary.existing.push(existing.name);

      // Check whether existing plan matches default specifications
      const priceMismatch = Number(existing.price) !== Number(targetPlan.price);
      const creditsMismatch = Number(existing.credits) !== Number(targetPlan.credits);

      if (priceMismatch || creditsMismatch) {
        const warning = `Existing plan "${existing.name}" differs from default specification (price: ${existing.price} vs ${targetPlan.price}, credits: ${existing.credits} vs ${targetPlan.credits}). Preserving administrator custom settings.`;
        summary.warnings.push(warning);
        logger.warn?.(warning);
      }
    }
  }

  return summary;
}

/**
 * Retrieves all active subscription plans for public marketplace/pricing view.
 *
 * - Filter: is_active = true
 * - Ordering: Price ascending, name deterministic tie-breaker
 * - Sanitized using strict allowlist (id, name, price, credits, description)
 *
 * @returns {Promise<Array<Object>>}
 */
export async function getActivePlans() {
  const pb = await getAdminClient();

  try {
    const records = await pb.collection('subscription_plans').getFullList({
      filter: 'is_active = true',
      sort: 'price,name',
      requestKey: null,
    });

    return records.map(sanitizePublicPlan);
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve subscription plans from database');
      safeErr.status = 503;
      throw safeErr;
    }
    throw err;
  }
}

/**
 * Retrieves paginated subscription plans for administrative management.
 * Includes both active and inactive plans.
 *
 * @param {Object} [params={}]
 * @param {number} [params.page=1]
 * @param {number} [params.perPage=20]
 * @param {string} [params.sort='price']
 * @param {boolean} [params.is_active]
 * @returns {Promise<{ plans: Array<Object>, pagination: Object }>}
 */
export async function getAllPlansAdmin(params = {}) {
  const pb = await getAdminClient();
  const { page = 1, perPage = 20, sort = 'price', is_active } = params;

  let filter = '';
  if (is_active !== undefined) {
    filter = `is_active = ${Boolean(is_active)}`;
  }

  try {
    const result = await pb.collection('subscription_plans').getList(page, perPage, {
      filter: filter || undefined,
      sort,
      requestKey: null,
    });

    return {
      plans: result.items.map(sanitizeAdminPlan),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };
  } catch (err) {
    if (err?.status >= 500 || err?.status === 0) {
      const safeErr = new Error('Failed to retrieve administrative subscription plans');
      safeErr.status = 503;
      throw safeErr;
    }
    throw err;
  }
}

/**
 * Retrieves a single subscription plan by ID for administrators.
 *
 * @param {string} id - Plan record ID
 * @returns {Promise<Object>}
 */
export async function getPlanById(id) {
  const pb = await getAdminClient();

  try {
    const record = await pb.collection('subscription_plans').getOne(id, {
      requestKey: null,
    });
    return sanitizeAdminPlan(record);
  } catch (err) {
    if (err?.status === 404) {
      const notFoundErr = new Error(`Subscription plan not found: ${id}`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    throw err;
  }
}

/**
 * Creates a new subscription plan (Admin only).
 * Validates uniqueness of plan name.
 *
 * @param {Object} data - Validated plan creation data
 * @returns {Promise<Object>}
 */
export async function createPlan(data) {
  const pb = await getAdminClient();

  // 1. Check for duplicate plan name (case-insensitive)
  try {
    const existing = await pb.collection('subscription_plans').getFirstListItem(
      pb.filter('name ~ {:name}', { name: data.name.trim() }),
      { requestKey: null }
    );
    if (existing && existing.name.trim().toLowerCase() === data.name.trim().toLowerCase()) {
      const dupErr = new Error(`A subscription plan with the name "${data.name}" already exists`);
      dupErr.status = 409;
      throw dupErr;
    }
  } catch (err) {
    if (err.status === 409) throw err;
    // 404 means no duplicate found, which is expected
  }

  // 2. Create the plan record
  try {
    const record = await pb.collection('subscription_plans').create(
      {
        name: data.name.trim(),
        price: data.price,
        credits: data.credits,
        description: data.description || '',
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      },
      { requestKey: null }
    );

    return sanitizeAdminPlan(record);
  } catch (err) {
    if (err?.status === 400 && err?.data?.data?.name) {
      const dupErr = new Error(`A subscription plan with the name "${data.name}" already exists`);
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

/**
 * Updates an existing subscription plan (Admin only).
 *
 * @param {string} id - Plan record ID
 * @param {Object} data - Validated update fields
 * @returns {Promise<Object>}
 */
export async function updatePlan(id, data) {
  const pb = await getAdminClient();

  // 1. Verify plan exists
  let existing;
  try {
    existing = await pb.collection('subscription_plans').getOne(id, { requestKey: null });
  } catch (err) {
    if (err?.status === 404) {
      const notFoundErr = new Error(`Subscription plan not found: ${id}`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    throw err;
  }

  // 2. If name is being changed, verify uniqueness
  if (data.name && data.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
    try {
      const duplicate = await pb.collection('subscription_plans').getFirstListItem(
        pb.filter('name ~ {:name}', { name: data.name.trim() }),
        { requestKey: null }
      );
      if (duplicate && duplicate.id !== id && duplicate.name.trim().toLowerCase() === data.name.trim().toLowerCase()) {
        const dupErr = new Error(`A subscription plan with the name "${data.name}" already exists`);
        dupErr.status = 409;
        throw dupErr;
      }
    } catch (err) {
      if (err.status === 409) throw err;
    }
  }

  // 3. Perform update
  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.price !== undefined) payload.price = data.price;
  if (data.credits !== undefined) payload.credits = data.credits;
  if (data.description !== undefined) payload.description = data.description.trim();
  if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

  try {
    const updated = await pb.collection('subscription_plans').update(id, payload, {
      requestKey: null,
    });
    return sanitizeAdminPlan(updated);
  } catch (err) {
    if (err?.status === 400 && err?.data?.data?.name) {
      const dupErr = new Error(`A subscription plan with the name "${data.name}" already exists`);
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  }
}

/**
 * Soft-deactivates a subscription plan (Admin only).
 * Sets is_active = false without deleting records or customer subscription references.
 *
 * @param {string} id - Plan record ID
 * @returns {Promise<Object>}
 */
export async function deactivatePlan(id) {
  const pb = await getAdminClient();

  // 1. Verify plan exists
  try {
    await pb.collection('subscription_plans').getOne(id, { requestKey: null });
  } catch (err) {
    if (err?.status === 404) {
      const notFoundErr = new Error(`Subscription plan not found: ${id}`);
      notFoundErr.status = 404;
      throw notFoundErr;
    }
    throw err;
  }

  // 2. Set is_active to false
  try {
    const updated = await pb.collection('subscription_plans').update(
      id,
      { is_active: false },
      { requestKey: null }
    );
    return sanitizeAdminPlan(updated);
  } catch (err) {
    throw err;
  }
}

