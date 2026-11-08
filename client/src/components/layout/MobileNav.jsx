import React, { useEffect, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/button.jsx';
import CreditBadge from '../common/CreditBadge.jsx';
import {
  HomeIcon,
  StoreIcon,
  DashboardIcon,
  UserIcon,
  LogoutIcon,
  CloseIcon,
  SparklesIcon,
} from '../common/Icons.jsx';

/**
 * ShopFinder — Mobile Navigation Overlay Menu (Task 4.4)
 *
 * Provides touch-friendly, accessible navigation for mobile viewports (< md).
 * Matches desktop role-aware navigation and authentication actions.
 * Automatically closes on Escape key or link navigation.
 */
export default function MobileNav({ isOpen, onClose }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle logout with double-click protection
  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      onClose();
      navigate('/');
    } catch (err) {
      console.warn('Mobile logout error:', err.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isOpen) return null;

  const roleLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'owner'
      ? 'Property Owner'
      : 'Customer';

  return (
    <div
      id="mobile-navigation"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md md:hidden"
    >
      {/* Top Bar with Brand & Close Button */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight"
        >
          <StoreIcon className="w-6 h-6 text-primary" />
          <span>ShopFinder</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="Mobile Navigation"
        className="flex-1 overflow-y-auto px-4 py-6 space-y-2"
      >
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <HomeIcon className="w-5 h-5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/marketplace"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-colors ${
              isActive
                ? 'bg-accent/60 text-foreground font-semibold'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <StoreIcon className="w-5 h-5" />
            <span>Marketplace</span>
          </div>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-normal">
            Browse
          </span>
        </NavLink>

        <NavLink
          to="/pricing"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-colors ${
              isActive
                ? 'bg-accent/60 text-foreground font-semibold'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-5 h-5" />
            <span>Pricing</span>
          </div>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-normal">
            Credits
          </span>
        </NavLink>

        {/* Role-Specific Navigation Links */}
        {isAuthenticated && user?.role === 'customer' && (
          <NavLink
            to="/dashboard"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <DashboardIcon className="w-5 h-5" />
            <span>Customer Dashboard</span>
          </NavLink>
        )}

        {isAuthenticated && (user?.role === 'owner' || user?.role === 'admin') && (
          <NavLink
            to={user?.role === 'admin' ? '/admin-dashboard' : '/owner-dashboard'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <DashboardIcon className="w-5 h-5" />
            <span>{user?.role === 'admin' ? 'Admin Portal' : 'Owner Portal'}</span>
          </NavLink>
        )}
      </nav>

      {/* User Section or Auth Actions */}
      <div className="p-4 border-t border-border bg-card">
        {isAuthenticated && user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <div className="mt-1">
                  <span className="inline-block text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Credit Balance Indicator */}
            <CreditBadge variant="mobile" onClick={onClose} />

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogoutIcon className="w-4 h-4" />
              <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login" onClick={onClose}>
                Sign In
              </Link>
            </Button>
            <Button asChild variant="default" className="w-full">
              <Link to="/register" onClick={onClose}>
                Create an Account
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

