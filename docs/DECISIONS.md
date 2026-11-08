# ShopFinder — Decisions Log

## Format
Each entry records: decision number, date, what was decided, reason, and who authorized it.

---

## D-001: Billing Policy (One-time Credit Packages vs. Recurring Subscriptions) — **APPROVED**
- **Date approved:** 2026-11-08
- **Status:** ✅ Approved
- **Decision:**
  Customer subscription plans are **one-time credit packages**, NOT recurring subscriptions.
  - **Plan Catalog:** Starter (৳299 / 10 credits) and Pro (৳999 / 100 credits).
  - **Payment Model:** Customers purchase credits through a one-time payment. There is no automatic monthly renewal, recurring billing, or subscription auto-debit.
  - **Credit Validity:** Credits never expire. Newly allocated packages set `expires_at = null`. No automatic expiration, expiration cron jobs, background workers, or renewal schedulers. The existing nullable `expires_at` database field is preserved without schema changes.
  - **Credit Stacking & Aggregation:** Multiple purchases by the same customer aggregate. Each purchase creates a separate `user_subscriptions` record retaining its own `credits_total` and `credits_used`. Remaining credits are calculated per record as `max(0, credits_total - credits_used)`. Customer balance is the sum of remaining credits across all active records. A new purchase never overwrites or resets existing balances. Individual purchase history is preserved.
  - **Lifecycle Semantics:**
    - `active`: package has available credit or remains an active credit record.
    - `cancelled`: package is administratively cancelled under an authorized policy.
    - `expired`: reserved for future exceptional/manual policy; non-expiring packages do not automatically expire.
    - `expires_at = null`: standard state for newly allocated packages.
- **Reason:**
  1. **Bangladesh Payment Ecosystem Alignment:** Major digital payment systems in Bangladesh (bKash, Nagad, Rocket, local debit cards) natively support one-time checkout flows. Recurring auto-debit mandates carry high friction, strict regulatory limits, and high failure rates.
  2. **Product Clarity:** Prepaid credits mirror the commercial real estate contact reveal mental model (buy credits as needed to unlock property owner phone numbers).
  3. **Architectural Simplicity:** Eliminates complex recurring renewal workers, failed payment retries, and credit rollover dispute edge cases while natively supporting credit stacking.
- **Architectural & Scope Boundaries:**
  - Phase 9 remains payment-provider agnostic; real payment gateway integration is deferred to Phase 11.
  - Contact reveal credit deduction remains atomic inside the `pb_hooks/reveal.pb.js` transaction using `txApp` (Phase 10, D-013). Express never performs ad-hoc credit deductions.
- **Authorized by:** Project operator approval 2026-11-08

---

## D-002: Listing Re-Approval Policy (Core Edits & Image Modifications) — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved
- **Decision:**
  Any permitted core-field edit or successful image modification to an already approved listing automatically changes its status to `pending`, requiring Admin re-approval before it becomes publicly visible again.

### Detailed Policy

**A. Core Listing Field Edits**

The following nine permitted fields trigger re-approval when changed on an approved listing:
- `title`
- `description`
- `price`
- `area_sqft`
- `address`
- `city`
- `area`
- `category`
- `listing_type`

Status behavior:

| Existing status | After core-field edit |
|---|---|
| approved | pending |
| pending | pending |
| rejected | rejected |

**B. Image Modifications**

Any successful image modification on an approved listing triggers re-approval.

Covered operations:
- Upload one or more images: `POST /api/v1/listings/:id/images`
- Delete an image: `DELETE /api/v1/listings/:id/images/:imageId`
- Change cover image: `PATCH /api/v1/listings/:id/images/:imageId/cover`
- Reorder images: `PUT /api/v1/listings/:id/images/order`

Status behavior:

| Existing status | After image modification |
|---|---|
| approved | pending |
| pending | pending |
| rejected | rejected |
| archived | archived |

Additional rules:
- Failed image operations must not change listing status.
- A failed multi-image upload batch must not trigger a status transition.
- A listing's status must never be changed by a client-supplied status field.

**C. Client Status Override Prevention**
- Clients cannot directly set or override listing status.
- Creation and update validators reject privileged fields such as `status`, `owner`, `is_featured`, and `rejection_note`.
- Status transitions are enforced server-side through the Express service layer and PocketBase Admin SDK.

**Impact:**
This decision governs:
- Owner listing creation and editing in Phase 6.
- Image management in Phase 6.
- Public marketplace visibility in Phase 5.
- Admin review and approval workflows in Phase 7.

**Authorization:** Project operator approval.

---

## D-003: First Payment Provider
- **Status:** ❓ Not yet decided
- **Options:** bKash, SSLCommerz, Stripe
- **Impact:** Determines Phase 11 (Payment & Notifications) implementation details.
- **Note:** Architecture is provider-agnostic; only the adapter changes.

---

## D-004: PocketBase Hosting
- **Status:** ❓ Not yet decided
- **Options:** Local binary only, PocketHost (managed), self-hosted VPS
- **Impact:** Deployment plan and Phase 14 (Deployment Preparation).

---

## D-005: Owner Subscription Plans at Launch
- **Date:** 2026-11-05
- **Decision:** Owner listing submission is FREE. Owner subscription plans are architecturally supported but NOT part of initial implementation.
- **Authorized by:** Master Development Guidelines (project brief)

---

## D-006: Technology Stack Locked
- **Date:** 2026-11-05
- **Decision:** React 18 + Tailwind + shadcn/ui + React Router (frontend), Node.js + Express (backend), PocketBase (DB + Auth). No Next.js, TypeScript, Prisma, PostgreSQL, or Better Auth without explicit authorization.
- **Authorized by:** Master Development Guidelines (project brief)

---

## D-007: Architecture — Client Never Talks to PocketBase Directly
- **Date:** 2026-11-05
- **Decision:** The React frontend communicates exclusively with the Express backend. PocketBase is an internal database — not exposed to the client. All PocketBase operations go through Express using the Admin SDK with server-only credentials.
- **Authorized by:** Architecture review 2026-11-05

---

## D-008: Duplicate Reveal Prevention Strategy (Superseded by D-013)
- **Date:** 2026-11-05
- **Original decision:** Primary defense was a unique index on `(customer, listing)` in `revealed_contacts` only.
- **Status:** ⚠️ Superseded — D-013 approved a fully atomic `pb_hooks` transaction as the primary defense. The unique index is retained as a secondary backstop.

---

## D-009: Payment Idempotency Strategy
- **Date:** 2026-11-05
- **Decision:** Each payment record has a unique `provider_ref` (provider transaction ID). On webhook receipt: verify signature, check if `provider_ref` already processed (status=success), and skip if so. Frontend payment callbacks are never trusted for credit addition.
- **Authorized by:** Architecture review 2026-11-05

---

## D-010: Frontend Token Storage — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved
- **Decision:** Use **httpOnly cookies** for storing the PocketBase auth token on the frontend.
- **Requirements enforced:**
  - Cookie set with `HttpOnly`, `Secure` (production), `SameSite=Strict` flags.
  - Express CORS configured to allow only the known frontend origin (`CLIENT_URL`), with `credentials: true`.
  - All state-changing API requests validated against an `Origin` / `Referer` header check on the Express side as CSRF protection (double-submit or origin-check pattern).
  - Express never reads the token from request body or URL — only from the `Cookie` header.
  - No token is ever stored in `localStorage` or React state.
- **Resolved at:** Start of Phase 1 (before scaffolding the auth layer).
- **Authorized by:** Project operator approval 2026-11-05

---

## D-011: PocketBase Binary & pb_data Management
- **Date:** 2026-11-05
- **Decision:** PocketBase binary and `pb_data/` must never be committed to Git. `pb_data/` must also be excluded from OneDrive sync to prevent database corruption. This is a binding requirement documented in Phase 0; the root `.gitignore` specifying these exclusions will be created during Phase 1 (Task 1.1). Required PocketBase version will be pinned in `README.md`.
- **Authorized by:** Architecture review 2026-11-05

---

## D-012: Environment Variable Validation at Startup
- **Date:** 2026-11-05
- **Decision:** `server/src/config/env.js` validates all required env vars using zod at server startup. Missing or empty required vars cause the server to refuse to start. Frontend only uses `VITE_`-prefixed vars; no secrets ever use this prefix.
- **Authorized by:** Architecture review 2026-11-05

---

## D-013: Atomic Reveal Operation Strategy — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved — Option B selected
- **Decision:** Use a **PocketBase `pb_hooks` custom route** with `$app.runInTransaction()` for the contact reveal and credit deduction operation.
- **Mandatory implementation requirements (binding):**
  1. All database reads and writes inside the reveal hook **must** use the `txApp` callback argument — never the outer `$app`. This ensures all operations participate in the same SQLite transaction and roll back together on any failure.
  2. The unique constraint on `(customer, listing)` in `revealed_contacts` **must** be enforced at the database level. It acts as a secondary backstop even inside the transaction.
  3. The hook **must** check `revealed_contacts` first. If the record already exists for this `(customer, listing)` pair, return the phone number immediately with **zero credit deduction** — no exception.
  4. Credit deduction (`credits_used + 1`) and `revealed_contacts` record creation **must** be in the same transaction. If either operation fails, both roll back. Partial state is never committed.
  5. **Customer identity resolution via trusted Express delegation (D-017):** The browser client never supplies a trusted customer identity. Express authenticates the customer session (via httpOnly cookie) and derives customer identity strictly from verified `req.user.id`. Express passes that verified `customerId` to the internal PocketBase route in the internal request payload over its superuser-authenticated server-side connection. PocketBase independently validates the delegated customer record inside the transaction using `txApp` (verifying existence, `role === 'customer'`, and `is_active === true`). In this `$apis.requireSuperuserAuth()` protected route, `e.requestInfo().auth.id` identifies the PocketBase superuser and must not be used as the customer ID.
  6. The `pb_hooks` route is called by Express using the **PocketBase Admin SDK** (superuser token stored only in `server/.env`). This endpoint is not reachable by any public client.
- **Architectural impact:**
  - Adds `pocketbase/pb_hooks/` directory to the project.
  - Adds `pocketbase/pb_hooks/reveal.pb.js` (the custom route handler).
  - `revealService.js` in Express delegates to this hook via `pb.send('/api/custom/reveal', ...)`.
  - Folder structure in `ARCHITECTURE.md` updated accordingly.
- **Resolved:** Architecture documented before Phase 2; implementation in Phase 10 (Contact Reveal Engine). Identity delegation clarified and approved under D-017 before Task 10.2.
- **Authorized by:** Project operator approval 2026-11-05 (identity delegation clarified 2026-11-08)

---

## D-014: Phone Number Field Protection Strategy — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved — Option 2 selected
- **Decision:** Use a **separate `owner_contacts` collection** to store owner phone numbers. The `phone` field is **removed from the `users` collection entirely**.
- **Mandatory implementation requirements (binding):**
  1. The `owner_contacts` collection holds `owner` (relation → users, unique index, cascade delete: true) and `phone` (text, required, min 6, max 30).
  2. PocketBase access rules on `owner_contacts`: all five rules (List, View, Create, Update, Delete) are locked (`null` / deny all). Owners access their own phone information through Express endpoints via the Superuser Admin SDK, never via direct PocketBase queries. All direct client/public access is denied at the PocketBase rule level.
  3. Direct public or client access to `owner_contacts` is denied. No Express endpoint exposes `owner_contacts` records directly.
  4. The **only** way a phone number leaves the system is through `revealService.js` → `pb_hooks` reveal route, after a fully authenticated, credit-verified, atomically committed reveal operation.
  5. `owner_contacts` is created by the Express backend (using the Admin SDK) when an owner registers or updates their profile — not by any client directly.
  6. `apiResponse.js` sanitizer explicitly omits any `expand` of `owner_contacts` from all API responses other than the reveal endpoint.
- **Schema impact:** `DATABASE_SCHEMA.md` updated — `phone` removed from `users`; `owner_contacts` collection added.
- **Resolved:** Before Phase 2 (Database Architecture); data retrieval in Phase 10 (Contact Reveal Engine).
- **Authorized by:** Project operator approval 2026-11-05

---

## D-015: PocketBase External pb_data Directory Outside OneDrive — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved — Option A selected
- **Decision:** Store PocketBase runtime data and SQLite database files (`pb_data/`) in a dedicated directory **completely outside OneDrive and outside the Git repository**, at `C:\Users\arifh\AppData\Local\ShopFinder\pb_data\`. The repository and source code remain at `C:\Users\arifh\OneDrive\Desktop\ShopFinder`.
- **Reason:** OneDrive does not provide a local-only folder sync exclusion mechanism without deleting local files or modifying global machine group policies. Running active SQLite database files (`data.db`, `data.db-wal`, `data.db-shm`) inside an active OneDrive sync hierarchy creates severe risks of file locking, sync race conditions, and database corruption. Storing `pb_data` in `AppData\Local` provides native OS-level exclusion from cloud sync.
- **Implementation & Startup Requirements:**
  1. **PocketBase Binary:** Stored at `pocketbase/pocketbase.exe` (gitignored).
  2. **PocketBase Hooks:** Stored at `pocketbase/pb_hooks/` inside the repository (committed to Git).
  3. **Data Directory:** Stored at `C:\Users\arifh\AppData\Local\ShopFinder\pb_data\` (outside repository and outside OneDrive).
  4. **Startup Configuration:** PocketBase must be launched with explicit CLI flags pointing to both the external data directory and the in-repo hooks directory:
     ```cmd
     .\pocketbase\pocketbase.exe serve --http="127.0.0.1:8090" --dir="C:\Users\arifh\AppData\Local\ShopFinder\pb_data" --hooksDir="C:\Users\arifh\OneDrive\Desktop\ShopFinder\pocketbase\pb_hooks"
     ```
  5. **No Junctions or Symlinks:** The external data directory is referenced directly via PocketBase's native `--dir` flag. No NTFS junctions or symbolic links are created.
  6. **Security & Commit Rules:** Database files, SQLite WAL logs, and file uploads reside outside Git and must never be committed to version control or synchronized across OneDrive.
- **Authorized by:** Project operator approval 2026-11-05

---

## D-016: Listing Images Architecture, Per-Listing Limit & Access Boundaries — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved
- **Decision:**
  1. **Collection Structure:** `listing_images` (`pbc_588048942`) is a standalone base collection with a relation to `listings` (`cascadeDelete: true`), supporting multiple images per listing.
  2. **Image Capacity Limit:** The per-listing cap of maximum 20 images is enforced at the Express API layer in Phase 6, Task 6.3 (`POST /api/v1/listings/:id/images`). Individual PocketBase image records enforce `maxSelect: 1`.
  3. **MIME Types & Sizing:** Allowed formats are strictly `image/jpeg`, `image/png`, and `image/webp`. SVG and GIF are prohibited. Max file size is 5,242,880 bytes (5 MB). Generated thumbnails: `100x100`, `400x300`, and `800x600`.
  4. **Access Rules & Permissions:** Read operations (`listRule` and `viewRule`) allow public viewing for approved listings (`listing.status = "approved"`) and owner viewing across all statuses (`listing.owner = @request.auth.id`). All mutation operations (`createRule`, `updateRule`, `deleteRule`) are locked (`null`) and mediated exclusively through Express via the Superuser Admin SDK.
  5. **Cascade Deletion:** PocketBase automatically deletes child image records and purges physical files and thumbnails from disk storage when a parent listing is deleted.
- **Authorized by:** Project operator approval 2026-11-05

---

## D-017: Trusted Express Identity Delegation for Internal Contact Reveal — **APPROVED**
- **Date approved:** 2026-11-08
- **Status:** ✅ Approved — Option A selected
- **Decision:**
  Resolve customer identity across the Express-to-PocketBase boundary via **Trusted Express Identity Delegation** with server-side PocketBase validation.

### Detailed Policy

**A. Browser → Express Boundary**
- The browser authenticates through the existing httpOnly session cookie (`pb_auth`).
- Express validates the session using the existing `authenticate` middleware (`authRefresh`).
- Express enforces customer role authorization using `authorize('customer')`.
- Customer identity is obtained exclusively from the verified server-side `req.user.id`.
- A browser-supplied `customerId` (in query, body, or headers) must never determine or override the reveal identity; client overrides are strictly rejected.

**B. Express → PocketBase Internal Boundary**
- Express invokes the internal PocketBase reveal route (`POST /api/custom/reveal`) using the server-side PocketBase Admin SDK client singleton (`getAdminClient()`) with superuser credentials.
- The trusted Express backend supplies `customerId` (`req.user.id`) and `listingId` in the internal JSON request payload.
- The internal route remains protected by `$apis.requireSuperuserAuth()`, preventing direct browser or unauthorized access.
- PocketBase recognizes that in superuser-protected routes, `e.requestInfo().auth.id` represents the PocketBase superuser, NOT the customer.

**C. PocketBase Hook Validation (Inside SQLite Transaction)**
Inside `$app.runInTransaction((txApp) => { ... })`:
1. Require the trusted internal payload's `customerId`.
2. Reject missing, malformed, or invalid customer IDs with HTTP 400.
3. Load the corresponding user using `txApp.findRecordById("users", customerId)`.
4. Verify the user record exists (or throw HTTP 404).
5. Verify `user.get("role") === 'customer'` (reject non-customer identities with HTTP 400).
6. Verify `user.get("is_active") === true` (reject deactivated customers with HTTP 400).
7. Reject all other identities.
8. Use only this validated customer record for all subsequent reveal operations (idempotency check, subscription credit verification, credit deduction, and reveal record creation).

### Security Invariants
- Browser clients cannot directly call the internal PocketBase route (D-007, `$apis.requireSuperuserAuth()`).
- Browser-supplied `customerId` is never trusted.
- Express must derive identity exclusively from its authenticated session cookie.
- PocketBase must independently validate the delegated customer record inside the SQLite transaction using `txApp`.
- No unsigned custom identity header or forwarded customer token is introduced.
- `$apis.requireSuperuserAuth()` remains mandatory.
- All transaction-scoped database operations use `txApp` (D-013).
- D-007, D-010, D-013 transaction requirements, and D-014 remain fully intact.
- **Authorized by:** Project operator approval 2026-11-08

---

## D-018: Subscription Plans Configuration, Access Rules & Indexing — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved
- **Decision:**
  1. **Collection Structure:** `subscription_plans` (`pbc_2775741768`) is a base collection defining catalog plans with fields: `name` (text, required, min 2, max 50, unique index), `price` (number, min 0; 0 allowed for free trial plans, missing price rejected via hook), `credits` (number, required, min 1), `is_active` (bool, default `true` when omitted via hook, explicit `false` preserved), `description` (text, optional, max 500).
  2. **Access Rules:** Public/customer list and view rules are strictly `is_active = true`. Inactive plans return 404 to public clients. All mutation rules (`createRule`, `updateRule`, `deleteRule`) are locked (`null`) and mediated exclusively by Express via the Superuser Admin SDK.
  3. **Indexing:** Enforces `CREATE UNIQUE INDEX idx_subscription_plans_name ON subscription_plans (name)` and `CREATE INDEX idx_subscription_plans_active ON subscription_plans (is_active)`.
  4. **Scope Isolation:** Task 2.6 establishes the catalog schema only. Seeding Starter (৳299 / 10 credits) and Pro (৳999 / 100 credits) records remains deferred to Task 2.13. Customer subscription purchase tracking remains in Task 2.7 (`user_subscriptions`).
- **Authorized by:** Project operator approval 2026-11-05




