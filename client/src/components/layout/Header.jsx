import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/button.jsx';
import MobileNav from './MobileNav.jsx';
import CreditBadge from '../common/CreditBadge.jsx';
import NotificationBell from '../notifications/NotificationBell.jsx';
import {
  StoreIcon,
  HomeIcon,
  DashboardIcon,
  UserIcon,
  LogoutIcon,
  MenuIcon,
  SparklesIcon,
} from '../common/Icons.jsx';

/**
 * ShopFinder — Global Responsive Header (Task 4.4)
 *
 * Implements accessible, role-aware top navigation.
 * Renders public and role-tailored links, user identity chip with formatted role badge,
 * and responsive mobile menu trigger (< md).
 */
export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (err) {
      console.warn('Header logout error:', err.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'owner'
      ? 'Owner'
      : 'Customer';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 font-bold text-xl text-primary tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <StoreIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <span>ShopFinder</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 lg:gap-2"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <HomeIcon className="w-4 h-4" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/marketplace"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'bg-accent/70 text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <StoreIcon className="w-4 h-4" />
            <span>Marketplace</span>
          </NavLink>

          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'bg-accent/70 text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Pricing</span>
          </NavLink>

          {/* Role-Specific Navigation Links */}
          {isAuthenticated && user?.role === 'customer' && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`
              }
            >
              <DashboardIcon className="w-4 h-4" />
              <span>Customer Dashboard</span>
            </NavLink>
          )}

          {isAuthenticated && (user?.role === 'owner' || user?.role === 'admin') && (
            <NavLink
              to={user?.role === 'admin' ? '/admin-dashboard' : '/owner-dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`
              }
            >
              <DashboardIcon className="w-4 h-4" />
              <span>{user?.role === 'admin' ? 'Admin Portal' : 'Owner Portal'}</span>
            </NavLink>
          )}
        </nav>

        {/* Desktop Auth Controls / User Identity */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-border">
              {/* Customer Credit Balance Indicator */}
              <CreditBadge variant="header" />

              {/* Notification Bell (Customer & Owner) */}
              <NotificationBell />

              {/* User Identity Chip */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                      {roleLabel}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block max-w-[140px] truncate">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="Log out of your account"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogoutIcon className="w-4 h-4 mr-1.5" />
                <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild variant="default" size="sm">
                <Link to="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Header Controls (< md) */}
        <div className="flex items-center gap-1.5 md:hidden">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-navigation"
            className="p-2 rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </header>
  );
}

