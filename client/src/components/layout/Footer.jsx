import React from 'react';
import { Link } from 'react-router-dom';
import { StoreIcon, BuildingIcon } from '../common/Icons.jsx';

/**
 * ShopFinder — Global Responsive Footer (Task 4.4)
 *
 * Implements a semantic, accessible footer with platform overview,
 * supported commercial property categories, and verified route navigation.
 * Strictly avoids non-existent or fake routes.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  const propertyCategories = [
    'Shop',
    'Office',
    'Restaurant',
    'Warehouse',
    'Showroom',
    'Commercial Floor',
    'Industrial Space',
  ];

  return (
    <footer
      role="contentinfo"
      className="border-t border-border bg-card text-card-foreground mt-auto"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand & Description */}
          <div className="space-y-3 lg:col-span-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-bold text-lg text-primary tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <StoreIcon className="w-4 h-4 text-primary-foreground" />
              </div>
              <span>ShopFinder</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Bangladesh&apos;s premier commercial property marketplace &amp; SaaS platform.
              Connecting business owners, entrepreneurs, and commercial property landlords
              with transparent, secure listing discovery and verified contact reveals.
            </p>
          </div>

          {/* Col 2: Commercial Categories */}
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase mb-3 flex items-center gap-1.5">
              <BuildingIcon className="w-4 h-4 text-primary" />
              <span>Commercial Categories</span>
            </h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {propertyCategories.map((cat) => (
                <li key={cat} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40" aria-hidden="true" />
                  <span>{cat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Verified Quick Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase mb-3">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace"
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Marketplace
                </Link>
              </li>
              <li>
                <Link
                  to="/pricing"
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Pricing &amp; Credits
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Register Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Platform Notice */}
        <div className="mt-8 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {currentYear} ShopFinder. Commercial Property Marketplace &amp; SaaS. All rights reserved.</p>
          <p className="text-center sm:text-right">
            Secured by httpOnly Cookie Session Authentication &amp; Role Guard Architecture.
          </p>
        </div>
      </div>
    </footer>
  );
}

