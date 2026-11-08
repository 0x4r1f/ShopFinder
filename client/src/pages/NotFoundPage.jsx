import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ShopFinder — 404 Not Found Page (Task 4.3)
 */
export default function NotFoundPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h2>404 — Page Not Found</h2>
      <p>The page you are looking for does not exist or has been moved.</p>
      <Link to="/" style={{ color: 'var(--color-primary, #1e40af)', textDecoration: 'underline' }}>
        Back to Home
      </Link>
    </div>
  );
}

