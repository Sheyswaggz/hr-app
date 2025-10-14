/**
 * Authentication Service Module
 * 
 * Comprehensive authentication service handling user registration, login,
 * token management, password reset, and account security features.
 * Implements secure authentication flows with proper error handling,
 * logging, and audit trails.
 * 
 * @module services/auth
 */

import { Pool } from 'pg';
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  TokenPayload,
  RefreshTokenPayload,
  PasswordResetRequest,
  PasswordResetConfirmation,
  ChangePasswordRequest,
  AccountLockoutInfo,
  AuthError,
  AuthErrorCode,
} from '../types/auth.js';
import {
  generateToken,
  verifyToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import {
  hashPassword,
  comparePassword,
  validatePassword,
} from '../utils/password.js';
import {
  getAuthConfig,
  getAccountLockoutConfig,
  getPasswordResetConfig,
} from '../config/auth.js';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

/**
 * Generate a cryptographically secure random token
 */
async function generateSecureToken(length: number = 32): Promise<string> {
  const buffer = await randomBytesAsync(length);
  return buffer.toString('hex');
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends Error implements AuthError {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: AuthErrorCode,
    statusCode: number = 401,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.correlationId = correlationId;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `auth-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Authentication Service Class
 * 
 * Provides comprehensive authentication functionality including:
 * - User registration and login
 * - Token generation and verification
 * - Password reset flows
 * - Account lockout protection
 * - Session management
 * - Audit logging
 */
export class AuthService {
  private readonly db: Pool;
  private readonly config: ReturnType<typeof getAuthConfig>;

  constructor(db: Pool) {
    this.db = db;
    this.config = getAuthConfig();

    console.log('[AUTH_SERVICE] Authentication service initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Register a new user
   * 
   * Creates a new user account with the provided registration data.
   * Validates input, checks for existing users, hashes password, and
   * creates the user record in the database.
      * 
   * @param data - User registration data
   * @param options - Optional registration options
   * @returns Created user object and authentication tokens
   * @throws {AuthenticationError} If registration fails
   * 
   * @example
   * ```typescript
   * const result = await authService.register({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   firstName: 'John',
   *   lastName: 'Doe'
   * });
   * ```
   */
  async register(
    data: RegisterData,
    options?: {
      readonly skipEmailVerification?: boolean;
      readonly correlationId?: string;
    }
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting user registration:', {
        email: data.email,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Validate password
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.isValid) {
        throw new AuthenticationError(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`,
          'INVALID_PASSWORD',
          400,
          { errors: passwordValidation.errors, correlationId }
        );
      }

      // Check password strength
      if (passwordValidation.strengthScore < 3) {
        throw new AuthenticationError(
          'Password is too weak. Please use a stronger password.',
          'WEAK_PASSWORD',
          400,
          { strengthScore: passwordValidation.strengthScore, correlationId }
        );
      }

      // Check if user already exists
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new AuthenticationError(
          'User with this email already exists',
          'USER_EXISTS',
          409,
          { email: data.email, correlationId }
        );
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user
      const result = await this.db.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, role,
          is_active, email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at`,
        [
          data.email.toLowerCase(),
          passwordHash,
          data.firstName,
          data.lastName,
          data.role || 'employee',
          true,
          options?.skipEmailVerification ?? false,
        ]
      );

      const user: User = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        role: result.rows[0].role,
        isActive: result.rows[0].is_active,
        emailVerified: result.rows[0].email_verified,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      // Generate tokens
      const tokens = await this.generateAuthTokens(user, { correlationId });

      // Log successful registration
      await this.logAuthEvent(
        user.id,
        'REGISTER',
        true,
        { correlationId }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] User registered successfully:', {
        userId: user.id,
        email: user.email,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return { user, tokens };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
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

      console.error('[AUTH_SERVICE] Unexpected error during registration:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Registration failed due to an unexpected error',
        'REGISTRATION_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Authenticate user and generate tokens
   * 
   * Validates user credentials, checks account status and lockout,
   * and generates authentication tokens on successful login.
   * 
   * @param credentials - User login credentials
   * @param options - Optional login options
   * @returns User object and authentication tokens
   * @throws {AuthenticationError} If authentication fails
   * 
   * @example
   * ```typescript
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!'
   * });
   * ```
   */
  async login(
    credentials: LoginCredentials,
    options?: {
      readonly ipAddress?: string;
      readonly userAgent?: string;
      readonly correlationId?: string;
    }
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting user login:', {
        email: credentials.email,
        ipAddress: options?.ipAddress,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Get user from database
      const result = await this.db.query(
        `SELECT id, email, password_hash, first_name, last_name, role,
                is_active, email_verified, failed_login_attempts, locked_until,
                created_at, updated_at
         FROM users WHERE email = $1`,
        [credentials.email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        // Log failed attempt
        await this.logAuthEvent(
          null,
          'LOGIN',
          false,
          {
            email: credentials.email,
            reason: 'USER_NOT_FOUND',
            ipAddress: options?.ipAddress,
            correlationId,
          }
        );

        throw new AuthenticationError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401,
          { correlationId }
        );
      }

      const userRow = result.rows[0];

      // Check if account is locked
      if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) {
        const lockoutInfo = await this.getAccountLockoutInfo(userRow.id);

        await this.logAuthEvent(
          userRow.id,
          'LOGIN',
          false,
          {
            reason: 'ACCOUNT_LOCKED',
            lockedUntil: userRow.locked_until,
            ipAddress: options?.ipAddress,
            correlationId,
          }
        );

        throw new AuthenticationError(
          'Account is temporarily locked due to too many failed login attempts',
          'ACCOUNT_LOCKED',
          423,
          { lockoutInfo, correlationId }
        );
      }

      // Check if account is active
      if (!userRow.is_active) {
        await this.logAuthEvent(
          userRow.id,
          'LOGIN',
          false,
          {
            reason: 'ACCOUNT_INACTIVE',
            ipAddress: options?.ipAddress,
            correlationId,
          }
        );

        throw new AuthenticationError(
          'Account is inactive. Please contact support.',
          'ACCOUNT_INACTIVE',
          403,
          { correlationId }
        );
      }

      // Verify password
      const passwordMatch = await comparePassword(
        credentials.password,
        userRow.password_hash
      );

      if (!passwordMatch) {
        // Increment failed login attempts
        await this.handleFailedLogin(userRow.id, {
          ipAddress: options?.ipAddress,
          correlationId,
        });

        throw new AuthenticationError(
          'Invalid email or password',
          'INVALID_CREDENTIALS',
          401,
          { correlationId }
        );
      }

      // Reset failed login attempts on successful login
      await this.db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
        [userRow.id]
      );

      const user: User = {
        id: userRow.id,
        email: userRow.email,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        role: userRow.role,
        isActive: userRow.is_active,
        emailVerified: userRow.email_verified,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at,
      };

      // Generate tokens
      const tokens = await this.generateAuthTokens(user, { correlationId });

      // Log successful login
      await this.logAuthEvent(
        user.id,
        'LOGIN',
        true,
        {
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
          correlationId,
        }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] User logged in successfully:', {
        userId: user.id,
        email: user.email,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return { user, tokens };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
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

      console.error('[AUTH_SERVICE] Unexpected error during login:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Login failed due to an unexpected error',
        'LOGIN_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Generate authentication tokens for a user
   * 
   * Creates both access and refresh tokens with appropriate expiration times.
   * Stores refresh token in database for validation and revocation.
   * 
   * @param user - User object
   * @param options - Optional token generation options
   * @returns Authentication tokens
   * 
   * @example
   * ```typescript
   * const tokens = await authService.generateAuthTokens(user);
   * ```
   */
  private async generateAuthTokens(
    user: User,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<AuthTokens> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      const tokenId = await generateSecureToken(16);

      // Generate access token
      const accessToken = generateToken(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          tokenType: 'access' as const,
        },
        this.config.jwt.expiresIn
      );

      // Generate refresh token with tokenId
      const refreshToken = generateToken(
        {
          userId: user.id,
          email: user.email,
          tokenId,
          tokenType: 'refresh' as const,
        },
        this.config.jwt.refreshExpiresIn
      );

      // Store refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await this.db.query(
        `INSERT INTO refresh_tokens (user_id, token_id, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, token_id) DO UPDATE
         SET expires_at = EXCLUDED.expires_at, created_at = NOW()`,
        [user.id, tokenId, expiresAt]
      );

      console.log('[AUTH_SERVICE] Tokens generated successfully:', {
        userId: user.id,
        tokenId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.config.jwt.expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error generating tokens:', {
        error: errorMessage,
        userId: user.id,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to generate authentication tokens',
        'TOKEN_GENERATION_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * Validates refresh token and generates new access token.
   * Optionally rotates refresh token for enhanced security.
   * 
   * @param refreshToken - Refresh token
   * @param options - Optional refresh options
   * @returns New authentication tokens
   * @throws {AuthenticationError} If refresh fails
   * 
   * @example
   * ```typescript
   * const tokens = await authService.refreshToken(oldRefreshToken);
   * ```
   */
  async refreshToken(
    refreshToken: string,
    options?: {
      readonly rotateRefreshToken?: boolean;
      readonly correlationId?: string;
    }
  ): Promise<AuthTokens> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Starting token refresh:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken, { correlationId });

      // Check if refresh token exists in database
      const tokenResult = await this.db.query(
        `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at,
                u.email, u.first_name, u.last_name, u.role, u.is_active, u.email_verified
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.user_id = $1 AND rt.token_id = $2`,
        [payload.userId, payload.tokenId]
      );

      if (tokenResult.rows.length === 0) {
        throw new AuthenticationError(
          'Invalid refresh token',
          'INVALID_TOKEN',
          401,
          { correlationId }
        );
      }

      const tokenRow = tokenResult.rows[0];

      // Check if token is revoked
      if (tokenRow.revoked_at) {
        throw new AuthenticationError(
          'Refresh token has been revoked',
          'TOKEN_REVOKED',
          401,
          { revokedAt: tokenRow.revoked_at, correlationId }
        );
      }

      // Check if token is expired
      if (new Date(tokenRow.expires_at) < new Date()) {
        throw new AuthenticationError(
          'Refresh token has expired',
          'TOKEN_EXPIRED',
          401,
          { expiredAt: tokenRow.expires_at, correlationId }
        );
      }

      // Check if user is still active
      if (!tokenRow.is_active) {
        throw new AuthenticationError(
          'User account is inactive',
          'ACCOUNT_INACTIVE',
          403,
          { correlationId }
        );
      }

      const user: User = {
        id: tokenRow.user_id,
        email: tokenRow.email,
        firstName: tokenRow.first_name,
        lastName: tokenRow.last_name,
        role: tokenRow.role,
        isActive: tokenRow.is_active,
        emailVerified: tokenRow.email_verified,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate new tokens
      let tokens: AuthTokens;

      if (options?.rotateRefreshToken) {
        // Revoke old refresh token
        await this.db.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
          [tokenRow.id]
        );

        // Generate new tokens
        tokens = await this.generateAuthTokens(user, { correlationId });
      } else {
        // Generate new access token only
        const accessToken = generateToken(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenType: 'access' as const,
          },
          this.config.jwt.expiresIn
        );

        tokens = {
          accessToken,
          refreshToken,
          expiresIn: this.config.jwt.expiresIn,
          tokenType: 'Bearer',
        };
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Token refreshed successfully:', {
        userId: user.id,
        rotated: options?.rotateRefreshToken ?? false,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      return tokens;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
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

      console.error('[AUTH_SERVICE] Unexpected error during token refresh:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Token refresh failed due to an unexpected error',
        'REFRESH_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Revoke refresh token
   * 
   * Marks a refresh token as revoked, preventing its future use.
   * Used for logout and security purposes.
   * 
   * @param refreshToken - Refresh token to revoke
   * @param options - Optional revocation options
   * @throws {AuthenticationError} If revocation fails
   * 
   * @example
   * ```typescript
   * await authService.revokeToken(refreshToken);
   * ```
   */
  async revokeToken(
    refreshToken: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      console.log('[AUTH_SERVICE] Revoking refresh token:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Verify and decode token
      const payload = verifyRefreshToken(refreshToken, { correlationId });

      // Revoke token in database
      const result = await this.db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_id = $2 AND revoked_at IS NULL',
        [payload.userId, payload.tokenId]
      );

      if (result.rowCount === 0) {
        console.warn('[AUTH_SERVICE] Token not found or already revoked:', {
          userId: payload.userId,
          tokenId: payload.tokenId,
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      console.log('[AUTH_SERVICE] Token revoked successfully:', {
        userId: payload.userId,
        tokenId: payload.tokenId,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error revoking token:', {
        error: errorMessage,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to revoke token',
        'REVOCATION_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * 
   * Revokes all active refresh tokens for a user.
   * Used for security purposes (e.g., password change, account compromise).
   * 
   * @param userId - User ID
   * @param options - Optional revocation options
   * 
   * @example
   * ```typescript
   * await authService.revokeAllTokens(userId);
   * ```
   */
  async revokeAllTokens(
    userId: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      console.log('[AUTH_SERVICE] Revoking all tokens for user:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      const result = await this.db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );

      console.log('[AUTH_SERVICE] All tokens revoked successfully:', {
        userId,
        revokedCount: result.rowCount,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error revoking all tokens:', {
        error: errorMessage,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to revoke all tokens',
        'REVOCATION_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Request password reset
   * 
   * Initiates password reset flow by generating a reset token and
   * sending it to the user's email.
   * 
   * @param request - Password reset request
   * @param options - Optional request options
   * @returns Password reset token (for testing/development)
   * @throws {AuthenticationError} If request fails
   * 
   * @example
   * ```typescript
   * await authService.requestPasswordReset({
   *   email: 'user@example.com'
   * });
   * ```
   */
  async requestPasswordReset(
    request: PasswordResetRequest,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<{ resetToken: string }> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Password reset requested:', {
        email: request.email,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Get user
      const result = await this.db.query(
        'SELECT id, email, is_active FROM users WHERE email = $1',
        [request.email.toLowerCase()]
      );

      // Always return success to prevent email enumeration
      if (result.rows.length === 0) {
        console.warn('[AUTH_SERVICE] Password reset requested for non-existent user:', {
          email: request.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        // Return fake token to prevent timing attacks
        return { resetToken: await generateSecureToken(32) };
      }

      const user = result.rows[0];

      if (!user.is_active) {
        console.warn('[AUTH_SERVICE] Password reset requested for inactive user:', {
          userId: user.id,
          email: request.email,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        // Return fake token to prevent account enumeration
        return { resetToken: await generateSecureToken(32) };
      }

      // Check rate limiting
      const recentRequests = await this.db.query(
        `SELECT COUNT(*) as count FROM password_reset_tokens
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [user.id]
      );

      const resetConfig = getPasswordResetConfig();

      if (parseInt(recentRequests.rows[0].count) >= resetConfig.maxAttempts) {
        throw new AuthenticationError(
          'Too many password reset requests. Please try again later.',
          'RATE_LIMIT_EXCEEDED',
          429,
          { correlationId }
        );
      }

      // Generate reset token
      const resetToken = await generateSecureToken(resetConfig.tokenLength);
      const tokenHash = await hashPassword(resetToken);

      // Store reset token
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + resetConfig.tokenExpiration);

      await this.db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [user.id, tokenHash, expiresAt]
      );

      // Log password reset request
      await this.logAuthEvent(
        user.id,
        'PASSWORD_RESET_REQUEST',
        true,
        { correlationId }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset token generated:', {
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // In production, send email with reset link
      // For now, return token for testing
      return { resetToken };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
        console.error('[AUTH_SERVICE] Password reset request failed:', {
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

      console.error('[AUTH_SERVICE] Unexpected error during password reset request:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Password reset request failed',
        'PASSWORD_RESET_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Confirm password reset
   * 
   * Validates reset token and updates user's password.
   * 
   * @param confirmation - Password reset confirmation
   * @param options - Optional confirmation options
   * @throws {AuthenticationError} If confirmation fails
   * 
   * @example
   * ```typescript
   * await authService.confirmPasswordReset({
   *   token: 'reset-token',
   *   newPassword: 'NewSecurePass123!'
   * });
   * ```
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
      console.log('[AUTH_SERVICE] Confirming password reset:', {
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Validate new password
      const passwordValidation = validatePassword(confirmation.newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthenticationError(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`,
          'INVALID_PASSWORD',
          400,
          { errors: passwordValidation.errors, correlationId }
        );
      }

      // Check password strength
      if (passwordValidation.strengthScore < 3) {
        throw new AuthenticationError(
          'Password is too weak. Please use a stronger password.',
          'WEAK_PASSWORD',
          400,
          { strengthScore: passwordValidation.strengthScore, correlationId }
        );
      }

      // Get all reset tokens for verification
      const tokensResult = await this.db.query(
        `SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used_at,
                u.email, u.is_active
         FROM password_reset_tokens prt
         JOIN users u ON prt.user_id = u.id
         WHERE prt.expires_at > NOW() AND prt.used_at IS NULL
         ORDER BY prt.created_at DESC`
      );

      if (tokensResult.rows.length === 0) {
        throw new AuthenticationError(
          'Invalid or expired reset token',
          'INVALID_TOKEN',
          400,
          { correlationId }
        );
      }

      // Find matching token
      let matchedToken = null;
      for (const tokenRow of tokensResult.rows) {
        const isMatch = await comparePassword(
          confirmation.token,
          tokenRow.token_hash
        );
        if (isMatch) {
          matchedToken = tokenRow;
          break;
        }
      }

      if (!matchedToken) {
        throw new AuthenticationError(
          'Invalid or expired reset token',
          'INVALID_TOKEN',
          400,
          { correlationId }
        );
      }

      if (!matchedToken.is_active) {
        throw new AuthenticationError(
          'User account is inactive',
          'ACCOUNT_INACTIVE',
          403,
          { correlationId }
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(confirmation.newPassword);

      // Update password and mark token as used
      await this.db.query('BEGIN');

      try {
        await this.db.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [newPasswordHash, matchedToken.user_id]
        );

        await this.db.query(
          'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
          [matchedToken.id]
        );

        // Revoke all refresh tokens for security
        await this.revokeAllTokens(matchedToken.user_id, { correlationId });

        await this.db.query('COMMIT');
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }

      // Log password reset
      await this.logAuthEvent(
        matchedToken.user_id,
        'PASSWORD_RESET',
        true,
        { correlationId }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password reset confirmed successfully:', {
        userId: matchedToken.user_id,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
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

      console.error('[AUTH_SERVICE] Unexpected error during password reset confirmation:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Password reset confirmation failed',
        'PASSWORD_RESET_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Change user password
   * 
   * Changes user's password after verifying current password.
   * Revokes all refresh tokens for security.
   * 
   * @param userId - User ID
   * @param request - Password change request
   * @param options - Optional change options
   * @throws {AuthenticationError} If change fails
   * 
   * @example
   * ```typescript
   * await authService.changePassword(userId, {
   *   currentPassword: 'OldPass123!',
   *   newPassword: 'NewSecurePass123!'
   * });
   * ```
   */
  async changePassword(
    userId: string,
    request: ChangePasswordRequest,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    try {
      console.log('[AUTH_SERVICE] Changing password:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      // Get user
      const result = await this.db.query(
        'SELECT id, password_hash, is_active FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AuthenticationError(
          'User not found',
          'USER_NOT_FOUND',
          404,
          { correlationId }
        );
      }

      const user = result.rows[0];

      if (!user.is_active) {
        throw new AuthenticationError(
          'User account is inactive',
          'ACCOUNT_INACTIVE',
          403,
          { correlationId }
        );
      }

      // Verify current password
      const passwordMatch = await comparePassword(
        request.currentPassword,
        user.password_hash
      );

      if (!passwordMatch) {
        throw new AuthenticationError(
          'Current password is incorrect',
          'INVALID_PASSWORD',
          401,
          { correlationId }
        );
      }

      // Validate new password
      const passwordValidation = validatePassword(request.newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthenticationError(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`,
          'INVALID_PASSWORD',
          400,
          { errors: passwordValidation.errors, correlationId }
        );
      }

      // Check password strength
      if (passwordValidation.strengthScore < 3) {
        throw new AuthenticationError(
          'Password is too weak. Please use a stronger password.',
          'WEAK_PASSWORD',
          400,
          { strengthScore: passwordValidation.strengthScore, correlationId }
        );
      }

      // Check if new password is same as current
      const samePassword = await comparePassword(
        request.newPassword,
        user.password_hash
      );

      if (samePassword) {
        throw new AuthenticationError(
          'New password must be different from current password',
          'SAME_PASSWORD',
          400,
          { correlationId }
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(request.newPassword);

      // Update password
      await this.db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Revoke all refresh tokens for security
      await this.revokeAllTokens(userId, { correlationId });

      // Log password change
      await this.logAuthEvent(
        userId,
        'PASSWORD_CHANGE',
        true,
        { correlationId }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_SERVICE] Password changed successfully:', {
        userId,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthenticationError) {
        console.error('[AUTH_SERVICE] Password change failed:', {
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

      console.error('[AUTH_SERVICE] Unexpected error during password change:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Password change failed',
        'PASSWORD_CHANGE_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Handle failed login attempt
   * 
   * Increments failed login counter and locks account if threshold exceeded.
   * 
   * @param userId - User ID
   * @param options - Optional handling options
   */
  private async handleFailedLogin(
    userId: string,
    options?: {
      readonly ipAddress?: string;
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      const lockoutConfig = getAccountLockoutConfig();

      // Increment failed attempts
      const result = await this.db.query(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             last_failed_login_at = NOW()
         WHERE id = $1
         RETURNING failed_login_attempts`,
        [userId]
      );

      const failedAttempts = result.rows[0].failed_login_attempts;

      // Check if account should be locked
      if (failedAttempts >= lockoutConfig.maxAttempts) {
        const lockedUntil = new Date();
        lockedUntil.setTime(lockedUntil.getTime() + lockoutConfig.lockoutDuration);

        await this.db.query(
          'UPDATE users SET locked_until = $1 WHERE id = $2',
          [lockedUntil, userId]
        );

        console.warn('[AUTH_SERVICE] Account locked due to failed login attempts:', {
          userId,
          failedAttempts,
          lockedUntil: lockedUntil.toISOString(),
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      // Log failed login
      await this.logAuthEvent(
        userId,
        'LOGIN',
        false,
        {
          reason: 'INVALID_PASSWORD',
          failedAttempts,
          ipAddress: options?.ipAddress,
          correlationId,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error handling failed login:', {
        error: errorMessage,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get account lockout information
   * 
   * Retrieves current lockout status and information for a user account.
   * 
   * @param userId - User ID
   * @returns Account lockout information
   */
  async getAccountLockoutInfo(userId: string): Promise<AccountLockoutInfo> {
    try {
      const result = await this.db.query(
        `SELECT failed_login_attempts, locked_until, last_failed_login_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AuthenticationError(
          'User not found',
          'USER_NOT_FOUND',
          404
        );
      }

      const row = result.rows[0];
      const isLocked = row.locked_until && new Date(row.locked_until) > new Date();

      return {
        isLocked,
        failedAttempts: row.failed_login_attempts,
        lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
        lastFailedLoginAt: row.last_failed_login_at
          ? new Date(row.last_failed_login_at)
          : undefined,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error getting lockout info:', {
        error: errorMessage,
        userId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to get account lockout information',
        'LOCKOUT_INFO_FAILED',
        500,
        { originalError: errorMessage }
      );
    }
  }

  /**
   * Unlock user account
   * 
   * Manually unlocks a user account and resets failed login attempts.
   * Used by administrators or automated processes.
   * 
   * @param userId - User ID
   * @param options - Optional unlock options
   */
  async unlockAccount(
    userId: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      console.log('[AUTH_SERVICE] Unlocking account:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      await this.db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId]
      );

      // Log account unlock
      await this.logAuthEvent(
        userId,
        'ACCOUNT_UNLOCK',
        true,
        { correlationId }
      );

      console.log('[AUTH_SERVICE] Account unlocked successfully:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error unlocking account:', {
        error: errorMessage,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to unlock account',
        'UNLOCK_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Log authentication event
   * 
   * Records authentication events for audit trail and security monitoring.
   * 
   * @param userId - User ID (null for failed attempts on non-existent users)
   * @param eventType - Type of authentication event
   * @param success - Whether the event was successful
   * @param metadata - Additional event metadata
   */
  private async logAuthEvent(
    userId: string | null,
    eventType: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO auth_events (user_id, event_type, success, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, eventType, success, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      // Don't throw error for logging failures
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error logging auth event:', {
        error: errorMessage,
        userId,
        eventType,
        success,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Verify user's email address
   * 
   * Marks user's email as verified after email confirmation.
   * 
   * @param userId - User ID
   * @param options - Optional verification options
   */
  async verifyEmail(
    userId: string,
    options?: {
      readonly correlationId?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId ?? generateCorrelationId();

    try {
      console.log('[AUTH_SERVICE] Verifying email:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      await this.db.query(
        'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
        [userId]
      );

      // Log email verification
      await this.logAuthEvent(
        userId,
        'EMAIL_VERIFIED',
        true,
        { correlationId }
      );

      console.log('[AUTH_SERVICE] Email verified successfully:', {
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error verifying email:', {
        error: errorMessage,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to verify email',
        'EMAIL_VERIFICATION_FAILED',
        500,
        { originalError: errorMessage, correlationId }
      );
    }
  }

  /**
   * Get user by ID
   * 
   * Retrieves user information by user ID.
   * 
   * @param userId - User ID
   * @returns User object
   * @throws {AuthenticationError} If user not found
   */
  async getUserById(userId: string): Promise<User> {
    try {
      const result = await this.db.query(
        `SELECT id, email, first_name, last_name, role, is_active,
                email_verified, created_at, updated_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AuthenticationError(
          'User not found',
          'USER_NOT_FOUND',
          404
        );
      }

      const row = result.rows[0];

      return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        isActive: row.is_active,
        emailVerified: row.email_verified,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_SERVICE] Error getting user:', {
        error: errorMessage,
        userId,
        timestamp: new Date().toISOString(),
      });

      throw new AuthenticationError(
        'Failed to get user',
        'GET_USER_FAILED',
        500,
        { originalError: errorMessage }
      );
    }
  }
}

/**
 * Create authentication service instance
 * 
 * Factory function to create a new AuthService instance.
 * 
 * @param db - Database connection pool
 * @returns AuthService instance
 * 
 * @example
 * ```typescript
 * const authService = createAuthService(db);
 * ```
 */
export function createAuthService(db: Pool): AuthService {
  return new AuthService(db);
}

// Export default instance
export default AuthService;