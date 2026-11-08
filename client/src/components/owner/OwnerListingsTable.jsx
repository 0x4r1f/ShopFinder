import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button.jsx';
import {
  BuildingIcon,
  MapPinIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
} from '../common/Icons.jsx';

/**
 * Format category identifier into a readable commercial label.
 */
function formatCategory(cat) {
  const map = {
    retail: 'Retail / Shop',
    office: 'Commercial Office',
    restaurant: 'Restaurant / Cafe',
    warehouse: 'Warehouse',
    showroom: 'Showroom',
    industrial: 'Industrial Space',
    other: 'Commercial Space',
  };
  return map[cat] || cat || 'Commercial';
}

/**
 * Format price into BDT with optional monthly rent suffix.
 */
function formatPrice(price, listingType) {
  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return 'Price on request';
  }
  const formatted = `৳${price.toLocaleString()}`;
  return listingType === 'rent' ? `${formatted} / mo` : formatted;
}

/**
 * Render semantic, accessible status badges across all 4 statuses.
 */
function renderStatusBadge(status) {
  const statusStyles = {
    approved: {
      label: 'Approved',
      classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-500',
    },
    pending: {
      label: 'Pending Review',
      classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
      dot: 'bg-amber-500',
    },
    rejected: {
      label: 'Rejected',
      classes: 'bg-destructive/10 text-destructive border-destructive/30',
      dot: 'bg-destructive',
    },
    archived: {
      label: 'Archived',
      classes: 'bg-muted text-muted-foreground border-border',
      dot: 'bg-muted-foreground',
    },
  };

  const current = statusStyles[status] || {
    label: status || 'Unknown',
    classes: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${current.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} aria-hidden="true" />
      <span>{current.label}</span>
    </span>
  );
}

/**
 * ShopFinder — Owner Listings Table & Mobile Card View (Phase 6, Task 6.5)
 *
 * Renders a responsive data presentation for an owner's commercial listings:
 * - Desktop (>= 768px): Structured semantic table with thumbnail, specs, status, and actions.
 * - Mobile (< 768px): Stacked card layout with readable typography and tap-friendly buttons.
 *
 * @param {Object} props
 * @param {Array<Object>} props.listings - Array of sanitized listing objects
 * @param {Function} props.onDeleteClick - Delete click handler (listing) => void
 */
export default function OwnerListingsTable({ listings = [], onDeleteClick }) {
  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* Desktop & Tablet Table View (md and above)                            */}
      {/* ===================================================================== */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-left text-sm" aria-label="Commercial Listings">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th scope="col" className="py-3.5 px-4 w-16">
                Photo
              </th>
              <th scope="col" className="py-3.5 px-4 min-w-[200px]">
                Property Details
              </th>
              <th scope="col" className="py-3.5 px-4">
                Type
              </th>
              <th scope="col" className="py-3.5 px-4">
                Price (BDT)
              </th>
              <th scope="col" className="py-3.5 px-4">
                Status
              </th>
              <th scope="col" className="py-3.5 px-4">
                Submitted
              </th>
              <th scope="col" className="py-3.5 px-4 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {listings.map((item) => {
              const coverThumb = item.cover_image?.thumb_url || item.cover_image?.url;
              const formattedDate = item.created
                ? new Date(item.created).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—';

              return (
                <tr
                  key={item.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  {/* Thumbnail */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                      {coverThumb ? (
                        <img
                          src={coverThumb}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement.classList.add('fallback-icon');
                          }}
                        />
                      ) : (
                        <BuildingIcon className="w-5 h-5 text-muted-foreground/60" />
                      )}
                    </div>
                  </td>

                  {/* Title, Category & Location */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="space-y-1">
                      <Link
                        to={`/listings/${item.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 block focus-visible:outline-none focus-visible:underline"
                        title={item.title}
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground/80">
                          {formatCategory(item.category)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate max-w-[150px]">
                            {item.area ? `${item.area}, ${item.city}` : item.city}
                          </span>
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Listing Type Badge */}
                  <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                        item.listing_type === 'sale'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {item.listing_type === 'sale' ? 'Sale' : 'Rent'}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="py-3.5 px-4 align-middle whitespace-nowrap font-medium text-foreground">
                    {formatPrice(item.price, item.listing_type)}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                    {renderStatusBadge(item.status)}
                  </td>

                  {/* Created Date */}
                  <td className="py-3.5 px-4 align-middle whitespace-nowrap text-xs text-muted-foreground">
                    {formattedDate}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/listings/${item.id}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="View listing details"
                        aria-label={`View listing ${item.title}`}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Link>

                      <Link
                        to={`/owner-dashboard/listings/${item.id}/edit`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Edit property details"
                        aria-label={`Edit listing ${item.title}`}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => onDeleteClick && onDeleteClick(item)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                        title="Delete listing"
                        aria-label={`Delete listing ${item.title}`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===================================================================== */}
      {/* Mobile Card View (< 768px)                                            */}
      {/* ===================================================================== */}
      <div className="md:hidden space-y-3">
        {listings.map((item) => {
          const coverThumb = item.cover_image?.thumb_url || item.cover_image?.url;
          const formattedDate = item.created
            ? new Date(item.created).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—';

          return (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3"
            >
              {/* Header with thumbnail, title & status */}
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                  {coverThumb ? (
                    <img
                      src={coverThumb}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement.classList.add('fallback-icon');
                      }}
                    />
                  ) : (
                    <BuildingIcon className="w-6 h-6 text-muted-foreground/60" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/listings/${item.id}`}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                    <span className="truncate">
                      {item.area ? `${item.area}, ${item.city}` : item.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Specs & Status Row */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground block">
                    {formatCategory(item.category)} • {item.listing_type === 'sale' ? 'Sale' : 'Rent'}
                  </span>
                  <span className="font-bold text-sm text-foreground">
                    {formatPrice(item.price, item.listing_type)}
                  </span>
                </div>
                <div className="text-right space-y-1">
                  {renderStatusBadge(item.status)}
                  <span className="text-[10px] text-muted-foreground block">{formattedDate}</span>
                </div>
              </div>

              {/* Mobile Actions Button Group */}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                <Link
                  to={`/listings/${item.id}`}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-border text-center text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                  <span>View</span>
                </Link>

                <Link
                  to={`/owner-dashboard/listings/${item.id}/edit`}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-border text-center text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <EditIcon className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>

                <button
                  type="button"
                  onClick={() => onDeleteClick && onDeleteClick(item)}
                  className="py-1.5 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                  aria-label={`Delete listing ${item.title}`}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

