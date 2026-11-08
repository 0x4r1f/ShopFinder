import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getListings } from '../services/listingService.js';
import ListingCard from '../components/marketplace/ListingCard.jsx';
import FilterSidebar from '../components/marketplace/FilterSidebar.jsx';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import { ListingsGridSkeleton } from '../components/common/Skeletons.jsx';
import {
  GridIcon,
  ListIcon,
  SlidersIcon,
  StoreIcon,
  HomeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from '../components/common/Icons.jsx';
import { Button } from '../components/ui/button.jsx';

/**
 * Supported Commercial Categories mapping to schema enum values (Decision 2).
 */
export const CATEGORY_MAP = {
  retail: 'retail',
  shop: 'retail',
  office: 'office',
  restaurant: 'restaurant',
  warehouse: 'warehouse',
  showroom: 'showroom',
  other: 'other',
  'commercial floor': 'other',
  industrial: 'industrial',
  'industrial space': 'industrial',
};

export const CATEGORY_LABELS = {
  retail: 'Shop (Retail)',
  office: 'Office',
  restaurant: 'Restaurant',
  warehouse: 'Warehouse',
  showroom: 'Showroom',
  other: 'Commercial Floor',
  industrial: 'Industrial Space',
};

export function normalizeCategory(val) {
  if (!val || typeof val !== 'string') return '';
  const key = val.trim().toLowerCase();
  return CATEGORY_MAP[key] || '';
}

/**
 * Supported sorting options for marketplace catalog (Task 5.4).
 */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

/**
 * Calculates page numbers with windowing ellipsis for pagination bar.
 *
 * @param {number} currentPage
 * @param {number} totalPages
 * @returns {Array<number|string>}
 */
export function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  if (currentPage > 3) {
    pages.push('...');
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) {
    pages.push('...');
  }
  pages.push(totalPages);
  return pages;
}

/**
 * ShopFinder — Commercial Marketplace Browse Page (Phase 5, Task 5.4)
 *
 * Implements dedicated marketplace browsing with multi-parameter search, filtering,
 * server-side sorting, pagination, URL synchronization, and responsive layout toggles.
 */
export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode preference: default 'grid' per Decision 2
  const [viewMode, setViewMode] = useState('grid');

  // Mobile filter drawer open/close state
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Listings data & network state
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 12,
    totalItems: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derive sort option from searchParams
  const sort = useMemo(() => {
    const rawSort = searchParams.get('sort');
    if (rawSort === 'price_asc' || rawSort === 'price' || rawSort === '+price') return 'price_asc';
    if (rawSort === 'price_desc' || rawSort === '-price') return 'price_desc';
    return 'newest';
  }, [searchParams]);

  // Derive pagination parameters from searchParams
  const page = useMemo(() => {
    const p = parseInt(searchParams.get('page'), 10);
    return !isNaN(p) && p >= 1 ? p : 1;
  }, [searchParams]);

  const perPage = useMemo(() => {
    const pp = parseInt(searchParams.get('perPage'), 10);
    return !isNaN(pp) && pp >= 1 && pp <= 100 ? pp : 12;
  }, [searchParams]);

  // Derive normalized filters object from searchParams
  const filters = useMemo(() => {
    const params = {};
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const listing_type = searchParams.get('listing_type');
    const min_price = searchParams.get('min_price');
    const max_price = searchParams.get('max_price');
    const min_area = searchParams.get('min_area');
    const max_area = searchParams.get('max_area');
    const city = searchParams.get('city');
    const area = searchParams.get('area');

    if (search && search.trim()) params.search = search.trim();
    if (category && category.trim()) {
      const norm = normalizeCategory(category);
      if (norm) params.category = norm;
    }
    if (listing_type && listing_type.trim()) params.listing_type = listing_type.trim();
    if (min_price && min_price.trim()) params.min_price = min_price.trim();
    if (max_price && max_price.trim()) params.max_price = max_price.trim();
    if (min_area && min_area.trim()) params.min_area = min_area.trim();
    if (max_area && max_area.trim()) params.max_area = max_area.trim();
    if (city && city.trim()) params.city = city.trim();
    if (area && area.trim()) params.area = area.trim();

    return params;
  }, [searchParams]);

  // Build active filter chips for rendering and individual dismissal
  const activeFilterList = useMemo(() => {
    const items = [];
    if (filters.search) {
      items.push({ key: 'search', label: `Search: "${filters.search}"` });
    }
    if (filters.category) {
      const label = CATEGORY_LABELS[filters.category] || filters.category;
      items.push({ key: 'category', label: `Category: ${label}` });
    }
    if (filters.listing_type) {
      const typeLabel =
        filters.listing_type === 'rent'
          ? 'For Rent'
          : filters.listing_type === 'sale'
            ? 'For Sale'
            : filters.listing_type;
      items.push({ key: 'listing_type', label: `Type: ${typeLabel}` });
    }
    if (filters.min_price) {
      items.push({
        key: 'min_price',
        label: `Min Price: ৳${Number(filters.min_price).toLocaleString('en-US')}`,
      });
    }
    if (filters.max_price) {
      items.push({
        key: 'max_price',
        label: `Max Price: ৳${Number(filters.max_price).toLocaleString('en-US')}`,
      });
    }
    if (filters.min_area) {
      items.push({
        key: 'min_area',
        label: `Min Area: ${Number(filters.min_area).toLocaleString('en-US')} sq ft`,
      });
    }
    if (filters.max_area) {
      items.push({
        key: 'max_area',
        label: `Max Area: ${Number(filters.max_area).toLocaleString('en-US')} sq ft`,
      });
    }
    if (filters.city) {
      items.push({ key: 'city', label: `City: ${filters.city}` });
    }
    if (filters.area) {
      items.push({ key: 'area', label: `Area: ${filters.area}` });
    }
    return items;
  }, [filters]);

  // Instant filter change handler for dropdowns/radios (Resets page to 1)
  const handleInstantChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      newParams.set(key, String(value).trim());
    } else {
      newParams.delete(key);
    }
    newParams.delete('page'); // Reset to page 1 on filter change
    setSearchParams(newParams, { replace: true });
  };

  // Text & numeric filter submission handler (Resets page to 1)
  const handleApplyTextFilters = (textFilters) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(textFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        newParams.set(key, String(value).trim());
      } else {
        newParams.delete(key);
      }
    });
    newParams.delete('page'); // Reset to page 1 on filter change
    setSearchParams(newParams, { replace: true });
  };

  // Clear all filters handler (Resets page to 1, preserves sort if non-default)
  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    if (sort && sort !== 'newest') {
      newParams.set('sort', sort);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Remove single active filter (Resets page to 1)
  const handleRemoveFilter = (key) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(key);
    newParams.delete('page'); // Reset to page 1 on filter removal
    setSearchParams(newParams, { replace: true });
  };

  // Sort change handler (Resets page to 1)
  const handleSortChange = (newSort) => {
    const newParams = new URLSearchParams(searchParams);
    if (newSort && newSort !== 'newest') {
      newParams.set('sort', newSort);
    } else {
      newParams.delete('sort');
    }
    newParams.delete('page'); // Reset to page 1 on sort change
    setSearchParams(newParams, { replace: true });
  };

  // Page change handler (Preserves filters and sort)
  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set('page', String(newPage));
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams, { replace: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch approved listings from the backend API with filters, sort, and pagination
  const fetchListings = async (activeFilters, currentSort, currentPage, currentPerPage, signal) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getListings({
        ...activeFilters,
        sort: currentSort,
        page: currentPage,
        perPage: currentPerPage,
        signal,
      });

      const items = Array.isArray(result) ? result : result?.listings || [];
      const meta = result?.pagination || {
        page: currentPage,
        perPage: currentPerPage,
        totalItems: items.length,
        totalPages: 1,
      };

      setListings(items);
      setPagination(meta);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err?.message || 'Unable to load commercial properties. Please try again.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchListings(filters, sort, page, perPage, controller.signal);
    return () => {
      controller.abort();
    };
  }, [searchParams]);

  // Derived results summary range
  const resultsSummary = useMemo(() => {
    if (pagination.totalItems === 0) {
      return 'Showing 0 commercial properties';
    }
    const from = (pagination.page - 1) * pagination.perPage + 1;
    const to = Math.min(pagination.page * pagination.perPage, pagination.totalItems);
    if (from <= to) {
      return `Showing ${from}–${to} of ${pagination.totalItems} commercial properties`;
    }
    return `Page ${pagination.page} of ${pagination.totalPages} (${pagination.totalItems} total properties)`;
  }, [pagination]);

  const isOutOfBoundsPage =
    !isLoading &&
    !error &&
    listings.length === 0 &&
    pagination.totalItems > 0 &&
    pagination.page > pagination.totalPages;

  return (
    <div className="min-h-screen bg-background">
      {/* =====================================================================
          1. BREADCRUMBS & HEADER BANNER
          ===================================================================== */}
      <div className="bg-card border-b border-border py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground inline-flex items-center gap-1">
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </li>
              <li aria-current="page" className="font-semibold text-foreground">
                Marketplace
              </li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Commercial Marketplace
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Discover verified commercial shops, offices, warehouses, and industrial spaces across Bangladesh.
              </p>
            </div>

            {/* Mobile Filter Button (< lg) */}
            <div className="lg:hidden flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex items-center gap-2 text-xs font-semibold relative"
                aria-label="Open filter options"
              >
                <SlidersIcon className="w-4 h-4" />
                <span>Filters</span>
                {activeFilterList.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                    {activeFilterList.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. MAIN CONTENT LAYOUT (Sidebar + Catalog)
          ===================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Desktop Filter Sidebar & Mobile Drawer Shell */}
          <FilterSidebar
            isOpen={isMobileFilterOpen}
            onClose={() => setIsMobileFilterOpen(false)}
            filters={filters}
            onInstantChange={handleInstantChange}
            onApplyTextFilters={handleApplyTextFilters}
            onClearFilters={handleClearFilters}
          />

          {/* Listings Catalog Column */}
          <main className="flex-1 w-full min-w-0">
            {/* View Controls & Results Count Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border flex-wrap gap-4">
              <div className="text-sm text-muted-foreground">
                {!isLoading && (
                  <span>
                    {resultsSummary}
                  </span>
                )}
                {isLoading && <span>Loading properties...</span>}
              </div>

              {/* Sorting & View Controls */}
              <div className="flex items-center gap-3">
                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <label htmlFor="marketplace-sort-select" className="font-medium whitespace-nowrap">
                    Sort:
                  </label>
                  <select
                    id="marketplace-sort-select"
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="h-8 px-2 rounded-md border border-input bg-card text-xs text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Sort commercial properties"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* View Mode Toggle Button Group */}
                <div
                  role="group"
                  aria-label="View layout toggle"
                  className="inline-flex items-center p-1 rounded-lg border border-border bg-card shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                    className={`p-1.5 rounded-md transition-all duration-150 active:scale-95 ${
                      viewMode === 'grid'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <GridIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                    className={`p-1.5 rounded-md transition-all duration-150 active:scale-95 ${
                      viewMode === 'list'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterList.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-6" aria-label="Active filters">
                <span className="text-xs font-semibold text-muted-foreground">Active Filters:</span>
                {activeFilterList.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(item.key)}
                      className="hover:bg-primary/20 rounded-full p-0.5 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-90"
                      aria-label={`Remove filter ${item.label}`}
                    >
                      <CloseIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1 focus-visible:outline-none transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Loading State: Content-shaped Skeletons */}
            {isLoading && (
              <div aria-live="polite" className="py-2">
                <span className="sr-only">Loading commercial listings... Fetching approved commercial properties...</span>
                <ListingsGridSkeleton count={perPage || 6} viewMode={viewMode} />
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="my-6">
                <NotificationBanner variant="error" title="Unable to load marketplace listings">
                  <div className="flex flex-col gap-3 mt-1">
                    <p className="text-sm">{error}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchListings(filters, sort, page, perPage)}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        Retry
                      </Button>
                      {activeFilterList.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFilters}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </div>
                </NotificationBanner>
              </div>
            )}

            {/* Out-of-Bounds Page State */}
            {isOutOfBoundsPage && (
              <div className="my-12 p-8 text-center rounded-xl border border-border bg-card shadow-2xs">
                <StoreIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-lg font-bold text-foreground">Page {pagination.page} Not Found</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  The requested page exceeds the available results. Total available pages: {pagination.totalPages} ({pagination.totalItems} properties found).
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handlePageChange(1)}
                  >
                    Return to Page 1
                  </Button>
                  {activeFilterList.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Zero-Results Empty State (Only when totalItems === 0) */}
            {!isLoading && !error && !isOutOfBoundsPage && listings.length === 0 && (
              <EmptyState
                icon={<StoreIcon className="w-8 h-8 text-muted-foreground" />}
                title={
                  activeFilterList.length > 0
                    ? 'No Commercial Properties Match Your Filters'
                    : 'No Commercial Properties Found'
                }
                description={
                  activeFilterList.length > 0
                    ? 'No approved commercial properties matched your current filter criteria. Try adjusting your price range, area, or clearing filters.'
                    : 'There are currently no approved commercial properties listed on the marketplace. Please check back soon or return to the homepage.'
                }
                action={
                  activeFilterList.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleClearFilters}
                        className="active:scale-[0.98] transition-transform shadow-xs"
                      >
                        Clear All Filters
                      </Button>
                      <Link
                        to="/"
                        className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-accent text-foreground transition-all duration-150 active:scale-95 shadow-2xs"
                      >
                        Back to Homepage
                      </Link>
                    </div>
                  ) : (
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 shadow-xs active:scale-95"
                    >
                      Back to Homepage
                    </Link>
                  )
                }
              />
            )}

            {/* Listings Catalog: Grid vs List Layout */}
            {!isLoading && !error && listings.length > 0 && (
              <>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6'
                      : 'flex flex-col gap-4'
                  }
                >
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode={viewMode}
                    />
                  ))}
                </div>

                {/* Pagination Controls Bar */}
                {pagination.totalPages > 1 && (
                  <nav
                    aria-label="Pagination Navigation"
                    className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4"
                  >
                    {/* Previous Page Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
                      aria-label="Go to previous page"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                      <span>Previous</span>
                    </Button>

                    {/* Numeric Page Buttons */}
                    <div className="flex items-center gap-1 flex-wrap justify-center" aria-label="Page list">
                      {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => {
                        if (pageNum === '...') {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground"
                            >
                              …
                            </span>
                          );
                        }
                        const isCurrent = pageNum === pagination.page;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => handlePageChange(pageNum)}
                            aria-current={isCurrent ? 'page' : undefined}
                            aria-label={`Page ${pageNum}`}
                            className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors flex items-center justify-center ${
                              isCurrent
                                ? 'bg-primary text-primary-foreground shadow-xs pointer-events-none'
                                : 'border border-border bg-card text-foreground hover:bg-accent'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Page Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
                      aria-label="Go to next page"
                    >
                      <span>Next</span>
                      <ChevronRightIcon className="w-4 h-4" />
                    </Button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
