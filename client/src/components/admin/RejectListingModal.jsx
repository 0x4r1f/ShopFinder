import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button.jsx';
import { AlertCircleIcon, CloseIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

export const MAX_REJECTION_NOTE_LENGTH = 1000;

/**
 * ShopFinder — Admin Reject Listing Modal (Phase 7, Task 7.4)
 *
 * Provides an accessible modal dialog requiring an administrative rejection reason
 * before marking a commercial property listing as rejected.
 *
 * Requirements:
 * - Clear title and contextual explanation
 * - Required rejection reason textarea with live character counter (1-1000 chars)
 * - Automatic whitespace trimming
 * - Keyboard navigation (Esc to close, focus management)
 * - Anti-duplicate submission handling
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object|null} props.listing - Target listing object ({ id, title, ... })
 * @param {Function} props.onClose - Modal dismissal handler
 * @param {Function} props.onConfirm - async (rejectionNote) => Promise<void>
 * @param {boolean} [props.isSubmitting=false]
 */
export default function RejectListingModal({
  isOpen,
  listing,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const textareaRef = useRef(null);

  // Reset form state when dialog opens or target listing changes
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setError(null);
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, listing?.id]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !listing) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setNote(val);
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    const trimmed = note.trim();
    if (!trimmed) {
      setError('Rejection note is required.');
      textareaRef.current?.focus();
      return;
    }

    if (trimmed.length > MAX_REJECTION_NOTE_LENGTH) {
      setError(`Rejection note cannot exceed ${MAX_REJECTION_NOTE_LENGTH} characters.`);
      textareaRef.current?.focus();
      return;
    }

    onConfirm(trimmed);
  };

  const trimmedLength = note.trim().length;
  const isOverLimit = trimmedLength > MAX_REJECTION_NOTE_LENGTH;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-dialog-title"
      aria-describedby="reject-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-card text-card-foreground rounded-xl shadow-xl border border-border p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reject-dialog-title" className="text-lg font-semibold tracking-tight text-foreground">
                Reject Property Listing
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The owner will be notified with your feedback.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Target Listing Summary */}
        <div id="reject-dialog-desc" className="bg-muted/40 p-3.5 rounded-lg border border-border/80 text-sm">
          <span className="text-xs font-medium text-muted-foreground block mb-0.5">Property:</span>
          <span className="font-semibold text-foreground truncate block">{listing.title}</span>
          {listing.owner && (
            <span className="text-xs text-muted-foreground block mt-1">
              Owner: {listing.owner.name || 'Owner'} {listing.owner.email ? `(${listing.owner.email})` : ''}
            </span>
          )}
        </div>

        {/* Rejection Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="rejection-note" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <span
                className={`text-xs ${
                  isOverLimit
                    ? 'text-destructive font-semibold'
                    : 'text-muted-foreground'
                }`}
                aria-live="polite"
              >
                {note.length} / {MAX_REJECTION_NOTE_LENGTH}
              </span>
            </div>

            <textarea
              id="rejection-note"
              ref={textareaRef}
              rows={4}
              value={note}
              onChange={handleTextChange}
              disabled={isSubmitting}
              placeholder="Explain why this listing cannot be approved (e.g. missing trade license, blurry images, inaccurate pricing)..."
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y transition-colors ${
                error
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input focus-visible:ring-ring'
              }`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'rejection-note-error' : undefined}
            />

            {error && (
              <p id="rejection-note-error" className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting || isOverLimit || trimmedLength === 0}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="text-destructive-foreground" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

