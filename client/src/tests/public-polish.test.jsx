import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import HomePage, { PROPERTY_CATEGORIES, POPULAR_CITIES, formatBDTPrice } from '../pages/HomePage.jsx';
import { ListingsGridSkeleton, ListingDetailSkeleton } from '../components/common/Skeletons.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

describe('Phase 12, Task 12.3, Step 2 — Marketplace, Homepage & Public UI Polish', () => {
  // =========================================================================
  // 1. Source Code Verification: Imports and Skeletons Integration
  // =========================================================================
  describe('1. Static Source Code Structure & Integration', () => {
    test('1.1 HomePage integrates ListingsGridSkeleton and micro-interactions', () => {
      const homeSource = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');

      // Verify ListingsGridSkeleton import and usage
      assert.ok(
        homeSource.includes("import { ListingsGridSkeleton } from '../components/common/Skeletons.jsx'"),
        'HomePage must import ListingsGridSkeleton'
      );
      assert.ok(
        homeSource.includes('<ListingsGridSkeleton count={6} viewMode="grid" />'),
        'HomePage must render ListingsGridSkeleton with 6 items in grid view mode'
      );
      assert.ok(
        homeSource.includes('Loading featured commercial spaces...'),
        'HomePage must include accessible screen-reader announcement'
      );

      // Verify micro-interactions on hero search, categories, and city pills
      assert.ok(
        homeSource.includes('active:scale-[0.98]'),
        'HomePage buttons or cards must have active:scale-[0.98] micro-interaction'
      );
      assert.ok(
        homeSource.includes('active:scale-95'),
        'City pills must include active:scale-95 micro-interaction'
      );
    });

    test('1.2 MarketplacePage integrates ListingsGridSkeleton and polished empty/filter states', () => {
      const marketplaceSource = fs.readFileSync(path.join(clientSrcDir, 'pages/MarketplacePage.jsx'), 'utf8');

      // Verify ListingsGridSkeleton import and usage
      assert.ok(
        marketplaceSource.includes("import { ListingsGridSkeleton } from '../components/common/Skeletons.jsx'"),
        'MarketplacePage must import ListingsGridSkeleton'
      );
      assert.ok(
        marketplaceSource.includes('<ListingsGridSkeleton count={perPage || 6} viewMode={viewMode} />'),
        'MarketplacePage must dynamically pass viewMode and perPage count to ListingsGridSkeleton'
      );
      assert.ok(
        marketplaceSource.includes('Loading commercial listings... Fetching approved commercial properties...'),
        'MarketplacePage must include accessible sr-only loading description'
      );

      // Verify view mode toggle micro-interactions
      assert.ok(
        marketplaceSource.includes('transition-all duration-150 active:scale-95'),
        'View mode toggle buttons must have active:scale-95 micro-interaction'
      );

      // Verify filter remove button micro-interaction
      assert.ok(
        marketplaceSource.includes('active:scale-90'),
        'Filter removal icon buttons must have active:scale-90 micro-interaction'
      );

      // Verify actionable empty state
      assert.ok(
        marketplaceSource.includes('Clear All Filters'),
        'Marketplace zero-results empty state must offer Clear All Filters action'
      );
    });

    test('1.3 ListingDetailPage integrates ListingDetailSkeleton with backwards-compatible tokens', () => {
      const detailSource = fs.readFileSync(path.join(clientSrcDir, 'pages/ListingDetailPage.jsx'), 'utf8');

      // Verify ListingDetailSkeleton import and usage
      assert.ok(
        detailSource.includes("import { ListingDetailSkeleton } from '../components/common/Skeletons.jsx'"),
        'ListingDetailPage must import ListingDetailSkeleton'
      );
      assert.ok(
        detailSource.includes('<ListingDetailSkeleton />'),
        'ListingDetailPage must render ListingDetailSkeleton during loading'
      );
      assert.ok(
        detailSource.includes('Loading commercial property details...'),
        'ListingDetailPage must provide accessible sr-only loading text'
      );

      // Backwards compatibility tokens
      assert.ok(
        detailSource.includes('Listing ID: {id}'),
        'ListingDetailPage must retain Listing ID token for test compatibility'
      );
      assert.ok(
        detailSource.includes('Task 5.5 Commercial Details'),
        'ListingDetailPage must retain Task 5.5 roadmap token for test compatibility'
      );
    });
  });

  // =========================================================================
  // 2. Render Verification: Skeletons & Layout Semantics
  // =========================================================================
  describe('2. Skeleton Render Semantics', () => {
    test('2.1 ListingsGridSkeleton renders valid semantic articles and pulse animations', () => {
      const gridHtml = renderToStaticMarkup(<ListingsGridSkeleton count={6} viewMode="grid" />);
      assert.ok(gridHtml.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'Must support 3-column responsive layout');
      assert.ok(gridHtml.includes('animate-pulse'), 'Must contain pulse animation');
      assert.ok(gridHtml.includes('aria-hidden="true"'), 'Inner decorative skeleton shapes must have aria-hidden');

      const listHtml = renderToStaticMarkup(<ListingsGridSkeleton count={4} viewMode="list" />);
      assert.ok(listHtml.includes('space-y-4'), 'Must support list layout container');
      const articleCount = (listHtml.match(/<article/g) || []).length;
      assert.strictEqual(articleCount, 4, 'Must render exactly 4 articles in list mode');
    });

    test('2.2 ListingDetailSkeleton renders responsive two-column layout with sidebar', () => {
      const detailHtml = renderToStaticMarkup(<ListingDetailSkeleton />);
      assert.ok(detailHtml.includes('grid grid-cols-1 lg:grid-cols-3 gap-8 items-start'), 'Must have 2-column lg grid');
      assert.ok(detailHtml.includes('lg:col-span-2 space-y-8'), 'Main content must occupy 2 columns');
      assert.ok(detailHtml.includes('space-y-6'), 'Sidebar must occupy right column');
      assert.ok(detailHtml.includes('aspect-16/10'), 'Main image gallery skeleton must have aspect-16/10');
    });
  });

  // =========================================================================
  // 3. Privacy & Architectural Invariants (D-007, Zero Direct DB Access)
  // =========================================================================
  describe('3. Privacy & Architectural Invariants', () => {
    test('3.1 Public skeleton components do not render sensitive owner or financial data', () => {
      const gridHtml = renderToStaticMarkup(<ListingsGridSkeleton count={6} viewMode="grid" />);
      const detailHtml = renderToStaticMarkup(<ListingDetailSkeleton />);

      for (const [name, html] of [['ListingsGridSkeleton', gridHtml], ['ListingDetailSkeleton', detailHtml]]) {
        assert.equal(html.includes('@'), false, `${name} must not render any email addresses`);
        assert.equal(html.includes('017'), false, `${name} must not render phone numbers`);
        assert.equal(html.includes('018'), false, `${name} must not render phone numbers`);
        assert.equal(html.includes('019'), false, `${name} must not render phone numbers`);
        assert.equal(html.includes('bKash'), false, `${name} must not render payment credentials`);
        assert.equal(html.includes('password'), false, `${name} must not render credentials`);
      }
    });

    test('3.2 Public pages do not import PocketBase directly', () => {
      const homeSource = fs.readFileSync(path.join(clientSrcDir, 'pages/HomePage.jsx'), 'utf8');
      const marketSource = fs.readFileSync(path.join(clientSrcDir, 'pages/MarketplacePage.jsx'), 'utf8');
      const detailSource = fs.readFileSync(path.join(clientSrcDir, 'pages/ListingDetailPage.jsx'), 'utf8');

      for (const [name, code] of [
        ['HomePage.jsx', homeSource],
        ['MarketplacePage.jsx', marketSource],
        ['ListingDetailPage.jsx', detailSource],
      ]) {
        assert.equal(code.includes("from 'pocketbase'"), false, `${name} must not directly import PocketBase`);
        assert.equal(code.includes('pocketbase.js'), false, `${name} must not import pocketbase.js client directly`);
      }
    });
  });
});
