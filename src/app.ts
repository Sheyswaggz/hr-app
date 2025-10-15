/**
 * Express Application Configuration
 * 
 * Main application setup with middleware, routes, and error handling.
 * Configures Express server with security, logging, and API endpoints.
 * 
 * @module app
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { authRouter } from './routes/auth.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';

/**
 * Create and configure Express application
 * 
 * Sets up middleware stack, routes, and error handlers
 * 
 * @returns {Express} Configured Express application
 */
export function createApp(): Express {
  const app = express();

  console.log('[APP] Initializing Express application...');

  // ============================================================================
  // Middleware Configuration
  // ============================================================================

  // Parse JSON request bodies
  app.use(express.json());
  console.log('[APP] JSON body parser enabled');

  // Parse URL-encoded request bodies
  app.use(express.urlencoded({ extended: true }));
  console.log('[APP] URL-encoded body parser enabled');

  // ============================================================================
  // Health Check Endpoint
  // ============================================================================

  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  console.log('[APP] Health check endpoint registered at GET /health');

  // ============================================================================
  // API Routes
  // ============================================================================

  // Authentication routes
  app.use('/api/auth', authRouter);
  console.log('[APP] Authentication routes registered at /api/auth');

  // Onboarding routes
  app.use('/api/onboarding', onboardingRouter);
  console.log('[APP] Onboarding routes registered at /api/onboarding');

  // ============================================================================
  // Error Handling
  // ============================================================================

  // 404 handler for undefined routes
  app.use((req: Request, res: Response) => {
    console.log('[APP] 404 Not Found:', {
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      path: req.path,
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[APP] Error occurred:', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
    });
  });

  console.log('[APP] Error handlers configured');

  // ============================================================================
  // Application Ready
  // ============================================================================

  console.log('[APP] Express application initialized successfully');

  return app;
}

/**
 * Singleton Express application instance
 */
export const app = createApp();

/**
 * Export default application instance
 */
export default app;