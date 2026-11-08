import React from 'react';
import { UserIcon, LockIcon } from '../common/Icons.jsx';
import { Button } from '../ui/button.jsx';

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
 * ShopFinder — Safe Owner Information Card (Phase 5, Task 5.6)
 *
 * Renders verified public owner metadata with strict privacy boundaries:
 * - Public display name only
 * - Member since date (derived from owner.created)
 * - Explicit indication that contact number is protected and not publicly displayed
 * - Clear, non-functional contact action demarcation reserved for Phase 10 (Contact Reveal Engine)
 * - Zero phone number retrieval or frontend masking (D-014)
 * - Zero invented verification badges, ratings, or unsupported claims
 *
 * @param {Object} props
 * @param {Object|null} [props.owner] - Sanitized public owner profile { id, name, created }
 * @param {string} [props.className]
 */
export default function OwnerInfoCard({ owner = null, className = '' }) {
  const displayName = owner?.name?.trim() ? owner.name.trim() : 'Property Owner';
  const memberSince = formatMemberSince(owner?.created);
  const initial = displayName.charAt(0).toUpperCase();

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

      {/* Contact Action Boundary (Phase 10: Contact Reveal Engine) */}
      <div className="space-y-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="w-full font-medium py-2.5 cursor-not-allowed opacity-60 border-dashed"
          disabled
          aria-disabled="true"
          title="Direct contact reveal will be available in Phase 10"
        >
          Contact Owner (Available in Phase 10)
        </Button>
        <p className="text-[11px] text-center text-muted-foreground leading-normal">
          Direct contact reveal is scheduled for implementation in Phase 10.
        </p>
      </div>
    </div>
  );
}

