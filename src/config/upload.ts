import path from 'path';
import crypto from 'crypto';

/**
 * Upload Configuration Interface
 * 
 * Defines the structure for file upload configuration including
 * storage paths, size limits, and allowed file types.
 */
export interface UploadConfig {
  /**
   * Directory path for storing uploaded files
   * Can be absolute or relative to project root
   */
  readonly uploadDir: string;

  /**
   * Maximum file size in bytes
   * Default: 10MB (10485760 bytes)
   */
  readonly maxFileSize: number;

  /**
   * Array of allowed MIME types for file uploads
   * Default: PDF, DOC, DOCX, JPG, PNG
   */
  readonly allowedFileTypes: string[];

  /**
   * Multer storage configuration
   * Defines how and where files are stored
   */
  readonly storage: {
    /**
     * Destination directory for uploads
     */
    readonly destination: string;

    /**
     * File naming strategy
     */
    readonly filename: (originalName: string) => string;
  };

  /**
   * File filter configuration
   */
  readonly fileFilter: {
    /**
     * Check if file type is allowed
     */
    readonly isAllowed: (mimetype: string) => boolean;

    /**
     * Get error message for rejected file
     */
    readonly getErrorMessage: (mimetype: string) => string;
  };

  /**
   * Additional upload limits
   */
  readonly limits: {
    /**
     * Maximum file size in bytes
     */
    readonly fileSize: number;

    /**
     * Maximum number of files per request
     */
    readonly files: number;

    /**
     * Maximum number of fields
     */
    readonly fields: number;
  };
}

/**
 * Upload Configuration Validation Error
 */
export interface UploadConfigValidationError {
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
 * Default configuration values
 */
const DEFAULT_UPLOAD_DIR = './uploads';
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const DEFAULT_ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FIELDS = 20;

/**
 * Load upload configuration from environment variables
 * 
 * @returns {UploadConfig} Upload configuration object
 * @throws {Error} If configuration validation fails
 */
function loadUploadConfig(): UploadConfig {
  console.log('[UPLOAD_CONFIG] Loading upload configuration from environment...');

  // Load upload directory from environment
  const uploadDir = process.env.UPLOAD_DIR?.trim() || DEFAULT_UPLOAD_DIR;

  // Load max file size from environment
  let maxFileSize = DEFAULT_MAX_FILE_SIZE;
  if (process.env.MAX_FILE_SIZE) {
    const parsedSize = parseInt(process.env.MAX_FILE_SIZE, 10);
    if (!isNaN(parsedSize) && parsedSize > 0) {
      maxFileSize = parsedSize;
    } else {
      console.warn('[UPLOAD_CONFIG] Invalid MAX_FILE_SIZE, using default:', {
        provided: process.env.MAX_FILE_SIZE,
        default: DEFAULT_MAX_FILE_SIZE,
      });
    }
  }

  // Load allowed file types from environment
  let allowedFileTypes = DEFAULT_ALLOWED_FILE_TYPES;
  if (process.env.ALLOWED_FILE_TYPES) {
    const types = process.env.ALLOWED_FILE_TYPES
      .split(',')
      .map(type => type.trim())
      .filter(type => type.length > 0);
    
    if (types.length > 0) {
      allowedFileTypes = types;
    } else {
      console.warn('[UPLOAD_CONFIG] Invalid ALLOWED_FILE_TYPES, using defaults:', {
        provided: process.env.ALLOWED_FILE_TYPES,
        default: DEFAULT_ALLOWED_FILE_TYPES,
      });
    }
  }

  // Resolve upload directory to absolute path
  const absoluteUploadDir = path.isAbsolute(uploadDir)
    ? uploadDir
    : path.resolve(process.cwd(), uploadDir);

  console.log('[UPLOAD_CONFIG] Configuration loaded:', {
    uploadDir: absoluteUploadDir,
    maxFileSize,
    allowedFileTypesCount: allowedFileTypes.length,
    timestamp: new Date().toISOString(),
  });

  // Build configuration object
  const config: UploadConfig = {
    uploadDir: absoluteUploadDir,
    maxFileSize,
    allowedFileTypes,
    storage: {
      destination: absoluteUploadDir,
      filename: (originalName: string): string => {
        // Generate unique filename with timestamp and random string
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension)
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 50); // Limit base name length
        
        return `${timestamp}-${randomString}-${baseName}${extension}`;
      },
    },
    fileFilter: {
      isAllowed: (mimetype: string): boolean => {
        return allowedFileTypes.includes(mimetype.toLowerCase());
      },
      getErrorMessage: (mimetype: string): string => {
        return `File type '${mimetype}' is not allowed. Allowed types: ${allowedFileTypes.join(', ')}`;
      },
    },
    limits: {
      fileSize: maxFileSize,
      files: DEFAULT_MAX_FILES,
      fields: DEFAULT_MAX_FIELDS,
    },
  };

  return config;
}

/**
 * Validate upload configuration
 * 
 * Performs comprehensive validation of upload configuration to ensure
 * all values are valid and within acceptable ranges.
 * 
 * @param {UploadConfig} config - Upload configuration to validate
 * @returns {UploadConfigValidationError[]} Array of validation errors (empty if valid)
 */
export function validateUploadConfig(config: UploadConfig): UploadConfigValidationError[] {
  const errors: UploadConfigValidationError[] = [];

  console.log('[UPLOAD_CONFIG] Validating upload configuration...');

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
  }

  // Warn if max file size is very large (> 100MB)
  if (config.maxFileSize > 100 * 1024 * 1024) {
    console.warn('[UPLOAD_CONFIG] Max file size is very large:', {
      maxFileSize: config.maxFileSize,
      maxFileSizeMB: Math.round(config.maxFileSize / (1024 * 1024)),
      recommendation: 'Consider reducing to improve performance and security',
    });
  }

  // Validate allowed file types
  if (!Array.isArray(config.allowedFileTypes)) {
    errors.push({
      field: 'allowedFileTypes',
      message: 'Allowed file types must be an array',
      value: config.allowedFileTypes,
    });
  } else if (config.allowedFileTypes.length === 0) {
    errors.push({
      field: 'allowedFileTypes',
      message: 'At least one file type must be allowed',
      value: config.allowedFileTypes,
    });
  } else {
    // Validate each MIME type format
    const invalidTypes = config.allowedFileTypes.filter(type => {
      return typeof type !== 'string' || 
             type.trim().length === 0 || 
             !type.includes('/');
    });

    if (invalidTypes.length > 0) {
      errors.push({
        field: 'allowedFileTypes',
        message: 'Invalid MIME type format detected',
        value: invalidTypes,
      });
    }
  }

  // Validate storage configuration
  if (!config.storage) {
    errors.push({
      field: 'storage',
      message: 'Storage configuration is required',
      value: config.storage,
    });
  } else {
    if (!config.storage.destination || config.storage.destination.trim().length === 0) {
      errors.push({
        field: 'storage.destination',
        message: 'Storage destination is required',
        value: config.storage.destination,
      });
    }

    if (typeof config.storage.filename !== 'function') {
      errors.push({
        field: 'storage.filename',
        message: 'Storage filename must be a function',
        value: typeof config.storage.filename,
      });
    }
  }

  // Validate file filter configuration
  if (!config.fileFilter) {
    errors.push({
      field: 'fileFilter',
      message: 'File filter configuration is required',
      value: config.fileFilter,
    });
  } else {
    if (typeof config.fileFilter.isAllowed !== 'function') {
      errors.push({
        field: 'fileFilter.isAllowed',
        message: 'File filter isAllowed must be a function',
        value: typeof config.fileFilter.isAllowed,
      });
    }

    if (typeof config.fileFilter.getErrorMessage !== 'function') {
      errors.push({
        field: 'fileFilter.getErrorMessage',
        message: 'File filter getErrorMessage must be a function',
        value: typeof config.fileFilter.getErrorMessage,
      });
    }
  }

  // Validate limits configuration
  if (!config.limits) {
    errors.push({
      field: 'limits',
      message: 'Limits configuration is required',
      value: config.limits,
    });
  } else {
    if (typeof config.limits.fileSize !== 'number' || config.limits.fileSize <= 0) {
      errors.push({
        field: 'limits.fileSize',
        message: 'Limits fileSize must be a positive number',
        value: config.limits.fileSize,
      });
    }

    if (typeof config.limits.files !== 'number' || config.limits.files <= 0) {
      errors.push({
        field: 'limits.files',
        message: 'Limits files must be a positive number',
        value: config.limits.files,
      });
    }

    if (typeof config.limits.fields !== 'number' || config.limits.fields <= 0) {
      errors.push({
        field: 'limits.fields',
        message: 'Limits fields must be a positive number',
        value: config.limits.fields,
      });
    }
  }

  if (errors.length > 0) {
    console.error('[UPLOAD_CONFIG] Configuration validation failed:', {
      errorCount: errors.length,
      errors: errors.map(e => ({ field: e.field, message: e.message })),
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log('[UPLOAD_CONFIG] Configuration validation successful');
  }

  return errors;
}

/**
 * Get human-readable file size string
 * 
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from MIME type
 * 
 * @param {string} mimetype - MIME type
 * @returns {string} File extension (with dot)
 */
export function getExtensionFromMimeType(mimetype: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
  };

  return mimeToExt[mimetype.toLowerCase()] || '';
}

/**
 * Singleton instance of upload configuration
 */
let uploadConfigInstance: UploadConfig | null = null;

/**
 * Get upload configuration
 * 
 * Returns the singleton instance of upload configuration.
 * Loads and validates configuration on first call.
 * 
 * @returns {UploadConfig} Upload configuration object
 * @throws {Error} If configuration validation fails
 */
export function getUploadConfig(): UploadConfig {
  if (!uploadConfigInstance) {
    console.log('[UPLOAD_CONFIG] Initializing upload configuration...');

    uploadConfigInstance = loadUploadConfig();

    // Validate configuration
    const errors = validateUploadConfig(uploadConfigInstance);
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `  - ${e.field}: ${e.message}`).join('\n');
      console.error('[UPLOAD_CONFIG] Configuration validation failed:', {
        errors,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        `[UPLOAD_CONFIG] Invalid upload configuration:\n${errorMessages}`
      );
    }

    console.log('[UPLOAD_CONFIG] Upload configuration initialized successfully:', {
      uploadDir: uploadConfigInstance.uploadDir,
      maxFileSize: formatFileSize(uploadConfigInstance.maxFileSize),
      allowedFileTypes: uploadConfigInstance.allowedFileTypes,
      timestamp: new Date().toISOString(),
    });
  }

  return uploadConfigInstance;
}

/**
 * Reset upload configuration
 * 
 * Clears the singleton instance, forcing reload on next access.
 * Useful for testing or configuration updates.
 */
export function resetUploadConfig(): void {
  uploadConfigInstance = null;
  console.log('[UPLOAD_CONFIG] Configuration reset');
}

/**
 * Get masked configuration for logging
 * 
 * Returns configuration with sensitive information masked.
 * Safe to log or expose in API responses.
 * 
 * @returns {Record<string, unknown>} Masked configuration object
 */
export function getMaskedUploadConfig(): Record<string, unknown> {
  try {
    const config = getUploadConfig();
    return {
      uploadDir: config.uploadDir,
      maxFileSize: config.maxFileSize,
      maxFileSizeFormatted: formatFileSize(config.maxFileSize),
      allowedFileTypes: config.allowedFileTypes,
      limits: {
        fileSize: config.limits.fileSize,
        fileSizeFormatted: formatFileSize(config.limits.fileSize),
        files: config.limits.files,
        fields: config.limits.fields,
      },
      storage: {
        destination: config.storage.destination,
        filenameStrategy: 'timestamp-random-basename',
      },
    };
  } catch (error) {
    return {
      error: 'Failed to load configuration',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if file type is allowed
 * 
 * @param {string} mimetype - MIME type to check
 * @returns {boolean} True if file type is allowed
 */
export function isFileTypeAllowed(mimetype: string): boolean {
  try {
    const config = getUploadConfig();
    return config.fileFilter.isAllowed(mimetype);
  } catch (error) {
    console.error('[UPLOAD_CONFIG] Failed to check file type:', {
      mimetype,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get error message for rejected file type
 * 
 * @param {string} mimetype - MIME type that was rejected
 * @returns {string} Error message
 */
export function getFileTypeErrorMessage(mimetype: string): string {
  try {
    const config = getUploadConfig();
    return config.fileFilter.getErrorMessage(mimetype);
  } catch (error) {
    return `File type '${mimetype}' is not allowed`;
  }
}

// Export default configuration getter
export default getUploadConfig();