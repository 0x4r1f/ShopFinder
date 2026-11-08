import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinIcon, StoreIcon, ChevronRightIcon, SparklesIcon } from '../common/Icons.jsx';

/**
 * Human-readable category labels mapped to schema enum values.
 */
const CATEGORY_LABELS = {
  retail: 'Shop',
  office: 'Office',
  restaurant: 'Restaurant',
  warehouse: 'Warehouse',
  showroom: 'Showroom',
  other: 'Commercial Floor',
  industrial: 'Industrial Space',
};

/**
 * Formats a price into Bangladeshi Taka (BDT) representation.
 *
 * @param {number} price
 * @param {'rent'|'sale'} [listingType='rent']
 * @returns {string}
 */
export function formatBDT(price, listingType = 'rent') {
  if (price === null || price === undefined || isNaN(price)) {
    return '৳0';
  }
  const formatted = `৳${Number(price).toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${formatted} / mo` : formatted;
}

/**
 * ShopFinder — Reusable Commercial Property Listing Card (Phase 5, Task 5.2)
 *
 * Supports both responsive Grid mode and horizontal List mode.
 *
 * @param {Object} props
 * @param {Object} props.listing - Sanitized commercial listing record
 * @param {'grid'|'list'} [props.viewMode='grid']
 */
export default function ListingCard({ listing, viewMode = 'grid' }) {
  if (!listing) return null;

  const categoryLabel = CATEGORY_LABELS[listing.category] || listing.category || 'Commercial';
  const isRent = listing.listing_type === 'rent';
  const imageUrl = listing.cover_image?.thumb_url || listing.cover_image?.url || null;
  const locationText = [listing.address, listing.area, listing.city].filter(Boolean).join(', ');

  const imageElement = (
    <div className="relative w-full h-full bg-muted/70 overflow-hidden flex items-center justify-center">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={listing.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}

      {/* Fallback image container when image is missing or failed to load */}
      <div
        style={{ display: imageUrl ? 'none' : 'flex' }}
        className="w-full h-full flex flex-col items-center justify-center bg-muted/60 text-muted-foreground p-4 text-center"
      >
        <StoreIcon className="w-8 h-8 mb-1.5 opacity-50" />
        <span className="text-2xs font-semibold uppercase tracking-wider">{categoryLabel}</span>
      </div>

      {/* Category & Listing Type Badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-background/90 backdrop-blur text-foreground shadow-2xs">
          {categoryLabel}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider shadow-2xs ${
            isRent ? 'bg-primary text-primary-foreground' : 'bg-emerald-600 text-white'
          }`}
        >
          {isRent ? 'For Rent' : 'For Sale'}
        </span>
      </div>

      {/* Featured Star Badge if applicable */}
      {listing.is_featured && (
        <div className="absolute top-2.5 right-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
            <SparklesIcon className="w-3 h-3" />
            <span>Featured</span>
          </span>
        </div>
      )}
    </div>
  );

  // =========================================================================
  // LIST VIEW LAYOUT
  // =========================================================================
  if (viewMode === 'list') {
    return (
      <article
        data-testid={`listing-card-${listing.id}`}
        className="group flex flex-col sm:flex-row rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-all hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring"
      >
        {/* Cover Thumbnail on Left */}
        <div className="relative w-full sm:w-64 md:w-72 shrink-0 aspect-16/10 sm:aspect-auto">
          {imageElement}
        </div>

        {/* Content Body on Right */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  <Link to={`/listings/${listing.id}`} className="focus:outline-none">
                    {listing.title}
                  </Link>
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{locationText || 'Location not specified'}</span>
                </div>
              </div>

              {/* Price */}
              <div className="text-lg sm:text-xl font-bold text-foreground tracking-tight shrink-0">
                {formatBDT(listing.price, listing.listing_type)}
              </div>
            </div>

            {/* Description Snippet */}
            {listing.description && (
              <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {listing.description}
              </p>
            )}
          </div>

          {/* Footer Metadata & Action */}
          <div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {listing.area_sqft ? (
                <span className="font-medium text-foreground">
                  {listing.area_sqft.toLocaleString()} <span className="text-muted-foreground font-normal">sqft</span>
                </span>
              ) : (
                <span>Area upon inquiry</span>
              )}
            </div>

            <Link
              to={`/listings/${listing.id}`}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs sm:text-sm"
              aria-label={`View details for ${listing.title}`}
            >
              <span>View Details</span>
              <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // =========================================================================
  // GRID VIEW LAYOUT (Default)
  // =========================================================================
  return (
    <article
      data-testid={`listing-card-${listing.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring"
    >
      {/* Cover Image Top */}
      <div className="relative aspect-4/3 w-full shrink-0">
        {imageElement}
      </div>

      {/* Body Bottom */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          {/* Price */}
          <div className="text-xl font-bold text-foreground tracking-tight">
            {formatBDT(listing.price, listing.listing_type)}
          </div>

          {/* Title */}
          <h3 className="mt-2 text-base font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            <Link to={`/listings/${listing.id}`} className="focus:outline-none">
              {listing.title}
            </Link>
          </h3>

          {/* Location */}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{locationText || 'Location not specified'}</span>
          </div>
        </div>

        {/* Specifications Footer */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {listing.area_sqft ? (
              <span className="font-medium text-foreground">
                {listing.area_sqft.toLocaleString()} <span className="text-muted-foreground font-normal">sqft</span>
              </span>
            ) : (
              <span>Area upon inquiry</span>
            )}
          </div>

          <Link
            to={`/listings/${listing.id}`}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            aria-label={`View details for ${listing.title}`}
          >
            <span>Details</span>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

