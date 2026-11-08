import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ownerService from '../services/ownerService.js';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { Button } from '../components/ui/button.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import Spinner from '../components/common/Spinner.jsx';
import {
  ArrowLeftIcon,
  LockIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
  CloseIcon,
  CheckIcon,
} from '../components/common/Icons.jsx';

export const PHONE_REGEX = /^\+?[0-9\s-]{6,30}$/;
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

/**
 * Format ISO date string into readable "Month Year" format (e.g. "November 2026")
 */
export function formatMemberSince(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * ShopFinder — Owner Business Profile Management Page (Phase 6, Task 6.7)
 *
 * Provides commercial property owners with a secure profile management interface:
 * 1. Business / Display Name management.
 * 2. Avatar / Business Logo upload with client-side preview & 5 MB limit.
 * 3. Contact phone number management with D-014 privacy notice.
 * 4. Read-only account overview (Email, Role, Member Since).
 */
export default function OwnerProfilePage({ initialProfile = null }) {
  const { user: authUser, updateUser } = useAuth();

  // State Management
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(!initialProfile);
  const [loadError, setLoadError] = useState(null);

  // Form Fields
  const [name, setName] = useState(initialProfile?.name || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Validation & Submission States
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Fetch current owner profile
   */
  const loadProfile = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await ownerService.getOwnerProfile({ signal: controller.signal });
      if (!data) {
        setLoadError('Failed to load profile data.');
      } else {
        setProfile(data);
        setName(data.name || '');
        setPhone(data.phone || '');
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setLoadError(err?.message || 'Failed to retrieve your business profile.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadProfile();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadProfile]);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (avatarPreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  /**
   * Handle avatar file selection
   */
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const errors = {};

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      errors.avatar = 'Invalid file format. Only JPEG, PNG, WebP, and SVG images are allowed.';
    } else if (file.size > MAX_AVATAR_SIZE_BYTES) {
      errors.avatar = 'Avatar image exceeds the 5 MB limit.';
    }

    if (errors.avatar) {
      setFieldErrors((prev) => ({ ...prev, avatar: errors.avatar }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clear avatar error if valid
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.avatar;
      return next;
    });

    if (avatarPreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(avatarPreview);
    }

    const previewUrl =
      typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  };

  /**
   * Reset local avatar selection (does not delete server avatar)
   */
  const handleResetAvatar = () => {
    if (avatarPreview && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.avatar;
      return next;
    });
  };

  /**
   * Validate form inputs before submission
   */
  const validateForm = () => {
    const errs = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errs.name = 'Business or display name is required';
    } else if (trimmedName.length > 255) {
      errs.name = 'Name cannot exceed 255 characters';
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 6 || trimmedPhone.length > 30) {
        errs.phone = 'Phone number must be between 6 and 30 characters';
      } else if (!PHONE_REGEX.test(trimmedPhone)) {
        errs.phone = 'Invalid phone number format. Only digits, spaces, hyphens, and optional leading + are allowed.';
      }
    }

    return errs;
  };

  /**
   * Submit profile updates
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    // Check if any change actually occurred
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const originalName = (profile?.name || '').trim();
    const originalPhone = (profile?.phone || '').trim();

    const nameChanged = trimmedName !== originalName;
    const phoneChanged = trimmedPhone !== originalPhone;
    const hasNewAvatar = Boolean(avatarFile);

    if (!nameChanged && !phoneChanged && !hasNewAvatar) {
      setSuccessMessage('No changes detected to update.');
      return;
    }

    setIsSaving(true);

    try {
      let updatedData = null;

      if (hasNewAvatar) {
        // Use FormData for multipart file upload
        const formData = new FormData();
        if (nameChanged) formData.append('name', trimmedName);
        if (phoneChanged) formData.append('phone', trimmedPhone);
        formData.append('avatar', avatarFile);

        updatedData = await ownerService.updateOwnerProfile(formData);
      } else {
        // Plain JSON object update
        const payload = {};
        if (nameChanged) payload.name = trimmedName;
        if (phoneChanged) payload.phone = trimmedPhone;

        updatedData = await ownerService.updateOwnerProfile(payload);
      }

      if (updatedData) {
        setProfile(updatedData);
        setName(updatedData.name || '');
        setPhone(updatedData.phone || '');
        handleResetAvatar();

        // Update auth context so Header/Sidebar display the updated name
        if (updateUser) {
          updateUser({
            ...authUser,
            name: updatedData.name,
            avatar: updatedData.avatar,
          });
        }

        setSuccessMessage('Business profile updated successfully.');
      }
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to update business profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Spinner size="lg" label="Loading business profile..." />
        <p className="mt-3 text-sm text-gray-500">Loading your commercial owner profile...</p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-4">
        <NotificationBanner variant="error" title="Profile Unavailable">
          {loadError || 'Unable to load owner profile.'}
        </NotificationBanner>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={loadProfile} variant="default" size="sm">
            Retry
          </Button>
          <Link
            to="/owner-dashboard"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentAvatarSrc = avatarPreview || profile.avatar_url || null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation Header */}
      <div>
        <Link
          to="/owner-dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Business Profile
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your commercial property owner identity and secure contact phone number.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
              Verified Property Owner
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <NotificationBanner
          variant="error"
          title="Update Error"
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </NotificationBanner>
      )}

      {successMessage && (
        <NotificationBanner
          variant="success"
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </NotificationBanner>
      )}

      {/* Account Identity Card (Read-Only Credentials) */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-3 mb-4">
          Account Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {/* Email */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MailIcon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Login Email</span>
            </div>
            <p className="font-semibold text-gray-900 truncate" title={profile.email}>
              {profile.email}
            </p>
            <span className="text-[11px] text-gray-500">Read-only account credential</span>
          </div>

          {/* Account Role */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <ShieldCheckIcon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Account Role</span>
            </div>
            <p className="font-semibold text-gray-900 capitalize">
              {profile.role || 'Owner'}
            </p>
            <span className="text-[11px] text-gray-500">Commercial Seller / Landlord</span>
          </div>

          {/* Member Since */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <UserIcon className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Member Since</span>
            </div>
            <p className="font-semibold text-gray-900">
              {formatMemberSince(profile.created)}
            </p>
            <span className="text-[11px] text-gray-500">Verified Marketplace Partner</span>
          </div>
        </div>
      </div>

      {/* D-014 Contact Phone Privacy Notice */}
      <div
        role="region"
        aria-label="Contact Privacy Notice"
        className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 sm:p-5 flex items-start gap-3 shadow-xs"
      >
        <div className="shrink-0 mt-0.5">
          <LockIcon className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="text-sm text-emerald-900 space-y-1">
          <p className="font-semibold">Privacy Policy (D-014): Protected Owner Contact Information</p>
          <p className="text-xs sm:text-sm text-emerald-800">
            Your contact phone number is stored privately and is not exposed in public property listings.
            Customers can access it only through the authorized contact reveal system.
          </p>
        </div>
      </div>

      {/* Main Profile Edit Form Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-3 mb-6">
          Edit Business Profile Details
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-gray-200">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full border-2 border-emerald-500 overflow-hidden bg-gray-100 flex items-center justify-center shadow-xs">
                {currentAvatarSrc ? (
                  <img
                    src={currentAvatarSrc}
                    alt="Business Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-gray-400">
                    {name ? name.charAt(0).toUpperCase() : <UserIcon className="w-8 h-8" />}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 flex-1">
              <div>
                <Label htmlFor="avatar-file-input" className="text-sm font-medium">
                  Profile Picture / Business Logo
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  JPEG, PNG, WebP, or SVG up to 5 MB.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  id="avatar-file-input"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="inline-flex items-center gap-1.5"
                >
                  <UploadCloudIcon className="w-4 h-4 text-emerald-600" />
                  <span>{avatarFile ? 'Change Photo' : 'Upload Photo'}</span>
                </Button>

                {avatarFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleResetAvatar}
                    className="text-xs text-gray-600 hover:text-red-600 inline-flex items-center gap-1"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                    <span>Reset Selection</span>
                  </Button>
                )}
              </div>

              {fieldErrors.avatar && (
                <span role="alert" className="text-xs text-destructive font-medium block">
                  {fieldErrors.avatar}
                </span>
              )}
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Business / Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="field-owner-name" className="text-sm font-medium">
                Business / Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-owner-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.name;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Acme Commercial Properties Ltd."
                disabled={isSaving}
                maxLength={255}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'field-name-error' : undefined}
                className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.name ? (
                <span id="field-name-error" role="alert" className="text-xs text-destructive font-medium block">
                  {fieldErrors.name}
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  Visible to potential tenants and buyers on property listings.
                </span>
              )}
            </div>

            {/* Contact Phone Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="field-owner-phone" className="text-sm font-medium">
                  Contact Phone Number
                </Label>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  D-014 Private
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <PhoneIcon className="w-4 h-4" />
                </div>
                <Input
                  id="field-owner-phone"
                  name="phone"
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.phone;
                        return next;
                      });
                    }
                  }}
                  placeholder="e.g. +880 1712-345678"
                  disabled={isSaving}
                  maxLength={30}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'field-phone-error' : undefined}
                  className={`pl-9 ${fieldErrors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
              </div>
              {fieldErrors.phone ? (
                <span id="field-phone-error" role="alert" className="text-xs text-destructive font-medium block">
                  {fieldErrors.phone}
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  Used exclusively for authorized customer contact reveals (6–30 characters).
                </span>
              )}
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Link to="/owner-dashboard">
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={isSaving}
              className="min-w-[130px] inline-flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" variant="white" label="Saving profile..." />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
