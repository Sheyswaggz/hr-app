/**
 * Authentication Middleware
 * 
 * This module provides Express middleware for JWT token authentication on protected routes.
 * It validates JWT tokens from the Authorization header, verifies their authenticity and
 * expiration, and attaches the decoded user information to the request object for use
 * by downstream handlers.
 * 
 * The middleware integrates with the existing JWT utility functions and follows the
 * project's error handling and logging patterns.
 * 
 * @module middleware/authenticate
 */

import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';

import { verifyAccessToken } from '../utils/jwt.js';
import { type JWTPayload, type AuthRequest } from '../types/auth.js';

/**
 * Authentication Error
 * 
 * Custom error class for authentication failures. Provides structured error
 * information including error codes for programmatic handling.
 */
export class AuthenticationError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * HTTP status code for the error
   */
  public readonly statusCode: number;

  /**
   * Additional error details
   */
  public readonly details?: Record<string, unknown>;

  /**
   * Correlation ID for request tracing
   */
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      readonly statusCode?: number;
      readonly details?: Record<string, unknown>;
      readonly correlationId?: string;
    }
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = options?.statusCode ?? 401;
    this.details = options?.details;
    this.correlationId = options?.correlationId;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError);
    }
  }
}

/**
 * Extended Express Request with Authentication
 * 
 * Type definition for Express Request that includes authentication data.
 * This allows TypeScript to recognize the user and correlationId properties
 * added by the authentication middleware.
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Authenticated user information from JWT token
   */
  user?: JWTPayload;

  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;
}

/**
 * Generate Correlation ID
 * 
 * Generates a unique correlation ID for request tracing. Uses UUID v4 format
 * with a timestamp prefix for better log sorting and debugging.
 * 
 * @returns Unique correlation ID
 */
function generateCorrelationId(): string {
  const timestamp = Date.now();
  const uuid = randomUUID();
  return `auth_${timestamp}_${uuid}`;
}

/**
 * Extract Token from Authorization Header
 * 
 * Extracts the JWT token from the Authorization header. Supports the standard
 * Bearer token format: "Bearer <token>". Validates header format and returns
 * the token string.
 * 
 * @param authHeader - Authorization header value
 * @param correlationId - Correlation ID for logging
 * @returns Extracted token string
 * @throws {AuthenticationError} If header is missing or malformed
 */
function extractToken(
  authHeader: string | undefined,
  correlationId: string
): string {
  // Check if Authorization header exists
  if (!authHeader || authHeader.trim().length === 0) {
    throw new AuthenticationError(
      'Authorization header is required',
      'MISSING_AUTH_HEADER',
      { correlationId }
    );
  }

  // Validate Bearer token format
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2) {
    throw new AuthenticationError(
      'Invalid Authorization header format. Expected: Bearer <token>',
      'INVALID_AUTH_HEADER_FORMAT',
      { 
        correlationId,
        details: { receivedFormat: authHeader.substring(0, 50) }
      }
    );
  }

  const [scheme, token] = parts;

  // Validate Bearer scheme (case-insensitive)
  if (scheme.toLowerCase() !== 'bearer') {
    throw new AuthenticationError(
      'Invalid authentication scheme. Expected: Bearer',
      'INVALID_AUTH_SCHEME',
      { 
        correlationId,
        details: { receivedScheme: scheme }
      }
    );
  }

  // Validate token is not empty
  if (!token || token.trim().length === 0) {
    throw new AuthenticationError(
      'Token is required in Authorization header',
      'MISSING_TOKEN',
      { correlationId }
    );
  }

  return token;
}

/**
 * Log Authentication Attempt
 * 
 * Logs authentication attempt with structured context for observability.
 * Includes timing information, correlation ID, and request metadata.
 * 
 * @param req - Express request object
 * @param correlationId - Correlation ID for tracing
 * @param success - Whether authentication was successful
 * @param error - Error information if authentication failed
 * @param executionTimeMs - Time taken for authentication
 */
function logAuthenticationAttempt(
  req: Request,
  correlationId: string,
  success: boolean,
  error?: {
    readonly code: string;
    readonly message: string;
  },
  executionTimeMs?: number
): void {
  const logData = {
    correlationId,
    success,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    executionTimeMs,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    console.log('[AUTH] Authentication successful:', logData);
  } else {
    console.error('[AUTH] Authentication failed:', {
      ...logData,
      error: {
        code: error?.code,
        message: error?.message,
      },
    });
  }
}

/**
 * Authentication Middleware Options
 * 
 * Configuration options for the authentication middleware.
 */
export interface AuthenticateOptions {
  /**
   * Whether to allow requests without authentication
   * If true, requests without valid tokens will proceed but req.user will be undefined
   */
  readonly optional?: boolean;

  /**
   * Custom error handler for authentication failures
   */
  readonly onError?: (
    error: AuthenticationError,
    req: Request,
    res: Response
  ) => void;
}

/**
 * Authentication Middleware
 * 
 * Express middleware that validates JWT tokens on protected routes. Extracts the
 * token from the Authorization header, verifies it using the JWT utility functions,
 * and attaches the decoded user information to the request object.
 * 
 * The middleware:
 * - Extracts token from Authorization header (Bearer scheme)
 * - Validates token signature and expiration
 * - Attaches user payload to request object
 * - Generates correlation ID for request tracing
 * - Logs authentication attempts with structured context
 * - Returns 401 for invalid/missing tokens
 * - Provides detailed error messages for debugging
 * 
 * @param options - Optional configuration for the middleware
 * @returns Express middleware function
 * 
 * @example
 *