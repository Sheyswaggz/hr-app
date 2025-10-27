/**
 * File Upload Validation Utilities
 * 
 * Provides comprehensive client-side validation for file uploads including
 * type checking, size validation, and formatting utilities.
 * 
 * @module utils/fileValidation
 */

/**
 * Maximum allowed file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Allowed file MIME types for document uploads
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/**
 * Allowed file extensions mapped to their MIME types
 */
export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
} as const;

/**
 * Human-readable file type descriptions
 */
export const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word Document (DOC)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (DOCX)',
  'image/jpeg': 'JPEG Image',
  'image/jpg': 'JPG Image',
  'image/png': 'PNG Image',
} as const;

/**
 * File validation result interface
 */
export interface FileValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Validates if a file's MIME type is in the allowed list
 * 
 * @param file - File object to validate
 * @param allowedTypes - Array of allowed MIME types (defaults to ALLOWED_FILE_TYPES)
 * @returns true if file type is allowed, false otherwise
 * 
 * @example
 * ```typescript
 * const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
 * const isValid = validateFileType(file); // true
 * 
 * const invalidFile = new File(['content'], 'script.exe', { type: 'application/x-msdownload' });
 * const isInvalid = validateFileType(invalidFile); // false
 * ```
 */
export function validateFileType(
  file: File,
  allowedTypes: readonly string[] = ALLOWED_FILE_TYPES
): boolean {
  if (!file || !file.type) {
    console.warn('[FileValidation] File or file type is missing', {
      fileName: file?.name,
      fileType: file?.type,
    });
    return false;
  }

  const isAllowed = allowedTypes.includes(file.type);

  if (!isAllowed) {
    console.warn('[FileValidation] File type not allowed', {
      fileName: file.name,
      fileType: file.type,
      allowedTypes: Array.from(allowedTypes),
    });
  }

  return isAllowed;
}

/**
 * Validates if a file's size is within the allowed limit
 * 
 * @param file - File object to validate
 * @param maxSize - Maximum allowed file size in bytes (defaults to MAX_FILE_SIZE)
 * @returns true if file size is within limit, false otherwise
 * 
 * @example
 * ```typescript
 * const smallFile = new File(['content'], 'small.pdf', { type: 'application/pdf' });
 * const isValid = validateFileSize(smallFile); // true
 * 
 * const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.pdf');
 * const isInvalid = validateFileSize(largeFile); // false
 * ```
 */
export function validateFileSize(
  file: File,
  maxSize: number = MAX_FILE_SIZE
): boolean {
  if (!file || typeof file.size !== 'number') {
    console.warn('[FileValidation] File or file size is missing', {
      fileName: file?.name,
      fileSize: file?.size,
    });
    return false;
  }

  const isValid = file.size <= maxSize;

  if (!isValid) {
    console.warn('[FileValidation] File size exceeds limit', {
      fileName: file.name,
      fileSize: file.size,
      maxSize,
      formattedSize: formatFileSize(file.size),
      formattedMaxSize: formatFileSize(maxSize),
    });
  }

  return isValid;
}

/**
 * Formats file size in bytes to human-readable string
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string with appropriate unit (B, KB, MB, GB)
 * 
 * @example
 * ```typescript
 * formatFileSize(1024); // "1.00 KB"
 * formatFileSize(1536); // "1.50 KB"
 * formatFileSize(1048576); // "1.00 MB"
 * formatFileSize(5242880); // "5.00 MB"
 * formatFileSize(0); // "0 B"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || bytes < 0) {
    console.error('[FileValidation] Invalid bytes value for formatting', {
      bytes,
      type: typeof bytes,
    });
    return '0 B';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const k = 1024;
  const decimals = 2;

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(k, unitIndex);

  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * Extracts file extension from filename
 * 
 * @param filename - Name of the file
 * @returns Lowercase file extension without the dot, or empty string if no extension
 * 
 * @example
 * ```typescript
 * getFileExtension('document.pdf'); // "pdf"
 * getFileExtension('image.JPG'); // "jpg"
 * getFileExtension('archive.tar.gz'); // "gz"
 * getFileExtension('noextension'); // ""
 * getFileExtension('.hidden'); // ""
 * ```
 */
export function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    console.warn('[FileValidation] Invalid filename provided', {
      filename,
      type: typeof filename,
    });
    return '';
  }

  const trimmedFilename = filename.trim();
  
  if (!trimmedFilename || trimmedFilename === '.') {
    return '';
  }

  const lastDotIndex = trimmedFilename.lastIndexOf('.');
  
  // No extension or hidden file (starts with dot)
  if (lastDotIndex <= 0) {
    return '';
  }

  const extension = trimmedFilename.slice(lastDotIndex + 1).toLowerCase();
  
  return extension;
}

/**
 * Validates file extension against allowed extensions
 * 
 * @param filename - Name of the file
 * @returns true if extension is allowed, false otherwise
 */
export function validateFileExtension(filename: string): boolean {
  const extension = getFileExtension(filename);
  
  if (!extension) {
    console.warn('[FileValidation] No file extension found', { filename });
    return false;
  }

  const isAllowed = Object.keys(ALLOWED_EXTENSIONS).includes(extension);

  if (!isAllowed) {
    console.warn('[FileValidation] File extension not allowed', {
      filename,
      extension,
      allowedExtensions: Object.keys(ALLOWED_EXTENSIONS),
    });
  }

  return isAllowed;
}

/**
 * Comprehensive file validation combining type, size, and extension checks
 * 
 * @param file - File object to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
 * const result = validateFile(file);
 * if (result.valid) {
 *   // Proceed with upload
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateFile(
  file: File,
  options?: {
    readonly maxSize?: number;
    readonly allowedTypes?: readonly string[];
  }
): FileValidationResult {
  const maxSize = options?.maxSize ?? MAX_FILE_SIZE;
  const allowedTypes = options?.allowedTypes ?? ALLOWED_FILE_TYPES;

  // Validate file exists
  if (!file) {
    return {
      valid: false,
      error: 'No file provided',
    };
  }

  // Validate file extension
  if (!validateFileExtension(file.name)) {
    const allowedExtensions = Object.keys(ALLOWED_EXTENSIONS).join(', ').toUpperCase();
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedExtensions}`,
    };
  }

  // Validate MIME type
  if (!validateFileType(file, allowedTypes)) {
    const typeLabels = allowedTypes
      .map(type => FILE_TYPE_LABELS[type] || type)
      .join(', ');
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${typeLabels}`,
    };
  }

  // Validate file size
  if (!validateFileSize(file, maxSize)) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`,
    };
  }

  console.info('[FileValidation] File validation successful', {
    fileName: file.name,
    fileType: file.type,
    fileSize: formatFileSize(file.size),
  });

  return {
    valid: true,
  };
}

/**
 * Gets human-readable error message for file validation
 * 
 * @param file - File that failed validation
 * @returns User-friendly error message
 */
export function getFileValidationError(file: File): string {
  const result = validateFile(file);
  return result.error || 'File validation failed';
}

/**
 * Checks if file type matches expected MIME type based on extension
 * 
 * @param file - File to check
 * @returns true if MIME type matches extension, false otherwise
 */
export function isFileTypeMismatch(file: File): boolean {
  const extension = getFileExtension(file.name);
  
  if (!extension) {
    return true;
  }

  const expectedTypes = ALLOWED_EXTENSIONS[extension];
  
  if (!expectedTypes) {
    return true;
  }

  const matches = expectedTypes.includes(file.type);

  if (!matches) {
    console.warn('[FileValidation] File type mismatch detected', {
      fileName: file.name,
      extension,
      actualType: file.type,
      expectedTypes,
    });
  }

  return !matches;
}

/**
 * Gets list of allowed file extensions as a string for display
 * 
 * @returns Comma-separated list of allowed extensions
 */
export function getAllowedExtensionsString(): string {
  return Object.keys(ALLOWED_EXTENSIONS)
    .map(ext => ext.toUpperCase())
    .join(', ');
}

/**
 * Gets list of allowed file types as a string for display
 * 
 * @returns Comma-separated list of allowed file type labels
 */
export function getAllowedTypesString(): string {
  return ALLOWED_FILE_TYPES
    .map(type => FILE_TYPE_LABELS[type] || type)
    .join(', ');
}

/**
 * Creates an accept attribute string for HTML file input
 * 
 * @returns Accept attribute value for file input
 * 
 * @example
 * ```typescript
 * <input type="file" accept={getAcceptAttribute()} />
 * ```
 */
export function getAcceptAttribute(): string {
  return ALLOWED_FILE_TYPES.join(',');
}

export default {
  validateFileType,
  validateFileSize,
  formatFileSize,
  getFileExtension,
  validateFileExtension,
  validateFile,
  getFileValidationError,
  isFileTypeMismatch,
  getAllowedExtensionsString,
  getAllowedTypesString,
  getAcceptAttribute,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  FILE_TYPE_LABELS,
};