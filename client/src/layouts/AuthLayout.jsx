import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * ShopFinder — Authentication Layout Shell (Task 4.3)
 *
 * Provides a focused, uncluttered container for login and registration views.
 * Renders nested authentication routes via <Outlet />.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background text-foreground">
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
}

