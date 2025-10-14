/**
 * Authentication Service Module
 * 
 * Provides comprehensive business logic for user authentication, registration,
 * token management, and password operations. Implements secure authentication
 * flows with proper error handling, account lockout, and structured logging.
 * 
 * This service handles:
 * - User registration with password validation and hashing
 * - User login with credential verification and token generation
 * - Token refresh mechanism for seamless session management
 * - Logout with token blacklisting
 * - Password reset flow with secure token generation
 * - Account lockout after failed login attempts
 * - Comprehensive error handling and logging
 * 
 * @module services/auth
 */

import crypto from 'crypto';

import { getAuthConfig } from '../config/auth.js';
import { executeQuery, executeTransaction, queryOne } from '../db/index.js';
import type {
  AuthResponse,
  AuthErrorResponse,
  LoginCredentials,
  RegisterData,
  TokenPair,
  AccountLockout,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../types/auth.js';
import { type UserRole } from '../types/index.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  type PasswordHashResult,
  type PasswordComparisonResult,
} from '../utils/password.js';

/**
 * Database user record interface
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
  readonly last_login_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Password reset token record interface
 */
interface PasswordResetTokenRecord {
  readonly id: string;
  readonly user_id: string;
  readonly token_hash: string;
  readonly expires_at: Date;
  readonly used_at: Date | null;
  readonly created_at: Date;
}

/**
 * Token blacklist record interface
 */
interface TokenBlacklistRecord {
  readonly id: string;
  readonly token_jti: string;
  readonly user_id: string;
  readonly expires_at: Date;
  readonly created_at: Date;
}

/**
 * Service operation result interface
 */
interface ServiceOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: string;
  readonly executionTimeMs: number;
}

/**
 * Authentication Service Class
 * 
 * Provides all authentication-related business logic including user registration,
 * login, token management, and password operations.
 */
export class AuthService {
  /**
   * Register a new user account
   * 
   * Creates a new user with hashed password after validating all input data.
   * Implements comprehensive validation including password strength, email format,
   * and duplicate email checking.
   * 
   * @param {RegisterData} data - User registration data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<AuthResponse | AuthErrorResponse>} Registration result with tokens
   * 
   * @example
   * const result = await authService.register({
   *   email: 'user@example.com',
   *   password: 'SecureP@ssw0rd',
   *   passwordConfirm: 'SecureP@ssw0rd',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   role: UserRole.Employee
   * });
   */
  async register(
    data: RegisterData,
    correlationId?: string
  ): Promise<AuthResponse | AuthErrorResponse> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `register_${Date.now()}`;

    console.log('[AUTH_SERVICE] Starting user registration:', {
      email: data.email,
      role: data.role || 'EMPLOYEE',
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input data
      const validationErrors: string[] = [];

      // Email validation
      if (!data.email || data.email.trim().length === 0) {
        validationErrors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        validationErrors.push('Invalid email format');
      }

      // Name validation
      if (!data.firstName || data.firstName.trim().length === 0) {
        validationErrors.push('First name is required');
      }
      if (!data.lastName || data.lastName.trim().length === 0) {
        validationErrors.push('Last name is required');
      }

      // Password validation
      if (!data.password || data.password.length === 0) {
        validationErrors.push('Password is required');
      }
      if (!data.passwordConfirm || data.passwordConfirm.length === 0) {
        validationErrors.push('Password confirmation is required');
      }
      if (data.password !== data.passwordConfirm) {
        validationErrors.push('Passwords do not match');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        validationErrors.push(...passwordValidation.errors);
      }

      if (validationErrors.length > 0) {
        console.warn('[AUTH_SERVICE] Registration validation failed:', {
          email: data.email,
          errors: validationErrors,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Registration validation failed',
          details: { errors: validationErrors },
          timestamp,
        };
      }

      // Check if email already exists
      const existingUser = await queryOne<UserRecord>(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()],
        { correlationId: cid, operation: 'check_email_exists' }
      );

      if (existingUser) {
        console.warn('[AUTH_SERVICE] Registration failed - email already exists:', {
          email: data.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists',
          timestamp,
        };
      }

      // Hash password
      const hashResult: PasswordHashResult = await hashPassword(data.password);
      if (!hashResult.success || !hashResult.hash) {
        console.error('[AUTH_SERVICE] Password hashing failed:', {
          email: data.email,
          error: hashResult.error,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'HASH_ERROR',
          message: 'Failed to process password',
          timestamp,
        };
      }

      // Create user in transaction
      const user = await executeTransaction<UserRecord>(
        async (client) => {
          const userId = crypto.randomUUID();
          const role = data.role || 'EMPLOYEE';

          const result = await client.query<UserRecord>(
            `INSERT INTO users (
              id, email, password_hash, first_name, last_name, role,
              is_active, failed_login_attempts, locked_until,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
              userId,
              data.email.toLowerCase(),
              hashResult.hash,
              data.firstName.trim(),
              data.lastName.trim(),
              role,
              true, // is_active
              0, // failed_login_attempts
              null, // locked_until
              timestamp,
              timestamp,
            ]
          );

          if (result.rows.length === 0) {
            throw new Error('Failed to create user record');
          }

          return result.rows[0]!;
        },
        {
          correlationId: cid,
          operation: 'create_user',
        }
      );

      // Generate tokens
      const accessToken = generateAccessToken(
        user.id,
        user.email,
        user.role,
        { correlationId: cid }
      );

      const refreshToken = generateRefreshToken(
        user.id,
        user.email,
        { correlationId: cid }
      );

      const config = getAuthConfig();
      const expiresIn = this.parseExpiresIn(config.jwt.expiresIn);

      const tokens: TokenPair = {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
        issuedAt: timestamp,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] User registered successfully:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        message: 'Registration successful',
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
        },
        timestamp,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Registration failed:', {
        email: data.email,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        code: 'REGISTRATION_ERROR',
        message: 'Registration failed',
        details: { error: errorMessage },
        timestamp,
      };
    }
  }

  /**
   * Authenticate user and generate tokens
   * 
   * Validates user credentials, checks account status and lockout,
   * and generates access and refresh tokens on successful authentication.
   * Implements account lockout after configured number of failed attempts.
   * 
   * @param {LoginCredentials} credentials - User login credentials
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<AuthResponse | AuthErrorResponse>} Authentication result with tokens
   * 
   * @example
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'SecureP@ssw0rd'
   * });
   */
  async login(
    credentials: LoginCredentials,
    correlationId?: string
  ): Promise<AuthResponse | AuthErrorResponse> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `login_${Date.now()}`;

    console.log('[AUTH_SERVICE] Starting login attempt:', {
      email: credentials.email,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      if (!credentials.email || !credentials.password) {
        console.warn('[AUTH_SERVICE] Login failed - missing credentials:', {
          email: credentials.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp,
        };
      }

      // Fetch user
      const user = await queryOne<UserRecord>(
        'SELECT * FROM users WHERE email = $1',
        [credentials.email.toLowerCase()],
        { correlationId: cid, operation: 'fetch_user' }
      );

      if (!user) {
        console.warn('[AUTH_SERVICE] Login failed - user not found:', {
          email: credentials.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp,
        };
      }

      // Check if account is active
      if (!user.is_active) {
        console.warn('[AUTH_SERVICE] Login failed - account inactive:', {
          userId: user.id,
          email: user.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive',
          timestamp,
        };
      }

      // Check account lockout
      const config = getAuthConfig();
      if (user.locked_until && new Date(user.locked_until) > timestamp) {
        const remainingLockTimeSeconds = Math.ceil(
          (new Date(user.locked_until).getTime() - timestamp.getTime()) / 1000
        );

        const lockout: AccountLockout = {
          isLocked: true,
          failedAttempts: user.failed_login_attempts,
          lockedAt: new Date(user.locked_until),
          lockedUntil: new Date(user.locked_until),
          remainingLockTimeSeconds,
        };

        console.warn('[AUTH_SERVICE] Login failed - account locked:', {
          userId: user.id,
          email: user.email,
          lockedUntil: user.locked_until,
          remainingLockTimeSeconds,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: `Account is locked. Try again in ${remainingLockTimeSeconds} seconds`,
          lockout,
          timestamp,
        };
      }

      // Verify password
      const passwordResult: PasswordComparisonResult = await comparePassword(
        credentials.password,
        user.password_hash
      );

      if (!passwordResult.success || !passwordResult.isMatch) {
        // Increment failed login attempts
        const newFailedAttempts = user.failed_login_attempts + 1;
        let lockedUntil: Date | null = null;

        if (newFailedAttempts >= config.security.maxLoginAttempts) {
          lockedUntil = new Date(
            timestamp.getTime() + config.security.lockoutDurationMs
          );
        }

        await executeQuery(
          `UPDATE users 
           SET failed_login_attempts = $1, 
               locked_until = $2,
               updated_at = $3
           WHERE id = $4`,
          [newFailedAttempts, lockedUntil, timestamp, user.id],
          { correlationId: cid, operation: 'update_failed_attempts' }
        );

        console.warn('[AUTH_SERVICE] Login failed - invalid password:', {
          userId: user.id,
          email: user.email,
          failedAttempts: newFailedAttempts,
          locked: lockedUntil !== null,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        if (lockedUntil) {
          const lockout: AccountLockout = {
            isLocked: true,
            failedAttempts: newFailedAttempts,
            lockedAt: timestamp,
            lockedUntil,
            remainingLockTimeSeconds: Math.ceil(config.security.lockoutDurationMs / 1000),
          };

          return {
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: 'Account locked due to too many failed login attempts',
            lockout,
            timestamp,
          };
        }

        return {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: {
            remainingAttempts: config.security.maxLoginAttempts - newFailedAttempts,
          },
          timestamp,
        };
      }

      // Reset failed login attempts and update last login
      await executeQuery(
        `UPDATE users 
         SET failed_login_attempts = 0,
             locked_until = NULL,
             last_login_at = $1,
             updated_at = $2
         WHERE id = $3`,
        [timestamp, timestamp, user.id],
        { correlationId: cid, operation: 'reset_failed_attempts' }
      );

      // Generate tokens
      const accessToken = generateAccessToken(
        user.id,
        user.email,
        user.role,
        { correlationId: cid }
      );

      const refreshToken = generateRefreshToken(
        user.id,
        user.email,
        { correlationId: cid }
      );

      const expiresIn = this.parseExpiresIn(config.jwt.expiresIn);

      const tokens: TokenPair = {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
        issuedAt: timestamp,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Login successful:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        message: 'Login successful',
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
        },
        timestamp,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Login failed:', {
        email: credentials.email,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        code: 'LOGIN_ERROR',
        message: 'Login failed',
        details: { error: errorMessage },
        timestamp,
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * Validates refresh token and generates a new access token.
   * Checks token blacklist and user account status.
   * 
   * @param {string} refreshToken - Refresh token
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<AuthResponse | AuthErrorResponse>} New tokens
   * 
   * @example
   * const result = await authService.refreshToken(refreshToken);
   */
  async refreshToken(
    refreshToken: string,
    correlationId?: string
  ): Promise<AuthResponse | AuthErrorResponse> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `refresh_${Date.now()}`;

    console.log('[AUTH_SERVICE] Starting token refresh:', {
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Verify refresh token
      const verificationResult = await verifyRefreshToken(refreshToken, {
        correlationId: cid,
      });

      if (!verificationResult.valid || !verificationResult.payload) {
        console.warn('[AUTH_SERVICE] Token refresh failed - invalid token:', {
          error: verificationResult.error,
          errorCode: verificationResult.errorCode,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: verificationResult.errorCode || 'INVALID_TOKEN',
          message: verificationResult.error || 'Invalid refresh token',
          timestamp,
        };
      }

      const payload = verificationResult.payload;

      // Check if token is blacklisted
      if (payload.jti) {
        const blacklisted = await queryOne<TokenBlacklistRecord>(
          'SELECT id FROM token_blacklist WHERE token_jti = $1',
          [payload.jti],
          { correlationId: cid, operation: 'check_blacklist' }
        );

        if (blacklisted) {
          console.warn('[AUTH_SERVICE] Token refresh failed - token blacklisted:', {
            jti: payload.jti,
            userId: payload.userId,
            correlationId: cid,
            timestamp: timestamp.toISOString(),
          });

          return {
            success: false,
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked',
            timestamp,
          };
        }
      }

      // Fetch user to verify account status
      const user = await queryOne<UserRecord>(
        'SELECT * FROM users WHERE id = $1',
        [payload.userId],
        { correlationId: cid, operation: 'fetch_user' }
      );

      if (!user) {
        console.warn('[AUTH_SERVICE] Token refresh failed - user not found:', {
          userId: payload.userId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp,
        };
      }

      if (!user.is_active) {
        console.warn('[AUTH_SERVICE] Token refresh failed - account inactive:', {
          userId: user.id,
          email: user.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive',
          timestamp,
        };
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(
        user.id,
        user.email,
        user.role,
        { correlationId: cid }
      );

      const newRefreshToken = generateRefreshToken(
        user.id,
        user.email,
        { correlationId: cid, family: payload.family }
      );

      const config = getAuthConfig();
      const expiresIn = this.parseExpiresIn(config.jwt.expiresIn);

      const tokens: TokenPair = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        tokenType: 'Bearer',
        issuedAt: timestamp,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Token refresh successful:', {
        userId: user.id,
        email: user.email,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        message: 'Token refresh successful',
        tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
        },
        timestamp,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Token refresh failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        code: 'REFRESH_ERROR',
        message: 'Token refresh failed',
        details: { error: errorMessage },
        timestamp,
      };
    }
  }

  /**
   * Logout user and blacklist token
   * 
   * Adds the token's JTI to the blacklist to prevent further use.
   * 
   * @param {string} tokenJti - JWT ID from the token
   * @param {string} userId - User identifier
   * @param {number} expiresAt - Token expiration timestamp (Unix epoch)
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<void>>} Logout result
   * 
   * @example
   * const result = await authService.logout(jti, userId, exp);
   */
  async logout(
    tokenJti: string,
    userId: string,
    expiresAt: number,
    correlationId?: string
  ): Promise<ServiceOperationResult<void>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `logout_${Date.now()}`;

    console.log('[AUTH_SERVICE] Starting logout:', {
      userId,
      tokenJti,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      const expiresAtDate = new Date(expiresAt * 1000);

      await executeQuery(
        `INSERT INTO token_blacklist (id, token_jti, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_jti) DO NOTHING`,
        [crypto.randomUUID(), tokenJti, userId, expiresAtDate, timestamp],
        { correlationId: cid, operation: 'blacklist_token' }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Logout successful:', {
        userId,
        tokenJti,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Logout failed:', {
        userId,
        tokenJti,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'LOGOUT_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Initiate password reset process
   * 
   * Generates a secure password reset token and stores it in the database.
   * In production, this would also send an email with the reset link.
   * 
   * @param {PasswordResetRequest} request - Password reset request
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<{ token: string }>>} Reset token
   * 
   * @example
   * const result = await authService.resetPassword({ email: 'user@example.com' });
   */
  async resetPassword(
    request: PasswordResetRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<{ token: string }>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `reset_${Date.now()}`;

    console.log('[AUTH_SERVICE] Starting password reset:', {
      email: request.email,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate email
      if (!request.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
        return {
          success: false,
          error: 'Invalid email address',
          errorCode: 'INVALID_EMAIL',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch user
      const user = await queryOne<UserRecord>(
        'SELECT id, email, is_active FROM users WHERE email = $1',
        [request.email.toLowerCase()],
        { correlationId: cid, operation: 'fetch_user' }
      );

      // Always return success to prevent email enumeration
      if (!user || !user.is_active) {
        console.warn('[AUTH_SERVICE] Password reset - user not found or inactive:', {
          email: request.email,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        // Return success but with a dummy token
        return {
          success: true,
          data: { token: 'dummy_token_for_security' },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      const config = getAuthConfig();
      const expiresAt = new Date(
        timestamp.getTime() + config.security.passwordResetTokenExpiryMs
      );

      // Store reset token
      await executeQuery(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [crypto.randomUUID(), user.id, tokenHash, expiresAt, timestamp],
        { correlationId: cid, operation: 'store_reset_token' }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset token generated:', {
        userId: user.id,
        email: user.email,
        expiresAt: expiresAt.toISOString(),
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      // In production, send email with reset link here
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      return {
        success: true,
        data: { token: resetToken },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Password reset failed:', {
        email: request.email,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'RESET_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Validate password reset token
   * 
   * Checks if a password reset token is valid and not expired.
   * 
   * @param {string} token - Password reset token
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<{ userId: string }>>} Validation result
   * 
   * @example
   * const result = await authService.validateResetToken(token);
   */
  async validateResetToken(
    token: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<{ userId: string }>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `validate_reset_${Date.now()}`;

    console.log('[AUTH_SERVICE] Validating password reset token:', {
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!token || token.length === 0) {
        return {
          success: false,
          error: 'Token is required',
          errorCode: 'INVALID_TOKEN',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const resetToken = await queryOne<PasswordResetTokenRecord>(
        `SELECT * FROM password_reset_tokens 
         WHERE token_hash = $1 
         AND expires_at > $2 
         AND used_at IS NULL`,
        [tokenHash, timestamp],
        { correlationId: cid, operation: 'fetch_reset_token' }
      );

      if (!resetToken) {
        console.warn('[AUTH_SERVICE] Invalid or expired reset token:', {
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Invalid or expired reset token',
          errorCode: 'INVALID_TOKEN',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Reset token validated:', {
        userId: resetToken.user_id,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: { userId: resetToken.user_id },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Token validation failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'VALIDATION_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Complete password reset with new password
   * 
   * Validates reset token, updates user password, and marks token as used.
   * 
   * @param {PasswordResetConfirm} data - Password reset confirmation data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<void>>} Reset result
   * 
   * @example
   * const result = await authService.confirmPasswordReset({
   *   token: resetToken,
   *   password: 'NewSecureP@ssw0rd',
   *   passwordConfirm: 'NewSecureP@ssw0rd'
   * });
   */
  async confirmPasswordReset(
    data: PasswordResetConfirm,
    correlationId?: string
  ): Promise<ServiceOperationResult<void>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `confirm_reset_${Date.now()}`;

    console.log('[AUTH_SERVICE] Confirming password reset:', {
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!data.token || data.token.length === 0) {
        validationErrors.push('Reset token is required');
      }
      if (!data.password || data.password.length === 0) {
        validationErrors.push('Password is required');
      }
      if (!data.passwordConfirm || data.passwordConfirm.length === 0) {
        validationErrors.push('Password confirmation is required');
      }
      if (data.password !== data.passwordConfirm) {
        validationErrors.push('Passwords do not match');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        validationErrors.push(...passwordValidation.errors);
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Validate token
      const tokenValidation = await this.validateResetToken(data.token, cid);
      if (!tokenValidation.success || !tokenValidation.data) {
        return {
          success: false,
          error: tokenValidation.error || 'Invalid reset token',
          errorCode: tokenValidation.errorCode || 'INVALID_TOKEN',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const userId = tokenValidation.data.userId;

      // Hash new password
      const hashResult = await hashPassword(data.password);
      if (!hashResult.success || !hashResult.hash) {
        return {
          success: false,
          error: 'Failed to process password',
          errorCode: 'HASH_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Update password and mark token as used in transaction
      await executeTransaction(
        async (client) => {
          // Update user password
          await client.query(
            `UPDATE users 
             SET password_hash = $1,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 updated_at = $2
             WHERE id = $3`,
            [hashResult.hash, timestamp, userId]
          );

          // Mark token as used
          const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
          await client.query(
            `UPDATE password_reset_tokens 
             SET used_at = $1 
             WHERE token_hash = $2`,
            [timestamp, tokenHash]
          );
        },
        {
          correlationId: cid,
          operation: 'confirm_password_reset',
        }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset confirmed:', {
        userId,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Password reset confirmation failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'RESET_CONFIRM_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Parse JWT expiresIn string to seconds
   * 
   * @private
   * @param {string} expiresIn - Expiration string (e.g., '1h', '7d')
   * @returns {number} Expiration time in seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default to 1 hour
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}

/**
 * Export singleton instance
 */
export const authService = new AuthService();

/**
 * Default export
 */
export default authService;