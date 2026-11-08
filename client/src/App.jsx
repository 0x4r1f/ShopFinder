import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CreditProvider } from './context/CreditContext.jsx';
import ToastProvider from './components/common/Toast.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import AppRouter from './routes/AppRouter.jsx';

/**
 * ShopFinder — Application Root (Task 4.5 & Task 9.5)
 *
 * Mounts BrowserRouter -> AuthProvider -> CreditProvider -> ToastProvider -> ErrorBoundary -> AppRouter.
 * Preserves clean provider hierarchy without duplicate routers.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CreditProvider>
          <ToastProvider>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </ToastProvider>
        </CreditProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
