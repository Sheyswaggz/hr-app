/**
 * JWT Token Utilities Module
 * 
 * Provides comprehensive JWT token generation, validation, and decoding utilities
 * for the authentication system. Implements secure token handling with proper error
 * recovery, structured logging, and type safety.
 * 
 * This module handles:
 * - Access token generation and validation
 * - Refresh token generation and validation
 * - Token decoding with type guards
 * - Comprehensive error handling for expired/invalid tokens
 * - Structured logging for all token operations
 * 
 * @module utils/jwt
 */

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';

import { getAuthConfig } from '../config/auth.js';
import {
  type JWTPayload,
  type RefreshTokenPayload,
  type TokenValidationResult,
  isJWTPayload,
  isRefreshTokenPayload,
} from '../types/auth.js';
import { type UserRole } from '../types/index.js';

/**
 * Token generation options interface
 */
interface TokenGenerationOptions {
  /**
   * Optional JWT ID for token tracking
   */
  readonly jti?: string;

  /**
   * Optional token family ID for refresh token rotation
   */
  readonly family?: string;

  /**
   * Optional correlation ID for request tracing
   */
  readonly correlationId?: string;
}

/**
 * Token verification options interface
 */
interface TokenVerificationOptions {
  /**
   * Optional correlation ID for request tracing
   */
  readonly correlationId?: string;

  /**
   * Whether to ignore expiration (for debugging)
   */
  readonly ignoreExpiration?: boolean;
}

/**
 * Generate a unique JWT ID
 * 
 * @returns {string} Unique JWT ID
 */
function generateJwtId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a unique token family ID for refresh token rotation
 * 
 * @returns {string} Unique family ID
 */
function generateFamilyId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Get current Unix timestamp in seconds
 * 
 * @returns {number} Current timestamp in seconds
 */
function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Generate JWT access token
 * 
 * Creates a signed JWT access token containing user identification and role information.
 * The token includes standard JWT claims (iat, exp) and custom claims for user data.
 * 
 * @param {string} userId - Unique identifier for the user
 * @param {string} email - User's email address
 * @param {UserRole} role - User's role in the system
 * @param {TokenGenerationOptions} [options] - Optional token generation options
 * @returns {string} Signed JWT access token
 * @throws {Error} If token generation fails
 * 
 * @example
 * const token = generateAccessToken('user-123', 'user@example.com', UserRole.Employee);
 * // Returns: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 */
export function generateAccessToken(
  userId: string,
  email: string,
  role: UserRole,
  options?: TokenGenerationOptions
): string {
  const correlationId = options?.correlationId || `token_gen_${Date.now()}`;
  const startTime = Date.now();

  try {
    console.log('[JWT] Generating access token:', {
      userId,
      email,
      role,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    const config = getAuthConfig();
    const jti = options?.jti || generateJwtId();
    const iat = getCurrentTimestamp();

    // Build JWT payload
    const payload: Omit<JWTPayload, 'exp'> = {
      userId,
      email,
      role,
      iat,
      type: 'access',
      jti,
    };

    // Sign options
    const signOptions: SignOptions = {
      algorithm: config.jwt.algorithm,
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    // Generate token
    const token = jwt.sign(payload, config.jwt.secret, signOptions);

    const executionTimeMs = Date.now() - startTime;

    console.log('[JWT] Access token generated successfully:', {
      userId,
      email,
      role,
      jti,
      expiresIn: config.jwt.expiresIn,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return token;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[JWT] Failed to generate access token:', {
      userId,
      email,
      role,
      error: errorMessage,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`[JWT] Access token generation failed: ${errorMessage}`);
  }
}

/**
 * Generate JWT refresh token
 * 
 * Creates a signed JWT refresh token for obtaining new access tokens without re-authentication.
 * Refresh tokens have a longer lifetime and include a JWT ID for tracking and revocation.
 * 
 * @param {string} userId - Unique identifier for the user
 * @param {string} email - User's email address
 * @param {TokenGenerationOptions} [options] - Optional token generation options
 * @returns {string} Signed JWT refresh token
 * @throws {Error} If token generation fails
 * 
 * @example
 * const refreshToken = generateRefreshToken('user-123', 'user@example.com');
 * // Returns: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  options?: TokenGenerationOptions
): string {
  const correlationId = options?.correlationId || `refresh_gen_${Date.now()}`;
  const startTime = Date.now();

  try {
    console.log('[JWT] Generating refresh token:', {
      userId,
      email,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    const config = getAuthConfig();
    const jti = options?.jti || generateJwtId();
    const family = options?.family || generateFamilyId();
    const iat = getCurrentTimestamp();

    // Build JWT payload
    const payload: Omit<RefreshTokenPayload, 'exp'> = {
      userId,
      email,
      iat,
      type: 'refresh',
      jti,
      family,
    };

    // Sign options
    const signOptions: SignOptions = {
      algorithm: config.jwt.algorithm,
      expiresIn: config.refreshToken.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    // Generate token
    const token = jwt.sign(payload, config.refreshToken.secret, signOptions);

    const executionTimeMs = Date.now() - startTime;

    console.log('[JWT] Refresh token generated successfully:', {
      userId,
      email,
      jti,
      family,
      expiresIn: config.refreshToken.expiresIn,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return token;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[JWT] Failed to generate refresh token:', {
      userId,
      email,
      error: errorMessage,
      executionTimeMs,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`[JWT] Refresh token generation failed: ${errorMessage}`);
  }
}

/**
 * Verify and decode JWT access token
 * 
 * Validates the signature, expiration, and structure of a JWT access token.
 * Returns a validation result with the decoded payload or error information.
 * 
 * @param {string} token - JWT access token to verify
 * @param {TokenVerificationOptions} [options] - Optional verification options
 * @returns {Promise<TokenValidationResult>} Validation result with payload or error
 * 
 * @example
 * const result = await verifyAccessToken(token);
 * if (result.valid && result.payload) {
 *   console.log('User ID:', result.payload.userId);
 * } else {
 *   console.error('Invalid token:', result.error);
 * }
 */
export async function verifyAccessToken(
  token: string,
  options?: TokenVerificationOptions
): Promise<TokenValidationResult> {
  const correlationId = options?.correlationId || `token_verify_${Date.now()}`;
  const startTime = Date.now();
  const timestamp = new Date();

  try {
    console.log('[JWT] Verifying access token:', {
      correlationId,
      ignoreExpiration: options?.ignoreExpiration ?? false,
      timestamp: timestamp.toISOString(),
    });

    const config = getAuthConfig();

    // Verify options
    const verifyOptions: VerifyOptions = {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      ignoreExpiration: options?.ignoreExpiration ?? false,
    };

    // Verify and decode token
    const decoded = jwt.verify(token, config.jwt.secret, verifyOptions) as JwtPayload;

    // Validate payload structure
    if (!isJWTPayload(decoded)) {
      const executionTimeMs = Date.now() - startTime;

      console.error('[JWT] Invalid access token payload structure:', {
        correlationId,
        executionTimeMs,
        timestamp: timestamp.toISOString(),
      });

      return {
        valid: false,
        error: 'Invalid token payload structure',
        errorCode: 'MALFORMED',
        timestamp,
      };
    }

    const executionTimeMs = Date.now() - startTime;

    console.log('[JWT] Access token verified successfully:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      jti: decoded.jti,
      executionTimeMs,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    return {
      valid: true,
      payload: decoded,
      timestamp,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type
    let errorCode: TokenValidationResult['errorCode'] = 'INVALID';
    let expired = false;

    if (error instanceof jwt.TokenExpiredError) {
      errorCode = 'EXPIRED';
      expired = true;
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorCode = 'MALFORMED';
    }

    console.error('[JWT] Access token verification failed:', {
      error: errorMessage,
      errorCode,
      expired,
      executionTimeMs,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    return {
      valid: false,
      error: errorMessage,
      errorCode,
      expired,
      timestamp,
    };
  }
}

/**
 * Verify and decode JWT refresh token
 * 
 * Validates the signature, expiration, and structure of a JWT refresh token.
 * Returns a validation result with the decoded payload or error information.
 * 
 * @param {string} token - JWT refresh token to verify
 * @param {TokenVerificationOptions} [options] - Optional verification options
 * @returns {Promise<TokenValidationResult>} Validation result with payload or error
 * 
 * @example
 * const result = await verifyRefreshToken(refreshToken);
 * if (result.valid && result.payload) {
 *   // Generate new access token
 *   const newAccessToken = generateAccessToken(
 *     result.payload.userId,
 *     result.payload.email,
 *     userRole
 *   );
 * }
 */
export async function verifyRefreshToken(
  token: string,
  options?: TokenVerificationOptions
): Promise<TokenValidationResult> {
  const correlationId = options?.correlationId || `refresh_verify_${Date.now()}`;
  const startTime = Date.now();
  const timestamp = new Date();

  try {
    console.log('[JWT] Verifying refresh token:', {
      correlationId,
      ignoreExpiration: options?.ignoreExpiration ?? false,
      timestamp: timestamp.toISOString(),
    });

    const config = getAuthConfig();

    // Verify options
    const verifyOptions: VerifyOptions = {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      ignoreExpiration: options?.ignoreExpiration ?? false,
    };

    // Verify and decode token
    const decoded = jwt.verify(token, config.refreshToken.secret, verifyOptions) as JwtPayload;

    // Validate payload structure
    if (!isRefreshTokenPayload(decoded)) {
      const executionTimeMs = Date.now() - startTime;

      console.error('[JWT] Invalid refresh token payload structure:', {
        correlationId,
        executionTimeMs,
        timestamp: timestamp.toISOString(),
      });

      return {
        valid: false,
        error: 'Invalid token payload structure',
        errorCode: 'MALFORMED',
        timestamp,
      };
    }

    const executionTimeMs = Date.now() - startTime;

    console.log('[JWT] Refresh token verified successfully:', {
      userId: decoded.userId,
      email: decoded.email,
      jti: decoded.jti,
      family: decoded.family,
      executionTimeMs,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    return {
      valid: true,
      payload: decoded,
      timestamp,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type
    let errorCode: TokenValidationResult['errorCode'] = 'INVALID';
    let expired = false;

    if (error instanceof jwt.TokenExpiredError) {
      errorCode = 'EXPIRED';
      expired = true;
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorCode = 'MALFORMED';
    }

    console.error('[JWT] Refresh token verification failed:', {
      error: errorMessage,
      errorCode,
      expired,
      executionTimeMs,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    return {
      valid: false,
      error: errorMessage,
      errorCode,
      expired,
      timestamp,
    };
  }
}

/**
 * Decode JWT token without verification
 * 
 * Decodes a JWT token without verifying its signature or expiration.
 * Useful for extracting token information for logging or debugging.
 * 
 * WARNING: This function does NOT validate the token. Always use verify functions
 * for authentication/authorization decisions.
 * 
 * @param {string} token - JWT token to decode
 * @returns {JWTPayload | RefreshTokenPayload | null} Decoded payload or null if invalid
 * 
 * @example
 * const payload = decodeToken(token);
 * if (payload) {
 *   console.log('Token type:', payload.type);
 *   console.log('User ID:', payload.userId);
 * }
 */
export function decodeToken(token: string): JWTPayload | RefreshTokenPayload | null {
  try {
    console.log('[JWT] Decoding token (without verification):', {
      timestamp: new Date().toISOString(),
    });

    const decoded = jwt.decode(token) as JwtPayload | null;

    if (!decoded) {
      console.warn('[JWT] Failed to decode token: Invalid token format');
      return null;
    }

    // Check if it's an access token
    if (isJWTPayload(decoded)) {
      console.log('[JWT] Token decoded as access token:', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        type: decoded.type,
        jti: decoded.jti,
        timestamp: new Date().toISOString(),
      });
      return decoded;
    }

    // Check if it's a refresh token
    if (isRefreshTokenPayload(decoded)) {
      console.log('[JWT] Token decoded as refresh token:', {
        userId: decoded.userId,
        email: decoded.email,
        type: decoded.type,
        jti: decoded.jti,
        family: decoded.family,
        timestamp: new Date().toISOString(),
      });
      return decoded;
    }

    console.warn('[JWT] Token decoded but payload structure is invalid:', {
      timestamp: new Date().toISOString(),
    });

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[JWT] Failed to decode token:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return null;
  }
}

/**
 * Extract token from Authorization header
 * 
 * Extracts JWT token from Bearer authorization header.
 * Handles various header formats and validates the structure.
 * 
 * @param {string | undefined} authHeader - Authorization header value
 * @returns {string | null} Extracted token or null if invalid
 * 
 * @example
 * const token = extractTokenFromHeader(req.headers.authorization);
 * if (token) {
 *   const result = await verifyAccessToken(token);
 * }
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    console.warn('[JWT] No authorization header provided');
    return null;
  }

  // Check for Bearer scheme
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    console.warn('[JWT] Invalid authorization header format:', {
      format: 'Expected "Bearer <token>"',
      received: authHeader.substring(0, 20) + '...',
    });
    return null;
  }

  const [scheme, token] = parts;

  if (scheme !== 'Bearer') {
    console.warn('[JWT] Invalid authorization scheme:', {
      expected: 'Bearer',
      received: scheme,
    });
    return null;
  }

  if (!token || token.trim().length === 0) {
    console.warn('[JWT] Empty token in authorization header');
    return null;
  }

  return token.trim();
}

/**
 * Get token expiration time
 * 
 * Extracts the expiration timestamp from a JWT token.
 * Returns null if token is invalid or doesn't have expiration.
 * 
 * @param {string} token - JWT token
 * @returns {Date | null} Expiration date or null
 * 
 * @example
 * const expiresAt = getTokenExpiration(token);
 * if (expiresAt) {
 *   console.log('Token expires at:', expiresAt.toISOString());
 * }
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  } catch (error) {
    console.error('[JWT] Failed to get token expiration:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if token is expired
 * 
 * Checks if a JWT token is expired without full verification.
 * Useful for quick expiration checks before attempting verification.
 * 
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 * 
 * @example
 * if (isTokenExpired(token)) {
 *   // Request new token
 * }
 */
export function isTokenExpired(token: string): boolean {
  try {
    const expiresAt = getTokenExpiration(token);
    if (!expiresAt) {
      return true;
    }

    return expiresAt.getTime() < Date.now();
  } catch (error) {
    console.error('[JWT] Failed to check token expiration:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/**
 * Get time until token expiration
 * 
 * Calculates the remaining time until token expiration in milliseconds.
 * Returns 0 if token is expired or invalid.
 * 
 * @param {string} token - JWT token
 * @returns {number} Milliseconds until expiration (0 if expired)
 * 
 * @example
 * const ttl = getTokenTimeToLive(token);
 * console.log(`Token expires in ${ttl / 1000} seconds`);
 */
export function getTokenTimeToLive(token: string): number {
  try {
    const expiresAt = getTokenExpiration(token);
    if (!expiresAt) {
      return 0;
    }

    const ttl = expiresAt.getTime() - Date.now();
    return Math.max(0, ttl);
  } catch (error) {
    console.error('[JWT] Failed to get token TTL:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Default export with all JWT utilities
 */
export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  getTokenExpiration,
  isTokenExpired,
  getTokenTimeToLive,
};