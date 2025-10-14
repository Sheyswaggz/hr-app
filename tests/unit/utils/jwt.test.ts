/**
 * JWT Utilities Unit Tests
 * 
 * Comprehensive test suite for JWT token generation, verification, and decoding utilities.
 * Tests cover access tokens, refresh tokens, token validation, error handling, and edge cases.
 * 
 * This test suite ensures:
 * - Token generation produces valid JWT tokens
 * - Token verification correctly validates signatures and expiration
 * - Token decoding extracts payload information
 * - Error cases are handled appropriately
 * - Type guards work correctly
 * 
 * @module tests/unit/utils/jwt.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpired,
  getTokenTimeToLive,
} from '../../../src/utils/jwt.js';
import { UserRole } from '../../../src/types/index.js';
import { getAuthConfig } from '../../../src/config/auth.js';

// Mock the auth config module
vi.mock('../../../src/config/auth.js', () => ({
  getAuthConfig: vi.fn(),
}));

// Mock console methods to avoid cluttering test output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('JWT Utilities', () => {
  // Test configuration
  const testConfig = {
    jwt: {
      secret: 'test-secret-key-for-access-tokens',
      expiresIn: '1h',
      algorithm: 'HS256' as const,
      issuer: 'hr-app-test',
      audience: 'hr-app-users-test',
    },
    refreshToken: {
      secret: 'test-secret-key-for-refresh-tokens',
      expiresIn: '7d',
    },
  };

  // Test data
  const testUserId = 'test-user-123';
  const testEmail = 'test@example.com';
  const testRole = UserRole.Employee;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Setup default mock implementation
    vi.mocked(getAuthConfig).mockReturnValue(testConfig as any);
  });

  afterEach(() => {
    // Clean up after each test
    vi.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.role).toBe(testRole);
      expect(decoded.type).toBe('access');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.jti).toBeDefined();
      expect(decoded.iss).toBe(testConfig.jwt.issuer);
      expect(decoded.aud).toBe(testConfig.jwt.audience);
    });

    it('should generate tokens with unique JTI', () => {
      const token1 = generateAccessToken(testUserId, testEmail, testRole);
      const token2 = generateAccessToken(testUserId, testEmail, testRole);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    it('should accept custom JTI in options', () => {
      const customJti = 'custom-jti-123';
      const token = generateAccessToken(testUserId, testEmail, testRole, {
        jti: customJti,
      });

      const decoded = jwt.decode(token) as any;
      expect(decoded.jti).toBe(customJti);
    });

    it('should accept correlation ID in options', () => {
      const correlationId = 'test-correlation-123';
      const token = generateAccessToken(testUserId, testEmail, testRole, {
        correlationId,
      });

      expect(token).toBeDefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Generating access token'),
        expect.objectContaining({ correlationId })
      );
    });

    it('should handle different user roles', () => {
      const roles = [UserRole.Employee, UserRole.Manager, UserRole.HRAdmin];

      roles.forEach((role) => {
        const token = generateAccessToken(testUserId, testEmail, role);
        const decoded = jwt.decode(token) as any;
        expect(decoded.role).toBe(role);
      });
    });

    it('should throw error if config is invalid', () => {
      vi.mocked(getAuthConfig).mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => {
        generateAccessToken(testUserId, testEmail, testRole);
      }).toThrow('[JWT] Access token generation failed: Config error');
    });

    it('should log token generation', () => {
      generateAccessToken(testUserId, testEmail, testRole);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Generating access token'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          role: testRole,
        })
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Access token generated successfully'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          role: testRole,
        })
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(testUserId, testEmail);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('refresh');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.jti).toBeDefined();
      expect(decoded.family).toBeDefined();
      expect(decoded.iss).toBe(testConfig.jwt.issuer);
      expect(decoded.aud).toBe(testConfig.jwt.audience);
    });

    it('should generate tokens with unique JTI and family', () => {
      const token1 = generateRefreshToken(testUserId, testEmail);
      const token2 = generateRefreshToken(testUserId, testEmail);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      expect(decoded1.jti).not.toBe(decoded2.jti);
      expect(decoded1.family).not.toBe(decoded2.family);
    });

    it('should accept custom JTI and family in options', () => {
      const customJti = 'custom-jti-456';
      const customFamily = 'custom-family-789';
      const token = generateRefreshToken(testUserId, testEmail, {
        jti: customJti,
        family: customFamily,
      });

      const decoded = jwt.decode(token) as any;
      expect(decoded.jti).toBe(customJti);
      expect(decoded.family).toBe(customFamily);
    });

    it('should accept correlation ID in options', () => {
      const correlationId = 'test-correlation-456';
      const token = generateRefreshToken(testUserId, testEmail, {
        correlationId,
      });

      expect(token).toBeDefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Generating refresh token'),
        expect.objectContaining({ correlationId })
      );
    });

    it('should throw error if config is invalid', () => {
      vi.mocked(getAuthConfig).mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => {
        generateRefreshToken(testUserId, testEmail);
      }).toThrow('[JWT] Refresh token generation failed: Config error');
    });

    it('should log token generation', () => {
      generateRefreshToken(testUserId, testEmail);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Generating refresh token'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
        })
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Refresh token generated successfully'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
        })
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const result = await verifyAccessToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.userId).toBe(testUserId);
      expect(result.payload?.email).toBe(testEmail);
      expect(result.payload?.role).toBe(testRole);
      expect(result.payload?.type).toBe('access');
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
      expect(result.expired).toBeUndefined();
    });

    it('should reject token with invalid signature', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      
      // Tamper with the token
      const parts = token.split('.');
      parts[2] = 'invalid-signature';
      const tamperedToken = parts.join('.');

      const result = await verifyAccessToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('MALFORMED');
    });

    it('should reject expired token', async () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateAccessToken(testUserId, testEmail, testRole);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await verifyAccessToken(token);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('EXPIRED');
      expect(result.expired).toBe(true);
    });

    it('should accept expired token when ignoreExpiration is true', async () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateAccessToken(testUserId, testEmail, testRole);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await verifyAccessToken(token, { ignoreExpiration: true });

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should reject token with wrong secret', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);

      // Change the secret for verification
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          secret: 'different-secret',
        },
      } as any);

      const result = await verifyAccessToken(token);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MALFORMED');
    });

    it('should reject refresh token as access token', async () => {
      const refreshToken = generateRefreshToken(testUserId, testEmail);
      const result = await verifyAccessToken(refreshToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token payload structure');
      expect(result.errorCode).toBe('MALFORMED');
    });

    it('should accept correlation ID in options', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const correlationId = 'verify-correlation-123';

      await verifyAccessToken(token, { correlationId });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Verifying access token'),
        expect.objectContaining({ correlationId })
      );
    });

    it('should log verification success', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      await verifyAccessToken(token);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Access token verified successfully'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          role: testRole,
        })
      );
    });

    it('should log verification failure', async () => {
      const result = await verifyAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Access token verification failed'),
        expect.objectContaining({
          error: expect.any(String),
          errorCode: 'MALFORMED',
        })
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = generateRefreshToken(testUserId, testEmail);
      const result = await verifyRefreshToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.userId).toBe(testUserId);
      expect(result.payload?.email).toBe(testEmail);
      expect(result.payload?.type).toBe('refresh');
      expect(result.payload?.family).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject token with invalid signature', async () => {
      const token = generateRefreshToken(testUserId, testEmail);
      
      // Tamper with the token
      const parts = token.split('.');
      parts[2] = 'invalid-signature';
      const tamperedToken = parts.join('.');

      const result = await verifyRefreshToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MALFORMED');
    });

    it('should reject expired token', async () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        refreshToken: {
          ...testConfig.refreshToken,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateRefreshToken(testUserId, testEmail);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await verifyRefreshToken(token);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EXPIRED');
      expect(result.expired).toBe(true);
    });

    it('should accept expired token when ignoreExpiration is true', async () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        refreshToken: {
          ...testConfig.refreshToken,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateRefreshToken(testUserId, testEmail);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await verifyRefreshToken(token, { ignoreExpiration: true });

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should reject access token as refresh token', async () => {
      const accessToken = generateAccessToken(testUserId, testEmail, testRole);
      const result = await verifyRefreshToken(accessToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token payload structure');
      expect(result.errorCode).toBe('MALFORMED');
    });

    it('should log verification success', async () => {
      const token = generateRefreshToken(testUserId, testEmail);
      await verifyRefreshToken(token);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Refresh token verified successfully'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
        })
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode access token without verification', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
      expect(decoded?.role).toBe(testRole);
      expect(decoded?.type).toBe('access');
    });

    it('should decode refresh token without verification', () => {
      const token = generateRefreshToken(testUserId, testEmail);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
      expect(decoded?.type).toBe('refresh');
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const decoded = decodeToken('not.a.jwt');
      expect(decoded).toBeNull();
    });

    it('should decode expired token', () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateAccessToken(testUserId, testEmail, testRole);

      // Decode should work even if expired
      const decoded = decodeToken(token);
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
    });

    it('should log decoding', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      decodeToken(token);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Decoding token (without verification)'),
        expect.any(Object)
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Token decoded as access token'),
        expect.objectContaining({
          userId: testUserId,
          email: testEmail,
          role: testRole,
        })
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'valid-jwt-token';
      const header = `Bearer ${token}`;
      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for undefined header', () => {
      const extracted = extractTokenFromHeader(undefined);
      expect(extracted).toBeNull();
    });

    it('should return null for empty header', () => {
      const extracted = extractTokenFromHeader('');
      expect(extracted).toBeNull();
    });

    it('should return null for header without Bearer scheme', () => {
      const extracted = extractTokenFromHeader('Basic token123');
      expect(extracted).toBeNull();
    });

    it('should return null for malformed header', () => {
      const extracted = extractTokenFromHeader('BearerNoSpace');
      expect(extracted).toBeNull();
    });

    it('should return null for empty token', () => {
      const extracted = extractTokenFromHeader('Bearer ');
      expect(extracted).toBeNull();
    });

    it('should trim whitespace from token', () => {
      const token = 'valid-jwt-token';
      const header = `Bearer  ${token}  `;
      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should log warnings for invalid headers', () => {
      extractTokenFromHeader(undefined);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] No authorization header provided')
      );

      extractTokenFromHeader('Basic token');
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[JWT] Invalid authorization scheme'),
        expect.any(Object)
      );
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const expiration = getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expiration = getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });

    it('should return null for token without exp claim', () => {
      // Create a token without exp claim (manually)
      const tokenWithoutExp = jwt.sign(
        { userId: testUserId },
        testConfig.jwt.secret,
        { noTimestamp: true }
      );

      const expiration = getTokenExpiration(tokenWithoutExp);
      expect(expiration).toBeNull();
    });

    it('should return correct expiration time', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const decoded = jwt.decode(token) as any;
      const expiration = getTokenExpiration(token);

      expect(expiration!.getTime()).toBe(decoded.exp * 1000);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const expired = isTokenExpired(token);

      expect(expired).toBe(false);
    });

    it('should return true for expired token', () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateAccessToken(testUserId, testEmail, testRole);

      // Token should be expired immediately
      const expired = isTokenExpired(token);
      expect(expired).toBe(true);
    });

    it('should return true for invalid token', () => {
      const expired = isTokenExpired('invalid-token');
      expect(expired).toBe(true);
    });

    it('should return true for token without expiration', () => {
      const tokenWithoutExp = jwt.sign(
        { userId: testUserId },
        testConfig.jwt.secret,
        { noTimestamp: true }
      );

      const expired = isTokenExpired(tokenWithoutExp);
      expect(expired).toBe(true);
    });
  });

  describe('getTokenTimeToLive', () => {
    it('should return positive TTL for valid token', () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const ttl = getTokenTimeToLive(token);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600 * 1000); // 1 hour in ms
    });

    it('should return 0 for expired token', () => {
      // Generate token with very short expiry
      vi.mocked(getAuthConfig).mockReturnValue({
        ...testConfig,
        jwt: {
          ...testConfig.jwt,
          expiresIn: '1ms',
        },
      } as any);

      const token = generateAccessToken(testUserId, testEmail, testRole);

      const ttl = getTokenTimeToLive(token);
      expect(ttl).toBe(0);
    });

    it('should return 0 for invalid token', () => {
      const ttl = getTokenTimeToLive('invalid-token');
      expect(ttl).toBe(0);
    });

    it('should return 0 for token without expiration', () => {
      const tokenWithoutExp = jwt.sign(
        { userId: testUserId },
        testConfig.jwt.secret,
        { noTimestamp: true }
      );

      const ttl = getTokenTimeToLive(tokenWithoutExp);
      expect(ttl).toBe(0);
    });

    it('should return decreasing TTL over time', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const ttl1 = getTokenTimeToLive(token);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const ttl2 = getTokenTimeToLive(token);

      expect(ttl2).toBeLessThan(ttl1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty strings gracefully', () => {
      expect(decodeToken('')).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
      expect(isTokenExpired('')).toBe(true);
      expect(getTokenTimeToLive('')).toBe(0);
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(10000);
      expect(decodeToken(longToken)).toBeNull();
    });

    it('should handle special characters in user data', () => {
      const specialEmail = 'test+special@example.com';
      const token = generateAccessToken(testUserId, specialEmail, testRole);
      const decoded = decodeToken(token);

      expect(decoded?.email).toBe(specialEmail);
    });

    it('should handle concurrent token generation', () => {
      const tokens = Array.from({ length: 10 }, () =>
        generateAccessToken(testUserId, testEmail, testRole)
      );

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });

    it('should handle token verification with missing config', async () => {
      vi.mocked(getAuthConfig).mockImplementation(() => {
        throw new Error('Config not available');
      });

      const token = 'some-token';
      const result = await verifyAccessToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Config not available');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type information through verification', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const result = await verifyAccessToken(token);

      if (result.valid && result.payload) {
        // TypeScript should know these properties exist
        expect(result.payload.userId).toBeDefined();
        expect(result.payload.email).toBeDefined();
        expect(result.payload.role).toBeDefined();
        expect(result.payload.type).toBe('access');
      }
    });

    it('should distinguish between access and refresh token payloads', async () => {
      const accessToken = generateAccessToken(testUserId, testEmail, testRole);
      const refreshToken = generateRefreshToken(testUserId, testEmail);

      const accessResult = await verifyAccessToken(accessToken);
      const refreshResult = await verifyRefreshToken(refreshToken);

      if (accessResult.valid && accessResult.payload) {
        expect(accessResult.payload.type).toBe('access');
        expect('role' in accessResult.payload).toBe(true);
      }

      if (refreshResult.valid && refreshResult.payload) {
        expect(refreshResult.payload.type).toBe('refresh');
        expect('family' in refreshResult.payload).toBe(true);
      }
    });
  });

  describe('Performance', () => {
    it('should generate tokens quickly', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        generateAccessToken(testUserId, testEmail, testRole);
      }
      
      const duration = Date.now() - startTime;
      
      // Should generate 100 tokens in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should verify tokens quickly', async () => {
      const token = generateAccessToken(testUserId, testEmail, testRole);
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        await verifyAccessToken(token);
      }
      
      const duration = Date.now() - startTime;
      
      // Should verify 100 tokens in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});