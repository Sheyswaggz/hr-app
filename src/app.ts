/**
 * Express Application Setup
 * 
 * Main Express application configuration with comprehensive middleware setup,
 * route registration, error handling, and graceful shutdown capabilities.
 * Implements security best practices, rate limiting, CORS, and structured logging.
 * 
 * This module creates and configures the Express application instance with all
 * necessary middleware, routes, and error handlers. It provides a production-ready
 * HTTP server foundation with proper observability and security controls.
 * 
 * @module app
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth.routes.js';
import { testConnection as testDatabaseConnection } from './db/index.js';

/**
 * Application Configuration
 * 
 * Centralized configuration for the Express application with environment
 * variable overrides and sensible defaults.
 */
interface AppConfig {
  /**
   * Port number for HTTP server
   */
  readonly port: number;

  /**
   * Current environment
   */
  readonly environment: 'development' | 'staging' | 'production' | 'test';

  /**
   * Enable CORS
   */
  readonly corsEnabled: boolean;

  /**
   * CORS allowed origins
   */
  readonly corsOrigins: string[];

  /**
   * Enable authentication system
   */
  readonly authEnabled: boolean;

  /**
   * Request body size limit
   */
  readonly bodyLimit: string;

  /**
   * Enable request logging
   */
  readonly requestLogging: boolean;

  /**
   * Trust proxy setting
   */
  readonly trustProxy: boolean;
}

/**
 * Load Application Configuration
 * 
 * Loads configuration from environment variables with fallback defaults.
 * Validates critical configuration values.
 */
function loadAppConfig(): AppConfig {
  const environment = (process.env.NODE_ENV || 'development') as AppConfig['environment'];
  
  // Parse CORS origins from comma-separated string
  const corsOriginsEnv = process.env.CORS_ORIGINS || '';
  const corsOrigins = corsOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Default CORS origins based on environment
  const defaultCorsOrigins = environment === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:5173'];

  const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    environment,
    corsEnabled: process.env.CORS_ENABLED !== 'false',
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : defaultCorsOrigins,
    authEnabled: process.env.AUTH_ENABLED !== 'false',
    bodyLimit: process.env.BODY_LIMIT || '10mb',
    requestLogging: process.env.REQUEST_LOGGING !== 'false',
    trustProxy: process.env.TRUST_PROXY === 'true' || environment === 'production',
  };

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`[APP] Invalid port number: ${config.port}. Must be between 1 and 65535.`);
  }

  // Warn about CORS in production
  if (config.environment === 'production' && config.corsOrigins.length === 0) {
    console.warn('[APP] WARNING: No CORS origins configured in production environment');
  }

  console.log('[APP] Application configuration loaded:', {
    port: config.port,
    environment: config.environment,
    corsEnabled: config.corsEnabled,
    corsOriginsCount: config.corsOrigins.length,
    authEnabled: config.authEnabled,
    bodyLimit: config.bodyLimit,
    requestLogging: config.requestLogging,
    trustProxy: config.trustProxy,
  });

  return config;
}

/**
 * Request Context Interface
 * 
 * Extended request object with additional context properties
 */
interface RequestContext {
  /**
   * Unique request identifier for tracing
   */
  requestId: string;

  /**
   * Request start timestamp
   */
  startTime: number;

  /**
   * Client IP address
   */
  clientIp: string;
}

/**
 * Extended Express Request with Context
 */
interface ExtendedRequest extends Request {
  context?: RequestContext;
}

/**
 * Generate Request ID
 * 
 * Generates a unique identifier for request tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Request Context Middleware
 * 
 * Attaches context information to each request for tracing and logging
 */
function requestContextMiddleware(
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  req.context = {
    requestId,
    startTime,
    clientIp,
  };

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Request Logging Middleware
 * 
 * Logs incoming requests and their completion with timing information
 */
function requestLoggingMiddleware(config: AppConfig) {
  return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    if (!config.requestLogging) {
      return next();
    }

    const context = req.context;
    if (!context) {
      return next();
    }

    console.log('[APP] Incoming request:', {
      requestId: context.requestId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      clientIp: context.clientIp,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    // Log response completion
    res.on('finish', () => {
      const executionTimeMs = Date.now() - context.startTime;

      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';
      const logMethod = console[logLevel] || console.log;

      logMethod.call(console, '[APP] Request completed:', {
        requestId: context.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        executionTimeMs,
        clientIp: context.clientIp,
        timestamp: new Date().toISOString(),
      });
    });

    next();
  };
}

/**
 * Global Rate Limiter
 * 
 * Applies rate limiting to all requests to prevent abuse
 */
function createGlobalRateLimiter(config: AppConfig) {
  // More lenient in development, stricter in production
  const windowMs = config.environment === 'production' ? 15 * 60 * 1000 : 60 * 1000;
  const max = config.environment === 'production' ? 100 : 1000;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later',
        timestamp: new Date(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req: Request, res: Response) => {
      console.warn('[APP] Global rate limit exceeded:', {
        ip: req.ip || req.socket.remoteAddress,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later',
          timestamp: new Date(),
        },
      });
    },
  });
}

/**
 * Not Found Handler
 * 
 * Handles requests to undefined routes
 */
function notFoundHandler(req: Request, res: Response): void {
  console.warn('[APP] Route not found:', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      path: req.path,
      timestamp: new Date(),
    },
  });
}

/**
 * Global Error Handler
 * 
 * Catches and handles all unhandled errors in the application
 */
function errorHandler(
  error: Error,
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void {
  const context = req.context;
  const requestId = context?.requestId || 'unknown';

  // Log error with full context
  console.error('[APP] Unhandled error:', {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    clientIp: context?.clientIp,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = (error as any).statusCode || (error as any).status || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: (error as any).code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      requestId,
      timestamp: new Date(),
    },
  });
}

/**
 * Create Express Application
 * 
 * Creates and configures the Express application with all middleware,
 * routes, and error handlers.
 */
export function createApp(): Express {
  const config = loadAppConfig();
  const app = express();

  console.log('[APP] Creating Express application...');

  // Trust proxy if configured (for proper IP detection behind load balancers)
  if (config.trustProxy) {
    app.set('trust proxy', true);
    console.log('[APP] Trust proxy enabled');
  }

  // Disable X-Powered-By header for security
  app.disable('x-powered-by');

  // Request context middleware (must be first)
  app.use(requestContextMiddleware);

  // Request logging middleware
  app.use(requestLoggingMiddleware(config));

  // CORS middleware
  if (config.corsEnabled) {
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is allowed
        if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn('[APP] CORS origin rejected:', {
            origin,
            allowedOrigins: config.corsOrigins,
            timestamp: new Date().toISOString(),
          });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      maxAge: 86400, // 24 hours
    };

    app.use(cors(corsOptions));
    console.log('[APP] CORS enabled with origins:', config.corsOrigins);
  }

  // Body parsing middleware
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

  // Global rate limiting
  app.use(createGlobalRateLimiter(config));

  // Health check endpoint (no authentication required)
  app.get('/health', async (req: Request, res: Response) => {
    console.log('[APP] Health check request received');

    try {
      // Test database connection
      const dbHealth = await testDatabaseConnection();

      const health = {
        status: dbHealth.healthy ? 'healthy' : 'degraded',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: config.environment,
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: {
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            latencyMs: dbHealth.latencyMs,
            error: dbHealth.error,
          },
          authentication: {
            status: config.authEnabled ? 'enabled' : 'disabled',
          },
        },
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      console.error('[APP] Health check failed:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  });

  // Ready check endpoint (stricter than health check)
  app.get('/ready', async (req: Request, res: Response) => {
    console.log('[APP] Readiness check request received');

    try {
      // Test database connection
      const dbHealth = await testDatabaseConnection();

      if (!dbHealth.healthy) {
        throw new Error('Database connection not ready');
      }

      res.status(200).json({
        status: 'ready',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[APP] Readiness check failed:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Service not ready',
      });
    }
  });

  // API version endpoint
  app.get('/api/version', (req: Request, res: Response) => {
    res.json({
      version: process.env.npm_package_version || '1.0.0',
      environment: config.environment,
      nodeVersion: process.version,
      timestamp: new Date(),
    });
  });

  // Register authentication routes if enabled
  if (config.authEnabled) {
    app.use('/api/auth', authRouter);
    console.log('[APP] Authentication routes registered at /api/auth');
  } else {
    console.warn('[APP] Authentication system is disabled');
  }

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  console.log('[APP] Express application created successfully');

  return app;
}

/**
 * Application Instance
 * 
 * Singleton Express application instance
 */
let appInstance: Express | null = null;

/**
 * Get Application Instance
 * 
 * Returns the singleton Express application instance, creating it if necessary
 */
export function getApp(): Express {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance;
}

/**
 * Reset Application Instance
 * 
 * Resets the application instance (useful for testing)
 */
export function resetApp(): void {
  appInstance = null;
  console.log('[APP] Application instance reset');
}

/**
 * Default Export
 * 
 * Export the application instance for use in server startup
 */
export default getApp();