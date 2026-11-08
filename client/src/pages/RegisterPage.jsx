import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

/**
 * ShopFinder — Registration Page Component (Task 3.8)
 *
 * Implements accessible, responsive registration with role selection (customer/owner only),
 * client-side validation, error handling, and redirection.
 * Relies strictly on httpOnly cookie session management (D-010).
 */
export default function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'customer', // Default role: 'customer' or 'owner' (Admin is strictly excluded)
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = user.role === 'owner' ? '/owner-dashboard' : '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validate = () => {
    const newErrors = {};

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = 'Full name is required.';
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!['customer', 'owner'].includes(formData.role)) {
      newErrors.role = 'Please select a valid account role (Customer or Property Owner).';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }

    if (!formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Please confirm your password.';
    } else if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Passwords do not match.';
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
      const newUser = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
        role: formData.role,
      });

      const destination = newUser?.role === 'owner' ? '/owner-dashboard' : '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setErrors({
        form: err.message || 'Registration failed. Please check your details and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <header className="auth-header">
          <h1>Create an Account</h1>
          <p>Join ShopFinder to discover or list commercial properties.</p>
        </header>

        {errors.form ? (
          <div className="auth-error-banner" role="alert" aria-live="assertive">
            <span>{errors.form}</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-label="Registration form">
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="register-name">
              Full Name <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                disabled={submitting}
                placeholder="Rahim Ahmed"
                className={`auth-input ${errors.name ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'register-name-error' : undefined}
                required
              />
            </div>
            {errors.name ? (
              <span id="register-name-error" className="field-error" role="alert">
                {errors.name}
              </span>
            ) : null}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label htmlFor="register-email">
              Email Address <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
                placeholder="you@example.com"
                className={`auth-input ${errors.email ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
                required
              />
            </div>
            {errors.email ? (
              <span id="register-email-error" className="field-error" role="alert">
                {errors.email}
              </span>
            ) : null}
          </div>

          {/* Account Role Selection */}
          <div className="form-group">
            <label id="role-group-label">
              I want to <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div
              className="role-radio-group"
              role="radiogroup"
              aria-labelledby="role-group-label"
            >
              <label
                className={`role-radio-card ${formData.role === 'customer' ? 'is-selected' : ''} ${
                  submitting ? 'is-disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="customer"
                  checked={formData.role === 'customer'}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="role-title">Find Spaces</span>
                <span className="role-description">Browse and discover commercial properties</span>
              </label>

              <label
                className={`role-radio-card ${formData.role === 'owner' ? 'is-selected' : ''} ${
                  submitting ? 'is-disabled' : ''
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={formData.role === 'owner'}
                  onChange={handleChange}
                  disabled={submitting}
                />
                <span className="role-title">List Spaces</span>
                <span className="role-description">Post shops, offices, and commercial plots</span>
              </label>
            </div>
            {errors.role ? (
              <span id="register-role-error" className="field-error" role="alert">
                {errors.role}
              </span>
            ) : null}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="register-password">
              Password <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
                placeholder="At least 8 characters"
                className={`auth-input has-toggle ${errors.password ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
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
              <span id="register-password-error" className="field-error" role="alert">
                {errors.password}
              </span>
            ) : null}
          </div>

          {/* Password Confirmation */}
          <div className="form-group">
            <label htmlFor="register-password-confirm">
              Confirm Password <span className="required-mark" aria-hidden="true">*</span>
            </label>
            <div className="input-wrapper">
              <input
                id="register-password-confirm"
                name="passwordConfirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.passwordConfirm}
                onChange={handleChange}
                disabled={submitting}
                placeholder="Re-type your password"
                className={`auth-input has-toggle ${errors.passwordConfirm ? 'has-error' : ''}`}
                aria-invalid={Boolean(errors.passwordConfirm)}
                aria-describedby={errors.passwordConfirm ? 'register-password-confirm-error' : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPasswordConfirm((prev) => !prev)}
                disabled={submitting}
                aria-label={showPasswordConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
              >
                {showPasswordConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.passwordConfirm ? (
              <span id="register-password-confirm-error" className="field-error" role="alert">
                {errors.passwordConfirm}
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
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

