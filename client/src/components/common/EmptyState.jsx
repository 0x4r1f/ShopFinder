import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * ShopFinder — Reusable Empty State Component (Task 4.5)
 *
 * Provides a consistent, accessible presentation for zero-result states,
 * empty queues, and empty collections.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Optional icon or illustration
 * @param {string} props.title - Primary empty state title
 * @param {string|React.ReactNode} [props.description] - Secondary descriptive guidance
 * @param {React.ReactNode} [props.action] - Optional action button or link
 * @param {string} [props.className]
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}) {
  return (
    <div
      role="region"
      aria-label={title || 'Empty state'}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-xl border border-dashed border-border bg-card/50 max-w-lg mx-auto my-6',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="w-14 h-14 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mb-4 shrink-0 shadow-inner">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground tracking-tight mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

