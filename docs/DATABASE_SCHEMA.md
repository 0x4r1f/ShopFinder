# ShopFinder — Database Schema

> Status: **In Progress — `users` (Task 2.2), `owner_contacts` (Task 2.3), and `listings` (Task 2.4) collections configured; remaining collections planned**
> Last updated: 2026-11-05 (Revision 5 — Task 2.4 implemented; `listings` created with 14 fields, 8 indexes, and moderation access rules)

---

## Collection: `users` (extends PocketBase built-in auth)

| Field     | Type     | Required | Notes                                 |
|-----------|----------|----------|---------------------------------------|
| id        | string   | auto     | PocketBase auto-generated             |
| email     | email    | yes      | Unique, used for login                |
| password  | password | yes      | Hashed by PocketBase                  |
| name      | text     | yes      | Display name                          |
| role      | select   | yes      | `customer` \| `owner` \| `admin`     |
| avatar    | file     | no       | Profile image (max 1, 5MB, jpg/jpeg/png/webp/svg; GIF excluded) |
| is_active | bool     | no       | Default true (enforced via `pb_hooks/users.pb.js`); admin can deactivate |
| created   | datetime | auto     |                                       |
| updated   | datetime | auto     |                                       |

> **D-014 (approved 2026-11-05):** `phone` has been **removed** from the `users` collection.
> Owner phone numbers are stored exclusively in the `owner_contacts` collection.
> No phone field exists on `users` at any level.

**PocketBase Access Rules:**
- **List:** locked (`null` / Superuser Admin SDK only)
- **View:** `id = @request.auth.id` (own record only)
- **Create:** locked (`null` / Superuser Admin SDK only — registration mediated by Express)
- **Update:** locked (`null` / Superuser Admin SDK only — Express enforces ownership in service layer)
- **Delete:** locked (`null` / Superuser Admin SDK only — account deactivation uses `is_active = false`)

---

## Collection: `owner_contacts` *(new — approved D-014)*

Stores private owner phone numbers, completely separated from the `users` collection.
One record per owner user (enforced by unique index on `owner`).

| Field   | Type     | Required | Notes                                                                            |
|---------|----------|----------|----------------------------------------------------------------------------------|
| id      | text     | auto     | PocketBase auto-generated (`[a-z0-9]{15}`)                                       |
| owner   | relation | yes      | → users (`_pb_users_auth_`). Single-select (`maxSelect: 1`), unique index, cascade delete. |
| phone   | text     | yes      | Owner contact phone (min: 6, max: 30). Never returned in any public response.    |
| created | autodate | auto     | Creation timestamp                                                               |
| updated | autodate | auto     | Last update timestamp                                                            |

**Constraints:**
- **Unique index on `owner`** — `CREATE UNIQUE INDEX idx_owner_contacts_owner ON owner_contacts (owner)` (enforces exactly one `owner_contacts` record per owner).
- **Cascade delete** — `cascadeDelete: true` on `owner` relation automatically removes the contact record if the owner user is deleted.

**PocketBase Access Rules:**
- **List:** locked (`null` / Superuser Admin SDK only)
- **View:** locked (`null` / Superuser Admin SDK only)
- **Create:** locked (`null` / Superuser Admin SDK only — created by Express on owner registration)
- **Update:** locked (`null` / Superuser Admin SDK only — updated by Express on profile edit)
- **Delete:** locked (`null` / Superuser Admin SDK only)

> **Security rule (D-013 + D-014):** The only way a phone number exits this collection
> is through the `pb_hooks` reveal route (`pocketbase/pb_hooks/reveal.pb.js`), called
> internally by `revealService.js` via the Admin SDK, inside a fully authenticated and
> credit-verified `$app.runInTransaction()` block. No other Express endpoint reads from
> `owner_contacts` or returns its data.

---

## Collection: `listings`

| Field          | Type     | Required | Notes                                                                             |
|----------------|----------|----------|-----------------------------------------------------------------------------------|
| id             | text     | auto     | PocketBase auto-generated (`[a-z0-9]{15}`)                                        |
| owner          | relation | yes      | → users (`_pb_users_auth_`). Single-relation (`maxSelect: 1`), `cascadeDelete: true` |
| title          | text     | yes      | Property headline (min: 5, max: 150 chars)                                        |
| description    | text     | yes      | Property details (min: 10, max: 5000 chars)                                       |
| category       | select   | yes      | `retail` \| `office` \| `warehouse` \| `showroom` \| `restaurant` \| `industrial` \| `other` (maxSelect: 1) |
| listing_type   | select   | yes      | `rent` \| `sale` (maxSelect: 1, default `rent`)                                   |
| price          | number   | yes      | Monthly rent or sale price in BDT (min: 1)                                        |
| area_sqft      | number   | no       | Area in square feet (min: 1)                                                      |
| address        | text     | yes      | Street address / building (min: 3, max: 255 chars)                                |
| city           | text     | yes      | City name (min: 2, max: 100 chars)                                                |
| area           | text     | no       | Neighborhood / locality name (max: 100 chars)                                     |
| status         | select   | yes      | `pending` \| `approved` \| `rejected` \| `archived` (maxSelect: 1, default `pending`) |
| rejection_note | text     | no       | Admin explanation note on rejection (max: 1000 chars)                             |
| is_featured    | bool     | no       | Promoted listing flag (default: false)                                            |
| created        | autodate | auto     | Creation timestamp                                                                |
| updated        | autodate | auto     | Last update timestamp                                                             |

**Indexes:**
- `CREATE INDEX idx_listings_status ON listings (status)`
- `CREATE INDEX idx_listings_owner ON listings (owner)`
- `CREATE INDEX idx_listings_city ON listings (city)`
- `CREATE INDEX idx_listings_area ON listings (area)`
- `CREATE INDEX idx_listings_category ON listings (category)`
- `CREATE INDEX idx_listings_listing_type ON listings (listing_type)`
- `CREATE INDEX idx_listings_price ON listings (price)`
- `CREATE INDEX idx_listings_created ON listings (created)`

**PocketBase Access Rules:**
- **List:** `status = "approved" || owner = @request.auth.id`
- **View:** `status = "approved" || owner = @request.auth.id`
- **Create:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Update:** locked (`null` / Superuser Admin SDK only — Express enforces ownership and status transitions)
- **Delete:** locked (`null` / Superuser Admin SDK only — Express enforces ownership)

> **Phone protection:** `owner` relation expansions in listing responses **never** include
> `owner_contacts`. Express strips all relation expansions to safe fields (`id`, `name`) only.
> `owner.phone` does not exist on `users` — no accidental leakage possible.

---

## Collection: `listing_images` (ID: `pbc_588048942`)

| Field    | Type     | Required | Notes                                                                                   |
|----------|----------|----------|-----------------------------------------------------------------------------------------|
| id       | string   | auto     |                                                                                         |
| listing  | relation | yes      | → `listings` (`pbc_3660939671`). `maxSelect: 1`, `cascadeDelete: true`.                 |
| image    | file     | yes      | `maxSelect: 1`, `maxSize: 5242880` (5 MB), `protected: false`.                          |
|          |          |          | Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`. (No SVG or GIF).           |
|          |          |          | Thumbs: `100x100`, `400x300`, `800x600`.                                                |
| is_cover | bool     | no       | Default `false` (enforced via `listing_images.pb.js`).                                   |
| order    | number   | no       | Default `0` (enforced via `listing_images.pb.js`), `min: 0`. Display sort order.        |
| created  | datetime | auto     | `onCreate: true`, `onUpdate: false`                                                     |
| updated  | datetime | auto     | `onCreate: true`, `onUpdate: true`                                                      |

**Constraints & Indexes:**
- `CREATE INDEX idx_listing_images_listing ON listing_images (listing)`
- `CREATE INDEX idx_listing_images_cover ON listing_images (listing, is_cover)`
- `CREATE INDEX idx_listing_images_order ON listing_images (listing, order)`

**Capacity & Upload Limits (D-016):**
- Per-listing limit of maximum 20 images is enforced at the Express API layer in Phase 6, Task 6.3 (`POST /api/v1/listings/:id/images`).
- Individual records enforce `maxSelect: 1` per image upload.

**Cascade Deletion:**
- When a listing record is deleted, PocketBase automatically cascade deletes all associated `listing_images` records AND removes physical image files and thumbnails from disk storage.

**PocketBase Access Rules:**
- **List:** `listing.status = "approved" || listing.owner = @request.auth.id`
- **View:** `listing.status = "approved" || listing.owner = @request.auth.id`
- **Create:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Update:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Delete:** locked (`null` / Superuser Admin SDK only — mediated by Express)

---

## Collection: `subscription_plans` (ID: `pbc_2775741768`)

| Field       | Type     | Required | Notes                                                                                   |
|-------------|----------|----------|-----------------------------------------------------------------------------------------|
| id          | string   | auto     | PocketBase system ID                                                                    |
| name        | text     | yes      | Required, `min: 2`, `max: 50`. Unique plan name.                                        |
| price       | number   | yes*     | Non-negative, `min: 0`. In BDT (Taka). (*Enforced via hook to permit 0 while rejecting omitted). |
| credits     | number   | yes      | Contact-reveal credits granted, `min: 1`.                                               |
| is_active   | bool     | no*      | Default `true` (enforced via `subscription_plans.pb.js`). Only active plans shown publicly. |
| description | text     | no       | Optional summary/description, `max: 500`.                                               |
| created     | autodate | auto     | `onCreate: true`, `onUpdate: false`                                                     |
| updated     | autodate | auto     | `onCreate: true`, `onUpdate: true`                                                      |

**Constraints & Indexes:**
- `CREATE UNIQUE INDEX idx_subscription_plans_name ON subscription_plans (name)`
- `CREATE INDEX idx_subscription_plans_active ON subscription_plans (is_active)`

**PocketBase Access Rules:**
- **List:** `is_active = true` (public/customer can only list active plans)
- **View:** `is_active = true` (public/customer can only view active plans; inactive plans return 404)
- **Create:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Update:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Delete:** locked (`null` / Superuser Admin SDK only — mediated by Express)

---

## Collection: `user_subscriptions` (ID: `pbc_2161429435`)

| Field         | Type     | Required | Notes                                                                                   |
|---------------|----------|----------|-----------------------------------------------------------------------------------------|
| id            | string   | auto     | PocketBase system ID (15 chars)                                                         |
| user          | relation | yes      | → `users` (`_pb_users_auth_`). Single relation (`maxSelect: 1`), `cascadeDelete: true`.   |
| plan          | relation | yes      | → `subscription_plans` (`pbc_2775741768`). Single relation (`maxSelect: 1`), `cascadeDelete: false`. |
| credits_used  | number   | no*      | Default `0` (enforced via `user_subscriptions.pb.js`), `min: 0`. Incremented inside `pb_hooks` transaction via `txApp` (D-013). |
| credits_total | number   | yes      | Copied from plan at purchase time, `min: 1`.                                            |
| status        | select   | yes      | Options: `active`, `expired`, `cancelled`. `maxSelect: 1`, default: `active`.            |
| purchased_at  | date     | yes      | PocketBase datetime.                                                                    |
| expires_at    | date     | no       | Null for one-time credit packages per approved D-001 (credits never expire). Retained for schema compatibility. |
| created       | autodate | auto     | `onCreate: true`, `onUpdate: false`                                                     |
| updated       | autodate | auto     | `onCreate: true`, `onUpdate: true`                                                      |

**Constraints & Indexes:**
- `CREATE INDEX idx_user_subscriptions_user_status ON user_subscriptions (user, status)`
- `CREATE INDEX idx_user_subscriptions_plan ON user_subscriptions (plan)`

**PocketBase Access Rules:**
- **List:** locked (`null` / Superuser Admin SDK only)
- **View:** locked (`null` / Superuser Admin SDK only)
- **Create:** locked (`null` / Superuser Admin SDK only — mediated by Express)
- **Update:** locked (`null` / Superuser Admin SDK only — modified via `txApp` inside `pb_hooks` transaction)
- **Delete:** locked (`null` / Superuser Admin SDK only — mediated by Express)

> **Transaction note (D-013):** `credits_used` is incremented exclusively inside the
> `pb_hooks` reveal transaction using `txApp.save(record)`. Express never increments
> this field directly — not through the Admin SDK, not through any other route.
> The creation hook `user_subscriptions.pb.js` additionally validates that `credits_used <= credits_total`.

---

## Collection: `revealed_contacts` (ID: `pbc_2001793036`)

| Field       | Type     | Required | Notes                                                                                   |
|-------------|----------|----------|-----------------------------------------------------------------------------------------|
| id          | string   | auto     | PocketBase system primary key (15 chars)                                                |
| customer    | relation | yes      | → `users` (`_pb_users_auth_`). Single relation (`maxSelect: 1`), `cascadeDelete: true`. Derived from auth context — never client input. |
| listing     | relation | yes      | → `listings` (`pbc_3660939671`). Single relation (`maxSelect: 1`), `cascadeDelete: false`. |
| owner       | relation | yes      | → `users` (`_pb_users_auth_`). Single relation (`maxSelect: 1`), `cascadeDelete: false` (denormalized owner). |
| revealed_at | date     | yes      | PocketBase datetime timestamp (defaults to current datetime via `revealed_contacts.pb.js` hook). |
| created     | autodate | auto     | `onCreate: true`, `onUpdate: false`                                                     |
| updated     | autodate | auto     | `onCreate: true`, `onUpdate: true`                                                      |

**Constraints & Indexes:**
- `CREATE UNIQUE INDEX idx_revealed_contacts_customer_listing ON revealed_contacts (customer, listing)` — database-level enforcement (D-013). Prevents duplicate reveal records even under concurrent access. Acts as a secondary backstop inside the `pb_hooks` reveal transaction (primary defense).

**PocketBase Access Rules:**
- **List:** `customer = @request.auth.id` (customer reads own reveal history; public list returns empty)
- **View:** `customer = @request.auth.id` (customer reads own reveal records; others return 404)
- **Create:** locked (`null` / created exclusively inside `pb_hooks` reveal transaction using `txApp`)
- **Update:** locked (`null` / direct modification prohibited)
- **Delete:** locked (`null` / direct deletion prohibited)

> **Security note (D-013):** The `customer` field is **never accepted from request body**.
> The `pb_hooks` reveal script derives customer identity from `e.requestInfo().auth.id`
> (the PocketBase-verified auth context). Express passes only the `listingId`; all other
> identities are resolved server-side from the authenticated session.

---

## Collection: `saved_listings` (ID: `pbc_3547441969`)

| Field    | Type     | Required | Notes                                                                                   |
|----------|----------|----------|-----------------------------------------------------------------------------------------|
| id       | string   | auto     | PocketBase system primary key (15 chars)                                                |
| customer | relation | yes      | → `users` (`_pb_users_auth_`). Single relation (`maxSelect: 1`), `cascadeDelete: true`.   |
| listing  | relation | yes      | → `listings` (`pbc_3660939671`). Single relation (`maxSelect: 1`), `cascadeDelete: true` (approved decision: deleting listing removes dead bookmarks). |
| saved_at | date     | yes      | PocketBase datetime timestamp (defaults to current datetime via `saved_listings.pb.js` hook). |
| created  | autodate | auto     | `onCreate: true`, `onUpdate: false`                                                     |
| updated  | autodate | auto     | `onCreate: true`, `onUpdate: true`                                                      |

**Constraints & Indexes:**
- `CREATE UNIQUE INDEX idx_saved_listings_customer_listing ON saved_listings (customer, listing)` — prevents duplicate bookmarks (FR-053).
- `CREATE INDEX idx_saved_listings_listing ON saved_listings (listing)` — optimizes listing popularity and save count queries.

**PocketBase Access Rules:**
- **List:** `customer = @request.auth.id` (customer reads own saved listings; unauthenticated list returns empty)
- **View:** `customer = @request.auth.id` (customer views own saved listings; others return 404)
- **Create:** locked (`null` / Superuser Admin SDK only — mediated by Express `POST /api/v1/favorites/:listingId`)
- **Update:** locked (`null` / direct modification prohibited)
- **Delete:** locked (`null` / Superuser Admin SDK only — mediated by Express `DELETE /api/v1/favorites/:listingId`)

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
