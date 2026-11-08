import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar.jsx';

/**
 * ShopFinder — Dashboard Layout Shell (Task 4.4)
 *
 * Provides the structural layout foundation for authenticated portals
 * (customer, owner, and admin dashboards) integrating the role-aware Sidebar.
 * Renders child dashboard views via <Outlet />.
 */
export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
