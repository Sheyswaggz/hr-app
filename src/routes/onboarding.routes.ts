/**
 * Onboarding Routes Module
 * 
 * Provides Express router configuration for employee onboarding workflow endpoints.
 * Implements comprehensive role-based access control, file upload handling, and
 * request validation for all onboarding-related operations.
 * 
 * This module integrates authentication, authorization, and file upload middleware
 * to enforce security policies and handle document uploads for onboarding tasks.
 * 
 * @module routes/onboarding
 */

import { Router } from 'express';

import { onboardingController } from '../controllers/onboarding.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadSingle } from '../middleware/upload.js';

/**
 * Create and configure onboarding routes
 * 
 * Sets up all onboarding-related endpoints with appropriate middleware:
 * - Authentication: All routes require valid JWT token
 * - Authorization: Role-based access control per endpoint
 * - File Upload: Document upload handling for task completion
 * 
 * @returns {Router} Configured Express router
 */
export function createOnboardingRouter(): Router {
  const router = Router();

  console.log('[ONBOARDING_ROUTES] Initializing onboarding routes...');

  // ============================================================================
  // Template Management Routes
  // ============================================================================

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
   *   departmentId?: string,
   *   estimatedDays: number
   * }
   */
  router.post(
    '/templates',
    authenticate,
    authorize('HR_ADMIN'),
    onboardingController.createTemplate.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered POST /templates (HR_ADMIN)');

  /**
   * Get all onboarding templates
   * 
   * GET /api/onboarding/templates
   * 
   * Access: HR_ADMIN, MANAGER
   * 
   * Query parameters:
   * - page?: number (default: 1)
   * - limit?: number (default: 20, max: 100)
   * - activeOnly?: boolean
   * - departmentId?: string
   */
  router.get(
    '/templates',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER']),
    onboardingController.getTemplates.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered GET /templates (HR_ADMIN, MANAGER)');

  // ============================================================================
  // Workflow Management Routes
  // ============================================================================

  /**
   * Assign onboarding workflow to employee
   * 
   * POST /api/onboarding/workflows
   * 
   * Access: HR_ADMIN only
   * 
   * Request body:
   * {
   *   employeeId: string,
   *   templateId: string,
   *   targetCompletionDate?: Date,
   *   taskOverrides?: Array<{
   *     order: number,
   *     dueDate?: Date,
   *     title?: string,
   *     description?: string
   *   }>
   * }
   */
  router.post(
    '/workflows',
    authenticate,
    authorize('HR_ADMIN'),
    onboardingController.assignWorkflow.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered POST /workflows (HR_ADMIN)');

  // ============================================================================
  // Employee Task Routes
  // ============================================================================

  /**
   * Get employee's onboarding tasks
   * 
   * GET /api/onboarding/my-tasks
   * 
   * Access: EMPLOYEE (authenticated, own tasks only)
   * 
   * Returns all onboarding tasks assigned to the authenticated employee
   */
  router.get(
    '/my-tasks',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
    onboardingController.getMyTasks.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered GET /my-tasks (EMPLOYEE)');

  /**
   * Update task status and mark as complete
   * 
   * PATCH /api/onboarding/tasks/:id
   * 
   * Access: EMPLOYEE (authenticated, own tasks only)
   * 
   * Supports file upload for document submission:
   * - Field name: 'document'
   * - Max file size: 10MB
   * - Allowed types: PDF, DOC, DOCX, JPG, PNG
   * 
   * Request body (multipart/form-data):
   * - document: File (optional, required if task requires document)
   * 
   * The uploaded file will be available in req.file and its path
   * will be passed to the controller as documentUrl
   */
  router.patch(
    '/tasks/:id',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
    uploadSingle({
      fieldName: 'document',
      maxFileSize: 10 * 1024 * 1024, // 10MB
    }),
    (req, res, next) => {
      // Attach document URL from uploaded file to request body
      if (req.file) {
        req.body.documentUrl = req.file.path;
        
        console.log('[ONBOARDING_ROUTES] Document uploaded for task update:', {
          taskId: req.params.id,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          timestamp: new Date().toISOString(),
        });
      }
      
      next();
    },
    onboardingController.updateTask.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered PATCH /tasks/:id (EMPLOYEE) with file upload');

  // ============================================================================
  // Manager Progress Monitoring Routes
  // ============================================================================

  /**
   * Get onboarding progress for manager's team
   * 
   * GET /api/onboarding/team-progress
   * 
   * Access: MANAGER (own team only), HR_ADMIN (all teams)
   * 
   * Returns aggregated onboarding progress for all team members
   * reporting to the authenticated manager
   */
  router.get(
    '/team-progress',
    authenticate,
    authorize(['HR_ADMIN', 'MANAGER'], { useHierarchy: true }),
    onboardingController.getTeamProgress.bind(onboardingController)
  );

  console.log('[ONBOARDING_ROUTES] Registered GET /team-progress (MANAGER)');

  // ============================================================================
  // Route Registration Complete
  // ============================================================================

  console.log('[ONBOARDING_ROUTES] Onboarding routes initialized successfully:', {
    totalRoutes: 6,
    routes: [
      'POST /templates (HR_ADMIN)',
      'GET /templates (HR_ADMIN, MANAGER)',
      'POST /workflows (HR_ADMIN)',
      'GET /my-tasks (EMPLOYEE)',
      'PATCH /tasks/:id (EMPLOYEE) with file upload',
      'GET /team-progress (MANAGER)',
    ],
    timestamp: new Date().toISOString(),
  });

  return router;
}

/**
 * Singleton onboarding router instance
 * 
 * Pre-configured router with all onboarding endpoints and middleware
 */
export const onboardingRouter = createOnboardingRouter();

/**
 * Export default router instance
 */
export default onboardingRouter;
```

This implementation provides a complete, production-ready Express router for the onboarding workflow system with the following features:

## Key Features

### 1. **Role-Based Access Control**
- **HR_ADMIN**: Full access to template and workflow management
- **MANAGER**: Read access to templates and team progress monitoring
- **EMPLOYEE**: Access to own tasks and task completion

### 2. **File Upload Integration**
- Integrated multer middleware for document uploads on task completion
- 10MB file size limit
- Validation for allowed file types (PDF, DOC, DOCX, JPG, PNG)
- Automatic path attachment to request body

### 3. **Authentication & Authorization**
- All routes require JWT authentication
- Hierarchical authorization for manager routes (HR_ADMIN can access manager endpoints)
- Proper middleware ordering for security

### 4. **Comprehensive Logging**
- Route registration logging
- File upload event logging
- Structured log format with timestamps

### 5. **Security Best Practices**
- Authentication before authorization
- Role-based access control enforcement
- File upload validation
- No exposed implementation details

### 6. **Endpoint Documentation**
Each route includes:
- HTTP method and path
- Access control requirements
- Request/response format
- Query parameters (where applicable)

### 7. **Proper Middleware Ordering**
```
authenticate → authorize → uploadSingle → controller