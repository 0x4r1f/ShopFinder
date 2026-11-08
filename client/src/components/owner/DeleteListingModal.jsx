import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button.jsx';
import { AlertCircleIcon, TrashIcon, CloseIcon } from '../common/Icons.jsx';
import Spinner from '../common/Spinner.jsx';

/**
 * ShopFinder — Delete Listing Confirmation Modal (Phase 6, Task 6.5)
 *
 * Provides an accessible, high-contrast confirmation modal before permanently
 * deleting a commercial property listing and its associated files.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object|null} props.listing - Target listing object ({ id, title })
 * @param {Function} props.onClose - Modal close handler
 * @param {Function} props.onConfirm - Deletion confirmation handler
 * @param {boolean} [props.isDeleting=false] - Deletion in-flight status
 */
export default function DeleteListingModal({
  isOpen,
  listing,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  const modalRef = useRef(null);
  const cancelBtnRef = useRef(null);

  // Focus management and Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button on mount for safety (prevent accidental confirmation)
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !listing) {
    return null;
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-card text-card-foreground rounded-xl shadow-xl border border-border p-6 space-y-5"
      >
        {/* Header with Danger Icon */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-lg font-semibold tracking-tight text-foreground">
                Delete Property Listing
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div id="delete-modal-description" className="text-sm text-muted-foreground space-y-3">
          <p>
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground font-semibold">"{listing.title}"</strong>?
          </p>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive space-y-1">
            <p className="font-semibold">Permanent Deletion Notice:</p>
            <ul className="list-disc list-inside space-y-0.5 opacity-90">
              <li>All uploaded property photos will be permanently deleted from storage.</li>
              <li>This property will be immediately removed from marketplace search and queues.</li>
            </ul>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" variant="white" label="Deleting listing..." />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <TrashIcon className="w-4 h-4" />
                <span>Delete Listing</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

