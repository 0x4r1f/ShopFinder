import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getListingById } from '../services/listingService.js';
import PhotoGallery from '../components/marketplace/PhotoGallery.jsx';
import OwnerInfoCard from '../components/marketplace/OwnerInfoCard.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { Button } from '../components/ui/button.jsx';
import {
  MapPinIcon,
  StoreIcon,
  BuildingIcon,
  SparklesIcon,
  CheckCircleIcon,
  InfoIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  TagIcon,
  LayersIcon,
} from '../components/common/Icons.jsx';

/**
 * Human-readable category labels mapped to schema enum values.
 */
export const CATEGORY_LABELS = {
  retail: 'Shop (Retail)',
  office: 'Office',
  restaurant: 'Restaurant',
  warehouse: 'Warehouse',
  showroom: 'Showroom',
  other: 'Commercial Floor',
  industrial: 'Industrial Space',
};

/**
 * Generic standard commercial facilities highlights (Decision 1).
 * Clearly presented as category-based highlights, not fabricated property-specific amenities.
 */
const COMMERCIAL_HIGHLIGHTS = [
  {
    title: 'Power Supply & Backup',
    desc: 'High-capacity commercial power supply ready with dedicated electrical meter provision.',
  },
  {
    title: 'Dedicated Water Line',
    desc: 'Continuous commercial municipal supply line and dedicated water reservoir access.',
  },
  {
    title: 'Vertical Transport & Lift Access',
    desc: 'Passenger elevator access and dedicated freight/service lift provisions for heavy logistics.',
  },
  {
    title: '24/7 Access & Surveillance',
    desc: 'Round-the-clock facility access with CCTV security surveillance in common corridors.',
  },
  {
    title: 'Fire Safety & Emergency Exits',
    desc: 'Equipped with wide emergency staircases, fire hydrants/extinguishers, and safety zones.',
  },
];

/**
 * Formats a price into Bangladeshi Taka (BDT) representation.
 */
function formatBDT(price, listingType = 'rent') {
  if (price === null || price === undefined || isNaN(price)) {
    return '৳0';
  }
  const formatted = `৳${Number(price).toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${formatted} / mo` : formatted;
}

/**
 * ShopFinder — Property Details Page (Phase 5, Task 5.5)
 *
 * Implements full commercial property details view with:
 * - Photo Gallery with multiple images, thumbnails, and fallbacks
 * - Breadcrumb navigation
 * - Draft preview banner for unapproved listings (owner/admin view)
 * - Detailed commercial specifications grid
 * - Formatted property description
 * - Commercial Facilities & Highlights (Decision 1)
 * - Safe Owner Information Card demarcation (Task 5.6 placeholder)
 */
export default function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchListing() {
      if (!id) {
        setLoading(false);
        setError('Listing ID is missing');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getListingById(id, { signal: controller.signal });
        if (isMounted) {
          setListing(data);
          setLoading(false);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Listing not found');
          setLoading(false);
        }
      }
    }

    fetchListing();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);

  // Loading State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-muted-foreground">
          <span>Listing ID: {id}</span>
          <span className="sr-only">Task 5.5 Commercial Details</span>
        </div>
        <div className="py-24 flex flex-col items-center justify-center">
          <Spinner size="lg" className="text-primary mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Loading commercial property details...</p>
        </div>
      </div>
    );
  }

  // Not Found / Error State
  if (error || !listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-muted-foreground">
          <span>Listing ID: {id}</span>
          <span className="sr-only">Task 5.5 Commercial Details</span>
        </div>
        <EmptyState
          icon={<StoreIcon className="w-8 h-8" />}
          title="Commercial Property Not Found"
          description={
            error === 'Listing not found' || !listing
              ? 'The requested commercial property does not exist, has been archived, or is awaiting administrative review.'
              : error
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <Link to="/marketplace">
                <Button variant="default">Browse Marketplace</Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[listing.category] || listing.category || 'Commercial';
  const isRent = listing.listing_type === 'rent';
  const locationString = [listing.address, listing.area, listing.city].filter(Boolean).join(', ');
  const isUnapproved = listing.status && listing.status !== 'approved';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Compatibility Roadmap Text & ID */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-muted-foreground border-b border-border/40 pb-3">
        <span>Listing ID: {id}</span>
        <span className="sr-only">Task 5.5 Commercial Details</span>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back to Marketplace
        </Link>
      </div>

      {/* Owner/Admin Draft Preview Banner (Decision 2) */}
      {isUnapproved && (
        <NotificationBanner
          variant="warning"
          title={`Draft Preview — Status: ${listing.status.toUpperCase()}`}
          className="shadow-xs"
        >
          <p className="text-xs sm:text-sm mt-1 leading-relaxed">
            This commercial listing is currently in <strong>{listing.status}</strong> status and is only visible to you
            as the property owner or an administrator. It is not publicly accessible in the marketplace until approved.
          </p>
        </NotificationBanner>
      )}

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs sm:text-sm">
        <ol className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </li>
          <li>
            <Link to="/marketplace" className="hover:text-foreground transition-colors">
              Marketplace
            </Link>
          </li>
          {listing.category && (
            <>
              <li aria-hidden="true">
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </li>
              <li>
                <Link
                  to={`/marketplace?category=${encodeURIComponent(listing.category)}`}
                  className="hover:text-foreground transition-colors"
                >
                  {categoryLabel}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </li>
          <li className="font-medium text-foreground truncate max-w-[200px] sm:max-w-xs" aria-current="page">
            {listing.title}
          </li>
        </ol>
      </nav>

      {/* Property Title & Header Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            {categoryLabel}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isRent
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            {isRent ? 'For Rent' : 'For Sale'}
          </span>
          {listing.is_featured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              <SparklesIcon className="w-3 h-3" />
              Featured Property
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
          {listing.title}
        </h1>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPinIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{locationString || `${listing.city}, Bangladesh`}</span>
        </div>
      </div>

      {/* Main Content Layout: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Photo Gallery, Specs, Description, Facilities (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. Photo Gallery Component */}
          <section aria-label="Commercial property photos">
            <PhotoGallery
              images={listing.images && listing.images.length > 0 ? listing.images : listing.cover_image ? [listing.cover_image] : []}
              title={listing.title}
            />
          </section>

          {/* 2. Key Specifications Grid */}
          <section aria-label="Property specifications" className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <LayersIcon className="w-5 h-5 text-primary" />
              Property Specifications
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">Pricing</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5">
                  {formatBDT(listing.price, listing.listing_type)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">Floor Area</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5">
                  {listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString()} sq ft` : 'Upon Request'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">Property Type</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5 truncate">
                  {categoryLabel}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">Purpose</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5">
                  {isRent ? 'Commercial Rent' : 'Commercial Sale'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">City / Division</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5 truncate">
                  {listing.city || '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                <span className="text-xs font-medium text-muted-foreground block">Listed Date</span>
                <span className="text-base sm:text-lg font-bold text-foreground block mt-0.5 truncate">
                  {listing.created
                    ? new Date(listing.created).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* 3. Description Section */}
          <section aria-label="About property" className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-primary" />
              About This Commercial Property
            </h2>

            <div className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line break-words">
              {listing.description || 'No detailed description provided for this commercial listing.'}
            </div>
          </section>

          {/* 4. Commercial Facilities & Highlights (Decision 1) */}
          <section
            aria-label="Commercial facilities and highlights"
            className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-primary" />
                Commercial Facilities &amp; Highlights
              </h2>
              <span className="text-xs text-muted-foreground font-medium">Standard Category Provisions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {COMMERCIAL_HIGHLIGHTS.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/40">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Explicit Category Disclaimer Note */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-2.5 text-xs text-muted-foreground">
              <InfoIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Notice:</strong> The features above represent standard commercial infrastructure provisions typical for{' '}
                <strong>{categoryLabel}</strong> commercial spaces. Specific site amenities may vary; please confirm details during direct site inspection.
              </p>
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Sidebar with Pricing & Owner Demarcation (1/3 width) */}
        <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
          {/* Pricing Action Box */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Commercial Valuation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">
                {formatBDT(listing.price, listing.listing_type)}
              </span>
            </div>

            <div className="pt-2 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between py-1">
                <span>Location</span>
                <span className="font-medium text-foreground">{listing.city || 'Bangladesh'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Floor Space</span>
                <span className="font-medium text-foreground">
                  {listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString()} sq ft` : 'Upon Request'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Transaction Type</span>
                <span className="font-medium text-foreground">{isRent ? 'Lease / Rent' : 'Outright Sale'}</span>
              </div>
            </div>
          </div>

          {/* Safe Owner Information Card & Contact Reveal (Phase 10, Task 10.9) */}
          <OwnerInfoCard owner={listing.owner} listing={listing} />
        </aside>
      </div>
    </div>
  );
}

