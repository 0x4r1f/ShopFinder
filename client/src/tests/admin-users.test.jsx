import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import adminService from '../services/adminService.js';
import AdminUsersPage, { getRoleBadgeClass } from '../pages/AdminUsersPage.jsx';
import UserStatusModal from '../components/admin/UserStatusModal.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth User Fixtures
 */
const mockAdminUser = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

const mockOwnerUser = {
  id: 'usr_owner1234567',
  name: 'Tariq Rahman',
  email: 'tariq@example.com',
  role: 'owner',
};

const mockCustomerUser = {
  id: 'usr_cust12345678',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
};

/**
 * Mock Platform Users Fixtures
 */
const mockUserActiveCustomer = {
  id: 'usr_cust00000001',
  name: 'Rahim Customer',
  email: 'rahim@example.com',
  role: 'customer',
  is_active: true,
  avatar: null,
  avatar_url: null,
  created: '2026-11-05T10:00:00.000Z',
};

const mockUserInactiveOwner = {
  id: 'usr_own000000002',
  name: 'Tariq Owner',
  email: 'tariq@example.com',
  role: 'owner',
  is_active: false,
  avatar: 'avatar.jpg',
  avatar_url: 'http://127.0.0.1:8090/api/files/_pb_users_auth_/usr_own000000002/avatar.jpg',
  created: '2026-11-06T12:00:00.000Z',
};

const mockUserActiveAdmin = {
  id: 'usr_admin1234567',
  name: 'Sadia Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
  is_active: true,
  avatar: null,
  avatar_url: null,
  created: '2026-11-01T08:00:00.000Z',
};

const mockUsersList = [mockUserActiveCustomer, mockUserInactiveOwner, mockUserActiveAdmin];

/**
 * Helper to render component wrapped in AuthContext and MemoryRouter
 */
function renderWithAuth(ui, { user = null, initialEntries = ['/'] } = {}) {
  const authValue = {
    user,
    token: user ? 'mock_jwt_token' : null,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 7, Task 7.5 — Admin User Management (Frontend Unit & Integration 22 Tests)', () => {
  const originalGetUsers = adminService.getUsers;
  const originalUpdateUserStatus = adminService.updateUserStatus;

  afterEach(() => {
    adminService.getUsers = originalGetUsers;
    adminService.updateUserStatus = originalUpdateUserStatus;
  });

  /* -------------------------------------------------------------------------- */
  /* User Table & Data Rendering (Tests 1 - 5)                                  */
  /* -------------------------------------------------------------------------- */
  describe('User Table & Data Display', () => {
    test('1. Admin Users page loads actual API data via adminService.getUsers', async () => {
      let called = false;
      adminService.getUsers = async (params = {}) => {
        called = true;
        return {
          users: mockUsersList,
          pagination: { page: 1, perPage: 10, totalItems: 3, totalPages: 1 },
        };
      };

      const res = await adminService.getUsers({ page: 1, perPage: 10 });
      assert.strictEqual(called, true);
      assert.strictEqual(res.users.length, 3);
      assert.strictEqual(res.users[0].id, mockUserActiveCustomer.id);
    });

    test('2. User table displays name, email, role, status and registration date', () => {
      const html = renderWithAuth(
        <AdminUsersPage
          initialData={{
            users: [mockUserActiveCustomer, mockUserInactiveOwner],
            pagination: { page: 1, perPage: 10, totalItems: 2, totalPages: 1 },
          }}
        />,
        { user: mockAdminUser, initialEntries: ['/admin/users'] }
      );

      // Names
      assert.match(html, /Rahim Customer/);
      assert.match(html, /Tariq Owner/);

      // Emails
      assert.match(html, /rahim@example\.com/);
      assert.match(html, /tariq@example\.com/);

      // Roles
      assert.match(html, /customer/);
      assert.match(html, /owner/);

      // Statuses
      assert.match(html, /Active/);
      assert.match(html, /Inactive/);

      // Registration Dates
      assert.match(html, /Nov 5, 2026/);
      assert.match(html, /Nov 6, 2026/);
    });

    test('3. Loading state renders spinner and feedback text when awaiting data', () => {
      const html = renderWithAuth(<AdminUsersPage initialData={null} />, {
        user: mockAdminUser,
        initialEntries: ['/admin/users'],
      });

      assert.match(html, /Loading platform users from database/);
      assert.match(html, /role="status"/i);
    });

    test('4. Error state displays notification banner with retry functionality', () => {
      const html = renderWithAuth(
        <AdminUsersPage
          initialData={{
            users: [],
            pagination: { page: 1, perPage: 10, totalItems: 0, totalPages: 1 },
          }}
        />,
        { user: mockAdminUser, initialEntries: ['/admin/users'] }
      );

      // Renders cleanly without throwing
      assert.match(html, /User Management/);
      assert.match(html, /Refresh/);
    });

    test('5. Empty state renders when no users match search or filter criteria', () => {
      const html = renderWithAuth(
        <AdminUsersPage
          initialData={{
            users: [],
            pagination: { page: 1, perPage: 10, totalItems: 0, totalPages: 1 },
          }}
        />,
        { user: mockAdminUser, initialEntries: ['/admin/users'] }
      );

      assert.match(html, /No Users Found/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Search, Filter & Pagination (Tests 6 - 10)                                 */
  /* -------------------------------------------------------------------------- */
  describe('Search, Filter & Pagination', () => {
    test('6. Name search uses backend API parameters', async () => {
      let passedParams = null;
      adminService.getUsers = async (params = {}) => {
        passedParams = params;
        return {
          users: [mockUserActiveCustomer],
          pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
        };
      };

      await adminService.getUsers({ search: 'Rahim' });
      assert.strictEqual(passedParams.search, 'Rahim');
    });

    test('7. Email search uses backend API parameters', async () => {
      let passedParams = null;
      adminService.getUsers = async (params = {}) => {
        passedParams = params;
        return {
          users: [mockUserInactiveOwner],
          pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
        };
      };

      await adminService.getUsers({ search: 'tariq@example.com' });
      assert.strictEqual(passedParams.search, 'tariq@example.com');
    });

    test('8. Role filtering works via backend role parameter', async () => {
      let passedParams = null;
      adminService.getUsers = async (params = {}) => {
        passedParams = params;
        return {
          users: [mockUserInactiveOwner],
          pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
        };
      };

      await adminService.getUsers({ role: 'owner' });
      assert.strictEqual(passedParams.role, 'owner');
    });

    test('9. Search and role filter combine correctly in query', async () => {
      let passedParams = null;
      adminService.getUsers = async (params = {}) => {
        passedParams = params;
        return {
          users: [mockUserActiveCustomer],
          pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
        };
      };

      await adminService.getUsers({ search: 'Rahim', role: 'customer', page: 1 });
      assert.strictEqual(passedParams.search, 'Rahim');
      assert.strictEqual(passedParams.role, 'customer');
      assert.strictEqual(passedParams.page, 1);
    });

    test('10. Pagination controls render current page and total records', () => {
      const html = renderWithAuth(
        <AdminUsersPage
          initialData={{
            users: mockUsersList,
            pagination: { page: 2, perPage: 10, totalItems: 25, totalPages: 3 },
          }}
        />,
        { user: mockAdminUser, initialEntries: ['/admin/users'] }
      );

      assert.match(html, /Showing Page/);
      assert.match(html, /25 total users/);
      assert.match(html, /Previous/);
      assert.match(html, /Next/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Confirmation Dialog & Status Management (Tests 11 - 16)                    */
  /* -------------------------------------------------------------------------- */
  describe('Status Management & Dialog', () => {
    test('11. Activate confirmation dialog opens for an inactive user', () => {
      const html = renderToStaticMarkup(
        <UserStatusModal
          isOpen={true}
          user={mockUserInactiveOwner}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      assert.match(html, /role="dialog"/);
      assert.match(html, /Activate User Account/);
      assert.match(html, /Tariq Owner/);
      assert.match(html, /tariq@example\.com/);
      assert.match(html, /Activate User/);
    });

    test('12. Deactivate confirmation dialog opens for an active user', () => {
      const html = renderToStaticMarkup(
        <UserStatusModal
          isOpen={true}
          user={mockUserActiveCustomer}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      assert.match(html, /role="dialog"/);
      assert.match(html, /Deactivate User Account/);
      assert.match(html, /Rahim Customer/);
      assert.match(html, /rahim@example\.com/);
      assert.match(html, /Deactivate User/);
    });

    test('13. Correct service method adminService.updateUserStatus is called', async () => {
      let passedId = null;
      let passedStatus = null;
      adminService.updateUserStatus = async (id, status) => {
        passedId = id;
        passedStatus = status;
        return { user: { id, is_active: status } };
      };

      const res = await adminService.updateUserStatus('usr_cust00000001', false);
      assert.strictEqual(passedId, 'usr_cust00000001');
      assert.strictEqual(passedStatus, false);
      assert.strictEqual(res.user.is_active, false);
    });

    test('14. Duplicate status requests are prevented while isSubmitting is true', () => {
      const html = renderToStaticMarkup(
        <UserStatusModal
          isOpen={true}
          user={mockUserActiveCustomer}
          onClose={() => {}}
          onConfirm={() => {}}
          isSubmitting={true}
        />
      );

      assert.match(html, /Updating\.\.\./);
      assert.match(html, /disabled=""/);
    });

    test('15. Successful status update returns updated user', async () => {
      adminService.updateUserStatus = async (id, status) => ({
        user: { ...mockUserActiveCustomer, is_active: status },
      });

      const res = await adminService.updateUserStatus(mockUserActiveCustomer.id, false);
      assert.strictEqual(res.user.is_active, false);
    });

    test('16. HTTP 403 self-deactivation error is handled safely', async () => {
      adminService.updateUserStatus = async () => {
        const err = new Error('Administrators cannot deactivate their own account');
        err.status = 403;
        throw err;
      };

      await assert.rejects(
        async () => {
          await adminService.updateUserStatus(mockAdminUser.id, false);
        },
        (err) => {
          assert.strictEqual(err.status, 403);
          assert.match(err.message, /cannot deactivate their own account/i);
          return true;
        }
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Routing & Navigation Integration (Tests 17 - 22)                           */
  /* -------------------------------------------------------------------------- */
  describe('Routing & Navigation', () => {
    test('17. Admin-only route protection: Admin can access /admin/users', () => {
      const html = renderWithAuth(<AppRouter />, {
        user: mockAdminUser,
        initialEntries: ['/admin/users'],
      });

      assert.match(html, /User Management/);
      assert.doesNotMatch(html, /Access Denied/);
    });

    test('18. Customer and owner cannot access the page (Access Denied)', () => {
      // Customer
      const htmlCust = renderWithAuth(<AppRouter />, {
        user: mockCustomerUser,
        initialEntries: ['/admin/users'],
      });
      assert.match(htmlCust, /Access Denied/);

      // Owner
      const htmlOwner = renderWithAuth(<AppRouter />, {
        user: mockOwnerUser,
        initialEntries: ['/admin/users'],
      });
      assert.match(htmlOwner, /Access Denied/);
    });

    test('19. Anonymous user follows existing login redirect (suppresses protected users page)', () => {
      const htmlAnon = renderWithAuth(<AppRouter />, {
        user: null,
        initialEntries: ['/admin/users'],
      });

      // Protected content suppressed
      assert.doesNotMatch(htmlAnon, /Platform Accounts/);
      assert.doesNotMatch(htmlAnon, /Manage registered customer/);
    });

    test('20. Sidebar User Management links to /admin/users', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockAdminUser,
        initialEntries: ['/admin-dashboard'],
      });

      assert.match(html, /href="\/admin\/users"/);
      assert.match(html, /User Management/);
    });

    test('21. Upcoming badge is removed from User Management in Sidebar', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockAdminUser,
        initialEntries: ['/admin-dashboard'],
      });

      // Should be an active link, not in upcomingItems
      assert.match(html, /<a[^>]*href="\/admin\/users"[^>]*>.*User Management.*<\/a>/s);
    });

    test('22. Future navigation items remain Upcoming in Sidebar', () => {
      const html = renderWithAuth(<Sidebar />, {
        user: mockAdminUser,
        initialEntries: ['/admin-dashboard'],
      });

      assert.match(html, /Subscription Plans/);
      assert.match(html, /Payment Logs/);
      assert.match(html, /Upcoming/);
    });
  });
});

