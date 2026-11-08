import multer from 'multer';
import { sendError } from '../utils/apiResponse.js';

/**
 * ShopFinder — Image Upload Middleware & Concurrency Controller (Phase 6, Task 6.3)
 *
 * Implements in-memory multipart upload handling using Multer, with:
 * 1. Process-level concurrency limit (max 2 concurrent in-memory uploads).
 * 2. Maximum single file size: 5 MB (5,242,880 bytes).
 * 3. Maximum aggregate upload size: 50 MB (52,428,800 bytes).
 * 4. Maximum files per request: 20.
 * 5. Magic-byte signature verification (JPEG, PNG, WebP) preventing spoofed MIME types.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_AGGREGATE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES_PER_REQUEST = 20;
const MAX_CONCURRENT_UPLOADS = 2;

let activeUploads = 0;

/**
 * Validates the file buffer magic bytes to ensure the content matches an allowed format.
 * Allowed formats: image/jpeg, image/png, image/webp.
 *
 * @param {Buffer} buffer
 * @returns {'image/jpeg' | 'image/png' | 'image/webp' | null} Detected MIME type or null
 */
export function detectImageSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Multer memory storage instance with file-level limits and extension/mime pre-filtering.
 */
const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const declaredMime = (file.mimetype || '').toLowerCase();

    if (!allowedMimes.includes(declaredMime)) {
      const err = new Error('Invalid file format. Only JPEG, PNG, and WebP images are allowed.');
      err.status = 400;
      return cb(err, false);
    }

    cb(null, true);
  },
});

/**
 * Concurrency Limiter Middleware for In-Memory Uploads.
 * Enforces maximum 2 concurrent uploads across the Node.js process.
 * Releases the slot unconditionally on finish or close.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function uploadConcurrencyGuard(req, res, next) {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many concurrent uploads. Please try again shortly.',
      },
    });
  }

  activeUploads++;
  let released = false;

  const release = () => {
    if (!released) {
      released = true;
      activeUploads = Math.max(0, activeUploads - 1);
    }
  };

  res.on('finish', release);
  res.on('close', release);

  next();
}

/**
 * Returns current active upload count (for testing/diagnostics).
 *
 * @returns {number}
 */
export function getActiveUploadCount() {
  return activeUploads;
}

/**
 * Express Middleware: Handles multipart upload for the 'images' field with full validation.
 *
 * Checks:
 * 1. Multer errors (file size >5MB, file count >20).
 * 2. Empty upload (0 files).
 * 3. Aggregate upload size (>50MB).
 * 4. Magic-byte signature verification on each buffer (rejects spoofed extensions/MIMEs).
 * 5. Rejects 0-byte/empty files.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function handleListingImageUpload(req, res, next) {
  multerUpload.array('images', MAX_FILES_PER_REQUEST)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'File too large. Maximum size is 5MB per image.', 400);
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return sendError(res, 'Too many files. Maximum is 20 images per request.', 400);
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return sendError(res, "Unexpected field. Images must be uploaded under the 'images' field.", 400);
        }
        return sendError(res, err.message, 400);
      }
      return sendError(res, err.message, err.status || 400);
    }

    const files = req.files;

    // Check empty upload
    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendError(res, 'No image files provided', 400);
    }

    // Check aggregate upload size
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size || file.buffer?.length || 0;
    }
    if (totalSize > MAX_AGGREGATE_SIZE) {
      return sendError(res, 'Aggregate upload size exceeds 50MB limit', 400);
    }

    // Validate magic bytes and reject empty/spoofed files
    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        return sendError(res, 'Empty image files are not allowed', 400);
      }

      const detected = detectImageSignature(file.buffer);
      if (!detected) {
        return sendError(
          res,
          'Invalid file content. File is not a valid JPEG, PNG, or WebP image.',
          400
        );
      }

      // Check for MIME mismatch between declared header and actual binary signature
      const declared = (file.mimetype || '').toLowerCase();
      if (declared === 'image/jpg') {
        // Normalize jpg alias
        file.mimetype = 'image/jpeg';
      }

      if (file.mimetype !== detected) {
        return sendError(
          res,
          `File content mismatch: declared ${file.mimetype} but file content signature is ${detected}.`,
          400
        );
      }
    }

    next();
  });
}

/**
 * Validates avatar image buffer signatures (JPEG, PNG, WebP, and SVG).
 *
 * @param {Buffer} buffer
 * @returns {'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml' | null}
 */
export function detectAvatarSignature(buffer) {
  const rasterSignature = detectImageSignature(buffer);
  if (rasterSignature) {
    return rasterSignature;
  }

  // SVG detection: UTF-8 inspection looking for <svg tag
  if (buffer && Buffer.isBuffer(buffer) && buffer.length >= 4) {
    const text = buffer.subarray(0, 1024).toString('utf8').trim().toLowerCase();
    if (text.includes('<svg') || (text.includes('<?xml') && text.includes('<svg'))) {
      return 'image/svg+xml';
    }
  }

  return null;
}

const multerAvatarUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 5 MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    let declaredMime = (file.mimetype || '').toLowerCase();
    if (declaredMime === 'image/jpg') {
      declaredMime = 'image/jpeg';
      file.mimetype = 'image/jpeg';
    }

    if (!allowedMimes.includes(declaredMime)) {
      const err = new Error('Invalid file format. Only JPEG, PNG, WebP, and SVG images are allowed.');
      err.status = 400;
      return cb(err, false);
    }

    cb(null, true);
  },
});

/**
 * Express Middleware: Handles avatar upload for owner profile updates.
 * Supports both application/json (passes through) and multipart/form-data.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function handleAvatarUpload(req, res, next) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }

  multerAvatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'Avatar file too large. Maximum size is 5MB.', 400);
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return sendError(res, "Unexpected field. Avatar must be uploaded under the 'avatar' field.", 400);
        }
        return sendError(res, err.message, 400);
      }
      return sendError(res, err.message, err.status || 400);
    }

    if (req.file) {
      if (!req.file.buffer || req.file.buffer.length === 0) {
        return sendError(res, 'Empty avatar files are not allowed', 400);
      }

      const detected = detectAvatarSignature(req.file.buffer);
      if (!detected) {
        return sendError(
          res,
          'Invalid file content. File is not a valid JPEG, PNG, WebP, or SVG image.',
          400
        );
      }

      let declared = (req.file.mimetype || '').toLowerCase();
      if (declared === 'image/jpg') declared = 'image/jpeg';

      if (declared !== detected && !(declared === 'image/svg+xml' && detected === 'image/svg+xml')) {
        return sendError(
          res,
          `File content mismatch: declared ${req.file.mimetype} but file content signature is ${detected}.`,
          400
        );
      }
    }

    next();
  });
}

