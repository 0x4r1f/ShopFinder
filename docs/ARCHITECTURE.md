# ShopFinder — Application Architecture

> **Document status:** Approved in principle — 2026-11-05
> **Last updated:** 2026-11-05 (Revision 3 — D-010, D-013, D-014 approved; cookie auth, pb_hooks reveal, owner_contacts documented)
> **Phase:** 0 (Planning) — No implementation yet

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Project Folder Structure](#2-project-folder-structure)
3. [Authentication & Token Verification Flow](#3-authentication--token-verification-flow)
4. [Role-Based Authorization](#4-role-based-authorization)
5. [Contact Reveal & Concurrent Duplicate Prevention](#5-contact-reveal--concurrent-duplicate-prevention)
6. [Payment Webhook Verification & Idempotency](#6-payment-webhook-verification--idempotency)
7. [PocketBase Collection Access Rules & Sensitive Data](#7-pocketbase-collection-access-rules--sensitive-data)
8. [PocketBase Binary Management & Data Storage](#8-pocketbase-binary-management--data-storage)
9. [Environment Variable Management](#9-environment-variable-management)
10. [Key Architectural Decisions](#10-key-architectural-decisions)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                    │
│   React 18 + Tailwind CSS + shadcn/ui                   │
│   React Router (client-side routing + route guards)     │
│   Centralized API service layer (fetch / axios)         │
│   Auth Context (user state & profile — token in cookie) │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / REST  (httpOnly cookie pb_auth)
                           │ All requests go through Express
                           │ Client NEVER talks to PocketBase
┌──────────────────────────▼──────────────────────────────┐
│               BACKEND (Node.js / Express)               │
│   REST API — /api/v1/...                                │
│   JWT verification middleware (verifies PB tokens)      │
│   Role-based authorization middleware                   │
│   Input validation (zod)                               │
│   Business rules enforcement                            │
│   Contact reveal & credit deduction logic               │
│   Payment webhook handlers + idempotency                │
│   PocketBase Admin SDK (server-to-server only)          │
└──────────────────────────┬──────────────────────────────┘
                           │ PocketBase JS SDK  (admin token)
                           │ Internal network only
┌──────────────────────────▼──────────────────────────────┐
│                  DATABASE (PocketBase)                  │
│   Built-in Auth collections (users)                     │
│   REST API + Realtime subscriptions                     │
│   File storage (listing images, avatars)                │
│   Collection-level access rules (locked down)           │
│   Single source of truth for all data                   │
└─────────────────────────────────────────────────────────┘
```

> **Critical rule:** The React frontend communicates **only** with the Express backend.
> PocketBase is treated as a private internal database. The frontend has no direct
> access to the PocketBase REST API.

---

## 2. Project Folder Structure

```
ShopFinder/
├── client/                      # React 18 frontend (Vite)
│   ├── public/
│   └── src/
│       ├── api/                 # Centralized API service layer
│       │   ├── authApi.js       # Login, register, logout calls
│       │   ├── listingsApi.js
│       │   ├── revealApi.js
│       │   ├── subscriptionsApi.js
│       │   └── index.js         # Axios/fetch instance + interceptors
│       ├── assets/              # Images, icons, fonts
│       ├── components/
│       │   ├── common/          # Button, Input, Modal, Badge, Spinner…
│       │   ├── layout/          # Header, Footer, Sidebar, PageWrapper
│       │   └── listings/        # ListingCard, ListingGrid, FilterBar…
│       ├── context/
│       │   └── AuthContext.jsx  # Auth state, login/logout, token handling
│       ├── hooks/               # useAuth, useListings, useCredits…
│       ├── pages/
│       │   ├── auth/            # Login, Register
│       │   ├── public/          # Home, Marketplace, ListingDetail
│       │   ├── customer/        # Dashboard, Favorites, RevealHistory, Plans
│       │   ├── owner/           # Dashboard, MyListings, CreateListing, EditListing
│       │   └── admin/           # Dashboard, ListingReview, Users, Payments, Plans
│       ├── routes/
│       │   ├── AppRouter.jsx    # Top-level route definitions
│       │   └── ProtectedRoute.jsx  # Role-based route guard component
│       ├── utils/               # formatCurrency, formatDate, validators…
│       └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                      # Node.js / Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js           # Loads and validates all env vars at startup
│   │   │   └── pocketbase.js    # PocketBase Admin SDK client singleton
│   │   ├── middleware/
│   │   │   ├── authenticate.js  # JWT verification middleware
│   │   │   ├── authorize.js     # Role-enforcement middleware factory
│   │   │   ├── validate.js      # Zod schema validation middleware
│   │   │   └── errorHandler.js  # Centralized error response middleware
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── listings.routes.js
│   │   │   ├── reveal.routes.js
│   │   │   ├── subscriptions.routes.js
│   │   │   ├── payments.routes.js
│   │   │   ├── favorites.routes.js
│   │   │   ├── users.routes.js
│   │   │   └── admin.routes.js
│   │   ├── controllers/         # Route handlers — thin, delegate to services
│   │   ├── services/            # Business logic
│   │   │   ├── authService.js
│   │   │   ├── listingService.js
│   │   │   ├── revealService.js       # Contact reveal + credit deduction
│   │   │   ├── subscriptionService.js
│   │   │   ├── paymentService.js      # Provider-agnostic payment layer
│   │   │   └── notificationService.js
│   │   └── utils/
│   │       ├── apiResponse.js   # Standardized success/error response shapes
│   │       └── logger.js
│   ├── .env                     # NEVER committed (gitignored)
│   ├── .env.example             # Committed — template with no real secrets
│   ├── server.js
│   └── package.json
│
├── pocketbase/                  # PocketBase binary + server-side hooks
│   ├── pocketbase.exe           # Binary (gitignored — downloaded per machine)
│   ├── pb_hooks/                # Server-side JS hooks (committed to Git)
│   │   └── reveal.pb.js        # Custom atomic reveal route ($app.runInTransaction)
│   └── .gitkeep
│   # Note: pb_data is intentionally stored OUTSIDE repository & OneDrive (D-015)
│   # Path: C:\Users\arifh\AppData\Local\ShopFinder\pb_data\
│
├── docs/                        # Project documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md          ← this file
│   ├── DATABASE_SCHEMA.md
│   ├── DEVELOPMENT_PLAN.md
│   ├── TESTING_CHECKLIST.md
│   ├── PROGRESS.md
│   └── DECISIONS.md
│
├── .gitignore
└── README.md
```

---

## 3. Authentication & Token Verification Flow

### How PocketBase authentication works with Express

PocketBase issues its own signed JWT when a user logs in. Express does **not** maintain its own separate session or JWT — it verifies the PocketBase token on every protected request by calling PocketBase's `authRefresh` endpoint.

> **Important implementation note (confirmed from PocketBase documentation):**
> The PocketBase JS SDK must be instantiated **per-request** in the middleware, NOT as a
> shared global singleton. Sharing one `pb` instance across concurrent requests causes
> race conditions where one request's auth state overwrites another's. Each middleware
> call creates a fresh, isolated `new PocketBase(POCKETBASE_URL)` instance.

### D-010 Approved: httpOnly Cookie Authentication

The PocketBase auth token is stored in a **server-set httpOnly cookie**. This is the approved strategy.

| Requirement | Implementation |
|-------------|----------------|
| `HttpOnly` flag | Cookie not accessible via `document.cookie` — XSS cannot steal the token |
| `Secure` flag | Cookie only transmitted over HTTPS (enforced in production) |
| `SameSite=Strict` | Cookie not sent on cross-site requests — primary CSRF defence |
| CORS `origin` whitelist | Express CORS allows only `CLIENT_URL` with `credentials: true` |
| `Origin` header check | Express validates `Origin` / `Referer` on all state-changing requests |
| No `localStorage` | Token never written to browser storage by any frontend code |
| No body/query token | Express reads token exclusively from the `Cookie` header |

### Login Flow (httpOnly Cookie)

```
Client                   Express /api/v1/auth/login      PocketBase
  │                               │                           │
  │── POST { email, password } ──▶│                           │
  │   (credentials: 'include')    │                           │
  │                               │── authWithPassword() ────▶│
  │                               │◀── { token, user record } │
  │                               │                           │
  │                               │  Build safe user payload  │
  │                               │  (strip all sensitive     │
  │                               │   fields — no phone)      │
  │                               │                           │
  │                               │  res.cookie('pb_auth', token, {
  │                               │    httpOnly: true,        │
  │                               │    secure: true,          │
  │                               │    sameSite: 'Strict',    │
  │                               │    path: '/'              │
  │                               │  })                       │
  │◀── 200 { user } + Set-Cookie ─│                           │
  │   (token in httpOnly cookie,  │                           │
  │    not in response body)      │                           │
```

### Protected Request Flow

```
Client                   Express Middleware Stack           PocketBase
  │                               │                           │
  │── GET /api/v1/... ───────────▶│                           │
  │   Cookie: pb_auth=<token>     │                           │
  │   (sent automatically by      │                           │
  │    browser — not by JS code)  │                           │
  │                               │ [csrfProtect middleware]  │
  │                               │  Validate Origin header   │
  │                               │  vs CLIENT_URL allowlist  │
  │                               │  → 403 if mismatch        │
  │                               │                           │
  │                               │ [authenticate.js]         │
  │                               │  Read token from cookie   │
  │                               │  new PocketBase(URL)      │ ← fresh per-request instance
  │                               │  pb.authStore.save(token) │
  │                               │── authRefresh() ─────────▶│ ← live token check
  │                               │◀── { record } or error    │
  │                               │                           │
  │                               │  On success:              │
  │                               │  req.user = {             │
  │                               │    id, role, email, name, │
  │                               │    is_active              │
  │                               │  }  (phone EXCLUDED)      │
  │                               │                           │
  │                               │  On is_active = false:    │
  │                               │  → 401 Unauthorized       │
  │                               │                           │
  │                               │ [authorize.js]            │
  │                               │  Check req.user.role      │
  │                               │  against required role(s) │
  │                               │                           │
  │                               │ [controller / service]    │
  │◀── response ─────────────────│                           │
```

### Logout Flow

```
Client                   Express /api/v1/auth/logout
  │                               │
  │── POST /logout ──────────────▶│
  │   (credentials: 'include')    │
  │                               │  res.clearCookie('pb_auth')
  │◀── 200 OK ───────────────────│
  │   (cookie cleared)            │
```

### CSRF Protection Strategy

`SameSite=Strict` is the **primary CSRF defence** — the browser will not send the auth cookie on any cross-origin request initiated from a third-party site.

As a **secondary defence**, Express validates the `Origin` (or `Referer`) header on all state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`):

- If `Origin` matches `CLIENT_URL` → allow.
- If `Origin` is absent or does not match → 403 Forbidden.

This two-layer approach means a CSRF attack would need to:
1. Defeat `SameSite=Strict` (not possible in modern browsers), AND
2. Forge a matching `Origin` header (not possible via HTML-based attacks).

> **No CSRF token is required** because `SameSite=Strict` + `Origin` check provides
> equivalent protection without additional state management. If browser support for
> `SameSite` becomes a concern in future, a double-submit CSRF token can be added
> at that time without architectural changes.

### Token Verification Implementation

The `authenticate.js` middleware calls `pb.collection('users').authRefresh()` with the user's token loaded into a fresh SDK instance. This confirms all of the following on every request:

1. The token is cryptographically valid (not tampered).
2. The user record still exists in PocketBase.
3. The token has not expired (PocketBase enforces expiry server-side).
4. The user's password has not changed since the token was issued (PocketBase invalidates tokens on password change).
5. The backend then checks `req.user.is_active` and rejects with 401 if the account has been deactivated by an admin.

> **Why not cache the token verification?** PocketBase tokens can be instantly invalidated
> server-side (password change, admin deactivation, token key rotation). Caching would
> allow revoked tokens to continue working. The `authRefresh` round-trip is negligible
> in cost (single indexed DB lookup in SQLite).

---

## 4. Role-Based Authorization

### Roles

| Role | String value stored in `users.role` |
|------|--------------------------------------|
| Customer | `customer` |
| Owner | `owner` |
| Admin | `admin` |

### Middleware Design

The `authorize.js` middleware is a **factory function** — it takes one or more allowed roles and returns an Express middleware:

```js
// Usage in route files:
router.get('/admin/users',   authenticate, authorize('admin'),           adminController.listUsers);
router.post('/listings',     authenticate, authorize('owner'),           listingController.create);
router.post('/reveal/:id',   authenticate, authorize('customer'),        revealController.reveal);
router.get('/listings',      /* public */                                listingController.listPublic);
```

### Authorization Matrix

| Endpoint Category | Public | Customer | Owner | Admin |
|-------------------|--------|----------|-------|-------|
| View approved listings | ✅ | ✅ | ✅ | ✅ |
| Search & filter | ✅ | ✅ | ✅ | ✅ |
| View listing detail (no phone) | ✅ | ✅ | ✅ | ✅ |
| Reveal contact | ❌ | ✅ | ❌ | ❌ |
| Save/unsave listing | ❌ | ✅ | ❌ | ❌ |
| Purchase subscription | ❌ | ✅ | ❌ | ❌ |
| Create listing | ❌ | ❌ | ✅ | ❌ |
| Edit own listing | ❌ | ❌ | ✅ (own only) | ❌ |
| Delete own listing | ❌ | ❌ | ✅ (own only) | ❌ |
| Approve/reject listing | ❌ | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Manage plans | ❌ | ❌ | ❌ | ✅ |
| View all payments | ❌ | ❌ | ❌ | ✅ |

### Ownership Verification

For owner-scoped operations (edit/delete own listing), the backend compares `listing.owner` to `req.user.id`. Role alone is insufficient — ownership is verified in the service layer:

```
If req.user.role === 'owner' AND listing.owner !== req.user.id → 403 Forbidden
```

This prevents one owner from modifying another owner's listings.

---

## 5. Contact Reveal & Concurrent Duplicate Prevention

### Business Rule

- Exactly 1 credit is deducted per unique `(customer, listing)` pair.
- If the customer has already revealed this listing, return the contact **without** deducting credits.
- Concurrent requests for the same `(customer, listing)` must not cause double deductions.

### D-013 Approved: `pb_hooks` Custom Route with `$app.runInTransaction()`

The entire contact reveal and credit deduction operation runs inside a custom PocketBase server-side hook using a true SQLite ACID transaction. This is the **only** authorized implementation pattern.

**File:** `pocketbase/pb_hooks/reveal.pb.js`
**Route:** `POST /api/custom/reveal` (internal — not public)
**Called by:** `server/src/services/revealService.js` via `pb.send()` using the Admin SDK

### Mandatory Implementation Rules (Binding — from D-013)

1. **All DB operations use `txApp`** — every read and write inside the hook callback uses the transaction-scoped `txApp`, never the outer `$app`. This ensures rollback covers all operations.
2. **Customer identity from auth context only** — the hook reads `e.requestInfo().auth.id` to identify the customer. The `customerId` is **never** accepted from the request body. Express passes only the `listingId`; customer identity is resolved from the authenticated PocketBase session server-side.
3. **Existing reveal → zero credit deduction** — if `revealed_contacts` already has a record for this `(customer, listing)` pair, the hook returns the phone number immediately with no changes to any other collection.
4. **Atomic deduction** — `credits_used + 1` on `user_subscriptions` and the new `revealed_contacts` record are created in the same transaction. If either fails, both roll back. No partial state is ever committed.
5. **Unique index as secondary backstop** — the unique constraint on `(customer, listing)` in `revealed_contacts` is enforced at the database level independent of the transaction, catching any edge case the transaction logic does not.

### Approved Reveal Flow

```
POST /api/v1/reveal/:listingId        (Express — public endpoint)
  │
  ├─ [csrfProtect] — Origin header check
  ├─ [authenticate] — cookie → authRefresh → req.user
  ├─ [authorize('customer')]
  │
  ├─ 1. Load listing by ID → must exist and status = "approved", else 404
  │
  ├─ 2. Call pb.send('POST /api/custom/reveal', { listingId })
  │      using Admin SDK (superuser token) — internal call to pb_hooks route
  │
  │      Inside pb_hooks reveal.pb.js:
  │      $app.runInTransaction((txApp) => {
  │
  │        a. customerId = e.requestInfo().auth.id  ← from auth context, NOT body
  │
  │        b. existingReveal = txApp.findFirstRecord(
  │             'revealed_contacts',
  │             { filter: 'customer=:c && listing=:l', c, l }
  │           )
  │           └─ FOUND → return { phone, alreadyRevealed: true }
  │               (transaction commits with zero changes)
  │
  │        c. subscription = txApp.findFirstRecord(
  │             'user_subscriptions',
  │             { filter: 'user=:u && status="active"', u: customerId }
  │           )
  │           credits_remaining = subscription.credits_total - subscription.credits_used
  │           └─ credits_remaining ≤ 0 → throw Error('INSUFFICIENT_CREDITS')
  │               (transaction rolls back — 402 returned to client)
  │
  │        d. subscription.set('credits_used', credits_used + 1)
  │           txApp.save(subscription)   ← uses txApp, not $app
  │
  │        e. revealRecord = new Record(txApp.findCachedCollectionByNameOrId('revealed_contacts'))
  │           revealRecord.set('customer', customerId)
  │           revealRecord.set('listing', listingId)
  │           revealRecord.set('owner', listing.owner)
  │           txApp.save(revealRecord)   ← uses txApp; unique index enforced here
  │
  │        f. phone = txApp.findFirstRecord('owner_contacts', { filter: 'owner=:o', o: listing.owner }).phone
  │
  │        return { phone, alreadyRevealed: false }
  │      })  ← commit or rollback
  │
  └─ 3. Express returns { phone } to client

```

### Concurrency & Duplicate Prevention

**Primary defence — SQLite ACID transaction:**
The check at step (b) and the write at step (e) are inside the same SQLite transaction. No second concurrent request can observe an intermediate state. Only one transaction can commit for a given `(customer, listing)` pair.

**Secondary defence — Unique index on `(customer, listing)` in `revealed_contacts`:**
If two transactions somehow both pass step (b) simultaneously (extremely unlikely under SQLite's serialized write model), only one `txApp.save(revealRecord)` succeeds. The other receives a constraint-violation error, which triggers a transaction rollback. The calling Express handler catches this error and re-queries the existing reveal record to return the phone number with zero credit change.

**These two defences together make double-deduction architecturally impossible.**

---

## 6. Payment Webhook Verification & Idempotency

### Payment Flow

```
Client                     Express                PocketBase        Payment Provider
  │                           │                       │                    │
  │── Choose plan ───────────▶│                       │                    │
  │                           │── Create payments     │                    │
  │                           │   record (pending) ──▶│                    │
  │◀── paymentId + redirect ──│                       │                    │
  │                           │                       │                    │
  │── Complete payment ──────────────────────────────────────────────────▶│
  │                           │                       │                    │
  │                        [Webhook / Callback]        │                    │
  │                           │◀──────────────────────────────────────────│
  │                           │  POST /api/v1/payments/webhook             │
  │                           │                       │                    │
  │                           │ [Verify webhook signature]                 │
  │                           │  Reject if invalid                         │
  │                           │                       │                    │
  │                           │ [Idempotency check]   │                    │
  │                           │── Load payments record by provider_ref ───▶│
  │                           │  If already status=success → return 200    │
  │                           │  (no duplicate credit addition)            │
  │                           │                       │                    │
  │                           │ [Process success]     │                    │
  │                           │── Update payment status=success ──────────▶│
  │                           │── Create user_subscriptions record ────────▶│
  │                           │── Set credits_total, credits_used=0 ───────▶│
  │                           │                       │                    │
  │◀── Redirect to dashboard ─│                       │                    │
```

### Webhook Signature Verification

Every supported payment provider sends a **cryptographic signature** with the webhook payload. The backend must:

1. Read the raw request body (before JSON parsing).
2. Recompute the expected signature using the **provider's secret key** (stored only in server `.env`).
3. Compare the signatures using a **constant-time comparison** to prevent timing attacks.
4. Reject with `400 Bad Request` if signatures do not match.

**Frontend payment success callbacks are never trusted for credit addition.** Credits are added only after a verified server-side webhook.

### Idempotency Key

Each payment has a unique `provider_ref` (transaction ID from the provider). Before processing any webhook:

1. Query `payments` collection for an existing record with this `provider_ref`.
2. If found with `status = "success"` → return `200 OK` immediately (do nothing).
3. If found with `status = "pending"` → process and update.
4. If not found → reject (possible spoofed webhook).

This ensures that if a provider re-sends a webhook (which all providers may do on timeout), credits are not added twice.

### Payment Service Interface (Provider-Agnostic)

```
server/src/services/paymentService.js
  ├── initiatePayment(planId, userId)      → provider-specific redirect URL
  ├── verifyWebhook(providerName, payload) → verified payment record
  └── providers/
        ├── bkashProvider.js
        ├── sslcommerzProvider.js
        └── stripeProvider.js
```

Each provider module implements a standard interface. The main `paymentService.js` selects the correct provider based on configuration. Adding a new provider does not require changing any other service.

---

## 7. PocketBase Collection Access Rules & Sensitive Data

### Principle

PocketBase collection-level access rules act as a **second defense layer**. Even if Express is bypassed (e.g., someone queries PocketBase directly), sensitive data remains protected.

> **Important PocketBase distinction confirmed by documentation:**
>
> PocketBase has **two completely separate authentication systems**:
>
> | System | Collection | Purpose |
> |--------|------------|---------|
> | **Superusers** | `_superusers` (system) | Manage the PocketBase Admin UI (`/_/`). Bypass ALL collection rules. Absolute unrestricted access. |
> | **App Users** | `users` (application) | End users of ShopFinder. Subject to all collection access rules. |
>
> These two are **not the same**. ShopFinder's `admin` role is an **app user** with
> `role = "admin"` in the `users` collection. Admin users are **not** PocketBase superusers
> and do not automatically bypass collection rules — they are still subject to Express
> middleware and PocketBase access rules, like any other user.
>
> The PocketBase **superuser** account is used only by the Express server (via Admin SDK)
> for backend-to-database operations. It is never exposed to any application user.

### Admin User vs. PocketBase Superuser

| Concern | PocketBase Superuser | ShopFinder Admin User |
|---------|---------------------|-----------------------|
| Stored in | `_superusers` (system collection) | `users` (application collection) |
| Logs into | PocketBase Admin UI `/_/` | ShopFinder Admin Dashboard |
| Role field | N/A | `role = "admin"` |
| Access rules | Bypassed entirely | Enforced via Express + PB rules |
| Token used by | Express Admin SDK internally | Standard login flow (httpOnly cookie) |
| Created by | Developer at setup time | Developer or seeding script |

**Consequence:** PocketBase collection access rules **cannot** rely on `@request.auth.role = "admin"` to grant admin users elevated DB access. All admin-level data operations are performed by the Express backend using the **Superuser Admin SDK token** — not the admin user's own auth token.

### D-014 Approved: Separate `owner_contacts` Collection for Phone Numbers

> **Approved 2026-11-05.** `phone` is **removed from the `users` collection entirely**.
> It is stored in the dedicated `owner_contacts` collection (documented in DATABASE_SCHEMA.md).

**Why not a Hidden field?** PocketBase access rules are record-level only, not field-level. While PocketBase does support marking fields as Hidden (strips them from API responses for non-superuser requests), the separate collection approach is more idiomatic, explicitly deny-all at the PocketBase rule level, and extensible for future private owner data.

**Phone protection layers (all applied simultaneously):**

| Layer | Mechanism |
|-------|-----------|
| Schema | `phone` does not exist on `users` — no accidental expansion possible |
| PocketBase rules | `owner_contacts`: deny all direct access (no view, no list, no create, no update, no delete) |
| Express middleware | `req.user` never contains phone; `apiResponse.js` strips any unexpected phone field |
| Reveal route | Only `pb_hooks/reveal.pb.js` reads `owner_contacts.phone`, inside a transaction, after full auth + credit check |
| No other endpoint | No Express route queries `owner_contacts` directly or returns its data |

### Access Rule Strategy Per Collection

| Collection | List | View | Create | Update | Delete |
|------------|------|------|--------|--------|--------|
| `users` | deny all | `id = @request.auth.id` (own) | public (registration) | Admin SDK only | deny all |
| `owner_contacts` | deny all | deny all | deny all | deny all | deny all |
| `listings` | `status = "approved"` or `owner = @request.auth.id` | same | Admin SDK only | Admin SDK only | Admin SDK only |
| `listing_images` | via approved listing | via approved listing | Admin SDK only | Admin SDK only | Admin SDK only |
| `subscription_plans` | public (active only) | public | Admin SDK only | Admin SDK only | Admin SDK only |
| `user_subscriptions` | deny all | deny all | Admin SDK only | Admin SDK only (txApp) | Admin SDK only |
| `revealed_contacts` | `customer = @request.auth.id` | `customer = @request.auth.id` | deny all (txApp only) | deny all | deny all |
| `saved_listings` | `customer = @request.auth.id` | `customer = @request.auth.id` | Admin SDK | deny all | Admin SDK |
| `payments` | deny all | deny all | Admin SDK only | Admin SDK only | Admin SDK only |
| `notifications` | `user = @request.auth.id` | `user = @request.auth.id` | Admin SDK only | Admin SDK (mark read) | Admin SDK only |

> **Implementation note:** For collections marked "deny all", the PocketBase rule is set
> to empty string `""` which denies all non-superuser access. All writes to these collections
> go through Express using the Admin SDK superuser token stored in `server/.env`.

### Sensitive Data Protection Summary

#### Phone Number

- **Does not exist on `users`** (removed per D-014).
- Stored in `owner_contacts` with deny-all PocketBase access rules.
- Express middleware never receives or attaches phone to `req.user`.
- `apiResponse.js` strips any unexpected phone field from all responses as a final backstop.
- **Only returned** by the `pb_hooks/reveal.pb.js` route inside a fully committed `$app.runInTransaction()` block, after authentication, credit verification, and reveal record creation.

#### Passwords

- Managed entirely by PocketBase — stored as bcrypt hashes.
- Express never receives or stores passwords after the initial `authWithPassword()` call.

#### PocketBase Superuser Credentials

- Used only in `server/src/config/pocketbase.js` via `pb.admins.authWithPassword()`.
- Stored in `server/.env` only. Never committed. Never sent to any client.
- The superuser session is re-authenticated on expiry; the token is never sent to the browser.

#### API Response Sanitization

All Express API responses pass through the `apiResponse.js` sanitizer. Fields stripped before any response:
- `phone` (backstop — should not appear, but stripped defensively)
- `password` / `passwordHash`
- `tokenKey` (internal PocketBase field)
- `emailVisibility`
- Any PocketBase `expand` on `users` or `owner_contacts` beyond explicitly allowed fields

---

## 8. PocketBase Binary Management & Data Storage

### Binary Download & Version Management

- PocketBase is a **single binary** — no installation required.
- The binary (`pocketbase.exe` on Windows, `pocketbase` on Linux/macOS) is **gitignored**.
- Each developer downloads the binary manually from [pocketbase.io/docs](https://pocketbase.io/docs).
- The required PocketBase version will be pinned in `README.md` and `.env.example`.

```
pocketbase/
├── pocketbase.exe     ← gitignored (downloaded per machine)
├── pb_hooks/          ← committed to Git (server-side JS hooks)
│   └── reveal.pb.js  ← custom atomic reveal route
└── .gitkeep           ← keeps folder tracked in Git

# External runtime data directory (D-015):
C:\Users\arifh\AppData\Local\ShopFinder\pb_data\
```

### pb_data Storage (D-015: External Directory Outside OneDrive)

`pb_data/` contains PocketBase's SQLite database (`data.db`, WAL logs), uploaded files, and internal state.

**OneDrive exclusion (D-015):** Windows OneDrive does not provide a local-only per-folder sync exclusion mechanism without deleting local files. To guarantee zero SQLite database corruption or file-locking conflicts from cloud sync, **`pb_data/` is stored completely outside OneDrive and outside the repository** at:
`C:\Users\arifh\AppData\Local\ShopFinder\pb_data\`

- The repository remains at `C:\Users\arifh\OneDrive\Desktop\ShopFinder`.
- No junction or symlink is used; PocketBase is started with the native `--dir` flag.
- Database and runtime files are never committed to Git and never synchronized by OneDrive.
- Root `.gitignore` retains `pocketbase/pb_data/` as a safety backstop.

### Schema Migration

PocketBase stores its schema inside the external `pb_data/`. To share schema between developers or environments:

- Initial schema setup will be **documented step-by-step** in a setup guide.
- PocketBase's export feature (`pb_data/data.db` export) will be used for schema snapshots.
- In a future phase, a `pocketbase/pb_migrations/` folder may be used for scripted migrations.

### Backup Strategy

| Environment | Strategy |
|-------------|----------|
| Development | Manual — developer's local machine |
| Production | Scheduled backup of `pb_data/` directory to external storage |

Backup scripts will be documented in Phase 14 (Deployment Preparation).

### Starting PocketBase

```bash
# From the project root:
.\pocketbase\pocketbase.exe serve --http="127.0.0.1:8090" --dir="C:\Users\arifh\AppData\Local\ShopFinder\pb_data" --hooksDir="C:\Users\arifh\OneDrive\Desktop\ShopFinder\pocketbase\pb_hooks"

# Or from inside the pocketbase/ directory:
.\pocketbase.exe serve --http="127.0.0.1:8090" --dir="C:\Users\arifh\AppData\Local\ShopFinder\pb_data" --hooksDir="pb_hooks"

# Admin UI available at:
http://127.0.0.1:8090/_/
```

PocketBase runs on port `8090` (internal only). It is **not** exposed to the public internet directly — traffic goes through Express on port `4000`.

---

## 9. Environment Variable Management

### Separation Principle

| Secret Type | Location | Committed? |
|-------------|----------|------------|
| PocketBase Admin email/password | `server/.env` | ❌ Never |
| PocketBase URL (internal) | `server/.env` | ❌ (varies per environment) |
| Payment provider secret keys | `server/.env` | ❌ Never |
| JWT / session secret | `server/.env` | ❌ Never |
| Frontend API base URL | `client/.env` | ✅ (not a secret) |
| PocketBase public URL | `client/.env` | ✅ (if needed for file URLs) |

### Template Files

`server/.env.example` — committed to Git, contains placeholder values:

```env
# Server
PORT=4000
NODE_ENV=development

# PocketBase
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=your_admin@example.com
POCKETBASE_ADMIN_PASSWORD=your_secure_password

# Payment Providers (add keys when provider is chosen)
BKASH_APP_KEY=
BKASH_APP_SECRET=
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Frontend
CLIENT_URL=http://localhost:5173
```

`client/.env.example` — committed:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### Runtime Validation

At server startup, `server/src/config/env.js` validates all required environment variables using **zod**. If any required variable is missing or empty, the server **refuses to start** with a clear error message. This prevents silent misconfiguration in production.

### Frontend Rules

- Vite exposes only variables prefixed with `VITE_` to the browser bundle.
- **No secret keys are ever prefixed with `VITE_`.**
- The frontend only knows the Express API base URL — never the PocketBase URL, admin credentials, or payment secrets.

---

## 10. Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth provider | PocketBase built-in | Avoids extra auth service, includes JWT, bcrypt, user management |
| API pattern | Express REST (not direct PocketBase from client) | Enforces server-side business rules; PocketBase is a private internal DB |
| Token verification | Per-request `new PocketBase()` + `authRefresh()` | Shared singleton causes race conditions; authRefresh checks live revocation |
| Token storage | httpOnly cookie with Secure, SameSite=Strict, CORS allowlist, Origin/CSRF check (D-010 approved) | Protects auth token from XSS; origin check protects against CSRF; resolved at start of Phase 1 |
| Admin role | `role = "admin"` in `users` collection (app user) | PocketBase superuser is internal-only; app admin uses ShopFinder's own dashboard |
| Atomic reveal operation | `pb_hooks` `$app.runInTransaction()` with `txApp` (D-013 approved) | True SQLite ACID transaction; closes race window; architectural decision resolved before Phase 2, implementation in Phase 10 |
| Phone field protection | Separate `owner_contacts` collection with deny-all rules (D-014 approved) | Phone completely removed from `users` collection; resolved before Phase 2 |
| Frontend bundler | Vite | Fast HMR, modern default for React |
| State management | React Context + hooks | Lightweight, no Redux overhead at this stage |
| Payment layer | Pluggable provider interface | Supports bKash / SSLCommerz / Stripe without rewriting business logic |
| Duplicate reveal prevention | Unique DB index (secondary) + atomic transaction (primary) | Belt-and-suspenders: transaction prevents race; unique index is final backstop |
| Payment idempotency | `provider_ref` unique key + status check | Prevents double credit addition from provider webhook retries |
| Schema sharing | Manual documentation + step-by-step setup guide | Appropriate for team size; migrations can be added later |
| Secret management | Server `.env` only; Vite `VITE_` prefix guard | Prevents secrets from leaking into the browser bundle |
