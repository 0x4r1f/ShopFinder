import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines conditional CSS classes and resolves Tailwind CSS class conflicts.
 *
 * @param {...any} inputs - Class names, expressions, objects, or arrays
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

