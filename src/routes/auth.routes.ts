/**
 * Authentication Routes Module
 * 
 * Defines Express router for all authentication-related endpoints including
 * user registration, login, logout, token refresh, and password reset flows.
 * Implements rate limiting, authentication middleware, and comprehensive
 * request validation for all authentication operations.
 * 
 * This module serves as the HTTP routing layer for authentication, connecting
 * HTTP endpoints to controller methods while applying appropriate middleware
 * for security, rate limiting, and authentication.
 * 
 * @module routes/auth
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

/**
 * Rate Limiter Configuration for Authentication Endpoints
 * 
 * Implements aggressive rate limiting on authentication endpoints to prevent
 * brute force attacks, credential stuffing, and other abuse patterns.
 */

/**
 * Strict rate limiter for login attempts
 * 
 * Limits login attempts to prevent brute force attacks:
 * - 5 attempts per 15 minutes per IP
 * - Applies to login endpoint only
 * - Returns 429 status when limit exceeded
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false, // Count failed requests
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Login rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Moderate rate limiter for registration
 * 
 * Limits registration attempts to prevent spam and abuse:
 * - 3 attempts per hour per IP
 * - Applies to registration endpoint only
 * - Returns 429 status when limit exceeded
 */
const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many registration attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Registration rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again in 1 hour.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Moderate rate limiter for password reset requests
 * 
 * Limits password reset requests to prevent email enumeration and spam:
 * - 3 attempts per hour per IP
 * - Applies to password reset request endpoint
 * - Returns 429 status when limit exceeded
 */
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many password reset requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Password reset rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset requests. Please try again in 1 hour.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Lenient rate limiter for token refresh
 * 
 * Limits token refresh requests to prevent abuse:
 * - 10 attempts per 15 minutes per IP
 * - Applies to token refresh endpoint
 * - Returns 429 status when limit exceeded
 */
const refreshTokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many token refresh requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Token refresh rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many token refresh requests. Please try again in 15 minutes.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * General rate limiter for all authentication endpoints
 * 
 * Provides baseline protection across all auth endpoints:
 * - 20 requests per 15 minutes per IP
 * - Applies to all authentication routes
 * - Returns 429 status when limit exceeded
 */
const generalAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] General auth rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication requests. Please try again in 15 minutes.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Create Authentication Router
 * 
 * Initializes and configures the Express router for authentication endpoints.
 * Applies rate limiting middleware and connects routes to controller methods.
 * 
 * @returns {Router} Configured Express router for authentication
 */
function createAuthRouter(): Router {
  const router = Router();

  console.log('[AUTH_ROUTES] Initializing authentication routes...');

  // Apply general rate limiter to all authentication routes
  router.use(generalAuthRateLimiter);

  /**
   * POST /register
   * 
   * Register a new user account
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string,
   *   passwordConfirm: string,
   *   firstName: string,
   *   lastName: string,
   *   role?: UserRole,
   *   departmentId?: string,
   *   managerId?: string
   * }
   * 
   * Response (201 Created):
   * {
   *   success: true,
   *   message: string,
   *   tokens: {
   *     accessToken: string,
   *     refreshToken: string,
   *     expiresIn: number
   *   },
   *   user: {
   *     id: string,
   *     email: string,
   *     firstName: string,
   *     lastName: string,
   *     role: UserRole,
   *     isActive: boolean
   *   },
   *   timestamp: Date
   * }
   * 
   * Error responses:
   * - 400: Invalid request data
   * - 409: Email already exists
   * - 429: Rate limit exceeded
   * - 500: Internal server error
   */
  router.post(
    '/register',
    registrationRateLimiter,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Registration request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return authController.register(req, res, next);
    }
  );

  /**
   * POST /login
   * 
   * Authenticate user and generate tokens
   * 
   * Request body:
   * {
   *   email: string,
   *   password: string,
   *   rememberMe?: boolean
   * }
   * 
   * Response (200 OK):
   * {
   *   success: true,
   *   message: string,
   *   tokens: {
   *     accessToken: string,
   *     refreshToken: string,
   *     expiresIn: number
   *   },
   *   user: {
   *     id: string,
   *     email: string,
   *     firstName: string,
   *     lastName: string,
   *     role: UserRole,
   *     isActive: boolean
   *   },
   *   timestamp: Date
   * }
   * 
   * Error responses:
   * - 400: Invalid request data
   * - 401: Invalid credentials
   * - 403: Account inactive or locked
   * - 429: Rate limit exceeded (too many login attempts)
   * - 500: Internal server error
   */
  router.post(
    '/login',
    loginRateLimiter,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Login request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return authController.login(req, res, next);
    }
  );

  /**
   * POST /logout
   * 
   * Logout user and invalidate token
   * 
   * Requires: Authentication (Bearer token in Authorization header)
   * 
   * Response (200 OK):
   * {
   *   success: true,
   *   message: string,
   *   timestamp: Date
   * }
   * 
   * Error responses:
   * - 401: Missing or invalid authentication token
   * - 429: Rate limit exceeded
   * - 500: Internal server error
   */
  router.post(
    '/logout',
    authenticate,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Logout request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.userId,
        timestamp: new Date().toISOString(),
      });
      return authController.logout(req, res, next);
    }
  );

  /**
   * POST /refresh-token
   * 
   * Refresh access token using refresh token
   * 
   * Request body:
   * {
   *   refreshToken: string
   * }
   * 
   * Response (200 OK):
   * {
   *   success: true,
   *   message: string,
   *   tokens: {
   *     accessToken: string,
   *     refreshToken: string,
   *     expiresIn: number
   *   },
   *   user: {
   *     id: string,
   *     email: string,
   *     firstName: string,
   *     lastName: string,
   *     role: UserRole,
   *     isActive: boolean
   *   },
   *   timestamp: Date
   * }
   * 
   * Error responses:
   * - 400: Invalid request data
   * - 401: Invalid or expired refresh token
   * - 429: Rate limit exceeded
   * - 500: Internal server error
   */
  router.post(
    '/refresh-token',
    refreshTokenRateLimiter,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Token refresh request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return authController.refreshToken(req, res, next);
    }
  );

  /**
   * POST /request-password-reset
   * 
   * Request password reset email
   * 
   * Request body:
   * {
   *   email: string
   * }
   * 
   * Response (200 OK):
   * {
   *   success: true,
   *   message: string,
   *   timestamp: Date
   * }
   * 
   * Note: Always returns success to prevent email enumeration,
   * even if email doesn't exist in system.
   * 
   * Error responses:
   * - 400: Invalid request data
   * - 429: Rate limit exceeded
   * - 500: Internal server error
   */
  router.post(
    '/request-password-reset',
    passwordResetRateLimiter,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Password reset request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return authController.requestPasswordReset(req, res, next);
    }
  );

  /**
   * POST /reset-password
   * 
   * Reset password with token
   * 
   * Request body:
   * {
   *   token: string,
   *   password: string,
   *   passwordConfirm: string
   * }
   * 
   * Response (200 OK):
   * {
   *   success: true,
   *   message: string,
   *   timestamp: Date
   * }
   * 
   * Error responses:
   * - 400: Invalid request data or validation error
   * - 401: Invalid or expired reset token
   * - 429: Rate limit exceeded
   * - 500: Internal server error
   */
  router.post(
    '/reset-password',
    passwordResetRateLimiter,
    (req, res, next) => {
      console.log('[AUTH_ROUTES] Password reset confirmation request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return authController.resetPassword(req, res, next);
    }
  );

  console.log('[AUTH_ROUTES] Authentication routes initialized successfully');

  return router;
}

/**
 * Export configured authentication router
 * 
 * This router should be mounted at /api/auth or similar path in the main
 * Express application.
 * 
 * @example
 * import authRoutes from './routes/auth.routes.js';
 * app.use('/api/auth', authRoutes);
 */
export const authRouter = createAuthRouter();

/**
 * Default export
 */
export default authRouter;