# ShopFinder — Testing Checklist

> Tests will be documented and executed as features are implemented.
> Status: ☐ Not started (Phase 0 — Workspace Inspection complete; no application code yet)

---

## Authentication & Authorization Tests (Phase 3)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-001 | Register with valid data | 201, user created, httpOnly cookie set | ☐ |
| T-002 | Register with duplicate email | 400 error | ☐ |
| T-003 | Login with valid credentials | 200, httpOnly cookie set (`pb_auth`) | ☐ |
| T-004 | Login with wrong password | 401 error | ☐ |
| T-005 | Access protected route without cookie | 401 error | ☐ |
| T-006 | Access owner route as customer | 403 error | ☐ |
| T-007 | Access admin route as owner | 403 error | ☐ |
| T-008 | State-changing request with invalid Origin header | 403 Forbidden (CSRF check) | ☐ |

---

## Marketplace & Public Discovery Tests (Phase 5)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-010 | Public listing search with keywords | 200, matching approved listings returned | ☐ |
| T-011 | Multi-parameter filtering (city, category, price) | 200, filtered subset returned | ☐ |
| T-012 | Public listing API returns owner phone number | FAIL (phone must NEVER appear in public response) | ☐ |
| T-013 | Pending or rejected listing visible in public marketplace | FAIL (only approved listings visible) | ☐ |

---

## Owner Module Tests (Phase 6)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-015 | Create listing as authenticated owner | 201, listing created with `pending` status | ☐ |
| T-016 | Create listing as customer role | 403 Forbidden | ☐ |
| T-017 | Edit own listing | 200, changes saved | ☐ |
| T-018 | Edit another owner's listing | 403 Forbidden | ☐ |
| T-019 | Store owner phone into `owner_contacts` | Phone saved to private collection, not `users` | ☐ |

---

## Admin Module Tests (Phase 7)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-020 | Admin views pending review queue | 200, all pending listings listed | ☐ |
| T-021 | Admin approves listing | Status updated to `approved` | ☐ |
| T-022 | Admin rejects listing with note | Status updated to `rejected`, note saved | ☐ |
| T-023 | Owner attempts to approve own listing | 403 Forbidden | ☐ |
| T-024 | Admin deactivates user | `is_active = false`, user blocked on next authRefresh | ☐ |

---

## Customer Module & Favorites Tests (Phase 8)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-025 | Customer saves listing to favorites | 201, saved in `saved_listings` | ☐ |
| T-026 | Duplicate save for same listing | 409 or handled gracefully (unique constraint) | ☐ |
| T-027 | Customer unsaves listing | 200, record removed | ☐ |
| T-028 | Customer views saved listings list | 200, user's saved listings returned | ☐ |

---

## Subscription System Tests (Phase 9)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-030 | Query available subscription plans | 200, active plans returned (Starter ৳299, Pro ৳999) | ☐ |
| T-031 | Customer active subscription query | 200, returns credits remaining | ☐ |
| T-032 | Credits persist across sessions | Credits unchanged between logins | ☐ |

---

## Contact Reveal Engine Tests (Phase 10)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-035 | Reveal contact with 1+ credits | Contact returned, exactly 1 credit deducted | ☐ |
| T-036 | Reveal same contact again (idempotent check) | Contact returned immediately, 0 credits deducted | ☐ |
| T-037 | Reveal contact with 0 credits | 402 Payment Required, transaction rolled back | ☐ |
| T-038 | Reveal contact unauthenticated | 401 Unauthorized | ☐ |
| T-039 | Concurrent reveal requests (double deduction test) | Exactly 1 credit deducted (txApp rollback / unique constraint) | ☐ |
| T-040 | Direct client query to `owner_contacts` collection | Deny-all (403 Forbidden) | ☐ |
| T-041 | Spoofed customerId in request body | Ignored — customer identity derived from auth context | ☐ |

---

## Payment & Notification Tests (Phase 11)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-045 | Verified webhook from provider | Credits topped up, subscription record activated | ☐ |
| T-046 | Invalid webhook signature | 400 Bad Request, no credits added | ☐ |
| T-047 | Duplicate webhook with same `provider_ref` | 200 OK acknowledged, no duplicate credits added | ☐ |
| T-048 | Fake payment success reported from frontend | Credits NOT added (server-side webhook only) | ☐ |
| T-049 | In-app notification on listing approval | Notification created in `notifications` collection | ☐ |

---

## Security & Concurrency QA Tests (Phase 13)
| # | Test Case | Expected | Result |
|---|-----------|----------|--------|
| T-050 | Direct unauthorized PocketBase queries | All denied per collection access rules | ☐ |
| T-051 | XSS token extraction attempt via document.cookie | Token inaccessible (`HttpOnly` enforced) | ☐ |
| T-052 | CSRF cross-origin state-changing mutation | Blocked by `SameSite=Strict` and Origin header check | ☐ |
| T-053 | High-concurrency contact reveal stress test | Zero credit discrepancies, zero duplicate reveals | ☐ |
| T-054 | Sensitive field leakage scan | 0 phone numbers exposed in any public or search response | ☐ |
