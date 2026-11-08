import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserIcon, LockIcon, PhoneIcon } from '../common/Icons.jsx';
import { Button } from '../ui/button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCredits } from '../../context/CreditContext.jsx';
import ContactRevealModal from './ContactRevealModal.jsx';

/**
 * Formats a user creation ISO date string into a friendly "Member since [Month Year]" string.
 * Gracefully returns null if date is missing or invalid.
 *
 * @param {string|null} createdDate
 * @returns {string|null}
 */
export function formatMemberSince(createdDate) {
  if (!createdDate) return null;
  try {
    const d = new Date(createdDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

/**
 * ShopFinder — Safe Owner Information Card & Contact Reveal Trigger (Phase 10, Task 10.9)
 *
 * Renders verified public owner metadata with strict privacy boundaries:
 * - Public display name only
 * - Member since date (derived from owner.created)
 * - Explicit indication that contact number is protected (D-014)
 * - Prominent "Reveal Contact" action for authenticated customers
 * - Redirect to /login?redirect=/listings/:id for anonymous visitors
 * - Disabled contact reveal indicator for owner/admin accounts
 * - Mounts ContactRevealModal for secure credit verification and contact revelation
 *
 * @param {Object} props
 * @param {Object|null} [props.owner] - Sanitized public owner profile { id, name, created }
 * @param {Object|null} [props.listing] - Commercial listing details { id, title, city, area }
 * @param {string} [props.className]
 * @param {Function} [props.onRevealSuccess] - Optional callback after successful reveal
 */
export default function OwnerInfoCard({
  owner = null,
  listing = null,
  className = '',
  onRevealSuccess = null,
}) {
  const { user, isAuthenticated } = useAuth();
  const { isCustomer } = useCredits();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayName = owner?.name?.trim() ? owner.name.trim() : 'Property Owner';
  const memberSince = formatMemberSince(owner?.created);
  const initial = displayName.charAt(0).toUpperCase();

  const isOwnerOrAdmin = isAuthenticated && (user?.role === 'owner' || user?.role === 'admin');
  const redirectTarget = listing?.id ? `/listings/${listing.id}` : '/marketplace';
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectTarget)}`;

  return (
    <div
      role="region"
      aria-label="Property owner information"
      className={`rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Header and Public Profile */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 border border-primary/20"
          aria-hidden="true"
        >
          {initial && initial !== 'P' ? initial : <UserIcon className="w-6 h-6 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Property Listed By
          </span>
          <h3 className="text-base font-bold text-foreground truncate mt-0.5">
            {displayName}
          </h3>
          {memberSince && (
            <span className="text-xs text-muted-foreground block mt-0.5">
              Member since {memberSince}
            </span>
          )}
        </div>
      </div>

      {/* Privacy Notice: Phone Number Is Not Publicly Displayed */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <LockIcon className="w-4 h-4 text-primary shrink-0" />
          <span>Contact Number Protected</span>
        </div>
        <p className="leading-relaxed">
          The owner's direct contact number is private and is not publicly displayed on this page.
        </p>
      </div>

      {/* Contact Action Boundary (Phase 10: Interactive Contact Reveal Engine) */}
      <div className="space-y-2 pt-1">
        {!isAuthenticated ? (
          /* Anonymous Visitor: Link to login with return redirect */
          <>
            <Button
              asChild
              className="w-full font-semibold py-2.5"
            >
              <Link to={loginUrl}>
                <PhoneIcon className="w-4 h-4 mr-2" />
                Sign In to Reveal Contact
              </Link>
            </Button>
            <p className="text-[11px] text-center text-muted-foreground leading-normal">
              Sign in with a customer account to unlock owner phone numbers.
            </p>
          </>
        ) : isCustomer ? (
          /* Authenticated Customer: Open Contact Reveal Modal */
          <>
            <Button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full font-semibold py-2.5 shadow-sm"
              data-testid="reveal-contact-button"
            >
              <PhoneIcon className="w-4 h-4 mr-2" />
              Reveal Contact (1 Credit)
            </Button>
            <p className="text-[11px] text-center text-muted-foreground leading-normal">
              1 credit per listing • Free permanent repeat view
            </p>
          </>
        ) : isOwnerOrAdmin ? (
          /* Authenticated Owner or Admin: Disabled with explanatory notice */
          <>
            <Button
              type="button"
              variant="outline"
              disabled
              aria-disabled="true"
              className="w-full font-medium py-2.5 cursor-not-allowed opacity-60 border-dashed"
              title="Contact reveal is reserved for customer accounts"
            >
              <PhoneIcon className="w-4 h-4 mr-2" />
              Reveal Contact (Customers Only)
            </Button>
            <p className="text-[11px] text-center text-muted-foreground leading-normal">
              Contact reveal is reserved exclusively for verified customer accounts.
            </p>
          </>
        ) : (
          /* Safe Fallback */
          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full font-medium py-2.5 opacity-60"
          >
            Contact Owner
          </Button>
        )}
      </div>

      {/* Contact Reveal Modal */}
      {isCustomer && listing && (
        <ContactRevealModal
          isOpen={isModalOpen}
          listing={listing}
          onClose={() => setIsModalOpen(false)}
          onSuccess={onRevealSuccess}
        />
      )}
    </div>
  );
}
