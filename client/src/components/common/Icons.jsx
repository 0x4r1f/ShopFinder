import React from 'react';

/**
 * ShopFinder — Zero-Dependency Accessible SVG Icon Set (Task 4.4)
 *
 * Lightweight, semantic SVG icons without third-party icon libraries.
 * Defaults to aria-hidden="true" for decorative usage unless overridden.
 */

export function MenuIcon({ className = 'w-6 h-6', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function CloseIcon({ className = 'w-6 h-6', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function HomeIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  );
}

export function StoreIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 9l2-5h14l2 5v1a3 3 0 0 1-6 0v-1H9v1a3 3 0 0 1-6 0V9z" />
      <path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
      <path d="M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    </svg>
  );
}

export function DashboardIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function UserIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function LogoutIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function ClockIcon({ className = 'w-4 h-4', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function BuildingIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="22" x2="9" y2="12" />
      <line x1="15" y1="22" x2="15" y2="12" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="8" y1="6" x2="8.01" y2="6" />
      <line x1="12" y1="6" x2="12.01" y2="6" />
      <line x1="16" y1="6" x2="16.01" y2="6" />
      <line x1="8" y1="9" x2="8.01" y2="9" />
      <line x1="12" y1="9" x2="12.01" y2="9" />
      <line x1="16" y1="9" x2="16.01" y2="9" />
    </svg>
  );
}

export function AlertCircleIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function CheckCircleIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CheckIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function MailIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function InfoIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function RefreshIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

export function SearchIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function MapPinIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function TagIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export function LayersIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function UtensilsIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" />
      <line x1="15" y1="11" x2="15" y2="22" />
      <path d="M5 2v10a3 3 0 0 0 3 3h1v7h2V2" />
    </svg>
  );
}

export function WarehouseIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35a2 2 0 0 1 1.1-1.78l8-4a2 2 0 0 1 1.8 0l8 4a2 2 0 0 1 1.1 1.78Z" />
      <path d="M6 18h12" />
      <path d="M6 14h12" />
      <rect x="10" y="10" width="4" height="4" />
    </svg>
  );
}

export function EyeIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function FactoryIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4L2 6z" />
      <line x1="17" y1="18" x2="17.01" y2="18" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
      <line x1="7" y1="18" x2="7.01" y2="18" />
    </svg>
  );
}

export function ShieldCheckIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function FileTextIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function SparklesIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function GridIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ListIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function SlidersIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function LockIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function PlusIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function EditIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function TrashIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function UploadCloudIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <polyline points="16 16 12 12 8 16" />
    </svg>
  );
}

export function StarIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, filled = false, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function ArrowUpIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export function ArrowDownIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

export function PhoneIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function BookmarkIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, filled = false, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BookmarkSlashIcon({ className = 'w-5 h-5', 'aria-hidden': ariaHidden = true, ...props }) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}




