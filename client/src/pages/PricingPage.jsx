import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSubscriptionPlans } from '../services/subscriptionService.js';
import { Button } from '../components/ui/button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  SparklesIcon,
  CheckIcon,
  ShieldCheckIcon,
  ClockIcon,
  LayersIcon,
  CloseIcon,
  InfoIcon,
} from '../components/common/Icons.jsx';

/**
 * Formats numeric price into Bangladeshi Taka (BDT) representation.
 *
 * @param {number|string} price
 * @returns {string} Formatted price with ৳ prefix
 */
export function formatPlanPrice(price) {
  const num = Number(price);
  if (!Number.isFinite(num) || num < 0) {
    return '৳0';
  }
  return `৳${num.toLocaleString('en-US')}`;
}

/**
 * ShopFinder — Subscription Plans Pricing Page (Phase 9, Task 9.4)
 *
 * Displays approved customer one-time credit packages (D-001):
 * - Starter: ৳299 / 10 credits
 * - Pro: ৳999 / 100 credits
 *
 * Key Business Policies:
 * - One-time payment (NOT monthly/recurring).
 * - Credits never expire.
 * - Multi-purchase stacking aggregates with existing balance.
 * - Non-transactional CTA (Task 9.5 owns checkout/plan selection flow).
 */
export default function PricingPage({
  initialPlans = null,
  initialLoading = false,
  initialError = null,
  initialSelectedPlan = null,
  initialSelectionConfirmed = false,
}) {
  const { user, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState(initialPlans);
  const [loading, setLoading] = useState(initialLoading || (initialPlans === null && !initialError));
  const [error, setError] = useState(initialError);

  // Plan Selection State (Phase 9, Task 9.5)
  const [selectedPlan, setSelectedPlan] = useState(initialSelectedPlan);
  const [showModal, setShowModal] = useState(Boolean(initialSelectedPlan && !initialSelectionConfirmed));
  const [selectionConfirmed, setSelectionConfirmed] = useState(initialSelectionConfirmed);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const abortControllerRef = useRef(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!showModal) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowModal(true);
  };

  const handleConfirmSelection = () => {
    if (isSubmitting || !selectedPlan) return;
    setIsSubmitting(true);
    // Safe state transition with anti-duplicate submission lock
    setTimeout(() => {
      setSelectionConfirmed(true);
      setShowModal(false);
      setIsSubmitting(false);
    }, 50);
  };

  const handleCancelSelection = () => {
    setShowModal(false);
  };

  const handleResetSelection = () => {
    setSelectedPlan(null);
    setSelectionConfirmed(false);
    setShowModal(false);
  };

  const loadPlans = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const activePlans = await getSubscriptionPlans({ signal: controller.signal });
      setPlans(Array.isArray(activePlans) ? activePlans : []);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setError(err?.message || 'Failed to load subscription plans from server.');
      setPlans([]);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialPlans === null && !initialError && !initialLoading) {
      loadPlans();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadPlans, initialPlans, initialError, initialLoading]);

  return (
    <div className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* 1. Page Header & Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>Contact Reveal Credit Packages</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Simple, Transparent Pricing
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          Unlock direct, verified commercial property owner phone numbers. Purchase credits as you need them with{' '}
          <strong className="text-foreground font-semibold">one-time payments</strong>. Zero recurring monthly charges.
        </p>
      </div>

      {/* 2. Key Pillars & Guarantees Banner */}
      <section aria-label="Credit Policy Guarantees" className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="bg-card border border-border/80 rounded-xl p-5 space-y-2 text-center md:text-left shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto md:mx-0">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-foreground">One-time purchase</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Pay once for the credits you need. There is no recurring monthly billing, auto-renewal, or subscription auto-debit.
          </p>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-5 space-y-2 text-center md:text-left shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto md:mx-0">
            <ClockIcon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Credits never expire</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Your contact credits stay in your account forever until you choose to reveal an owner's telephone number.
          </p>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-5 space-y-2 text-center md:text-left shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto md:mx-0">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Credits stack</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Purchase additional credit packages at any time. New credits automatically stack and aggregate with your existing balance.
          </p>
        </div>
      </section>

      {/* 3. Loading, Error, and Empty States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16" data-testid="pricing-loading" role="status">
          <Spinner size="lg" className="text-primary mb-4" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            Loading subscription plans...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="max-w-xl mx-auto" data-testid="pricing-error">
          <NotificationBanner
            type="error"
            message={error}
            actionLabel="Retry"
            onAction={loadPlans}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {!loading && !error && plans && plans.length === 0 && (
        <div className="py-12" data-testid="pricing-empty">
          <EmptyState
            title="No active subscription plans"
            description="Subscription packages are currently being updated. Please check back shortly or browse commercial listings."
            action={
              <Link to="/marketplace">
                <Button variant="outline">Browse Marketplace</Button>
              </Link>
            }
          />
        </div>
      )}

      {/* Plan Selection Confirmed State (Phase 9, Task 9.5) */}
      {selectionConfirmed && selectedPlan && (
        <section
          aria-label="Selected Package Confirmation"
          className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/5 via-card to-card p-6 sm:p-8 space-y-4 max-w-4xl mx-auto shadow-sm"
          role="status"
          data-testid="plan-selection-confirmed"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Package Selection Saved</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                {selectedPlan.name} Credit Package ({selectedPlan.credits} Credits — {formatPlanPrice(selectedPlan.price)})
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Your package selection is confirmed and recorded. Online payment checkout will be activated in Phase 11.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSelection}
                data-testid="change-plan-button"
              >
                <span>Change Package</span>
              </Button>
              <Link to="/dashboard">
                <Button size="sm" className="font-semibold shadow-xs">
                  <span>Go to Dashboard</span>
                </Button>
              </Link>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-card border border-border/80 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Phase Boundary Notice:</strong> In strict accordance with the approved platform roadmap, no credit deduction or financial charge has occurred. Your available credit balance remains unchanged until payment processing is completed in Phase 11.
            </p>
          </div>
        </section>
      )}

      {/* 4. Pricing Cards Grid */}
      {!loading && !error && plans && plans.length > 0 && (
        <section aria-label="Subscription Plans Grid" className="max-w-5xl mx-auto">
          <div
            className={`grid grid-cols-1 ${
              plans.length === 1 ? 'max-w-md mx-auto' : 'md:grid-cols-2 max-w-4xl mx-auto'
            } gap-8 items-stretch`}
            data-testid="pricing-grid"
          >
            {plans.map((plan) => {
              const isPro = plan.name?.trim().toLowerCase() === 'pro';
              const priceText = formatPlanPrice(plan.price);
              const creditsNum = Number(plan.credits);
              const creditsCount = Number.isFinite(creditsNum) && creditsNum >= 0 ? creditsNum : 0;
              const priceNum = Number(plan.price);
              const safePrice = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
              const perReveal = creditsCount > 0 ? (safePrice / creditsCount).toFixed(1) : '0.0';

              return (
                <article
                  key={plan.id}
                  data-testid={`pricing-card-${plan.name?.toLowerCase() || plan.id}`}
                  className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-8 transition-all relative ${
                    isPro
                      ? 'border-primary shadow-md bg-gradient-to-b from-card via-card to-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card shadow-xs hover:border-border/80'
                  }`}
                >
                  {/* Pro Best Value Badge */}
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        <SparklesIcon className="w-3 h-3" />
                        Best Value
                      </span>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Header */}
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {plan.name}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground min-h-[2.5rem] leading-relaxed">
                        {plan.description || (isPro ? 'Maximum savings for active commercial property seekers.' : 'Ideal for exploring commercial spaces and contacting owners.')}
                      </p>
                    </div>

                    {/* Price & Billing Term */}
                    <div className="pt-2 border-t border-border/60">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                          {priceText}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          / one-time
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {creditsCount} Contact Reveal Credits
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          (৳{perReveal} / reveal)
                        </span>
                      </div>
                    </div>

                    {/* Feature Inclusions */}
                    <ul className="space-y-3 pt-2 text-xs sm:text-sm text-foreground/90">
                      <li className="flex items-start gap-2.5">
                        <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>
                          <strong>{creditsCount} verified</strong> commercial property owner phone reveals
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Credits never expire</strong> — use at your own pace
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>One-time payment</strong> — no automatic renewals
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>
                          Permanent access to unlocked contacts in Reveal History
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>
                          Stacks automatically with existing credits
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* CTA Area (Non-transactional in Task 9.4; Task 9.5 implements checkout flow) */}
                  <div className="pt-8 mt-6 border-t border-border/60 space-y-2">
                    {!isAuthenticated ? (
                      <Link to="/register" className="block w-full">
                        <Button
                          className="w-full font-semibold shadow-xs"
                          variant={isPro ? 'default' : 'outline'}
                        >
                          <span>Get Started with {plan.name}</span>
                        </Button>
                      </Link>
                    ) : user?.role === 'customer' ? (
                      <div className="space-y-2">
                        <Button
                          className="w-full font-semibold shadow-xs"
                          variant={selectedPlan?.id === plan.id && selectionConfirmed ? 'secondary' : isPro ? 'default' : 'outline'}
                          onClick={() => handleSelectPlan(plan)}
                          data-testid={`select-plan-${plan.name?.toLowerCase() || plan.id}`}
                        >
                          <span>
                            {selectedPlan?.id === plan.id && selectionConfirmed
                              ? `Selected: ${plan.name} (Change)`
                              : `Select ${plan.name}`}
                          </span>
                        </Button>
                        <p className="text-[11px] text-center text-muted-foreground pt-0.5">
                          {selectedPlan?.id === plan.id && selectionConfirmed
                            ? 'Selection saved (Checkout activates in Phase 11)'
                            : 'One-time package • Zero recurring fees'}
                        </p>
                      </div>
                    ) : (
                      <Link
                        to={user?.role === 'admin' ? '/admin-dashboard' : '/owner-dashboard'}
                        className="block w-full"
                      >
                        <Button className="w-full font-medium" variant="outline">
                          <span>Return to Dashboard</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Frequently Asked Questions Section */}
      <section aria-labelledby="pricing-faq-heading" className="max-w-3xl mx-auto pt-8 border-t border-border space-y-6">
        <div className="text-center space-y-2">
          <h2 id="pricing-faq-heading" className="text-2xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about ShopFinder contact credits.
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-border p-4 sm:p-5 bg-card/60 space-y-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Do my credits ever expire?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              No. In accordance with approved decision D-001, contact reveal credits never expire. Unused credits remain in your account until you choose to reveal owner details.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 sm:p-5 bg-card/60 space-y-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Can I purchase multiple packages?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Yes. You can purchase additional Starter or Pro credit packages at any time. All newly purchased credits automatically stack with your existing credit balance.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 sm:p-5 bg-card/60 space-y-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              What does 1 credit unlock?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Exactly 1 credit reveals the verified telephone number and direct contact details of a commercial property owner. Once unlocked, the contact remains permanently in your Reveal History with zero recurring deductions.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 sm:p-5 bg-card/60 space-y-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Is this a recurring subscription?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              No. ShopFinder credit packages are strictly one-time purchases. There are no monthly subscriptions, automatic recurring renewals, or unexpected auto-debit charges.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Package Selection & Confirmation Modal (Phase 9, Task 9.5) */}
      {showModal && selectedPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-plan-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          data-testid="plan-selection-modal"
        >
          <div
            role="document"
            className="bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-xl space-y-6 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
                  <SparklesIcon className="w-3.5 h-3.5" />
                  <span>Confirm Package Selection</span>
                </div>
                <h2 id="modal-plan-title" className="text-2xl font-bold text-foreground">
                  {selectedPlan.name} Credit Package
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCancelSelection}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Package Details Overview */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Package Price</p>
                  <p className="text-2xl font-extrabold text-foreground">{formatPlanPrice(selectedPlan.price)}</p>
                  <p className="text-[11px] text-muted-foreground">One-time payment</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Credits Included</p>
                  <p className="text-2xl font-extrabold text-primary">{selectedPlan.credits}</p>
                  <p className="text-[11px] text-muted-foreground">Never expires</p>
                </div>
              </div>

              {/* Guarantees checklist */}
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Credits never expire — keep and use whenever needed</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Stacks automatically with any existing credit balance</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>One-time purchase — zero recurring monthly renewals</span>
                </li>
              </ul>

              {/* Phase 11 Payment Activation Callout */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <InfoIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Online Payment Activation Pending (Phase 11)</span>
                </p>
                <p className="leading-relaxed">
                  Payment gateway channels (bKash / SSLCommerz / Stripe) will be activated in Phase 11.
                  Confirming saves your package choice without charging your payment method or allocating credits at this stage.
                </p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelSelection}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex-1"
                data-testid="cancel-selection-button"
              >
                <span>Change Package</span>
              </Button>

              <Button
                type="button"
                onClick={handleConfirmSelection}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex-1 font-semibold"
                data-testid="confirm-selection-button"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span>Confirm {selectedPlan.name} Selection</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
