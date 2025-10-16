import express, { Application, Request, Response } from 'express';
import { authRouter } from './routes/auth.routes.js';
import { onboardingRouter } from './routes/onboarding.routes.js';
import { appraisalRouter } from './routes/appraisal.routes.js';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/onboarding', onboardingRouter);
  app.use('/api/appraisals', appraisalRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: Request,
      res: Response,
      _next: express.NextFunction
    ) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );

  return app;
}