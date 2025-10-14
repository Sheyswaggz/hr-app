/**
 * Authentication Controller
 * 
 * Handles HTTP requests for authentication endpoints including user registration,
 * login, logout, token refresh, and password reset operations. Implements comprehensive
 * input validation, error handling, and structured logging for all authentication flows.
 * 
 * This controller acts as the HTTP layer, delegating business logic to the AuthService
 * and returning appropriate HTTP responses with proper status codes and error messages.
 * 
 * @module controllers/auth
 */

import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

import authService, { AuthServiceError, AuthErrorCode } from '../services/auth.service.js';
import type {
  RegisterData,
  LoginCredentials,
  PasswordResetRequest,
  PasswordResetConfirmation,
  AuthResponse,
  TokenPair,
  AuthErrorResponse,
} from '../types/auth.js';
import { UserRole } from '../types/index.js';

/**
 * HTTP status codes for authentication responses
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOCKED: 423,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `auth_ctrl_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Extract correlation ID from request or generate new one
 */
function getCorrelationId(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || generateCorrelationId();
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  path?: string
): AuthErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date(),
    },
  };
}

/**
 * Map AuthServiceError to HTTP status code
 */
function mapErrorToStatusCode(error: AuthServiceError): number {
  switch (error.code) {
    case AuthErrorCode.INVALID_CREDENTIALS:
      return HTTP_STATUS.UNAUTHORIZED;
    case AuthErrorCode.ACCOUNT_LOCKED:
      return HTTP_STATUS.LOCKED;
    case AuthErrorCode.ACCOUNT_INACTIVE:
      return HTTP_STATUS.FORBIDDEN;
    case AuthErrorCode.EMAIL_ALREADY_EXISTS:
      return HTTP_STATUS.CONFLICT;
    case AuthErrorCode.INVALID_TOKEN:
    case AuthErrorCode.TOKEN_EXPIRED:
    case AuthErrorCode.TOKEN_BLACKLISTED:
      return HTTP_STATUS.UNAUTHORIZED;
    case AuthErrorCode.PASSWORD_RESET_TOKEN_INVALID:
    case AuthErrorCode.PASSWORD_RESET_TOKEN_USED:
      return HTTP_STATUS.BAD_REQUEST;
    case AuthErrorCode.USER_NOT_FOUND:
      return HTTP_STATUS.NOT_FOUND;
    case AuthErrorCode.WEAK_PASSWORD:
    case AuthErrorCode.VALIDATION_ERROR:
      return HTTP_STATUS.BAD_REQUEST;
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate user role
 */
function isValidUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Authentication Controller
 * 
 * Provides HTTP endpoint handlers for all authentication operations.
 * Each method handles request validation, delegates to the auth service,
 * and returns appropriate HTTP responses with proper status codes.
 */
export class AuthController {
  /**
   * Register a new user
   * 
   * POST /api/auth/register
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string,
   *   firstName: string,
   *   lastName: string,
   *   role: UserRole
   * }
   * 
   * Response: 201 Created with tokens and user info, or error
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    try {
      console.log('[AUTH_CONTROLLER] Registration request received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: getClientIp(req),
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { email, password, firstName, lastName, role } = req.body as Partial<RegisterData>;

      // Validate required fields
      if (!email || typeof email !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Email is required and must be a string',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Missing email', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!isValidEmail(email)) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid email format',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Invalid email format', {
          email,
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!password || typeof password !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Password is required and must be a string',
          { field: 'password', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Missing password', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'First name is required and must be a non-empty string',
          { field: 'firstName', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Invalid firstName', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Last name is required and must be a non-empty string',
          { field: 'lastName', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Invalid lastName', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!role || typeof role !== 'string' || !isValidUserRole(role)) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Valid role is required (HR_ADMIN, MANAGER, or EMPLOYEE)',
          { field: 'role', validRoles: Object.values(UserRole), correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Registration validation failed: Invalid role', {
          providedRole: role,
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      const registrationData: RegisterData = {
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      };

      const result: AuthResponse = await authService.register(registrationData, {
        correlationId,
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Registration successful:', {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        const statusCode = mapErrorToStatusCode(error);
        const errorResponse = createErrorResponse(
          error.code,
          error.message,
          { ...error.details, correlationId },
          req.path
        );

        console.error('[AUTH_CONTROLLER] Registration failed:', {
          error: error.message,
          code: error.code,
          statusCode,
          correlationId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json(errorResponse);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Unexpected registration error:', {
        error: errorMessage,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred during registration',
        { correlationId },
        req.path
      );

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Login user with credentials
   * 
   * POST /api/auth/login
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string
   * }
   * 
   * Response: 200 OK with tokens and user info, or error
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    try {
      console.log('[AUTH_CONTROLLER] Login request received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { email, password } = req.body as Partial<LoginCredentials>;

      if (!email || typeof email !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Email is required and must be a string',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Login validation failed: Missing email', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!isValidEmail(email)) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid email format',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Login validation failed: Invalid email format', {
          email,
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!password || typeof password !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Password is required and must be a string',
          { field: 'password', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Login validation failed: Missing password', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      const credentials: LoginCredentials = {
        email: email.toLowerCase().trim(),
        password,
      };

      const result: AuthResponse = await authService.login(credentials, {
        correlationId,
        ipAddress,
        userAgent,
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Login successful:', {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        const statusCode = mapErrorToStatusCode(error);
        const errorResponse = createErrorResponse(
          error.code,
          error.message,
          { ...error.details, correlationId },
          req.path
        );

        console.error('[AUTH_CONTROLLER] Login failed:', {
          error: error.message,
          code: error.code,
          statusCode,
          correlationId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json(errorResponse);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Unexpected login error:', {
        error: errorMessage,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred during login',
        { correlationId },
        req.path
      );

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Logout user by invalidating refresh token
   * 
   * POST /api/auth/logout
   * 
   * Request body:
   * {
   *   refreshToken: string
   * }
   * 
   * Response: 200 OK with success message, or error
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    try {
      console.log('[AUTH_CONTROLLER] Logout request received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: getClientIp(req),
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { refreshToken } = req.body as { refreshToken?: string };

      if (!refreshToken || typeof refreshToken !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Refresh token is required and must be a string',
          { field: 'refreshToken', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Logout validation failed: Missing refresh token', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      await authService.logout(refreshToken, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Logout successful:', {
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        const statusCode = mapErrorToStatusCode(error);
        const errorResponse = createErrorResponse(
          error.code,
          error.message,
          { ...error.details, correlationId },
          req.path
        );

        console.error('[AUTH_CONTROLLER] Logout failed:', {
          error: error.message,
          code: error.code,
          statusCode,
          correlationId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json(errorResponse);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Unexpected logout error:', {
        error: errorMessage,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred during logout',
        { correlationId },
        req.path
      );

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * POST /api/auth/refresh
   * 
   * Request body:
   * {
   *   refreshToken: string
   * }
   * 
   * Response: 200 OK with new token pair, or error
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    try {
      console.log('[AUTH_CONTROLLER] Token refresh request received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: getClientIp(req),
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { refreshToken } = req.body as { refreshToken?: string };

      if (!refreshToken || typeof refreshToken !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Refresh token is required and must be a string',
          { field: 'refreshToken', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Token refresh validation failed: Missing refresh token', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      const tokens: TokenPair = await authService.refreshToken(refreshToken, {
        correlationId,
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Token refresh successful:', {
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        tokens,
        message: 'Token refresh successful',
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        const statusCode = mapErrorToStatusCode(error);
        const errorResponse = createErrorResponse(
          error.code,
          error.message,
          { ...error.details, correlationId },
          req.path
        );

        console.error('[AUTH_CONTROLLER] Token refresh failed:', {
          error: error.message,
          code: error.code,
          statusCode,
          correlationId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json(errorResponse);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Unexpected token refresh error:', {
        error: errorMessage,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred during token refresh',
        { correlationId },
        req.path
      );

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Request password reset
   * 
   * POST /api/auth/password-reset/request
   * 
   * Request body:
   * {
   *   email: string
   * }
   * 
   * Response: 200 OK with success message (always returns success to prevent email enumeration)
   */
  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    try {
      console.log('[AUTH_CONTROLLER] Password reset request received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: getClientIp(req),
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { email } = req.body as Partial<PasswordResetRequest>;

      if (!email || typeof email !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Email is required and must be a string',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Password reset validation failed: Missing email', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!isValidEmail(email)) {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid email format',
          { field: 'email', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Password reset validation failed: Invalid email format', {
          email,
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      const request: PasswordResetRequest = {
        email: email.toLowerCase().trim(),
      };

      const result = await authService.resetPassword(request, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Password reset request processed:', {
        email: request.email,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      // Always return success to prevent email enumeration
      // In production, the token would be sent via email
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
        // In development/testing, include the token in response
        ...(process.env.NODE_ENV !== 'production' && {
          token: result.token,
          expiresAt: result.expiresAt,
        }),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Always return success for password reset requests to prevent email enumeration
      console.error('[AUTH_CONTROLLER] Password reset request error (returning success):', {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }
  }

  /**
   * Reset password with token
   * 
   * POST /api/auth/password-reset/confirm
   * 
   * Request body:
   * {
   *   token: string,
   *   newPassword: string
   * }
   * 
   * Response: 200 OK with success message, or error
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = getCorrelationId(req);
    const startTime = Date.now();

    try {
      console.log('[AUTH_CONTROLLER] Password reset confirmation received:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: getClientIp(req),
        timestamp: new Date().toISOString(),
      });

      // Validate request body
      const { token, newPassword } = req.body as Partial<PasswordResetConfirmation>;

      if (!token || typeof token !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'Reset token is required and must be a string',
          { field: 'token', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Password reset validation failed: Missing token', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (!newPassword || typeof newPassword !== 'string') {
        const errorResponse = createErrorResponse(
          'VALIDATION_ERROR',
          'New password is required and must be a string',
          { field: 'newPassword', correlationId },
          req.path
        );

        console.warn('[AUTH_CONTROLLER] Password reset validation failed: Missing new password', {
          correlationId,
          executionTimeMs: Date.now() - startTime,
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Call auth service
      const confirmation: PasswordResetConfirmation = {
        token,
        newPassword,
      };

      await authService.confirmPasswordReset(confirmation, { correlationId });

      const executionTimeMs = Date.now() - startTime;

      console.log('[AUTH_CONTROLLER] Password reset successful:', {
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      if (error instanceof AuthServiceError) {
        const statusCode = mapErrorToStatusCode(error);
        const errorResponse = createErrorResponse(
          error.code,
          error.message,
          { ...error.details, correlationId },
          req.path
        );

        console.error('[AUTH_CONTROLLER] Password reset failed:', {
          error: error.message,
          code: error.code,
          statusCode,
          correlationId,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json(errorResponse);
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Unexpected password reset error:', {
        error: errorMessage,
        correlationId,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      const errorResponse = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred during password reset',
        { correlationId },
        req.path
      );

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}

/**
 * Default export: AuthController instance
 */
export default new AuthController();