/**
 * Onboarding Controller Module
 * 
 * Handles HTTP requests for employee onboarding workflow endpoints.
 * Implements RESTful API for template management, workflow assignment,
 * task tracking, and progress monitoring with comprehensive error handling.
 * 
 * @module controllers/onboarding
 */

import type { Request, Response, NextFunction } from 'express';

import { onboardingService } from '../services/onboarding.service.js';
import type {
  OnboardingTask,
  OnboardingTemplate,
  OnboardingWorkflow,
  TemplateCreationRequest,
  WorkflowAssignmentRequest,
  WorkflowProgressSummary,
} from '../types/onboarding.js';

/**
 * HTTP status codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Pagination defaults
 */
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || `onboarding_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         req.socket.remoteAddress || 
         'unknown';
}

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(query: Record<string, unknown>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(query.page || PAGINATION_DEFAULTS.PAGE), 10));
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit || PAGINATION_DEFAULTS.LIMIT), 10))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Onboarding Controller Class
 * 
 * Implements HTTP request handlers for onboarding workflow management.
 * Provides endpoints for template creation, workflow assignment, task management,
 * and progress tracking with proper validation and error handling.
 */
export class OnboardingController {
  /**
   * Create onboarding template
   * 
   * POST /api/onboarding/templates
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
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Create template request received:', {
      correlationId,
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[ONBOARDING_CONTROLLER] Create template failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      // Extract authenticated user from request
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[ONBOARDING_CONTROLLER] Create template failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Build template creation request
      const templateRequest: TemplateCreationRequest = {
        name: req.body.name,
        description: req.body.description,
        tasks: req.body.tasks,
        departmentId: req.body.departmentId,
        createdBy: user.userId,
      };

      // Call service
      const result = await onboardingService.createTemplate(templateRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Template created successfully:', {
          templateId: result.data.id,
          name: result.data.name,
          taskCount: result.data.tasks.length,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Template created successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        console.warn('[ONBOARDING_CONTROLLER] Template creation failed:', {
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        const statusCode = result.errorCode === 'VALIDATION_ERROR' 
          ? HTTP_STATUS.BAD_REQUEST 
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'TEMPLATE_CREATION_ERROR',
          message: result.error || 'Failed to create template',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Create template error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while creating template',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get all onboarding templates
   * 
   * GET /api/onboarding/templates
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Get templates request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Parse pagination parameters
      const { page, limit, offset } = parsePaginationParams(req.query);

      // Call service
      const result = await onboardingService.getTemplates(correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination
        const total = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        console.log('[ONBOARDING_CONTROLLER] Templates fetched successfully:', {
          total,
          page,
          limit,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: paginatedData,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp: new Date(),
        });
      } else {
        console.error('[ONBOARDING_CONTROLLER] Failed to fetch templates:', {
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_TEMPLATES_ERROR',
          message: result.error || 'Failed to fetch templates',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Get templates error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching templates',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Assign onboarding workflow to employee
   * 
   * POST /api/onboarding/workflows
   * 
   * Request body:
   * {
   *   templateId: string,
   *   employeeId: string,
   *   startDate?: Date,
   *   managerId?: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async assignWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Assign workflow request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[ONBOARDING_CONTROLLER] Assign workflow failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp: new Date(),
        });
        return;
      }

      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[ONBOARDING_CONTROLLER] Assign workflow failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Build workflow assignment request
      const workflowRequest: WorkflowAssignmentRequest = {
        templateId: req.body.templateId,
        employeeId: req.body.employeeId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        managerId: req.body.managerId,
        assignedBy: user.userId,
      };

      // Call service
      const result = await onboardingService.assignWorkflow(workflowRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Workflow assigned successfully:', {
          workflowId: result.data.id,
          employeeId: result.data.employeeId,
          templateId: result.data.templateId,
          taskCount: result.data.tasks.length,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Workflow assigned successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        console.warn('[ONBOARDING_CONTROLLER] Workflow assignment failed:', {
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        const statusCode = result.errorCode === 'VALIDATION_ERROR' 
          ? HTTP_STATUS.BAD_REQUEST 
          : result.errorCode === 'TEMPLATE_NOT_FOUND' || result.errorCode === 'EMPLOYEE_NOT_FOUND'
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'WORKFLOW_ASSIGNMENT_ERROR',
          message: result.error || 'Failed to assign workflow',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Assign workflow error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while assigning workflow',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get employee's onboarding tasks
   * 
   * GET /api/onboarding/my-tasks
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getMyTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Get my tasks request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[ONBOARDING_CONTROLLER] Get my tasks failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Parse pagination parameters
      const { page, limit, offset } = parsePaginationParams(req.query);

      // Call service
      const result = await onboardingService.getMyTasks(user.userId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination
        const total = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        console.log('[ONBOARDING_CONTROLLER] Tasks fetched successfully:', {
          userId: user.userId,
          total,
          page,
          limit,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: paginatedData,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp: new Date(),
        });
      } else {
        console.error('[ONBOARDING_CONTROLLER] Failed to fetch tasks:', {
          userId: user.userId,
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_TASKS_ERROR',
          message: result.error || 'Failed to fetch tasks',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Get my tasks error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching tasks',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Update task status and upload document
   * 
   * PATCH /api/onboarding/tasks/:id
   * 
   * Request body:
   * {
   *   documentUrl?: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Update task request received:', {
      correlationId,
      clientIp,
      taskId: req.params.id,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[ONBOARDING_CONTROLLER] Update task failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Validate task ID
      const taskId = req.params.id;
      if (!taskId || taskId.trim().length === 0) {
        console.warn('[ONBOARDING_CONTROLLER] Update task failed - missing task ID:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Task ID is required',
          timestamp: new Date(),
        });
        return;
      }

      // Extract document URL from request body
      const documentUrl = req.body?.documentUrl;

      // Call service
      const result = await onboardingService.updateTaskStatus(
        taskId,
        user.userId,
        documentUrl,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Task updated successfully:', {
          taskId: result.data.id,
          userId: user.userId,
          status: result.data.status,
          hasDocument: !!result.data.documentUrl,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Task updated successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        console.warn('[ONBOARDING_CONTROLLER] Task update failed:', {
          taskId,
          userId: user.userId,
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        const statusCode = result.errorCode === 'VALIDATION_ERROR' 
          ? HTTP_STATUS.BAD_REQUEST 
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'UPDATE_TASK_ERROR',
          message: result.error || 'Failed to update task',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Update task error:', {
        error: errorMessage,
        taskId: req.params.id,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while updating task',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get team onboarding progress
   * 
   * GET /api/onboarding/team-progress
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getTeamProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[ONBOARDING_CONTROLLER] Get team progress request received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[ONBOARDING_CONTROLLER] Get team progress failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date(),
        });
        return;
      }

      // Parse pagination parameters
      const { page, limit, offset } = parsePaginationParams(req.query);

      // Call service
      const result = await onboardingService.getTeamProgress(user.userId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination
        const total = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        console.log('[ONBOARDING_CONTROLLER] Team progress fetched successfully:', {
          managerId: user.userId,
          total,
          page,
          limit,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: paginatedData,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp: new Date(),
        });
      } else {
        console.error('[ONBOARDING_CONTROLLER] Failed to fetch team progress:', {
          managerId: user.userId,
          error: result.error,
          errorCode: result.errorCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_TEAM_PROGRESS_ERROR',
          message: result.error || 'Failed to fetch team progress',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_CONTROLLER] Get team progress error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching team progress',
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Singleton onboarding controller instance
 */
export const onboardingController = new OnboardingController();

/**
 * Default export
 */
export default onboardingController;