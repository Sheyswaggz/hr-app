/**
 * Authentication Controller Module
 * 
 * Handles HTTP request/response processing for authentication endpoints.
 * Implements comprehensive input validation, error handling, and structured
 * logging for all authentication operations including registration, login,
 * logout, token refresh, and password reset flows.
 * 
 * This controller acts as the HTTP layer adapter, translating HTTP requests
 * into service calls and formatting service responses into appropriate HTTP
 * responses with proper status codes and error handling.
 * 
 * @module controllers/auth
 */

import type { Request, Response, NextFunction } from 'express';

import { authService } from '../services/auth.service.js';
import type {
  AuthResponse,
  AuthErrorResponse,
  LoginCredentials,
  RegisterData,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../types/auth.js';
import {
  isLoginCredentials,
  isRegisterData,
} from '../types/auth.js';

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Error code to HTTP status mapping
 */
const ERROR_CODE_TO_STATUS: Record<string, number> = {
  VALIDATION_ERROR: HTTP_STATUS.BAD_REQUEST,
  EMAIL_EXISTS: HTTP_STATUS.CONFLICT,
  INVALID_CREDENTIALS: HTTP_STATUS.UNAUTHORIZED,
  ACCOUNT_INACTIVE: HTTP_STATUS.FORBIDDEN,
  ACCOUNT_LOCKED: HTTP_STATUS.TOO_MANY_REQUESTS,
  INVALID_TOKEN: HTTP_STATUS.UNAUTHORIZED,
  TOKEN_REVOKED: HTTP_STATUS.UNAUTHORIZED,
  USER_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  INVALID_EMAIL: HTTP_STATUS.BAD_REQUEST,
  HASH_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  REGISTRATION_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  LOGIN_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  REFRESH_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  LOGOUT_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  RESET_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  RESET_CONFIRM_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
};

/**
 * Get HTTP status code from error code
 */
function getStatusFromErrorCode(errorCode: string): number {
  return ERROR_CODE_TO_STATUS[errorCode] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(req: Request): string {
  // Check if correlation ID already exists in request
  const existingId = req.headers['x-correlation-id'] as string | undefined;
  if (existingId) {
    return existingId;
  }

  // Generate new correlation ID
  return `auth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Authentication Controller Class
 * 
 * Provides HTTP request handlers for all authentication endpoints.
 * Each method validates input, calls the appropriate service method,
 * and formats the response with proper HTTP status codes.
 */
export class AuthController {
  /**
   * Register a new user account
   * 
   * POST /api/auth/register
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string,
   *   passwordConfirm: string,
   *   firstName: string,
   *   lastName: string,
   *   role?: UserRole
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Registration request received:', {
      correlationId,
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[AUTH_CONTROLLER] Registration failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      // Extract and validate registration data
      const registerData: RegisterData = {
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role,
        departmentId: req.body.departmentId,
        managerId: req.body.managerId,
      };

      // Basic type validation
      if (!isRegisterData(registerData)) {
        console.warn('[AUTH_CONTROLLER] Registration failed - invalid data types:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid registration data format',
          timestamp: new Date(),
        });
        return;
      }

      // Call service
      const result = await authService.register(registerData, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        const authResponse = result as AuthResponse;

        console.log('[AUTH_CONTROLLER] Registration successful:', {
          userId: authResponse.user.id,
          email: authResponse.user.email,
          role: authResponse.user.role,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: authResponse.message,
          tokens: authResponse.tokens,
          user: authResponse.user,
          timestamp: authResponse.timestamp,
        });
      } else {
        const errorResponse = result as AuthErrorResponse;
        const statusCode = getStatusFromErrorCode(errorResponse.code);

        console.warn('[AUTH_CONTROLLER] Registration failed:', {
          code: errorResponse.code,
          message: errorResponse.message,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: errorResponse.code,
          message: errorResponse.message,
          details: errorResponse.details,
          lockout: errorResponse.lockout,
          timestamp: errorResponse.timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Registration error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during registration',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Authenticate user and generate tokens
   * 
   * POST /api/auth/login
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string,
   *   rememberMe?: boolean
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Login request received:', {
      correlationId,
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[AUTH_CONTROLLER] Login failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      // Extract and validate credentials
      const credentials: LoginCredentials = {
        email: req.body.email,
        password: req.body.password,
        rememberMe: req.body.rememberMe,
      };

      // Basic type validation
      if (!isLoginCredentials(credentials)) {
        console.warn('[AUTH_CONTROLLER] Login failed - invalid credentials format:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid login credentials format',
          timestamp: new Date(),
        });
        return;
      }

      // Call service
      const result = await authService.login(credentials, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        const authResponse = result as AuthResponse;

        console.log('[AUTH_CONTROLLER] Login successful:', {
          userId: authResponse.user.id,
          email: authResponse.user.email,
          role: authResponse.user.role,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: authResponse.message,
          tokens: authResponse.tokens,
          user: authResponse.user,
          timestamp: authResponse.timestamp,
        });
      } else {
        const errorResponse = result as AuthErrorResponse;
        const statusCode = getStatusFromErrorCode(errorResponse.code);

        console.warn('[AUTH_CONTROLLER] Login failed:', {
          code: errorResponse.code,
          message: errorResponse.message,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: errorResponse.code,
          message: errorResponse.message,
          details: errorResponse.details,
          lockout: errorResponse.lockout,
          timestamp: errorResponse.timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Login error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during login',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Logout user and invalidate token
   * 
   * POST /api/auth/logout
   * 
   * Requires authentication middleware to populate req.user
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Logout request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Verify user is authenticated
      const user = (req as any).user;
      if (!user || !user.userId || !user.jti || !user.exp) {
        console.warn('[AUTH_CONTROLLER] Logout failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Call service to blacklist token
      const result = await authService.logout(
        user.jti,
        user.userId,
        user.exp,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        console.log('[AUTH_CONTROLLER] Logout successful:', {
          userId: user.userId,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Logout successful',
          timestamp: new Date(),
        });
      } else {
        console.error('[AUTH_CONTROLLER] Logout failed:', {
          userId: user.userId,
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'LOGOUT_ERROR',
          message: 'Logout failed',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Logout error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during logout',
        timestamp: new Date(),
      });
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
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Token refresh request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[AUTH_CONTROLLER] Token refresh failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      const { refreshToken } = req.body;

      // Validate refresh token
      if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        console.warn('[AUTH_CONTROLLER] Token refresh failed - missing or invalid refresh token:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Refresh token is required',
          timestamp: new Date(),
        });
        return;
      }

      // Call service
      const result = await authService.refreshToken(refreshToken, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        const authResponse = result as AuthResponse;

        console.log('[AUTH_CONTROLLER] Token refresh successful:', {
          userId: authResponse.user.id,
          email: authResponse.user.email,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: authResponse.message,
          tokens: authResponse.tokens,
          user: authResponse.user,
          timestamp: authResponse.timestamp,
        });
      } else {
        const errorResponse = result as AuthErrorResponse;
        const statusCode = getStatusFromErrorCode(errorResponse.code);

        console.warn('[AUTH_CONTROLLER] Token refresh failed:', {
          code: errorResponse.code,
          message: errorResponse.message,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: errorResponse.code,
          message: errorResponse.message,
          details: errorResponse.details,
          timestamp: errorResponse.timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Token refresh error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during token refresh',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Request password reset
   * 
   * POST /api/auth/reset-password
   * 
   * Request body:
   * {
   *   email: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Password reset request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[AUTH_CONTROLLER] Password reset failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      const { email } = req.body;

      // Validate email
      if (!email || typeof email !== 'string' || email.trim().length === 0) {
        console.warn('[AUTH_CONTROLLER] Password reset failed - missing or invalid email:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Email is required',
          timestamp: new Date(),
        });
        return;
      }

      const resetRequest: PasswordResetRequest = { email: email.trim() };

      // Call service
      const result = await authService.resetPassword(resetRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        console.log('[AUTH_CONTROLLER] Password reset request successful:', {
          email: resetRequest.email,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        // Always return success to prevent email enumeration
        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
          timestamp: new Date(),
        });
      } else {
        console.error('[AUTH_CONTROLLER] Password reset request failed:', {
          email: resetRequest.email,
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        // Still return success to prevent email enumeration
        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Password reset request error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during password reset request',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Reset password with token
   * 
   * POST /api/auth/reset-password/confirm
   * 
   * Request body:
   * {
   *   token: string,
   *   password: string,
   *   passwordConfirm: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[AUTH_CONTROLLER] Password reset confirmation request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[AUTH_CONTROLLER] Password reset confirmation failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      const { token, password, passwordConfirm } = req.body;

      // Validate required fields
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.warn('[AUTH_CONTROLLER] Password reset confirmation failed - missing token:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Reset token is required',
          timestamp: new Date(),
        });
        return;
      }

      if (!password || typeof password !== 'string' || password.length === 0) {
        console.warn('[AUTH_CONTROLLER] Password reset confirmation failed - missing password:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Password is required',
          timestamp: new Date(),
        });
        return;
      }

      if (!passwordConfirm || typeof passwordConfirm !== 'string' || passwordConfirm.length === 0) {
        console.warn('[AUTH_CONTROLLER] Password reset confirmation failed - missing password confirmation:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Password confirmation is required',
          timestamp: new Date(),
        });
        return;
      }

      const resetData: PasswordResetConfirm = {
        token: token.trim(),
        password,
        passwordConfirm,
      };

      // Call service
      const result = await authService.confirmPasswordReset(resetData, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        console.log('[AUTH_CONTROLLER] Password reset confirmation successful:', {
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Password has been reset successfully',
          timestamp: new Date(),
        });
      } else {
        const statusCode = result.errorCode === 'VALIDATION_ERROR' 
          ? HTTP_STATUS.BAD_REQUEST 
          : result.errorCode === 'INVALID_TOKEN'
          ? HTTP_STATUS.UNAUTHORIZED
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[AUTH_CONTROLLER] Password reset confirmation failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'RESET_ERROR',
          message: result.error || 'Password reset failed',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[AUTH_CONTROLLER] Password reset confirmation error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during password reset',
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Export singleton instance
 */
export const authController = new AuthController();

/**
 * Default export
 */
export default authController;