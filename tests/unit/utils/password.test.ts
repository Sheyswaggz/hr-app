/**
 * Unit tests for password utility functions
 * 
 * Tests password hashing, comparison, and validation with deterministic mocking
 * for bcrypt operations to ensure consistent test results.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as bcrypt from 'bcrypt';

// Import the functions we're testing
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  getPasswordConfig,
} from '../../src/utils/password';

// Mock bcrypt module
vi.mock('bcrypt');

describe('Password Utils', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Reset console mocks
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('hashPassword', () => {
    it('generates hash for valid password', async () => {
      const password = 'ValidPass123!';
      const mockHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ';

      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.hash).toBe(mockHash);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(console.log).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Starting password hashing',
        expect.objectContaining({
          passwordLength: password.length,
          saltRounds: 10,
        })
      );
    });

    it('generates different hashes for same password on multiple calls', async () => {
      const password = 'SamePassword123!';
      const mockHash1 = '$2b$10$hash1abcdefghijklmnopqrstuvwxyz1234567890ABC';
      const mockHash2 = '$2b$10$hash2abcdefghijklmnopqrstuvwxyz1234567890ABC';

      vi.mocked(bcrypt.hash)
        .mockResolvedValueOnce(mockHash1 as never)
        .mockResolvedValueOnce(mockHash2 as never);

      const result1 = await hashPassword(password);
      const result2 = await hashPassword(password);

      expect(result1.hash).toBe(mockHash1);
      expect(result2.hash).toBe(mockHash2);
      expect(result1.hash).not.toBe(result2.hash);
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
    });

    it('throws error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Hash failed: Invalid password input',
        expect.objectContaining({
          passwordType: 'string',
          passwordEmpty: true,
        })
      );
    });

    it('throws error for non-string password', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      await expect(hashPassword(undefined as any)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      await expect(hashPassword(123 as any)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      expect(console.error).toHaveBeenCalledTimes(3);
    });

    it('throws error when bcrypt.hash fails', async () => {
      const password = 'ValidPass123!';
      const bcryptError = new Error('Bcrypt hashing failed');

      vi.mocked(bcrypt.hash).mockRejectedValue(bcryptError);

      await expect(hashPassword(password)).rejects.toThrow(
        '[PASSWORD_UTILS] Failed to hash password: Bcrypt hashing failed'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Password hashing failed',
        expect.objectContaining({
          error: 'Bcrypt hashing failed',
          passwordLength: password.length,
        })
      );
    });

    it('uses custom salt rounds when provided', async () => {
      const password = 'ValidPass123!';
      const customSaltRounds = 12;
      const mockHash = '$2b$12$customhashvalue';

      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password, customSaltRounds);

      expect(result.hash).toBe(mockHash);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, customSaltRounds);
    });

    it('logs execution time', async () => {
      const password = 'ValidPass123!';
      const mockHash = '$2b$10$testhash';

      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(password);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(console.log).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Password hashing completed',
        expect.objectContaining({
          executionTimeMs: expect.any(Number),
        })
      );
    });
  });

  describe('comparePassword', () => {
    const validHash = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ';

    it('returns true for matching password', async () => {
      const password = 'CorrectPassword123!';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, validHash);

      expect(result.match).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, validHash);
    });

    it('returns false for non-matching password', async () => {
      const password = 'WrongPassword123!';

      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await comparePassword(password, validHash);

      expect(result.match).toBe(false);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, validHash);
    });

    it('throws error for empty password', async () => {
      await expect(comparePassword('', validHash)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Compare failed: Invalid password input',
        expect.objectContaining({
          passwordType: 'string',
          passwordEmpty: true,
        })
      );
    });

    it('throws error for non-string password', async () => {
      await expect(comparePassword(null as any, validHash)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );

      await expect(comparePassword(123 as any, validHash)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );
    });

    it('throws error for empty hash', async () => {
      const password = 'ValidPass123!';

      await expect(comparePassword(password, '')).rejects.toThrow(
        '[PASSWORD_UTILS] Hash must be a non-empty string'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Compare failed: Invalid hash input',
        expect.objectContaining({
          hashType: 'string',
          hashEmpty: true,
        })
      );
    });

    it('throws error for non-string hash', async () => {
      const password = 'ValidPass123!';

      await expect(comparePassword(password, null as any)).rejects.toThrow(
        '[PASSWORD_UTILS] Hash must be a non-empty string'
      );

      await expect(comparePassword(password, undefined as any)).rejects.toThrow(
        '[PASSWORD_UTILS] Hash must be a non-empty string'
      );
    });

    it('throws error for invalid hash format', async () => {
      const password = 'ValidPass123!';
      const invalidHash = 'not-a-valid-bcrypt-hash';

      await expect(comparePassword(password, invalidHash)).rejects.toThrow(
        '[PASSWORD_UTILS] Invalid bcrypt hash format'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Compare failed: Invalid hash format',
        expect.objectContaining({
          hashPrefix: 'not-',
        })
      );
    });

    it('accepts valid bcrypt hash formats', async () => {
      const password = 'ValidPass123!';
      const validHashes = [
        '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ',
        '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ',
        '$2y$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJ',
      ];

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      for (const hash of validHashes) {
        const result = await comparePassword(password, hash);
        expect(result.match).toBe(true);
      }

      expect(bcrypt.compare).toHaveBeenCalledTimes(validHashes.length);
    });

    it('throws error when bcrypt.compare fails', async () => {
      const password = 'ValidPass123!';
      const bcryptError = new Error('Bcrypt comparison failed');

      vi.mocked(bcrypt.compare).mockRejectedValue(bcryptError);

      await expect(comparePassword(password, validHash)).rejects.toThrow(
        '[PASSWORD_UTILS] Failed to compare password: Bcrypt comparison failed'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Password comparison failed',
        expect.objectContaining({
          error: 'Bcrypt comparison failed',
          passwordLength: password.length,
          hashLength: validHash.length,
        })
      );
    });

    it('logs execution time', async () => {
      const password = 'ValidPass123!';

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await comparePassword(password, validHash);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(console.log).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Password comparison completed',
        expect.objectContaining({
          match: true,
          executionTimeMs: expect.any(Number),
        })
      );
    });
  });

  describe('validatePasswordStrength', () => {
    it('validates strong password with all requirements', () => {
      const password = 'StrongPass123!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBeGreaterThan(70);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumber).toBe(true);
      expect(result.requirements.hasSpecialChar).toBe(true);
    });

    it('rejects password shorter than minimum length', () => {
      const password = 'Short1!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.requirements.minLength).toBe(false);
    });

    it('rejects password without uppercase letter', () => {
      const password = 'lowercase123!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.requirements.hasUppercase).toBe(false);
    });

    it('rejects password without lowercase letter', () => {
      const password = 'UPPERCASE123!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
      expect(result.requirements.hasLowercase).toBe(false);
    });

    it('rejects password without number', () => {
      const password = 'NoNumbers!';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.requirements.hasNumber).toBe(false);
    });

    it('rejects password without special character', () => {
      const password = 'NoSpecial123';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
      expect(result.requirements.hasSpecialChar).toBe(false);
    });

    it('accumulates multiple validation errors', () => {
      const password = 'weak';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('calculates strength score correctly', () => {
      const weakPassword = 'password';
      const mediumPassword = 'Password1';
      const strongPassword = 'StrongPass123!';

      const weakResult = validatePasswordStrength(weakPassword);
      const mediumResult = validatePasswordStrength(mediumPassword);
      const strongResult = validatePasswordStrength(strongPassword);

      expect(weakResult.strength).toBeLessThan(mediumResult.strength);
      expect(mediumResult.strength).toBeLessThan(strongResult.strength);
    });

    it('handles empty password', () => {
      const password = '';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.strength).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '=', '[', ']', '{', '}', ';', ':', '"', '|', ',', '.', '<', '>', '/', '?'];

      for (const char of specialChars) {
        const password = `ValidPass123${char}`;
        const result = validatePasswordStrength(password);
        expect(result.requirements.hasSpecialChar).toBe(true);
      }
    });

    it('provides strength score between 0 and 100', () => {
      const passwords = [
        'weak',
        'Weak1',
        'Weak1!',
        'StrongPass123!',
        'VeryStrongPassword123!@#',
      ];

      for (const password of passwords) {
        const result = validatePasswordStrength(password);
        expect(result.strength).toBeGreaterThanOrEqual(0);
        expect(result.strength).toBeLessThanOrEqual(100);
      }
    });

    it('logs validation attempt', () => {
      const password = 'TestPass123!';

      validatePasswordStrength(password);

      expect(console.log).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Validating password strength',
        expect.objectContaining({
          passwordLength: password.length,
        })
      );
    });

    it('logs validation result', () => {
      const password = 'TestPass123!';

      validatePasswordStrength(password);

      expect(console.log).toHaveBeenCalledWith(
        '[PASSWORD_UTILS] Password validation completed',
        expect.objectContaining({
          isValid: expect.any(Boolean),
          strength: expect.any(Number),
          errorCount: expect.any(Number),
        })
      );
    });
  });

  describe('getPasswordConfig', () => {
    it('returns default configuration', () => {
      const config = getPasswordConfig();

      expect(config).toEqual({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        saltRounds: 10,
      });
    });

    it('returns same instance on multiple calls', () => {
      const config1 = getPasswordConfig();
      const config2 = getPasswordConfig();

      expect(config1).toBe(config2);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long passwords', async () => {
      const longPassword = 'A'.repeat(1000) + '1!';
      const mockHash = '$2b$10$longhash';

      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(longPassword);

      expect(result.hash).toBe(mockHash);
      expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
    });

    it('handles passwords with unicode characters', async () => {
      const unicodePassword = 'Pässwörd123!你好';
      const mockHash = '$2b$10$unicodehash';

      vi.mocked(bcrypt.hash).mockResolvedValue(mockHash as never);

      const result = await hashPassword(unicodePassword);

      expect(result.hash).toBe(mockHash);
    });

    it('handles passwords with only whitespace', async () => {
      const whitespacePassword = '   ';

      await expect(hashPassword(whitespacePassword)).rejects.toThrow(
        '[PASSWORD_UTILS] Password must be a non-empty string'
      );
    });

    it('validates password at exact minimum length', () => {
      const password = 'Pass123!';

      const result = validatePasswordStrength(password);

      expect(result.requirements.minLength).toBe(true);
      expect(password.length).toBe(8);
    });

    it('handles concurrent hash operations', async () => {
      const passwords = ['Pass1!', 'Pass2!', 'Pass3!'];
      const mockHashes = passwords.map((_, i) => `$2b$10$hash${i}`);

      vi.mocked(bcrypt.hash).mockImplementation((pwd) => {
        const index = passwords.indexOf(pwd as string);
        return Promise.resolve(mockHashes[index] as never);
      });

      const results = await Promise.all(passwords.map(hashPassword));

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.hash).toBe(mockHashes[i]);
      });
    });

    it('handles concurrent compare operations', async () => {
      const password = 'TestPass123!';
      const hashes = [
        '$2b$10$hash1',
        '$2b$10$hash2',
        '$2b$10$hash3',
      ];

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const results = await Promise.all(
        hashes.map((hash) => comparePassword(password, hash))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.match).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    it('completes hashing within reasonable time', async () => {
      const password = 'TestPass123!';
      const mockHash = '$2b$10$testhash';

      vi.mocked(bcrypt.hash).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockHash as never), 10);
        });
      });

      const startTime = Date.now();
      await hashPassword(password);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('completes comparison within reasonable time', async () => {
      const password = 'TestPass123!';
      const hash = '$2b$10$testhash';

      vi.mocked(bcrypt.compare).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(true as never), 10);
        });
      });

      const startTime = Date.now();
      await comparePassword(password, hash);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('validation is synchronous and fast', () => {
      const password = 'TestPass123!';

      const startTime = Date.now();
      validatePasswordStrength(password);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });
});