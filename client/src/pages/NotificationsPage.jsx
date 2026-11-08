import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as notificationService from '../services/notificationService.js';
import { formatRelativeTime } from '../components/notifications/NotificationDropdown.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  BellIcon,
  CheckCheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from '../components/common/Icons.jsx';

/**
 * ShopFinder — Full Notifications Page (Phase 11, Task 11.8)
 *
 * Dedicated paginated notification center for customers and property owners.
 */
export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async (targetPage = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotifications({ page: targetPage, perPage: 10 });
      setNotifications(data.notifications || []);
      setPagination(data.pagination || { page: targetPage, totalPages: 1, totalItems: 0 });
      setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(page);
  }, [page, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markNotificationAsRead(id);
    } catch {
      fetchNotifications(page);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllNotificationsAsRead();
    } catch {
      fetchNotifications(page);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'listing_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>Listing Approved</span>
          </span>
        );
      case 'listing_rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
            <AlertCircleIcon className="w-3.5 h-3.5" />
            <span>Listing Rejected</span>
          </span>
        );
      case 'credit_low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <AlertCircleIcon className="w-3.5 h-3.5" />
            <span>Low Credits</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated with your commercial property moderation and credit activities.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckCheckIcon className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Main Body States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" className="text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      ) : error ? (
        <div className="py-12">
          <NotificationBanner
            variant="error"
            title="Unable to load notifications"
            message={error}
          />
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => fetchNotifications(page)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon className="w-8 h-8 text-muted-foreground" />}
          title="No notifications"
          description="You do not have any notifications right now."
        />
      ) : (
        <div className="space-y-3">
          <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden shadow-sm">
            {notifications.map((item) => {
              const isUnread = !item.is_read;

              return (
                <div
                  key={item.id}
                  data-testid={`notification-row-${item.id}`}
                  className={`p-4 transition-colors flex items-start gap-4 ${
                    isUnread
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'bg-card hover:bg-muted/30'
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="mt-1.5 flex-shrink-0">
                    {isUnread ? (
                      <span className="block w-2.5 h-2.5 rounded-full bg-primary" />
                    ) : (
                      <span className="block w-2.5 h-2.5 rounded-full bg-transparent" />
                    )}
                  </div>

                  {/* Message & metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {getTypeBadge(item.type)}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.created)}
                      </span>
                    </div>

                    <p
                      className={`text-sm leading-relaxed ${
                        isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {item.message}
                    </p>
                  </div>

                  {/* Mark as read button */}
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(item.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
                      title="Mark as read"
                      aria-label="Mark notification as read"
                    >
                      <CheckCheckIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card text-card-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <span className="text-xs text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card text-card-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
