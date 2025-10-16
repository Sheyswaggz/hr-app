/**
 * Appraisal Routes Module
 * 
 * Express router for performance appraisal management endpoints.
 * Implements role-based access control and connects to appraisal controller methods.
 * 
 * Routes:
 * - POST / - Create appraisal cycle (Manager only)
 * - GET /:id - Get appraisal by ID (Employee for own, Manager for team, HR Admin for all)
 * - GET /my-appraisals - Get authenticated employee's appraisals (Employee)
 * - GET /team - Get team appraisals (Manager only)
 * - GET / - Get all appraisals (HR Admin only)
 * - PATCH /:id/self-assessment - Submit self-assessment (Employee, own appraisal only)
 * - PATCH /:id/review - Submit manager review (Manager, team member appraisal only)
 * - PATCH /:id/goals - Update goals (Manager or Employee based on ownership)
 * 
 * @module routes/appraisal
 */

import { Router } from 'express';

import { appraisalController } from '../controllers/appraisal.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { UserRole } from '../types/index.js';

/**
 * Create and configure appraisal router
 * 
 * Applies authentication and authorization middleware to all routes.
 * Routes are ordered to prevent path conflicts (specific routes before parameterized routes).
 * 
 * @returns {Router} Configured Express router
 */
function createAppraisalRouter(): Router {
  const router = Router();

  console.log('[APPRAISAL_ROUTES] Initializing appraisal routes:', {
    timestamp: new Date().toISOString(),
  });

  // Apply authentication middleware to all routes
  router.use(authenticate);

  // GET /api/appraisals/my-appraisals - Get authenticated employee's appraisals
  // Must be before /:id route to prevent path conflict
  router.get(
    '/my-appraisals',
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    appraisalController.getEmployeeAppraisals.bind(appraisalController)
  );

  // GET /api/appraisals/team - Get team appraisals (Manager only)
  // Must be before /:id route to prevent path conflict
  router.get(
    '/team',
    authorize(UserRole.Manager, { useHierarchy: true }),
    appraisalController.getManagerAppraisals.bind(appraisalController)
  );

  // POST /api/appraisals - Create appraisal cycle (Manager only)
  router.post(
    '/',
    authorize(UserRole.Manager, { useHierarchy: true }),
    appraisalController.createAppraisalCycle.bind(appraisalController)
  );

  // GET /api/appraisals - Get all appraisals (HR Admin only)
  router.get(
    '/',
    authorize(UserRole.HRAdmin),
    appraisalController.getAppraisalCycles.bind(appraisalController)
  );

  // GET /api/appraisals/:id - Get appraisal by ID
  // Authorization is handled in controller based on user role and appraisal ownership
  router.get(
    '/:id',
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    appraisalController.getAppraisal.bind(appraisalController)
  );

  // PATCH /api/appraisals/:id/self-assessment - Submit self-assessment
  // Authorization is handled in controller to ensure employee owns the appraisal
  router.patch(
    '/:id/self-assessment',
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    appraisalController.submitSelfAssessment.bind(appraisalController)
  );

  // PATCH /api/appraisals/:id/review - Submit manager review
  // Authorization is handled in controller to ensure manager reviews their team member
  router.patch(
    '/:id/review',
    authorize(UserRole.Manager, { useHierarchy: true }),
    appraisalController.submitManagerReview.bind(appraisalController)
  );

  // PATCH /api/appraisals/:id/goals - Update goals
  // Authorization is handled in controller based on appraisal ownership
  router.patch(
    '/:id/goals',
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    appraisalController.addGoals.bind(appraisalController)
  );

  console.log('[APPRAISAL_ROUTES] Appraisal routes initialized successfully:', {
    routeCount: router.stack.length,
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Singleton appraisal router instance
 */
export const appraisalRouter = createAppraisalRouter();

/**
 * Default export: appraisal router singleton
 */
export default appraisalRouter;