import React from 'react';
import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../../lib/utils.js';

/**
 * ShopFinder — Domain Skeleton Components (Phase 12, Task 12.3)
 *
 * Content-shaped loading skeletons that mirror the layout, geometry, and responsive
 * behavior of production pages, eliminating Cumulative Layout Shifts (CLS).
 */

/**
 * A. ListingCardSkeleton
 *
 * Mirrors ListingCard in both grid (default) and horizontal list layouts.
 *
 * @param {Object} props
 * @param {'grid'|'list'} [props.viewMode='grid']
 * @param {string} [props.className]
 */
export function ListingCardSkeleton({ viewMode = 'grid', className }) {
  if (viewMode === 'list') {
    return (
      <article
        role="status"
        aria-label="Loading listing..."
        className={cn(
          'flex flex-col sm:flex-row rounded-xl border border-border bg-card overflow-hidden shadow-xs',
          className
        )}
      >
        <span className="sr-only">Loading listing details...</span>
        {/* Left: Thumbnail Stage */}
        <div className="relative w-full sm:w-64 md:w-72 shrink-0 aspect-16/10 sm:aspect-auto min-h-[160px] bg-muted/40 p-3 flex flex-col justify-between">
          <Skeleton className="w-16 h-5 rounded-md" />
        </div>

        {/* Right: Content Body */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
              <Skeleton className="h-6 w-24 shrink-0" />
            </div>
            <div className="space-y-1.5 mt-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>

          <div className="pt-3.5 border-t border-border flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </article>
    );
  }

  // Default: Grid View
  return (
    <article
      role="status"
      aria-label="Loading listing..."
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-xs',
        className
      )}
    >
      <span className="sr-only">Loading listing details...</span>
      {/* Top: Aspect 4:3 Image Container */}
      <div className="relative aspect-4/3 w-full shrink-0 bg-muted/40 p-3 flex items-start justify-between">
        <Skeleton className="w-16 h-5 rounded-md" />
        <Skeleton className="w-16 h-5 rounded-md" />
      </div>

      {/* Bottom: Card Body */}
      <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
        <div>
          {/* Price */}
          <Skeleton className="h-6 w-28" />
          {/* Title */}
          <Skeleton className="h-5 w-4/5 mt-2.5" />
          {/* Location */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>

        {/* Specifications Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </article>
  );
}

/**
 * Grid of ListingCardSkeletons
 *
 * @param {Object} props
 * @param {number} [props.count=6]
 * @param {'grid'|'list'} [props.viewMode='grid']
 * @param {string} [props.className]
 */
export function ListingsGridSkeleton({ count = 6, viewMode = 'grid', className }) {
  if (viewMode === 'list') {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-label="Loading listings...">
        <span className="sr-only">Loading commercial property listings...</span>
        {Array.from({ length: count }).map((_, idx) => (
          <ListingCardSkeleton key={idx} viewMode="list" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6',
        className
      )}
      role="status"
      aria-label="Loading listings..."
    >
      <span className="sr-only">Loading commercial property listings...</span>
      {Array.from({ length: count }).map((_, idx) => (
        <ListingCardSkeleton key={idx} viewMode="grid" />
      ))}
    </div>
  );
}

/**
 * B. TableRowSkeleton
 *
 * Renders a semantic <tr> table row containing configurable skeleton cells.
 *
 * @param {Object} props
 * @param {number} [props.columns=5] - Number of <td> cells
 * @param {string[]} [props.columnWidths] - Optional array of custom width classes per cell
 * @param {string} [props.className]
 */
export function TableRowSkeleton({ columns = 5, columnWidths = [], className }) {
  return (
    <tr className={cn('border-b border-border/80 hover:bg-muted/10', className)} role="row">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="py-4 px-4 align-middle">
          <Skeleton className={columnWidths[idx] || 'h-4 w-full max-w-[120px]'} />
        </td>
      ))}
    </tr>
  );
}

/**
 * TableSkeleton Helper
 *
 * Renders multiple TableRowSkeletons for a full table body.
 *
 * @param {Object} props
 * @param {number} [props.rows=5]
 * @param {number} [props.columns=5]
 * @param {string[]} [props.columnWidths]
 * @param {string} [props.className]
 */
export function TableSkeleton({ rows = 5, columns = 5, columnWidths = [], className }) {
  return (
    <tbody className={cn('divide-y divide-border/80', className)} role="rowgroup">
      {Array.from({ length: rows }).map((_, idx) => (
        <TableRowSkeleton
          key={idx}
          columns={columns}
          columnWidths={columnWidths}
        />
      ))}
    </tbody>
  );
}

/**
 * C. KpiCardSkeleton
 *
 * Matches the layout and dimensions of dashboard KPI metric cards.
 *
 * @param {Object} props
 * @param {string} [props.className]
 */
export function KpiCardSkeleton({ className }) {
  return (
    <div
      role="status"
      aria-label="Loading metric..."
      className={cn('rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4', className)}
    >
      <span className="sr-only">Loading platform metric...</span>
      {/* Top Row: Label & Icon placeholder */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>

      {/* Value */}
      <Skeleton className="h-8 w-24" />

      {/* Subtitle */}
      <Skeleton className="h-3.5 w-36" />
    </div>
  );
}

/**
 * D. ListingDetailSkeleton
 *
 * Matches the complete ListingDetailPage layout (breadcrumbs, header, photo gallery,
 * specifications grid, description, facilities, price card, safe owner card).
 *
 * @param {Object} props
 * @param {string} [props.className]
 */
export function ListingDetailSkeleton({ className }) {
  return (
    <div
      role="status"
      aria-label="Loading property details..."
      className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8', className)}
    >
      <span className="sr-only">Loading commercial property specifications and gallery...</span>

      {/* 1. Breadcrumb Bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* 2. Header Bar: Badges, Title, Location */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 sm:h-11 w-3/4 max-w-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>

      {/* 3. Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Photo Gallery Main Stage */}
          <div className="space-y-3">
            <Skeleton className="aspect-16/10 w-full rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
              <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
              <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
              <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
            </div>
          </div>

          {/* Specifications Grid */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-44" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="p-3.5 rounded-lg bg-muted/30 space-y-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Description Block */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Highlights Block */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-52" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-3.5 rounded-lg bg-muted/30 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width on desktop) */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-xs">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-44" />
            <div className="pt-3 border-t border-border space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>

          {/* Safe Owner Information Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

