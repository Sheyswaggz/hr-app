/**
 * Authorization Middleware Module
 * 
 * Provides Express middleware for role-based access control (RBAC) on protected routes.
 * This middleware checks if an authenticated user has the required role(s) to access
 * a resource, enforcing authorization policies across the application.
 * 
 * This module handles:
 * - Role-based access control with single or multiple allowed roles
 * - Hierarchical role checking (HR_ADMIN > MANAGER > EMPLOYEE)
 * - Comprehensive error handling for authorization failures
 * - Structured logging for all authorization attempts
 * - Integration with authentication middleware
 * 
 * @module middleware/authorize
 */

import { type Response, type NextFunction } from 'express';

import { type AuthenticatedRequest } from './authenticate.js';
import { type UserRole } from '../types/index.js';

/**
 * Authorization error response structure
 */
interface AuthorizationErrorResponse {
  /**
   * Whether authorization was successful (always false for errors)
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
   * User's actual role
   */
  readonly userRole?: string;

  /**
   * Required role(s) for access
   */
  readonly requiredRoles?: string[];

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
 * Role hierarchy definition
 * 
 * Defines the hierarchical relationship between roles where higher-level
 * roles inherit permissions from lower-level roles.
 * 
 * HR_ADMIN (highest) > MANAGER > EMPLOYEE (lowest)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  HR_ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

/**
 * Generate a unique correlation ID for authorization tracing
 * 
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(): string {
  return `authz_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Send authorization error response
 * 
 * Sends a standardized error response for authorization failures with
 * appropriate HTTP status code and error details.
 * 
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code for programmatic handling
 * @param {string} message - Human-readable error message
 * @param {string} path - Request path
 * @param {string} [userRole] - User's actual role
 * @param {string[]} [requiredRoles] - Required role(s) for access
 * @returns {void}
 */
function sendAuthorizationError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  path: string,
  userRole?: string,
  requiredRoles?: string[]
): void {
  const errorResponse: AuthorizationErrorResponse = {
    success: false,
    code,
    message,
    userRole,
    requiredRoles,
    timestamp: new Date().toISOString(),
    path,
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Check if user role meets minimum required role level
 * 
 * Uses role hierarchy to determine if the user's role is sufficient.
 * Higher-level roles automatically have access to lower-level resources.
 * 
 * @param {UserRole} userRole - User's actual role
 * @param {UserRole} requiredRole - Minimum required role
 * @returns {boolean} True if user role meets or exceeds required role
 */
function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return userLevel >= requiredLevel;
}

/**
 * Check if user has any of the allowed roles
 * 
 * Performs exact role matching against a list of allowed roles.
 * Does not use role hierarchy - user must have one of the exact roles.
 * 
 * @param {UserRole} userRole - User's actual role
 * @param {UserRole[]} allowedRoles - List of allowed roles
 * @returns {boolean} True if user has one of the allowed roles
 */
function hasAnyRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Validate that roles are valid UserRole values
 * 
 * @param {UserRole[]} roles - Roles to validate
 * @returns {boolean} True if all roles are valid
 */
function validateRoles(roles: UserRole[]): boolean {
  const validRoles = Object.values(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']);
  return roles.every((role) => validRoles.includes(role));
}

/**
 * Authorization Middleware Factory
 * 
 * Creates Express middleware that enforces role-based access control.
 * The middleware checks if the authenticated user has one of the allowed roles.
 * 
 * This middleware:
 * - Requires prior authentication (must be used after authenticate middleware)
 * - Checks user role against allowed roles
 * - Returns 403 Forbidden if user lacks required role
 * - Logs all authorization attempts with structured context
 * - Supports both single role and multiple roles
 * 
 * @param {UserRole | UserRole[]} allowedRoles - Role(s) allowed to access the resource
 * @param {object} [options] - Authorization options
 * @param {boolean} [options.useHierarchy=false] - Use role hierarchy for checking
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Require HR_ADMIN role only
 * router.get('/admin', authenticate, authorize('HR_ADMIN'), (req, res) => {
 *   res.json({ message: 'Admin access granted' });
 * });
 * 
 * @example
 * // Allow multiple roles
 * router.get('/reports', 
 *   authenticate, 
 *   authorize(['HR_ADMIN', 'MANAGER']), 
 *   (req, res) => {
 *     res.json({ message: 'Report access granted' });
 *   }
 * );
 * 
 * @example
 * // Use role hierarchy (HR_ADMIN can access MANAGER resources)
 * router.get('/team', 
 *   authenticate, 
 *   authorize('MANAGER', { useHierarchy: true }), 
 *   (req, res) => {
 *     res.json({ message: 'Team access granted' });
 *   }
 * );
 */
export function authorize(
  allowedRoles: UserRole | UserRole[],
  options?: {
    readonly useHierarchy?: boolean;
  }
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  // Normalize to array
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const useHierarchy = options?.useHierarchy ?? false;

  // Validate roles at middleware creation time
  if (rolesArray.length === 0) {
    throw new Error('[AUTHORIZE_MIDDLEWARE] At least one role must be specified');
  }

  if (!validateRoles(rolesArray)) {
    throw new Error(
      `[AUTHORIZE_MIDDLEWARE] Invalid roles specified: ${rolesArray.join(', ')}`
    );
  }

  // Return the actual middleware function
  return function authorizationMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const requestPath = req.path;

    try {
      console.log('[AUTHORIZE_MIDDLEWARE] Authorization attempt:', {
        correlationId,
        path: requestPath,
        method: req.method,
        requiredRoles: rolesArray,
        useHierarchy,
        timestamp: new Date().toISOString(),
      });

      // Check if user is authenticated
      if (!req.user) {
        const executionTimeMs = Date.now() - startTime;

        console.error('[AUTHORIZE_MIDDLEWARE] User not authenticated:', {
          correlationId,
          path: requestPath,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendAuthorizationError(
          res,
          401,
          'UNAUTHENTICATED',
          'Authentication required for authorization',
          requestPath
        );
        return;
      }

      const userRole = req.user.role;

      // Check authorization based on strategy
      let authorized = false;

      if (useHierarchy && rolesArray.length === 1) {
        // Use hierarchical checking for single role
        authorized = hasRoleLevel(userRole, rolesArray[0]!);
      } else {
        // Use exact role matching for multiple roles or non-hierarchical
        authorized = hasAnyRole(userRole, rolesArray);
      }

      if (!authorized) {
        const executionTimeMs = Date.now() - startTime;

        console.warn('[AUTHORIZE_MIDDLEWARE] Authorization denied:', {
          correlationId,
          path: requestPath,
          userId: req.user.userId,
          email: req.user.email,
          userRole,
          requiredRoles: rolesArray,
          useHierarchy,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendAuthorizationError(
          res,
          403,
          'FORBIDDEN',
          'Insufficient permissions to access this resource',
          requestPath,
          userRole,
          rolesArray
        );
        return;
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTHORIZE_MIDDLEWARE] Authorization granted:', {
        correlationId,
        path: requestPath,
        userId: req.user.userId,
        email: req.user.email,
        userRole,
        requiredRoles: rolesArray,
        useHierarchy,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      // Authorization successful, continue to next middleware
      next();
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTHORIZE_MIDDLEWARE] Authorization error:', {
        correlationId,
        path: requestPath,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthorizationError(
        res,
        500,
        'AUTHORIZATION_ERROR',
        'An error occurred during authorization',
        requestPath
      );
    }
  };
}

/**
 * Require HR Admin Role Middleware
 * 
 * Convenience middleware that requires HR_ADMIN role.
 * Equivalent to authorize('HR_ADMIN').
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 * 
 * @example
 * router.post('/users', authenticate, requireHRAdmin, createUserHandler);
 */
export const requireHRAdmin = authorize('HR_ADMIN');

/**
 * Require Manager Role Middleware
 * 
 * Convenience middleware that requires MANAGER or HR_ADMIN role (using hierarchy).
 * Equivalent to authorize('MANAGER', { useHierarchy: true }).
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 * 
 * @example
 * router.get('/team', authenticate, requireManager, getTeamHandler);
 */
export const requireManager = authorize('MANAGER', { useHierarchy: true });

/**
 * Require Employee Role Middleware
 * 
 * Convenience middleware that requires any authenticated user (all roles).
 * Equivalent to authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']).
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 * 
 * @example
 * router.get('/profile', authenticate, requireEmployee, getProfileHandler);
 */
export const requireEmployee = authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']);

/**
 * Check if user is resource owner or has elevated role
 * 
 * Helper function to check if the authenticated user is the owner of a resource
 * or has an elevated role (HR_ADMIN or MANAGER) that grants access.
 * 
 * @param {AuthenticatedRequest} req - Express request object
 * @param {string} resourceOwnerId - ID of the resource owner
 * @returns {boolean} True if user is owner or has elevated role
 * 
 * @example
 * router.get('/users/:id', authenticate, (req, res) => {
 *   if (!isOwnerOrElevated(req, req.params.id)) {
 *     return res.status(403).json({ error: 'Access denied' });
 *   }
 *   // Continue with handler
 * });
 */
export function isOwnerOrElevated(
  req: AuthenticatedRequest,
  resourceOwnerId: string
): boolean {
  if (!req.user) {
    return false;
  }

  // Check if user is the owner
  if (req.user.userId === resourceOwnerId) {
    return true;
  }

  // Check if user has elevated role
  const elevatedRoles: UserRole[] = ['HR_ADMIN', 'MANAGER'];
  return hasAnyRole(req.user.role, elevatedRoles);
}

/**
 * Create resource owner or elevated role middleware
 * 
 * Factory function that creates middleware to check if user is resource owner
 * or has elevated role. The resource owner ID is extracted using the provided
 * extractor function.
 * 
 * @param {Function} ownerIdExtractor - Function to extract owner ID from request
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Check if user can access their own profile or is HR/Manager
 * const requireOwnerOrElevated = createOwnerOrElevatedMiddleware(
 *   (req) => req.params.userId
 * );
 * router.get('/users/:userId', authenticate, requireOwnerOrElevated, handler);
 */
export function createOwnerOrElevatedMiddleware(
  ownerIdExtractor: (req: AuthenticatedRequest) => string | undefined
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return function ownerOrElevatedMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const requestPath = req.path;

    try {
      console.log('[AUTHORIZE_MIDDLEWARE] Owner or elevated check:', {
        correlationId,
        path: requestPath,
        method: req.method,
        timestamp: new Date().toISOString(),
      });

      if (!req.user) {
        const executionTimeMs = Date.now() - startTime;

        console.error('[AUTHORIZE_MIDDLEWARE] User not authenticated:', {
          correlationId,
          path: requestPath,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendAuthorizationError(
          res,
          401,
          'UNAUTHENTICATED',
          'Authentication required',
          requestPath
        );
        return;
      }

      const resourceOwnerId = ownerIdExtractor(req);

      if (!resourceOwnerId) {
        const executionTimeMs = Date.now() - startTime;

        console.error('[AUTHORIZE_MIDDLEWARE] Could not extract resource owner ID:', {
          correlationId,
          path: requestPath,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendAuthorizationError(
          res,
          400,
          'INVALID_REQUEST',
          'Could not determine resource owner',
          requestPath
        );
        return;
      }

      const authorized = isOwnerOrElevated(req, resourceOwnerId);

      if (!authorized) {
        const executionTimeMs = Date.now() - startTime;

        console.warn('[AUTHORIZE_MIDDLEWARE] Owner or elevated check failed:', {
          correlationId,
          path: requestPath,
          userId: req.user.userId,
          userRole: req.user.role,
          resourceOwnerId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        sendAuthorizationError(
          res,
          403,
          'FORBIDDEN',
          'Access denied: must be resource owner or have elevated role',
          requestPath,
          req.user.role
        );
        return;
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTHORIZE_MIDDLEWARE] Owner or elevated check passed:', {
        correlationId,
        path: requestPath,
        userId: req.user.userId,
        userRole: req.user.role,
        resourceOwnerId,
        isOwner: req.user.userId === resourceOwnerId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      next();
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTHORIZE_MIDDLEWARE] Owner or elevated check error:', {
        correlationId,
        path: requestPath,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      sendAuthorizationError(
        res,
        500,
        'AUTHORIZATION_ERROR',
        'An error occurred during authorization',
        requestPath
      );
    }
  };
}

/**
 * Get role hierarchy level
 * 
 * Returns the numeric hierarchy level for a given role.
 * Higher numbers indicate higher privilege levels.
 * 
 * @param {UserRole} role - User role
 * @returns {number} Hierarchy level (1-3)
 * 
 * @example
 * const level = getRoleLevel('HR_ADMIN'); // Returns 3
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role];
}

/**
 * Compare role levels
 * 
 * Compares two roles and returns whether the first role has equal or higher
 * privilege level than the second role.
 * 
 * @param {UserRole} role1 - First role to compare
 * @param {UserRole} role2 - Second role to compare
 * @returns {boolean} True if role1 >= role2 in hierarchy
 * 
 * @example
 * compareRoles('HR_ADMIN', 'MANAGER'); // Returns true
 * compareRoles('EMPLOYEE', 'MANAGER'); // Returns false
 */
export function compareRoles(role1: UserRole, role2: UserRole): boolean {
  return getRoleLevel(role1) >= getRoleLevel(role2);
}

/**
 * Default export with all authorization middleware functions
 */
export default {
  authorize,
  requireHRAdmin,
  requireManager,
  requireEmployee,
  isOwnerOrElevated,
  createOwnerOrElevatedMiddleware,
  getRoleLevel,
  compareRoles,
};