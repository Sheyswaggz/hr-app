/**
 * File Upload Middleware Module
 * 
 * Provides Express middleware for handling file uploads using multer with comprehensive
 * validation, error handling, and security measures. Implements file type validation,
 * size limits, and secure filename generation.
 * 
 * This middleware integrates with the upload configuration module to enforce consistent
 * file upload policies across the application.
 * 
 * @module src/middleware/upload
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer, { type Multer, type MulterError } from 'multer';
import path from 'path';

import {
  getUploadConfig,
  isAllowedMimeType,
  isAllowedExtension,
  isValidFileSize,
  formatFileSize,
  type AllowedMimeType,
} from '../config/upload';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended Express Request with file upload information
 */
export interface UploadRequest extends Request {
  /**
   * Uploaded file (single file upload)
   */
  file?: Express.Multer.File;

  /**
   * Uploaded files (multiple file upload)
   */
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };

  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;
}

/**
 * File upload validation error details
 */
export interface FileValidationError {
  /**
   * Error code for programmatic handling
   */
  readonly code: string;

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Field name that caused the error
   */
  readonly field?: string;

  /**
   * Additional error context
   */
  readonly details?: Record<string, unknown>;
}

/**
 * File upload error response
 */
export interface UploadErrorResponse {
  /**
   * Whether upload was successful (always false for errors)
   */
  readonly success: false;

  /**
   * Error code
   */
  readonly code: string;

  /**
   * Error message
   */
  readonly message: string;

  /**
   * Additional error details
   */
  readonly details?: Record<string, unknown>;

  /**
   * Timestamp when error occurred
   */
  readonly timestamp: Date;
}

/**
 * Upload middleware options
 */
export interface UploadMiddlewareOptions {
  /**
   * Field name for file upload
   */
  readonly fieldName?: string;

  /**
   * Maximum number of files (for multiple uploads)
   */
  readonly maxCount?: number;

  /**
   * Whether to allow multiple files
   */
  readonly multiple?: boolean;

  /**
   * Custom file size limit (overrides config)
   */
  readonly maxFileSize?: number;

  /**
   * Custom allowed file types (overrides config)
   */
  readonly allowedFileTypes?: readonly AllowedMimeType[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default field name for file uploads
 */
const DEFAULT_FIELD_NAME = 'file';

/**
 * Default maximum number of files for multiple uploads
 */
const DEFAULT_MAX_COUNT = 10;

/**
 * HTTP status codes for upload errors
 */
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate correlation ID for request tracing
 * 
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get client IP address from request
 * 
 * @param {Request} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Send upload error response
 * 
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Record<string, unknown>} [details] - Additional error details
 */
function sendUploadError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void {
  const errorResponse: UploadErrorResponse = {
    success: false,
    code,
    message,
    details,
    timestamp: new Date(),
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Validate file against allowed types and size
 * 
 * @param {Express.Multer.File} file - File to validate
 * @param {UploadMiddlewareOptions} [options] - Validation options
 * @returns {FileValidationError | null} Validation error or null if valid
 */
function validateFile(
  file: Express.Multer.File,
  options?: UploadMiddlewareOptions
): FileValidationError | null {
  const config = getUploadConfig();
  const allowedTypes = options?.allowedFileTypes || config.allowedFileTypes;
  const maxSize = options?.maxFileSize || config.maxFileSize;

  // Validate MIME type
  if (!isAllowedMimeType(file.mimetype, allowedTypes)) {
    return {
      code: 'INVALID_FILE_TYPE',
      message: `File type '${file.mimetype}' is not allowed`,
      field: file.fieldname,
      details: {
        allowedTypes: Array.from(allowedTypes),
        receivedType: file.mimetype,
        filename: file.originalname,
      },
    };
  }

  // Validate file extension
  if (!isAllowedExtension(file.originalname, allowedTypes)) {
    const extension = path.extname(file.originalname).toLowerCase();
    return {
      code: 'INVALID_FILE_EXTENSION',
      message: `File extension '${extension}' is not allowed`,
      field: file.fieldname,
      details: {
        allowedTypes: Array.from(allowedTypes),
        receivedExtension: extension,
        filename: file.originalname,
      },
    };
  }

  // Validate file size
  if (!isValidFileSize(file.size, maxSize)) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`,
      field: file.fieldname,
      details: {
        maxSize,
        maxSizeFormatted: formatFileSize(maxSize),
        fileSize: file.size,
        fileSizeFormatted: formatFileSize(file.size),
        filename: file.originalname,
      },
    };
  }

  return null;
}

/**
 * Create multer file filter function
 * 
 * @param {UploadMiddlewareOptions} [options] - Filter options
 * @returns {multer.Options['fileFilter']} Multer file filter function
 */
function createFileFilter(
  options?: UploadMiddlewareOptions
): multer.Options['fileFilter'] {
  return (
    req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ): void => {
    const correlationId = (req as UploadRequest).correlationId || generateCorrelationId();

    console.log('[UPLOAD_MIDDLEWARE] Filtering file:', {
      correlationId,
      filename: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      timestamp: new Date().toISOString(),
    });

    const config = getUploadConfig();
    const allowedTypes = options?.allowedFileTypes || config.allowedFileTypes;

    // Validate MIME type
    if (!isAllowedMimeType(file.mimetype, allowedTypes)) {
      console.warn('[UPLOAD_MIDDLEWARE] File type not allowed:', {
        correlationId,
        filename: file.originalname,
        mimetype: file.mimetype,
        allowedTypes: Array.from(allowedTypes),
        timestamp: new Date().toISOString(),
      });

      callback(
        new Error(
          `File type '${file.mimetype}' is not allowed. Allowed types: ${Array.from(allowedTypes).join(', ')}`
        )
      );
      return;
    }

    // Validate file extension
    if (!isAllowedExtension(file.originalname, allowedTypes)) {
      const extension = path.extname(file.originalname).toLowerCase();

      console.warn('[UPLOAD_MIDDLEWARE] File extension not allowed:', {
        correlationId,
        filename: file.originalname,
        extension,
        allowedTypes: Array.from(allowedTypes),
        timestamp: new Date().toISOString(),
      });

      callback(
        new Error(
          `File extension '${extension}' is not allowed. Allowed types: ${Array.from(allowedTypes).join(', ')}`
        )
      );
      return;
    }

    console.log('[UPLOAD_MIDDLEWARE] File filter passed:', {
      correlationId,
      filename: file.originalname,
      mimetype: file.mimetype,
      timestamp: new Date().toISOString(),
    });

    callback(null, true);
  };
}

/**
 * Create multer instance with configuration
 * 
 * @param {UploadMiddlewareOptions} [options] - Upload options
 * @returns {Multer} Configured multer instance
 */
function createMulterInstance(options?: UploadMiddlewareOptions): Multer {
  const config = getUploadConfig();
  const maxFileSize = options?.maxFileSize || config.maxFileSize;

  const multerConfig: multer.Options = {
    storage: config.storage,
    limits: {
      fileSize: maxFileSize,
      files: options?.maxCount || DEFAULT_MAX_COUNT,
    },
    fileFilter: createFileFilter(options),
  };

  console.log('[UPLOAD_MIDDLEWARE] Creating multer instance:', {
    maxFileSize,
    maxFileSizeMB: (maxFileSize / (1024 * 1024)).toFixed(2),
    maxFiles: multerConfig.limits?.files,
    timestamp: new Date().toISOString(),
  });

  return multer(multerConfig);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle multer errors and send appropriate response
 * 
 * @param {Error} error - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function handleMulterError(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req as UploadRequest).correlationId || generateCorrelationId();
  const clientIp = getClientIp(req);

  console.error('[UPLOAD_MIDDLEWARE] Upload error:', {
    correlationId,
    clientIp,
    error: error.message,
    errorName: error.name,
    timestamp: new Date().toISOString(),
  });

  // Handle multer-specific errors
  if (error instanceof multer.MulterError) {
    const multerError = error as MulterError;

    switch (multerError.code) {
      case 'LIMIT_FILE_SIZE': {
        const config = getUploadConfig();
        sendUploadError(
          res,
          HTTP_STATUS.PAYLOAD_TOO_LARGE,
          'FILE_TOO_LARGE',
          `File size exceeds maximum allowed size of ${formatFileSize(config.maxFileSize)}`,
          {
            maxSize: config.maxFileSize,
            maxSizeFormatted: formatFileSize(config.maxFileSize),
            field: multerError.field,
          }
        );
        return;
      }

      case 'LIMIT_FILE_COUNT': {
        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'TOO_MANY_FILES',
          'Too many files uploaded',
          {
            field: multerError.field,
          }
        );
        return;
      }

      case 'LIMIT_UNEXPECTED_FILE': {
        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'UNEXPECTED_FIELD',
          `Unexpected file field: ${multerError.field}`,
          {
            field: multerError.field,
          }
        );
        return;
      }

      case 'LIMIT_PART_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
      case 'LIMIT_FIELD_COUNT': {
        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_REQUEST',
          'Invalid upload request format',
          {
            code: multerError.code,
            field: multerError.field,
          }
        );
        return;
      }

      default: {
        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'UPLOAD_ERROR',
          multerError.message || 'File upload failed',
          {
            code: multerError.code,
            field: multerError.field,
          }
        );
        return;
      }
    }
  }

  // Handle file filter errors (invalid file type/extension)
  if (error.message.includes('not allowed')) {
    sendUploadError(
      res,
      HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      'INVALID_FILE_TYPE',
      error.message,
      {}
    );
    return;
  }

  // Handle generic errors
  sendUploadError(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'UPLOAD_ERROR',
    'An error occurred during file upload',
    {
      error: error.message,
    }
  );
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Create upload middleware for single file upload
 * 
 * @param {UploadMiddlewareOptions} [options] - Upload options
 * @returns {RequestHandler} Express middleware function
 * 
 * @example
 * app.post('/upload', uploadSingle({ fieldName: 'document' }), (req, res) => {
 *   console.log(req.file);
 *   res.json({ success: true, file: req.file });
 * });
 */
export function uploadSingle(options?: UploadMiddlewareOptions): RequestHandler {
  const fieldName = options?.fieldName || DEFAULT_FIELD_NAME;
  const upload = createMulterInstance(options);

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();
    const clientIp = getClientIp(req);

    // Attach correlation ID to request
    (req as UploadRequest).correlationId = correlationId;

    console.log('[UPLOAD_MIDDLEWARE] Single file upload started:', {
      correlationId,
      clientIp,
      fieldName,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    upload.single(fieldName)(req, res, (error: unknown) => {
      const executionTimeMs = Date.now() - startTime;

      if (error) {
        console.error('[UPLOAD_MIDDLEWARE] Single file upload failed:', {
          correlationId,
          clientIp,
          fieldName,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        handleMulterError(error as Error, req, res, next);
        return;
      }

      const uploadReq = req as UploadRequest;

      if (!uploadReq.file) {
        console.warn('[UPLOAD_MIDDLEWARE] No file uploaded:', {
          correlationId,
          clientIp,
          fieldName,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'NO_FILE',
          'No file uploaded',
          { fieldName }
        );
        return;
      }

      // Additional validation after multer processing
      const validationError = validateFile(uploadReq.file, options);
      if (validationError) {
        console.warn('[UPLOAD_MIDDLEWARE] File validation failed:', {
          correlationId,
          clientIp,
          fieldName,
          error: validationError,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendUploadError(
          res,
          HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          validationError.code,
          validationError.message,
          validationError.details
        );
        return;
      }

      console.log('[UPLOAD_MIDDLEWARE] Single file upload successful:', {
        correlationId,
        clientIp,
        fieldName,
        filename: uploadReq.file.originalname,
        mimetype: uploadReq.file.mimetype,
        size: uploadReq.file.size,
        sizeFormatted: formatFileSize(uploadReq.file.size),
        path: uploadReq.file.path,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
    });
  };
}

/**
 * Create upload middleware for multiple file upload
 * 
 * @param {UploadMiddlewareOptions} [options] - Upload options
 * @returns {RequestHandler} Express middleware function
 * 
 * @example
 * app.post('/upload-multiple', uploadMultiple({ fieldName: 'documents', maxCount: 5 }), (req, res) => {
 *   console.log(req.files);
 *   res.json({ success: true, files: req.files });
 * });
 */
export function uploadMultiple(options?: UploadMiddlewareOptions): RequestHandler {
  const fieldName = options?.fieldName || DEFAULT_FIELD_NAME;
  const maxCount = options?.maxCount || DEFAULT_MAX_COUNT;
  const upload = createMulterInstance(options);

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();
    const clientIp = getClientIp(req);

    // Attach correlation ID to request
    (req as UploadRequest).correlationId = correlationId;

    console.log('[UPLOAD_MIDDLEWARE] Multiple file upload started:', {
      correlationId,
      clientIp,
      fieldName,
      maxCount,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    upload.array(fieldName, maxCount)(req, res, (error: unknown) => {
      const executionTimeMs = Date.now() - startTime;

      if (error) {
        console.error('[UPLOAD_MIDDLEWARE] Multiple file upload failed:', {
          correlationId,
          clientIp,
          fieldName,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        handleMulterError(error as Error, req, res, next);
        return;
      }

      const uploadReq = req as UploadRequest;
      const files = uploadReq.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        console.warn('[UPLOAD_MIDDLEWARE] No files uploaded:', {
          correlationId,
          clientIp,
          fieldName,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendUploadError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          'NO_FILES',
          'No files uploaded',
          { fieldName }
        );
        return;
      }

      // Validate all uploaded files
      const validationErrors: FileValidationError[] = [];
      for (const file of files) {
        const validationError = validateFile(file, options);
        if (validationError) {
          validationErrors.push(validationError);
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[UPLOAD_MIDDLEWARE] File validation failed:', {
          correlationId,
          clientIp,
          fieldName,
          errorCount: validationErrors.length,
          errors: validationErrors,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendUploadError(
          res,
          HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          'VALIDATION_FAILED',
          'One or more files failed validation',
          {
            errors: validationErrors,
            validFileCount: files.length - validationErrors.length,
            totalFileCount: files.length,
          }
        );
        return;
      }

      console.log('[UPLOAD_MIDDLEWARE] Multiple file upload successful:', {
        correlationId,
        clientIp,
        fieldName,
        fileCount: files.length,
        files: files.map((f) => ({
          filename: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          sizeFormatted: formatFileSize(f.size),
        })),
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalSizeFormatted: formatFileSize(files.reduce((sum, f) => sum + f.size, 0)),
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
    });
  };
}

/**
 * Create upload middleware for optional file upload
 * 
 * Allows requests without files to pass through without error.
 * 
 * @param {UploadMiddlewareOptions} [options] - Upload options
 * @returns {RequestHandler} Express middleware function
 * 
 * @example
 * app.post('/profile', uploadOptional({ fieldName: 'avatar' }), (req, res) => {
 *   if (req.file) {
 *     console.log('Avatar uploaded:', req.file);
 *   }
 *   res.json({ success: true });
 * });
 */
export function uploadOptional(options?: UploadMiddlewareOptions): RequestHandler {
  const fieldName = options?.fieldName || DEFAULT_FIELD_NAME;
  const upload = createMulterInstance(options);

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();
    const clientIp = getClientIp(req);

    // Attach correlation ID to request
    (req as UploadRequest).correlationId = correlationId;

    console.log('[UPLOAD_MIDDLEWARE] Optional file upload started:', {
      correlationId,
      clientIp,
      fieldName,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    upload.single(fieldName)(req, res, (error: unknown) => {
      const executionTimeMs = Date.now() - startTime;

      if (error) {
        console.error('[UPLOAD_MIDDLEWARE] Optional file upload failed:', {
          correlationId,
          clientIp,
          fieldName,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        handleMulterError(error as Error, req, res, next);
        return;
      }

      const uploadReq = req as UploadRequest;

      if (!uploadReq.file) {
        console.log('[UPLOAD_MIDDLEWARE] No file uploaded (optional):', {
          correlationId,
          clientIp,
          fieldName,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        next();
        return;
      }

      // Validate uploaded file
      const validationError = validateFile(uploadReq.file, options);
      if (validationError) {
        console.warn('[UPLOAD_MIDDLEWARE] File validation failed:', {
          correlationId,
          clientIp,
          fieldName,
          error: validationError,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendUploadError(
          res,
          HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          validationError.code,
          validationError.message,
          validationError.details
        );
        return;
      }

      console.log('[UPLOAD_MIDDLEWARE] Optional file upload successful:', {
        correlationId,
        clientIp,
        fieldName,
        filename: uploadReq.file.originalname,
        mimetype: uploadReq.file.mimetype,
        size: uploadReq.file.size,
        sizeFormatted: formatFileSize(uploadReq.file.size),
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
    });
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export: Single file upload middleware with default options
 */
export default uploadSingle();

/**
 * Export all middleware functions and types
 */
export type {
  UploadRequest,
  FileValidationError,
  UploadErrorResponse,
  UploadMiddlewareOptions,
};