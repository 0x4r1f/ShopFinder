# ShopFinder — Development Plan

## Official 15-Phase Development Roadmap

---

### PHASE 0 — Workspace Inspection ✅
- [x] Inspect complete workspace directory and confirm clean slate (0 files)
- [x] Check system environment: Node.js (v24.14.0), npm (v11.10.1), Git (v2.55.0)
- [x] Identify environment constraints (pnpm EPERM workaround using npm, OneDrive path risk for `pb_data/`)
- [x] Define application architecture, database schema, security rules, and development roadmap
- [x] Initialize mandatory project documentation in `docs/`

---

### PHASE 1 — Project Foundation
> Status: Completed ✅

Tasks:
- [x] 1.1 Initialize Git repository and root `.gitignore` (excluding `pb_data/`, `node_modules/`, `.env`)
- [x] 1.2 Scaffold Express backend (`server/`) with centralized error handler, logger, and apiResponse utilities
- [x] 1.3 Configure environment variable validation via Zod (`server/src/config/env.js`) and `.env.example` templates
- [x] 1.4 Scaffold React frontend using Vite (`client/`)
- [x] 1.5 Configure Express security & cookie infrastructure: `cookie-parser`, strict CORS whitelist (`CLIENT_URL` with credentials: true), Origin-check CSRF protection (D-010)
- [x] 1.6 Download and configure PocketBase binary; set up `pocketbase/pb_hooks/` and `pocketbase/pb_data/` directory structure with OneDrive exclusion
- [x] 1.7 Create root `README.md` with environment requirements and setup documentation
- [x] 1.8 Phase 1 Integration Baseline & Multi-Service Verification (concurrent PocketBase, Express, and Vite health checks, CORS & CSRF regression, localhost binding, and clean teardown)
- [x] 1.9 Phase 1 Git Baseline & Initial Commit

---

### PHASE 2 — Database Architecture
> Status: In Progress 🔄

Tasks:
- [x] 2.1 Run PocketBase locally (`127.0.0.1:8090`) and initialize administrative access
- [x] 2.2 Configure `users` collection (PocketBase auth collection: email, password, name, role `customer`/`owner`/`admin`, avatar, is_active; phone completely removed per D-014)
- [x] 2.3 Create `owner_contacts` collection (fields: `owner` relation to users, `phone` text; unique index on `owner`; deny-all public/client access rules per D-014)
- [x] 2.4 Create `listings` collection (fields: `owner`, `title`, `description`, `category`, `listing_type`, `price`, `area_sqft`, `address`, `city`, `area`, `status`, `rejection_note`, `is_featured`)
- [x] 2.5 Create `listing_images` collection (fields: `listing` relation, `image` file, `is_cover`, `order`)
- [x] 2.6 Create `subscription_plans` collection (fields: `name`, `price`, `credits`, `is_active`, `description`)
- [x] 2.7 Create `user_subscriptions` collection (fields: `user` relation, `plan` relation, `credits_used`, `credits_total`, `status`, `purchased_at`, `expires_at`)
- [x] 2.8 Create `revealed_contacts` collection (fields: `customer` relation, `listing` relation, `owner` relation, `revealed_at`; unique index on `(customer, listing)`)
- [x] 2.9 Create `saved_listings` collection (fields: `customer` relation, `listing` relation, `saved_at`; unique index on `(customer, listing)`)
- [ ] 2.10 Create `payments` collection (fields: `user` relation, `plan` relation, `subscription` relation, `amount`, `currency`, `provider`, `provider_ref`, `status`)
- [ ] 2.11 Create `notifications` collection (fields: `user` relation, `type`, `message`, `is_read`)
- [ ] 2.12 Set collection-level access rules (deny-all default for sensitive collections; backend Admin SDK only)
- [ ] 2.13 Seed initial subscription plans (Starter ৳299/10cr, Pro ৳999/100cr)

---

### PHASE 3 — Authentication & Authorization
> Status: COMPLETED ✅

Tasks:
- [x] 3.1 Initialize server-side PocketBase Admin SDK client singleton (`server/src/config/pocketbase.js`)
- [x] 3.2 Implement authentication endpoints in Express: registration (`POST /api/v1/auth/register`), login (`POST /api/v1/auth/login`), logout (`POST /api/v1/auth/logout`)
- [x] 3.3 Set up server-set httpOnly cookies (`pb_auth`) with `HttpOnly`, `Secure` (production), `SameSite=Strict`, `path=/` (D-010)
- [x] 3.4 Implement request-scoped JWT verification middleware (`authenticate.js` using isolated `new PocketBase()` + `authRefresh()`)
- [x] 3.5 Implement role-based authorization middleware factory (`authorize.js`) for `customer`, `owner`, and `admin` roles
- [x] 3.6 Implement user profile endpoints (`GET /api/v1/users/me`, `PATCH /api/v1/users/me`) with strict sanitization (phone excluded)
- [x] 3.7 Implement frontend Auth Context (`AuthContext.jsx`), authentication API service layer, and role-based route guard component (`ProtectedRoute.jsx`)
- [x] 3.8 Build Login and Registration pages in client (`client/src/pages/LoginPage.jsx`, `RegisterPage.jsx`)

---

### PHASE 4 — UI Foundation
> Status: COMPLETED ✅

Tasks:
- [x] 4.1 Install and configure Tailwind CSS and theme tokens in `client/`
- [x] 4.2 Set up shadcn/ui component library structure (`components.json`, `@/` alias, theme tokens, `Button`, `Input`, `Label` primitives)
- [x] 4.3 Configure React Router layout hierarchy (`AppRouter.jsx`)
- [x] 4.4 Build global layout components: Header with role-aware navigation, Footer, Mobile Navigation menu, and Sidebar
- [x] 4.5 Build reusable UI feedback components (Toast/Notification banner, Loading Spinner, Empty State, Error Boundary)
- [x] 4.6 Set up centralized client API service instance (Fetch/Axios client configured with `credentials: 'include'`)

---

### PHASE 5 — Homepage & Marketplace: COMPLETED ✅

Tasks:
- [x] 5.1 Build Homepage: Hero search banner, property category grid, quick city selector, featured commercial listings carousel/grid, value proposition section
- [x] 5.2 Build Marketplace browse page with responsive grid and list view toggles
- [x] 5.3 Implement multi-parameter search & filtering (category, rent/sale, price range, area sqft, city, area)
- [x] 5.4 Implement sorting controls (newest, price ascending/descending) and server-side pagination
- [x] 5.5 Build Property Details page: photo gallery/carousel, key specifications, price, detailed description, location address, amenities list
- [x] 5.6 Build safe owner information card with masked contact information and placeholder "Reveal Contact" button (hooks into Phase 10)
- [x] 5.7 Enforce public API response sanitization ensuring owner phone numbers never appear in listing queries or relation expansions

---

### PHASE 6 — Owner Module
> **Requires authorization before starting**

Tasks:
- [x] 6.1 Implement listing creation endpoint (`POST /api/v1/listings`) defaulting new submissions to `pending` status
- [x] 6.2 Implement owner listing editing & deletion endpoints with strict ownership verification (`listing.owner === req.user.id`)
- [x] 6.3 Implement listing image upload endpoint supporting multiple photos and cover photo selection
- [x] 6.4 Formally document D-002 listing re-approval policy (core-field edits and image modifications on approved listings revert status to pending).
- [x] 6.5 Build Owner Dashboard: My Listings table with status badges (`pending`, `approved`, `rejected`), listing view counter
- [x] 6.6 Build Property Creation & Editing forms with image uploader, accessible reordering, and client-side validation
- [x] 6.7 Build Owner Business Profile management page (store contact phone into `owner_contacts` via backend Admin SDK per D-014)

---

### PHASE 7 — Admin Module
> **Requires authorization before starting**

Tasks:
- [x] 7.1 Build Admin Dashboard overview: total listings, pending review count, user counts, system activity
- [x] 7.2 Implement Admin review queue endpoint (`GET /api/v1/admin/listings/pending`)
- [x] 7.3 Implement Admin approval actions (`POST /api/v1/admin/listings/:id/approve`, `POST /api/v1/admin/listings/:id/reject` with rejection note, `archive`)
- [x] 7.4 Build Admin Listing Review interface with preview, one-click approve, and rejection modal with mandatory reason
- [x] 7.5 Implement Admin User Management endpoints and UI (list users, filter by role, activate/deactivate accounts)
- [x] 7.6 Enforce authorization: ensure owners cannot approve their own listings; admin operations restricted strictly to `role = 'admin'`

---

### PHASE 8 — Customer Module
> **Requires authorization before starting**

Tasks:
- [x] 8.1 Implement Favorite/Saved listings endpoints (`POST /api/v1/favorites/:listingId`, `DELETE /api/v1/favorites/:listingId`, `GET /api/v1/favorites`)
- [x] 8.2 Build Customer Dashboard: credit balance summary widget, recent activity feed, quick links
- [x] 8.3 Build Saved Listings page with quick unsave and property card links
- [x] 8.4 Build Customer Profile management page (update name, email, avatar)
- [x] 8.5 Build Customer Reveal History container (prepared to display data populated by Phase 10)

---

### PHASE 9 — Subscription System
> **Requires authorization before starting**

Tasks:
- [x] 9.1 Resolve D-001: Finalize customer billing policy (recurring subscription vs. one-time credit package)
- [x] 9.2 Implement Subscription Plans endpoints (`GET /api/v1/subscriptions/plans`, Admin plan management endpoints)
- [x] 9.3 Implement customer active subscription tracking & credit balance query service (`user_subscriptions`)
- [x] 9.4 Build Subscription Plans pricing page displaying Starter (৳299 / 10 credits) and Pro (৳999 / 100 credits)
- [x] 9.5 Build plan selection flow and credit balance indicator in header and customer dashboard

---

### PHASE 10 — Contact Reveal Engine
> **Requires authorization before starting**

Tasks:
- [x] 10.1 Implement PocketBase custom route `pocketbase/pb_hooks/reveal.pb.js` using `$app.runInTransaction()` and `txApp` (D-013)
- [x] 10.2 Enforce customer identity through trusted Express delegation and PocketBase validation (D-017)
- [x] 10.3 Implement idempotent check in hook: return owner contact immediately with zero credit deduction if previously revealed by this customer
- [x] 10.4 Verify customer active subscription and credit balance (`credits_remaining > 0`); abort with transaction rollback if insufficient
- [x] 10.5 Atomically increment `credits_used` and create `revealed_contacts` record using `txApp` with database unique constraint backstop
- [x] 10.6 Retrieve private owner phone from `owner_contacts` collection (D-014) only on committed transaction
- [x] 10.7 Implement Express reveal route (`POST /api/v1/customer/reveal` & `POST /api/v1/reveal/:listingId`) with CSRF/Origin check, auth, and role verification
- [ ] 10.8 Implement Customer Reveal History endpoint (`GET /api/v1/reveal/history`)
- [ ] 10.9 Build interactive "Reveal Contact" modal on Property Details page (credit balance check, confirmation modal, credit warning, unmask contact) and customer Reveal History table

---

### PHASE 11 — Payment & Notifications
> **Requires authorization before starting**

Tasks:
- [ ] 11.1 Resolve D-003: Select first payment provider adapter (bKash / SSLCommerz / Stripe)
- [ ] 11.2 Implement provider-agnostic payment service layer (`server/src/services/paymentService.js`)
- [ ] 11.3 Implement payment initiation endpoint (`POST /api/v1/payments/initiate`) creating `pending` record in `payments` collection
- [ ] 11.4 Implement webhook handler (`POST /api/v1/payments/webhook`) with raw-body cryptographic signature verification
- [ ] 11.5 Implement payment idempotency check using `provider_ref` to guarantee duplicate webhook deliveries never cause duplicate credit top-ups
- [ ] 11.6 Implement server-side credit top-up and subscription activation on verified payment success
- [ ] 11.7 Implement in-app notification service (`server/src/services/notificationService.js`) triggering alerts on listing approval/rejection and low credits
- [ ] 11.8 Build customer & owner in-app notification bell, notification list dropdown, and mark-as-read endpoints

---

### PHASE 12 — Analytics & Final UI
> **Requires authorization before starting**

Tasks:
- [ ] 12.1 Implement Owner analytics endpoints & UI: listing view metrics, inquiry conversion rates, daily engagement charts
- [ ] 12.2 Implement Admin platform analytics endpoints & UI: user growth, listing volume by city/category, revenue metrics, credit consumption rates
- [ ] 12.3 Complete platform-wide UI polish: responsive layout adjustments (mobile, tablet, desktop), micro-interactions, empty states, and loading skeletons
- [ ] 12.4 Build platform static pages: About Us, Terms of Service, Privacy Policy, Contact & FAQ

---

### PHASE 13 — Security & QA
> **Requires authorization before starting**

Tasks:
- [ ] 13.1 Execute end-to-end testing across all three user roles (Customer, Owner, Admin) per `docs/TESTING_CHECKLIST.md`
- [ ] 13.2 Conduct concurrency & race condition testing on Contact Reveal Engine (verify atomic deduction and zero duplicate charges under parallel requests)
- [ ] 13.3 Conduct payment security testing: simulate webhook replay attacks, signature spoofing, and verify fake frontend callbacks are rejected
- [ ] 13.4 Audit sensitive data protection: verify owner phone numbers are completely absent from public queries, listing expands, and search responses
- [ ] 13.5 Audit PocketBase collection-level access rules (verify direct unauthorized queries to `owner_contacts`, `payments`, `user_subscriptions` are rejected)
- [ ] 13.6 Audit frontend route guards and Express CSRF / Origin header / CORS enforcement

---

### PHASE 14 — Deployment Preparation
> **Requires authorization before starting**

Tasks:
- [ ] 14.1 Resolve D-004: Finalize PocketBase hosting strategy (local binary vs PocketHost vs cloud VPS)
- [ ] 14.2 Set up production environment configuration (`.env.production`) ensuring strict secret isolation
- [ ] 14.3 Configure frontend production build pipeline (`npm run build` in Vite) and asset optimization
- [ ] 14.4 Formulate PocketBase database backup and disaster recovery runbooks (`pb_data/` snapshots)
- [ ] 14.5 Write comprehensive deployment guide and maintenance documentation in `docs/`
