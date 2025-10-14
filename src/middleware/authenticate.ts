/**
 * Authentication Middleware Module
 * 
 * Provides Express middleware for JWT token authentication on protected routes.
 * This middleware validates JWT access tokens, verifies user authentication,
 * and attaches authenticated user information to the request object for use
 * in downstream route handlers.
 * 
 * This module handles:
 * - JWT token extraction from Authorization header
 * - Token validation and verification
 * - User information attachment to request
 * - Comprehensive error handling for authentication failures
 * - Structured logging for all authentication attempts
 * 
 * @module middleware/authenticate
 */

import { type Request, type Response, type NextFunction } from 'express';

import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js';
import { type AuthenticatedUser, type JWTPayload, isJWTPayload } from '../types/auth.js';

/**
 * Extended Express Request interface with authentication information
 * 
 * This interface extends the base Express Request to include authenticated
 * user information and correlation ID for request tracing.
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Authenticated user information (populated by authenticate middleware)
   */
  user?: AuthenticatedUser;

  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;

  /**
   * Raw JWT token string (for logging and debugging)
   */
  token?: string;
}

/**
 * Authentication error response structure
 */
interface AuthErrorResponse {
  /**
   * Whether authentication was successful (always false for errors)
   */
  readonly success: false;

  /**
   * Error code for programmatic handling
   */
  readonly code: string;

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Timestamp when error occurred
   */
  readonly timestamp: string;

  /**
   * Request path that caused the error
   */
  readonly path: string;
}

/**
 * Generate a unique correlation ID for request tracing
 * 
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(): string {
  return `auth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Send authentication error response
 * 
 * Sends a standardized error response for authentication failures with
 * appropriate HTTP status code and error details.
 * 
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code for programmatic handling
 * @param {string} message - Human-readable error message
 * @param {string} path - Request path
 * @returns {void}
 */
function sendAuthError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  path: string
): void {
  const errorResponse: AuthErrorResponse = {
    success: false,
    code,
    message,
    timestamp: new Date().toISOString(),
    path,
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Convert JWT payload to authenticated user
 * 
 * Transforms a validated JWT payload into an AuthenticatedUser object
 * for attachment to the request.
 * 
 * @param {JWTPayload} payload - Validated JWT payload
 * @returns {AuthenticatedUser} Authenticated user information
 */
function jwtPayloadToAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    isActive: true, // Token validation implies active user
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };
}

/**
 * Authentication Middleware
 * 
 * Express middleware that validates JWT access tokens on protected routes.
 * Extracts the token from the Authorization header, validates it, and attaches
 * the authenticated user information to the request object.
 * 
 * This middleware:
 * - Extracts JWT token from Authorization header (Bearer scheme)
 * - Validates token signature and expiration
 * - Verifies token payload structure
 * - Attaches authenticated user to request.user
 * - Handles all authentication errors with appropriate HTTP status codes
 * - Logs all authentication attempts with structured context
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 * 
 * @example
 * // Apply to protected routes
 * router.get('/protected', authenticate, (req, res) => {
 *   const user = req.user; // AuthenticatedUser
 *   res.json({ message: `Hello ${user.email}` });
 * });
 * 
 * @example
 * // Apply to all routes in a router
 * router.use(authenticate);
 * router.get('/profile', (req, res) => {
 *   // req.user is guaranteed to be defined
 * });
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const requestPath = req.path;

  // Attach correlation ID to request for tracing
  req.correlationId = correlationId;

  try {
    console.log('[AUTH_MIDDLEWARE] Authentication attempt:', {
      correlationId,
      path: requestPath,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    // Extract Authorization header
    const authHeader = req.get('authorization');

    if (!authHeader) {
      const executionTimeMs = Date.now() - startTime;

      console.warn('[AUTH_MIDDLEWARE] Missing authorization header:', {
        correlationId,
        path: requestPath,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthError(
        res,
        401,
        'MISSING_TOKEN',
        'Authorization header is required',
        requestPath
      );
      return;
    }

    // Extract token from Bearer scheme
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      const executionTimeMs = Date.now() - startTime;

      console.warn('[AUTH_MIDDLEWARE] Invalid authorization header format:', {
        correlationId,
        path: requestPath,
        authHeaderPrefix: authHeader.substring(0, 20) + '...',
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthError(
        res,
        401,
        'INVALID_TOKEN_FORMAT',
        'Authorization header must use Bearer scheme',
        requestPath
      );
      return;
    }

    // Attach token to request for debugging
    req.token = token;

    // Verify token
    const validationResult = await verifyAccessToken(token, {
      correlationId,
    });

    if (!validationResult.valid) {
      const executionTimeMs = Date.now() - startTime;

      // Determine appropriate status code and error details
      let statusCode = 401;
      let errorCode = 'INVALID_TOKEN';
      let errorMessage = 'Invalid authentication token';

      if (validationResult.errorCode === 'EXPIRED') {
        statusCode = 401;
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Authentication token has expired';
      } else if (validationResult.errorCode === 'MALFORMED') {
        statusCode = 401;
        errorCode = 'MALFORMED_TOKEN';
        errorMessage = 'Authentication token is malformed';
      }

      console.warn('[AUTH_MIDDLEWARE] Token validation failed:', {
        correlationId,
        path: requestPath,
        errorCode: validationResult.errorCode,
        error: validationResult.error,
        expired: validationResult.expired,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthError(
        res,
        statusCode,
        errorCode,
        errorMessage,
        requestPath
      );
      return;
    }

    // Validate payload structure
    if (!validationResult.payload || !isJWTPayload(validationResult.payload)) {
      const executionTimeMs = Date.now() - startTime;

      console.error('[AUTH_MIDDLEWARE] Invalid token payload structure:', {
        correlationId,
        path: requestPath,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthError(
        res,
        401,
        'INVALID_TOKEN_PAYLOAD',
        'Authentication token payload is invalid',
        requestPath
      );
      return;
    }

    // Convert payload to authenticated user
    const authenticatedUser = jwtPayloadToAuthenticatedUser(validationResult.payload);

    // Attach user to request
    req.user = authenticatedUser;

    const executionTimeMs = Date.now() - startTime;

    console.log('[AUTH_MIDDLEWARE] Authentication successful:', {
      correlationId,
      path: requestPath,
      userId: authenticatedUser.userId,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      jti: authenticatedUser.jti,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    // Continue to next middleware
    next();
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[AUTH_MIDDLEWARE] Authentication error:', {
      correlationId,
      path: requestPath,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    sendAuthError(
      res,
      500,
      'AUTHENTICATION_ERROR',
      'An error occurred during authentication',
      requestPath
    );
  }
}

/**
 * Optional Authentication Middleware
 * 
 * Similar to authenticate middleware but does not require authentication.
 * If a valid token is provided, it attaches the user to the request.
 * If no token or invalid token, it continues without user information.
 * 
 * Useful for routes that have different behavior for authenticated vs
 * unauthenticated users but don't strictly require authentication.
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 * 
 * @example
 * // Apply to routes with optional authentication
 * router.get('/public', optionalAuthenticate, (req, res) => {
 *   if (req.user) {
 *     // Authenticated user
 *     res.json({ message: `Hello ${req.user.email}` });
 *   } else {
 *     // Anonymous user
 *     res.json({ message: 'Hello guest' });
 *   }
 * });
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const requestPath = req.path;

  // Attach correlation ID to request for tracing
  req.correlationId = correlationId;

  try {
    console.log('[AUTH_MIDDLEWARE] Optional authentication attempt:', {
      correlationId,
      path: requestPath,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // Extract Authorization header
    const authHeader = req.get('authorization');

    if (!authHeader) {
      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_MIDDLEWARE] No authorization header, continuing without authentication:', {
        correlationId,
        path: requestPath,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
      return;
    }

    // Extract token from Bearer scheme
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_MIDDLEWARE] Invalid token format, continuing without authentication:', {
        correlationId,
        path: requestPath,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
      return;
    }

    // Attach token to request for debugging
    req.token = token;

    // Verify token
    const validationResult = await verifyAccessToken(token, {
      correlationId,
    });

    if (!validationResult.valid || !validationResult.payload || !isJWTPayload(validationResult.payload)) {
      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_MIDDLEWARE] Token validation failed, continuing without authentication:', {
        correlationId,
        path: requestPath,
        errorCode: validationResult.errorCode,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
      return;
    }

    // Convert payload to authenticated user
    const authenticatedUser = jwtPayloadToAuthenticatedUser(validationResult.payload);

    // Attach user to request
    req.user = authenticatedUser;

    const executionTimeMs = Date.now() - startTime;

    console.log('[AUTH_MIDDLEWARE] Optional authentication successful:', {
      correlationId,
      path: requestPath,
      userId: authenticatedUser.userId,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    // Continue to next middleware
    next();
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.warn('[AUTH_MIDDLEWARE] Optional authentication error, continuing without authentication:', {
      correlationId,
      path: requestPath,
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    // Continue without authentication on error
    next();
  }
}

/**
 * Require Authenticated User Middleware
 * 
 * Middleware that ensures req.user is defined. Should be used after
 * authenticate middleware to provide type safety for route handlers.
 * 
 * This is a type guard middleware that narrows the request type to
 * guarantee that req.user is defined.
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 * 
 * @example
 * // Use after authenticate middleware for type safety
 * router.get('/profile',
 *   authenticate,
 *   requireAuthenticatedUser,
 *   (req, res) => {
 *     // TypeScript knows req.user is defined
 *     const user = req.user; // No need for optional chaining
 *     res.json({ user });
 *   }
 * );
 */
export function requireAuthenticatedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    const correlationId = req.correlationId || generateCorrelationId();

    console.error('[AUTH_MIDDLEWARE] User not authenticated after authenticate middleware:', {
      correlationId,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    sendAuthError(
      res,
      401,
      'UNAUTHENTICATED',
      'User authentication required',
      req.path
    );
    return;
  }

  next();
}

/**
 * Default export with all authentication middleware functions
 */
export default {
  authenticate,
  optionalAuthenticate,
  requireAuthenticatedUser,
};