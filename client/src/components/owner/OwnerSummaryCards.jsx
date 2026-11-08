import React from 'react';
import {
  BuildingIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from '../common/Icons.jsx';

/**
 * ShopFinder — Owner Dashboard KPI Summary Cards (Phase 6, Task 6.5)
 *
 * Displays accurate high-level portfolio metrics:
 * 1. Total Listings — derived from backend pagination metadata (totalItems).
 * 2. Approved Listings — active on marketplace (explicitly labelled for current page when paginated).
 * 3. Pending Review — awaiting administrative review.
 * 4. Action Required (Rejected) — rejected submissions requiring revision.
 *
 * NOTE: Listing view counts are omitted as no view counter exists in the schema or API.
 *
 * @param {Object} props
 * @param {number} props.totalItems - Account-wide total listings from backend pagination metadata
 * @param {number} props.approvedCount - Count of approved listings on current page
 * @param {number} props.pendingCount - Count of pending listings on current page
 * @param {number} props.rejectedCount - Count of rejected listings on current page
 * @param {boolean} [props.isPaginated=false] - Whether listing catalog spans multiple pages
 */
export default function OwnerSummaryCards({
  totalItems = 0,
  approvedCount = 0,
  pendingCount = 0,
  rejectedCount = 0,
  isPaginated = false,
}) {
  const pageLabel = isPaginated ? 'On this page' : 'Account total';

  const cards = [
    {
      id: 'total-listings',
      title: 'Total Properties',
      value: totalItems,
      subtitle: 'Account-wide total',
      icon: <BuildingIcon className="w-5 h-5 text-primary" />,
      containerClass: 'bg-card border-border hover:border-primary/40',
      badgeClass: 'bg-primary/10 text-primary',
    },
    {
      id: 'approved-listings',
      title: 'Approved',
      value: approvedCount,
      subtitle: isPaginated ? pageLabel : 'Active in marketplace',
      icon: <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      containerClass: 'bg-card border-border hover:border-emerald-500/40',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    {
      id: 'pending-listings',
      title: 'Pending Review',
      value: pendingCount,
      subtitle: isPaginated ? pageLabel : 'Awaiting admin review',
      icon: <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      containerClass: 'bg-card border-border hover:border-amber-500/40',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    {
      id: 'rejected-listings',
      title: 'Action Required',
      value: rejectedCount,
      subtitle: isPaginated ? pageLabel : 'Needs revision',
      icon: <AlertCircleIcon className="w-5 h-5 text-destructive" />,
      containerClass: 'bg-card border-border hover:border-destructive/40',
      badgeClass: 'bg-destructive/10 text-destructive',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`p-5 rounded-xl border transition-all duration-200 hover:shadow-md shadow-xs ${card.containerClass}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
              <div className={`p-2 rounded-lg ${card.badgeClass}`}>{card.icon}</div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {card.value.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>{card.subtitle}</span>
            </p>
          </div>
        ))}
      </div>

      {isPaginated && (
        <p className="text-[11px] text-muted-foreground italic px-1">
          * Status breakdown values reflect properties on the currently viewed page. Total Properties reflects all properties across all pages.
        </p>
      )}
    </div>
  );
}

