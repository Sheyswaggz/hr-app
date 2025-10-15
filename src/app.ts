/**
 * Express Application Configuration
 * 
 * Main Express application setup with middleware, routes, and error handling.
 * Configures authentication, authorization, CORS, body parsing, and all API routes.
 * 
 * @module app
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authRouter } from './routes/auth.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { authenticate } from './middleware/authenticate.js';

/**
 * Create and configure Express application
 * 
 * Sets up all middleware, routes, and error handlers in the correct order:
 * 1. Body parsing middleware
 * 2. CORS and security headers
 * 3. Request logging
 * 4. Public routes (auth)
 * 5. Authentication middleware
 * 6. Protected routes (onboarding, etc.)
 * 7. Error handling middleware
 * 
 * @returns {express.Application} Configured Express application
 */
function createApp(): express.Application {
  const app = express();

  console.log('[APP] Initializing Express application:', {
    timestamp: new Date().toISOString(),
  });

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  console.log('[APP] Body parsing middleware configured:', {
    json: true,
    urlencoded: true,
    timestamp: new Date().toISOString(),
  });

  // CORS middleware (configure based on environment)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

  console.log('[APP] CORS middleware configured:', {
    allowOrigin: '*',
    allowMethods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    timestamp: new Date().toISOString(),
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log('[APP] Incoming request:', {
      method: req.method,
      path: req.path,
      query: req.query,
      timestamp: new Date().toISOString(),
    });
    next();
  });

  // Health check endpoint (public)
  app.get('/health', (req: Request, res: Response) => {
    console.log('[APP] Health check request:', {
      timestamp: new Date().toISOString(),
    });
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[APP] Health check endpoint registered:', {
    path: '/health',
    method: 'GET',
    timestamp: new Date().toISOString(),
  });

  // Public routes (no authentication required)
  app.use('/api/auth', authRouter);

  console.log('[APP] Public routes registered:', {
    routes: ['/api/auth'],
    timestamp: new Date().toISOString(),
  });

  // Protected routes (authentication required)
  app.use('/api/onboarding', onboardingRouter);

  console.log('[APP] Protected routes registered:', {
    routes: ['/api/onboarding'],
    timestamp: new Date().toISOString(),
  });

  // 404 handler for undefined routes
  app.use((req: Request, res: Response) => {
    console.warn('[APP] Route not found:', {
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[APP] Error handler:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal Server Error' : message,
      message: statusCode >= 500 ? 'An unexpected error occurred' : message,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[APP] Error handling middleware configured:', {
    timestamp: new Date().toISOString(),
  });

  console.log('[APP] Express application initialized successfully:', {
    timestamp: new Date().toISOString(),
  });

  return app;
}

/**
 * Singleton Express application instance
 */
export const app = createApp();

/**
 * Default export
 */
export default app;