import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ownerService from '../services/ownerService.js';
import PropertyForm from '../components/owner/PropertyForm.jsx';
import ImageUploader from '../components/owner/ImageUploader.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import { ArrowLeftIcon } from '../components/common/Icons.jsx';

/**
 * ShopFinder — Property Creation Page (Phase 6, Task 6.6)
 *
 * Implements Decision 1 (Unified Creation Experience):
 * 1. Collects commercial listing attributes and photo selections in a single view.
 * 2. On submit, atomically creates the listing via POST /api/v1/listings.
 * 3. Immediately uploads selected photos via POST /api/v1/listings/:id/images.
 * 4. Handles partial failures gracefully without losing the newly created listing.
 */
export default function PropertyCreatePage() {
  const navigate = useNavigate();

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  /**
   * Primary form submission handler
   */
  const handleCreateSubmit = async (formData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    let createdListing = null;

    try {
      // Step 1: Create the listing with 9 commercial attributes
      createdListing = await ownerService.createListing(formData);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to create commercial property listing');
      setIsSubmitting(false);
      return;
    }

    if (!createdListing || !createdListing.id) {
      setErrorMessage('Server did not return a valid listing record ID.');
      setIsSubmitting(false);
      return;
    }

    // Step 2: Upload images if any were selected
    if (selectedFiles && selectedFiles.length > 0) {
      try {
        await ownerService.uploadListingImages(createdListing.id, selectedFiles);

        // Success: both listing and images created
        navigate('/owner-dashboard', {
          state: {
            feedback: {
              type: 'success',
              text: `Commercial listing "${createdListing.title || 'Property'}" created successfully with ${selectedFiles.length} photo(s).`,
            },
          },
        });
      } catch (imgErr) {
        // Step 3 (Partial Failure): Listing is saved, but photos failed.
        // Navigate to edit page with clear notice so owner can manage photos directly.
        navigate(`/owner-dashboard/listings/${createdListing.id}/edit`, {
          state: {
            feedback: {
              type: 'warning',
              text: `Property details were saved, but uploading photos encountered an issue (${imgErr?.message || 'Image upload error'}). You can add photos directly here.`,
            },
          },
        });
      }
    } else {
      // Success: listing created without images
      navigate('/owner-dashboard', {
        state: {
          feedback: {
            type: 'success',
            text: `Commercial listing "${createdListing.title || 'Property'}" created successfully. It is now awaiting review.`,
          },
        },
      });
    }
  };

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
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Add New Commercial Property
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          List a new retail shop, office, warehouse, or commercial showroom. Fill in property specifications and add high-resolution photos.
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <NotificationBanner
          variant="error"
          title="Submission Error"
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </NotificationBanner>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8">
        <PropertyForm
          onSubmit={handleCreateSubmit}
          isSubmitting={isSubmitting}
          submitLabel="Create Listing"
          onCancel={() => navigate('/owner-dashboard')}
        >
          {/* Integrated Image Uploader */}
          <div className="border-t border-gray-200 pt-6">
            <ImageUploader
              mode="create"
              selectedFiles={selectedFiles}
              onFilesChange={setSelectedFiles}
              isLoading={isSubmitting}
            />
          </div>
        </PropertyForm>
      </div>
    </div>
  );
}

