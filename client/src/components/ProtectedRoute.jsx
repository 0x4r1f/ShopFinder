import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ShopFinder — Role-Aware Protected Route Guard Component (Task 3.7)
 *
 * Prevents unauthorized or unauthenticated access to protected routes.
 * Differentiates unauthenticated sessions from backend server outages.
 *
 * @param {Object} props
 * @param {string[]|string} [props.allowedRoles] - Optional allowed roles ('customer', 'owner', 'admin')
 * @param {React.ReactNode} [props.children] - Child elements to render if authorized
 * @param {React.ReactNode} [props.loadingFallback] - Custom loading component during hydration
 * @param {string} [props.redirectTo='/login'] - Redirect target for unauthenticated users
 */
export default function ProtectedRoute({
  allowedRoles,
  children,
  loadingFallback = (
    <div
      style={{
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p>Loading session...</p>
    </div>
  ),
  redirectTo = '/login',
}) {
  const { user, loading, isAuthenticated, error } = useAuth();
  const location = useLocation();

  // 1. Wait until initial session hydration finishes to prevent flashing protected content
  if (loading) {
    return loadingFallback;
  }

  // 2. If hydration failed due to a temporary backend outage or network error,
  // do NOT falsely redirect the user to /login; display service unavailable with retry
  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2>Service Temporarily Unavailable</h2>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // 3. Redirect genuinely unauthenticated users to login, preserving intended destination
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 4. Verify role authorization if allowedRoles restriction is specified
  if (allowedRoles) {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(user.role)) {
      return (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2>Access Denied</h2>
          <p>You do not have permission to access this page.</p>
        </div>
      );
    }
  }

  // 5. User is authenticated and authorized — render children or child routes
  return children ? children : <Outlet />;
}
