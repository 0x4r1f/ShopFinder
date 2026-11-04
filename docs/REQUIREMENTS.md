# ShopFinder — Functional & Non-Functional Requirements

## Functional Requirements

### Authentication
- FR-001: Users can register with email, password, name, and role (customer/owner).
- FR-002: Users can log in and receive a JWT session.
- FR-003: Users can log out.
- FR-004: Passwords are hashed and never stored in plaintext.
- FR-005: Role-based access enforced on all protected routes.

### Listings
- FR-010: Owners can create a listing with title, description, category, type, price, area, address, images.
- FR-011: New listings default to `pending` status.
- FR-012: Only `approved` listings are visible publicly.
- FR-013: Owners can edit their own listings (reverts to `pending` on major edit — TBD).
- FR-014: Admin can approve, reject (with note), or archive listings.
- FR-015: Owners cannot approve their own listings.

### Search & Filtering
- FR-020: Customers can search listings by keyword.
- FR-021: Customers can filter by city, area, category, listing type, price range.
- FR-022: Listings are paginated.

### Contact Reveal System
- FR-030: Owner phone numbers are hidden by default.
- FR-031: Customer must be authenticated to reveal a contact.
- FR-032: Revealing a contact costs exactly 1 credit.
- FR-033: If already revealed by this customer, return contact without deducting credits.
- FR-034: If credits are 0, reveal is refused.
- FR-035: Credit deduction and reveal record creation are atomic.
- FR-036: Reveal history is stored and accessible to the customer.

### Subscription Plans
- FR-040: Admin can manage subscription plans (name, price, credits).
- FR-041: Customers can view available plans.
- FR-042: Customers can purchase a plan.
- FR-043: On payment success, credits are added to customer account.
- FR-044: Payment status is verified server-side, never trusted from frontend alone.

### Favorites
- FR-050: Customers can save a listing.
- FR-051: Customers can unsave a listing.
- FR-052: Customers can view saved listings.
- FR-053: Duplicate saves are prevented.

### Admin Dashboard
- FR-060: Admin can view all users.
- FR-061: Admin can activate/deactivate users.
- FR-062: Admin can view all listings and their status.
- FR-063: Admin can view all payments.
- FR-064: Admin can manage subscription plans.

### Owner Dashboard
- FR-070: Owners can view their listings and statuses.
- FR-071: Owners can edit or delete their listings.

### Customer Dashboard
- FR-080: Customers can view their credit balance.
- FR-081: Customers can view their reveal history.
- FR-082: Customers can view their saved listings.
- FR-083: Customers can view their purchase history.

---

## Non-Functional Requirements

- NFR-001: Phone numbers must never appear in public API responses.
- NFR-002: All authorization checks enforced server-side.
- NFR-003: Payment verification must be server-side.
- NFR-004: No secrets committed to version control.
- NFR-005: API responses are consistent in structure.
- NFR-006: Input is validated on the backend.
- NFR-007: UI is responsive (mobile-friendly).
- NFR-008: Codebase is modular and maintainable.
- NFR-009: Payment provider is pluggable (bKash, SSLCommerz, Stripe).
- NFR-010: Duplicate credit deduction is impossible (idempotent reveal).

