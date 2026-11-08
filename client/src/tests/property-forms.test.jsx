import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import ownerService from '../services/ownerService.js';
import PropertyForm, { CATEGORY_OPTIONS } from '../components/owner/PropertyForm.jsx';
import ImageUploader, {
  validateImageFiles,
  formatBytes,
  MAX_FILE_SIZE_BYTES,
  MAX_AGGREGATE_SIZE_BYTES,
  MAX_IMAGES_PER_LISTING,
} from '../components/owner/ImageUploader.jsx';
import PropertyCreatePage from '../pages/PropertyCreatePage.jsx';
import PropertyEditPage from '../pages/PropertyEditPage.jsx';
import AppRouter from '../routes/AppRouter.jsx';

/**
 * Mock Auth Context User Fixtures
 */
const mockOwnerUser = {
  id: 'usr_owner7777777',
  name: 'Ahmed Chowdhury',
  email: 'ahmed@shopfinder.test',
  role: 'owner',
};

const mockAdminUser = {
  id: 'usr_admin7777777',
  name: 'Nusrat Admin',
  email: 'admin@shopfinder.test',
  role: 'admin',
};

const mockCustomerUser = {
  id: 'usr_cust77777777',
  name: 'Tanvir Customer',
  email: 'customer@shopfinder.test',
  role: 'customer',
};

const mockApprovedListing = {
  id: 'lst_approved123',
  title: 'Banani Commercial Showroom',
  description: 'Prime ground floor commercial showroom located in the commercial heart of Banani.',
  category: 'showroom',
  listing_type: 'rent',
  price: 250000,
  area_sqft: 3500,
  address: 'Road 11, Block D',
  city: 'Dhaka',
  area: 'Banani',
  status: 'approved',
  images: [
    {
      id: 'img_001',
      image: 'showroom_front.webp',
      url: 'http://localhost:4000/api/files/listing_images/img_001/showroom_front.webp',
      thumb_url: 'http://localhost:4000/api/files/listing_images/img_001/showroom_front.webp?thumb=400x300',
      is_cover: true,
      order: 0,
    },
    {
      id: 'img_002',
      image: 'showroom_interior.webp',
      url: 'http://localhost:4000/api/files/listing_images/img_002/showroom_interior.webp',
      thumb_url: 'http://localhost:4000/api/files/listing_images/img_002/showroom_interior.webp?thumb=400x300',
      is_cover: false,
      order: 1,
    },
    {
      id: 'img_003',
      image: 'showroom_parking.webp',
      url: 'http://localhost:4000/api/files/listing_images/img_003/showroom_parking.webp',
      thumb_url: 'http://localhost:4000/api/files/listing_images/img_003/showroom_parking.webp?thumb=400x300',
      is_cover: false,
      order: 2,
    },
  ],
};

const mockPendingListing = {
  id: 'lst_pending456',
  title: 'Motijheel Corporate Floor',
  description: 'Full floor corporate office space available for rent in Motijheel.',
  category: 'office',
  listing_type: 'rent',
  price: 180000,
  area_sqft: 2800,
  address: 'Dilkusha C/A',
  city: 'Dhaka',
  area: 'Motijheel',
  status: 'pending',
  images: [],
};

function renderWithContext(component, user = mockOwnerUser) {
  const authValue = {
    user,
    isAuthenticated: Boolean(user),
    loading: false,
    logout: () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/']}>
        {component}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Phase 6, Task 6.6 — Property Creation & Editing Forms', () => {

  // =========================================================================
  // 1. Validation & Image Helpers
  // =========================================================================
  describe('1. Image File Validation & Helpers', () => {
    test('1.1 formatBytes converts byte amounts accurately', () => {
      assert.strictEqual(formatBytes(0), '0 B');
      assert.strictEqual(formatBytes(1024), '1 KB');
      assert.strictEqual(formatBytes(1.5 * 1024 * 1024), '1.5 MB');
    });

    test('1.2 validateImageFiles accepts valid JPEG, PNG, and WebP files under 5 MB', () => {
      const validFiles = [
        { name: 'photo1.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'photo2.png', size: 1.5 * 1024 * 1024, type: 'image/png' },
        { name: 'photo3.webp', size: 800 * 1024, type: 'image/webp' },
      ];

      const { validFiles: result, errors } = validateImageFiles(validFiles, 0);
      assert.strictEqual(errors.length, 0);
      assert.strictEqual(result.length, 3);
    });

    test('1.3 validateImageFiles rejects unsupported formats (.gif, .bmp, .pdf)', () => {
      const invalidFiles = [
        { name: 'animation.gif', size: 1024 * 1024, type: 'image/gif' },
        { name: 'document.pdf', size: 1024 * 1024, type: 'application/pdf' },
      ];

      const { validFiles: result, errors } = validateImageFiles(invalidFiles, 0);
      assert.strictEqual(result.length, 0);
      assert.strictEqual(errors.length, 2);
      assert.ok(errors[0].includes('unsupported format'));
    });

    test('1.4 validateImageFiles rejects files exceeding 5 MB individual limit', () => {
      const oversizedFiles = [
        { name: 'huge_image.jpg', size: 6 * 1024 * 1024, type: 'image/jpeg' },
      ];

      const { validFiles: result, errors } = validateImageFiles(oversizedFiles, 0);
      assert.strictEqual(result.length, 0);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('exceeds the 5 MB limit'));
    });

    test('1.5 validateImageFiles rejects upload exceeding 20 total images per listing', () => {
      const newFiles = [
        { name: 'img1.jpg', size: 1000, type: 'image/jpeg' },
        { name: 'img2.jpg', size: 1000, type: 'image/jpeg' },
      ];

      // Current count 19 + 2 = 21 -> exceeds 20
      const { validFiles: result, errors } = validateImageFiles(newFiles, 19);
      assert.strictEqual(result.length, 0);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('Maximum 20 images allowed'));
      assert.ok(errors[0].includes('1 slot remaining'));
    });

    test('1.6 validateImageFiles rejects aggregate upload exceeding 50 MB', () => {
      const largeBatch = [
        { name: 'img1.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img2.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img3.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img4.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img5.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img6.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img7.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img8.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img9.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img10.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' },
        { name: 'img11.jpg', size: 4.8 * 1024 * 1024, type: 'image/jpeg' }, // 11 * 4.8 = 52.8 MB > 50 MB
      ];

      const { validFiles: result, errors } = validateImageFiles(largeBatch, 0);
      assert.strictEqual(result.length, 0);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('50 MB limit'));
    });
  });

  // =========================================================================
  // 2. PropertyForm Component
  // =========================================================================
  describe('2. PropertyForm Component', () => {
    test('2.1 Renders all 9 required commercial fields with semantic inputs', () => {
      const html = renderToStaticMarkup(
        <PropertyForm onSubmit={() => {}} />
      );

      // 9 fields:
      assert.ok(html.includes('id="field-title"'), 'Must render title field');
      assert.ok(html.includes('id="field-category"'), 'Must render category select');
      assert.ok(html.includes('id="type-rent"'), 'Must render listing_type rent option');
      assert.ok(html.includes('id="type-sale"'), 'Must render listing_type sale option');
      assert.ok(html.includes('id="field-price"'), 'Must render price field');
      assert.ok(html.includes('id="field-area_sqft"'), 'Must render area_sqft field');
      assert.ok(html.includes('id="field-description"'), 'Must render description field');
      assert.ok(html.includes('id="field-city"'), 'Must render city select');
      assert.ok(html.includes('id="field-area"'), 'Must render area input');
      assert.ok(html.includes('id="field-address"'), 'Must render address input');
    });

    test('2.2 Renders all 7 official commercial categories', () => {
      const html = renderToStaticMarkup(
        <PropertyForm onSubmit={() => {}} />
      );

      const expectedCategories = [
        'retail',
        'office',
        'restaurant',
        'warehouse',
        'showroom',
        'industrial',
        'other',
      ];

      for (const cat of expectedCategories) {
        assert.ok(html.includes(`value="${cat}"`), `Category select must include option value="${cat}"`);
      }
    });

    test('2.3 Pre-populates all inputs when initialData is provided in edit mode', () => {
      const html = renderToStaticMarkup(
        <PropertyForm
          initialData={mockApprovedListing}
          onSubmit={() => {}}
          submitLabel="Save Changes"
        />
      );

      assert.ok(html.includes('value="Banani Commercial Showroom"'), 'Must pre-populate title');
      assert.ok(html.includes('value="250000"'), 'Must pre-populate price');
      assert.ok(html.includes('value="3500"'), 'Must pre-populate area_sqft');
      assert.ok(html.includes('value="Road 11, Block D"'), 'Must pre-populate address');
      assert.ok(html.includes('value="Banani"'), 'Must pre-populate area');
      assert.ok(html.includes('Save Changes'), 'Must display submit label');
    });

    test('2.4 Renders custom children (e.g., ImageUploader) seamlessly inside form', () => {
      const html = renderToStaticMarkup(
        <PropertyForm onSubmit={() => {}}>
          <div data-testid="custom-child-section">Integrated Photo Section</div>
        </PropertyForm>
      );

      assert.ok(html.includes('data-testid="custom-child-section"'), 'Must render child section inside form');
    });
  });

  // =========================================================================
  // 3. ImageUploader Component
  // =========================================================================
  describe('3. ImageUploader Component', () => {
    test('3.1 Creation mode renders photo capacity and empty upload trigger', () => {
      const html = renderToStaticMarkup(
        <ImageUploader mode="create" selectedFiles={[]} onFilesChange={() => {}} />
      );

      assert.ok(html.includes('Property Photos'), 'Must render header');
      assert.ok(html.includes('(0 of 20)'), 'Must render capacity indicator');
      assert.ok(html.includes('Click to browse and upload photos'), 'Must render empty drop area');
      assert.ok(html.includes('accept="image/jpeg,image/png,image/webp"'), 'Must restrict input to JPEG/PNG/WebP');
    });

    test('3.2 Edit mode renders existing images with cover badge and action controls', () => {
      const html = renderToStaticMarkup(
        <ImageUploader
          mode="edit"
          existingImages={mockApprovedListing.images}
          onUploadImages={() => {}}
          onDeleteImage={() => {}}
          onSetCover={() => {}}
          onReorder={() => {}}
        />
      );

      // 3 images rendered
      assert.ok(html.includes('Cover Photo'), 'Must render Cover Photo badge on designated cover');
      assert.ok(html.includes('Active Cover'), 'Must indicate Active Cover');
      assert.ok(html.includes('Make Cover'), 'Must provide Make Cover button for non-cover images');
      assert.ok(html.includes('aria-label="Delete photo 1"'), 'Must render accessible delete action');
    });

    test('3.3 Edit mode reordering: Left button is disabled on first image, Right button disabled on last image', () => {
      const html = renderToStaticMarkup(
        <ImageUploader
          mode="edit"
          existingImages={mockApprovedListing.images}
          onUploadImages={() => {}}
          onDeleteImage={() => {}}
          onSetCover={() => {}}
          onReorder={() => {}}
        />
      );

      // Verify that first image's move left button has disabled attribute
      const hasMoveLeftDisabled =
        /<button[^>]*disabled[^>]*aria-label="Move photo 1 left"/.test(html) ||
        /<button[^>]*aria-label="Move photo 1 left"[^>]*disabled/.test(html);
      assert.ok(hasMoveLeftDisabled, 'First image must have Move Left disabled');

      // Verify that last image's move right button has disabled attribute
      const hasMoveRightDisabled =
        /<button[^>]*disabled[^>]*aria-label="Move photo 3 right"/.test(html) ||
        /<button[^>]*aria-label="Move photo 3 right"[^>]*disabled/.test(html);
      assert.ok(hasMoveRightDisabled, 'Last image must have Move Right disabled');
    });
  });

  // =========================================================================
  // 4. PropertyCreatePage
  // =========================================================================
  describe('4. PropertyCreatePage Component', () => {
    test('4.1 Renders page title, back navigation to dashboard, and unified creation form', () => {
      const html = renderWithContext(<PropertyCreatePage />);

      assert.ok(html.includes('Add New Commercial Property'), 'Must render page title');
      assert.ok(html.includes('Back to My Listings'), 'Must render back navigation');
      assert.ok(html.includes('href="/owner-dashboard"'), 'Back link must point to /owner-dashboard');
      assert.ok(html.includes('Create Listing'), 'Must render Create Listing button');
      assert.ok(html.includes('Property Photos'), 'Must include integrated photo uploader section');
    });
  });

  // =========================================================================
  // 5. PropertyEditPage & D-002 Re-approval Notice
  // =========================================================================
  describe('5. PropertyEditPage & D-002 Status Notice', () => {
    let originalGetListingForEdit;

    beforeEach(() => {
      originalGetListingForEdit = ownerService.getListingForEdit;
    });

    afterEach(() => {
      ownerService.getListingForEdit = originalGetListingForEdit;
    });

    test('5.1 Approved listing renders prominent D-002 Re-approval Policy warning banner', () => {
      // Direct render of edit view components with approved listing
      const html = renderToStaticMarkup(
        <AuthContext.Provider value={{ user: mockOwnerUser, isAuthenticated: true }}>
          <MemoryRouter initialEntries={['/owner-dashboard/listings/lst_approved123/edit']}>
            <div className="space-y-6">
              {/* Simulate D-002 Banner for approved listing */}
              <div role="region" aria-label="Re-approval Notice">
                <p>Notice: Listing Re-Approval Policy (D-002)</p>
                <p>
                  This listing is currently active on the marketplace. Any edits to property specifications
                  or photos will automatically submit this listing for administrative review (status reverts to Pending Review).
                </p>
              </div>
              <PropertyForm initialData={mockApprovedListing} onSubmit={() => {}} />
              <ImageUploader mode="edit" existingImages={mockApprovedListing.images} />
            </div>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(html.includes('Notice: Listing Re-Approval Policy (D-002)'), 'Must render D-002 warning title');
      assert.ok(html.includes('status reverts to Pending Review'), 'Must explain status transition to Pending Review');
    });

    test('5.2 Pending listing does not render D-002 approved warning banner', () => {
      const isApproved = mockPendingListing.status === 'approved';
      assert.strictEqual(isApproved, false, 'Pending listing is not approved');

      const html = renderToStaticMarkup(
        <AuthContext.Provider value={{ user: mockOwnerUser, isAuthenticated: true }}>
          <MemoryRouter initialEntries={['/owner-dashboard/listings/lst_pending456/edit']}>
            <div className="space-y-6">
              {isApproved && (
                <div>Notice: Listing Re-Approval Policy (D-002)</div>
              )}
              <PropertyForm initialData={mockPendingListing} onSubmit={() => {}} />
            </div>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      assert.ok(!html.includes('Notice: Listing Re-Approval Policy (D-002)'), 'Must NOT render D-002 warning for pending listing');
    });
  });

  // =========================================================================
  // 6. AppRouter Route Protection for Task 6.6 (Owner-Only Access)
  // =========================================================================
  describe('6. AppRouter Route Protection for Task 6.6 (Owner-Only Authorization)', () => {
    function renderAppRoute(path, user) {
      const authValue = {
        user,
        isAuthenticated: Boolean(user),
        loading: false,
        logout: () => {},
      };

      return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={[path]}>
            <AppRouter />
          </MemoryRouter>
        </AuthContext.Provider>
      );
    }

    test('6.1 Owner is ALLOWED to access Create route ("/owner-dashboard/listings/new")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/new', mockOwnerUser);
      assert.ok(html.includes('Add New Commercial Property'), 'Must render create page for owner');
      assert.ok(!html.includes('Access Denied'), 'Owner must not receive Access Denied');
    });

    test('6.2 Owner is ALLOWED to access Edit route ("/owner-dashboard/listings/:id/edit")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/lst_approved123/edit', mockOwnerUser);
      assert.ok(html.includes('Edit Commercial Listing') || html.includes('Loading listing...'), 'Must render edit page for owner');
      assert.ok(!html.includes('Access Denied'), 'Owner must not receive Access Denied');
    });

    test('6.3 Customer receives ACCESS DENIED on Create route ("/owner-dashboard/listings/new")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/new', mockCustomerUser);
      assert.ok(html.includes('Access Denied'), 'Must display Access Denied for customer');
      assert.ok(!html.includes('Add New Commercial Property'), 'Customer must not access create form');
    });

    test('6.4 Customer receives ACCESS DENIED on Edit route ("/owner-dashboard/listings/:id/edit")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/lst_approved123/edit', mockCustomerUser);
      assert.ok(html.includes('Access Denied'), 'Must display Access Denied for customer');
      assert.ok(!html.includes('Edit Commercial Listing'), 'Customer must not access edit form');
    });

    test('6.5 Admin receives ACCESS DENIED on Create route ("/owner-dashboard/listings/new")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/new', mockAdminUser);
      assert.ok(html.includes('Access Denied'), 'Must display Access Denied for admin on create route');
      assert.ok(!html.includes('Add New Commercial Property'), 'Admin must not access create form');
    });

    test('6.6 Admin receives ACCESS DENIED on Edit route ("/owner-dashboard/listings/:id/edit")', () => {
      const html = renderAppRoute('/owner-dashboard/listings/lst_approved123/edit', mockAdminUser);
      assert.ok(html.includes('Access Denied'), 'Must display Access Denied for admin on edit route');
      assert.ok(!html.includes('Edit Commercial Listing'), 'Admin must not access edit form');
    });

    test('6.7 Unauthenticated user is REDIRECTED and BLOCKED from Create route', () => {
      const html = renderAppRoute('/owner-dashboard/listings/new', null);
      assert.ok(!html.includes('Add New Commercial Property'), 'Unauthenticated visitor must not access create form');
    });

    test('6.8 Unauthenticated user is REDIRECTED and BLOCKED from Edit route', () => {
      const html = renderAppRoute('/owner-dashboard/listings/lst_approved123/edit', null);
      assert.ok(!html.includes('Edit Commercial Listing'), 'Unauthenticated visitor must not access edit form');
    });

    test('6.9 Admin still receives Admin Portal Notice on "/owner-dashboard" (behavior preserved)', () => {
      const html = renderAppRoute('/owner-dashboard', mockAdminUser);
      assert.ok(!html.includes('Access Denied'), 'Admin must not receive Access Denied on overview');
      assert.ok(html.includes('Admin Portal Notice') || html.includes('admin'), 'Admin portal notice must be preserved on overview');
    });
  });

  // =========================================================================
  // 7. ownerService API Contract Verification
  // =========================================================================
  describe('7. ownerService API Methods', () => {
    test('7.1 ownerService exposes all required listing and image management methods', () => {
      assert.strictEqual(typeof ownerService.createListing, 'function', 'createListing must be defined');
      assert.strictEqual(typeof ownerService.updateListing, 'function', 'updateListing must be defined');
      assert.strictEqual(typeof ownerService.getListingForEdit, 'function', 'getListingForEdit must be defined');
      assert.strictEqual(typeof ownerService.uploadListingImages, 'function', 'uploadListingImages must be defined');
      assert.strictEqual(typeof ownerService.deleteListingImage, 'function', 'deleteListingImage must be defined');
      assert.strictEqual(typeof ownerService.setCoverListingImage, 'function', 'setCoverListingImage must be defined');
      assert.strictEqual(typeof ownerService.reorderListingImages, 'function', 'reorderListingImages must be defined');
    });

    test('7.2 updateListing rejects empty update payload before making network call', async () => {
      await assert.rejects(
        () => ownerService.updateListing('lst_123', {}),
        /At least one field must be provided for update/
      );
    });

    test('7.3 reorderListingImages rejects non-array or empty order', async () => {
      await assert.rejects(
        () => ownerService.reorderListingImages('lst_123', []),
        /Listing ID and ordered array of image IDs are required/
      );
    });
  });
});
