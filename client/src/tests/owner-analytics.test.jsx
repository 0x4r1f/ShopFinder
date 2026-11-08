import { test, it, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import OwnerAnalyticsOverview from '../components/owner/OwnerAnalyticsOverview.jsx';
import OwnerEngagementChart from '../components/owner/OwnerEngagementChart.jsx';
import OwnerDashboardPage from '../pages/OwnerDashboardPage.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

// Mock Data
const mockOwnerUser = {
  id: 'usr_owner_001',
  name: 'Tariq Commercial Owner',
  email: 'tariq@test.com',
  role: 'owner',
};

const mockDailyEngagement = [
  { date: '2026-11-02', label: 'Nov 2', views: 25, reveals: 3, favorites: 5 },
  { date: '2026-11-03', label: 'Nov 3', views: 40, reveals: 5, favorites: 8 },
  { date: '2026-11-04', label: 'Nov 4', views: 30, reveals: 2, favorites: 4 },
  { date: '2026-11-05', label: 'Nov 5', views: 50, reveals: 6, favorites: 10 },
  { date: '2026-11-06', label: 'Nov 6', views: 35, reveals: 4, favorites: 7 },
  { date: '2026-11-07', label: 'Nov 7', views: 45, reveals: 5, favorites: 9 },
  { date: '2026-11-08', label: 'Nov 8', views: 60, reveals: 8, favorites: 12 },
];

function renderWithAuth(ui, { user = mockOwnerUser, initialRoute = '/owner-dashboard' } = {}) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 12, Task 12.1 — Owner Analytics Frontend Unit & Integration Tests', () => {
  // --------------------------------------------------------------------------
  // 1. OwnerEngagementChart Component Tests
  // --------------------------------------------------------------------------
  describe('OwnerEngagementChart Component', () => {
    it('renders chart region container and accessible ARIA attributes', () => {
      const html = renderToStaticMarkup(<OwnerEngagementChart data={mockDailyEngagement} />);
      assert.ok(html.includes('aria-label="Daily Engagement Chart"'));
      assert.ok(html.includes('role="region"'));
    });

    it('renders accessible data table for assistive technologies / screen readers', () => {
      const html = renderToStaticMarkup(<OwnerEngagementChart data={mockDailyEngagement} />);
      assert.ok(html.includes('Daily engagement metrics over the selected period'));
      assert.ok(html.includes('Nov 2'));
      assert.ok(html.includes('Nov 8'));
      assert.ok(html.includes('Views'));
      assert.ok(html.includes('Inquiries'));
      assert.ok(html.includes('Favorites'));
    });

    it('renders friendly fallback message when data is empty', () => {
      const html = renderToStaticMarkup(<OwnerEngagementChart data={[]} />);
      assert.ok(html.includes('No engagement activity recorded for this period.'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. OwnerAnalyticsOverview Component Tests
  // --------------------------------------------------------------------------
  describe('OwnerAnalyticsOverview Component', () => {
    it('renders section title, timeframe controls, and refresh action', () => {
      const html = renderWithAuth(<OwnerAnalyticsOverview />);
      assert.ok(html.includes('Performance') && html.includes('Analytics'));
      assert.ok(html.includes('Track commercial listing views, customer inquiries, and conversion efficiency.'));
      assert.ok(html.includes('Last 7 Days'));
      assert.ok(html.includes('Last 30 Days'));
      assert.ok(html.includes('aria-label="Refresh analytics data"'));
    });

    it('renders initial loading state with accessible status label', () => {
      const html = renderWithAuth(<OwnerAnalyticsOverview />);
      // Initial SSR render starts with loading = true
      assert.ok(html.includes('Calculating engagement metrics...'));
      assert.ok(html.includes('Aggregating page views, inquiries, and conversion ratios.'));
    });
  });

  // --------------------------------------------------------------------------
  // 3. OwnerDashboardPage Tab Integration Tests
  // --------------------------------------------------------------------------
  describe('OwnerDashboardPage Tab Integration', () => {
    it('renders Properties & Listings and Performance & Analytics tab controls', () => {
      const html = renderWithAuth(<OwnerDashboardPage />);
      assert.ok(html.includes('Properties') && html.includes('Listings'));
      assert.ok(html.includes('Performance') && html.includes('Analytics'));
      assert.ok(html.includes('role="tablist"'));
      assert.ok(html.includes('id="owner-tab-listings"'));
      assert.ok(html.includes('id="owner-tab-analytics"'));
    });

    it('defaults to Properties & Listings tab (renders listings table and KPI summary cards)', () => {
      const html = renderWithAuth(<OwnerDashboardPage />);
      assert.ok(html.includes('My Commercial Listings'));
      assert.ok(html.includes('Total Properties'));
      assert.ok(html.includes('Approved'));
      assert.ok(html.includes('Pending Review'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Security & Direct PocketBase Prohibition Audit
  // --------------------------------------------------------------------------
  describe('Security & API Service Conformance', () => {
    it('OwnerAnalyticsOverview does not import PocketBase directly', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'components/owner/OwnerAnalyticsOverview.jsx'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"), 'Must not import pocketbase');
      assert.ok(!code.includes('pb.'), 'Must not reference pb instance');
    });

    it('OwnerEngagementChart does not import PocketBase directly', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'components/owner/OwnerEngagementChart.jsx'),
        'utf8'
      );
      assert.ok(!code.includes("from 'pocketbase'"));
      assert.ok(!code.includes('pb.'));
    });

    it('ownerService.js getOwnerAnalytics routes strictly through Express /api/v1/owner/analytics', () => {
      const code = fs.readFileSync(
        path.resolve(clientSrcDir, 'services/ownerService.js'),
        'utf8'
      );
      assert.ok(code.includes('/api/v1/owner/analytics'));
      assert.ok(!code.includes("from 'pocketbase'"));
    });

    it('D-014 Privacy Audit: Zero phone number fields rendered in analytics components', () => {
      const overviewCode = fs.readFileSync(
        path.resolve(clientSrcDir, 'components/owner/OwnerAnalyticsOverview.jsx'),
        'utf8'
      );
      assert.ok(!overviewCode.includes('.phone'), 'Never access or render phone numbers in analytics');
    });
  });
});
