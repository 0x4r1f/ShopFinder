import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * ShopFinder — Reusable Skeleton Primitive (Phase 12, Task 12.3)
 *
 * shadcn/ui-compatible base skeleton loader.
 * Employs subtle pulse animation, theme-aware background token, and accessibility attributes.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional styling classes for dimensions, border radius, etc.
 * @param {React.Ref} [ref]
 */
const Skeleton = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted/80', className)}
      {...props}
    />
  );
});

Skeleton.displayName = 'Skeleton';

export { Skeleton };
export default Skeleton;

