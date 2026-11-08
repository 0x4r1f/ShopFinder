import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import adminService from '../services/adminService.js';
import listingService from '../services/listingService.js';
import { Button } from '../components/ui/button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import NotificationBanner from '../components/common/NotificationBanner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import RejectListingModal from '../components/admin/RejectListingModal.jsx';
import {
  ShieldCheckIcon,
  StoreIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  MailIcon,
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  AlertCircleIcon,
  InfoIcon,
} from '../components/common/Icons.jsx';
import { formatBdtPrice, formatSubmissionDate } from './AdminReviewQueuePage.jsx';

/**
 * ShopFinder — Admin Listing Review Details Page (Phase 7, Task 7.4)
 *
 * Full commercial property review interface for platform administrators.
 * Displays:
 * 1. Title, description, price (BDT), area (sq ft), address, city, area.
 * 2. Category & listing type badges.
 * 3. Safe owner profile (name, email, member since) — strictly no phone numbers (D-014).
 * 4. Full image gallery with cover indicators and thumbnail switcher.
 * 5. Moderation actions: Approve and Reject (with required reason modal).
 * 6. Non-pending status detection and anti-self-approval/rejection safety.
 */
export default function AdminListingReviewPage({ initialListing = null }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Initial listing can come from prop, location state, or null
  const passedListing =
    initialListing ||
    (id && location?.state?.listing?.id === id ? location.state.listing : null);

  const [listing, setListing] = useState(passedListing);
  const [loading, setLoading] = useState(!passedListing);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // In-flight moderation state
  const [isApproving, setIsApproving] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Gallery active preview index
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const abortControllerRef = useRef(null);

  const fetchListing = useCallback(async () => {
    if (!id) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await listingService.getListingById(id, { signal: controller.signal });
      if (!data) {
        setNotFound(true);
        return;
      }

      // Merge owner email if passed from pending list (since public getListingById sanitizes email)
      const mergedOwner = {
        ...(data.owner || {}),
        email: passedListing?.owner?.email || data.owner?.email || '',
      };

      setListing({
        ...data,
        owner: mergedOwner,
      });
      setActiveImageIdx(0);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      if (err?.status === 404 || err?.message?.toLowerCase().includes('not found')) {
        setNotFound(true);
      } else {
        setError(err?.message || 'Failed to load property details for review.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [id, passedListing?.owner?.email]);

  useEffect(() => {
    fetchListing();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchListing]);

  // Handle Approve Action
  const handleApprove = async () => {
    if (!listing || isApproving || isRejecting) return;

    setIsApproving(true);
    setFeedback(null);

    try {
      await adminService.approveListing(listing.id);
      setListing((prev) => (prev ? { ...prev, status: 'approved', rejection_note: null } : null));
      setFeedback({
        type: 'success',
        message: `Property "${listing.title}" has been approved successfully.`,
      });
    } catch (err) {
      let msg = err?.message || 'Failed to approve listing.';
      if (err?.status === 403 || msg.toLowerCase().includes('own listing')) {
        msg = 'Administrators cannot approve their own listings.';
      }
      setFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Reject Action
  const handleRejectConfirm = async (rejectionNote) => {
    if (!listing || isRejecting || isApproving) return;

    setIsRejecting(true);
    setFeedback(null);

    try {
      await adminService.rejectListing(listing.id, rejectionNote);
      setListing((prev) =>
        prev ? { ...prev, status: 'rejected', rejection_note: rejectionNote } : null
      );
      setIsRejectModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Property "${listing.title}" has been rejected.`,
      });
    } catch (err) {
      let msg = err?.message || 'Failed to reject listing.';
      if (err?.status === 403 || msg.toLowerCase().includes('own listing')) {
        msg = 'Administrators cannot reject their own listings.';
      }
      setFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Render Loading
  if (loading && !listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading listing details for review...
        </p>
      </div>
    );
  }

  // Render 404 Not Found
  if (notFound) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          to="/admin/review-queue"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Review Queue</span>
        </Link>
        <EmptyState
          title="Listing Not Found"
          description="The requested commercial listing could not be found or has been permanently removed."
          actionLabel="Back to Review Queue"
          onAction={() => navigate('/admin/review-queue')}
        />
      </div>
    );
  }

  // Render Error
  if (error && !listing) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          to="/admin/review-queue"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Review Queue</span>
        </Link>
        <NotificationBanner
          type="error"
          message={error}
          actionLabel="Try Again"
          onAction={fetchListing}
        />
      </div>
    );
  }

  if (!listing) return null;

  // Resolve image list (prefer listing.images array, fallback to cover_image)
  const images = Array.isArray(listing.images) && listing.images.length > 0
    ? listing.images
    : listing.cover_image
    ? [listing.cover_image]
    : [];

  const activeImage = images[activeImageIdx] || images[0] || null;
  const isPending = listing.status === 'pending';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <Link
          to="/admin/review-queue"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Review Queue</span>
        </Link>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Current Status:</span>
          {listing.status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <ClockIcon className="w-3.5 h-3.5" />
              Pending Review
            </span>
          ) : listing.status === 'approved' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckIcon className="w-3.5 h-3.5" />
              Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
              <CloseIcon className="w-3.5 h-3.5" />
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {feedback && (
        <NotificationBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Non-Pending Warning Banner */}
      {!isPending && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <InfoIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Listing Moderation Completed</p>
            <p className="text-xs opacity-90">
              This property has already been moderated (Status: <strong className="uppercase">{listing.status}</strong>).
              Approval and rejection actions are only permitted on listings currently in <strong className="uppercase">pending</strong> status.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Note (if rejected) */}
      {listing.status === 'rejected' && listing.rejection_note && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
          <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Rejection Feedback Given to Owner</p>
            <p className="text-xs text-foreground bg-background/80 p-3 rounded border border-border whitespace-pre-wrap">
              {listing.rejection_note}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Details Left, Review Actions & Owner Info Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 cols on large screen): Media & Core Listing Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery Card */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold">Photo Gallery</h2>
              <span className="text-xs text-muted-foreground">
                {images.length} {images.length === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>

            {images.length > 0 ? (
              <div className="p-4 space-y-4">
                {/* Main Large Preview */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border/60">
                  <img
                    src={activeImage?.url || activeImage?.thumb_url}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                  {activeImage?.is_cover && (
                    <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                      Cover Image
                    </span>
                  )}
                </div>

                {/* Thumbnails Strip */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <button
                        key={img.id || idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={`relative w-20 h-16 rounded-md overflow-hidden shrink-0 border-2 transition-all ${
                          idx === activeImageIdx
                            ? 'border-primary ring-2 ring-primary/20 scale-102'
                            : 'border-border/60 opacity-75 hover:opacity-100 hover:border-primary/50'
                        }`}
                        aria-label={`View photo ${idx + 1}`}
                      >
                        <img
                          src={img.thumb_url || img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {img.is_cover && (
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-medium text-center py-0.5">
                            Cover
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-muted/20">
                <StoreIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No Photos Uploaded</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The property owner did not attach any images to this listing.
                </p>
              </div>
            )}
          </div>

          {/* Property Specifications Card */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-6 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                  {listing.category}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase">
                  For {listing.listing_type}
                </span>
                {listing.is_featured && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Featured
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {listing.title}
              </h1>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                <MapPinIcon className="w-4 h-4 shrink-0 text-muted-foreground/80" />
                <span>
                  {listing.address ? `${listing.address}, ` : ''}
                  {listing.area ? `${listing.area}, ` : ''}
                  {listing.city}
                </span>
              </div>
            </div>

            {/* Key Commercial Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border/80">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Price</span>
                <span className="text-lg font-bold text-foreground block mt-0.5">
                  {formatBdtPrice(listing.price, listing.listing_type)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Floor Area</span>
                <span className="text-lg font-bold text-foreground block mt-0.5">
                  {listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString()} sq ft` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Type</span>
                <span className="text-lg font-bold text-foreground block mt-0.5 capitalize">
                  {listing.listing_type === 'rent' ? 'Commercial Lease' : 'Outright Sale'}
                </span>
              </div>
            </div>

            {/* Full Property Description */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Full Description
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {listing.description || 'No detailed description provided by the owner.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Moderation Action Panel & Owner Information */}
        <div className="space-y-6">
          {/* Moderation Actions Card */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold">Moderation Decision</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Review property details, pricing, and images against platform quality standards.
            </p>

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                variant="default"
                disabled={!isPending || isApproving || isRejecting}
                onClick={handleApprove}
                className="w-full flex items-center justify-center gap-2 font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isApproving ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    <span>Approve Listing</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="destructive"
                disabled={!isPending || isApproving || isRejecting}
                onClick={() => setIsRejectModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 font-medium"
              >
                {isRejecting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <CloseIcon className="w-4 h-4" />
                    <span>Reject Listing</span>
                  </>
                )}
              </Button>
            </div>

            {!isPending && (
              <p className="text-[11px] text-muted-foreground text-center italic">
                Moderation completed. Actions are disabled.
              </p>
            )}
          </div>

          {/* Owner Details Card (D-014 Safe: Name & Email Only) */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Property Owner</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Name</span>
                <span className="font-semibold text-foreground block">
                  {listing.owner?.name || 'Owner'}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block font-medium">Email Address</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-foreground">
                  <MailIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate">{listing.owner?.email || 'Not provided'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block font-medium">Submission Date</span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {formatSubmissionDate(listing.created)}
                </span>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground leading-normal italic">
                  Owner contact details and numbers are securely protected under D-014 privacy policy and are never exposed in administrative reviews.
                </p>
              </div>
            </div>
          </div>

          {/* Listing Metadata Card */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs p-6 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Record Metadata
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Listing ID:</span>
                <span className="font-mono text-foreground">{listing.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span>{formatSubmissionDate(listing.created)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{formatSubmissionDate(listing.updated)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Listing Modal */}
      <RejectListingModal
        isOpen={isRejectModalOpen}
        listing={listing}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleRejectConfirm}
        isSubmitting={isRejecting}
      />
    </div>
  );
}
