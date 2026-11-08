import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import Footer from '../components/layout/Footer.jsx';

/**
 * ShopFinder — Main Layout Shell (Task 4.4)
 *
 * Provides the global layout foundation for public marketplace pages,
 * rendering the role-aware Header, child routes via <Outlet />, and responsive Footer.
 */
export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
