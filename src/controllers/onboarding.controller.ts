/**
 * Onboarding Controller Module
 * 
 * Handles HTTP request/response processing for employee onboarding workflow endpoints.
 * Implements comprehensive input validation, error handling, and structured logging
 * with proper status codes and JSON responses.
 * 
 * @module controllers/onboarding
 */

import type { Request, Response, NextFunction } from 'express';

import { onboardingService } from '../services/onboarding.service.js';
import type {
  CreateTemplateRequest,
  AssignWorkflowRequest,
  OnboardingTemplate,
  OnboardingTask,
  OnboardingWorkflow,
  TeamProgressSummary,
} from '../types/onboarding.js';

/**
 * HTTP status codes for consistent response handling
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
 * Pagination defaults and limits
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(req: Request): string {
  const existingId = req.headers['x-correlation-id'];
  if (existingId && typeof existingId === 'string') {
    return existingId;
  }
  return `onboarding_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Extract authenticated user from request
 */
function getAuthenticatedUser(req: Request): { userId: string; role: string } | null {
  const user = (req as any).user;
  if (!user || !user.userId || !user.role) {
    return null;
  }
  return {
    userId: user.userId,
    role: user.role,
  };
}

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(req: Request): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(
    PAGINATION.MIN_LIMIT,
    parseInt(req.query.page as string, 10) || PAGINATION.DEFAULT_PAGE
  );
  
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(
      PAGINATION.MIN_LIMIT,
      parseInt(req.query.limit as string, 10) || PAGINATION.DEFAULT_LIMIT
    )
  );
  
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Onboarding Controller Class
 * 
 * Handles all HTTP endpoints for onboarding workflow management.
 */
export class OnboardingController {
  /**
   * Create a new onboarding template
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
   *   departmentId?: string,
   *   estimatedDays: number
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
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
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

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[ONBOARDING_CONTROLLER] Create template failed - invalid request body:', {
          correlationId,
          clientIp,
          userId: user.userId,
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

      // Extract and validate template data
      const templateData: CreateTemplateRequest = {
        name: req.body.name,
        description: req.body.description,
        tasks: req.body.tasks,
        departmentId: req.body.departmentId,
        estimatedDays: req.body.estimatedDays,
      };

      // Call service
      const result = await onboardingService.createTemplate(
        templateData,
        user.userId,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Template created successfully:', {
          templateId: result.data.id,
          name: result.data.name,
          taskCount: result.data.tasks.length,
          userId: user.userId,
          executionTimeMs,
          correlationId,
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
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: result.errorCode || 'CREATE_TEMPLATE_ERROR',
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
   * - page?: number (default: 1)
   * - limit?: number (default: 20, max: 100)
   * - activeOnly?: boolean
   * - departmentId?: string
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
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    try {
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
        console.warn('[ONBOARDING_CONTROLLER] Get templates failed - user not authenticated:', {
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
      const { page, limit, offset } = parsePaginationParams(req);

      // Parse filter options
      const activeOnly = req.query.activeOnly === 'true';
      const departmentId = req.query.departmentId as string | undefined;

      // Call service
      const result = await onboardingService.getTemplates(
        {
          activeOnly,
          departmentId,
        },
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination to results
        const totalCount = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(totalCount / limit);

        console.log('[ONBOARDING_CONTROLLER] Templates fetched successfully:', {
          totalCount,
          page,
          limit,
          returnedCount: paginatedData.length,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: paginatedData,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp: new Date(),
        });
      } else {
        console.error('[ONBOARDING_CONTROLLER] Get templates failed:', {
          error: result.error,
          errorCode: result.errorCode,
          userId: user.userId,
          executionTimeMs,
          correlationId,
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
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
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

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[ONBOARDING_CONTROLLER] Assign workflow failed - invalid request body:', {
          correlationId,
          clientIp,
          userId: user.userId,
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

      // Extract and validate workflow data
      const workflowData: AssignWorkflowRequest = {
        employeeId: req.body.employeeId,
        templateId: req.body.templateId,
        targetCompletionDate: req.body.targetCompletionDate
          ? new Date(req.body.targetCompletionDate)
          : undefined,
        taskOverrides: req.body.taskOverrides,
      };

      // Call service
      const result = await onboardingService.assignWorkflow(
        workflowData,
        user.userId,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Workflow assigned successfully:', {
          workflowId: result.data.id,
          employeeId: result.data.employeeId,
          templateId: result.data.templateId,
          taskCount: result.data.tasks.length,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Workflow assigned successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode =
          result.errorCode === 'EMPLOYEE_NOT_FOUND' ||
          result.errorCode === 'TEMPLATE_NOT_FOUND'
            ? HTTP_STATUS.NOT_FOUND
            : result.errorCode === 'WORKFLOW_EXISTS'
            ? HTTP_STATUS.BAD_REQUEST
            : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[ONBOARDING_CONTROLLER] Workflow assignment failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'ASSIGN_WORKFLOW_ERROR',
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
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
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

      // Get employee ID from authenticated user
      // In a real implementation, you would fetch the employee record associated with the user
      // For now, we'll use the userId as employeeId
      const employeeId = user.userId;

      // Call service
      const result = await onboardingService.getMyTasks(employeeId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Tasks fetched successfully:', {
          taskCount: result.data.length,
          employeeId,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        console.warn('[ONBOARDING_CONTROLLER] Get my tasks failed:', {
          error: result.error,
          errorCode: result.errorCode,
          employeeId,
          userId: user.userId,
          executionTimeMs,
          correlationId,
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
   * Update task status and mark as complete
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
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
        console.warn('[ONBOARDING_CONTROLLER] Update task failed - user not authenticated:', {
          correlationId,
          clientIp,
          taskId: req.params.id,
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
        console.warn('[ONBOARDING_CONTROLLER] Update task failed - invalid task ID:', {
          correlationId,
          clientIp,
          userId: user.userId,
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

      // Extract document URL if provided
      const documentUrl = req.body?.documentUrl as string | undefined;

      // Get employee ID from authenticated user
      const employeeId = user.userId;

      // Call service
      const result = await onboardingService.updateTaskStatus(
        taskId,
        employeeId,
        documentUrl,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Task updated successfully:', {
          taskId,
          employeeId,
          hasDocument: !!documentUrl,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Task completed successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode =
          result.errorCode === 'TASK_NOT_FOUND'
            ? HTTP_STATUS.NOT_FOUND
            : result.errorCode === 'UNAUTHORIZED'
            ? HTTP_STATUS.FORBIDDEN
            : result.errorCode === 'DOCUMENT_REQUIRED' ||
              result.errorCode === 'TASK_ALREADY_COMPLETED'
            ? HTTP_STATUS.BAD_REQUEST
            : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[ONBOARDING_CONTROLLER] Task update failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          taskId,
          employeeId,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

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
        correlationId,
        clientIp,
        taskId: req.params.id,
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
   * Get onboarding progress for manager's team
   * 
   * GET /api/onboarding/team-progress
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
      // Authenticate user
      const user = getAuthenticatedUser(req);
      if (!user) {
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

      // Get manager ID from authenticated user
      // In a real implementation, you would verify the user has manager role
      const managerId = user.userId;

      // Call service
      const result = await onboardingService.getTeamProgress(managerId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[ONBOARDING_CONTROLLER] Team progress fetched successfully:', {
          totalEmployees: result.data.totalEmployees,
          averageProgress: result.data.averageProgress,
          managerId,
          userId: user.userId,
          executionTimeMs,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        console.warn('[ONBOARDING_CONTROLLER] Get team progress failed:', {
          error: result.error,
          errorCode: result.errorCode,
          managerId,
          userId: user.userId,
          executionTimeMs,
          correlationId,
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
 * Export default instance
 */
export default onboardingController;