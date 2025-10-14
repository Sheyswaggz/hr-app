/**
 * Password Utility Unit Tests
 * 
 * Comprehensive test suite for password hashing, comparison, and validation utilities.
 * Tests all edge cases, error conditions, and security requirements.
 * Uses mocked bcrypt for deterministic test execution.
 * 
 * @module tests/unit/utils/password.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcrypt';

import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  validatePasswordWithFeedback,
  needsRehash,
  type PasswordHashResult,
  type PasswordComparisonResult,
  type PasswordValidationResult,
} from '../../../src/utils/password.js';
import * as authConfig from '../../../src/config/auth.js';

// Mock bcrypt for deterministic tests
vi.mock('bcrypt');

// Mock auth config
vi.mock('../../../src/config/auth.js', () => ({
  getAuthConfig: vi.fn(() => ({
    password: {
      saltRounds: 10,
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  })),
}));

describe('Password Utilities', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console after each test
    vi.restoreAllMocks();
  });

  describe('hashPassword', () => {
    it('should successfully hash a valid password', async () => {
      const password = 'MySecureP@ssw0rd';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.success).toBe(true);
      expect(result.hash).toBe(mockHash);
      expect(result.error).toBeUndefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, mockSalt);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'MySecureP@ssw0rd';
      const mockSalt1 = '$2b$10$salt1abcdefghijklmnopq';
      const mockSalt2 = '$2b$10$salt2abcdefghijklmnopq';
      const mockHash1 = '$2b$10$hash1abcdefghijklmnopqrstuvwxyz1234567890ABCDEF';
      const mockHash2 = '$2b$10$hash2abcdefghijklmnopqrstuvwxyz1234567890ABCDEF';

      // First call
      vi.mocked(bcrypt.genSalt).mockResolvedValueOnce(mockSalt1 as never);
      vi.mocked(bcrypt.hash).mockResolvedValueOnce(mockHash1 as never);

      const result1 = await hashPassword(password);

      // Second call
      vi.mocked(bcrypt.genSalt).mockResolvedValueOnce(mockSalt2 as never);
      vi.mocked(bcrypt.hash).mockResolvedValueOnce(mockHash2 as never);

      const result2 = await hashPassword(password);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.hash).toBe(mockHash1);
      expect(result2.hash).toBe(mockHash2);
    });

    it('should reject non-string password', async () => {
      const invalidPassword = 123 as unknown as string;

      const result = await hashPassword(invalidPassword);

      expect(result.success).toBe(false);
      expect(result.hash).toBeUndefined();
      expect(result.error).toBe('Password must be a string');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should reject empty password', async () => {
      const emptyPassword = '';

      const result = await hashPassword(emptyPassword);

      expect(result.success).toBe(false);
      expect(result.hash).toBeUndefined();
      expect(result.error).toBe('Password cannot be empty');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should handle bcrypt.genSalt error', async () => {
      const password = 'MySecureP@ssw0rd';
      const mockError = new Error('Salt generation failed');

      vi.mocked(bcrypt.genSalt).mockRejectedValue(mockError);

      const result = await hashPassword(password);

      expect(result.success).toBe(false);
      expect(result.hash).toBeUndefined();
      expect(result.error).toBe('Password hashing failed: Salt generation failed');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle bcrypt.hash error', async () => {
      const password = 'MySecureP@ssw0rd';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockError = new Error('Hashing failed');

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockRejectedValue(mockError);

      const result = await hashPassword(password);

      expect(result.success).toBe(false);
      expect(result.hash).toBeUndefined();
      expect(result.error).toBe('Password hashing failed: Hashing failed');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use configured salt rounds', async () => {
      const password = 'MySecureP@ssw0rd';
      const customSaltRounds = 12;
      const mockSalt = '$2b$12$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(authConfig.getAuthConfig).mockReturnValue({
        password: {
          saltRounds: customSaltRounds,
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        },
      } as never);

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.success).toBe(true);
      expect(bcrypt.genSalt).toHaveBeenCalledWith(customSaltRounds);
    });

    it('should handle non-Error exceptions', async () => {
      const password = 'MySecureP@ssw0rd';

      vi.mocked(bcrypt.genSalt).mockRejectedValue('String error' as never);

      const result = await hashPassword(password);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password hashing failed: String error');
    });

    it('should measure execution time accurately', async () => {
      const password = 'MySecureP@ssw0rd';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockSalt as never;
      });
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.success).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'WrongPassword';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBeUndefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should reject non-string password', async () => {
      const invalidPassword = 123 as unknown as string;
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = await comparePassword(invalidPassword, hash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Password must be a string');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject non-string hash', async () => {
      const password = 'MySecureP@ssw0rd';
      const invalidHash = 123 as unknown as string;

      const result = await comparePassword(password, invalidHash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Hash must be a string');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject empty password', async () => {
      const emptyPassword = '';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = await comparePassword(emptyPassword, hash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Password cannot be empty');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject empty hash', async () => {
      const password = 'MySecureP@ssw0rd';
      const emptyHash = '';

      const result = await comparePassword(password, emptyHash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Hash cannot be empty');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject invalid hash format - wrong prefix', async () => {
      const password = 'MySecureP@ssw0rd';
      const invalidHash = '$3a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = await comparePassword(password, invalidHash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Invalid bcrypt hash format');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should accept valid bcrypt hash formats - $2a$', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should accept valid bcrypt hash formats - $2b$', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should accept valid bcrypt hash formats - $2y$', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2y$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should handle bcrypt.compare error', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';
      const mockError = new Error('Comparison failed');

      vi.mocked(bcrypt.compare).mockRejectedValue(mockError);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Password comparison failed: Comparison failed');
    });

    it('should handle non-Error exceptions', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockRejectedValue('String error' as never);

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(false);
      expect(result.isMatch).toBe(false);
      expect(result.error).toBe('Password comparison failed: String error');
    });

    it('should measure execution time accurately', async () => {
      const password = 'MySecureP@ssw0rd';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true as never;
      });

      const result = await comparePassword(password, hash);

      expect(result.success).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const password = 'MySecureP@ssw0rd123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBeGreaterThan(60);
    });

    it('should reject password shorter than minimum length', () => {
      const password = 'Short1!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const password = 'mysecurep@ssw0rd123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const password = 'MYSECUREP@SSW0RD123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const password = 'MySecureP@ssword';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const password = 'MySecurePassword123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password with multiple validation errors', () => {
      const password = 'short';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject non-string password', () => {
      const invalidPassword = 123 as unknown as string;

      const result = validatePasswordStrength(invalidPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
      expect(result.strength).toBe(0);
    });

    it('should calculate higher strength for longer passwords', () => {
      const shortPassword = 'MySecP@ss1';
      const longPassword = 'MyVerySecureP@ssw0rd123WithExtraLength';

      const shortResult = validatePasswordStrength(shortPassword);
      const longResult = validatePasswordStrength(longPassword);

      expect(shortResult.isValid).toBe(true);
      expect(longResult.isValid).toBe(true);
      expect(longResult.strength).toBeGreaterThan(shortResult.strength);
    });

    it('should penalize passwords with repeated characters', () => {
      const normalPassword = 'MySecureP@ssw0rd';
      const repeatedPassword = 'MySecureP@sssw0rd';

      const normalResult = validatePasswordStrength(normalPassword);
      const repeatedResult = validatePasswordStrength(repeatedPassword);

      expect(normalResult.strength).toBeGreaterThan(repeatedResult.strength);
    });

    it('should penalize passwords with only letters', () => {
      const mixedPassword = 'MySecureP@ssw0rd';
      const lettersOnlyPassword = 'MySecurePassword';

      const mixedResult = validatePasswordStrength(mixedPassword);
      const lettersResult = validatePasswordStrength(lettersOnlyPassword);

      // Note: lettersOnlyPassword will fail validation, but we're testing strength calculation
      expect(mixedResult.strength).toBeGreaterThan(lettersResult.strength);
    });

    it('should penalize passwords with only numbers', () => {
      const mixedPassword = 'MySecureP@ssw0rd';
      const numbersOnlyPassword = '12345678';

      const mixedResult = validatePasswordStrength(mixedPassword);
      const numbersResult = validatePasswordStrength(numbersOnlyPassword);

      expect(mixedResult.strength).toBeGreaterThan(numbersResult.strength);
    });

    it('should penalize passwords with sequential characters', () => {
      const normalPassword = 'MySecureP@ssw0rd';
      const sequentialPassword = 'Abc123!@#Password';

      const normalResult = validatePasswordStrength(normalPassword);
      const sequentialResult = validatePasswordStrength(sequentialPassword);

      expect(normalResult.strength).toBeGreaterThan(sequentialResult.strength);
    });

    it('should reject common weak passwords', () => {
      const commonPasswords = [
        'Password123!',
        'Qwerty123!',
        'Letmein123!',
        'Iloveyou123!',
      ];

      commonPasswords.forEach(password => {
        const result = validatePasswordStrength(password);
        expect(result.errors).toContain('Password contains common weak patterns');
      });
    });

    it('should reward high character variety', () => {
      const lowVariety = 'Aaaaaaaa1!';
      const highVariety = 'MyS3cur3P@ssw0rd!';

      const lowResult = validatePasswordStrength(lowVariety);
      const highResult = validatePasswordStrength(highVariety);

      expect(highResult.strength).toBeGreaterThan(lowResult.strength);
    });

    it('should ensure strength is within 0-100 bounds', () => {
      const passwords = [
        'weak',
        'MySecureP@ssw0rd123',
        'MyVeryVeryVerySecureP@ssw0rd123WithExtraLength!@#$%',
      ];

      passwords.forEach(password => {
        const result = validatePasswordStrength(password);
        expect(result.strength).toBeGreaterThanOrEqual(0);
        expect(result.strength).toBeLessThanOrEqual(100);
      });
    });

    it('should handle custom password requirements', () => {
      const customConfig = {
        password: {
          saltRounds: 10,
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
        },
      };

      vi.mocked(authConfig.getAuthConfig).mockReturnValue(customConfig as never);

      const password = 'MySecurePassword123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain('Password must contain at least one special character');
    });

    it('should handle validation errors gracefully', () => {
      vi.mocked(authConfig.getAuthConfig).mockImplementation(() => {
        throw new Error('Config error');
      });

      const password = 'MySecureP@ssw0rd123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation error: Config error');
      expect(result.strength).toBe(0);
    });
  });

  describe('validatePasswordWithFeedback', () => {
    it('should provide excellent feedback for strong passwords', () => {
      const password = 'MyVerySecureP@ssw0rd123WithExtraLength';

      const result = validatePasswordWithFeedback(password);

      expect(result.isValid).toBe(true);
      expect(result.feedback).toContain('Excellent password strength!');
    });

    it('should provide good feedback for medium-strong passwords', () => {
      const password = 'MySecureP@ssw0rd123';

      const result = validatePasswordWithFeedback(password);

      expect(result.isValid).toBe(true);
      expect(result.feedback.some(f => f.includes('Good') || f.includes('Acceptable'))).toBe(true);
    });

    it('should provide error feedback for invalid passwords', () => {
      const password = 'weak';

      const result = validatePasswordWithFeedback(password);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password does not meet security requirements:');
      expect(result.feedback.length).toBeGreaterThan(1);
    });

    it('should suggest improvements for weak passwords', () => {
      const password = 'MySecP@ss1';

      const result = validatePasswordWithFeedback(password);

      if (result.strength < 60) {
        expect(result.feedback).toContain('Consider making your password longer and more complex');
      }
    });

    it('should include all validation errors in feedback', () => {
      const password = 'short';

      const result = validatePasswordWithFeedback(password);

      expect(result.isValid).toBe(false);
      expect(result.feedback.length).toBeGreaterThan(result.errors.length);
      result.errors.forEach(error => {
        expect(result.feedback).toContain(error);
      });
    });
  });

  describe('needsRehash', () => {
    it('should return false for hash with current salt rounds', () => {
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = needsRehash(hash);

      expect(result).toBe(false);
    });

    it('should return true for hash with different salt rounds', () => {
      const hash = '$2b$08$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = needsRehash(hash);

      expect(result).toBe(true);
    });

    it('should return true when salt rounds increased', () => {
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(authConfig.getAuthConfig).mockReturnValue({
        password: {
          saltRounds: 12,
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        },
      } as never);

      const result = needsRehash(hash);

      expect(result).toBe(true);
    });

    it('should return false for non-string hash', () => {
      const invalidHash = 123 as unknown as string;

      const result = needsRehash(invalidHash);

      expect(result).toBe(false);
    });

    it('should return false for empty hash', () => {
      const emptyHash = '';

      const result = needsRehash(emptyHash);

      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', () => {
      const invalidHash = 'not-a-valid-hash';

      const result = needsRehash(invalidHash);

      expect(result).toBe(false);
    });

    it('should return false for hash with insufficient parts', () => {
      const invalidHash = '$2b$10';

      const result = needsRehash(invalidHash);

      expect(result).toBe(false);
    });

    it('should handle different bcrypt versions', () => {
      const hashes = [
        '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO',
        '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO',
        '$2y$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO',
      ];

      hashes.forEach(hash => {
        const result = needsRehash(hash);
        expect(typeof result).toBe('boolean');
      });
    });

    it('should handle errors gracefully', () => {
      vi.mocked(authConfig.getAuthConfig).mockImplementation(() => {
        throw new Error('Config error');
      });

      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      const result = needsRehash(hash);

      expect(result).toBe(false);
    });

    it('should parse salt rounds correctly', () => {
      const testCases = [
        { hash: '$2b$04$abc', expected: true },
        { hash: '$2b$08$abc', expected: true },
        { hash: '$2b$10$abc', expected: false },
        { hash: '$2b$12$abc', expected: true },
      ];

      testCases.forEach(({ hash, expected }) => {
        const result = needsRehash(hash);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should hash and compare password successfully', async () => {
      const password = 'MySecureP@ssw0rd123';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const hashResult = await hashPassword(password);
      expect(hashResult.success).toBe(true);

      const compareResult = await comparePassword(password, hashResult.hash!);
      expect(compareResult.success).toBe(true);
      expect(compareResult.isMatch).toBe(true);
    });

    it('should validate, hash, and compare password in workflow', async () => {
      const password = 'MySecureP@ssw0rd123';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      // Validate
      const validationResult = validatePasswordStrength(password);
      expect(validationResult.isValid).toBe(true);

      // Hash
      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);
      const hashResult = await hashPassword(password);
      expect(hashResult.success).toBe(true);

      // Compare
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const compareResult = await comparePassword(password, hashResult.hash!);
      expect(compareResult.success).toBe(true);
      expect(compareResult.isMatch).toBe(true);

      // Check rehash
      const rehashNeeded = needsRehash(hashResult.hash!);
      expect(typeof rehashNeeded).toBe('boolean');
    });

    it('should handle password change workflow', async () => {
      const oldPassword = 'OldSecureP@ssw0rd123';
      const newPassword = 'NewSecureP@ssw0rd456';
      const oldHash = '$2b$10$oldHashabcdefghijklmnopqrstuvwxyz1234567890ABCDEF';
      const newMockSalt = '$2b$10$newSaltabcdefghijklmno';
      const newMockHash = '$2b$10$newHashabcdefghijklmnopqrstuvwxyz1234567890ABCDEF';

      // Verify old password
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      const oldCompareResult = await comparePassword(oldPassword, oldHash);
      expect(oldCompareResult.isMatch).toBe(true);

      // Validate new password
      const validationResult = validatePasswordStrength(newPassword);
      expect(validationResult.isValid).toBe(true);

      // Hash new password
      vi.mocked(bcrypt.genSalt).mockResolvedValue(newMockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(newMockHash as never);
      const newHashResult = await hashPassword(newPassword);
      expect(newHashResult.success).toBe(true);

      // Verify new password
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      const newCompareResult = await comparePassword(newPassword, newHashResult.hash!);
      expect(newCompareResult.isMatch).toBe(true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long passwords', async () => {
      const longPassword = 'A'.repeat(1000) + 'a1!';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const hashResult = await hashPassword(longPassword);
      expect(hashResult.success).toBe(true);

      const validationResult = validatePasswordStrength(longPassword);
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle passwords with unicode characters', async () => {
      const unicodePassword = 'MySecure🔒P@ssw0rd123';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const hashResult = await hashPassword(unicodePassword);
      expect(hashResult.success).toBe(true);
    });

    it('should handle passwords at minimum length boundary', () => {
      const minLengthPassword = 'MyP@ss1w';

      const result = validatePasswordStrength(minLengthPassword);
      expect(result.isValid).toBe(true);
    });

    it('should handle passwords just below minimum length', () => {
      const belowMinPassword = 'MyP@ss1';

      const result = validatePasswordStrength(belowMinPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should handle null and undefined gracefully', async () => {
      const nullPassword = null as unknown as string;
      const undefinedPassword = undefined as unknown as string;

      const nullHashResult = await hashPassword(nullPassword);
      expect(nullHashResult.success).toBe(false);

      const undefinedHashResult = await hashPassword(undefinedPassword);
      expect(undefinedHashResult.success).toBe(false);

      const nullValidationResult = validatePasswordStrength(nullPassword);
      expect(nullValidationResult.isValid).toBe(false);

      const undefinedValidationResult = validatePasswordStrength(undefinedPassword);
      expect(undefinedValidationResult.isValid).toBe(false);
    });

    it('should handle special characters in all positions', () => {
      const passwords = [
        '!MySecureP@ssw0rd123',
        'MySecureP@ssw0rd123!',
        'My!Secure@P#ssw$rd%123',
      ];

      passwords.forEach(password => {
        const result = validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Performance and timing', () => {
    it('should complete validation quickly', () => {
      const password = 'MySecureP@ssw0rd123';
      const startTime = Date.now();

      validatePasswordStrength(password);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should track execution time for hash operations', async () => {
      const password = 'MySecureP@ssw0rd123';
      const mockSalt = '$2b$10$abcdefghijklmnopqrstuv';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.genSalt).mockResolvedValue(mockSalt as never);
      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should track execution time for compare operations', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, hash);

      expect(result.executionTimeMs).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});