/**
 * Onboarding Routes Module
 * 
 * Express router for employee onboarding workflow endpoints with role-based access control.
 * Implements RESTful API routes for template management, workflow assignment, task tracking,
 * and progress monitoring with comprehensive authentication and authorization.
 * 
 * @module routes/onboarding
 */

import { Router } from 'express';

import { onboardingController } from '../controllers/onboarding.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadSingle, handleMulterError } from '../middleware/upload.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Create and configure onboarding router
 * 
 * Sets up all onboarding-related routes with appropriate middleware:
 * - Authentication middleware on all routes
 * - Role-based authorization per endpoint
 * - File upload handling for task updates
 * - Error handling for upload failures
 * 
 * @returns {Router} Configured Express router
 */
function createOnboardingRouter(): Router {
  const router = Router();

  console.log('[ONBOARDING_ROUTES] Initializing onboarding routes:', {
    timestamp: new Date().toISOString(),
  });

  /**
   * Create onboarding template
   * 
   * POST /api/onboarding/templates
   * 
   * Access: HR_ADMIN only
   * 
   * Request body:
   * {
   *   name: string,
   *   description: string,
   *   tasks: Array<{
   *     title: string,
   *     description: string,
   *     daysUntilDue: number,
   *     order: number,
   *     requiresDocument: boolean
   *   }>,
   *   departmentId?: string
   * }
   */
  router.post(
    '/templates',
    authenticate,
    authorize('HR_ADMIN'),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] POST /templates - Create template request:', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
        timestamp: new Date().toISOString(),
      });
      return onboardingController.createTemplate(req, res, next);
    }
  );

  /**
   * Get all onboarding templates
   * 
   * GET /api/onboarding/templates
   * 
   * Access: HR_ADMIN, MANAGER
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   */
  router.get(
    '/templates',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER']),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] GET /templates - Fetch templates request:', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
        query: req.query,
        timestamp: new Date().toISOString(),
      });
      return onboardingController.getTemplates(req, res, next);
    }
  );

  /**
   * Assign onboarding workflow to employee
   * 
   * POST /api/onboarding/workflows
   * 
   * Access: HR_ADMIN only
   * 
   * Request body:
   * {
   *   templateId: string,
   *   employeeId: string,
   *   startDate?: Date,
   *   managerId?: string
   * }
   */
  router.post(
    '/workflows',
    authenticate,
    authorize('HR_ADMIN'),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] POST /workflows - Assign workflow request:', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
        timestamp: new Date().toISOString(),
      });
      return onboardingController.assignWorkflow(req, res, next);
    }
  );

  /**
   * Get employee's onboarding tasks
   * 
   * GET /api/onboarding/my-tasks
   * 
   * Access: EMPLOYEE (authenticated, own tasks only)
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   */
  router.get(
    '/my-tasks',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] GET /my-tasks - Fetch my tasks request:', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
        query: req.query,
        timestamp: new Date().toISOString(),
      });
      return onboardingController.getMyTasks(req, res, next);
    }
  );

  /**
   * Update task status and upload document
   * 
   * PATCH /api/onboarding/tasks/:id
   * 
   * Access: EMPLOYEE (authenticated, own tasks only)
   * 
   * Request body (multipart/form-data):
   * - document: file (optional, max 10MB, PDF/DOC/DOCX/JPG/PNG)
   * 
   * Note: Document URL is automatically generated from uploaded file
   */
  router.patch(
    '/tasks/:id',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] PATCH /tasks/:id - Update task request (before upload):', {
        path: req.path,
        method: req.method,
        taskId: req.params.id,
        userId: (req as any).user?.userId,
        timestamp: new Date().toISOString(),
      });
      next();
    },
    uploadSingle('document'),
    (err: any, req: Request, res: Response, next: NextFunction) => {
      // Handle multer upload errors
      if (err) {
        console.error('[ONBOARDING_ROUTES] File upload error:', {
          path: req.path,
          taskId: req.params.id,
          userId: (req as any).user?.userId,
          error: err.message,
          timestamp: new Date().toISOString(),
        });

        const uploadError = handleMulterError(err);
        return res.status(400).json(uploadError);
      }
      next();
    },
    (req: Request, res: Response, next: NextFunction) => {
      // Process uploaded file and add document URL to request body
      if ((req as any).file) {
        const file = (req as any).file;
        console.log('[ONBOARDING_ROUTES] File uploaded successfully:', {
          path: req.path,
          taskId: req.params.id,
          userId: (req as any).user?.userId,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          timestamp: new Date().toISOString(),
        });

        // Generate document URL (relative path from uploads directory)
        const documentUrl = `/uploads/${file.filename}`;
        req.body.documentUrl = documentUrl;
      }

      console.log('[ONBOARDING_ROUTES] PATCH /tasks/:id - Update task request (after upload):', {
        path: req.path,
        taskId: req.params.id,
        userId: (req as any).user?.userId,
        hasDocument: !!(req as any).file,
        timestamp: new Date().toISOString(),
      });

      return onboardingController.updateTask(req, res, next);
    }
  );

  /**
   * Get team onboarding progress
   * 
   * GET /api/onboarding/team-progress
   * 
   * Access: MANAGER (own team only)
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   */
  router.get(
    '/team-progress',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER']),
    (req: Request, res: Response, next: NextFunction) => {
      console.log('[ONBOARDING_ROUTES] GET /team-progress - Fetch team progress request:', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
        query: req.query,
        timestamp: new Date().toISOString(),
      });
      return onboardingController.getTeamProgress(req, res, next);
    }
  );

  console.log('[ONBOARDING_ROUTES] Onboarding routes initialized successfully:', {
    routes: [
      'POST /templates (HR_ADMIN)',
      'GET /templates (HR_ADMIN, MANAGER)',
      'POST /workflows (HR_ADMIN)',
      'GET /my-tasks (EMPLOYEE)',
      'PATCH /tasks/:id (EMPLOYEE)',
      'GET /team-progress (MANAGER)',
    ],
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Singleton onboarding router instance
 */
export const onboardingRouter = createOnboardingRouter();

/**
 * Default export
 */
export default onboardingRouter;