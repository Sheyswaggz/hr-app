import multer, { type StorageEngine, type FileFilterCallback } from 'multer';
import { type Request } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { getUploadConfig, formatFileSize } from '../config/upload.js';

/**
 * Multer Error Codes
 * 
 * Standard error codes from multer for file upload validation
 */
export enum MulterErrorCode {
  /**
   * File size limit exceeded
   */
  LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE',

  /**
   * Too many files uploaded
   */
  LIMIT_FILE_COUNT = 'LIMIT_FILE_COUNT',

  /**
   * Too many fields in request
   */
  LIMIT_FIELD_COUNT = 'LIMIT_FIELD_COUNT',

  /**
   * Field name too long
   */
  LIMIT_FIELD_KEY = 'LIMIT_FIELD_KEY',

  /**
   * Field value too long
   */
  LIMIT_FIELD_VALUE = 'LIMIT_FIELD_VALUE',

  /**
   * Too many parts in multipart request
   */
  LIMIT_PART_COUNT = 'LIMIT_PART_COUNT',

  /**
   * Unexpected field in request
   */
  LIMIT_UNEXPECTED_FILE = 'LIMIT_UNEXPECTED_FILE',
}

/**
 * Upload Error Response
 * 
 * Structured error response for file upload failures
 */
export interface UploadErrorResponse {
  /**
   * Whether upload was successful (always false for errors)
   */
  readonly success: false;

  /**
   * Error code for programmatic handling
   */
  readonly code: string;

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Additional error details
   */
  readonly details?: {
    /**
     * File that caused the error
     */
    readonly filename?: string;

    /**
     * MIME type of rejected file
     */
    readonly mimetype?: string;

    /**
     * File size in bytes
     */
    readonly size?: number;

    /**
     * Maximum allowed size
     */
    readonly maxSize?: number;

    /**
     * Allowed file types
     */
    readonly allowedTypes?: string[];
  };

  /**
   * Timestamp when error occurred
   */
  readonly timestamp: Date;
}

/**
 * File Upload Metadata
 * 
 * Extended file information after successful upload
 */
export interface UploadedFileMetadata {
  /**
   * Original filename from client
   */
  readonly originalName: string;

  /**
   * Generated filename on server
   */
  readonly filename: string;

  /**
   * File MIME type
   */
  readonly mimetype: string;

  /**
   * File size in bytes
   */
  readonly size: number;

  /**
   * Full path to uploaded file
   */
  readonly path: string;

  /**
   * Upload timestamp
   */
  readonly uploadedAt: Date;

  /**
   * File extension
   */
  readonly extension: string;
}

/**
 * Configure Multer Storage Engine
 * 
 * Creates a disk storage engine with unique filename generation
 * and directory creation.
 * 
 * @returns {StorageEngine} Configured multer storage engine
 */
function configureStorage(): StorageEngine {
  const config = getUploadConfig();

  console.log('[UPLOAD_MIDDLEWARE] Configuring multer storage:', {
    destination: config.uploadDir,
    timestamp: new Date().toISOString(),
  });

  // Ensure upload directory exists
  if (!fs.existsSync(config.uploadDir)) {
    console.log('[UPLOAD_MIDDLEWARE] Creating upload directory:', {
      path: config.uploadDir,
      timestamp: new Date().toISOString(),
    });

    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      console.log('[UPLOAD_MIDDLEWARE] Determining upload destination:', {
        originalName: file.originalname,
        mimetype: file.mimetype,
        destination: config.uploadDir,
        timestamp: new Date().toISOString(),
      });

      cb(null, config.uploadDir);
    },

    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      try {
        // Generate unique filename using timestamp and random bytes
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, extension)
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 50);

        const filename = `${timestamp}-${randomString}-${baseName}${extension}`;

        console.log('[UPLOAD_MIDDLEWARE] Generated unique filename:', {
          originalName: file.originalname,
          generatedName: filename,
          timestamp: new Date().toISOString(),
        });

        cb(null, filename);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error('[UPLOAD_MIDDLEWARE] Filename generation failed:', {
          originalName: file.originalname,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });

        cb(new Error(`Failed to generate filename: ${errorMessage}`), '');
      }
    },
  });
}

/**
 * Configure File Filter
 * 
 * Validates uploaded files against allowed MIME types.
 * 
 * @returns {Function} File filter function for multer
 */
function configureFileFilter(): (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void {
  const config = getUploadConfig();

  return (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const mimetype = file.mimetype.toLowerCase();

    console.log('[UPLOAD_MIDDLEWARE] Validating file type:', {
      originalName: file.originalname,
      mimetype,
      allowedTypes: config.allowedFileTypes,
      timestamp: new Date().toISOString(),
    });

    // Check if file type is allowed
    if (!config.fileFilter.isAllowed(mimetype)) {
      const errorMessage = config.fileFilter.getErrorMessage(mimetype);

      console.warn('[UPLOAD_MIDDLEWARE] File type rejected:', {
        originalName: file.originalname,
        mimetype,
        allowedTypes: config.allowedFileTypes,
        timestamp: new Date().toISOString(),
      });

      cb(new Error(errorMessage));
      return;
    }

    console.log('[UPLOAD_MIDDLEWARE] File type accepted:', {
      originalName: file.originalname,
      mimetype,
      timestamp: new Date().toISOString(),
    });

    cb(null, true);
  };
}

/**
 * Create Multer Upload Instance
 * 
 * Configures and returns a multer instance with storage, file filter,
 * and size limits.
 * 
 * @returns {multer.Multer} Configured multer instance
 */
function createUploadInstance(): multer.Multer {
  const config = getUploadConfig();

  console.log('[UPLOAD_MIDDLEWARE] Creating multer instance:', {
    maxFileSize: formatFileSize(config.maxFileSize),
    maxFiles: config.limits.files,
    allowedTypes: config.allowedFileTypes,
    timestamp: new Date().toISOString(),
  });

  const storage = configureStorage();
  const fileFilter = configureFileFilter();

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: config.limits.fileSize,
      files: config.limits.files,
      fields: config.limits.fields,
    },
  });
}

/**
 * Handle Multer Errors
 * 
 * Converts multer errors into structured error responses with
 * appropriate HTTP status codes.
 * 
 * @param {Error} error - Multer error
 * @returns {UploadErrorResponse} Structured error response
 */
export function handleMulterError(error: Error): UploadErrorResponse {
  const timestamp = new Date();
  const config = getUploadConfig();

  console.error('[UPLOAD_MIDDLEWARE] Upload error occurred:', {
    error: error.message,
    name: error.name,
    timestamp: timestamp.toISOString(),
  });

  // Handle multer-specific errors
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case MulterErrorCode.LIMIT_FILE_SIZE:
        return {
          success: false,
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${formatFileSize(config.maxFileSize)}`,
          details: {
            maxSize: config.maxFileSize,
          },
          timestamp,
        };

      case MulterErrorCode.LIMIT_FILE_COUNT:
        return {
          success: false,
          code: 'TOO_MANY_FILES',
          message: `Too many files uploaded. Maximum allowed: ${config.limits.files}`,
          timestamp,
        };

      case MulterErrorCode.LIMIT_UNEXPECTED_FILE:
        return {
          success: false,
          code: 'UNEXPECTED_FIELD',
          message: 'Unexpected file field in request',
          details: {
            filename: error.field,
          },
          timestamp,
        };

      case MulterErrorCode.LIMIT_FIELD_COUNT:
        return {
          success: false,
          code: 'TOO_MANY_FIELDS',
          message: 'Too many fields in request',
          timestamp,
        };

      default:
        return {
          success: false,
          code: 'UPLOAD_ERROR',
          message: error.message || 'File upload failed',
          timestamp,
        };
    }
  }

  // Handle file type validation errors
  if (error.message.includes('not allowed')) {
    return {
      success: false,
      code: 'INVALID_FILE_TYPE',
      message: error.message,
      details: {
        allowedTypes: config.allowedFileTypes,
      },
      timestamp,
    };
  }

  // Generic upload error
  return {
    success: false,
    code: 'UPLOAD_ERROR',
    message: error.message || 'File upload failed',
    timestamp,
  };
}

/**
 * Extract File Metadata
 * 
 * Extracts and formats metadata from uploaded file.
 * 
 * @param {Express.Multer.File} file - Uploaded file from multer
 * @returns {UploadedFileMetadata} Formatted file metadata
 */
export function extractFileMetadata(file: Express.Multer.File): UploadedFileMetadata {
  const extension = path.extname(file.originalname);

  console.log('[UPLOAD_MIDDLEWARE] Extracting file metadata:', {
    originalName: file.originalname,
    filename: file.filename,
    size: formatFileSize(file.size),
    mimetype: file.mimetype,
    timestamp: new Date().toISOString(),
  });

  return {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: new Date(),
    extension,
  };
}

/**
 * Validate Uploaded File
 * 
 * Performs additional validation on uploaded file beyond multer's
 * built-in validation.
 * 
 * @param {Express.Multer.File} file - Uploaded file
 * @returns {boolean} Whether file is valid
 */
export function validateUploadedFile(file: Express.Multer.File): boolean {
  const config = getUploadConfig();

  console.log('[UPLOAD_MIDDLEWARE] Validating uploaded file:', {
    originalName: file.originalname,
    size: formatFileSize(file.size),
    mimetype: file.mimetype,
    timestamp: new Date().toISOString(),
  });

  // Check file exists
  if (!fs.existsSync(file.path)) {
    console.error('[UPLOAD_MIDDLEWARE] Uploaded file not found:', {
      path: file.path,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  // Verify file size matches
  const stats = fs.statSync(file.path);
  if (stats.size !== file.size) {
    console.error('[UPLOAD_MIDDLEWARE] File size mismatch:', {
      expected: file.size,
      actual: stats.size,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  // Verify file is not empty
  if (stats.size === 0) {
    console.error('[UPLOAD_MIDDLEWARE] Empty file uploaded:', {
      originalName: file.originalname,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  console.log('[UPLOAD_MIDDLEWARE] File validation successful:', {
    originalName: file.originalname,
    size: formatFileSize(stats.size),
    timestamp: new Date().toISOString(),
  });

  return true;
}

/**
 * Delete Uploaded File
 * 
 * Safely deletes an uploaded file from the filesystem.
 * 
 * @param {string} filePath - Path to file to delete
 * @returns {boolean} Whether deletion was successful
 */
export function deleteUploadedFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('[UPLOAD_MIDDLEWARE] File not found for deletion:', {
        path: filePath,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    fs.unlinkSync(filePath);

    console.log('[UPLOAD_MIDDLEWARE] File deleted successfully:', {
      path: filePath,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[UPLOAD_MIDDLEWARE] File deletion failed:', {
      path: filePath,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return false;
  }
}

/**
 * Single File Upload Middleware
 * 
 * Multer middleware for uploading a single file.
 * 
 * @param {string} fieldName - Name of the file field in the request
 * @returns {RequestHandler} Express middleware
 */
export const uploadSingle = (fieldName: string) => {
  const upload = createUploadInstance();

  console.log('[UPLOAD_MIDDLEWARE] Creating single file upload middleware:', {
    fieldName,
    timestamp: new Date().toISOString(),
  });

  return upload.single(fieldName);
};

/**
 * Multiple Files Upload Middleware
 * 
 * Multer middleware for uploading multiple files.
 * 
 * @param {string} fieldName - Name of the file field in the request
 * @param {number} [maxCount] - Maximum number of files (optional)
 * @returns {RequestHandler} Express middleware
 */
export const uploadMultiple = (fieldName: string, maxCount?: number) => {
  const upload = createUploadInstance();
  const config = getUploadConfig();
  const limit = maxCount ?? config.limits.files;

  console.log('[UPLOAD_MIDDLEWARE] Creating multiple files upload middleware:', {
    fieldName,
    maxCount: limit,
    timestamp: new Date().toISOString(),
  });

  return upload.array(fieldName, limit);
};

/**
 * Multiple Fields Upload Middleware
 * 
 * Multer middleware for uploading files from multiple fields.
 * 
 * @param {Array<{name: string, maxCount?: number}>} fields - Field configurations
 * @returns {RequestHandler} Express middleware
 */
export const uploadFields = (fields: Array<{ name: string; maxCount?: number }>) => {
  const upload = createUploadInstance();

  console.log('[UPLOAD_MIDDLEWARE] Creating multiple fields upload middleware:', {
    fields: fields.map(f => ({ name: f.name, maxCount: f.maxCount })),
    timestamp: new Date().toISOString(),
  });

  return upload.fields(fields);
};

/**
 * Any Files Upload Middleware
 * 
 * Multer middleware for uploading any files (any field names).
 * Use with caution - prefer specific field names when possible.
 * 
 * @returns {RequestHandler} Express middleware
 */
export const uploadAny = () => {
  const upload = createUploadInstance();

  console.log('[UPLOAD_MIDDLEWARE] Creating any files upload middleware:', {
    timestamp: new Date().toISOString(),
  });

  return upload.any();
};

/**
 * No File Upload Middleware
 * 
 * Multer middleware for handling multipart/form-data without files.
 * Useful for forms that only contain text fields.
 * 
 * @returns {RequestHandler} Express middleware
 */
export const uploadNone = () => {
  const upload = createUploadInstance();

  console.log('[UPLOAD_MIDDLEWARE] Creating no file upload middleware:', {
    timestamp: new Date().toISOString(),
  });

  return upload.none();
};

/**
 * Default export - single file upload middleware
 */
export default uploadSingle;