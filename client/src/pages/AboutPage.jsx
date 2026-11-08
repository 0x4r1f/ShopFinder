import React from 'react';
import { Link } from 'react-router-dom';
import {
  StoreIcon,
  BuildingIcon,
  ShieldCheckIcon,
  FileTextIcon,
  CheckCircleIcon,
  MapPinIcon,
  ArrowRightIcon,
} from '../components/common/Icons.jsx';
import { Button } from '../components/ui/button.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';

/**
 * ShopFinder — About Us Page (Phase 12, Task 12.4)
 *
 * Informational page detailing the platform mission, commercial focus,
 * operating model, and coverage across Bangladesh.
 */
export default function AboutPage() {
  const categories = [
    { name: 'Retail Shops', desc: 'High-footfall storefronts and market spaces' },
    { name: 'Commercial Offices', desc: 'Corporate suites and collaborative work hubs' },
    { name: 'Restaurants & Cafes', desc: 'F&B ready spaces with dining and kitchen provisions' },
    { name: 'Warehouses & Godowns', desc: 'Secure storage and logistics distribution centers' },
    { name: 'Showrooms', desc: 'Prime frontage display facilities for brands' },
    { name: 'Commercial Floors', desc: 'Full-floor leases in multi-story towers' },
    { name: 'Industrial Spaces', desc: 'Manufacturing plants and light industrial units' },
  ];

  const hubs = [
    'Dhaka (Motijheel, Gulshan, Banani, Uttara, Dhanmondi)',
    'Chittagong (Agrabad, GEC, Nasirabad)',
    'Sylhet (Zindabazar, Amberkhana)',
    'Rajshahi (Shaheb Bazar)',
    'Khulna (Shibbari, KDA)',
    'Gazipur & Industrial Belts',
  ];

  return (
    <div className="py-10 md:py-16 space-y-16">
      {/* 1. Hero Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <StoreIcon className="w-4 h-4" />
          <span>About ShopFinder</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
          Bangladesh&apos;s Dedicated Commercial Property Marketplace
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Connecting businesses, entrepreneurs, and commercial property owners with transparent listings, accurate specifications, and spam-free direct contact reveals.
        </p>
      </section>

      {/* 2. Platform Mission & Origin */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 shadow-xs space-y-6">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Built for Commercial Real Estate
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Traditional real estate portals in Bangladesh are overwhelmingly tailored for residential apartments and houses. Finding a commercial space—whether a high-street retail shop, an executive office floor, or an industrial warehouse—often involves unverified brokers, inaccurate listings, and wasted time.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              ShopFinder was created to bridge this gap. We provide a single, dedicated commercial real estate platform where property specifications are clearly documented, pricing in Bangladeshi Taka is upfront, and property owner contact information is safeguarded against scrapers and telemarketing spam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
            <div className="space-y-2">
              <div className="text-3xl font-extrabold text-primary">100%</div>
              <h3 className="text-base font-semibold text-foreground">Commercial Focus</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Zero residential noise. Every listing is categorized under strict commercial use types.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-extrabold text-primary">Admin</div>
              <h3 className="text-base font-semibold text-foreground">Moderated Inventory</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every property listing undergoes administrator verification before public display.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-extrabold text-primary">1 Credit</div>
              <h3 className="text-base font-semibold text-foreground">Direct Owner Reveal</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Unlock verified owner contact numbers directly with lifetime history access and zero recurring fees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Core Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Our Core Principles
          </h2>
          <p className="text-sm text-muted-foreground">
            How we protect buyers, tenants, and property owners alike.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BuildingIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Clear Commercial Specs
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every listing includes explicit floor area in square feet, rental or sale terms, floor levels, neighborhood coordinates, and high-resolution photo galleries.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Privacy by Architecture
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Under our D-014 privacy policy, owner telephone numbers are stored in an isolated database collection and are never leaked to public web scrapers or unauthenticated visitors.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileTextIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Fair &amp; Transparent Credits
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Customers purchase one-time credit packages. Credits never expire, stack indefinitely, and allow deliberate contact unlocks without recurring subscriptions or surprises.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Supported Commercial Categories */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card/60 p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Commercial Property Types We Serve
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Focused strictly on business, industrial, and commercial premises in Bangladesh.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="p-4 rounded-xl border border-border/70 bg-card space-y-1"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircleIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>{cat.name}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Geographic Commercial Hubs */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Geographic Coverage
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Active commercial property discovery across major municipal and industrial centers in Bangladesh.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {hubs.map((hub) => (
            <div
              key={hub}
              className="flex items-center gap-2 p-3.5 rounded-xl border border-border bg-card text-xs font-medium text-foreground"
            >
              <MapPinIcon className="w-4 h-4 text-primary shrink-0" />
              <span>{hub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Call to Action */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-10 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Ready to find or list your commercial space?
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Browse our verified commercial inventory or join as a property owner to reach thousands of prospective business tenants. Inquiries: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline font-medium">{SUPPORT_EMAIL}</a>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link to="/marketplace">
              <Button className="font-semibold shadow-xs">
                <span>Browse Marketplace</span>
                <ArrowRightIcon className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline">
                <span>Contact Us</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
