/**
 * Authentication Routes
 * 
 * Express router configuration for authentication endpoints. Provides routes for user
 * registration, login, logout, token refresh, and password reset operations. Implements
 * rate limiting to prevent abuse and integrates with the authentication controller for
 * request handling.
 * 
 * This module defines the HTTP routing layer for authentication, applying appropriate
 * middleware for rate limiting and connecting to controller methods that handle the
 * business logic.
 * 
 * @module routes/auth
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

/**
 * Rate Limiter Configuration
 * 
 * Configures rate limiting for authentication endpoints to prevent brute force attacks
 * and abuse. Different limits are applied based on the sensitivity of the operation.
 */

/**
 * Strict rate limiter for sensitive operations (login, password reset)
 * 
 * Limits: 5 requests per 15 minutes per IP address
 * Use for: Login attempts, password reset requests
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again after 15 minutes',
      timestamp: new Date(),
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Rate limit exceeded:', {
      ip: req.ip || req.socket.remoteAddress,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again after 15 minutes',
        timestamp: new Date(),
      },
    });
  },
});

/**
 * Standard rate limiter for regular operations (registration, token refresh)
 * 
 * Limits: 10 requests per 15 minutes per IP address
 * Use for: Registration, token refresh, logout
 */
const standardRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again after 15 minutes',
      timestamp: new Date(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Rate limit exceeded:', {
      ip: req.ip || req.socket.remoteAddress,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again after 15 minutes',
        timestamp: new Date(),
      },
    });
  },
});

/**
 * Lenient rate limiter for password reset confirmation
 * 
 * Limits: 3 requests per 15 minutes per IP address
 * Use for: Password reset confirmation (more restrictive due to security sensitivity)
 */
const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again after 15 minutes',
      timestamp: new Date(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    console.warn('[AUTH_ROUTES] Password reset rate limit exceeded:', {
      ip: req.ip || req.socket.remoteAddress,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset attempts, please try again after 15 minutes',
        timestamp: new Date(),
      },
    });
  },
});

/**
 * Authentication Router
 * 
 * Express router instance that defines all authentication-related routes.
 * Each route is configured with appropriate rate limiting and connects to
 * the corresponding controller method.
 */
const router = Router();

/**
 * Route: POST /register
 * 
 * Register a new user account
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
 * Response: 201 Created
 * {
 *   success: true,
 *   user: { id, email, firstName, lastName, role, isActive },
 *   tokens: { accessToken, refreshToken, expiresIn }
 * }
 * 
 * Rate limit: 10 requests per 15 minutes
 */
router.post(
  '/register',
  standardRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Registration request received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.register.bind(authController)
);

/**
 * Route: POST /login
 * 
 * Authenticate user with email and password
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string
 * }
 * 
 * Response: 200 OK
 * {
 *   success: true,
 *   user: { id, email, firstName, lastName, role, isActive },
 *   tokens: { accessToken, refreshToken, expiresIn }
 * }
 * 
 * Rate limit: 5 requests per 15 minutes
 */
router.post(
  '/login',
  strictRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Login request received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.login.bind(authController)
);

/**
 * Route: POST /logout
 * 
 * Logout user by invalidating refresh token
 * 
 * Request body:
 * {
 *   refreshToken: string
 * }
 * 
 * Response: 200 OK
 * {
 *   success: true,
 *   message: 'Logout successful'
 * }
 * 
 * Rate limit: 10 requests per 15 minutes
 * Authentication: Not required (token provided in body)
 */
router.post(
  '/logout',
  standardRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Logout request received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.logout.bind(authController)
);

/**
 * Route: POST /refresh-token
 * 
 * Refresh access token using refresh token
 * 
 * Request body:
 * {
 *   refreshToken: string
 * }
 * 
 * Response: 200 OK
 * {
 *   success: true,
 *   tokens: { accessToken, refreshToken, expiresIn },
 *   message: 'Token refresh successful'
 * }
 * 
 * Rate limit: 10 requests per 15 minutes
 */
router.post(
  '/refresh-token',
  standardRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Token refresh request received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.refreshToken.bind(authController)
);

/**
 * Route: POST /request-password-reset
 * 
 * Request password reset token
 * 
 * Request body:
 * {
 *   email: string
 * }
 * 
 * Response: 200 OK (always returns success to prevent email enumeration)
 * {
 *   success: true,
 *   message: 'If an account exists with this email, a password reset link has been sent'
 * }
 * 
 * Rate limit: 5 requests per 15 minutes
 */
router.post(
  '/request-password-reset',
  strictRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Password reset request received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.requestPasswordReset.bind(authController)
);

/**
 * Route: POST /reset-password
 * 
 * Reset password with token
 * 
 * Request body:
 * {
 *   token: string,
 *   newPassword: string
 * }
 * 
 * Response: 200 OK
 * {
 *   success: true,
 *   message: 'Password has been reset successfully'
 * }
 * 
 * Rate limit: 3 requests per 15 minutes
 */
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  (req, res, next) => {
    console.log('[AUTH_ROUTES] Password reset confirmation received:', {
      path: req.path,
      method: req.method,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  authController.resetPassword.bind(authController)
);

/**
 * Health Check Route
 * 
 * Route: GET /health
 * 
 * Check authentication service health
 * 
 * Response: 200 OK
 * {
 *   status: 'healthy',
 *   service: 'authentication',
 *   timestamp: Date
 * }
 * 
 * No rate limiting applied to health checks
 */
router.get('/health', (req, res) => {
  console.log('[AUTH_ROUTES] Health check request received:', {
    path: req.path,
    method: req.method,
    ip: req.ip || req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
  });

  res.status(200).json({
    status: 'healthy',
    service: 'authentication',
    timestamp: new Date(),
  });
});

/**
 * Route Logging Middleware
 * 
 * Log all requests to authentication routes for observability
 */
router.use((req, res, next) => {
  const startTime = Date.now();

  // Log request completion
  res.on('finish', () => {
    const executionTimeMs = Date.now() - startTime;

    console.log('[AUTH_ROUTES] Request completed:', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      executionTimeMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });
  });

  next();
});

/**
 * Error Handling Middleware
 * 
 * Catch any unhandled errors in authentication routes
 */
router.use((error: Error, req: any, res: any, next: any) => {
  console.error('[AUTH_ROUTES] Unhandled error in authentication routes:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date(),
    },
  });
});

/**
 * Export authentication router
 */
export default router;

/**
 * Named export for testing and flexibility
 */
export { router as authRouter };