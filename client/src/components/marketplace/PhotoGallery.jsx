import React, { useState, useEffect, useCallback } from 'react';
import { StoreIcon, ChevronLeftIcon, ChevronRightIcon } from '../common/Icons.jsx';

/**
 * ShopFinder — Property Photo Gallery Component (Phase 5, Task 5.5)
 *
 * Provides an accessible, responsive photo viewer with main stage,
 * previous/next controls, photo counter, and thumbnail navigation strip.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.images=[]] - List of image records with .url and .thumb_url
 * @param {string} [props.title='Commercial Property'] - Property title for accessible alt descriptions
 */
export default function PhotoGallery({ images = [], title = 'Commercial Property' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState({});

  const validImages = Array.isArray(images) ? images : [];
  const totalCount = validImages.length;

  // Reset active index if images change or out of bounds
  useEffect(() => {
    if (activeIndex >= totalCount) {
      setActiveIndex(0);
    }
  }, [totalCount, activeIndex]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev <= 0 ? totalCount - 1 : prev - 1));
  }, [totalCount]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev >= totalCount - 1 ? 0 : prev + 1));
  }, [totalCount]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    },
    [handlePrev, handleNext]
  );

  const handleImageError = (index) => {
    setFailedImages((prev) => ({ ...prev, [index]: true }));
  };

  // Case 1: Zero photos available
  if (totalCount === 0) {
    return (
      <div
        className="w-full h-72 sm:h-96 lg:h-[440px] rounded-2xl border border-dashed border-border/80 bg-muted/40 flex flex-col items-center justify-center p-6 text-center"
        role="region"
        aria-label="Property photo gallery"
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground/70 mb-3">
          <StoreIcon className="w-8 h-8" />
        </div>
        <p className="text-base font-medium text-foreground">No photos available for this commercial property</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Photos will appear once verified by the property owner or administration.
        </p>
      </div>
    );
  }

  const activeImage = validImages[activeIndex] || validImages[0];
  const activeUrl = activeImage?.url || activeImage?.thumb_url;
  const isCurrentFailed = failedImages[activeIndex];

  // Case 2: Exactly 1 photo (no arrows, no thumbnail strip)
  if (totalCount === 1) {
    return (
      <div
        className="w-full rounded-2xl overflow-hidden border border-border/60 bg-card shadow-xs"
        role="region"
        aria-label="Property photo gallery"
      >
        <div className="relative w-full h-72 sm:h-96 lg:h-[460px] bg-muted/60 flex items-center justify-center">
          {isCurrentFailed || !activeUrl ? (
            <div className="flex flex-col items-center justify-center text-center p-4">
              <StoreIcon className="w-12 h-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Image preview unavailable</p>
            </div>
          ) : (
            <img
              src={activeUrl}
              alt={`${title} - Photo 1`}
              className="w-full h-full object-cover"
              onError={() => handleImageError(0)}
            />
          )}
        </div>
      </div>
    );
  }

  // Case 3: Multiple photos (full gallery with controls and thumbnail strip)
  return (
    <div
      className="w-full space-y-3"
      role="region"
      aria-label="Property photo gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Main Large Viewer Stage */}
      <div className="relative w-full h-72 sm:h-96 lg:h-[460px] rounded-2xl overflow-hidden border border-border/60 bg-muted/70 shadow-xs group">
        {isCurrentFailed || !activeUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <StoreIcon className="w-12 h-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Image preview unavailable</p>
          </div>
        ) : (
          <img
            key={activeIndex}
            src={activeUrl}
            alt={`${title} - Photo ${activeIndex + 1} of ${totalCount}`}
            className="w-full h-full object-cover transition-opacity duration-200"
            onError={() => handleImageError(activeIndex)}
          />
        )}

        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/85 hover:bg-background text-foreground shadow-md backdrop-blur-xs flex items-center justify-center transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 opacity-90 hover:opacity-100"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/85 hover:bg-background text-foreground shadow-md backdrop-blur-xs flex items-center justify-center transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 opacity-90 hover:opacity-100"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>

        {/* Photo Counter Overlay Badge */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-xs text-white text-xs font-semibold font-mono tracking-wider shadow-sm pointer-events-none">
          {activeIndex + 1} / {totalCount}
        </div>
      </div>

      {/* Clickable Thumbnail Strip */}
      <div
        className="flex items-center gap-2.5 overflow-x-auto py-1 px-0.5 scrollbar-thin"
        role="tablist"
        aria-label="Photo thumbnails"
      >
        {validImages.map((img, idx) => {
          const thumbUrl = img.thumb_url || img.url;
          const isSelected = idx === activeIndex;
          const isFailed = failedImages[idx];

          return (
            <button
              key={img.id || idx}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`View photo ${idx + 1} of ${totalCount}`}
              onClick={() => setActiveIndex(idx)}
              className={`relative shrink-0 w-20 h-16 sm:w-24 sm:h-18 rounded-lg overflow-hidden border transition-all duration-150 focus:outline-hidden ${
                isSelected
                  ? 'ring-2 ring-primary ring-offset-2 border-primary scale-[1.02]'
                  : 'border-border/70 opacity-70 hover:opacity-100 hover:border-border'
              }`}
            >
              {isFailed || !thumbUrl ? (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <StoreIcon className="w-4 h-4 text-muted-foreground/60" />
                </div>
              ) : (
                <img
                  src={thumbUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleImageError(idx)}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

