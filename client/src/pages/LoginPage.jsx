import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

/**
 * ShopFinder — Login Page Component (Task 3.8)
 *
 * Implements accessible, responsive login with client-side validation,
 * error handling, and redirection preserving protected route targets.
 * Relies strictly on httpOnly cookie session management (D-010).
 */
export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated && user) {
      const destination =
        location.state?.from?.pathname ||
        (user.role === 'owner' ? '/owner-dashboard' : '/dashboard');
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location.state]);

  const validate = () => {
    const newErrors = {};

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (errors.form) {
      setErrors((prev) => ({ ...prev, form: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const loggedInUser = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      const destination =
        location.state?.from?.pathname ||
        (loggedInUser?.role === 'owner' ? '/owner-dashboard' : '/dashboard');

      navigate(destination, { replace: true });
    } catch (err) {
      setErrors({
        form: err.message || 'Login failed. Please check your credentials and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <header className="auth-header">
          <h1>Sign In</h1>
          <p>Welcome back! Enter your details to access your account.</p>
        </header>

        {errors.form ? (
          <div className="auth-error-banner" role="alert" aria-live="assertive">
            <span>{errors.form}</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-label="Sign in form">
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="login-email">
              Email Address <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
                placeholder="you@example.com"
                className={`auth-input ${errors.email ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                required
              />
            </div>
            {errors.email ? (
              <span id="login-email-error" className="field-error" role="alert">
                {errors.email}
              </span>
            ) : null}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="login-password">
              Password <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
                placeholder="••••••••"
                className={`auth-input has-toggle ${errors.password ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={submitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password ? (
              <span id="login-password-error" className="field-error" role="alert">
                {errors.password}
              </span>
            ) : null}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-submit-btn"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create an account
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

