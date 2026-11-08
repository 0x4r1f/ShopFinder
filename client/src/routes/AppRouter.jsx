import React from 'react';
import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';

import HomePage from '../pages/HomePage.jsx';
import MarketplacePage from '../pages/MarketplacePage.jsx';
import ListingDetailPage from '../pages/ListingDetailPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import SavedListingsPage from '../pages/SavedListingsPage.jsx';
import CustomerProfilePage from '../pages/CustomerProfilePage.jsx';
import CustomerRevealsPage from '../pages/CustomerRevealsPage.jsx';
import OwnerDashboardPage from '../pages/OwnerDashboardPage.jsx';
import PropertyCreatePage from '../pages/PropertyCreatePage.jsx';
import PropertyEditPage from '../pages/PropertyEditPage.jsx';
import OwnerProfilePage from '../pages/OwnerProfilePage.jsx';
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx';
import AdminReviewQueuePage from '../pages/AdminReviewQueuePage.jsx';
import AdminListingReviewPage from '../pages/AdminListingReviewPage.jsx';
import AdminUsersPage from '../pages/AdminUsersPage.jsx';
import PricingPage from '../pages/PricingPage.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import AboutPage from '../pages/AboutPage.jsx';
import TermsPage from '../pages/TermsPage.jsx';
import PrivacyPage from '../pages/PrivacyPage.jsx';
import ContactPage from '../pages/ContactPage.jsx';
import FaqPage from '../pages/FaqPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

/**
 * ShopFinder — Application Router Hierarchy (Task 4.3 & Task 5.1)
 *
 * Configures the centralized React Router v6 layout hierarchy using nested routes.
 *
 * Route Branches:
 * 1. Public / Main Layout (MainLayout):
 *    - / -> HomePage
 *    - /marketplace -> MarketplacePage (Task 5.2)
 *    - /listings -> Redirect to /marketplace (D-002)
 *    - /listings/:id -> Property Details Page (Task 5.5)
 * 2. Auth Layout (AuthLayout):
 *    - /login -> LoginPage
 *    - /register -> RegisterPage
 * 3. Protected Dashboard Layout (DashboardLayout):
 *    - /dashboard -> Customer Dashboard (customer role only)
 *    - /owner-dashboard -> Owner Portal (owner & admin roles only)
 * 4. Fallback:
 *    - * -> NotFoundPage
 */
export default function AppRouter() {
  return (
    <Routes>
      {/* 1. Public / Main Layout Branch */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={['customer', 'owner']}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/listings" element={<Navigate to="/marketplace" replace />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
      </Route>

      {/* 2. Authentication Layout Branch */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* 3. Protected Dashboard Layout Branch */}
      <Route element={<DashboardLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/saved"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <SavedListingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/reveals"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerRevealsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={['owner', 'admin']}>
              <OwnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner-dashboard/listings/new"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <PropertyCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner-dashboard/listings/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <PropertyEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner-dashboard/profile"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/review-queue"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/listings/:id/review"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminListingReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 4. Catch-all 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

