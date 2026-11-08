import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import ownerService from '../services/ownerService.js';
import OwnerProfilePage, {
  PHONE_REGEX,
  formatMemberSince,
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_TYPES,
} from '../pages/OwnerProfilePage.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth User Fixtures
 */
const mockOwnerUser = {
  id: 'usr_owner9999999',
  name: 'Beximco Commercial Holdings',
  email: 'owner@beximco.test',
  role: 'owner',
  avatar: 'beximco_logo.png',
  created: '2026-03-15T08:00:00.000Z',
};

const mockCustomerUser = {
  id: 'usr_cust99999999',
  name: 'Retail Customer',
  email: 'customer@test.local',
  role: 'customer',
};

const mockAdminUser = {
  id: 'usr_admin9999999',
  name: 'Super Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

const mockProfileData = {
  id: 'usr_owner9999999',
  name: 'Beximco Commercial Holdings',
  email: 'owner@beximco.test',
  role: 'owner',
  avatar: 'beximco_logo.png',
  avatar_url: 'http://localhost:4000/api/files/users/usr_owner9999999/beximco_logo.png',
  phone: '+880 1711-223344',
  created: '2026-03-15T08:00:00.000Z',
  updated: '2026-11-01T12:00:00.000Z',
};

function renderWithAuth(component, user = mockOwnerUser) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    loading: false,
    logout: () => {},
    updateUser: () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/owner-dashboard/profile']}>
        {component}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 6, Task 6.7 — Owner Business Profile Management (Frontend)', () => {
  let originalGetOwnerProfile;
  let originalUpdateOwnerProfile;

  beforeEach(() => {
    originalGetOwnerProfile = ownerService.getOwnerProfile;
    originalUpdateOwnerProfile = ownerService.updateOwnerProfile;
  });

  afterEach(() => {
    ownerService.getOwnerProfile = originalGetOwnerProfile;
    ownerService.updateOwnerProfile = originalUpdateOwnerProfile;
  });

  // =========================================================================
  // 1. Validation Logic & Helpers
  // =========================================================================
  describe('1. Validation Logic & Helpers', () => {
    test('1.1 PHONE_REGEX validates Bangladesh and international phone formats', () => {
      // Valid phone numbers (6-30 chars, digits, optional leading +, spaces, hyphens)
      const validNumbers = [
        '+8801712345678',
        '+880 1712-345678',
        '01712345678',
        '+1 555-123-4567',
        '123456',
        '+880-2-9876543',
      ];
      for (const num of validNumbers) {
        assert.ok(PHONE_REGEX.test(num), `Phone "${num}" should be valid`);
      }

      // Invalid phone numbers
      const invalidNumbers = [
        '12345', // <6 chars
        'phone-number', // letters
        '+8801712345678#', // invalid symbol
        'abc+8801234', // invalid prefix
      ];
      for (const num of invalidNumbers) {
        assert.ok(!PHONE_REGEX.test(num), `Phone "${num}" should be invalid`);
      }
    });

    test('1.2 formatMemberSince formats dates accurately into Month Year', () => {
      assert.strictEqual(formatMemberSince('2026-03-15T08:00:00.000Z'), 'March 2026');
      assert.strictEqual(formatMemberSince('2026-11-01T12:00:00.000Z'), 'November 2026');
      assert.strictEqual(formatMemberSince(null), 'Recently');
      assert.strictEqual(formatMemberSince('invalid-date'), 'Recently');
    });

    test('1.3 Avatar upload constraints enforce 5 MB limit and JPEG/PNG/WebP/SVG formats', () => {
      assert.strictEqual(MAX_AVATAR_SIZE_BYTES, 5 * 1024 * 1024);
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/jpeg'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/png'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/webp'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/svg+xml'));
      assert.ok(!ALLOWED_AVATAR_TYPES.includes('image/gif'), 'GIF must be excluded');
    });
  });

  // =========================================================================
  // 2. Component Rendering & Pre-population
  // =========================================================================
  describe('2. OwnerProfilePage Component Rendering', () => {
    test('2.1 Renders page title, back navigation to dashboard, and account overview', () => {
      const html = renderWithAuth(<OwnerProfilePage initialProfile={mockProfileData} />);
      assert.ok(html.includes('Business Profile'), 'Must render page title');
      assert.ok(html.includes('Back to Dashboard'), 'Must render back link');
      assert.ok(html.includes('href="/owner-dashboard"'), 'Back link must point to /owner-dashboard');
      assert.ok(html.includes('Account Overview'), 'Must render account overview section');
      assert.ok(html.includes('Login Email'), 'Must render login email card');
      assert.ok(html.includes('owner@beximco.test'), 'Must display read-only user email');
      assert.ok(html.includes('Verified Property Owner'), 'Must render owner badge');
    });

    test('2.2 Renders D-014 Contact Phone Privacy Notice in DOM', () => {
      const html = renderWithAuth(<OwnerProfilePage initialProfile={mockProfileData} />);
      assert.ok(html.includes('Privacy Policy (D-014)'), 'Must render D-014 notice header');
      assert.ok(
        html.includes('Your contact phone number is stored privately and is not exposed in public property listings'),
        'Must display mandatory contact privacy text'
      );
      assert.ok(html.includes('D-014 Private'), 'Must badge phone field with D-014 Private');
    });

    test('2.3 Renders editable inputs for Name and Phone with pre-populated values', () => {
      const html = renderWithAuth(<OwnerProfilePage initialProfile={mockProfileData} />);
      assert.ok(html.includes('id="field-owner-name"'), 'Must render name input');
      assert.ok(html.includes('id="field-owner-phone"'), 'Must render phone input');
      assert.ok(html.includes('value="Beximco Commercial Holdings"'), 'Must pre-populate name input');
      assert.ok(html.includes('value="+880 1711-223344"'), 'Must pre-populate phone input');
      assert.ok(html.includes('Save Profile'), 'Must render save button');
    });
  });

  // =========================================================================
  // 3. AppRouter Route Protection (Owner-Only)
  // =========================================================================
  describe('3. AppRouter Route Protection for /owner-dashboard/profile', () => {
    function renderRoute(path, user) {
      const authValue = {
        user,
        isAuthenticated: Boolean(user),
        loading: false,
        logout: () => {},
        updateUser: () => {},
      };

      return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </AuthContext.Provider>
      );
    }

    test('3.1 Owner is ALLOWED to access "/owner-dashboard/profile"', () => {
      ownerService.getOwnerProfile = async () => mockProfileData;
      const html = renderRoute('/owner-dashboard/profile', mockOwnerUser);
      assert.ok(html.includes('Business Profile'), 'Owner must see Business Profile page');
      assert.ok(!html.includes('Access Denied'), 'Owner must not see Access Denied');
    });

    test('3.2 Customer receives ACCESS DENIED on "/owner-dashboard/profile"', () => {
      const html = renderRoute('/owner-dashboard/profile', mockCustomerUser);
      assert.ok(html.includes('Access Denied'), 'Customer must receive Access Denied');
      assert.ok(!html.includes('Edit Business Profile Details'), 'Customer must not access profile form');
    });

    test('3.3 Admin receives ACCESS DENIED on "/owner-dashboard/profile"', () => {
      const html = renderRoute('/owner-dashboard/profile', mockAdminUser);
      assert.ok(html.includes('Access Denied'), 'Admin must receive Access Denied');
      assert.ok(!html.includes('Edit Business Profile Details'), 'Admin must not access profile form');
    });

    test('3.4 Unauthenticated visitor is REDIRECTED and BLOCKED from "/owner-dashboard/profile"', () => {
      const html = renderRoute('/owner-dashboard/profile', null);
      assert.ok(!html.includes('Edit Business Profile Details'), 'Unauthenticated visitor must not access profile form');
    });
  });

  // =========================================================================
  // 4. Sidebar Integration
  // =========================================================================
  describe('4. Sidebar Navigation Integration', () => {
    test('4.1 Owner sidebar renders active Business Profile link pointing to /owner-dashboard/profile', () => {
      const authValue = {
        user: mockOwnerUser,
        isAuthenticated: true,
        loading: false,
        logout: () => {},
      };

      const html = renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/owner-dashboard']}>
            <Sidebar />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(html.includes('href="/owner-dashboard/profile"'), 'Sidebar must link to /owner-dashboard/profile');
      assert.ok(html.includes('Business Profile'), 'Sidebar must display Business Profile');
    });
  });

  // =========================================================================
  // 5. ownerService Client Contract
  // =========================================================================
  describe('5. ownerService Profile Client Methods', () => {
    test('5.1 ownerService exposes getOwnerProfile and updateOwnerProfile methods', () => {
      assert.strictEqual(typeof ownerService.getOwnerProfile, 'function', 'getOwnerProfile must be defined');
      assert.strictEqual(typeof ownerService.updateOwnerProfile, 'function', 'updateOwnerProfile must be defined');
    });

    test('5.2 updateOwnerProfile rejects empty or falsy argument', async () => {
      await assert.rejects(
        () => ownerService.updateOwnerProfile(null),
        /Update payload is required/
      );
    });
  });
});
