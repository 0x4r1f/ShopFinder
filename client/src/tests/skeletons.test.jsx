import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from '../components/ui/skeleton.jsx';
import {
  ListingCardSkeleton,
  ListingsGridSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  KpiCardSkeleton,
  ListingDetailSkeleton,
} from '../components/common/Skeletons.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

describe('Phase 12, Task 12.3 — Skeleton Foundation & Domain Skeletons', () => {
  // =========================================================================
  // 1. Base Skeleton Primitive (client/src/components/ui/skeleton.jsx)
  // =========================================================================
  describe('1. Base Skeleton Primitive', () => {
    test('1.1 Renders with base pulse animation and muted token classes', () => {
      const html = renderToStaticMarkup(<Skeleton />);
      assert.ok(html.includes('animate-pulse'), 'Skeleton must include animate-pulse class');
      assert.ok(html.includes('bg-muted'), 'Skeleton must use bg-muted theme token');
      assert.ok(html.includes('rounded-md'), 'Skeleton must have rounded-md class');
    });

    test('1.2 Supports and merges custom className via cn()', () => {
      const html = renderToStaticMarkup(
        <Skeleton className="w-24 h-6 rounded-full bg-primary/20 custom-token" />
      );
      assert.ok(html.includes('w-24'), 'Custom width must be merged');
      assert.ok(html.includes('h-6'), 'Custom height must be merged');
      assert.ok(html.includes('rounded-full'), 'Custom border radius must override or merge');
      assert.ok(html.includes('custom-token'), 'Custom utility classes must be present');
    });

    test('1.3 Enforces accessibility: aria-hidden="true" for decorative shapes', () => {
      const html = renderToStaticMarkup(<Skeleton />);
      assert.ok(html.includes('aria-hidden="true"'), 'Skeleton primitive must default to aria-hidden="true"');
    });

    test('1.4 Forwards additional HTML attributes correctly', () => {
      const html = renderToStaticMarkup(<Skeleton data-testid="test-skeleton-shape" id="skel-01" />);
      assert.ok(html.includes('data-testid="test-skeleton-shape"'));
      assert.ok(html.includes('id="skel-01"'));
    });
  });

  // =========================================================================
  // 2. ListingCardSkeleton & ListingsGridSkeleton
  // =========================================================================
  describe('2. ListingCardSkeleton & ListingsGridSkeleton', () => {
    test('2.1 Renders grid mode with aspect-4/3 image container and role="status"', () => {
      const html = renderToStaticMarkup(<ListingCardSkeleton viewMode="grid" />);
      assert.ok(html.includes('role="status"'), 'Card skeleton must declare role="status"');
      assert.ok(html.includes('aspect-4/3'), 'Grid view mode must use aspect-4/3 for image');
      assert.ok(html.includes('rounded-xl border border-border bg-card'), 'Must match listing card card container styling');
      assert.ok(html.includes('Loading listing details...'), 'Must contain accessible screen reader text');
    });

    test('2.2 Renders list mode with horizontal flex layout and aspect-16/10 image container', () => {
      const html = renderToStaticMarkup(<ListingCardSkeleton viewMode="list" />);
      assert.ok(html.includes('role="status"'), 'List skeleton must declare role="status"');
      assert.ok(html.includes('sm:flex-row'), 'List view mode must adopt horizontal layout on sm+ screens');
      assert.ok(html.includes('aspect-16/10'), 'List view mode image container must use aspect-16/10');
      assert.ok(html.includes('Loading listing details...'), 'Must contain accessible screen reader text');
    });

    test('2.3 ListingsGridSkeleton renders the specified count of card skeletons', () => {
      const htmlGrid = renderToStaticMarkup(<ListingsGridSkeleton count={4} viewMode="grid" />);
      // 4 articles rendered
      const articleMatches = htmlGrid.match(/<article/g) || [];
      assert.strictEqual(articleMatches.length, 4, 'Must render exactly 4 card skeletons');
      assert.ok(htmlGrid.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'Grid layout classes must be applied');

      const htmlList = renderToStaticMarkup(<ListingsGridSkeleton count={3} viewMode="list" />);
      const listMatches = htmlList.match(/<article/g) || [];
      assert.strictEqual(listMatches.length, 3, 'Must render exactly 3 card skeletons in list mode');
    });
  });

  // =========================================================================
  // 3. TableRowSkeleton & TableSkeleton
  // =========================================================================
  describe('3. TableRowSkeleton & TableSkeleton', () => {
    test('3.1 TableRowSkeleton renders semantic <tr> with default 5 columns', () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <TableRowSkeleton />
          </tbody>
        </table>
      );
      assert.ok(html.includes('<tr'), 'Must render semantic tr element');
      assert.ok(html.includes('role="row"'), 'Must declare role="row"');
      const tdMatches = html.match(/<td/g) || [];
      assert.strictEqual(tdMatches.length, 5, 'Default column count must be 5');
    });

    test('3.2 TableRowSkeleton supports configurable column counts and custom widths', () => {
      const customWidths = ['w-12', 'w-48', 'w-20', 'w-28', 'w-24', 'w-16', 'w-20'];
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <TableRowSkeleton columns={7} columnWidths={customWidths} />
          </tbody>
        </table>
      );
      const tdMatches = html.match(/<td/g) || [];
      assert.strictEqual(tdMatches.length, 7, 'Configured column count of 7 must render 7 td elements');
      assert.ok(html.includes('w-48'), 'Custom width w-48 must be applied to cell skeleton');
    });

    test('3.3 TableSkeleton renders multiple rows inside tbody', () => {
      const html = renderToStaticMarkup(
        <table>
          <TableSkeleton rows={4} columns={6} />
        </table>
      );
      assert.ok(html.includes('<tbody'), 'Must render semantic tbody element');
      const trMatches = html.match(/<tr/g) || [];
      assert.strictEqual(trMatches.length, 4, 'Must render 4 tr row elements');
      const tdMatches = html.match(/<td/g) || [];
      assert.strictEqual(tdMatches.length, 24, '4 rows * 6 columns = 24 td elements');
    });
  });

  // =========================================================================
  // 4. KpiCardSkeleton
  // =========================================================================
  describe('4. KpiCardSkeleton', () => {
    test('4.1 Renders KPI card dimensions, role="status", and accessible description', () => {
      const html = renderToStaticMarkup(<KpiCardSkeleton />);
      assert.ok(html.includes('role="status"'), 'Must declare role="status"');
      assert.ok(html.includes('Loading platform metric...'), 'Must contain accessible screen reader description');
      assert.ok(html.includes('rounded-xl border border-border bg-card'), 'Must match dashboard KPI card styling');
      assert.ok(html.includes('h-9 w-9 rounded-lg'), 'Must contain icon placeholder skeleton');
      assert.ok(html.includes('h-8 w-24'), 'Must contain large metric value placeholder skeleton');
    });
  });

  // =========================================================================
  // 5. ListingDetailSkeleton
  // =========================================================================
  describe('5. ListingDetailSkeleton', () => {
    test('5.1 Renders 2-column responsive layout matching ListingDetailPage structure', () => {
      const html = renderToStaticMarkup(<ListingDetailSkeleton />);
      assert.ok(html.includes('role="status"'), 'Must declare role="status"');
      assert.ok(html.includes('Loading commercial property specifications and gallery...'));
      // Breadcrumbs
      assert.ok(html.includes('h-4 w-12'));
      // Responsive 2-column grid
      assert.ok(html.includes('grid grid-cols-1 lg:grid-cols-3 gap-8 items-start'));
      assert.ok(html.includes('lg:col-span-2 space-y-8'), 'Left column must span 2 cols on lg screens');
      // Main gallery stage aspect ratio
      assert.ok(html.includes('aspect-16/10 w-full rounded-xl'), 'Main gallery stage must use aspect-16/10');
      // Right column cards
      assert.ok(html.includes('h-12 w-12 rounded-full'), 'Owner avatar placeholder must be present');
    });
  });

  // =========================================================================
  // 6. Architectural Invariants & Purity (D-007, Zero Network Dependency)
  // =========================================================================
  describe('6. Architectural Invariants & Purity', () => {
    test('6.1 Skeletons do not import PocketBase or backend APIs', () => {
      const skeletonPrimitive = fs.readFileSync(path.join(clientSrcDir, 'components/ui/skeleton.jsx'), 'utf8');
      const domainSkeletons = fs.readFileSync(path.join(clientSrcDir, 'components/common/Skeletons.jsx'), 'utf8');

      for (const [name, code] of [['skeleton.jsx', skeletonPrimitive], ['Skeletons.jsx', domainSkeletons]]) {
        assert.equal(code.includes('pocketbase'), false, `${name} must not import pocketbase`);
        assert.equal(code.includes('api.js'), false, `${name} must not import api.js`);
        assert.equal(code.includes('fetch('), false, `${name} must not call fetch directly`);
      }
    });
  });
});

