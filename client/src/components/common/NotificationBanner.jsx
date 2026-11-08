import React from 'react';
import { cn } from '../../lib/utils.js';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  CloseIcon,
} from './Icons.jsx';

/**
 * ShopFinder — Reusable Notification Banner (Task 4.5)
 *
 * Implements accessible, semantic inline alerts for errors, warnings, success, and info messages.
 * Critical errors announce assertively; non-critical messages announce politely.
 * Supports optional title, dismiss callback, and accessible close button.
 *
 * @param {Object} props
 * @param {'error'|'warning'|'success'|'info'} [props.variant='info']
 * @param {string} [props.title]
 * @param {Function} [props.onClose]
 * @param {React.ReactNode} [props.children]
 * @param {string} [props.className]
 */
export default function NotificationBanner({
  variant = 'info',
  title,
  onClose,
  children,
  className,
  ...props
}) {
  const isCritical = variant === 'error';
  const role = isCritical ? 'alert' : 'status';
  const ariaLive = isCritical ? 'assertive' : 'polite';

  const config = {
    error: {
      container: 'bg-destructive/10 border-destructive/30 text-destructive',
      icon: <AlertCircleIcon className="w-5 h-5 shrink-0 text-destructive" />,
      titleColor: 'text-destructive font-semibold',
      closeColor: 'text-destructive hover:bg-destructive/10',
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200',
      icon: <AlertCircleIcon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />,
      titleColor: 'text-amber-900 dark:text-amber-100 font-semibold',
      closeColor: 'text-amber-800 dark:text-amber-200 hover:bg-amber-500/20',
    },
    success: {
      container: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
      icon: <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />,
      titleColor: 'text-emerald-900 dark:text-emerald-100 font-semibold',
      closeColor: 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20',
    },
    info: {
      container: 'bg-primary/10 border-primary/20 text-primary',
      icon: <InfoIcon className="w-5 h-5 shrink-0 text-primary" />,
      titleColor: 'text-primary font-semibold',
      closeColor: 'text-primary hover:bg-primary/10',
    },
  };

  const current = config[variant] || config.info;

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border text-sm transition-all',
        current.container,
        className
      )}
      {...props}
    >
      {current.icon}

      <div className="flex-1 min-w-0">
        {title && <h4 className={cn('text-sm mb-0.5', current.titleColor)}>{title}</h4>}
        {children && <div className="text-sm opacity-90 leading-relaxed">{children}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className={cn(
            'p-1 -mr-1 -mt-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0',
            current.closeColor
          )}
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

