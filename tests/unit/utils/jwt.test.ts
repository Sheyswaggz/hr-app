/**
 * Unit tests for JWT utility functions
 * 
 * Tests token generation, verification, and decoding functionality
 * with comprehensive error handling and edge case coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  TokenGenerationError,
  TokenVerificationError,
} from '../../src/utils/jwt';
import type { UserRole } from '../../src/types';

// Mock the auth config
vi.mock('../../src/config/auth', () => ({
  getJWTConfig: vi.fn(() => ({
    accessSecret: 'test-access-secret-key-for-testing-only',
    refreshSecret: 'test-refresh-secret-key-for-testing-only',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    algorithm: 'HS256' as const,
    issuer: 'hr-app-test',
    audience: 'hr-app-users-test',
  })),
}));

describe('JWT Utilities', () => {
  // Test data
  const validUserId = 'user-123';
  const validEmail = 'test@example.com';
  const validRole: UserRole = 'EMPLOYEE';
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate valid access token with required payload', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include all required claims in token payload', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const decoded = jwt.decode(token) as JwtPayload;

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(validUserId);
      expect(decoded.email).toBe(validEmail);
      expect(decoded.role).toBe(validRole);
      expect(decoded.tokenType).toBe('access');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iss).toBe('hr-app-test');
      expect(decoded.aud).toBe('hr-app-users-test');
    });

    it('should generate different tokens for same user', () => {
      const token1 = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      // Wait a bit to ensure different iat
      const token2 = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      expect(token1).not.toBe(token2);
    });

    it('should accept optional correlation ID', () => {
      const token = generateAccessToken(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
        },
        { correlationId }
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should throw TokenGenerationError when userId is missing', () => {
      expect(() =>
        generateAccessToken({
          userId: '',
          email: validEmail,
          role: validRole,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateAccessToken({
          userId: '',
          email: validEmail,
          role: validRole,
        })
      ).toThrow('User ID is required for token generation');
    });

    it('should throw TokenGenerationError when email is missing', () => {
      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: '',
          role: validRole,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: '',
          role: validRole,
        })
      ).toThrow('Email is required for token generation');
    });

    it('should throw TokenGenerationError when role is missing', () => {
      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: validEmail,
          role: '' as UserRole,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: validEmail,
          role: '' as UserRole,
        })
      ).toThrow('Role is required for token generation');
    });

    it('should handle JWT signing errors', () => {
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
        throw new Error('Signing failed');
      });

      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: validEmail,
          role: validRole,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateAccessToken({
          userId: validUserId,
          email: validEmail,
          role: validRole,
        })
      ).toThrow('Access token generation failed: Signing failed');

      signSpy.mockRestore();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token with required payload', () => {
      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include all required claims in refresh token payload', () => {
      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const decoded = jwt.decode(token) as JwtPayload;

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(validUserId);
      expect(decoded.email).toBe(validEmail);
      expect(decoded.tokenType).toBe('refresh');
      expect(decoded.tokenId).toBeDefined();
      expect(typeof decoded.tokenId).toBe('string');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iss).toBe('hr-app-test');
      expect(decoded.aud).toBe('hr-app-users-test');
    });

    it('should generate unique token IDs for each refresh token', () => {
      const token1 = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const token2 = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const decoded1 = jwt.decode(token1) as JwtPayload;
      const decoded2 = jwt.decode(token2) as JwtPayload;

      expect(decoded1.tokenId).not.toBe(decoded2.tokenId);
    });

    it('should accept optional correlation ID', () => {
      const token = generateRefreshToken(
        {
          userId: validUserId,
          email: validEmail,
        },
        { correlationId }
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should throw TokenGenerationError when userId is missing', () => {
      expect(() =>
        generateRefreshToken({
          userId: '',
          email: validEmail,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateRefreshToken({
          userId: '',
          email: validEmail,
        })
      ).toThrow('User ID is required for token generation');
    });

    it('should throw TokenGenerationError when email is missing', () => {
      expect(() =>
        generateRefreshToken({
          userId: validUserId,
          email: '',
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateRefreshToken({
          userId: validUserId,
          email: '',
        })
      ).toThrow('Email is required for token generation');
    });

    it('should handle JWT signing errors', () => {
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementation(() => {
        throw new Error('Signing failed');
      });

      expect(() =>
        generateRefreshToken({
          userId: validUserId,
          email: validEmail,
        })
      ).toThrow(TokenGenerationError);

      expect(() =>
        generateRefreshToken({
          userId: validUserId,
          email: validEmail,
        })
      ).toThrow('Refresh token generation failed: Signing failed');

      signSpy.mockRestore();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const payload = verifyAccessToken(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(validUserId);
      expect(payload.email).toBe(validEmail);
      expect(payload.role).toBe(validRole);
      expect(payload.tokenType).toBe('access');
    });

    it('should accept optional correlation ID', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const payload = verifyAccessToken(token, { correlationId });

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(validUserId);
    });

    it('should throw TokenVerificationError for missing token', () => {
      expect(() => verifyAccessToken('')).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken('')).toThrow(
        'Access token is required for verification'
      );
    });

    it('should throw TokenVerificationError for whitespace-only token', () => {
      expect(() => verifyAccessToken('   ')).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken('   ')).toThrow(
        'Access token is required for verification'
      );
    });

    it('should throw TokenVerificationError for invalid token format', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow(
        TokenVerificationError
      );

      expect(() => verifyAccessToken('invalid-token')).toThrow(
        /Invalid access token/
      );
    });

    it('should throw TokenVerificationError for expired token', () => {
      // Create token with very short expiry
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementation((payload, secret, options) => {
        return jwt.sign(payload, secret as string, { ...options, expiresIn: '0s' });
      });

      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      signSpy.mockRestore();

      // Wait for token to expire
      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(/expired/i);
    });

    it('should throw TokenVerificationError for token with wrong secret', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
          tokenType: 'access',
        },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(/Invalid access token/);
    });

    it('should throw TokenVerificationError for token with missing userId', () => {
      const token = jwt.sign(
        {
          email: validEmail,
          role: validRole,
          tokenType: 'access',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(
        /missing or invalid userId/
      );
    });

    it('should throw TokenVerificationError for token with missing email', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          role: validRole,
          tokenType: 'access',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(
        /missing or invalid email/
      );
    });

    it('should throw TokenVerificationError for token with missing role', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          tokenType: 'access',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(/missing or invalid role/);
    });

    it('should throw TokenVerificationError for wrong token type', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
          tokenType: 'refresh',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(
        /Invalid token type: expected access token/
      );
    });

    it('should throw TokenVerificationError for token not yet valid', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
          tokenType: 'access',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          notBefore: '1h',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyAccessToken(token)).toThrow(/not yet valid/i);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const payload = verifyRefreshToken(token);

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(validUserId);
      expect(payload.email).toBe(validEmail);
      expect(payload.tokenType).toBe('refresh');
      expect(payload.tokenId).toBeDefined();
    });

    it('should accept optional correlation ID', () => {
      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const payload = verifyRefreshToken(token, { correlationId });

      expect(payload).toBeDefined();
      expect(payload.userId).toBe(validUserId);
    });

    it('should throw TokenVerificationError for missing token', () => {
      expect(() => verifyRefreshToken('')).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken('')).toThrow(
        'Refresh token is required for verification'
      );
    });

    it('should throw TokenVerificationError for whitespace-only token', () => {
      expect(() => verifyRefreshToken('   ')).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken('   ')).toThrow(
        'Refresh token is required for verification'
      );
    });

    it('should throw TokenVerificationError for invalid token format', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow(
        TokenVerificationError
      );

      expect(() => verifyRefreshToken('invalid-token')).toThrow(
        /Invalid refresh token/
      );
    });

    it('should throw TokenVerificationError for expired token', () => {
      // Create token with very short expiry
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementation((payload, secret, options) => {
        return jwt.sign(payload, secret as string, { ...options, expiresIn: '0s' });
      });

      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      signSpy.mockRestore();

      // Wait for token to expire
      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(/expired/i);
    });

    it('should throw TokenVerificationError for token with wrong secret', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          tokenType: 'refresh',
          tokenId: 'test-token-id',
        },
        'wrong-secret',
        { expiresIn: '7d' }
      );

      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(/Invalid refresh token/);
    });

    it('should throw TokenVerificationError for token with missing userId', () => {
      const token = jwt.sign(
        {
          email: validEmail,
          tokenType: 'refresh',
          tokenId: 'test-token-id',
        },
        'test-refresh-secret-key-for-testing-only',
        {
          expiresIn: '7d',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(
        /missing or invalid userId/
      );
    });

    it('should throw TokenVerificationError for token with missing email', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          tokenType: 'refresh',
          tokenId: 'test-token-id',
        },
        'test-refresh-secret-key-for-testing-only',
        {
          expiresIn: '7d',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(
        /missing or invalid email/
      );
    });

    it('should throw TokenVerificationError for token with missing tokenId', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          tokenType: 'refresh',
        },
        'test-refresh-secret-key-for-testing-only',
        {
          expiresIn: '7d',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(
        /missing or invalid tokenId/
      );
    });

    it('should throw TokenVerificationError for wrong token type', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          tokenType: 'access',
          tokenId: 'test-token-id',
        },
        'test-refresh-secret-key-for-testing-only',
        {
          expiresIn: '7d',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      expect(() => verifyRefreshToken(token)).toThrow(TokenVerificationError);

      expect(() => verifyRefreshToken(token)).toThrow(
        /Invalid token type: expected refresh token/
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode valid access token without verification', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(validUserId);
      expect(payload?.email).toBe(validEmail);
      expect(payload?.role).toBe(validRole);
      expect(payload?.tokenType).toBe('access');
    });

    it('should decode valid refresh token without verification', () => {
      const token = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(validUserId);
      expect(payload?.email).toBe(validEmail);
      expect(payload?.tokenType).toBe('refresh');
      expect(payload?.tokenId).toBeDefined();
    });

    it('should decode expired token without error', () => {
      // Create token with very short expiry
      const signSpy = vi.spyOn(jwt, 'sign').mockImplementation((payload, secret, options) => {
        return jwt.sign(payload, secret as string, { ...options, expiresIn: '0s' });
      });

      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      signSpy.mockRestore();

      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(validUserId);
    });

    it('should accept optional correlation ID', () => {
      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const payload = decodeToken(token, { correlationId });

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(validUserId);
    });

    it('should return null for empty token', () => {
      const payload = decodeToken('');

      expect(payload).toBeNull();
    });

    it('should return null for whitespace-only token', () => {
      const payload = decodeToken('   ');

      expect(payload).toBeNull();
    });

    it('should return null for invalid token format', () => {
      const payload = decodeToken('invalid-token');

      expect(payload).toBeNull();
    });

    it('should return null for malformed JWT', () => {
      const payload = decodeToken('header.payload');

      expect(payload).toBeNull();
    });

    it('should handle decoding errors gracefully', () => {
      const decodeSpy = vi.spyOn(jwt, 'decode').mockImplementation(() => {
        throw new Error('Decoding failed');
      });

      const token = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const payload = decodeToken(token);

      expect(payload).toBeNull();

      decodeSpy.mockRestore();
    });

    it('should decode token with additional claims', () => {
      const token = jwt.sign(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
          tokenType: 'access',
          customClaim: 'custom-value',
        },
        'test-access-secret-key-for-testing-only',
        {
          expiresIn: '15m',
          issuer: 'hr-app-test',
          audience: 'hr-app-users-test',
        }
      );

      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(validUserId);
      expect((payload as any)?.customClaim).toBe('custom-value');
    });
  });

  describe('TokenGenerationError', () => {
    it('should create error with message and code', () => {
      const error = new TokenGenerationError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TokenGenerationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TokenGenerationError');
    });

    it('should include optional details', () => {
      const details = { userId: validUserId, correlationId };
      const error = new TokenGenerationError('Test error', 'TEST_CODE', details);

      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new TokenGenerationError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TokenGenerationError');
    });
  });

  describe('TokenVerificationError', () => {
    it('should create error with message and code', () => {
      const error = new TokenVerificationError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TokenVerificationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TokenVerificationError');
    });

    it('should include optional details', () => {
      const details = { token: 'test-token', correlationId };
      const error = new TokenVerificationError('Test error', 'TEST_CODE', details);

      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new TokenVerificationError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TokenVerificationError');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete token lifecycle', () => {
      // Generate tokens
      const accessToken = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const refreshToken = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      // Verify tokens
      const accessPayload = verifyAccessToken(accessToken);
      const refreshPayload = verifyRefreshToken(refreshToken);

      expect(accessPayload.userId).toBe(validUserId);
      expect(refreshPayload.userId).toBe(validUserId);

      // Decode tokens
      const decodedAccess = decodeToken(accessToken);
      const decodedRefresh = decodeToken(refreshToken);

      expect(decodedAccess?.userId).toBe(validUserId);
      expect(decodedRefresh?.userId).toBe(validUserId);
    });

    it('should handle token refresh flow', () => {
      // Generate initial tokens
      const accessToken1 = generateAccessToken({
        userId: validUserId,
        email: validEmail,
        role: validRole,
      });

      const refreshToken = generateRefreshToken({
        userId: validUserId,
        email: validEmail,
      });

      // Verify refresh token
      const refreshPayload = verifyRefreshToken(refreshToken);

      // Generate new access token using refresh token data
      const accessToken2 = generateAccessToken({
        userId: refreshPayload.userId,
        email: refreshPayload.email,
        role: validRole,
      });

      // Verify new access token
      const accessPayload = verifyAccessToken(accessToken2);

      expect(accessPayload.userId).toBe(validUserId);
      expect(accessToken1).not.toBe(accessToken2);
    });

    it('should maintain correlation ID through operations', () => {
      const testCorrelationId = 'test-correlation-123';

      // Generate with correlation ID
      const token = generateAccessToken(
        {
          userId: validUserId,
          email: validEmail,
          role: validRole,
        },
        { correlationId: testCorrelationId }
      );

      // Verify with same correlation ID
      const payload = verifyAccessToken(token, {
        correlationId: testCorrelationId,
      });

      expect(payload.userId).toBe(validUserId);

      // Decode with same correlation ID
      const decoded = decodeToken(token, {
        correlationId: testCorrelationId,
      });

      expect(decoded?.userId).toBe(validUserId);
    });
  });
});