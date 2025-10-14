/**
 * Express Application Setup Module
 * 
 * Configures and initializes the Express application with all necessary middleware,
 * routes, error handling, and security features. This module serves as the main
 * application entry point for the HTTP server.
 * 
 * Features:
 * - CORS configuration for cross-origin requests
 * - JSON body parsing with size limits
 * - Rate limiting for API protection
 * - Authentication routes
 * - Comprehensive error handling
 * - 404 handler for unknown routes
 * - Health check endpoint
 * - Request logging and correlation IDs
 * - Security headers
 * 
 * @module app
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth.routes.js';

/**
 * Environment Configuration
 * 
 * Loads configuration from environment variables with sensible defaults
 * for development and production environments.
 */
const ENV = {
  /**
   * Node environment (development, staging, production, test)
   */
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production' | 'test',

  /**
   * Server port number
   */
  PORT: parseInt(process.env.PORT || '3000', 10),

  /**
   * CORS allowed origins (comma-separated list)
   */
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],

  /**
   * Enable authentication system
   */
  AUTH_ENABLED: process.env.AUTH_ENABLED !== 'false',

  /**
   * API base path
   */
  API_BASE_PATH: process.env.API_BASE_PATH || '/api',

  /**
   * Request body size limit
   */
  BODY_SIZE_LIMIT: process.env.BODY_SIZE_LIMIT || '10mb',

  /**
   * Enable request logging
   */
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false',
} as const;

/**
 * Extended Express Request with custom properties
 */
interface ExtendedRequest extends Request {
  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;

  /**
   * Request start time for performance tracking
   */
  startTime?: number;
}

/**
 * API Error Response Structure
 */
interface ApiErrorResponse {
  /**
   * Whether the request was successful
   */
  success: false;

  /**
   * Error code for programmatic handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;

  /**
   * Timestamp when error occurred
   */
  timestamp: string;

  /**
   * Request path that caused the error
   */
  path?: string;

  /**
   * Correlation ID for request tracing
   */
  correlationId?: string;
}

/**
 * Generate Correlation ID
 * 
 * Creates a unique identifier for request tracing across services.
 * Format: timestamp-random
 * 
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Request Logging Middleware
 * 
 * Logs incoming requests with correlation ID and performance metrics.
 * Attaches correlation ID and start time to request object for downstream use.
 * 
 * @param {ExtendedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function requestLogger(req: ExtendedRequest, res: Response, next: NextFunction): void {
  if (!ENV.ENABLE_REQUEST_LOGGING) {
    return next();
  }

  // Generate or extract correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', correlationId);

  console.log('[APP] Incoming request:', {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    console.log('[APP] Request completed:', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}

/**
 * Security Headers Middleware
 * 
 * Adds security-related HTTP headers to all responses.
 * Implements basic security best practices.
 * 
 * @param {Request} _req - Express request object (unused)
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (basic)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  next();
}

/**
 * Global Rate Limiter
 * 
 * Implements rate limiting across all API endpoints to prevent abuse.
 * More specific rate limiters are applied to authentication routes.
 * 
 * Configuration:
 * - 100 requests per 15 minutes per IP
 * - Returns 429 status when limit exceeded
 * - Includes rate limit info in headers
 */
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req: Request, res: Response) => {
    console.warn('[APP] Global rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again in 15 minutes.',
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * 404 Not Found Handler
 * 
 * Handles requests to undefined routes with proper error response.
 * 
 * @param {ExtendedRequest} req - Express request object
 * @param {Response} res - Express response object
 */
function notFoundHandler(req: ExtendedRequest, res: Response): void {
  console.warn('[APP] Route not found:', {
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
  });

  const errorResponse: ApiErrorResponse = {
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(errorResponse);
}

/**
 * Global Error Handler
 * 
 * Catches and handles all errors that occur during request processing.
 * Provides consistent error response format and comprehensive logging.
 * 
 * @param {Error} error - Error object
 * @param {ExtendedRequest} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} _next - Express next function (unused)
 */
function errorHandler(
  error: Error,
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
): void {
  // Log error with full context
  console.error('[APP] Unhandled error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    errorCode = 'CONFLICT';
  }

  // Build error response
  const errorResponse: ApiErrorResponse = {
    success: false,
    code: errorCode,
    message: ENV.NODE_ENV === 'production' 
      ? 'An error occurred while processing your request.' 
      : error.message,
    path: req.path,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (ENV.NODE_ENV === 'development') {
    errorResponse.details = {
      stack: error.stack,
      name: error.name,
    };
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Create Express Application
 * 
 * Initializes and configures the Express application with all middleware,
 * routes, and error handlers.
 * 
 * @returns {Express} Configured Express application
 */
export function createApp(): Express {
  console.log('[APP] Creating Express application...');
  console.log('[APP] Environment configuration:', {
    nodeEnv: ENV.NODE_ENV,
    port: ENV.PORT,
    authEnabled: ENV.AUTH_ENABLED,
    apiBasePath: ENV.API_BASE_PATH,
    corsOrigins: ENV.CORS_ORIGINS,
  });

  const app = express();

  // ============================================================
  // Security Middleware
  // ============================================================

  // Security headers
  app.use(securityHeaders);

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is allowed
        if (ENV.CORS_ORIGINS.includes(origin) || ENV.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          console.warn('[APP] CORS blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
      exposedHeaders: ['X-Correlation-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 86400, // 24 hours
    })
  );

  // ============================================================
  // Request Processing Middleware
  // ============================================================

  // JSON body parser with size limit
  app.use(express.json({ limit: ENV.BODY_SIZE_LIMIT }));

  // URL-encoded body parser
  app.use(express.urlencoded({ extended: true, limit: ENV.BODY_SIZE_LIMIT }));

  // Request logging and correlation ID
  app.use(requestLogger);

  // Global rate limiting
  app.use(globalRateLimiter);

  // ============================================================
  // Health Check Endpoint
  // ============================================================

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: ENV.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // ============================================================
  // API Routes
  // ============================================================

  // Authentication routes (if enabled)
  if (ENV.AUTH_ENABLED) {
    console.log('[APP] Registering authentication routes at', `${ENV.API_BASE_PATH}/auth`);
    app.use(`${ENV.API_BASE_PATH}/auth`, authRouter);
  } else {
    console.warn('[APP] Authentication system is disabled (AUTH_ENABLED=false)');
  }

  // API root endpoint
  app.get(ENV.API_BASE_PATH, (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'HR Application API',
      version: process.env.npm_package_version || '1.0.0',
      environment: ENV.NODE_ENV,
      endpoints: {
        health: '/health',
        auth: ENV.AUTH_ENABLED ? `${ENV.API_BASE_PATH}/auth` : 'disabled',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  console.log('[APP] Express application created successfully');

  return app;
}

/**
 * Export configured Express application
 * 
 * This is the main application instance that should be used by the server
 * and in tests.
 */
export const app = createApp();

/**
 * Default export
 */
export default app;