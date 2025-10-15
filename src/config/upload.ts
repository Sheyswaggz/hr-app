/**
 * Upload Configuration Module
 * 
 * Provides centralized configuration for file upload functionality including
 * storage paths, file size limits, allowed file types, and multer storage configuration.
 * 
 * This module validates all configuration on load to ensure safe operation and
 * provides type-safe access to upload settings throughout the application.
 * 
 * @module src/config/upload
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { StorageEngine } from 'multer';
import multer from 'multer';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Allowed MIME types for file uploads
 */
export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * File extension mapping for allowed MIME types
 */
export type AllowedFileExtension = '.jpg' | '.jpeg' | '.png' | '.pdf' | '.doc' | '.docx';

/**
 * Upload configuration structure
 */
export interface UploadConfig {
  /**
   * Directory path for storing uploaded files
   * Can be relative or absolute path
   */
  readonly uploadDir: string;

  /**
   * Maximum file size in bytes
   * Default: 10MB (10485760 bytes)
   */
  readonly maxFileSize: number;

  /**
   * Array of allowed MIME types for uploads
   */
  readonly allowedFileTypes: readonly AllowedMimeType[];

  /**
   * Multer storage engine configuration
   */
  readonly storage: StorageEngine;

  /**
   * Whether to create upload directory if it doesn't exist
   */
  readonly createDirIfNotExists: boolean;

  /**
   * File naming strategy
   */
  readonly fileNaming: 'original' | 'uuid' | 'timestamp';

  /**
   * Whether to preserve file extensions
   */
  readonly preserveExtension: boolean;
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /**
   * Configuration field that failed validation
   */
  readonly field: string;

  /**
   * Validation error message
   */
  readonly message: string;

  /**
   * Current value that failed validation
   */
  readonly value?: unknown;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  /**
   * Whether file is valid
   */
  readonly valid: boolean;

  /**
   * Error message if invalid
   */
  readonly error?: string;

  /**
   * Detected MIME type
   */
  readonly mimeType?: string;

  /**
   * File extension
   */
  readonly extension?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default upload directory (relative to project root)
 */
const DEFAULT_UPLOAD_DIR = './uploads';

/**
 * Default maximum file size (10MB in bytes)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Default allowed file types
 */
const DEFAULT_ALLOWED_FILE_TYPES: readonly AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

/**
 * MIME type to file extension mapping
 */
const MIME_TYPE_EXTENSIONS: Record<AllowedMimeType, AllowedFileExtension[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

/**
 * Minimum allowed file size (1KB)
 */
const MIN_FILE_SIZE = 1024; // 1KB

/**
 * Maximum allowed file size (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load upload directory from environment or use default
 * 
 * @returns {string} Upload directory path
 */
function loadUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR;

  if (envDir && envDir.trim().length > 0) {
    const trimmedDir = envDir.trim();
    console.log('[UPLOAD_CONFIG] Using upload directory from environment:', {
      uploadDir: trimmedDir,
      timestamp: new Date().toISOString(),
    });
    return trimmedDir;
  }

  console.log('[UPLOAD_CONFIG] Using default upload directory:', {
    uploadDir: DEFAULT_UPLOAD_DIR,
    timestamp: new Date().toISOString(),
  });

  return DEFAULT_UPLOAD_DIR;
}

/**
 * Load maximum file size from environment or use default
 * 
 * @returns {number} Maximum file size in bytes
 */
function loadMaxFileSize(): number {
  const envSize = process.env.MAX_FILE_SIZE;

  if (envSize && envSize.trim().length > 0) {
    const parsedSize = parseInt(envSize.trim(), 10);

    if (!isNaN(parsedSize) && parsedSize > 0) {
      console.log('[UPLOAD_CONFIG] Using max file size from environment:', {
        maxFileSize: parsedSize,
        maxFileSizeMB: (parsedSize / (1024 * 1024)).toFixed(2),
        timestamp: new Date().toISOString(),
      });
      return parsedSize;
    }

    console.warn('[UPLOAD_CONFIG] Invalid MAX_FILE_SIZE in environment, using default:', {
      envValue: envSize,
      default: DEFAULT_MAX_FILE_SIZE,
      timestamp: new Date().toISOString(),
    });
  }

  console.log('[UPLOAD_CONFIG] Using default max file size:', {
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    maxFileSizeMB: (DEFAULT_MAX_FILE_SIZE / (1024 * 1024)).toFixed(2),
    timestamp: new Date().toISOString(),
  });

  return DEFAULT_MAX_FILE_SIZE;
}

/**
 * Load allowed file types from environment or use default
 * 
 * @returns {readonly AllowedMimeType[]} Array of allowed MIME types
 */
function loadAllowedFileTypes(): readonly AllowedMimeType[] {
  const envTypes = process.env.ALLOWED_FILE_TYPES;

  if (envTypes && envTypes.trim().length > 0) {
    const types = envTypes
      .split(',')
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    // Validate that all types are allowed
    const validTypes = types.filter((type) =>
      DEFAULT_ALLOWED_FILE_TYPES.includes(type as AllowedMimeType)
    ) as AllowedMimeType[];

    if (validTypes.length > 0) {
      console.log('[UPLOAD_CONFIG] Using allowed file types from environment:', {
        allowedFileTypes: validTypes,
        count: validTypes.length,
        timestamp: new Date().toISOString(),
      });
      return validTypes;
    }

    console.warn('[UPLOAD_CONFIG] No valid file types in environment, using default:', {
      envValue: envTypes,
      timestamp: new Date().toISOString(),
    });
  }

  console.log('[UPLOAD_CONFIG] Using default allowed file types:', {
    allowedFileTypes: DEFAULT_ALLOWED_FILE_TYPES,
    count: DEFAULT_ALLOWED_FILE_TYPES.length,
    timestamp: new Date().toISOString(),
  });

  return DEFAULT_ALLOWED_FILE_TYPES;
}

/**
 * Create multer disk storage configuration
 * 
 * @param {string} uploadDir - Upload directory path
 * @returns {StorageEngine} Multer storage engine
 */
function createStorageEngine(uploadDir: string): StorageEngine {
  return multer.diskStorage({
    destination: (req, file, callback) => {
      // Ensure upload directory exists
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          console.log('[UPLOAD_CONFIG] Created upload directory:', {
            uploadDir,
            timestamp: new Date().toISOString(),
          });
        }
        callback(null, uploadDir);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[UPLOAD_CONFIG] Failed to create upload directory:', {
          uploadDir,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        callback(new Error(`Failed to create upload directory: ${errorMessage}`), uploadDir);
      }
    },
    filename: (req, file, callback) => {
      try {
        // Generate unique filename with UUID and preserve extension
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const uniqueId = crypto.randomUUID();
        const timestamp = Date.now();
        const filename = `${uniqueId}-${timestamp}${fileExtension}`;

        console.log('[UPLOAD_CONFIG] Generated filename for upload:', {
          originalName: file.originalname,
          generatedName: filename,
          mimeType: file.mimetype,
          timestamp: new Date().toISOString(),
        });

        callback(null, filename);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[UPLOAD_CONFIG] Failed to generate filename:', {
          originalName: file.originalname,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        callback(new Error(`Failed to generate filename: ${errorMessage}`), '');
      }
    },
  });
}

/**
 * Load complete upload configuration
 * 
 * @returns {UploadConfig} Upload configuration object
 */
function loadUploadConfig(): UploadConfig {
  console.log('[UPLOAD_CONFIG] Loading upload configuration...', {
    timestamp: new Date().toISOString(),
  });

  const uploadDir = loadUploadDir();
  const maxFileSize = loadMaxFileSize();
  const allowedFileTypes = loadAllowedFileTypes();
  const storage = createStorageEngine(uploadDir);

  const config: UploadConfig = {
    uploadDir,
    maxFileSize,
    allowedFileTypes,
    storage,
    createDirIfNotExists: true,
    fileNaming: 'uuid',
    preserveExtension: true,
  };

  console.log('[UPLOAD_CONFIG] Upload configuration loaded successfully:', {
    uploadDir: config.uploadDir,
    maxFileSize: config.maxFileSize,
    maxFileSizeMB: (config.maxFileSize / (1024 * 1024)).toFixed(2),
    allowedFileTypesCount: config.allowedFileTypes.length,
    timestamp: new Date().toISOString(),
  });

  return config;
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validate upload configuration
 * 
 * @param {UploadConfig} config - Configuration to validate
 * @returns {ConfigValidationError[]} Array of validation errors (empty if valid)
 */
function validateUploadConfig(config: UploadConfig): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  console.log('[UPLOAD_CONFIG] Validating upload configuration...', {
    timestamp: new Date().toISOString(),
  });

  // Validate upload directory
  if (!config.uploadDir || config.uploadDir.trim().length === 0) {
    errors.push({
      field: 'uploadDir',
      message: 'Upload directory is required',
      value: config.uploadDir,
    });
  }

  // Validate max file size
  if (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0) {
    errors.push({
      field: 'maxFileSize',
      message: 'Max file size must be a positive number',
      value: config.maxFileSize,
    });
  } else if (config.maxFileSize < MIN_FILE_SIZE) {
    errors.push({
      field: 'maxFileSize',
      message: `Max file size must be at least ${MIN_FILE_SIZE} bytes (1KB)`,
      value: config.maxFileSize,
    });
  } else if (config.maxFileSize > MAX_FILE_SIZE) {
    errors.push({
      field: 'maxFileSize',
      message: `Max file size cannot exceed ${MAX_FILE_SIZE} bytes (50MB)`,
      value: config.maxFileSize,
    });
  }

  // Validate allowed file types
  if (!Array.isArray(config.allowedFileTypes) || config.allowedFileTypes.length === 0) {
    errors.push({
      field: 'allowedFileTypes',
      message: 'At least one allowed file type is required',
      value: config.allowedFileTypes,
    });
  } else {
    // Validate each file type
    const invalidTypes = config.allowedFileTypes.filter(
      (type) => !DEFAULT_ALLOWED_FILE_TYPES.includes(type)
    );

    if (invalidTypes.length > 0) {
      errors.push({
        field: 'allowedFileTypes',
        message: `Invalid file types: ${invalidTypes.join(', ')}`,
        value: invalidTypes,
      });
    }
  }

  // Validate storage engine
  if (!config.storage) {
    errors.push({
      field: 'storage',
      message: 'Storage engine is required',
      value: config.storage,
    });
  }

  if (errors.length > 0) {
    console.error('[UPLOAD_CONFIG] Configuration validation failed:', {
      errorCount: errors.length,
      errors: errors.map((e) => ({ field: e.field, message: e.message })),
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log('[UPLOAD_CONFIG] Configuration validation passed', {
      timestamp: new Date().toISOString(),
    });
  }

  return errors;
}

/**
 * Ensure upload directory exists and is writable
 * 
 * @param {string} uploadDir - Upload directory path
 * @throws {Error} If directory cannot be created or is not writable
 */
function ensureUploadDirectory(uploadDir: string): void {
  try {
    console.log('[UPLOAD_CONFIG] Ensuring upload directory exists:', {
      uploadDir,
      timestamp: new Date().toISOString(),
    });

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('[UPLOAD_CONFIG] Created upload directory:', {
        uploadDir,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if directory is writable
    fs.accessSync(uploadDir, fs.constants.W_OK);

    console.log('[UPLOAD_CONFIG] Upload directory is accessible and writable:', {
      uploadDir,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[UPLOAD_CONFIG] Failed to ensure upload directory:', {
      uploadDir,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Upload directory error: ${errorMessage}`);
  }
}

// ============================================================================
// File Validation Utilities
// ============================================================================

/**
 * Validate file MIME type
 * 
 * @param {string} mimeType - MIME type to validate
 * @param {readonly AllowedMimeType[]} allowedTypes - Allowed MIME types
 * @returns {boolean} Whether MIME type is allowed
 */
export function isAllowedMimeType(
  mimeType: string,
  allowedTypes: readonly AllowedMimeType[]
): boolean {
  return allowedTypes.includes(mimeType as AllowedMimeType);
}

/**
 * Validate file extension
 * 
 * @param {string} filename - Filename to validate
 * @param {readonly AllowedMimeType[]} allowedTypes - Allowed MIME types
 * @returns {boolean} Whether file extension is allowed
 */
export function isAllowedExtension(
  filename: string,
  allowedTypes: readonly AllowedMimeType[]
): boolean {
  const extension = path.extname(filename).toLowerCase() as AllowedFileExtension;

  return allowedTypes.some((mimeType) =>
    MIME_TYPE_EXTENSIONS[mimeType].includes(extension)
  );
}

/**
 * Get file extension for MIME type
 * 
 * @param {AllowedMimeType} mimeType - MIME type
 * @returns {AllowedFileExtension} Primary file extension
 */
export function getExtensionForMimeType(mimeType: AllowedMimeType): AllowedFileExtension {
  return MIME_TYPE_EXTENSIONS[mimeType][0]!;
}

/**
 * Validate file size
 * 
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} Whether file size is within limit
 */
export function isValidFileSize(fileSize: number, maxSize: number): boolean {
  return fileSize > 0 && fileSize <= maxSize;
}

/**
 * Format file size for display
 * 
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// Configuration Instance
// ============================================================================

/**
 * Singleton configuration instance
 */
let uploadConfigInstance: UploadConfig | null = null;

/**
 * Get upload configuration instance
 * 
 * Loads and validates configuration on first access.
 * Subsequent calls return the cached instance.
 * 
 * @returns {UploadConfig} Upload configuration
 * @throws {Error} If configuration is invalid
 */
export function getUploadConfig(): UploadConfig {
  if (!uploadConfigInstance) {
    console.log('[UPLOAD_CONFIG] Initializing upload configuration...', {
      timestamp: new Date().toISOString(),
    });

    uploadConfigInstance = loadUploadConfig();

    // Validate configuration
    const errors = validateUploadConfig(uploadConfigInstance);
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
      throw new Error(
        `[UPLOAD_CONFIG] Invalid upload configuration:\n${errorMessages}`
      );
    }

    // Ensure upload directory exists
    ensureUploadDirectory(uploadConfigInstance.uploadDir);

    console.log('[UPLOAD_CONFIG] Upload configuration initialized successfully', {
      timestamp: new Date().toISOString(),
    });
  }

  return uploadConfigInstance;
}

/**
 * Reset upload configuration (for testing)
 * 
 * @internal
 */
export function resetUploadConfig(): void {
  uploadConfigInstance = null;
  console.log('[UPLOAD_CONFIG] Configuration reset', {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get masked configuration for logging (hides sensitive paths)
 * 
 * @returns {Record<string, unknown>} Masked configuration
 */
export function getMaskedUploadConfig(): Record<string, unknown> {
  try {
    const config = getUploadConfig();
    return {
      uploadDir: config.uploadDir,
      maxFileSize: config.maxFileSize,
      maxFileSizeMB: (config.maxFileSize / (1024 * 1024)).toFixed(2),
      allowedFileTypes: config.allowedFileTypes,
      createDirIfNotExists: config.createDirIfNotExists,
      fileNaming: config.fileNaming,
      preserveExtension: config.preserveExtension,
    };
  } catch (error) {
    return {
      error: 'Failed to load configuration',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default export: Upload configuration instance
 */
export default getUploadConfig();

/**
 * Export constants for external use
 */
export {
  DEFAULT_UPLOAD_DIR,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ALLOWED_FILE_TYPES,
  MIME_TYPE_EXTENSIONS,
  MIN_FILE_SIZE,
  MAX_FILE_SIZE,
};