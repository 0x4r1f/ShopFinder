import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import adminService from '../services/adminService.js';
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
  RefreshIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
} from '../components/common/Icons.jsx';

/**
 * Format BDT currency.
 */
export function formatBdtPrice(price, listingType) {
  const num = Number(price) || 0;
  const formatted = `৳${num.toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${formatted}/mo` : formatted;
}

/**
 * Format submission timestamp.
 */
export function formatSubmissionDate(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

/**
 * ShopFinder — Admin Review Queue Page (Phase 7, Task 7.4)
 *
 * Displays pending commercial property submissions awaiting administrative review.
 * Provides responsive table/card layout, pagination, quick review navigation,
 * and direct moderation actions with anti-self-approval/rejection safety.
 */
export default function AdminReviewQueuePage({ initialData = null }) {
  const navigate = useNavigate();

  const [listings, setListings] = useState(initialData?.listings || null);
  const [pagination, setPagination] = useState(initialData?.pagination || null);
  const [currentPage, setCurrentPage] = useState(initialData?.pagination?.page || 1);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // In-flight action states
  const [actionInProgressId, setActionInProgressId] = useState(null);
  const [rejectModalListing, setRejectModalListing] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchQueue = useCallback(async (page = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await adminService.getPendingListings(
        { page, perPage: 10, sort: '-created' },
        { signal: controller.signal }
      );
      setListings(data.listings || []);
      setPagination(data.pagination || { page, perPage: 10, totalItems: 0, totalPages: 1 });
      setCurrentPage(data.pagination?.page || page);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      setError(err?.message || 'Failed to load pending listings review queue.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      fetchQueue(currentPage);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchQueue, currentPage, initialData]);

  // Quick Approve from queue
  const handleApprove = async (listing) => {
    if (!listing || actionInProgressId) return;

    setActionInProgressId(listing.id);
    setFeedback(null);
    setError(null);

    try {
      await adminService.approveListing(listing.id);
      setFeedback({
        type: 'success',
        message: `Listing "${listing.title}" has been approved.`,
      });
      // Remove from current queue
      setListings((prev) => (prev ? prev.filter((item) => item.id !== listing.id) : []));
      setPagination((prev) =>
        prev ? { ...prev, totalItems: Math.max(0, prev.totalItems - 1) } : prev
      );
    } catch (err) {
      setError(err?.message || 'Failed to approve listing.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Confirm Reject from modal
  const handleConfirmReject = async (rejectionNote) => {
    if (!rejectModalListing || actionInProgressId) return;

    const targetListing = rejectModalListing;
    setActionInProgressId(targetListing.id);
    setError(null);
    setFeedback(null);

    try {
      await adminService.rejectListing(targetListing.id, rejectionNote);
      setFeedback({
        type: 'success',
        message: `Listing "${targetListing.title}" has been rejected.`,
      });
      setListings((prev) => (prev ? prev.filter((item) => item.id !== targetListing.id) : []));
      setPagination((prev) =>
        prev ? { ...prev, totalItems: Math.max(0, prev.totalItems - 1) } : prev
      );
      setRejectModalListing(null);
    } catch (err) {
      setError(err?.message || 'Failed to reject listing.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (pagination && newPage > pagination.totalPages) || loading) return;
    setCurrentPage(newPage);
    fetchQueue(newPage);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* 1. Header & Identity Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Listing Review Queue
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              <ClockIcon className="w-3.5 h-3.5" />
              <span>Pending Moderation</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Commercial real estate submissions awaiting administrative verification and approval.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQueue(currentPage)}
            disabled={loading}
            className="gap-1.5"
            aria-label="Refresh review queue"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. Feedback Banners */}
      {feedback && (
        <NotificationBanner
          variant={feedback.type}
          title={feedback.type === 'success' ? 'Success' : 'Notice'}
          onClose={() => setFeedback(null)}
        >
          <p>{feedback.message}</p>
        </NotificationBanner>
      )}

      {error && (
        <NotificationBanner
          variant="error"
          title="Review Queue Error"
          onClose={() => setError(null)}
        >
          <div className="space-y-3">
            <p>{error}</p>
            <Button variant="default" size="sm" onClick={() => fetchQueue(currentPage)}>
              Try Again
            </Button>
          </div>
        </NotificationBanner>
      )}

      {/* 3. Loading State */}
      {loading && !listings && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Spinner size="lg" label="Loading pending review queue..." />
          <p className="mt-4 text-sm text-muted-foreground">
            Fetching submitted commercial properties from database...
          </p>
        </div>
      )}

      {/* 4. Empty Queue State */}
      {!loading && listings && listings.length === 0 && (
        <EmptyState
          icon={<CheckCircleIcon className="w-8 h-8 text-emerald-600" />}
          title="Review Queue is Empty"
          description="There are currently no pending commercial property submissions awaiting review. Great job staying caught up!"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin-dashboard')}
            >
              Back to Admin Dashboard
            </Button>
          }
        />
      )}

      {/* 5. Review Queue Content (Table & Mobile Cards) */}
      {listings && listings.length > 0 && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4">Property</th>
                    <th scope="col" className="py-3 px-4">Price</th>
                    <th scope="col" className="py-3 px-4">Location</th>
                    <th scope="col" className="py-3 px-4">Owner</th>
                    <th scope="col" className="py-3 px-4">Submitted</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listings.map((item) => {
                    const isActionBusy = actionInProgressId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                        data-testid="queue-item"
                      >
                        {/* Property & Cover */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {item.cover_image?.thumb_url || item.cover_image?.url ? (
                                <img
                                  src={item.cover_image.thumb_url || item.cover_image.url}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <StoreIcon className="w-5 h-5 text-muted-foreground/60" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <Link
                                to={`/admin/listings/${item.id}/review`}
                                state={{ listing: item }}
                                className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                                title={item.title}
                              >
                                {item.title}
                              </Link>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <span className="capitalize">{item.category}</span>
                                <span>•</span>
                                <span className="capitalize">{item.listing_type}</span>
                                {item.area_sqft && (
                                  <>
                                    <span>•</span>
                                    <span>{item.area_sqft.toLocaleString()} sq ft</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-foreground">
                          {formatBdtPrice(item.price, item.listing_type)}
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 text-muted-foreground">
                          <div className="flex items-center gap-1 truncate max-w-[160px]">
                            <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                            <span className="truncate">{item.area ? `${item.area}, ` : ''}{item.city}</span>
                          </div>
                        </td>

                        {/* Owner Metadata */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <p className="font-medium text-foreground flex items-center gap-1">
                              <UserIcon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                              <span className="truncate max-w-[140px]">{item.owner?.name || 'Owner'}</span>
                            </p>
                            {item.owner?.email ? (
                              <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MailIcon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate max-w-[140px]">{item.owner.email}</span>
                              </p>
                            ) : null}
                          </div>
                        </td>

                        {/* Submission Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted-foreground">
                          {formatSubmissionDate(item.created)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                            <ClockIcon className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/admin/listings/${item.id}/review`}
                              state={{ listing: item }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </Link>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(item)}
                              disabled={isActionBusy}
                              className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 gap-1"
                              title="Approve listing immediately"
                              aria-label={`Approve ${item.title}`}
                            >
                              <CheckIcon className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectModalListing(item)}
                              disabled={isActionBusy}
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                              title="Reject listing with mandatory note"
                              aria-label={`Reject ${item.title}`}
                            >
                              <CloseIcon className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-border">
              {listings.map((item) => {
                const isActionBusy = actionInProgressId === item.id;
                return (
                  <div key={item.id} className="p-4 space-y-3" data-testid="queue-item-mobile">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                        {item.cover_image?.thumb_url || item.cover_image?.url ? (
                          <img
                            src={item.cover_image.thumb_url || item.cover_image.url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <StoreIcon className="w-6 h-6 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/admin/listings/${item.id}/review`}
                          state={{ listing: item }}
                          className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {item.title}
                        </Link>
                        <p className="text-sm font-bold text-foreground mt-0.5">
                          {formatBdtPrice(item.price, item.listing_type)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPinIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.area ? `${item.area}, ` : ''}{item.city}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/30 p-2.5 rounded-lg text-xs space-y-1 text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Owner: <strong className="text-foreground">{item.owner?.name || 'Owner'}</strong></span>
                        <span>{formatSubmissionDate(item.created)}</span>
                      </div>
                      {item.owner?.email && (
                        <p className="truncate">Email: {item.owner.email}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Link
                        to={`/admin/listings/${item.id}/review`}
                        state={{ listing: item }}
                        className="flex-1 text-center py-1.5 px-3 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        Full Review
                      </Link>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(item)}
                        disabled={isActionBusy}
                        className="h-8 px-3 text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                      >
                        Approve
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectModalListing(item)}
                        disabled={isActionBusy}
                        className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20">
                <span className="text-xs text-muted-foreground text-center sm:text-left">
                  Showing Page <strong className="text-foreground">{pagination.page}</strong> of{' '}
                  <strong className="text-foreground">{pagination.totalPages}</strong> ({pagination.totalItems} total pending)
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                    className="gap-1 text-xs"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    className="gap-1 text-xs"
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Listing Modal */}
      <RejectListingModal
        isOpen={Boolean(rejectModalListing)}
        listing={rejectModalListing}
        onClose={() => setRejectModalListing(null)}
        onConfirm={handleConfirmReject}
        isSubmitting={actionInProgressId === rejectModalListing?.id}
      />
    </div>
  );
}

