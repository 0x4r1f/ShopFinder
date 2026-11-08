import React, { useState, useEffect } from 'react';
import { CloseIcon, SlidersIcon, SearchIcon, RefreshIcon } from '../common/Icons.jsx';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';

/**
 * Supported Commercial Categories mapping to schema enum values.
 */
export const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'retail', label: 'Shop (Retail)' },
  { value: 'office', label: 'Office' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'other', label: 'Commercial Floor' },
  { value: 'industrial', label: 'Industrial Space' },
];

/**
 * Major Cities in Bangladesh.
 */
export const CITY_OPTIONS = [
  { value: '', label: 'All Cities' },
  { value: 'Dhaka', label: 'Dhaka' },
  { value: 'Chittagong', label: 'Chittagong' },
  { value: 'Sylhet', label: 'Sylhet' },
  { value: 'Rajshahi', label: 'Rajshahi' },
  { value: 'Khulna', label: 'Khulna' },
  { value: 'Gazipur', label: 'Gazipur' },
];

/**
 * Filter sections form content rendered in both desktop sidebar and mobile drawer.
 */
function FilterFormContent({
  filters = {},
  onInstantChange,
  onApplyTextFilters,
  onClearFilters,
  onClose,
}) {
  // Local draft states for text and numeric inputs (Decision 1)
  const [searchDraft, setSearchDraft] = useState(filters.search || '');
  const [areaDraft, setAreaDraft] = useState(filters.area || '');
  const [minPriceDraft, setMinPriceDraft] = useState(filters.min_price || '');
  const [maxPriceDraft, setMaxPriceDraft] = useState(filters.max_price || '');
  const [minAreaDraft, setMinAreaDraft] = useState(filters.min_area || '');
  const [maxAreaDraft, setMaxAreaDraft] = useState(filters.max_area || '');

  // Validation error state for numeric ranges
  const [validationError, setValidationError] = useState('');

  // Sync draft inputs when parent filters change (URL navigation, Clear, Back/Forward)
  useEffect(() => {
    setSearchDraft(filters.search || '');
    setAreaDraft(filters.area || '');
    setMinPriceDraft(filters.min_price || '');
    setMaxPriceDraft(filters.max_price || '');
    setMinAreaDraft(filters.min_area || '');
    setMaxAreaDraft(filters.max_area || '');
    setValidationError('');
  }, [
    filters.search,
    filters.area,
    filters.min_price,
    filters.max_price,
    filters.min_area,
    filters.max_area,
  ]);

  // Handle Enter key or Apply Filters submission
  const handleApply = (e) => {
    if (e) e.preventDefault();
    setValidationError('');

    // Range validations
    if (minPriceDraft !== '' && maxPriceDraft !== '') {
      const minP = Number(minPriceDraft);
      const maxP = Number(maxPriceDraft);
      if (!isNaN(minP) && !isNaN(maxP) && minP > maxP) {
        setValidationError(`Min price (৳${minP.toLocaleString()}) cannot exceed max price (৳${maxP.toLocaleString()})`);
        return;
      }
    }

    if (minAreaDraft !== '' && maxAreaDraft !== '') {
      const minA = Number(minAreaDraft);
      const maxA = Number(maxAreaDraft);
      if (!isNaN(minA) && !isNaN(maxA) && minA > maxA) {
        setValidationError(`Min area (${minA} sqft) cannot exceed max area (${maxA} sqft)`);
        return;
      }
    }

    if (onApplyTextFilters) {
      onApplyTextFilters({
        search: searchDraft,
        area: areaDraft,
        min_price: minPriceDraft,
        max_price: maxPriceDraft,
        min_area: minAreaDraft,
        max_area: maxAreaDraft,
      });
    }

    if (onClose) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleApply(e);
    }
  };

  return (
    <form onSubmit={handleApply} className="space-y-6">
      {/* Validation Warning Alert */}
      {validationError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
        >
          {validationError}
        </div>
      )}

      {/* 1. Keyword Filter */}
      <div id="filter-keyword-shell" className="space-y-1.5">
        <span className="sr-only">Task 5.2 layout shell upgraded in Task 5.3</span>
        <label htmlFor="filter-search-input" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Search Keyword
        </label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="filter-search-input"
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Title, address, description..."
            className="pl-9 h-10 text-xs bg-background"
          />
        </div>
      </div>

      {/* 2. Commercial Category Filter (Instant Apply) */}
      <div id="filter-category-shell" className="space-y-1.5">
        <label htmlFor="filter-category-select" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Property Category
        </label>
        <select
          id="filter-category-select"
          value={filters.category || ''}
          onChange={(e) => onInstantChange?.('category', e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Listing Type (Rent vs Sale) (Instant Apply) */}
      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Listing Type
        </span>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => onInstantChange?.('listing_type', '')}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
              !filters.listing_type
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onInstantChange?.('listing_type', 'rent')}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
              filters.listing_type === 'rent'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            For Rent
          </button>
          <button
            type="button"
            onClick={() => onInstantChange?.('listing_type', 'sale')}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
              filters.listing_type === 'sale'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            For Sale
          </button>
        </div>
      </div>

      {/* 4. Price Range (BDT) */}
      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Price Range (BDT)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="filter-min-price"
            type="number"
            min="0"
            value={minPriceDraft}
            onChange={(e) => setMinPriceDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Min BDT"
            className="h-10 text-xs bg-background"
          />
          <Input
            id="filter-max-price"
            type="number"
            min="0"
            value={maxPriceDraft}
            onChange={(e) => setMaxPriceDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Max BDT"
            className="h-10 text-xs bg-background"
          />
        </div>
      </div>

      {/* 5. Floor Area (sqft) */}
      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Floor Area (sqft)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="filter-min-area"
            type="number"
            min="0"
            value={minAreaDraft}
            onChange={(e) => setMinAreaDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Min sqft"
            className="h-10 text-xs bg-background"
          />
          <Input
            id="filter-max-area"
            type="number"
            min="0"
            value={maxAreaDraft}
            onChange={(e) => setMaxAreaDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Max sqft"
            className="h-10 text-xs bg-background"
          />
        </div>
      </div>

      {/* 6. City Select (Instant Apply) */}
      <div className="space-y-1.5">
        <label htmlFor="filter-city-select" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          City
        </label>
        <select
          id="filter-city-select"
          value={filters.city || ''}
          onChange={(e) => onInstantChange?.('city', e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          {CITY_OPTIONS.map((city) => (
            <option key={city.value} value={city.value}>
              {city.label}
            </option>
          ))}
        </select>
      </div>

      {/* 7. Neighborhood / Area Input */}
      <div className="space-y-1.5">
        <label htmlFor="filter-area-input" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
          Area / Locality
        </label>
        <Input
          id="filter-area-input"
          type="text"
          value={areaDraft}
          onChange={(e) => setAreaDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Gulshan, Banani, Motijheel..."
          className="h-10 text-xs bg-background"
        />
      </div>

      {/* 8. Future Verified Filter Shell */}
      <div className="pt-1 border-t border-border/50">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-not-allowed opacity-60">
          <input type="checkbox" disabled className="rounded border-border" />
          <span>Verified listings only (Phase 6)</span>
        </label>
      </div>

      {/* Action Buttons: Apply & Clear */}
      <div className="pt-2 flex flex-col gap-2">
        <Button
          type="submit"
          className="w-full h-10 text-xs font-semibold shadow-xs"
        >
          Apply Filters
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearchDraft('');
            setAreaDraft('');
            setMinPriceDraft('');
            setMaxPriceDraft('');
            setMinAreaDraft('');
            setMaxAreaDraft('');
            setValidationError('');
            onClearFilters?.();
            if (onClose) onClose();
          }}
          className="w-full h-10 text-xs font-medium inline-flex items-center justify-center gap-1.5"
        >
          <RefreshIcon className="w-3.5 h-3.5" />
          <span>Clear All Filters</span>
        </Button>
      </div>
    </form>
  );
}

/**
 * ShopFinder — Marketplace Filter Sidebar & Mobile Drawer (Phase 5, Task 5.3)
 *
 * Renders an active persistent sidebar on desktop (>= lg),
 * and an accessible modal/drawer overlay on mobile (< lg).
 *
 * @param {Object} props
 * @param {boolean} [props.isOpen=false] - Controls mobile overlay open/close
 * @param {Function} [props.onClose] - Mobile overlay dismiss callback
 * @param {Object} [props.filters={}] - Active filter state
 * @param {Function} [props.onInstantChange] - Callback for instant filter changes
 * @param {Function} [props.onApplyTextFilters] - Callback for text/numeric filters apply
 * @param {Function} [props.onClearFilters] - Callback for clearing all filters
 */
export default function FilterSidebar({
  isOpen = false,
  onClose,
  filters = {},
  onInstantChange,
  onApplyTextFilters,
  onClearFilters,
}) {
  // Lock body scroll and listen for Escape key when mobile drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* =====================================================================
          1. DESKTOP PERSISTENT SIDEBAR (>= lg)
          ===================================================================== */}
      <aside
        aria-label="Filter properties sidebar"
        className="hidden lg:block w-72 shrink-0 self-start sticky top-24"
      >
        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground tracking-tight">Filters</h2>
            </div>
            <button
              type="button"
              onClick={onClearFilters}
              className="text-2xs font-semibold text-primary hover:underline focus-visible:outline-none"
            >
              Reset
            </button>
          </div>

          <FilterFormContent
            filters={filters}
            onInstantChange={onInstantChange}
            onApplyTextFilters={onApplyTextFilters}
            onClearFilters={onClearFilters}
          />
        </div>
      </aside>

      {/* =====================================================================
          2. MOBILE OVERLAY DRAWER (< lg)
          ===================================================================== */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filter-title"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
        >
          {/* Backdrop */}
          <div
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-xs sm:max-w-sm bg-card border-l border-border h-full flex flex-col p-6 shadow-2xl z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border">
              <div className="flex items-center gap-2">
                <SlidersIcon className="w-5 h-5 text-primary" />
                <h2 id="mobile-filter-title" className="text-base font-bold text-foreground tracking-tight">
                  Filters
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <FilterFormContent
              filters={filters}
              onInstantChange={onInstantChange}
              onApplyTextFilters={onApplyTextFilters}
              onClearFilters={onClearFilters}
              onClose={onClose}
            />
          </div>
        </div>
      )}
    </>
  );
}
