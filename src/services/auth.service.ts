/**
 * Authentication Service
 * 
 * Provides comprehensive authentication business logic including user registration,
 * login, token management, password reset, and account lockout functionality.
 * Implements security best practices with bcrypt password hashing, JWT token
 * generation, and protection against brute force attacks.
 * 
 * @module services/auth
 */

import { randomBytes } from 'crypto';

import { executeQuery, executeTransaction, queryOne } from '../db/index.js';
import { type UserRole } from '../types/index.js';
import {
  type AuthenticatedUser,
  type AuthResponse,
  type LoginCredentials,
  type PasswordResetConfirmation,
  type PasswordResetRequest,
  type PasswordResetTokenPayload,
  type RegisterData,
  type TokenPair,
} from '../types/auth.js';
import { hashPassword, comparePassword, validatePassword } from '../utils/password.js';
import {
  generateToken,
  verifyToken,
} from '../utils/jwt.js';
import { getJWTConfig } from '../config/auth.js';

/**
 * Database user record structure
 */
interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly role: UserRole;
  readonly is_active: boolean;
  readonly failed_login_attempts: number;
  readonly locked_until: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Token blacklist record structure
 */
interface TokenBlacklistRecord {
  readonly token_id: string;
  readonly user_id: string;
  readonly expires_at: Date;
  readonly blacklisted_at: Date;
}

/**
 * Password reset token record structure
 */
interface PasswordResetTokenRecord {
  readonly token_id: string;
  readonly user_id: string;
  readonly expires_at: Date;
  readonly used: boolean;
  readonly created_at: Date;
}

/**
 * Authentication service error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  PASSWORD_RESET_TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  PASSWORD_RESET_TOKEN_USED = 'PASSWORD_RESET_TOKEN_USED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Authentication service error
 */
export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

/**
 * Account lockout configuration
 */
const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `auth_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Authentication Service
 * 
 * Provides all authentication-related business logic including:
 * - User registration with password hashing
 * - Login with credential validation and token generation
 * - Token refresh mechanism
 * - Logout with token blacklisting
 * - Password reset flow
 * - Account lockout protection
 */
export class AuthService {
  /**
   * Register a new user
   * 
   * Creates a new user account with hashed password. Validates that email
   * is unique and password meets strength requirements.
   * 
   * @param data - User registration data
   * @param options - Optional operation options
   * @returns Authentication response with tokens and user info
   * @throws AuthServiceError if registration fails
   */
  async register(
    data: RegisterData,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<AuthResponse> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting user registration:', {
        email: data.email,
        role: data.role,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new AuthServiceError(
          'Invalid email format',
          AuthErrorCode.VALIDATION_ERROR,
          { field: 'email', correlationId }
        );
      }

      // Validate password strength
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.isValid) {
        throw new AuthServiceError(
          'Password does not meet strength requirements',
          AuthErrorCode.WEAK_PASSWORD,
          {
            errors: passwordValidation.errors,
            strengthScore: passwordValidation.strengthScore,
            correlationId,
          }
        );
      }

      // Validate name fields
      if (!data.firstName || data.firstName.trim().length === 0) {
        throw new AuthServiceError(
          'First name is required',
          AuthErrorCode.VALIDATION_ERROR,
          { field: 'firstName', correlationId }
        );
      }

      if (!data.lastName || data.lastName.trim().length === 0) {
        throw new AuthServiceError(
          'Last name is required',
          AuthErrorCode.VALIDATION_ERROR,
          { field: 'lastName', correlationId }
        );
      }

      // Check if email already exists
      const existingUser = await queryOne<UserRecord>(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()],
        { correlationId, operation: 'check_email_exists' }
      );

      if (existingUser) {
        console.warn('[AUTH_SERVICE] Registration failed: Email already exists', {
          email: data.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Email address is already registered',
          AuthErrorCode.EMAIL_ALREADY_EXISTS,
          { email: data.email, correlationId }
        );
      }

      // Hash password
      const passwordHashResult = await hashPassword(data.password);

      // Create user in transaction
      const user = await executeTransaction<UserRecord>(
        async (client) => {
          const result = await client.query<UserRecord>(
            `INSERT INTO users (
              email, password_hash, first_name, last_name, role, 
              is_active, failed_login_attempts, locked_until
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              data.email.toLowerCase(),
              passwordHashResult.hash,
              data.firstName.trim(),
              data.lastName.trim(),
              data.role,
              true, // is_active
              0, // failed_login_attempts
              null, // locked_until
            ]
          );

          if (result.rows.length === 0) {
            throw new Error('Failed to create user record');
          }

          return result.rows[0]!;
        },
        { correlationId, operation: 'register_user' }
      );

      // Generate tokens
      const tokens = await this.generateTokenPair(user, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] User registration completed successfully:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        tokens,
        user: this.mapUserToAuthenticatedUser(user),
        message: 'Registration successful',
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Registration failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected registration error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Registration failed: ${errorMessage}`,
        AuthErrorCode.VALIDATION_ERROR,
        { correlationId }
      );
    }
  }

  /**
   * Login user with credentials
   * 
   * Validates user credentials, checks account status, and generates tokens.
   * Implements account lockout protection against brute force attacks.
   * 
   * @param credentials - User login credentials
   * @param options - Optional operation options
   * @returns Authentication response with tokens and user info
   * @throws AuthServiceError if login fails
   */
  async login(
    credentials: LoginCredentials,
    options?: {
      readonly correlationId?: string;
      readonly ipAddress?: string;
      readonly userAgent?: string;
    }
  ): Promise<AuthResponse> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting login attempt:', {
        email: credentials.email,
        ipAddress: options?.ipAddress,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new AuthServiceError(
          'Email and password are required',
          AuthErrorCode.VALIDATION_ERROR,
          { correlationId }
        );
      }

      // Find user by email
      const user = await queryOne<UserRecord>(
        'SELECT * FROM users WHERE email = $1',
        [credentials.email.toLowerCase()],
        { correlationId, operation: 'find_user_by_email' }
      );

      if (!user) {
        console.warn('[AUTH_SERVICE] Login failed: User not found', {
          email: credentials.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Invalid email or password',
          AuthErrorCode.INVALID_CREDENTIALS,
          { correlationId }
        );
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const lockoutRemainingMs = new Date(user.locked_until).getTime() - Date.now();
        const lockoutRemainingMinutes = Math.ceil(lockoutRemainingMs / 60000);

        console.warn('[AUTH_SERVICE] Login failed: Account locked', {
          userId: user.id,
          email: user.email,
          lockedUntil: user.locked_until,
          remainingMinutes: lockoutRemainingMinutes,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          `Account is locked. Please try again in ${lockoutRemainingMinutes} minutes.`,
          AuthErrorCode.ACCOUNT_LOCKED,
          {
            lockedUntil: user.locked_until,
            remainingMinutes: lockoutRemainingMinutes,
            correlationId,
          }
        );
      }

      // Check if account is active
      if (!user.is_active) {
        console.warn('[AUTH_SERVICE] Login failed: Account inactive', {
          userId: user.id,
          email: user.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Account is inactive. Please contact support.',
          AuthErrorCode.ACCOUNT_INACTIVE,
          { correlationId }
        );
      }

      // Verify password
      const passwordComparison = await comparePassword(
        credentials.password,
        user.password_hash
      );

      if (!passwordComparison.match) {
        // Increment failed login attempts
        await this.handleFailedLogin(user, { correlationId });

        console.warn('[AUTH_SERVICE] Login failed: Invalid password', {
          userId: user.id,
          email: user.email,
          failedAttempts: user.failed_login_attempts + 1,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Invalid email or password',
          AuthErrorCode.INVALID_CREDENTIALS,
          { correlationId }
        );
      }

      // Reset failed login attempts on successful login
      if (user.failed_login_attempts > 0) {
        await executeQuery(
          'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
          [user.id],
          { correlationId, operation: 'reset_failed_attempts' }
        );
      }

      // Generate tokens
      const tokens = await this.generateTokenPair(user, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Login successful:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        tokens,
        user: this.mapUserToAuthenticatedUser(user),
        message: 'Login successful',
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Login failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected login error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Login failed: ${errorMessage}`,
        AuthErrorCode.INVALID_CREDENTIALS,
        { correlationId }
      );
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * Validates refresh token and generates new access token. Refresh token
   * remains valid and can be reused until expiration.
   * 
   * @param refreshToken - Valid refresh token
   * @param options - Optional operation options
   * @returns New token pair
   * @throws AuthServiceError if refresh fails
   */
  async refreshToken(
    refreshToken: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<TokenPair> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting token refresh:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Verify refresh token
      const payload = verifyToken(refreshToken, 'refresh', { correlationId });

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(payload.tokenId!, {
        correlationId,
      });

      if (isBlacklisted) {
        console.warn('[AUTH_SERVICE] Token refresh failed: Token blacklisted', {
          tokenId: payload.tokenId,
          userId: payload.userId,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Refresh token has been revoked',
          AuthErrorCode.TOKEN_BLACKLISTED,
          { tokenId: payload.tokenId, correlationId }
        );
      }

      // Get user from database
      const user = await queryOne<UserRecord>(
        'SELECT * FROM users WHERE id = $1',
        [payload.userId],
        { correlationId, operation: 'find_user_by_id' }
      );

      if (!user) {
        console.error('[AUTH_SERVICE] Token refresh failed: User not found', {
          userId: payload.userId,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'User not found',
          AuthErrorCode.USER_NOT_FOUND,
          { userId: payload.userId, correlationId }
        );
      }

      // Check if account is active
      if (!user.is_active) {
        console.warn('[AUTH_SERVICE] Token refresh failed: Account inactive', {
          userId: user.id,
          email: user.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Account is inactive',
          AuthErrorCode.ACCOUNT_INACTIVE,
          { correlationId }
        );
      }

      // Generate new token pair
      const tokens = await this.generateTokenPair(user, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Token refresh successful:', {
        userId: user.id,
        email: user.email,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return tokens;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Token refresh failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected token refresh error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Token refresh failed: ${errorMessage}`,
        AuthErrorCode.INVALID_TOKEN,
        { correlationId }
      );
    }
  }

  /**
   * Logout user by blacklisting tokens
   * 
   * Adds refresh token to blacklist to prevent further use. Access tokens
   * cannot be revoked but will expire naturally.
   * 
   * @param refreshToken - Refresh token to blacklist
   * @param options - Optional operation options
   * @throws AuthServiceError if logout fails
   */
  async logout(
    refreshToken: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting logout:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Verify refresh token
      const payload = verifyToken(refreshToken, 'refresh', { correlationId });

      // Add token to blacklist
      await executeQuery(
        `INSERT INTO token_blacklist (token_id, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token_id) DO NOTHING`,
        [payload.tokenId, payload.userId, new Date(payload.exp * 1000)],
        { correlationId, operation: 'blacklist_token' }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Logout successful:', {
        userId: payload.userId,
        tokenId: payload.tokenId,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Logout failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected logout error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Logout failed: ${errorMessage}`,
        AuthErrorCode.INVALID_TOKEN,
        { correlationId }
      );
    }
  }

  /**
   * Initiate password reset flow
   * 
   * Generates a password reset token and returns it. In production, this
   * token would be sent via email to the user.
   * 
   * @param request - Password reset request with email
   * @param options - Optional operation options
   * @returns Password reset token
   * @throws AuthServiceError if reset initiation fails
   */
  async resetPassword(
    request: PasswordResetRequest,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<{ readonly token: string; readonly expiresAt: Date }> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting password reset:', {
        email: request.email,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Find user by email
      const user = await queryOne<UserRecord>(
        'SELECT * FROM users WHERE email = $1',
        [request.email.toLowerCase()],
        { correlationId, operation: 'find_user_by_email' }
      );

      // Always return success to prevent email enumeration
      if (!user) {
        console.warn('[AUTH_SERVICE] Password reset: User not found (returning success)', {
          email: request.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        // Return fake token to prevent timing attacks
        const fakeToken = randomBytes(32).toString('hex');
        const fakeExpiresAt = new Date(Date.now() + 3600000); // 1 hour

        return {
          token: fakeToken,
          expiresAt: fakeExpiresAt,
        };
      }

      // Generate password reset token
      const tokenId = randomBytes(16).toString('hex');
      const resetToken = generateToken(
        {
          userId: user.id,
          email: user.email,
          tokenId,
        },
        'reset',
        { correlationId }
      );

      const config = getJWTConfig();
      const expiresAt = new Date(Date.now() + config.passwordResetTokenExpiry * 1000);

      // Store token in database
      await executeQuery(
        `INSERT INTO password_reset_tokens (token_id, user_id, expires_at, used)
         VALUES ($1, $2, $3, $4)`,
        [tokenId, user.id, expiresAt, false],
        { correlationId, operation: 'store_reset_token' }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset token generated:', {
        userId: user.id,
        email: user.email,
        tokenId,
        expiresAt: expiresAt.toISOString(),
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return {
        token: resetToken,
        expiresAt,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Password reset failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Password reset failed: ${errorMessage}`,
        AuthErrorCode.VALIDATION_ERROR,
        { correlationId }
      );
    }
  }

  /**
   * Validate password reset token
   * 
   * Verifies that a password reset token is valid and not expired or used.
   * 
   * @param token - Password reset token to validate
   * @param options - Optional operation options
   * @returns Token payload if valid
   * @throws AuthServiceError if token is invalid
   */
  async validateResetToken(
    token: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<PasswordResetTokenPayload> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Validating password reset token:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Verify token signature and expiration
      const payload = verifyToken(token, 'reset', { correlationId });

      // Check if token exists and is not used
      const tokenRecord = await queryOne<PasswordResetTokenRecord>(
        'SELECT * FROM password_reset_tokens WHERE token_id = $1',
        [payload.tokenId],
        { correlationId, operation: 'find_reset_token' }
      );

      if (!tokenRecord) {
        console.warn('[AUTH_SERVICE] Reset token validation failed: Token not found', {
          tokenId: payload.tokenId,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Invalid password reset token',
          AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID,
          { tokenId: payload.tokenId, correlationId }
        );
      }

      if (tokenRecord.used) {
        console.warn('[AUTH_SERVICE] Reset token validation failed: Token already used', {
          tokenId: payload.tokenId,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        throw new AuthServiceError(
          'Password reset token has already been used',
          AuthErrorCode.PASSWORD_RESET_TOKEN_USED,
          { tokenId: payload.tokenId, correlationId }
        );
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Reset token validated successfully:', {
        tokenId: payload.tokenId,
        userId: payload.userId,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return payload as PasswordResetTokenPayload;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Reset token validation failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected reset token validation error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Reset token validation failed: ${errorMessage}`,
        AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID,
        { correlationId }
      );
    }
  }

  /**
   * Complete password reset with new password
   * 
   * Validates reset token, updates user password, and marks token as used.
   * 
   * @param confirmation - Password reset confirmation data
   * @param options - Optional operation options
   * @throws AuthServiceError if password reset fails
   */
  async confirmPasswordReset(
    confirmation: PasswordResetConfirmation,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting password reset confirmation:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Validate reset token
      const payload = await this.validateResetToken(confirmation.token, {
        correlationId,
      });

      // Validate new password strength
      const passwordValidation = validatePassword(confirmation.newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthServiceError(
          'New password does not meet strength requirements',
          AuthErrorCode.WEAK_PASSWORD,
          {
            errors: passwordValidation.errors,
            strengthScore: passwordValidation.strengthScore,
            correlationId,
          }
        );
      }

      // Hash new password
      const passwordHashResult = await hashPassword(confirmation.newPassword);

      // Update password and mark token as used in transaction
      await executeTransaction(
        async (client) => {
          // Update user password
          await client.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHashResult.hash, payload.userId]
          );

          // Mark token as used
          await client.query(
            'UPDATE password_reset_tokens SET used = true WHERE token_id = $1',
            [payload.tokenId]
          );
        },
        { correlationId, operation: 'confirm_password_reset' }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset completed successfully:', {
        userId: payload.userId,
        tokenId: payload.tokenId,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        console.error('[AUTH_SERVICE] Password reset confirmation failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Unexpected password reset confirmation error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthServiceError(
        `Password reset confirmation failed: ${errorMessage}`,
        AuthErrorCode.VALIDATION_ERROR,
        { correlationId }
      );
    }
  }

  /**
   * Generate access and refresh token pair
   * 
   * @param user - User record
   * @param options - Optional operation options
   * @returns Token pair
   */
  private async generateTokenPair(
    user: UserRecord,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<TokenPair> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      const tokenId = randomBytes(16).toString('hex');

      const accessToken = generateToken(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        'access',
        { correlationId }
      );

      const refreshToken = generateToken(
        {
          userId: user.id,
          email: user.email,
          tokenId,
        },
        'refresh',
        { correlationId }
      );

      const config = getJWTConfig();

      return {
        accessToken,
        refreshToken,
        expiresIn: config.accessTokenExpiry,
        tokenType: 'Bearer',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Token generation failed:', {
        error: errorMessage,
        userId: user.id,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Token generation failed: ${errorMessage}`);
    }
  }

  /**
   * Handle failed login attempt
   * 
   * Increments failed login counter and locks account if threshold exceeded.
   * 
   * @param user - User record
   * @param options - Optional operation options
   */
  private async handleFailedLogin(
    user: UserRecord,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      const newFailedAttempts = user.failed_login_attempts + 1;
      let lockedUntil: Date | null = null;

      if (newFailedAttempts >= LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);

        console.warn('[AUTH_SERVICE] Account locked due to failed login attempts:', {
          userId: user.id,
          email: user.email,
          failedAttempts: newFailedAttempts,
          lockedUntil: lockedUntil.toISOString(),
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      await executeQuery(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [newFailedAttempts, lockedUntil, user.id],
        { correlationId, operation: 'update_failed_attempts' }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Failed to update failed login attempts:', {
        error: errorMessage,
        userId: user.id,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Check if token is blacklisted
   * 
   * @param tokenId - Token ID to check
   * @param options - Optional operation options
   * @returns True if token is blacklisted
   */
  private async isTokenBlacklisted(
    tokenId: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<boolean> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      const record = await queryOne<TokenBlacklistRecord>(
        'SELECT token_id FROM token_blacklist WHERE token_id = $1 AND expires_at > NOW()',
        [tokenId],
        { correlationId, operation: 'check_token_blacklist' }
      );

      return record !== null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Failed to check token blacklist:', {
        error: errorMessage,
        tokenId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Fail closed - treat as blacklisted on error
      return true;
    }
  }

  /**
   * Map database user record to authenticated user
   * 
   * @param user - User record from database
   * @returns Authenticated user object
   */
  private mapUserToAuthenticatedUser(user: UserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
    };
  }
}

/**
 * Default export: AuthService instance
 */
export default new AuthService();