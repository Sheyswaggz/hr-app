/**
 * Authentication Type Definitions
 * 
 * This module provides comprehensive TypeScript type definitions for the authentication
 * system, including JWT payloads, request extensions, credentials, token pairs, user roles,
 * and authentication responses. All types are designed to ensure type safety across the
 * authentication flow and integrate seamlessly with the existing type system.
 * 
 * @module types/auth
 */

import { type UserRole } from './index.js';

/**
 * JWT Token Payload
 * 
 * Represents the decoded payload of a JWT access token. This payload is embedded
 * in the token and contains essential user information for authentication and
 * authorization purposes.
 * 
 * @interface JWTPayload
 */
export interface JWTPayload {
  /**
   * Unique identifier for the user
   */
  readonly userId: string;

  /**
   * User's email address (used for identification)
   */
  readonly email: string;

  /**
   * User's role in the system (HR_ADMIN, MANAGER, or EMPLOYEE)
   */
  readonly role: UserRole;

  /**
   * Token issued at timestamp (Unix epoch in seconds)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp (Unix epoch in seconds)
   */
  readonly exp: number;

  /**
   * Token type identifier (always 'access' for access tokens)
   */
  readonly type: 'access';

  /**
   * Optional JWT ID for token tracking and revocation
   */
  readonly jti?: string;
}

/**
 * Refresh Token Payload
 * 
 * Represents the decoded payload of a JWT refresh token. Refresh tokens have
 * a longer lifetime and are used to obtain new access tokens without re-authentication.
 * 
 * @interface RefreshTokenPayload
 */
export interface RefreshTokenPayload {
  /**
   * Unique identifier for the user
   */
  readonly userId: string;

  /**
   * User's email address
   */
  readonly email: string;

  /**
   * Token issued at timestamp (Unix epoch in seconds)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp (Unix epoch in seconds)
   */
  readonly exp: number;

  /**
   * Token type identifier (always 'refresh' for refresh tokens)
   */
  readonly type: 'refresh';

  /**
   * JWT ID for token tracking and revocation
   */
  readonly jti: string;

  /**
   * Token family ID for refresh token rotation tracking
   */
  readonly family?: string;
}

/**
 * Authenticated User Information
 * 
 * Represents the authenticated user information attached to requests after
 * successful JWT validation. This is a subset of the full User entity,
 * containing only the information needed for authorization decisions.
 * 
 * @interface AuthenticatedUser
 */
export interface AuthenticatedUser {
  /**
   * Unique identifier for the user
   */
  readonly userId: string;

  /**
   * User's email address
   */
  readonly email: string;

  /**
   * User's role in the system
   */
  readonly role: UserRole;

  /**
   * Whether the user account is active
   */
  readonly isActive: boolean;

  /**
   * Token issued at timestamp (for token freshness checks)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp
   */
  readonly exp: number;

  /**
   * Optional JWT ID (for token revocation checks)
   */
  readonly jti?: string;
}

/**
 * Authentication Request Extension
 * 
 * Extends the base Express Request interface to include authenticated user
 * information. This interface should be used in route handlers that require
 * authentication.
 * 
 * Note: This assumes Express Request type is available. If using a different
 * framework, adjust accordingly.
 * 
 * @interface AuthRequest
 */
export interface AuthRequest {
  /**
   * Authenticated user information (populated by auth middleware)
   * Will be undefined if request is not authenticated
   */
  user?: AuthenticatedUser;

  /**
   * Optional correlation ID for request tracing
   */
  correlationId?: string;

  /**
   * Raw JWT token string (for logging and debugging)
   */
  token?: string;
}

/**
 * Login Credentials
 * 
 * Represents the credentials provided by a user during login.
 * 
 * @interface LoginCredentials
 */
export interface LoginCredentials {
  /**
   * User's email address
   */
  readonly email: string;

  /**
   * User's password (plain text, will be hashed for comparison)
   */
  readonly password: string;

  /**
   * Optional flag to remember the user (extends token lifetime)
   */
  readonly rememberMe?: boolean;
}

/**
 * User Registration Data
 * 
 * Represents the data required to register a new user account.
 * 
 * @interface RegisterData
 */
export interface RegisterData {
  /**
   * User's email address (must be unique)
   */
  readonly email: string;

  /**
   * User's password (must meet strength requirements)
   */
  readonly password: string;

  /**
   * Password confirmation (must match password)
   */
  readonly passwordConfirm: string;

  /**
   * User's first name
   */
  readonly firstName: string;

  /**
   * User's last name
   */
  readonly lastName: string;

  /**
   * User's role (defaults to EMPLOYEE if not specified)
   */
  readonly role?: UserRole;

  /**
   * Optional department identifier
   */
  readonly departmentId?: string;

  /**
   * Optional manager identifier
   */
  readonly managerId?: string;
}

/**
 * Token Pair
 * 
 * Represents a pair of access and refresh tokens issued during authentication
 * or token refresh operations.
 * 
 * @interface TokenPair
 */
export interface TokenPair {
  /**
   * JWT access token (short-lived, used for API authentication)
   */
  readonly accessToken: string;

  /**
   * JWT refresh token (long-lived, used to obtain new access tokens)
   */
  readonly refreshToken: string;

  /**
   * Access token expiration time in seconds
   */
  readonly expiresIn: number;

  /**
   * Token type (always 'Bearer')
   */
  readonly tokenType: 'Bearer';

  /**
   * Timestamp when tokens were issued
   */
  readonly issuedAt: Date;
}

/**
 * Authentication Response
 * 
 * Represents the complete response returned after successful authentication
 * (login or registration).
 * 
 * @interface AuthResponse
 */
export interface AuthResponse {
  /**
   * Whether authentication was successful
   */
  readonly success: boolean;

  /**
   * Human-readable message
   */
  readonly message: string;

  /**
   * Token pair (access and refresh tokens)
   */
  readonly tokens: TokenPair;

  /**
   * Authenticated user information
   */
  readonly user: {
    /**
     * User's unique identifier
     */
    readonly id: string;

    /**
     * User's email address
     */
    readonly email: string;

    /**
     * User's first name
     */
    readonly firstName: string;

    /**
     * User's last name
     */
    readonly lastName: string;

    /**
     * User's role
     */
    readonly role: UserRole;

    /**
     * Whether the user account is active
     */
    readonly isActive: boolean;
  };

  /**
   * Timestamp of authentication
   */
  readonly timestamp: Date;
}

/**
 * Token Refresh Request
 * 
 * Represents the data required to refresh an access token.
 * 
 * @interface TokenRefreshRequest
 */
export interface TokenRefreshRequest {
  /**
   * Refresh token to use for obtaining new access token
   */
  readonly refreshToken: string;
}

/**
 * Password Reset Request
 * 
 * Represents the data required to initiate a password reset.
 * 
 * @interface PasswordResetRequest
 */
export interface PasswordResetRequest {
  /**
   * Email address of the account to reset
   */
  readonly email: string;
}

/**
 * Password Reset Confirmation
 * 
 * Represents the data required to complete a password reset.
 * 
 * @interface PasswordResetConfirm
 */
export interface PasswordResetConfirm {
  /**
   * Password reset token (sent via email)
   */
  readonly token: string;

  /**
   * New password
   */
  readonly password: string;

  /**
   * Password confirmation (must match password)
   */
  readonly passwordConfirm: string;
}

/**
 * Password Change Request
 * 
 * Represents the data required for an authenticated user to change their password.
 * 
 * @interface PasswordChangeRequest
 */
export interface PasswordChangeRequest {
  /**
   * Current password (for verification)
   */
  readonly currentPassword: string;

  /**
   * New password
   */
  readonly newPassword: string;

  /**
   * New password confirmation (must match newPassword)
   */
  readonly newPasswordConfirm: string;
}

/**
 * Account Lockout Information
 * 
 * Represents information about account lockout status due to failed login attempts.
 * 
 * @interface AccountLockout
 */
export interface AccountLockout {
  /**
   * Whether the account is currently locked
   */
  readonly isLocked: boolean;

  /**
   * Number of failed login attempts
   */
  readonly failedAttempts: number;

  /**
   * Timestamp when account was locked (if locked)
   */
  readonly lockedAt?: Date;

  /**
   * Timestamp when account will be automatically unlocked (if locked)
   */
  readonly lockedUntil?: Date;

  /**
   * Remaining time in seconds until automatic unlock
   */
  readonly remainingLockTimeSeconds?: number;
}

/**
 * Authentication Error Response
 * 
 * Represents an error response from authentication operations.
 * 
 * @interface AuthErrorResponse
 */
export interface AuthErrorResponse {
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
   * Additional error details
   */
  readonly details?: Record<string, unknown>;

  /**
   * Account lockout information (if applicable)
   */
  readonly lockout?: AccountLockout;

  /**
   * Timestamp when error occurred
   */
  readonly timestamp: Date;
}

/**
 * Token Validation Result
 * 
 * Represents the result of JWT token validation.
 * 
 * @interface TokenValidationResult
 */
export interface TokenValidationResult {
  /**
   * Whether token is valid
   */
  readonly valid: boolean;

  /**
   * Decoded payload (if valid)
   */
  readonly payload?: JWTPayload | RefreshTokenPayload;

  /**
   * Error message (if invalid)
   */
  readonly error?: string;

  /**
   * Error code for programmatic handling
   */
  readonly errorCode?: 'EXPIRED' | 'INVALID' | 'MALFORMED' | 'REVOKED';

  /**
   * Whether token is expired
   */
  readonly expired?: boolean;

  /**
   * Timestamp of validation
   */
  readonly timestamp: Date;
}

/**
 * Session Information
 * 
 * Represents active session information for a user.
 * 
 * @interface SessionInfo
 */
export interface SessionInfo {
  /**
   * Session identifier (JWT ID)
   */
  readonly sessionId: string;

  /**
   * User identifier
   */
  readonly userId: string;

  /**
   * Timestamp when session was created
   */
  readonly createdAt: Date;

  /**
   * Timestamp when session expires
   */
  readonly expiresAt: Date;

  /**
   * IP address of the client
   */
  readonly ipAddress?: string;

  /**
   * User agent string
   */
  readonly userAgent?: string;

  /**
   * Whether this is the current session
   */
  readonly isCurrent: boolean;

  /**
   * Timestamp of last activity
   */
  readonly lastActivityAt: Date;
}

/**
 * Authorization Context
 * 
 * Represents the context used for authorization decisions.
 * 
 * @interface AuthorizationContext
 */
export interface AuthorizationContext {
  /**
   * Authenticated user
   */
  readonly user: AuthenticatedUser;

  /**
   * Required role for the operation
   */
  readonly requiredRole?: UserRole;

  /**
   * Required roles (any of)
   */
  readonly requiredRoles?: UserRole[];

  /**
   * Resource being accessed
   */
  readonly resource?: string;

  /**
   * Action being performed
   */
  readonly action?: string;

  /**
   * Additional context for authorization
   */
  readonly context?: Record<string, unknown>;
}

/**
 * Authorization Result
 * 
 * Represents the result of an authorization check.
 * 
 * @interface AuthorizationResult
 */
export interface AuthorizationResult {
  /**
   * Whether authorization was granted
   */
  readonly authorized: boolean;

  /**
   * Reason for denial (if not authorized)
   */
  readonly reason?: string;

  /**
   * Required role that was missing (if applicable)
   */
  readonly requiredRole?: UserRole;

  /**
   * User's actual role
   */
  readonly userRole: UserRole;

  /**
   * Timestamp of authorization check
   */
  readonly timestamp: Date;
}

/**
 * Type guard to check if a value is a valid JWTPayload
 * 
 * @param value - Value to check
 * @returns True if value is a valid JWTPayload
 */
export function isJWTPayload(value: unknown): value is JWTPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.userId === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.role === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    payload.type === 'access'
  );
}

/**
 * Type guard to check if a value is a valid RefreshTokenPayload
 * 
 * @param value - Value to check
 * @returns True if value is a valid RefreshTokenPayload
 */
export function isRefreshTokenPayload(
  value: unknown
): value is RefreshTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.userId === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    payload.type === 'refresh' &&
    typeof payload.jti === 'string'
  );
}

/**
 * Type guard to check if a value is a valid AuthenticatedUser
 * 
 * @param value - Value to check
 * @returns True if value is a valid AuthenticatedUser
 */
export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.userId === 'string' &&
    typeof user.email === 'string' &&
    typeof user.role === 'string' &&
    typeof user.isActive === 'boolean' &&
    typeof user.iat === 'number' &&
    typeof user.exp === 'number'
  );
}

/**
 * Type guard to check if a value is a valid LoginCredentials
 * 
 * @param value - Value to check
 * @returns True if value is a valid LoginCredentials
 */
export function isLoginCredentials(value: unknown): value is LoginCredentials {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const credentials = value as Record<string, unknown>;

  return (
    typeof credentials.email === 'string' &&
    typeof credentials.password === 'string' &&
    (credentials.rememberMe === undefined ||
      typeof credentials.rememberMe === 'boolean')
  );
}

/**
 * Type guard to check if a value is a valid RegisterData
 * 
 * @param value - Value to check
 * @returns True if value is a valid RegisterData
 */
export function isRegisterData(value: unknown): value is RegisterData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.email === 'string' &&
    typeof data.password === 'string' &&
    typeof data.passwordConfirm === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    (data.role === undefined || typeof data.role === 'string') &&
    (data.departmentId === undefined || typeof data.departmentId === 'string') &&
    (data.managerId === undefined || typeof data.managerId === 'string')
  );
}

/**
 * Utility type for authentication operation results
 * 
 * Represents either a successful authentication response or an error response.
 */
export type AuthOperationResult = AuthResponse | AuthErrorResponse;

/**
 * Utility type for optional authentication (user may or may not be authenticated)
 */
export type OptionalAuth = AuthRequest & {
  user?: AuthenticatedUser;
};

/**
 * Utility type for required authentication (user must be authenticated)
 */
export type RequiredAuth = AuthRequest & {
  user: AuthenticatedUser;
};

/**
 * Utility type for role-based authentication
 */
export type RoleBasedAuth<R extends UserRole> = RequiredAuth & {
  user: AuthenticatedUser & {
    role: R;
  };
};