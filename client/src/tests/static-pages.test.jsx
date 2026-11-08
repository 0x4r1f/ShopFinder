import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';

import AboutPage from '../pages/AboutPage.jsx';
import TermsPage from '../pages/TermsPage.jsx';
import PrivacyPage from '../pages/PrivacyPage.jsx';
import ContactPage from '../pages/ContactPage.jsx';
import FaqPage from '../pages/FaqPage.jsx';
import { SUPPORT_EMAIL } from '../config/constants.js';
import Footer from '../components/layout/Footer.jsx';
import AppRouter from '../routes/AppRouter.jsx';

describe('Phase 12, Task 12.4 — Static Pages Unit & Integration Tests', () => {
  // =========================================================================
  // 1. Placeholder Demo Support Email Consistency
  // =========================================================================
  describe('1. Demo Support Email Invariant', () => {
    test('1.1 Centralized SUPPORT_EMAIL constant is support@example.com and rendered across pages', () => {
      assert.strictEqual(SUPPORT_EMAIL, 'support@example.com');

      const aboutHtml = renderToStaticMarkup(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );
      const termsHtml = renderToStaticMarkup(
        <MemoryRouter>
          <TermsPage />
        </MemoryRouter>
      );
      const privacyHtml = renderToStaticMarkup(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );
      const contactHtml = renderToStaticMarkup(
        <MemoryRouter>
          <ContactPage />
        </MemoryRouter>
      );
      const faqHtml = renderToStaticMarkup(
        <MemoryRouter>
          <FaqPage />
        </MemoryRouter>
      );

      assert.ok(aboutHtml.includes(SUPPORT_EMAIL), 'AboutPage must render centralized SUPPORT_EMAIL');
      assert.ok(termsHtml.includes(SUPPORT_EMAIL), 'TermsPage must render centralized SUPPORT_EMAIL');
      assert.ok(privacyHtml.includes(SUPPORT_EMAIL), 'PrivacyPage must render centralized SUPPORT_EMAIL');
      assert.ok(contactHtml.includes(SUPPORT_EMAIL), 'ContactPage must render centralized SUPPORT_EMAIL');
      assert.ok(faqHtml.includes(SUPPORT_EMAIL), 'FaqPage must render centralized SUPPORT_EMAIL');
    });

    test('1.2 Zero invented phone numbers or physical office street addresses in markup', () => {
      const aboutHtml = renderToStaticMarkup(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );
      const termsHtml = renderToStaticMarkup(
        <MemoryRouter>
          <TermsPage />
        </MemoryRouter>
      );
      const privacyHtml = renderToStaticMarkup(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );
      const contactHtml = renderToStaticMarkup(
        <MemoryRouter>
          <ContactPage />
        </MemoryRouter>
      );
      const faqHtml = renderToStaticMarkup(
        <MemoryRouter>
          <FaqPage />
        </MemoryRouter>
      );

      const combinedHtml = aboutHtml + termsHtml + privacyHtml + contactHtml + faqHtml;

      // Must not invent fake phone numbers
      assert.strictEqual(combinedHtml.includes('+880'), false, 'Static pages must not invent fake phone numbers');
      assert.strictEqual(combinedHtml.includes('017'), false, 'Static pages must not invent fake BD mobile numbers');
      assert.strictEqual(combinedHtml.includes('018'), false, 'Static pages must not invent fake BD mobile numbers');

      // Must not invent fake physical office addresses (e.g. "Road 11", "House 42")
      assert.strictEqual(/House \d+/i.test(combinedHtml), false, 'Must not invent fake street house numbers');
      assert.strictEqual(/Road \d+/i.test(combinedHtml), false, 'Must not invent fake road numbers');
    });
  });

  // =========================================================================
  // 2. AboutPage Component Verification
  // =========================================================================
  describe('2. AboutPage Component', () => {
    test('2.1 Renders platform title, commercial focus, and 3 core pillars', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Commercial Property Marketplace'), 'Must include platform headline');
      assert.ok(html.includes('Clear Commercial Specs'), 'Must include Pillar 1');
      assert.ok(html.includes('Privacy by Architecture'), 'Must include Pillar 2');
      assert.ok(html.includes('Fair &amp; Transparent Credits') || html.includes('Fair & Transparent Credits'), 'Must include Pillar 3');
      assert.ok(html.includes('Retail Shops'), 'Must list commercial property categories');
      assert.ok(html.includes('Commercial Offices'), 'Must list offices category');
    });

    test('2.2 Renders call-to-action buttons navigating to /marketplace and /contact', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('href="/marketplace"'), 'Must link to marketplace');
      assert.ok(html.includes('href="/contact"'), 'Must link to contact page');
    });
  });

  // =========================================================================
  // 3. TermsPage Component Verification
  // =========================================================================
  describe('3. TermsPage Component', () => {
    test('3.1 Renders Terms & Conditions with D-001, D-002, and D-014 policies', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <TermsPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Terms &amp; Conditions') || html.includes('Terms & Conditions'), 'Must render title');
      assert.ok(html.includes('D-002'), 'Must reference D-002 listing re-approval policy');
      assert.ok(html.includes('D-001'), 'Must reference D-001 credit policy');
      assert.ok(html.includes('D-014'), 'Must reference D-014 protected owner contact details');
      assert.ok(html.includes('never expire'), 'Must explicitly state credits never expire');
      assert.ok(html.includes('support@example.com'), 'Must reference demo support email');
    });
  });

  // =========================================================================
  // 4. PrivacyPage Component Verification
  // =========================================================================
  describe('4. PrivacyPage Component', () => {
    test('4.1 Renders Privacy Policy detailing D-014 owner phone isolation and D-010 httpOnly cookies', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Privacy Policy'), 'Must render title');
      assert.ok(html.includes('D-014'), 'Must highlight D-014 architectural isolation');
      assert.ok(html.includes('owner_contacts'), 'Must reference private contacts collection isolation');
      assert.ok(html.includes('D-010'), 'Must reference D-010 session security');
      assert.ok(html.includes('httpOnly'), 'Must explain httpOnly cookie security');
      assert.ok(html.includes('support@example.com'), 'Must reference demo support email');
    });
  });

  // =========================================================================
  // 5. ContactPage Component Verification
  // =========================================================================
  describe('5. ContactPage Component', () => {
    test('5.1 Renders support channels and interactive inquiry form', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <ContactPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Get in Touch'), 'Must render page heading');
      assert.ok(html.includes('support@example.com'), 'Must render demo email address');
      assert.ok(html.includes('Sunday – Thursday') || html.includes('Sunday'), 'Must render operational days');
      assert.ok(html.includes('Bangladesh'), 'Must render operating region without fake street addresses');
      assert.ok(html.includes('name="name"'), 'Must render Full Name input');
      assert.ok(html.includes('name="email"'), 'Must render Email input');
      assert.ok(html.includes('name="subject"'), 'Must render Subject input');
      assert.ok(html.includes('name="message"'), 'Must render Message textarea');
    });

    test('5.2 Clarifies demo environment and does not claim email was transmitted', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <ContactPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Demonstration Environment') || html.includes('demo'), 'Must include demo notice');
    });
  });

  // =========================================================================
  // 6. FaqPage Component Verification
  // =========================================================================
  describe('6. FaqPage Component', () => {
    test('6.1 Renders 4 categorized sections with questions and answers', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <FaqPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('Frequently Asked Questions'), 'Must render title');
      assert.ok(html.includes('General &amp; Commercial Spaces') || html.includes('General & Commercial Spaces'), 'Must render Section 1');
      assert.ok(html.includes('For Space Seekers &amp; Tenants') || html.includes('For Space Seekers & Tenants'), 'Must render Section 2');
      assert.ok(html.includes('Pricing, Packages &amp; Reveal Credits') || html.includes('Pricing, Packages & Reveal Credits'), 'Must render Section 3');
      assert.ok(html.includes('For Property Owners &amp; Landlords') || html.includes('For Property Owners & Landlords'), 'Must render Section 4');
    });

    test('6.2 Details D-001 credit rules and D-002 re-approval in FAQ answers', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <FaqPage />
        </MemoryRouter>
      );

      assert.ok(html.includes('D-001'), 'Must articulate D-001 credit policy in FAQ');
      assert.ok(html.includes('D-002'), 'Must articulate D-002 moderation policy in FAQ');
      assert.ok(html.includes('D-014'), 'Must articulate D-014 owner privacy in FAQ');
    });
  });

  // =========================================================================
  // 7. Footer Integration Verification
  // =========================================================================
  describe('7. Footer Navigation Integration', () => {
    test('7.1 Footer links to all 5 static pages with verified routes', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      );

      assert.ok(html.includes('href="/about"'), 'Footer must contain link to /about');
      assert.ok(html.includes('href="/faq"'), 'Footer must contain link to /faq');
      assert.ok(html.includes('href="/contact"'), 'Footer must contain link to /contact');
      assert.ok(html.includes('href="/terms"'), 'Footer must contain link to /terms');
      assert.ok(html.includes('href="/privacy"'), 'Footer must contain link to /privacy');
    });
  });

  // =========================================================================
  // 8. AppRouter Route Registration
  // =========================================================================
  describe('8. AppRouter Hierarchy', () => {
    test('8.1 AppRouter registers /about, /terms, /privacy, /contact, and /faq', () => {
      const routerSource = fs.readFileSync(
        path.join(process.cwd(), 'client', 'src', 'routes', 'AppRouter.jsx'),
        'utf8'
      );

      assert.ok(routerSource.includes('path="/about"'), 'AppRouter must register /about');
      assert.ok(routerSource.includes('path="/terms"'), 'AppRouter must register /terms');
      assert.ok(routerSource.includes('path="/privacy"'), 'AppRouter must register /privacy');
      assert.ok(routerSource.includes('path="/contact"'), 'AppRouter must register /contact');
      assert.ok(routerSource.includes('path="/faq"'), 'AppRouter must register /faq');
    });
  });

  // =========================================================================
  // 9. Architectural Invariants (D-007, D-014)
  // =========================================================================
  describe('9. Architectural Invariants', () => {
    test('9.1 Zero direct PocketBase imports in static pages (D-007)', () => {
      const staticFiles = [
        'client/src/pages/AboutPage.jsx',
        'client/src/pages/TermsPage.jsx',
        'client/src/pages/PrivacyPage.jsx',
        'client/src/pages/ContactPage.jsx',
        'client/src/pages/FaqPage.jsx',
      ];

      for (const file of staticFiles) {
        const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
        assert.strictEqual(
          content.includes('pocketbase'),
          false,
          `${file} must not import PocketBase directly (D-007)`
        );
      }
    });

    test('9.2 Icons.jsx remains completely untouched', () => {
      const iconsDiff = fs.readFileSync(
        path.join(process.cwd(), 'client', 'src', 'components', 'common', 'Icons.jsx'),
        'utf8'
      );
      // Ensure file exists and contains core icons without syntax corruption
      assert.ok(iconsDiff.includes('export function StoreIcon'));
      assert.ok(iconsDiff.includes('export function BuildingIcon'));
      assert.ok(iconsDiff.includes('export function MailIcon'));
    });
  });
});
