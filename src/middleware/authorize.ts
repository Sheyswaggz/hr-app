/**
 * Authorization Middleware
 * 
 * This module provides Express middleware for role-based access control (RBAC).
 * It validates that authenticated users have the required role(s) to access
 * protected routes. The middleware must be used after the authentication
 * middleware to ensure user information is available.
 * 
 * The middleware integrates with the existing authentication system and follows
 * the project's error handling and logging patterns.
 * 
 * @module middleware/authorize
 */

import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';

import { type JWTPayload } from '../types/auth.js';
import { type UserRole } from '../types/index.js';

/**
 * Authorization Error
 * 
 * Custom error class for authorization failures. Provides structured error
 * information including error codes for programmatic handling.
 */
export class AuthorizationError extends Error {
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
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = options?.statusCode ?? 403;
    this.details = options?.details;
    this.correlationId = options?.correlationId;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
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
export interface AuthorizedRequest extends Request {
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
  return `authz_${timestamp}_${uuid}`;
}

/**
 * Check if User Has Required Role
 * 
 * Validates that the authenticated user has one of the allowed roles.
 * Performs case-insensitive role comparison for robustness.
 * 
 * @param userRole - User's current role
 * @param allowedRoles - Array of roles that are allowed access
 * @returns True if user has required role, false otherwise
 */
function hasRequiredRole(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  // Normalize roles to uppercase for comparison
  const normalizedUserRole = userRole.toUpperCase();
  const normalizedAllowedRoles = allowedRoles.map((role) =>
    role.toUpperCase()
  );

  return normalizedAllowedRoles.includes(normalizedUserRole);
}

/**
 * Log Authorization Attempt
 * 
 * Logs authorization attempt with structured context for observability.
 * Includes timing information, correlation ID, and request metadata.
 * 
 * @param req - Express request object
 * @param correlationId - Correlation ID for tracing
 * @param success - Whether authorization was successful
 * @param userRole - User's role
 * @param allowedRoles - Roles that are allowed access
 * @param error - Error information if authorization failed
 * @param executionTimeMs - Time taken for authorization check
 */
function logAuthorizationAttempt(
  req: Request,
  correlationId: string,
  success: boolean,
  userRole?: UserRole,
  allowedRoles?: readonly UserRole[],
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
    userRole,
    allowedRoles,
    executionTimeMs,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    console.log('[AUTHZ] Authorization successful:', logData);
  } else {
    console.error('[AUTHZ] Authorization failed:', {
      ...logData,
      error: {
        code: error?.code,
        message: error?.message,
      },
    });
  }
}

/**
 * Authorization Middleware Options
 * 
 * Configuration options for the authorization middleware.
 */
export interface AuthorizeOptions {
  /**
   * Custom error handler for authorization failures
   */
  readonly onError?: (
    error: AuthorizationError,
    req: Request,
    res: Response
  ) => void;

  /**
   * Whether to include detailed error information in response
   * Should be false in production for security
   */
  readonly includeDetails?: boolean;
}

/**
 * Authorization Middleware Factory
 * 
 * Creates Express middleware that validates user roles for protected routes.
 * The middleware checks if the authenticated user has one of the allowed roles.
 * 
 * The middleware:
 * - Validates that user is authenticated (has user object from auth middleware)
 * - Checks user's role against allowed roles
 * - Returns 403 Forbidden if user lacks required role
 * - Returns 401 Unauthorized if user is not authenticated
 * - Generates correlation ID for request tracing
 * - Logs authorization attempts with structured context
 * - Provides detailed error messages for debugging
 * 
 * @param allowedRoles - Array of roles that are allowed to access the route
 * @param options - Optional configuration for the middleware
 * @returns Express middleware function
 * 
 * @example
 * // Protect route for HR Admins only
 * app.get('/admin/users', 
 *   authenticate(), 
 *   authorize([UserRole.HRAdmin]), 
 *   getUsersHandler
 * );
 * 
 * @example
 * // Protect route for HR Admins and Managers
 * app.post('/employees/:id/review',
 *   authenticate(),
 *   authorize([UserRole.HRAdmin, UserRole.Manager]),
 *   createReviewHandler
 * );
 * 
 * @example
 * // All authenticated users can access
 * app.get('/profile',
 *   authenticate(),
 *   authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
 *   getProfileHandler
 * );
 */
export function authorize(
  allowedRoles: readonly UserRole[],
  options?: AuthorizeOptions
): (req: Request, res: Response, next: NextFunction) => void {
  // Validate input parameters
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new Error(
      '[AUTHZ] authorize() requires at least one allowed role'
    );
  }

  // Validate that all roles are valid UserRole values
  const validRoles = Object.values(UserRole);
  for (const role of allowedRoles) {
    if (!validRoles.includes(role)) {
      throw new Error(
        `[AUTHZ] Invalid role provided: ${role}. Must be one of: ${validRoles.join(', ')}`
      );
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId =
      (req as AuthorizedRequest).correlationId || generateCorrelationId();

    // Attach correlation ID to request for downstream handlers
    (req as AuthorizedRequest).correlationId = correlationId;

    try {
      console.log('[AUTHZ] Starting authorization check:', {
        correlationId,
        method: req.method,
        path: req.path,
        allowedRoles,
        timestamp: new Date().toISOString(),
      });

      // Check if user is authenticated (has user object from auth middleware)
      const user = (req as AuthorizedRequest).user;

      if (!user) {
        const error = new AuthorizationError(
          'Authentication required. User must be authenticated before authorization.',
          'AUTHENTICATION_REQUIRED',
          {
            statusCode: 401,
            correlationId,
            details: {
              message:
                'No user information found. Ensure authentication middleware runs before authorization.',
            },
          }
        );

        logAuthorizationAttempt(
          req,
          correlationId,
          false,
          undefined,
          allowedRoles,
          {
            code: error.code,
            message: error.message,
          },
          Date.now() - startTime
        );

        // Call custom error handler if provided
        if (options?.onError) {
          options.onError(error, req, res);
          return;
        }

        // Default error response
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: options?.includeDetails ? error.details : undefined,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Validate user object has required properties
      if (!user.role) {
        const error = new AuthorizationError(
          'Invalid user object. User role is missing.',
          'INVALID_USER_OBJECT',
          {
            statusCode: 500,
            correlationId,
            details: {
              message: 'User object from authentication middleware is malformed.',
              userId: user.userId,
            },
          }
        );

        logAuthorizationAttempt(
          req,
          correlationId,
          false,
          undefined,
          allowedRoles,
          {
            code: error.code,
            message: error.message,
          },
          Date.now() - startTime
        );

        // Call custom error handler if provided
        if (options?.onError) {
          options.onError(error, req, res);
          return;
        }

        // Default error response
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: options?.includeDetails ? error.details : undefined,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Check if user has required role
      const hasAccess = hasRequiredRole(user.role, allowedRoles);

      if (!hasAccess) {
        const error = new AuthorizationError(
          'Insufficient permissions. User does not have required role.',
          'INSUFFICIENT_PERMISSIONS',
          {
            statusCode: 403,
            correlationId,
            details: {
              userRole: user.role,
              allowedRoles,
              userId: user.userId,
              email: user.email,
            },
          }
        );

        logAuthorizationAttempt(
          req,
          correlationId,
          false,
          user.role,
          allowedRoles,
          {
            code: error.code,
            message: error.message,
          },
          Date.now() - startTime
        );

        // Call custom error handler if provided
        if (options?.onError) {
          options.onError(error, req, res);
          return;
        }

        // Default error response (don't expose allowed roles in production)
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: options?.includeDetails
              ? {
                  userRole: user.role,
                  allowedRoles,
                }
              : undefined,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Authorization successful
      const executionTimeMs = Date.now() - startTime;

      logAuthorizationAttempt(
        req,
        correlationId,
        true,
        user.role,
        allowedRoles,
        undefined,
        executionTimeMs
      );

      // Proceed to next middleware/handler
      next();
    } catch (error) {
      // Handle unexpected errors
      const executionTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error('[AUTHZ] Unexpected error during authorization:', {
        correlationId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const authzError = new AuthorizationError(
        'Authorization check failed due to internal error.',
        'AUTHORIZATION_ERROR',
        {
          statusCode: 500,
          correlationId,
          details: {
            originalError: errorMessage,
          },
        }
      );

      logAuthorizationAttempt(
        req,
        correlationId,
        false,
        (req as AuthorizedRequest).user?.role,
        allowedRoles,
        {
          code: authzError.code,
          message: authzError.message,
        },
        executionTimeMs
      );

      // Call custom error handler if provided
      if (options?.onError) {
        options.onError(authzError, req, res);
        return;
      }

      // Default error response
      res.status(authzError.statusCode).json({
        success: false,
        error: {
          code: authzError.code,
          message: authzError.message,
          details: options?.includeDetails ? authzError.details : undefined,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

/**
 * Convenience function to create authorization middleware for HR Admin only
 * 
 * @param options - Optional configuration for the middleware
 * @returns Express middleware function
 * 
 * @example
 * app.delete('/users/:id', authenticate(), authorizeHRAdmin(), deleteUserHandler);
 */
export function authorizeHRAdmin(
  options?: AuthorizeOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return authorize([UserRole.HRAdmin], options);
}

/**
 * Convenience function to create authorization middleware for HR Admin and Manager
 * 
 * @param options - Optional configuration for the middleware
 * @returns Express middleware function
 * 
 * @example
 * app.get('/team/members', authenticate(), authorizeManagement(), getTeamHandler);
 */
export function authorizeManagement(
  options?: AuthorizeOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return authorize([UserRole.HRAdmin, UserRole.Manager], options);
}

/**
 * Convenience function to create authorization middleware for all authenticated users
 * 
 * @param options - Optional configuration for the middleware
 * @returns Express middleware function
 * 
 * @example
 * app.get('/profile', authenticate(), authorizeAny(), getProfileHandler);
 */
export function authorizeAny(
  options?: AuthorizeOptions
): (req: Request, res: Response, next: NextFunction) => void {
  return authorize(
    [UserRole.HRAdmin, UserRole.Manager, UserRole.Employee],
    options
  );
}

/**
 * Default export for convenience
 */
export default authorize;