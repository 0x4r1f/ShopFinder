# ShopFinder — Decisions Log

## Format
Each entry records: decision number, date, what was decided, reason, and who authorized it.

---

## D-001: Billing Policy (Recurring vs. One-Time)
- **Status:** ❓ Not yet decided
- **Question:** Are customer subscription plans one-time credit packages or recurring subscriptions?
- **Impact:** Affects `user_subscriptions` schema, payment flow, and credit expiry logic.
- **Action required:** Project operator must decide before Phase 9 (Subscription System).

---

## D-002: Listing Edit → Status Revert
- **Status:** ❓ Not yet decided
- **Question:** When an owner edits an approved listing, does it revert to `pending` for re-approval?
- **Impact:** Affects listing edit endpoint and owner dashboard UX.
- **Action required:** Decide before Phase 6 (Owner Module).

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
  5. The `pb_hooks` route **must not accept a `customerId` from the request body**. The customer identity is derived exclusively from the authenticated PocketBase auth context (`e.requestInfo().auth`) — never from client-supplied data. Express passes only the `listingId`; customer identity is resolved server-side.
  6. The `pb_hooks` route is called by Express using the **PocketBase Admin SDK** (superuser token stored only in `server/.env`). This endpoint is not reachable by any public client.
- **Architectural impact:**
  - Adds `pocketbase/pb_hooks/` directory to the project.
  - Adds `pocketbase/pb_hooks/reveal.pb.js` (the custom route handler).
  - `revealService.js` in Express delegates to this hook via `pb.send('/api/custom/reveal', ...)`.
  - Folder structure in `ARCHITECTURE.md` updated accordingly.
- **Resolved:** Architecture documented before Phase 2; implementation in Phase 10 (Contact Reveal Engine).
- **Authorized by:** Project operator approval 2026-11-05

---

## D-014: Phone Number Field Protection Strategy — **APPROVED**
- **Date approved:** 2026-11-05
- **Status:** ✅ Approved — Option 2 selected
- **Decision:** Use a **separate `owner_contacts` collection** to store owner phone numbers. The `phone` field is **removed from the `users` collection entirely**.
- **Mandatory implementation requirements (binding):**
  1. The `owner_contacts` collection holds `owner` (relation → users) and `phone` (text, required for owners).
  2. PocketBase access rule on `owner_contacts`: view/list restricted to `owner = @request.auth.id` (owner reads own record only). All other access denied at the PocketBase rule level.
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


