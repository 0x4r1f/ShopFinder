import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getFeaturedListings } from '../services/listingService.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import {
  SearchIcon,
  MapPinIcon,
  StoreIcon,
  BuildingIcon,
  UtensilsIcon,
  WarehouseIcon,
  EyeIcon,
  LayersIcon,
  FactoryIcon,
  ShieldCheckIcon,
  FileTextIcon,
  SparklesIcon,
  ChevronRightIcon,
  TagIcon,
} from '../components/common/Icons.jsx';

/**
 * 7 Official Commercial Property Categories
 * Maps user-facing labels to PocketBase database schema values.
 */
export const PROPERTY_CATEGORIES = [
  {
    id: 'retail',
    label: 'Shop',
    description: 'Retail shops, outlets & storefronts',
    Icon: StoreIcon,
  },
  {
    id: 'office',
    label: 'Office',
    description: 'Corporate offices, suites & co-working',
    Icon: BuildingIcon,
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Cafes, food courts & dining spaces',
    Icon: UtensilsIcon,
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    description: 'Storage facilities & logistics hubs',
    Icon: WarehouseIcon,
  },
  {
    id: 'showroom',
    label: 'Showroom',
    description: 'Display centers & commercial halls',
    Icon: EyeIcon,
  },
  {
    id: 'other',
    label: 'Commercial Floor',
    description: 'Full or partial commercial floors',
    Icon: LayersIcon,
  },
  {
    id: 'industrial',
    label: 'Industrial Space',
    description: 'Factories, workshops & plants',
    Icon: FactoryIcon,
  },
];

/**
 * Major Cities for Quick Selection
 */
export const POPULAR_CITIES = [
  'Dhaka',
  'Chittagong',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Gazipur',
];

/**
 * Formats a numeric price into Bangladeshi Taka (BDT) representation.
 *
 * @param {number} price
 * @param {'rent'|'sale'} [listingType='rent']
 * @returns {string}
 */
export function formatBDTPrice(price, listingType = 'rent') {
  if (price === null || price === undefined || isNaN(price)) {
    return '৳0';
  }
  const formatted = `৳${Number(price).toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${formatted} / mo` : formatted;
}

/**
 * ShopFinder — Commercial Property Homepage (Phase 5, Task 5.1)
 */
export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Search banner form state
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Featured listings state
  const [featuredListings, setFeaturedListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [listingsError, setListingsError] = useState(null);

  // Fetch featured listings on component mount
  const fetchListings = async (signal) => {
    setIsLoadingListings(true);
    setListingsError(null);
    try {
      const data = await getFeaturedListings({ limit: 6, signal });
      setFeaturedListings(Array.isArray(data) ? data : []);
    } catch (err) {
      if (signal?.aborted) return;
      setListingsError(err?.message || 'Unable to load featured commercial listings. Please try again.');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingListings(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchListings(controller.signal);
    return () => controller.abort();
  }, []);

  // Handle hero search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('search', keyword.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedCity) params.set('city', selectedCity);

    const queryString = params.toString();
    navigate(queryString ? `/marketplace?${queryString}` : '/marketplace');
  };

  // Navigate to marketplace with pre-filtered category
  const handleCategoryClick = (categoryValue) => {
    navigate(`/marketplace?category=${encodeURIComponent(categoryValue)}`);
  };

  // Navigate to marketplace with pre-filtered city
  const handleCityClick = (cityName) => {
    navigate(`/marketplace?city=${encodeURIComponent(cityName)}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* =========================================================================
          SECTION A: HERO SEARCH BANNER
          ========================================================================= */}
      <section
        aria-label="Commercial property search hero"
        className="relative bg-gradient-to-b from-primary/10 via-card to-background border-b border-border py-12 md:py-20 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge & Slogan */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-semibold tracking-wide uppercase mb-4 shadow-2xs">
            <SparklesIcon className="w-4 h-4 text-primary" />
            <span>Commercial Property Marketplace &amp; SaaS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight leading-tight">
            Find the Perfect Commercial Space in <span className="text-primary">Bangladesh</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover verified shops, offices, warehouses, showrooms, and commercial floors. Connect directly with property owners.
          </p>

          {/* Search Form Card */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Search commercial properties"
            className="mt-8 md:mt-10 p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-lg max-w-4xl mx-auto text-left"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
              {/* Keyword / Location Input */}
              <div className="lg:col-span-5 space-y-1.5">
                <label htmlFor="search-keyword" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                  Location or Keyword
                </label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="search-keyword"
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. Gulshan, Motijheel, Banani..."
                    className="pl-9 h-11 bg-background text-sm"
                  />
                </div>
              </div>

              {/* Category Select */}
              <div className="lg:col-span-3 space-y-1.5">
                <label htmlFor="search-category" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                  Property Category
                </label>
                <select
                  id="search-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  <option value="">All Categories</option>
                  {PROPERTY_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Select */}
              <div className="lg:col-span-2 space-y-1.5">
                <label htmlFor="search-city" className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                  City
                </label>
                <select
                  id="search-city"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  <option value="">All Cities</option>
                  {POPULAR_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Search Button */}
              <div className="sm:col-span-2 lg:col-span-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 font-semibold flex items-center justify-center gap-2 shadow-sm"
                >
                  <SearchIcon className="w-4 h-4" />
                  <span>Search</span>
                </Button>
              </div>
            </div>
          </form>

          {/* Quick unauthenticated access links */}
          {!isAuthenticated && (
            <div className="mt-5 text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
              <span>Are you a commercial property owner?</span>
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Go to Login
              </Link>
              <span>or</span>
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Register as Owner
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION B: PROPERTY CATEGORY GRID
          ========================================================================= */}
      <section
        aria-labelledby="categories-heading"
        className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 id="categories-heading" className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Browse by Commercial Category
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Explore spaces engineered for retail businesses, corporate enterprises, dining, and logistics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {PROPERTY_CATEGORIES.map((cat) => {
            const IconComponent = cat.Icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className="group flex flex-col items-start p-5 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/40 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                  <IconComponent className="w-6 h-6 transition-colors" />
                </div>
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                    {cat.label}
                  </h3>
                  <ChevronRightIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {cat.description}
                </p>
              </button>
            );
          })}

          {/* All Categories shortcut card */}
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="group flex flex-col items-start justify-center p-5 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mb-4 shadow-xs">
              <StoreIcon className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between w-full">
              <h3 className="font-semibold text-primary text-base">
                View All Categories
              </h3>
              <ChevronRightIcon className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Browse the complete marketplace catalog of commercial properties.
            </p>
          </button>
        </div>
      </section>

      {/* =========================================================================
          SECTION C: QUICK CITY SELECTOR
          ========================================================================= */}
      <section
        aria-labelledby="cities-heading"
        className="py-10 bg-muted/40 border-y border-border px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 id="cities-heading" className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Popular Commercial Hubs
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Jump directly to commercial properties in top metropolitan centers
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleCityClick(city)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-xs sm:text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-2xs"
              >
                <MapPinIcon className="w-3.5 h-3.5" />
                <span>{city}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION D: FEATURED COMMERCIAL LISTINGS
          ========================================================================= */}
      <section
        aria-labelledby="featured-heading"
        className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              <SparklesIcon className="w-4 h-4" />
              <span>Handpicked Spaces</span>
            </div>
            <h2 id="featured-heading" className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Featured Commercial Properties
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Top-rated commercial properties approved for listing on the marketplace
            </p>
          </div>

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline shrink-0"
          >
            <span>Explore all listings</span>
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Loading State */}
        {isLoadingListings && (
          <div className="flex flex-col items-center justify-center py-20 gap-3" aria-live="polite">
            <Spinner size="lg" label="Loading featured commercial properties..." />
            <p className="text-sm text-muted-foreground">Loading featured commercial spaces...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoadingListings && listingsError && (
          <div className="max-w-2xl mx-auto my-6">
            <NotificationBanner
              variant="error"
              title="Unable to load featured properties"
            >
              <div className="flex flex-col gap-3 mt-1">
                <p className="text-sm">{listingsError}</p>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchListings()}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </NotificationBanner>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingListings && !listingsError && featuredListings.length === 0 && (
          <EmptyState
            icon={<StoreIcon className="w-7 h-7 text-muted-foreground" />}
            title="No Featured Commercial Properties"
            description="There are currently no featured commercial listings approved on the marketplace. Explore all commercial properties or check back soon."
            action={
              <Button
                type="button"
                onClick={() => navigate('/marketplace')}
                className="font-medium"
              >
                Browse All Commercial Properties
              </Button>
            }
          />
        )}

        {/* Featured Listings Grid */}
        {!isLoadingListings && !listingsError && featuredListings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredListings.map((listing) => {
              const categoryMatch = PROPERTY_CATEGORIES.find((c) => c.id === listing.category);
              const categoryLabel = categoryMatch ? categoryMatch.label : listing.category || 'Commercial';
              const isRent = listing.listing_type === 'rent';

              return (
                <article
                  key={listing.id}
                  className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring"
                >
                  {/* Listing Image */}
                  <div className="relative aspect-4/3 w-full bg-muted/70 overflow-hidden flex items-center justify-center">
                    {listing.cover_image?.thumb_url || listing.cover_image?.url ? (
                      <img
                        src={listing.cover_image.thumb_url || listing.cover_image.url}
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

                    {/* Fallback image placeholder when image is missing or errors */}
                    <div
                      style={{
                        display:
                          listing.cover_image?.thumb_url || listing.cover_image?.url ? 'none' : 'flex',
                      }}
                      className="w-full h-full flex flex-col items-center justify-center bg-muted/60 text-muted-foreground p-6 text-center"
                    >
                      <StoreIcon className="w-10 h-10 mb-2 opacity-50" />
                      <span className="text-xs font-medium uppercase tracking-wider">{categoryLabel}</span>
                    </div>

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-background/90 backdrop-blur text-foreground shadow-xs">
                        {categoryLabel}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider shadow-xs ${
                          isRent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isRent ? 'For Rent' : 'For Sale'}
                      </span>
                    </div>

                    {/* Featured Star Badge */}
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-bold uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                        <SparklesIcon className="w-3 h-3" />
                        <span>Featured</span>
                      </span>
                    </div>
                  </div>

                  {/* Listing Body */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      {/* Price Display */}
                      <div className="text-xl font-bold text-foreground tracking-tight">
                        {formatBDTPrice(listing.price, listing.listing_type)}
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
                        <span className="truncate">
                          {[listing.address, listing.area, listing.city].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>

                    {/* Specifications footer */}
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        {listing.area_sqft ? (
                          <span className="font-medium text-foreground">
                            {listing.area_sqft.toLocaleString()} <span className="text-muted-foreground">sqft</span>
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
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION E: VALUE PROPOSITION SECTION
          ========================================================================= */}
      <section
        aria-labelledby="value-prop-heading"
        className="py-12 md:py-20 bg-muted/30 border-t border-border px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 id="value-prop-heading" className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Why Choose ShopFinder?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              A modern commercial property marketplace built specifically for businesses and commercial landlords in Bangladesh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Value Prop 1 */}
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-border shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 shrink-0">
                <StoreIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Dedicated Commercial Focus
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Filter exclusively across retail shops, offices, warehouses, showrooms, and industrial floors without residential clutter.
              </p>
            </div>

            {/* Value Prop 2 */}
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-border shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 shrink-0">
                <FileTextIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Clear Property Information
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Evaluate spaces with upfront floor dimensions, high-resolution photography, accurate locations, and clear rental terms.
              </p>
            </div>

            {/* Value Prop 3 */}
            <div className="flex flex-col items-start p-6 rounded-2xl bg-card border border-border shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 shrink-0">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Protected Direct Contact
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connect directly with property owners through our safe contact reveal process, keeping owner information spam-free and secure.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
