/**
 * Authentication Type Definitions
 * 
 * This module provides comprehensive TypeScript type definitions for the authentication
 * system, including JWT payloads, user credentials, token pairs, and authentication
 * responses. All types are designed to work seamlessly with the existing UserRole
 * enum and provide type safety throughout the authentication flow.
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
 * @property userId - Unique identifier for the authenticated user
 * @property email - User's email address (used for identification)
 * @property role - User's role in the system (HR_ADMIN, MANAGER, or EMPLOYEE)
 * @property iat - Token issued at timestamp (Unix epoch seconds)
 * @property exp - Token expiration timestamp (Unix epoch seconds)
 * @property tokenType - Type of token ('access' or 'refresh')
 */
export interface JWTPayload {
  /**
   * Unique identifier for the authenticated user
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
   * Token issued at timestamp (Unix epoch seconds)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp (Unix epoch seconds)
   */
  readonly exp: number;

  /**
   * Type of token - 'access' for short-lived access tokens, 'refresh' for long-lived refresh tokens
   */
  readonly tokenType: 'access' | 'refresh';
}

/**
 * Refresh Token Payload
 * 
 * Represents the decoded payload of a JWT refresh token. Refresh tokens have
 * a longer lifetime and are used to obtain new access tokens without re-authentication.
 * 
 * @property userId - Unique identifier for the authenticated user
 * @property email - User's email address
 * @property tokenId - Unique identifier for this specific refresh token (for revocation)
 * @property iat - Token issued at timestamp (Unix epoch seconds)
 * @property exp - Token expiration timestamp (Unix epoch seconds)
 * @property tokenType - Always 'refresh' for refresh tokens
 */
export interface RefreshTokenPayload {
  /**
   * Unique identifier for the authenticated user
   */
  readonly userId: string;

  /**
   * User's email address
   */
  readonly email: string;

  /**
   * Unique identifier for this specific refresh token (used for revocation)
   */
  readonly tokenId: string;

  /**
   * Token issued at timestamp (Unix epoch seconds)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp (Unix epoch seconds)
   */
  readonly exp: number;

  /**
   * Type of token - always 'refresh'
   */
  readonly tokenType: 'refresh';
}

/**
 * Login Credentials
 * 
 * Represents the credentials provided by a user during login.
 * Both fields are required for authentication.
 * 
 * @property email - User's email address (used as username)
 * @property password - User's password (plain text, will be compared with hashed password)
 */
export interface LoginCredentials {
  /**
   * User's email address (used as username)
   */
  readonly email: string;

  /**
   * User's password (plain text, will be compared with hashed password)
   */
  readonly password: string;
}

/**
 * User Registration Data
 * 
 * Represents the data required to register a new user in the system.
 * All fields are required for successful registration.
 * 
 * @property email - User's email address (must be unique)
 * @property password - User's password (will be hashed before storage)
 * @property firstName - User's first name
 * @property lastName - User's last name
 * @property role - User's role in the system (defaults to EMPLOYEE if not specified)
 */
export interface RegisterData {
  /**
   * User's email address (must be unique)
   */
  readonly email: string;

  /**
   * User's password (will be hashed before storage)
   */
  readonly password: string;

  /**
   * User's first name
   */
  readonly firstName: string;

  /**
   * User's last name
   */
  readonly lastName: string;

  /**
   * User's role in the system
   */
  readonly role: UserRole;
}

/**
 * Token Pair
 * 
 * Represents a pair of JWT tokens (access and refresh) issued during
 * authentication or token refresh operations.
 * 
 * @property accessToken - Short-lived JWT access token for API authentication
 * @property refreshToken - Long-lived JWT refresh token for obtaining new access tokens
 * @property expiresIn - Access token expiration time in seconds
 * @property tokenType - Token type identifier (always 'Bearer')
 */
export interface TokenPair {
  /**
   * Short-lived JWT access token for API authentication
   */
  readonly accessToken: string;

  /**
   * Long-lived JWT refresh token for obtaining new access tokens
   */
  readonly refreshToken: string;

  /**
   * Access token expiration time in seconds
   */
  readonly expiresIn: number;

  /**
   * Token type identifier (always 'Bearer' for JWT tokens)
   */
  readonly tokenType: 'Bearer';
}

/**
 * Authentication Response
 * 
 * Represents the complete response returned after successful authentication
 * (login or registration). Includes both tokens and user information.
 * 
 * @property success - Whether the authentication was successful
 * @property tokens - Token pair (access and refresh tokens)
 * @property user - Authenticated user information (without sensitive data)
 * @property message - Optional success message
 */
export interface AuthResponse {
  /**
   * Whether the authentication was successful
   */
  readonly success: boolean;

  /**
   * Token pair (access and refresh tokens)
   */
  readonly tokens: TokenPair;

  /**
   * Authenticated user information (without sensitive data)
   */
  readonly user: AuthenticatedUser;

  /**
   * Optional success message
   */
  readonly message?: string;
}

/**
 * Authenticated User Information
 * 
 * Represents user information returned in authentication responses.
 * This excludes sensitive data like password hashes.
 * 
 * @property id - Unique user identifier
 * @property email - User's email address
 * @property firstName - User's first name
 * @property lastName - User's last name
 * @property role - User's role in the system
 * @property isActive - Whether the user account is active
 */
export interface AuthenticatedUser {
  /**
   * Unique user identifier
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
   * User's role in the system
   */
  readonly role: UserRole;

  /**
   * Whether the user account is active
   */
  readonly isActive: boolean;
}

/**
 * Extended Express Request with Authentication
 * 
 * Extends the standard Express Request interface to include authenticated
 * user information. This is populated by the authentication middleware
 * after successful token validation.
 * 
 * @property user - Authenticated user information from JWT token
 * @property correlationId - Optional correlation ID for request tracing
 */
export interface AuthRequest {
  /**
   * Authenticated user information from JWT token
   * Populated by authentication middleware after token validation
   */
  readonly user?: JWTPayload;

  /**
   * Optional correlation ID for request tracing
   * Used for logging and debugging across service boundaries
   */
  readonly correlationId?: string;
}

/**
 * Password Reset Request Data
 * 
 * Represents the data required to initiate a password reset flow.
 * 
 * @property email - Email address of the user requesting password reset
 */
export interface PasswordResetRequest {
  /**
   * Email address of the user requesting password reset
   */
  readonly email: string;
}

/**
 * Password Reset Confirmation Data
 * 
 * Represents the data required to complete a password reset operation.
 * 
 * @property token - Password reset token (sent via email)
 * @property newPassword - New password to set
 */
export interface PasswordResetConfirmation {
  /**
   * Password reset token (sent via email)
   */
  readonly token: string;

  /**
   * New password to set
   */
  readonly newPassword: string;
}

/**
 * Password Reset Token Payload
 * 
 * Represents the decoded payload of a password reset token.
 * 
 * @property userId - User identifier
 * @property email - User's email address
 * @property tokenId - Unique token identifier (for single-use validation)
 * @property iat - Token issued at timestamp (Unix epoch seconds)
 * @property exp - Token expiration timestamp (Unix epoch seconds)
 * @property purpose - Token purpose (always 'password_reset')
 */
export interface PasswordResetTokenPayload {
  /**
   * User identifier
   */
  readonly userId: string;

  /**
   * User's email address
   */
  readonly email: string;

  /**
   * Unique token identifier (for single-use validation)
   */
  readonly tokenId: string;

  /**
   * Token issued at timestamp (Unix epoch seconds)
   */
  readonly iat: number;

  /**
   * Token expiration timestamp (Unix epoch seconds)
   */
  readonly exp: number;

  /**
   * Token purpose (always 'password_reset')
   */
  readonly purpose: 'password_reset';
}

/**
 * Token Refresh Request
 * 
 * Represents the data required to refresh an access token.
 * 
 * @property refreshToken - Valid refresh token
 */
export interface TokenRefreshRequest {
  /**
   * Valid refresh token
   */
  readonly refreshToken: string;
}

/**
 * Logout Request
 * 
 * Represents the data for logout operation.
 * 
 * @property refreshToken - Optional refresh token to invalidate
 */
export interface LogoutRequest {
  /**
   * Optional refresh token to invalidate
   * If not provided, only the access token is invalidated
   */
  readonly refreshToken?: string;
}

/**
 * Account Lockout Information
 * 
 * Represents information about a locked user account.
 * 
 * @property userId - User identifier
 * @property email - User's email address
 * @property failedAttempts - Number of failed login attempts
 * @property lockedAt - Timestamp when account was locked
 * @property lockedUntil - Timestamp when account will be automatically unlocked
 */
export interface AccountLockout {
  /**
   * User identifier
   */
  readonly userId: string;

  /**
   * User's email address
   */
  readonly email: string;

  /**
   * Number of failed login attempts
   */
  readonly failedAttempts: number;

  /**
   * Timestamp when account was locked
   */
  readonly lockedAt: Date;

  /**
   * Timestamp when account will be automatically unlocked
   */
  readonly lockedUntil: Date;
}

/**
 * Failed Login Attempt
 * 
 * Represents a failed login attempt for tracking and security purposes.
 * 
 * @property email - Email address used in the attempt
 * @property ipAddress - IP address of the client
 * @property userAgent - User agent string of the client
 * @property timestamp - Timestamp of the attempt
 * @property reason - Reason for failure
 */
export interface FailedLoginAttempt {
  /**
   * Email address used in the attempt
   */
  readonly email: string;

  /**
   * IP address of the client
   */
  readonly ipAddress: string;

  /**
   * User agent string of the client
   */
  readonly userAgent: string;

  /**
   * Timestamp of the attempt
   */
  readonly timestamp: Date;

  /**
   * Reason for failure
   */
  readonly reason: 'invalid_credentials' | 'account_locked' | 'account_inactive';
}

/**
 * Authentication Error Response
 * 
 * Represents an error response from authentication operations.
 * 
 * @property success - Always false for error responses
 * @property error - Error information
 */
export interface AuthErrorResponse {
  /**
   * Always false for error responses
   */
  readonly success: false;

  /**
   * Error information
   */
  readonly error: {
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
     * Timestamp when error occurred
     */
    readonly timestamp: Date;
  };
}

/**
 * Token Validation Result
 * 
 * Represents the result of token validation.
 * 
 * @property valid - Whether the token is valid
 * @property payload - Decoded token payload (if valid)
 * @property error - Error message (if invalid)
 */
export interface TokenValidationResult {
  /**
   * Whether the token is valid
   */
  readonly valid: boolean;

  /**
   * Decoded token payload (if valid)
   */
  readonly payload?: JWTPayload;

  /**
   * Error message (if invalid)
   */
  readonly error?: string;
}

/**
 * Password Validation Result
 * 
 * Represents the result of password validation against policy.
 * 
 * @property isValid - Whether the password meets all requirements
 * @property errors - Array of validation error messages
 */
export interface PasswordValidationResult {
  /**
   * Whether the password meets all requirements
   */
  readonly isValid: boolean;

  /**
   * Array of validation error messages
   */
  readonly errors: string[];
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
    (payload.tokenType === 'access' || payload.tokenType === 'refresh')
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
    typeof credentials.password === 'string'
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
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.role === 'string'
  );
}

/**
 * Type guard to check if a value is a valid TokenPair
 * 
 * @param value - Value to check
 * @returns True if value is a valid TokenPair
 */
export function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const tokens = value as Record<string, unknown>;

  return (
    typeof tokens.accessToken === 'string' &&
    typeof tokens.refreshToken === 'string' &&
    typeof tokens.expiresIn === 'number' &&
    tokens.tokenType === 'Bearer'
  );
}

/**
 * Type guard to check if a value is a valid AuthResponse
 * 
 * @param value - Value to check
 * @returns True if value is a valid AuthResponse
 */
export function isAuthResponse(value: unknown): value is AuthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.success === 'boolean' &&
    isTokenPair(response.tokens) &&
    typeof response.user === 'object' &&
    response.user !== null
  );
}