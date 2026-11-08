import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import Header from '../components/layout/Header.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import ContactRevealModal from '../components/marketplace/ContactRevealModal.jsx';
import RejectListingModal from '../components/admin/RejectListingModal.jsx';
import DeleteListingModal from '../components/owner/DeleteListingModal.jsx';
import UserStatusModal from '../components/admin/UserStatusModal.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import OwnerSummaryCards from '../components/owner/OwnerSummaryCards.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '..');

function renderWithAuth(ui, { user = null, initialRoute = '/' } = {}) {
  const authValue = {
    user,
    token: user ? 'mock-jwt-token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
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

describe('Phase 12, Task 12.3, Step 4 — Micro-interactions, Modal Transitions & Final Polish', () => {
  // =========================================================================
  // 1. Header Tablet Spacing & Collision Prevention (768px-960px)
  // =========================================================================
  describe('1. Header Responsive Spacing & Collision Prevention', () => {
    test('1.1 Header desktop navigation uses responsive tablet spacing tokens', () => {
      const html = renderWithAuth(<Header />, {
        user: { id: 'usr_cust', role: 'customer', name: 'Al-Amin Rahman', email: 'alamin.rahman@example.com' },
        initialRoute: '/',
      });

      // Responsive nav links
      assert.ok(html.includes('gap-1 lg:gap-2'), 'Nav container must adapt spacing for tablet/desktop');
      assert.ok(html.includes('px-2.5 lg:px-3 py-1.5 lg:py-2'), 'Nav links must use compact padding on tablet');
      assert.ok(html.includes('text-xs lg:text-sm'), 'Nav links must scale font size between tablet and desktop');

      // Tablet identity chip collision prevention
      assert.ok(html.includes('hidden lg:block max-w-[140px] truncate'), 'Email is hidden on tablet to avoid text collisions');
      assert.ok(html.includes('max-w-[80px] sm:max-w-[100px] lg:max-w-[130px] truncate'), 'User name is safely bounded');
      assert.ok(html.includes('Admin') === false, 'Customer role rendered accurately');
    });

    test('1.2 Header preserves unauthenticated and role-specific navigation', () => {
      const anonHtml = renderWithAuth(<Header />, { user: null });
      assert.ok(anonHtml.includes('Sign In') && anonHtml.includes('Register'), 'Preserves guest CTAs');

      const adminHtml = renderWithAuth(<Header />, {
        user: { id: 'usr_adm', role: 'admin', name: 'Super Admin', email: 'admin@shopfinder.local' },
      });
      assert.ok(adminHtml.includes('Admin Portal'), 'Preserves Admin Portal link');
      assert.ok(adminHtml.includes('href="/admin-dashboard"'), 'Links to /admin-dashboard');
    });
  });

  // =========================================================================
  // 2. Sidebar Mobile Transitions & Persistence
  // =========================================================================
  describe('2. Sidebar Mobile Transitions & Persistence', () => {
    test('2.1 Mobile sidebar drawer includes smooth slide animation and motion-reduce support', () => {
      const sidebarSource = fs.readFileSync(path.join(clientSrcDir, 'components/layout/Sidebar.jsx'), 'utf8');

      assert.ok(
        sidebarSource.includes('slide-in-from-top-2'),
        'Mobile dropdown must include slide-in-from-top-2 transition'
      );
      assert.ok(
        sidebarSource.includes('motion-reduce:animate-none'),
        'Mobile dropdown must respect prefers-reduced-motion'
      );
    });
  });

  // =========================================================================
  // 3. Modal Transitions & Reduced Motion Support
  // =========================================================================
  describe('3. Modal Transitions & Accessibility', () => {
    test('3.1 ContactRevealModal implements backdrop fade, scale transition, and motion-reduce', () => {
      const modalSource = fs.readFileSync(
        path.join(clientSrcDir, 'components/marketplace/ContactRevealModal.jsx'),
        'utf8'
      );

      assert.ok(
        modalSource.includes('motion-safe:animate-in') && modalSource.includes('motion-reduce:transition-none'),
        'Backdrop must support motion-safe animate-in and motion-reduce'
      );
      assert.ok(
        modalSource.includes('motion-safe:zoom-in-95'),
        'Modal content must scale from 95% on open'
      );
      assert.ok(
        modalSource.includes('role="dialog"') && modalSource.includes('aria-modal="true"'),
        'Must retain accessible dialog semantics'
      );
    });

    test('3.2 RejectListingModal implements backdrop fade, scale transition, and motion-reduce', () => {
      const rejectSource = fs.readFileSync(
        path.join(clientSrcDir, 'components/admin/RejectListingModal.jsx'),
        'utf8'
      );

      assert.ok(
        rejectSource.includes('motion-safe:animate-in') && rejectSource.includes('motion-reduce:transition-none'),
        'Reject modal backdrop must support motion-safe animate-in'
      );
      assert.ok(
        rejectSource.includes('motion-safe:zoom-in-95'),
        'Reject modal dialog must zoom in smoothly'
      );
    });

    test('3.3 DeleteListingModal implements backdrop fade, scale transition, and motion-reduce', () => {
      const deleteSource = fs.readFileSync(
        path.join(clientSrcDir, 'components/owner/DeleteListingModal.jsx'),
        'utf8'
      );

      assert.ok(
        deleteSource.includes('motion-safe:animate-in') && deleteSource.includes('motion-reduce:transition-none'),
        'Delete modal backdrop must support motion-safe animate-in'
      );
      assert.ok(
        deleteSource.includes('motion-safe:zoom-in-95'),
        'Delete modal dialog must zoom in smoothly'
      );
    });

    test('3.4 UserStatusModal implements backdrop fade, scale transition, and motion-reduce', () => {
      const statusSource = fs.readFileSync(
        path.join(clientSrcDir, 'components/admin/UserStatusModal.jsx'),
        'utf8'
      );

      assert.ok(
        statusSource.includes('motion-safe:animate-in') && statusSource.includes('motion-reduce:transition-none'),
        'User status modal backdrop must support motion-safe animate-in'
      );
      assert.ok(
        statusSource.includes('motion-safe:zoom-in-95'),
        'User status modal dialog must zoom in smoothly'
      );
    });
  });

  // =========================================================================
  // 4. Shared Micro-interactions
  // =========================================================================
  describe('4. Shared Micro-interactions', () => {
    test('4.1 Button primitive enforces active press feedback and motion-reduce compliance', () => {
      const html = renderToStaticMarkup(<Button variant="default">Test Action</Button>);

      assert.ok(html.includes('active:scale-[0.98]'), 'Button must include active press micro-interaction');
      assert.ok(html.includes('motion-reduce:active:scale-100'), 'Button must disable scale when motion-reduce is active');
      assert.ok(html.includes('focus-visible:ring-2'), 'Button must render visible focus ring');
      assert.ok(html.includes('transition-all'), 'Button must support smooth transition');
    });

    test('4.2 OwnerSummaryCards cards render hover elevation feedback', () => {
      const html = renderToStaticMarkup(
        <OwnerSummaryCards
          totalItems={10}
          approvedCount={5}
          pendingCount={3}
          rejectedCount={2}
        />
      );

      assert.ok(html.includes('hover:shadow-md'), 'Cards must apply hover elevation');
      assert.ok(html.includes('transition-all duration-200'), 'Cards must transition elevation smoothly');
    });
  });

  // =========================================================================
  // 5. Architectural Guardrails (Zero PocketBase Leakage)
  // =========================================================================
  describe('5. Architectural Guardrails', () => {
    test('5.1 Header, Sidebar, and Modals make zero direct PocketBase imports', () => {
      const files = [
        'components/layout/Header.jsx',
        'components/layout/Sidebar.jsx',
        'components/marketplace/ContactRevealModal.jsx',
        'components/admin/RejectListingModal.jsx',
        'components/owner/DeleteListingModal.jsx',
        'components/admin/UserStatusModal.jsx',
        'components/ui/button.jsx',
      ];

      for (const f of files) {
        const src = fs.readFileSync(path.join(clientSrcDir, f), 'utf8');
        assert.equal(src.includes("from 'pocketbase'"), false, `${f} must not import PocketBase directly`);
        assert.equal(src.includes('pocketbase.js'), false, `${f} must not import pocketbase.js directly`);
      }
    });
  });
});

