/**
 * File Validation Utilities Test Suite
 * 
 * Comprehensive tests for client-side file validation including type checking,
 * size validation, and formatting utilities.
 * 
 * @module tests/utils/fileValidation.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  formatFileSize,
  getFileExtension,
  validateFileExtension,
  validateFile,
  isFileTypeMismatch,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
} from '../../src/utils/fileValidation';

describe('fileValidation', () => {
  // Suppress console warnings during tests
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  describe('validateFileType', () => {
    it('accepts valid PDF file type', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('accepts valid Word document (DOC) file type', () => {
      const file = new File(['content'], 'document.doc', {
        type: 'application/msword',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('accepts valid Word document (DOCX) file type', () => {
      const file = new File(['content'], 'document.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('accepts valid JPEG image file type', () => {
      const file = new File(['content'], 'image.jpg', {
        type: 'image/jpeg',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('accepts valid JPG image file type', () => {
      const file = new File(['content'], 'image.jpg', {
        type: 'image/jpg',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('accepts valid PNG image file type', () => {
      const file = new File(['content'], 'image.png', {
        type: 'image/png',
      });

      const result = validateFileType(file);

      expect(result).toBe(true);
    });

    it('rejects invalid executable file type', () => {
      const file = new File(['content'], 'malware.exe', {
        type: 'application/x-msdownload',
      });

      const result = validateFileType(file);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        '[FileValidation] File type not allowed',
        expect.objectContaining({
          fileName: 'malware.exe',
          fileType: 'application/x-msdownload',
        })
      );
    });

    it('rejects invalid script file type', () => {
      const file = new File(['content'], 'script.js', {
        type: 'application/javascript',
      });

      const result = validateFileType(file);

      expect(result).toBe(false);
    });

    it('rejects file with no type', () => {
      const file = new File(['content'], 'unknown', {
        type: '',
      });

      const result = validateFileType(file);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        '[FileValidation] File or file type is missing',
        expect.any(Object)
      );
    });

    it('rejects null file', () => {
      const result = validateFileType(null as any);

      expect(result).toBe(false);
    });

    it('rejects undefined file', () => {
      const result = validateFileType(undefined as any);

      expect(result).toBe(false);
    });

    it('accepts file with custom allowed types', () => {
      const file = new File(['content'], 'data.json', {
        type: 'application/json',
      });

      const result = validateFileType(file, ['application/json']);

      expect(result).toBe(true);
    });

    it('rejects file not in custom allowed types', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileType(file, ['application/json']);

      expect(result).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('accepts file under size limit', () => {
      const smallContent = new ArrayBuffer(1024); // 1KB
      const file = new File([smallContent], 'small.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file);

      expect(result).toBe(true);
    });

    it('accepts file at exact size limit', () => {
      const exactContent = new ArrayBuffer(MAX_FILE_SIZE);
      const file = new File([exactContent], 'exact.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file);

      expect(result).toBe(true);
    });

    it('rejects file over size limit', () => {
      const largeContent = new ArrayBuffer(MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        '[FileValidation] File size exceeds limit',
        expect.objectContaining({
          fileName: 'large.pdf',
          fileSize: MAX_FILE_SIZE + 1,
          maxSize: MAX_FILE_SIZE,
        })
      );
    });

    it('accepts file with custom size limit', () => {
      const content = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      const file = new File([content], 'medium.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file, 6 * 1024 * 1024); // 6MB limit

      expect(result).toBe(true);
    });

    it('rejects file over custom size limit', () => {
      const content = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      const file = new File([content], 'medium.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file, 4 * 1024 * 1024); // 4MB limit

      expect(result).toBe(false);
    });

    it('accepts zero-byte file', () => {
      const file = new File([], 'empty.txt', {
        type: 'text/plain',
      });

      const result = validateFileSize(file);

      expect(result).toBe(true);
    });

    it('rejects null file', () => {
      const result = validateFileSize(null as any);

      expect(result).toBe(false);
    });

    it('rejects file with undefined size', () => {
      const file = { name: 'test.pdf', size: undefined } as any;

      const result = validateFileSize(file);

      expect(result).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(100)).toBe('100.00 B');
      expect(formatFileSize(999)).toBe('999.00 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(2048)).toBe('2.00 KB');
      expect(formatFileSize(10240)).toBe('10.00 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(5242880)).toBe('5.00 MB');
      expect(formatFileSize(10485760)).toBe('10.00 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
      expect(formatFileSize(5368709120)).toBe('5.00 GB');
    });

    it('formats terabytes correctly', () => {
      expect(formatFileSize(1099511627776)).toBe('1.00 TB');
    });

    it('handles decimal values correctly', () => {
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1572864)).toBe('1.50 MB');
    });

    it('handles negative values', () => {
      expect(formatFileSize(-1024)).toBe('0 B');
      expect(console.error).toHaveBeenCalledWith(
        '[FileValidation] Invalid bytes value for formatting',
        expect.objectContaining({
          bytes: -1024,
        })
      );
    });

    it('handles non-number values', () => {
      expect(formatFileSize(NaN)).toBe('0 B');
      expect(formatFileSize('1024' as any)).toBe('0 B');
      expect(formatFileSize(null as any)).toBe('0 B');
      expect(formatFileSize(undefined as any)).toBe('0 B');
    });

    it('handles very large numbers', () => {
      const result = formatFileSize(Number.MAX_SAFE_INTEGER);
      expect(result).toMatch(/TB$/);
    });
  });

  describe('getFileExtension', () => {
    it('extracts extension from simple filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.jpg')).toBe('jpg');
      expect(getFileExtension('data.json')).toBe('json');
    });

    it('extracts extension from filename with multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
      expect(getFileExtension('backup.2024.01.15.zip')).toBe('zip');
    });

    it('converts extension to lowercase', () => {
      expect(getFileExtension('IMAGE.JPG')).toBe('jpg');
      expect(getFileExtension('Document.PDF')).toBe('pdf');
      expect(getFileExtension('File.DOCX')).toBe('docx');
    });

    it('handles filename with path', () => {
      expect(getFileExtension('/path/to/document.pdf')).toBe('pdf');
      expect(getFileExtension('C:\\Users\\Documents\\file.docx')).toBe('docx');
    });

    it('returns empty string for filename without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('returns empty string for hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('');
      expect(getFileExtension('.env')).toBe('');
    });

    it('returns empty string for filename ending with dot', () => {
      expect(getFileExtension('file.')).toBe('');
    });

    it('handles empty string', () => {
      expect(getFileExtension('')).toBe('');
    });

    it('handles whitespace-only string', () => {
      expect(getFileExtension('   ')).toBe('');
    });

    it('handles null and undefined', () => {
      expect(getFileExtension(null as any)).toBe('');
      expect(getFileExtension(undefined as any)).toBe('');
    });

    it('handles non-string values', () => {
      expect(getFileExtension(123 as any)).toBe('');
      expect(getFileExtension({} as any)).toBe('');
    });

    it('trims whitespace from filename', () => {
      expect(getFileExtension('  document.pdf  ')).toBe('pdf');
    });
  });

  describe('validateFileExtension', () => {
    it('accepts allowed PDF extension', () => {
      expect(validateFileExtension('document.pdf')).toBe(true);
    });

    it('accepts allowed DOC extension', () => {
      expect(validateFileExtension('document.doc')).toBe(true);
    });

    it('accepts allowed DOCX extension', () => {
      expect(validateFileExtension('document.docx')).toBe(true);
    });

    it('accepts allowed JPG extension', () => {
      expect(validateFileExtension('image.jpg')).toBe(true);
    });

    it('accepts allowed JPEG extension', () => {
      expect(validateFileExtension('image.jpeg')).toBe(true);
    });

    it('accepts allowed PNG extension', () => {
      expect(validateFileExtension('image.png')).toBe(true);
    });

    it('accepts uppercase extensions', () => {
      expect(validateFileExtension('document.PDF')).toBe(true);
      expect(validateFileExtension('image.JPG')).toBe(true);
    });

    it('rejects disallowed extensions', () => {
      expect(validateFileExtension('script.js')).toBe(false);
      expect(validateFileExtension('malware.exe')).toBe(false);
      expect(validateFileExtension('data.json')).toBe(false);
    });

    it('rejects filename without extension', () => {
      expect(validateFileExtension('README')).toBe(false);
    });

    it('rejects hidden files', () => {
      expect(validateFileExtension('.gitignore')).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('validates valid PDF file successfully', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates valid image file successfully', () => {
      const file = new File(['content'], 'image.jpg', {
        type: 'image/jpeg',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects file with invalid extension', () => {
      const file = new File(['content'], 'script.js', {
        type: 'application/javascript',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
      expect(result.error).toContain('PDF, DOC, DOCX, JPG, JPEG, PNG');
    });

    it('rejects file with invalid MIME type', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/javascript',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('rejects file exceeding size limit', () => {
      const largeContent = new ArrayBuffer(MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.pdf', {
        type: 'application/pdf',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds maximum');
      expect(result.error).toContain('10.00 MB');
    });

    it('rejects null file', () => {
      const result = validateFile(null as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('rejects undefined file', () => {
      const result = validateFile(undefined as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('validates with custom size limit', () => {
      const content = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      const file = new File([content], 'medium.pdf', {
        type: 'application/pdf',
      });

      const result = validateFile(file, {
        maxSize: 6 * 1024 * 1024, // 6MB limit
      });

      expect(result.valid).toBe(true);
    });

    it('validates with custom allowed types', () => {
      const file = new File(['content'], 'data.json', {
        type: 'application/json',
      });

      const result = validateFile(file, {
        allowedTypes: ['application/json'],
      });

      expect(result.valid).toBe(false); // Extension not in ALLOWED_EXTENSIONS
    });

    it('logs successful validation', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      validateFile(file);

      expect(console.info).toHaveBeenCalledWith(
        '[FileValidation] File validation successful',
        expect.objectContaining({
          fileName: 'document.pdf',
          fileType: 'application/pdf',
        })
      );
    });
  });

  describe('isFileTypeMismatch', () => {
    it('detects no mismatch for correct PDF', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });

      const result = isFileTypeMismatch(file);

      expect(result).toBe(false);
    });

    it('detects no mismatch for correct JPEG', () => {
      const file = new File(['content'], 'image.jpg', {
        type: 'image/jpeg',
      });

      const result = isFileTypeMismatch(file);

      expect(result).toBe(false);
    });

    it('detects mismatch for PDF with wrong MIME type', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'image/jpeg',
      });

      const result = isFileTypeMismatch(file);

      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        '[FileValidation] File type mismatch detected',
        expect.objectContaining({
          fileName: 'document.pdf',
          extension: 'pdf',
          actualType: 'image/jpeg',
        })
      );
    });

    it('detects mismatch for file without extension', () => {
      const file = new File(['content'], 'README', {
        type: 'text/plain',
      });

      const result = isFileTypeMismatch(file);

      expect(result).toBe(true);
    });

    it('detects mismatch for unknown extension', () => {
      const file = new File(['content'], 'script.js', {
        type: 'application/javascript',
      });

      const result = isFileTypeMismatch(file);

      expect(result).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles File objects with missing properties gracefully', () => {
      const malformedFile = {
        name: 'test.pdf',
      } as File;

      expect(validateFileType(malformedFile)).toBe(false);
      expect(validateFileSize(malformedFile)).toBe(false);
    });

    it('handles extremely large file sizes', () => {
      const hugeContent = new ArrayBuffer(Number.MAX_SAFE_INTEGER);
      const file = new File([hugeContent], 'huge.pdf', {
        type: 'application/pdf',
      });

      const result = validateFileSize(file);

      expect(result).toBe(false);
    });

    it('handles special characters in filenames', () => {
      expect(getFileExtension('file (1).pdf')).toBe('pdf');
      expect(getFileExtension('file@#$%.jpg')).toBe('jpg');
      expect(getFileExtension('文档.pdf')).toBe('pdf');
    });

    it('handles very long filenames', () => {
      const longName = 'a'.repeat(1000) + '.pdf';
      expect(getFileExtension(longName)).toBe('pdf');
    });

    it('validates all allowed file types from constants', () => {
      ALLOWED_FILE_TYPES.forEach((mimeType) => {
        const extension = Object.keys(ALLOWED_EXTENSIONS).find((ext) =>
          ALLOWED_EXTENSIONS[ext].includes(mimeType)
        );

        if (extension) {
          const file = new File(['content'], `test.${extension}`, {
            type: mimeType,
          });

          expect(validateFileType(file)).toBe(true);
        }
      });
    });
  });

  describe('integration scenarios', () => {
    it('validates complete file upload workflow', () => {
      const file = new File(['content'], 'onboarding-doc.pdf', {
        type: 'application/pdf',
      });

      // Step 1: Validate extension
      expect(validateFileExtension(file.name)).toBe(true);

      // Step 2: Validate MIME type
      expect(validateFileType(file)).toBe(true);

      // Step 3: Validate size
      expect(validateFileSize(file)).toBe(true);

      // Step 4: Check for type mismatch
      expect(isFileTypeMismatch(file)).toBe(false);

      // Step 5: Complete validation
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('handles multiple validation failures', () => {
      const largeContent = new ArrayBuffer(MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'malware.exe', {
        type: 'application/x-msdownload',
      });

      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('validates file with correct extension but wrong MIME type', () => {
      const file = new File(['content'], 'document.pdf', {
        type: 'text/plain',
      });

      expect(validateFileExtension(file.name)).toBe(true);
      expect(validateFileType(file)).toBe(false);
      expect(isFileTypeMismatch(file)).toBe(true);

      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });
  });
});