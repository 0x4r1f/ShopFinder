import React, { useState, useEffect, useRef, useCallback } from 'react';
import adminService from '../services/adminService.js';
import { Button } from '../components/ui/button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import UserStatusModal from '../components/admin/UserStatusModal.jsx';
import {
  UserIcon,
  SearchIcon,
  CloseIcon,
  CheckIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  MailIcon,
} from '../components/common/Icons.jsx';
import { formatSubmissionDate } from './AdminReviewQueuePage.jsx';

/**
 * Role badge styling helper.
 */
export function getRoleBadgeClass(role) {
  switch (role) {
    case 'admin':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    case 'owner':
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
    case 'customer':
    default:
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
  }
}

/**
 * ShopFinder — Admin User Management Page (Phase 7, Task 7.5)
 *
 * Full user administration interface allowing platform administrators to:
 * 1. View all registered users with name, email, role, status, and creation date.
 * 2. Search users by name and email via backend database query.
 * 3. Filter users by role (All, Customers, Owners, Admins).
 * 4. Paginate across user records.
 * 5. Activate or Deactivate user accounts with accessible confirmation modal.
 * 6. Enforces anti-self-deactivation safety (HTTP 403 handling).
 */
export default function AdminUsersPage({ initialData = null }) {
  const [users, setUsers] = useState(initialData?.users || null);
  const [pagination, setPagination] = useState(initialData?.pagination || null);
  const [currentPage, setCurrentPage] = useState(initialData?.pagination?.page || 1);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Status Modal State
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchUsers = useCallback(
    async (page = 1, role = roleFilter, search = activeSearch) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const data = await adminService.getUsers(
          {
            page,
            perPage: 10,
            role: role === 'all' ? undefined : role,
            search: search.trim() ? search.trim() : undefined,
            sort: '-created',
          },
          { signal: controller.signal }
        );

        setUsers(data.users || []);
        setPagination(data.pagination || { page, perPage: 10, totalItems: 0, totalPages: 1 });
        setCurrentPage(data.pagination?.page || page);
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        setError(err?.message || 'Failed to load platform users.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [roleFilter, activeSearch]
  );

  useEffect(() => {
    if (!initialData) {
      fetchUsers(1, roleFilter, activeSearch);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchUsers, initialData, roleFilter, activeSearch]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const query = searchInput.trim();
    setActiveSearch(query);
    setCurrentPage(1);
    fetchUsers(1, roleFilter, query);
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setCurrentPage(1);
    fetchUsers(1, roleFilter, '');
  };

  // Handle Role Filter Change
  const handleRoleChange = (newRole) => {
    setRoleFilter(newRole);
    setCurrentPage(1);
    fetchUsers(1, newRole, activeSearch);
  };

  // Handle Pagination
  const handlePageChange = (newPage) => {
    if (newPage < 1 || (pagination && newPage > pagination.totalPages)) return;
    setCurrentPage(newPage);
    fetchUsers(newPage, roleFilter, activeSearch);
  };

  // Confirm Status Change
  const handleConfirmStatusChange = async () => {
    if (!selectedUserForModal || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    setFeedback(null);

    const targetUser = selectedUserForModal;
    const newStatus = !targetUser.is_active;

    try {
      await adminService.updateUserStatus(targetUser.id, newStatus);
      setSelectedUserForModal(null);
      setFeedback({
        type: 'success',
        message: `User "${targetUser.name || targetUser.email}" has been successfully ${
          newStatus ? 'activated' : 'deactivated'
        }.`,
      });
      // Refresh user list to reflect verified server state
      fetchUsers(currentPage, roleFilter, activeSearch);
    } catch (err) {
      let msg = err?.message || 'Failed to update user status.';
      if (err?.status === 403 || msg.toLowerCase().includes('own account')) {
        msg = 'Administrators cannot deactivate their own account.';
      }
      setFeedback({
        type: 'error',
        message: msg,
      });
      setSelectedUserForModal(null);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              User Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <UserIcon className="w-3.5 h-3.5" />
              Platform Accounts
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage registered customer, property owner, and administrator accounts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(currentPage, roleFilter, activeSearch)}
            disabled={loading}
            className="gap-1.5"
            aria-label="Refresh user list"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <NotificationBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Error Banner */}
      {error && (
        <NotificationBanner
          type="error"
          message={error}
          actionLabel="Try Again"
          onAction={() => fetchUsers(currentPage, roleFilter, activeSearch)}
        />
      )}

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search users by name or email"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Role Filter">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'customer', label: 'Customers' },
            { id: 'owner', label: 'Owners' },
            { id: 'admin', label: 'Admins' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleRoleChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                roleFilter === tab.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Loading, Empty, or Table */}
      {loading && !users ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground animate-pulse">
            Loading platform users from database...
          </p>
        </div>
      ) : users && users.length === 0 ? (
        <EmptyState
          title="No Users Found"
          description={
            activeSearch || roleFilter !== 'all'
              ? 'No registered users match your search or filter criteria. Try adjusting your parameters.'
              : 'There are currently no registered users on the platform.'
          }
          actionLabel={activeSearch || roleFilter !== 'all' ? 'Reset Filters' : undefined}
          onAction={
            activeSearch || roleFilter !== 'all'
              ? () => {
                  setSearchInput('');
                  setActiveSearch('');
                  setRoleFilter('all');
                  fetchUsers(1, 'all', '');
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Platform Users Table">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="py-3.5 px-4">User</th>
                  <th scope="col" className="py-3.5 px-4">Email Address</th>
                  <th scope="col" className="py-3.5 px-4">Role</th>
                  <th scope="col" className="py-3.5 px-4">Account Status</th>
                  <th scope="col" className="py-3.5 px-4">Registered Date</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users?.map((u) => {
                  const isActive = Boolean(u.is_active);
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors" data-testid="user-row">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary border border-border overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs uppercase">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.name || 'User avatar'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (u.name || 'U').charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate max-w-[180px]">
                              {u.name || 'User'}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground block truncate">
                              {u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-foreground font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <MailIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{u.email}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckIcon className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                            <CloseIcon className="w-3 h-3" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted-foreground">
                        {formatSubmissionDate(u.created)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Button
                          type="button"
                          variant={isActive ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => setSelectedUserForModal(u)}
                          className={`h-7 px-2.5 text-xs font-medium ${
                            isActive
                              ? 'text-destructive hover:bg-destructive/10 border-destructive/30'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          aria-label={`${isActive ? 'Deactivate' : 'Activate'} user ${u.name || u.email}`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {users?.map((u) => {
              const isActive = Boolean(u.is_active);
              return (
                <div key={u.id} className="p-4 space-y-3" data-testid="user-card-mobile">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-border overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm uppercase">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.name || 'User avatar'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (u.name || 'U').charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground line-clamp-1">{u.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getRoleBadgeClass(
                        u.role
                      )}`}
                    >
                      {u.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status:</span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-destructive/10 text-destructive">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">{formatSubmissionDate(u.created)}</span>
                  </div>

                  <div className="pt-1">
                    <Button
                      type="button"
                      variant={isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => setSelectedUserForModal(u)}
                      className={`w-full h-8 text-xs font-medium ${
                        isActive
                          ? 'text-destructive hover:bg-destructive/10 border-destructive/30'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isActive ? 'Deactivate Account' : 'Activate Account'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20">
              <span className="text-xs text-muted-foreground text-center sm:text-left">
                Showing Page <strong className="text-foreground">{pagination.page}</strong> of{' '}
                <strong className="text-foreground">{pagination.totalPages}</strong> ({pagination.totalItems} total users)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="gap-1 text-xs"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="gap-1 text-xs"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <UserStatusModal
        isOpen={Boolean(selectedUserForModal)}
        user={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
        onConfirm={handleConfirmStatusChange}
        isSubmitting={isUpdatingStatus}
      />
    </div>
  );
}

