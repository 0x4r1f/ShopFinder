import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button.jsx';
import Spinner from '../common/Spinner.jsx';
import {
  UploadCloudIcon,
  TrashIcon,
  StarIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
} from '../common/Icons.jsx';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_AGGREGATE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_IMAGES_PER_LISTING = 20;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Format bytes to readable string (e.g., "1.4 MB")
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Validates a batch of files against format, size, and total capacity constraints.
 *
 * @param {Array<File>} newFiles - Files being added
 * @param {number} currentCount - Current count of existing/selected images
 * @returns {{ validFiles: Array<File>, errors: Array<string> }}
 */
export function validateImageFiles(newFiles, currentCount = 0) {
  const errors = [];
  const validFiles = [];

  if (currentCount + newFiles.length > MAX_IMAGES_PER_LISTING) {
    const slotsRemaining = Math.max(0, MAX_IMAGES_PER_LISTING - currentCount);
    errors.push(
      `Cannot add ${newFiles.length} image${newFiles.length > 1 ? 's' : ''}. Maximum ${MAX_IMAGES_PER_LISTING} images allowed (${slotsRemaining} slot${slotsRemaining === 1 ? '' : 's'} remaining).`
    );
    return { validFiles: [], errors };
  }

  let totalSize = 0;

  for (const file of newFiles) {
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

    if (!isValidMime && !isValidExt) {
      errors.push(`"${file.name}" has an unsupported format. Only JPEG, PNG, and WebP are allowed.`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}" exceeds the 5 MB limit (${formatBytes(file.size)}).`);
      continue;
    }

    totalSize += file.size;
    validFiles.push(file);
  }

  if (totalSize > MAX_AGGREGATE_SIZE_BYTES) {
    errors.push(
      `Total upload size exceeds 50 MB limit (${formatBytes(totalSize)}). Please select fewer or smaller images.`
    );
    return { validFiles: [], errors };
  }

  return { validFiles, errors };
}

/**
 * ShopFinder — Image Uploader & Management Component (Phase 6, Task 6.6)
 *
 * Supports two operational contexts:
 * 1. Creation Mode: Manages local file selection with preview object URLs before listing exists.
 * 2. Edit Mode: Manages live listing images (upload, delete, cover designation, and left/right reordering).
 *
 * @param {Object} props
 * @param {'create'|'edit'} [props.mode='create']
 * @param {Array<File>} [props.selectedFiles=[]] - Creation mode: Selected File objects
 * @param {Function} [props.onFilesChange] - Creation mode: Handler for File array updates
 * @param {Array<Object>} [props.existingImages=[]] - Edit mode: Live listing image objects
 * @param {Function} [props.onUploadImages] - Edit mode: Handler receiving Array<File>
 * @param {Function} [props.onDeleteImage] - Edit mode: Handler receiving imageId
 * @param {Function} [props.onSetCover] - Edit mode: Handler receiving imageId
 * @param {Function} [props.onReorder] - Edit mode: Handler receiving ordered array of image IDs
 * @param {boolean} [props.isLoading=false] - In-flight indicator disabling action buttons
 */
export default function ImageUploader({
  mode = 'create',
  selectedFiles = [],
  onFilesChange,
  existingImages = [],
  onUploadImages,
  onDeleteImage,
  onSetCover,
  onReorder,
  isLoading = false,
}) {
  const fileInputRef = useRef(null);
  const [localErrors, setLocalErrors] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [actionInProgress, setActionInProgress] = useState(null); // 'upload' | 'delete' | 'cover' | 'reorder'

  // Manage object URLs for creation mode previews
  useEffect(() => {
    if (mode !== 'create') return;

    const urls = selectedFiles.map((file) => ({
      file,
      url: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '',
    }));
    setPreviews(urls);

    return () => {
      // Clean up memory
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        urls.forEach((item) => {
          if (item.url) URL.revokeObjectURL(item.url);
        });
      }
    };
  }, [selectedFiles, mode]);

  const currentCount = mode === 'create' ? selectedFiles.length : existingImages.length;
  const canAddMore = currentCount < MAX_IMAGES_PER_LISTING;

  /**
   * File input selection handler
   */
  const handleFileSelect = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    setLocalErrors([]);
    const { validFiles, errors } = validateImageFiles(rawFiles, currentCount);

    if (errors.length > 0) {
      setLocalErrors(errors);
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (mode === 'create') {
      const merged = [...selectedFiles, ...validFiles];
      if (onFilesChange) onFilesChange(merged);
    } else if (mode === 'edit' && onUploadImages) {
      try {
        setActionInProgress('upload');
        await onUploadImages(validFiles);
      } catch (err) {
        const errorMsg =
          err?.status === 429
            ? 'Too many upload requests. Please wait a moment and try again.'
            : err?.message || 'Failed to upload images. Please try again.';
        setLocalErrors([errorMsg]);
      } finally {
        setActionInProgress(null);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Creation mode: remove a selected file from the local queue
   */
  const handleRemoveLocalFile = (index) => {
    if (mode !== 'create' || !onFilesChange) return;
    const updated = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(updated);
    setLocalErrors([]);
  };

  /**
   * Edit mode: set image as cover
   */
  const handleSetCover = async (imageId) => {
    if (!onSetCover || isLoading || actionInProgress) return;
    try {
      setLocalErrors([]);
      setActionInProgress('cover');
      await onSetCover(imageId);
    } catch (err) {
      setLocalErrors([err?.message || 'Failed to set cover photo']);
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Edit mode: delete image
   */
  const handleDeleteImage = async (imageId) => {
    if (!onDeleteImage || isLoading || actionInProgress) return;
    try {
      setLocalErrors([]);
      setActionInProgress('delete');
      await onDeleteImage(imageId);
    } catch (err) {
      setLocalErrors([err?.message || 'Failed to delete photo']);
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Edit mode: Move Left
   */
  const handleMoveLeft = async (index) => {
    if (index <= 0 || !onReorder || isLoading || actionInProgress) return;
    const newItems = [...existingImages];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;

    const newOrderIds = newItems.map((img) => img.id);
    try {
      setLocalErrors([]);
      setActionInProgress('reorder');
      await onReorder(newOrderIds);
    } catch (err) {
      setLocalErrors([err?.message || 'Failed to reorder photos']);
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Edit mode: Move Right
   */
  const handleMoveRight = async (index) => {
    if (index >= existingImages.length - 1 || !onReorder || isLoading || actionInProgress) return;
    const newItems = [...existingImages];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;

    const newOrderIds = newItems.map((img) => img.id);
    try {
      setLocalErrors([]);
      setActionInProgress('reorder');
      await onReorder(newOrderIds);
    } catch (err) {
      setLocalErrors([err?.message || 'Failed to reorder photos']);
    } finally {
      setActionInProgress(null);
    }
  };

  const isBusy = isLoading || actionInProgress !== null;

  return (
    <div className="space-y-4">
      {/* Header & Capacity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Property Photos <span className="text-gray-500 text-sm font-normal">({currentCount} of {MAX_IMAGES_PER_LISTING})</span>
          </h3>
          <p className="text-xs text-gray-500">
            Upload up to 20 photos (JPEG, PNG, WebP — max 5 MB each). The first photo will be used as the primary cover.
          </p>
        </div>

        {canAddMore && (
          <div className="shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id="property-images-input"
              disabled={isBusy}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="inline-flex items-center gap-1.5"
            >
              {actionInProgress === 'upload' ? (
                <>
                  <Spinner size="sm" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloudIcon className="w-4 h-4 text-emerald-600" />
                  <span>{currentCount > 0 ? 'Add More Photos' : 'Select Photos'}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Validation or Action Errors */}
      {localErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1" role="alert">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800">Photo Notice:</span>
            <button
              type="button"
              onClick={() => setLocalErrors([])}
              className="text-red-500 hover:text-red-700 p-0.5 rounded"
              aria-label="Dismiss error"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
            {localErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Drop / Select Empty State */}
      {currentCount === 0 && (
        <div
          onClick={() => canAddMore && !isBusy && fileInputRef.current && fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isBusy
              ? 'bg-gray-50 border-gray-300 cursor-not-allowed'
              : 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/30 bg-gray-50/50'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Upload property photos"
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && fileInputRef.current && !isBusy) {
              e.preventDefault();
              fileInputRef.current.click();
            }
          }}
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
            <UploadCloudIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-gray-800">Click to browse and upload photos</p>
          <p className="text-xs text-gray-500 mt-1">
            JPEG, PNG, or WebP up to 5 MB each. You can add up to 20 photos.
          </p>
        </div>
      )}

      {/* Mode: CREATE — Selected Local File Previews */}
      {mode === 'create' && previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {previews.map((item, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={`${item.file.name}-${index}`}
                className="relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-100 aspect-video flex flex-col justify-between shadow-xs"
              >
                {item.url ? (
                  <img
                    src={item.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No preview
                  </div>
                )}

                {/* Primary Cover Badge for first item */}
                {isFirst && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white shadow-xs">
                    <StarIcon className="w-3 h-3" filled={true} />
                    Primary Cover
                  </span>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveLocalFile(index)}
                  disabled={isBusy}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-opacity focus:outline-hidden"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>

                {/* Filename & Size footer */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-white">
                  <p className="text-[11px] truncate font-medium">{item.file.name}</p>
                  <p className="text-[10px] text-gray-300">{formatBytes(item.file.size)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode: EDIT — Live Listing Images */}
      {mode === 'edit' && existingImages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {existingImages.map((image, index) => {
            const isCover = Boolean(image.is_cover);
            const isFirst = index === 0;
            const isLast = index === existingImages.length - 1;

            return (
              <div
                key={image.id}
                className={`relative rounded-xl border overflow-hidden flex flex-col bg-white shadow-xs transition-all ${
                  isCover ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-gray-200'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
                  <img
                    src={image.thumb_url || image.url}
                    alt={image.image || `Listing photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Cover Status Badge */}
                  {isCover && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-600 text-white shadow-sm">
                      <StarIcon className="w-3.5 h-3.5" filled={true} />
                      Cover Photo
                    </span>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="p-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1 text-xs">
                  {/* Left / Right Reordering */}
                  <div className="inline-flex items-center rounded-md border border-gray-300 bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleMoveLeft(index)}
                      disabled={isFirst || isBusy}
                      className="p-1.5 text-gray-700 hover:text-emerald-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed border-r border-gray-200 transition-colors"
                      title="Move photo left"
                      aria-label={`Move photo ${index + 1} left`}
                    >
                      <ArrowLeftIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveRight(index)}
                      disabled={isLast || isBusy}
                      className="p-1.5 text-gray-700 hover:text-emerald-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move photo right"
                      aria-label={`Move photo ${index + 1} right`}
                    >
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Set Cover / Cover Tag */}
                  <div className="flex items-center gap-1">
                    {!isCover ? (
                      <button
                        type="button"
                        onClick={() => handleSetCover(image.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200 transition-colors disabled:opacity-40"
                        title="Set as primary cover"
                        aria-label={`Set photo ${index + 1} as cover`}
                      >
                        <StarIcon className="w-3 h-3 text-amber-500" />
                        <span>Make Cover</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-700 px-1.5 py-0.5">
                        Active Cover
                      </span>
                    )}

                    {/* Delete Photo Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={isBusy}
                      className="p-1.5 rounded text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-40"
                      title="Delete photo"
                      aria-label={`Delete photo ${index + 1}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

