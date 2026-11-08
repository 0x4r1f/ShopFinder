import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/button.jsx';
import {
  StoreIcon,
  DashboardIcon,
  UserIcon,
  LogoutIcon,
  ArrowLeftIcon,
  ClockIcon,
  MenuIcon,
  CloseIcon,
  ShieldCheckIcon,
  BookmarkIcon,
  EyeIcon,
  PlusIcon,
} from '../common/Icons.jsx';

/**
 * ShopFinder — Role-Aware Dashboard Sidebar (Task 4.4)
 *
 * Implements dedicated sidebar navigation for customer, owner, and admin portals.
 * Active verified routes use NavLink; unreleased future capabilities are marked with
 * an "Upcoming" badge and remain non-clickable without fake routes or hash anchors.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (err) {
      console.warn('Sidebar logout error:', err.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const role = user?.role || 'customer';
  const roleLabel =
    role === 'admin'
      ? 'Admin'
      : role === 'owner'
      ? 'Property Owner'
      : 'Customer';

  // Role-specific navigation definitions
  const customerNav = {
    overviewRoute: '/dashboard',
    overviewLabel: 'Customer Overview',
    upcomingItems: [
      'Subscription / Credits',
    ],
  };

  const ownerNav = {
    overviewRoute: '/owner-dashboard',
    overviewLabel: 'Owner Portal Overview',
    upcomingItems: [],
  };

  const adminNav = {
    overviewRoute: '/admin-dashboard',
    overviewLabel: 'Admin Overview',
    upcomingItems: [
      'Subscription Plans',
      'Payment Logs',
    ],
  };

  const currentNav =
    role === 'admin'
      ? adminNav
      : role === 'owner'
      ? ownerNav
      : customerNav;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Top Section: Brand & Nav Links */}
      <div className="space-y-6">
        {/* Brand Link */}
        <div className="px-3 py-2">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold text-lg text-primary tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <StoreIcon className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>ShopFinder</span>
          </Link>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{roleLabel} Portal</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav aria-label="Dashboard Navigation" className="space-y-1">
          {/* Active Primary Route */}
          <NavLink
            to={currentNav.overviewRoute}
            end
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <DashboardIcon className="w-4 h-4" />
            <span>{currentNav.overviewLabel}</span>
          </NavLink>

          {/* Active Customer Saved Properties Route (Task 8.3) */}
          {role === 'customer' && (
            <NavLink
              to="/dashboard/saved"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <BookmarkIcon className="w-4 h-4" />
              <span>Saved Properties</span>
            </NavLink>
          )}

          {/* Active Customer Reveal History Route (Task 8.5) */}
          {role === 'customer' && (
            <NavLink
              to="/dashboard/reveals"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <EyeIcon className="w-4 h-4" />
              <span>Reveal History</span>
            </NavLink>
          )}

          {/* Active Customer Profile Route (Task 8.4) */}
          {role === 'customer' && (
            <NavLink
              to="/dashboard/profile"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <UserIcon className="w-4 h-4" />
              <span>Profile Settings</span>
            </NavLink>
          )}

          {/* Active Owner Add Listing Route (Task 6.6) */}
          {role === 'owner' && (
            <NavLink
              to="/owner-dashboard/listings/new"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add New Listing</span>
            </NavLink>
          )}

          {/* Active Owner Profile Route (Task 6.7) */}
          {role === 'owner' && (
            <NavLink
              to="/owner-dashboard/profile"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <UserIcon className="w-4 h-4" />
              <span>Business Profile</span>
            </NavLink>
          )}

          {/* Active Admin Review Queue Route (Task 7.4) */}
          {role === 'admin' && (
            <NavLink
              to="/admin/review-queue"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <ShieldCheckIcon className="w-4 h-4" />
              <span>Review Queue</span>
            </NavLink>
          )}

          {/* Active Admin User Management Route (Task 7.5) */}
          {role === 'admin' && (
            <NavLink
              to="/admin/users"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <UserIcon className="w-4 h-4" />
              <span>User Management</span>
            </NavLink>
          )}

          {/* Upcoming Items (Visibly marked, Non-clickable) */}
          {currentNav.upcomingItems && currentNav.upcomingItems.length > 0 && (
            <>
              <div className="pt-2 pb-1 px-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Modules
                </span>
              </div>

              {currentNav.upcomingItems.map((item) => (
                <div
                  key={item}
                  aria-disabled="true"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-muted-foreground/75 cursor-not-allowed select-none bg-accent/20"
                >
                  <div className="flex items-center gap-2.5">
                    <ClockIcon className="w-4 h-4 text-muted-foreground/60" />
                    <span className="truncate">{item}</span>
                  </div>
                  <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                    Upcoming
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Back to Marketplace Link */}
          <div className="pt-4 border-t border-border mt-4">
            <Link
              to="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Bottom Section: User Profile & Logout */}
      <div className="pt-4 border-t border-border mt-6">
        <div className="flex items-center gap-3 px-3 py-2 bg-accent/30 rounded-lg mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-block text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.2 rounded-full uppercase tracking-wider mt-0.5">
              {roleLabel}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Log out of dashboard"
          className="w-full flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
        >
          <LogoutIcon className="w-4 h-4" />
          <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Sub-Header (< md) */}
      <div className="md:hidden w-full bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-primary">ShopFinder</span>
          <span className="text-xs font-medium text-muted-foreground">/ {roleLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-label="Toggle dashboard menu"
          aria-expanded={isMobileOpen}
          aria-controls="mobile-sidebar-menu"
          className="p-1.5 rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isMobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Panel (< md) */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-menu"
          className="md:hidden w-full bg-card border-b border-border p-4 shadow-lg animate-in slide-in-from-top-2 duration-200 motion-reduce:animate-none"
        >
          {sidebarContent}
        </div>
      )}

      {/* Desktop Sticky Sidebar (>= md) */}
      <aside
        aria-label="Dashboard Sidebar"
        className="hidden md:flex w-64 flex-col border-r border-border bg-card p-4 min-h-[calc(100vh-4rem)] shrink-0 sticky top-16"
      >
        {sidebarContent}
      </aside>
    </>
  );
}

