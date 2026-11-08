import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * ShopFinder — Accessible Animated Loading Spinner (Task 4.5)
 *
 * Supports sm/md/lg/xl sizes, theme color variants, and accessible screen-reader labels.
 * Respects prefers-reduced-motion preferences and keeps decorative graphics hidden.
 *
 * @param {Object} props
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {'primary'|'secondary'|'white'|'muted'|'destructive'} [props.variant='primary']
 * @param {string} [props.label='Loading...']
 * @param {string} [props.className]
 */
export default function Spinner({
  size = 'md',
  variant = 'primary',
  label = 'Loading...',
  className,
  ...props
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  const variantClasses = {
    primary: 'border-primary/20 border-t-primary',
    secondary: 'border-secondary-foreground/20 border-t-secondary-foreground',
    white: 'border-white/30 border-t-white',
    muted: 'border-muted-foreground/20 border-t-muted-foreground',
    destructive: 'border-destructive/20 border-t-destructive',
  };

  return (
    <div
      role="status"
      className={cn('inline-flex items-center justify-center gap-2', className)}
      {...props}
    >
      <div
        aria-hidden="true"
        className={cn(
          'rounded-full animate-spin motion-reduce:animate-none',
          sizeClasses[size] || sizeClasses.md,
          variantClasses[variant] || variantClasses.primary
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

