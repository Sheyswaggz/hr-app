import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { authRouter } from './routes/auth.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { appraisalRouter } from './routes/appraisal.routes.js';
import { leaveRouter } from './routes/leave.routes.js';

/**
 * Create and configure Express application
 *
 * Sets up middleware, routes, and error handling for the HR management system.
 * Provides RESTful API endpoints for authentication, onboarding, appraisals,
 * and leave management.
 *
 * @returns {Express} Configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/appraisals', appraisalRouter);
  app.use('/api/leave', leaveRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[ERROR]', err);

    const statusCode = (err as any).statusCode || 500;
    const code = (err as any).code || 'INTERNAL_SERVER_ERROR';

    res.status(statusCode).json({
      success: false,
      code,
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

export default createApp();