import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input.jsx';
import { Label } from '../ui/label.jsx';
import { Button } from '../ui/button.jsx';
import Spinner from '../common/Spinner.jsx';

export const CATEGORY_OPTIONS = [
  { value: 'retail', label: 'Retail / Shop' },
  { value: 'office', label: 'Commercial Office' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'warehouse', label: 'Warehouse / Storage' },
  { value: 'showroom', label: 'Commercial Showroom' },
  { value: 'industrial', label: 'Industrial Space / Factory' },
  { value: 'other', label: 'Other Commercial Space' },
];

export const POPULAR_CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Gazipur'];

/**
 * ShopFinder — Commercial Property Form (Phase 6, Task 6.6)
 *
 * Reusable form component supporting both property creation and editing.
 * Enforces client-side validation for all 9 commercial property fields.
 *
 * @param {Object} props
 * @param {Object} [props.initialData={}] - Initial values for edit mode
 * @param {Function} props.onSubmit - Submission handler receiving validated payload
 * @param {boolean} [props.isSubmitting=false] - Submission in-flight indicator
 * @param {string} [props.submitLabel='Save Listing'] - Primary button label
 * @param {Function} [props.onCancel] - Cancellation handler
 */
export default function PropertyForm({
  initialData = {},
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save Listing',
  onCancel,
  children,
}) {
  const [formData, setFormData] = useState({
    title: initialData.title || '',
    description: initialData.description || '',
    category: initialData.category || 'office',
    listing_type: initialData.listing_type || 'rent',
    price: initialData.price !== undefined && initialData.price !== null ? String(initialData.price) : '',
    area_sqft: initialData.area_sqft !== undefined && initialData.area_sqft !== null ? String(initialData.area_sqft) : '',
    address: initialData.address || '',
    city: initialData.city || 'Dhaka',
    area: initialData.area || '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        category: initialData.category || 'office',
        listing_type: initialData.listing_type || 'rent',
        price: initialData.price !== undefined && initialData.price !== null ? String(initialData.price) : '',
        area_sqft: initialData.area_sqft !== undefined && initialData.area_sqft !== null ? String(initialData.area_sqft) : '',
        address: initialData.address || '',
        city: initialData.city || 'Dhaka',
        area: initialData.area || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /**
   * Client-side validation ensuring adherence to backend constraints.
   */
  const validateForm = () => {
    const errs = {};

    // 1. Title
    const trimmedTitle = (formData.title || '').trim();
    if (!trimmedTitle) {
      errs.title = 'Title is required';
    } else if (trimmedTitle.length > 200) {
      errs.title = 'Title cannot exceed 200 characters';
    }

    // 2. Description
    const trimmedDesc = (formData.description || '').trim();
    if (!trimmedDesc) {
      errs.description = 'Description is required';
    } else if (trimmedDesc.length > 10000) {
      errs.description = 'Description cannot exceed 10,000 characters';
    }

    // 3. Category
    if (!formData.category || !CATEGORY_OPTIONS.some((c) => c.value === formData.category)) {
      errs.category = 'Please select a valid commercial category';
    }

    // 4. Listing Type
    if (formData.listing_type !== 'rent' && formData.listing_type !== 'sale') {
      errs.listing_type = "Listing type must be 'rent' or 'sale'";
    }

    // 5. Price
    if (formData.price === '' || formData.price === null || formData.price === undefined) {
      errs.price = 'Price is required';
    } else {
      const numPrice = Number(formData.price);
      if (!Number.isFinite(numPrice) || isNaN(numPrice)) {
        errs.price = 'Price must be a valid finite number';
      } else if (numPrice < 0) {
        errs.price = 'Price cannot be negative';
      } else if (numPrice > 1e12) {
        errs.price = 'Price exceeds maximum allowable value';
      }
    }

    // 6. Area (sqft)
    if (formData.area_sqft === '' || formData.area_sqft === null || formData.area_sqft === undefined) {
      errs.area_sqft = 'Floor area (sqft) is required';
    } else {
      const numArea = Number(formData.area_sqft);
      if (!Number.isFinite(numArea) || isNaN(numArea)) {
        errs.area_sqft = 'Floor area must be a valid finite number';
      } else if (numArea < 0) {
        errs.area_sqft = 'Floor area cannot be negative';
      } else if (numArea > 1e7) {
        errs.area_sqft = 'Floor area exceeds maximum allowable value';
      }
    }

    // 7. Address
    const trimmedAddr = (formData.address || '').trim();
    if (!trimmedAddr) {
      errs.address = 'Street address is required';
    } else if (trimmedAddr.length > 500) {
      errs.address = 'Address cannot exceed 500 characters';
    }

    // 8. City
    const trimmedCity = (formData.city || '').trim();
    if (!trimmedCity) {
      errs.city = 'City is required';
    } else if (trimmedCity.length > 100) {
      errs.city = 'City cannot exceed 100 characters';
    }

    // 9. Area
    const trimmedArea = (formData.area || '').trim();
    if (!trimmedArea) {
      errs.area = 'Neighborhood / area is required';
    } else if (trimmedArea.length > 100) {
      errs.area = 'Area cannot exceed 100 characters';
    }

    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to first error
      const firstKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(`field-${firstKey}`);
      if (el) el.focus();
      return;
    }

    // Clean payload
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      listing_type: formData.listing_type,
      price: Number(formData.price),
      area_sqft: Number(formData.area_sqft),
      address: formData.address.trim(),
      city: formData.city.trim(),
      area: formData.area.trim(),
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. Basic Property Information                                        */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-5">
        <h3 className="text-base font-semibold text-foreground tracking-tight border-b border-border pb-3">
          1. Basic Commercial Property Information
        </h3>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="field-title" className="text-sm font-medium">
            Property Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="field-title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. 2,200 sqft Modern Commercial Office Space in Gulshan 1"
            disabled={isSubmitting}
            maxLength={200}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'field-title-error' : undefined}
            className={errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            {errors.title ? (
              <span id="field-title-error" role="alert" className="text-destructive font-medium">
                {errors.title}
              </span>
            ) : (
              <span>Provide a descriptive, professional headline.</span>
            )}
            <span>{formData.title.length}/200</span>
          </div>
        </div>

        {/* Category & Listing Type Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="field-category" className="text-sm font-medium">
              Commercial Category <span className="text-destructive">*</span>
            </Label>
            <select
              id="field-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 ${
                errors.category ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <span id="field-category-error" role="alert" className="text-xs text-destructive font-medium block">
                {errors.category}
              </span>
            )}
          </div>

          {/* Listing Type (Rent vs Sale) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Listing Type <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 h-9">
              <button
                type="button"
                id="type-rent"
                onClick={() => handleChange({ target: { name: 'listing_type', value: 'rent' } })}
                disabled={isSubmitting}
                className={`rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center border ${
                  formData.listing_type === 'rent'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                For Rent
              </button>

              <button
                type="button"
                id="type-sale"
                onClick={() => handleChange({ target: { name: 'listing_type', value: 'sale' } })}
                disabled={isSubmitting}
                className={`rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center border ${
                  formData.listing_type === 'sale'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                For Sale
              </button>
            </div>
            {errors.listing_type && (
              <span role="alert" className="text-xs text-destructive font-medium block">
                {errors.listing_type}
              </span>
            )}
          </div>
        </div>

        {/* Price & Area Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="field-price" className="text-sm font-medium">
              {formData.listing_type === 'rent' ? 'Monthly Rent (BDT)' : 'Selling Price (BDT)'}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm font-bold text-muted-foreground">৳</span>
              <Input
                id="field-price"
                name="price"
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={handleChange}
                placeholder={formData.listing_type === 'rent' ? 'e.g. 150000' : 'e.g. 25000000'}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.price)}
                aria-describedby={errors.price ? 'field-price-error' : undefined}
                className={`pl-8 ${errors.price ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
            </div>
            {errors.price && (
              <span id="field-price-error" role="alert" className="text-xs text-destructive font-medium block">
                {errors.price}
              </span>
            )}
          </div>

          {/* Area sqft */}
          <div className="space-y-1.5">
            <Label htmlFor="field-area_sqft" className="text-sm font-medium">
              Floor Area (Square Feet) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-area_sqft"
              name="area_sqft"
              type="number"
              min="0"
              step="1"
              value={formData.area_sqft}
              onChange={handleChange}
              placeholder="e.g. 2400"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.area_sqft)}
              aria-describedby={errors.area_sqft ? 'field-area_sqft-error' : undefined}
              className={errors.area_sqft ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.area_sqft && (
              <span id="field-area_sqft-error" role="alert" className="text-xs text-destructive font-medium block">
                {errors.area_sqft}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="field-description" className="text-sm font-medium">
            Detailed Property Description <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="field-description"
            name="description"
            rows={5}
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe the property specifications, key features, power/generator backup, elevators, parking capacity, accessibility, and ideal commercial uses..."
            disabled={isSubmitting}
            maxLength={10000}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'field-description-error' : undefined}
            className={`w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 ${
              errors.description ? 'border-destructive focus-visible:ring-destructive' : ''
            }`}
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            {errors.description ? (
              <span id="field-description-error" role="alert" className="text-destructive font-medium">
                {errors.description}
              </span>
            ) : (
              <span>Detail amenities, security, backup generator, and tenant terms.</span>
            )}
            <span>{formData.description.length}/10,000</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Location & Address                                                 */}
      {/* ===================================================================== */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-5">
        <h3 className="text-base font-semibold text-foreground tracking-tight border-b border-border pb-3">
          2. Property Location & Address
        </h3>

        {/* City and Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="field-city" className="text-sm font-medium">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-city"
              name="city"
              type="text"
              list="popular-cities-list"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Dhaka"
              disabled={isSubmitting}
              maxLength={100}
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'field-city-error' : undefined}
              className={errors.city ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <datalist id="popular-cities-list">
              {POPULAR_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            {errors.city && (
              <span id="field-city-error" role="alert" className="text-xs text-destructive font-medium block">
                {errors.city}
              </span>
            )}
          </div>

          {/* Area / Neighborhood */}
          <div className="space-y-1.5">
            <Label htmlFor="field-area" className="text-sm font-medium">
              Neighborhood / Area <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-area"
              name="area"
              type="text"
              value={formData.area}
              onChange={handleChange}
              placeholder="e.g. Gulshan 1, Banani, Motijheel C/A"
              disabled={isSubmitting}
              maxLength={100}
              aria-invalid={Boolean(errors.area)}
              aria-describedby={errors.area ? 'field-area-error' : undefined}
              className={errors.area ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.area && (
              <span id="field-area-error" role="alert" className="text-xs text-destructive font-medium block">
                {errors.area}
              </span>
            )}
          </div>
        </div>

        {/* Street Address */}
        <div className="space-y-1.5">
          <Label htmlFor="field-address" className="text-sm font-medium">
            Detailed Street Address / Building <span className="text-destructive">*</span>
          </Label>
          <Input
            id="field-address"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="e.g. House 42, Road 11, Block D, Tower 7"
            disabled={isSubmitting}
            maxLength={500}
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? 'field-address-error' : undefined}
            className={errors.address ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors.address && (
            <span id="field-address-error" role="alert" className="text-xs text-destructive font-medium block">
              {errors.address}
            </span>
          )}
        </div>
      </div>

      {/* Optional Children (e.g. ImageUploader or Custom Sections) */}
      {children}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-w-[140px] flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" variant="white" label="Submitting..." />
              <span>Saving...</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
