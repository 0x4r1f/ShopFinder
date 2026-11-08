import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import ownerService from '../services/ownerService.js';
import PropertyForm from '../components/owner/PropertyForm.jsx';
import ImageUploader from '../components/owner/ImageUploader.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { ArrowLeftIcon, AlertCircleIcon, ShieldCheckIcon } from '../components/common/Icons.jsx';

/**
 * ShopFinder — Property Edit Page (Phase 6, Task 6.6)
 *
 * Implements:
 * 1. Safe listing data retrieval via GET /api/v1/listings/:id.
 * 2. D-002 Status Re-approval Notice: Displays prominent warning if status is 'approved'.
 * 3. Delta-only property attribute patching via PATCH /api/v1/listings/:id.
 * 4. Image management (upload, delete, set cover, left/right reordering).
 */
export default function PropertyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // State Management
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Initial feedback from location state (e.g. from create page partial failure)
  const [locationFeedback, setLocationFeedback] = useState(location.state?.feedback || null);

  const abortControllerRef = useRef(null);

  /**
   * Fetch listing data
   */
  const loadListingData = useCallback(async () => {
    if (!id) {
      setLoadError('Invalid listing ID');
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await ownerService.getListingForEdit(id, { signal: controller.signal });
      if (!data) {
        setLoadError('Listing not found or you do not have permission to edit it.');
      } else {
        setListing(data);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setLoadError(err?.message || 'Failed to load listing information.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadListingData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadListingData]);

  /**
   * Handle Property Specifications Update (Delta PATCH)
   */
  const handleUpdateDetails = async (formData) => {
    if (!listing) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Compute changed fields only (delta)
    const permittedFields = [
      'title',
      'description',
      'category',
      'listing_type',
      'price',
      'area_sqft',
      'address',
      'city',
      'area',
    ];

    const delta = {};
    for (const field of permittedFields) {
      if (formData[field] !== undefined) {
        const originalVal = listing[field];
        const newVal = formData[field];

        // Compare numbers vs strings safely
        if (field === 'price' || field === 'area_sqft') {
          if (Number(originalVal) !== Number(newVal)) {
            delta[field] = Number(newVal);
          }
        } else {
          if (String(originalVal || '').trim() !== String(newVal || '').trim()) {
            delta[field] = newVal;
          }
        }
      }
    }

    if (Object.keys(delta).length === 0) {
      setSuccessMessage('No changes detected in property specifications.');
      return;
    }

    setIsSavingDetails(true);

    try {
      const updated = await ownerService.updateListing(id, delta);
      setListing((prev) => ({
        ...prev,
        ...updated,
        // Preserve existing images array if update response didn't re-expand
        images: updated?.images || prev.images || [],
      }));

      const isReapprovedNotice =
        listing.status === 'approved'
          ? ' Changes submitted. Per marketplace policy, this listing has returned to Pending Review for moderation.'
          : '';

      setSuccessMessage(`Listing specifications updated successfully.${isReapprovedNotice}`);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to update listing specifications.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  /**
   * Image Action: Upload New Images
   */
  const handleUploadImages = async (files) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await ownerService.uploadListingImages(id, files);
    const updatedImages = result?.images || [];

    setListing((prev) => ({
      ...prev,
      images: updatedImages,
      // If listing was approved, D-002 reverts status to pending
      status: prev.status === 'approved' ? 'pending' : prev.status,
    }));

    setSuccessMessage(`Successfully uploaded ${files.length} photo(s).`);
  };

  /**
   * Image Action: Delete Image
   */
  const handleDeleteImage = async (imageId) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    await ownerService.deleteListingImage(id, imageId);

    // Refresh remaining images or update state
    setListing((prev) => {
      const remaining = (prev.images || []).filter((img) => img.id !== imageId);
      // If deleted image was cover, backend automatically promotes the first remaining image
      const hadCover = remaining.some((img) => img.is_cover);
      if (!hadCover && remaining.length > 0) {
        remaining[0] = { ...remaining[0], is_cover: true };
      }

      return {
        ...prev,
        images: remaining,
        status: prev.status === 'approved' ? 'pending' : prev.status,
      };
    });

    setSuccessMessage('Photo deleted successfully.');
  };

  /**
   * Image Action: Set Cover Image
   */
  const handleSetCover = async (imageId) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await ownerService.setCoverListingImage(id, imageId);
    const updatedImages = result?.images || [];

    setListing((prev) => ({
      ...prev,
      images: updatedImages.length > 0 ? updatedImages : (prev.images || []).map((img) => ({
        ...img,
        is_cover: img.id === imageId,
      })),
      status: prev.status === 'approved' ? 'pending' : prev.status,
    }));

    setSuccessMessage('Cover photo updated successfully.');
  };

  /**
   * Image Action: Reorder Images
   */
  const handleReorderImages = async (newOrderIds) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await ownerService.reorderListingImages(id, newOrderIds);
    const updatedImages = result?.images || [];

    setListing((prev) => {
      let finalImages = updatedImages;
      if (!finalImages || finalImages.length === 0) {
        // Fallback local reorder
        const map = new Map((prev.images || []).map((img) => [img.id, img]));
        finalImages = newOrderIds.map((imgId) => map.get(imgId)).filter(Boolean);
      }
      return {
        ...prev,
        images: finalImages,
        status: prev.status === 'approved' ? 'pending' : prev.status,
      };
    });

    setSuccessMessage('Photo display order updated successfully.');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Spinner size="lg" label="Loading listing..." />
        <p className="mt-3 text-sm text-gray-500">Loading commercial property details...</p>
      </div>
    );
  }

  if (loadError || !listing) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-4">
        <NotificationBanner variant="error" title="Unable to Load Listing">
          {loadError || 'Listing could not be found.'}
        </NotificationBanner>
        <div className="pt-2">
          <Link
            to="/owner-dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Return to Owner Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const isApproved = listing.status === 'approved';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation Header */}
      <div>
        <Link
          to="/owner-dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to My Listings</span>
        </Link>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Edit Commercial Listing
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Update property specifications, photos, and commercial details for "{listing.title}".
            </p>
          </div>

          {/* Current Status Pill */}
          <div className="shrink-0">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                listing.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : listing.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              Current Status: {listing.status}
            </span>
          </div>
        </div>
      </div>

      {/* D-002 Approved Policy Warning Notice */}
      {isApproved && (
        <div
          role="region"
          aria-label="Re-approval Notice"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5 flex items-start gap-3 shadow-xs"
        >
          <div className="shrink-0 mt-0.5">
            <AlertCircleIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold text-amber-900">Notice: Listing Re-Approval Policy (D-002)</p>
            <p>
              This listing is currently active on the marketplace. Any edits to property specifications
              or photos will automatically submit this listing for administrative review (status reverts to Pending Review).
            </p>
          </div>
        </div>
      )}

      {/* Location / Prior Step Feedback Banner */}
      {locationFeedback && (
        <NotificationBanner
          variant={locationFeedback.type === 'error' ? 'error' : locationFeedback.type === 'warning' ? 'warning' : 'success'}
          onClose={() => setLocationFeedback(null)}
        >
          {locationFeedback.text}
        </NotificationBanner>
      )}

      {/* General Error Banner */}
      {errorMessage && (
        <NotificationBanner
          variant="error"
          title="Update Error"
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </NotificationBanner>
      )}

      {/* General Success Banner */}
      {successMessage && (
        <NotificationBanner
          variant="success"
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </NotificationBanner>
      )}

      {/* Section 1: Property Specifications Form */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
          Property Specifications
        </h2>
        <PropertyForm
          initialData={listing}
          onSubmit={handleUpdateDetails}
          isSubmitting={isSavingDetails}
          submitLabel="Save Changes"
          onCancel={() => navigate('/owner-dashboard')}
        />
      </div>

      {/* Section 2: Property Photos Management */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8">
        <ImageUploader
          mode="edit"
          existingImages={listing.images || []}
          onUploadImages={handleUploadImages}
          onDeleteImage={handleDeleteImage}
          onSetCover={handleSetCover}
          onReorder={handleReorderImages}
          isLoading={false}
        />
      </div>
    </div>
  );
}

