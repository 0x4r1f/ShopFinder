import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BellIcon } from '../common/Icons.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import * as notificationService from '../../services/notificationService.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * ShopFinder — Notification Bell & Popover Trigger (Phase 11, Task 11.8)
 *
 * Renders an accessible notification trigger button with:
 * - Unread count badge
 * - Accessible keyboard navigation (Escape to dismiss, focus return)
 * - Outside click detection
 * - State management for loading, errors, and optimistic read updates
 */
export default function NotificationBell({ className = '' }) {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const isEligible = Boolean(
    isAuthenticated && user && (user.role === 'customer' || user.role === 'owner')
  );

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isEligible) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotifications({ page: 1, perPage: 15 });
      setNotifications(data.notifications || []);
      setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isEligible]);

  // Initial fetch for unread count badge
  useEffect(() => {
    if (isEligible) {
      fetchNotifications();
    }
  }, [isEligible, fetchNotifications]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (isOpen && isEligible) {
      fetchNotifications();
    }
  }, [isOpen, isEligible, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key press and restore focus to trigger button
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        if (buttonRef.current) {
          buttonRef.current.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Mark single notification read
  const handleMarkAsRead = async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markNotificationAsRead(id);
    } catch {
      // Re-fetch on failure to sync server truth
      fetchNotifications();
    }
  };

  // Mark all notifications read
  const handleMarkAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllNotificationsAsRead();
    } catch {
      fetchNotifications();
    }
  };

  if (!isEligible) {
    return null;
  }

  const ariaLabel =
    unreadCount > 0
      ? `Notifications (${unreadCount} unread)`
      : 'Notifications';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      >
        <BellIcon className="w-5 h-5" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            data-testid="bell-unread-badge"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-destructive rounded-full border-2 border-background shadow-sm animate-in zoom-in-50 duration-150"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          error={error}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onRetry={fetchNotifications}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

