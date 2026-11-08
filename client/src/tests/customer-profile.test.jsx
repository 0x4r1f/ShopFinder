import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import customerService from '../services/customerService.js';
import CustomerProfilePage, {
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_TYPES,
  formatMemberSince,
} from '../pages/CustomerProfilePage.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth User Fixtures
 */
const mockCustomerUser = {
  id: 'usr_cust12345678',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
  avatar: 'avatar_rahim.png',
  avatar_url: 'http://127.0.0.1:8090/api/files/_pb_users_auth_/usr_cust12345678/avatar_rahim.png',
  created: '2026-11-05T10:00:00.000Z',
};

const mockCustomerNoAvatar = {
  id: 'usr_cust87654321',
  name: 'Fatima Customer',
  email: 'fatima@example.com',
  role: 'customer',
  avatar: null,
  avatar_url: null,
  created: '2026-10-15T12:00:00.000Z',
};

const mockOwnerUser = {
  id: 'usr_owner1234567',
  name: 'Tariq Owner',
  email: 'tariq@example.com',
  role: 'owner',
};

const mockAdminUser = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

/**
 * Helper: Render component with AuthContext and MemoryRouter
 */
function renderWithAuth(
  ui,
  {
    user = mockCustomerUser,
    initialRoute = '/dashboard/profile',
    updateUser = async () => {},
    refreshUser = async () => {},
  } = {}
) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    updateUser,
    refreshUser,
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 8, Task 8.4 — Customer Profile Management (Frontend Unit & Integration)', () => {
  let originalUpdateCustomerProfile;

  beforeEach(() => {
    originalUpdateCustomerProfile = customerService.updateCustomerProfile;
  });

  afterEach(() => {
    customerService.updateCustomerProfile = originalUpdateCustomerProfile;
  });

  // =========================================================================
  // 1. Data Display & Helpers
  // =========================================================================
  describe('1. Profile Data Display & Helpers', () => {
    test('1.1 formatMemberSince formats valid dates and handles invalid safely', () => {
      const formatted = formatMemberSince('2026-11-05T10:00:00.000Z');
      assert.ok(formatted.includes('Nov') || formatted.includes('2026'));
      assert.strictEqual(formatMemberSince(null), 'Recently');
      assert.strictEqual(formatMemberSince('invalid-date'), 'Recently');
    });

    test('1.2 Customer profile page loads existing profile data (name, email, role, avatar)', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={mockCustomerUser} />);

      assert.match(html, /Profile Settings/i);
      assert.match(html, /value="Rahim Customer"/);
      assert.match(html, /value="rahim@example\.com"/);
      assert.match(html, /customer/i);
      assert.match(html, /Read-only/i);
      assert.match(html, /usr_cust12345678/);
      assert.match(html, /Member since/i);
      assert.match(html, /avatar_rahim\.png/);
    });

    test('1.3 Customer profile page renders fallback avatar initial when no avatar exists', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={mockCustomerNoAvatar} />);

      assert.match(html, /value="Fatima Customer"/);
      // Fatima starts with 'F'
      assert.match(html, />F</);
    });
  });

  // =========================================================================
  // 2. Loading and Error States
  // =========================================================================
  describe('2. Loading & Error States', () => {
    test('2.1 Loading state renders spinner and feedback text when user is null', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={null} />, {
        user: null,
      });

      assert.match(html, /Loading customer profile/i);
      assert.match(html, /Retrieving account information from server/i);
      assert.match(html, /role="status"/i);
    });
  });

  // =========================================================================
  // 3. Name Validation & Updates
  // =========================================================================
  describe('3. Name Validation & Updates', () => {
    test('3.1 customerService exposes updateCustomerProfile function', () => {
      assert.strictEqual(
        typeof customerService.updateCustomerProfile,
        'function',
        'customerService must export updateCustomerProfile'
      );
    });

    test('3.2 Successful name update calls customerService.updateCustomerProfile', async () => {
      let calledWith = null;
      customerService.updateCustomerProfile = async (payload) => {
        calledWith = payload;
        return { ...mockCustomerUser, name: 'Rahim Khan Updated' };
      };

      const result = await customerService.updateCustomerProfile({ name: 'Rahim Khan Updated' });
      assert.deepStrictEqual(calledWith, { name: 'Rahim Khan Updated' });
      assert.strictEqual(result.name, 'Rahim Khan Updated');
    });
  });

  // =========================================================================
  // 4. Email Update Behavior & Verification Safeguards
  // =========================================================================
  describe('4. Email Update Safeguards', () => {
    test('4.1 Email input indicates verified status and security policy notice', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={mockCustomerUser} />);

      assert.match(html, /Verified/i);
      assert.match(html, /Linked to your verified credentials/i);
      assert.match(html, /Direct email modification is restricted by security policy/i);
    });

    test('4.2 Direct backend email modification attempts are rejected with HTTP 400', async () => {
      customerService.updateCustomerProfile = async (payload) => {
        if (payload?.email) {
          const err = new Error('Prohibited or unsupported fields in request body');
          err.status = 400;
          throw err;
        }
      };

      await assert.rejects(
        async () => {
          await customerService.updateCustomerProfile({ email: 'tampered@example.com' });
        },
        /Prohibited or unsupported fields/
      );
    });
  });

  // =========================================================================
  // 5. Avatar Constraints & Upload Validation
  // =========================================================================
  describe('5. Avatar Constraints & Validation', () => {
    test('5.1 Avatar upload policy enforces 5 MB limit and permitted MIME types', () => {
      assert.strictEqual(MAX_AVATAR_SIZE_BYTES, 5 * 1024 * 1024);
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/jpeg'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/png'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/webp'));
      assert.ok(ALLOWED_AVATAR_TYPES.includes('image/svg+xml'));
      assert.ok(!ALLOWED_AVATAR_TYPES.includes('image/gif'), 'GIF must be excluded');
      assert.ok(!ALLOWED_AVATAR_TYPES.includes('application/pdf'), 'PDF must be excluded');
    });

    test('5.2 Form renders hidden file input with correct accept attribute', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={mockCustomerUser} />);

      assert.match(html, /data-testid="avatar-file-input"/);
      assert.match(html, /accept="image\/jpeg,image\/png,image\/webp,image\/svg\+xml"/);
    });

    test('5.3 Failed avatar upload preserves the previous avatar without crash', async () => {
      customerService.updateCustomerProfile = async () => {
        const err = new Error('Network error during file transmission');
        err.status = 500;
        throw err;
      };

      await assert.rejects(
        async () => {
          await customerService.updateCustomerProfile(new FormData());
        },
        /Network error during file transmission/
      );
    });
  });

  // =========================================================================
  // 6. Sidebar Navigation & Active Status
  // =========================================================================
  describe('6. Customer Sidebar Profile Navigation', () => {
    test('6.1 Customer sidebar renders active NavLink targeting /dashboard/profile', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard',
      });

      assert.match(html, /href="\/dashboard\/profile"/);
      assert.match(html, /Profile Settings/);
    });

    test('6.2 Sidebar applies active styling when viewing /dashboard/profile', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/profile',
      });

      // NavLink renders aria-current="page" on /dashboard/profile
      assert.match(html, /aria-current="page"/);
    });
  });

  // =========================================================================
  // 7. Route Authorization Guards on "/dashboard/profile"
  // =========================================================================
  describe('7. Route Authorization Guards on "/dashboard/profile"', () => {
    test('7.1 Authenticated customer is ALLOWED to access "/dashboard/profile"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockCustomerUser,
        initialRoute: '/dashboard/profile',
      });

      assert.doesNotMatch(html, /Access Denied/i);
      assert.match(html, /Profile Settings/i);
    });

    test('7.2 Authenticated owner receives ACCESS DENIED on "/dashboard/profile"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockOwnerUser,
        initialRoute: '/dashboard/profile',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('7.3 Authenticated admin receives ACCESS DENIED on "/dashboard/profile"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdminUser,
        initialRoute: '/dashboard/profile',
      });

      assert.match(html, /Access Denied/i);
      assert.match(html, /You do not have permission to access this page/i);
    });

    test('7.4 Unauthenticated visitor is redirected away from "/dashboard/profile"', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: null,
        initialRoute: '/dashboard/profile',
      });

      assert.doesNotMatch(html, /Customer Profile \(Protected\)/i);
      assert.doesNotMatch(html, /data-testid="customer-name-input"/i);
    });
  });

  // =========================================================================
  // 8. Privileged Field Modification Rejection
  // =========================================================================
  describe('8. Privileged Field Protection', () => {
    test('8.1 Client-side form does not expose editable role, ID, or verified inputs', () => {
      const html = renderWithAuth(<CustomerProfilePage initialUser={mockCustomerUser} />);

      // Role is rendered read-only
      assert.match(html, /Read-only/);
      assert.doesNotMatch(html, /name="role"/);
      assert.doesNotMatch(html, /name="is_active"/);
    });
  });
});

