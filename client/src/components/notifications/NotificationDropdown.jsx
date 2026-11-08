import React from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../common/Spinner.jsx';
import { CheckCheckIcon, AlertCircleIcon, CheckCircleIcon } from '../common/Icons.jsx';

/**
 * Formats a timestamp into an accessible human-readable relative time string.
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns safe styling and label for each supported notification type.
 */
function getTypeConfig(type) {
  switch (type) {
    case 'listing_approved':
      return {
        label: 'Approved',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        icon: <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      };
    case 'listing_rejected':
      return {
        label: 'Rejected',
        badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
        icon: <AlertCircleIcon className="w-3.5 h-3.5 text-destructive" />,
      };
    case 'credit_low':
      return {
        label: 'Low Credits',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        icon: <AlertCircleIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
      };
    default:
      return {
        label: 'Notice',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        icon: null,
      };
  }
}

/**
 * ShopFinder — Notification Dropdown Panel (Phase 11, Task 11.8)
 *
 * Renders the popover list of user notifications with:
 * - Mark as read action per item
 * - Mark all as read bulk action
 * - Loading, error with retry, and empty states
 * - Visual distinction for read vs unread notifications
 *
 * @param {Object} props
 * @param {Array<Object>} props.notifications
 * @param {number} props.unreadCount
 * @param {boolean} props.isLoading
 * @param {string|null} props.error
 * @param {Function} props.onMarkAsRead
 * @param {Function} props.onMarkAllAsRead
 * @param {Function} props.onRetry
 * @param {Function} props.onClose
 */
export default function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  isLoading = false,
  error = null,
  onMarkAsRead,
  onMarkAllAsRead,
  onRetry,
  onClose,
}) {
  return (
    <div
      role="region"
      aria-label="Notification Center"
      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden text-card-foreground animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span
              data-testid="unread-badge"
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary text-primary-foreground"
            >
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && onMarkAllAsRead && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1.5 py-0.5"
            aria-label="Mark all notifications as read"
          >
            <CheckCheckIcon className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Body States */}
      <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Spinner size="md" className="mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="py-8 px-4 text-center">
            <p className="text-xs text-destructive mb-3">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-sm font-medium text-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              You will receive updates on listing approvals and credit activity here.
            </p>
          </div>
        ) : (
          notifications.map((item) => {
            const typeConfig = getTypeConfig(item.type);
            const isUnread = !item.is_read;

            return (
              <div
                key={item.id}
                data-testid={`notification-item-${item.id}`}
                className={`p-3.5 transition-colors flex items-start gap-3 text-left ${
                  isUnread
                    ? 'bg-primary/5 hover:bg-primary/10'
                    : 'bg-card hover:bg-muted/30'
                }`}
              >
                {/* Unread indicator dot */}
                <div className="mt-1 flex-shrink-0">
                  {isUnread ? (
                    <span
                      aria-label="Unread notification"
                      className="block w-2 h-2 rounded-full bg-primary"
                    />
                  ) : (
                    <span className="block w-2 h-2 rounded-full bg-transparent" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeConfig.badgeClass}`}
                    >
                      {typeConfig.icon}
                      <span>{typeConfig.label}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(item.created)}
                    </span>
                  </div>

                  <p
                    className={`text-xs leading-relaxed break-words ${
                      isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {item.message}
                  </p>
                </div>

                {/* Mark as read single button */}
                {isUnread && onMarkAsRead && (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(item.id)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors flex-shrink-0"
                    title="Mark as read"
                    aria-label={`Mark notification "${item.message.slice(0, 20)}..." as read`}
                  >
                    <CheckCheckIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Link */}
      {notifications.length > 0 && (
        <div className="border-t border-border bg-muted/20">
          <Link
            to="/notifications"
            onClick={onClose}
            className="block text-center py-2.5 text-xs text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
