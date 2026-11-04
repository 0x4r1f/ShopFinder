# ShopFinder — Database Schema

> Status: **Planned — not yet implemented in PocketBase**
> Last updated: 2026-11-05 (Revision 2 — D-014 approved; `phone` moved to `owner_contacts`)

---

## Collection: `users` (extends PocketBase built-in auth)

| Field     | Type     | Required | Notes                                 |
|-----------|----------|----------|---------------------------------------|
| id        | string   | auto     | PocketBase auto-generated             |
| email     | email    | yes      | Unique, used for login                |
| password  | password | yes      | Hashed by PocketBase                  |
| name      | text     | yes      | Display name                          |
| role      | select   | yes      | `customer` \| `owner` \| `admin`     |
| avatar    | file     | no       | Profile image                         |
| is_active | bool     | yes      | Default true; admin can deactivate    |
| created   | datetime | auto     |                                       |
| updated   | datetime | auto     |                                       |

> **D-014 (approved 2026-11-05):** `phone` has been **removed** from the `users` collection.
> Owner phone numbers are stored exclusively in the `owner_contacts` collection.
> No phone field exists on `users` at any level.

**PocketBase Access Rules:**
- **List:** deny all
- **View:** `id = @request.auth.id` (own record via Express middleware)
- **Create:** public (registration flow — Express validates role and input)
- **Update:** Admin SDK only (Express enforces ownership in service layer)
- **Delete:** deny all — deactivation uses `is_active = false`

---

## Collection: `owner_contacts` *(new — approved D-014)*

Stores private owner phone numbers, completely separated from the `users` collection.
One record per owner user (enforced by unique index on `owner`).

| Field   | Type     | Required | Notes                                                     |
|---------|----------|----------|-----------------------------------------------------------|
| id      | string   | auto     | PocketBase auto-generated                                 |
| owner   | relation | yes      | → users (owner role). Unique — one record per owner.      |
| phone   | text     | yes      | Owner contact phone. Never returned in any public response. |
| created | datetime | auto     |                                                           |
| updated | datetime | auto     |                                                           |

**Constraints:**
- **Unique index on `owner`** — one `owner_contacts` record per owner user.

**PocketBase Access Rules:**
- **List:** deny all
- **View:** deny all — no direct client access, Admin SDK only
- **Create:** deny all — Admin SDK only (created by Express on owner registration)
- **Update:** deny all — Admin SDK only (updated by Express on profile edit)
- **Delete:** deny all

> **Security rule (D-013 + D-014):** The only way a phone number exits this collection
> is through the `pb_hooks` reveal route (`pocketbase/pb_hooks/reveal.pb.js`), called
> internally by `revealService.js` via the Admin SDK, inside a fully authenticated and
> credit-verified `$app.runInTransaction()` block. No other Express endpoint reads from
> `owner_contacts` or returns its data.

---

## Collection: `listings`

| Field          | Type     | Required | Notes                                            |
|----------------|----------|----------|--------------------------------------------------|
| id             | string   | auto     |                                                  |
| owner          | relation | yes      | → users (owner role)                             |
| title          | text     | yes      | Max 150 chars                                    |
| description    | text     | yes      |                                                  |
| category       | select   | yes      | e.g. `retail`, `office`, `warehouse`, etc.       |
| listing_type   | select   | yes      | `rent` \| `sale`                                 |
| price          | number   | yes      | Monthly rent or sale price                       |
| area_sqft      | number   | no       | Area in square feet                              |
| address        | text     | yes      |                                                  |
| city           | text     | yes      |                                                  |
| area           | text     | no       | Neighbourhood/area name                          |
| status         | select   | yes      | `pending` \| `approved` \| `rejected` \| `archived` |
| rejection_note | text     | no       | Admin note on rejection                          |
| is_featured    | bool     | yes      | Default false                                    |
| created        | datetime | auto     |                                                  |
| updated        | datetime | auto     |                                                  |

**PocketBase Access Rules:**
- **List/View (public):** `status = "approved"` only
- **List/View (owner):** `owner = @request.auth.id` (all statuses for own listings)
- **Create/Update/Delete:** Admin SDK only (Express enforces ownership in service layer)

> **Phone protection:** `owner` relation expansions in listing responses **never** include
> `owner_contacts`. Express strips all relation expansions to safe fields (`id`, `name`) only.
> `owner.phone` does not exist on `users` — no accidental leakage possible.

---

## Collection: `listing_images`

| Field    | Type     | Required | Notes                   |
|----------|----------|----------|-------------------------|
| id       | string   | auto     |                         |
| listing  | relation | yes      | → listings              |
| image    | file     | yes      | PocketBase file storage |
| is_cover | bool     | yes      | Default false           |
| order    | number   | no       | Display sort order      |
| created  | datetime | auto     |                         |

**PocketBase Access Rules:** Public read for images on approved listings. Write — Admin SDK only.

---

## Collection: `subscription_plans`

| Field       | Type   | Required | Notes                              |
|-------------|--------|----------|------------------------------------|
| id          | string | auto     |                                    |
| name        | text   | yes      | e.g. "Starter", "Pro"              |
| price       | number | yes      | In BDT (Taka)                      |
| credits     | number | yes      | Contact-reveal credits granted     |
| is_active   | bool   | yes      | Only active plans shown to users   |
| description | text   | no       |                                    |

**PocketBase Access Rules:** Public list/view (active only). Create/update/delete — Admin SDK only.

---

## Collection: `user_subscriptions`

| Field         | Type     | Required | Notes                                              |
|---------------|----------|----------|----------------------------------------------------|
| id            | string   | auto     |                                                    |
| user          | relation | yes      | → users (customer)                                 |
| plan          | relation | yes      | → subscription_plans                               |
| credits_used  | number   | yes      | Default 0. Incremented inside `pb_hooks` transaction via `txApp`. |
| credits_total | number   | yes      | Copied from plan at purchase time                  |
| status        | select   | yes      | `active` \| `expired` \| `cancelled`               |
| purchased_at  | datetime | yes      |                                                    |
| expires_at    | datetime | no       | Null until billing policy decided (D-001)          |

**PocketBase Access Rules:** All operations — Admin SDK only. Customer reads own via Express endpoint.

> **Transaction note (D-013):** `credits_used` is incremented exclusively inside the
> `pb_hooks` reveal transaction using `txApp.save(record)`. Express never increments
> this field directly — not through the Admin SDK, not through any other route.

---

## Collection: `revealed_contacts`

| Field       | Type     | Required | Notes                                                              |
|-------------|----------|----------|--------------------------------------------------------------------|
| id          | string   | auto     |                                                                    |
| customer    | relation | yes      | → users (customer). Derived from auth context — never client input. |
| listing     | relation | yes      | → listings                                                         |
| owner       | relation | yes      | → users (owner) — denormalized for history display                 |
| revealed_at | datetime | auto     |                                                                    |

**Constraints:**
- **Unique index on `(customer, listing)`** — database-level enforcement. Prevents duplicate reveal records even under concurrent access. Acts as a secondary backstop inside the `pb_hooks` transaction (primary defense).

**PocketBase Access Rules:**
- **List/View:** `customer = @request.auth.id` (customer reads own history via Express endpoint)
- **Create:** deny all (created exclusively inside `pb_hooks` reveal transaction using `txApp`)
- **Update:** deny all
- **Delete:** deny all

> **Security note (D-013):** The `customer` field is **never accepted from request body**.
> The `pb_hooks` reveal script derives customer identity from `e.requestInfo().auth.id`
> (the PocketBase-verified auth context). Express passes only the `listingId`; all other
> identities are resolved server-side from the authenticated session.

---

## Collection: `saved_listings`

| Field    | Type     | Required | Notes      |
|----------|----------|----------|------------|
| id       | string   | auto     |            |
| customer | relation | yes      | → users    |
| listing  | relation | yes      | → listings |
| saved_at | datetime | auto     |            |

**Constraints:** Unique index on `(customer, listing)`.

**PocketBase Access Rules:** Customer reads/writes own records via Express. Admin SDK for backend operations.

---

## Collection: `payments`

| Field        | Type     | Required | Notes                                     |
|--------------|----------|----------|-------------------------------------------|
| id           | string   | auto     |                                           |
| user         | relation | yes      | → users                                   |
| plan         | relation | yes      | → subscription_plans                      |
| subscription | relation | no       | → user_subscriptions (set after success)  |
| amount       | number   | yes      | Actual charged amount                     |
| currency     | text     | yes      | Default "BDT"                             |
| provider     | text     | yes      | e.g. "bkash", "sslcommerz", "stripe"      |
| provider_ref | text     | no       | Provider transaction ID — idempotency key |
| status       | select   | yes      | `pending` \| `success` \| `failed`        |
| created      | datetime | auto     |                                           |

**PocketBase Access Rules:** All operations — Admin SDK only. Customer reads own via Express endpoint.

---

## Collection: `notifications`

| Field    | Type     | Required | Notes                                                      |
|----------|----------|----------|------------------------------------------------------------|
| id       | string   | auto     |                                                            |
| user     | relation | yes      | → users                                                    |
| type     | select   | yes      | `listing_approved` \| `listing_rejected` \| `credit_low`  |
| message  | text     | yes      |                                                            |
| is_read  | bool     | yes      | Default false                                              |
| created  | datetime | auto     |                                                            |

**PocketBase Access Rules:** User reads/marks-read own records via Express. Create via Admin SDK only.

---

## Relationship Diagram (Updated — D-014)

```
users ──< listings ──< listing_images
  │
  ├──1 owner_contacts     (one-to-one, owner only — private, no public expand)
  │
  ├──< user_subscriptions >── subscription_plans
  │         │
  │         └──< payments
  │
  ├──< revealed_contacts >── listings
  │         └── (phone fetched from owner_contacts inside pb_hooks transaction ONLY)
  │
  ├──< saved_listings    >── listings
  └──< notifications
```
