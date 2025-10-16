/**
 * Appraisal Controller Module
 * 
 * Handles HTTP requests for performance appraisal management endpoints.
 * Implements comprehensive request validation, authorization checks, and
 * proper error handling with structured logging.
 * 
 * @module controllers/appraisal
 */

import type { Request, Response, NextFunction } from 'express';
import { appraisalService } from '../services/appraisal.service.js';
import type {
  CreateAppraisalRequest,
  SubmitSelfAssessmentRequest,
  SubmitManagerReviewRequest,
  UpdateGoalsRequest,
  GoalStatus,
} from '../types/appraisal.js';

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
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Extended Express Request with authenticated user
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    isActive: boolean;
    iat: number;
    exp: number;
    jti?: string;
  };
  correlationId?: string;
}

/**
 * Pagination parameters interface
 */
interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `appraisal_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Parse and validate pagination parameters
 */
function parsePaginationParams(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 20));
  
  return { page, limit };
}

/**
 * Validate goal status enum value
 */
function isValidGoalStatus(status: any): status is GoalStatus {
  return typeof status === 'string' && 
         ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'NOT_ACHIEVED'].includes(status);
}

/**
 * Appraisal Controller Class
 * 
 * Handles all HTTP endpoints for appraisal management including
 * cycle creation, self-assessments, manager reviews, and goal tracking.
 */
export class AppraisalController {
  /**
   * Create a new appraisal cycle
   * 
   * POST /api/appraisals
   * 
   * Request body:
   * {
   *   employeeId: string,
   *   reviewerId: string,
   *   reviewPeriodStart: string (ISO date),
   *   reviewPeriodEnd: string (ISO date),
   *   goals?: Array<{
   *     title: string,
   *     description: string,
   *     targetDate: string (ISO date),
   *     status: GoalStatus,
   *     notes?: string
   *   }>
   * }
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async createAppraisal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Create appraisal request received:', {
      correlationId,
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Create appraisal failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[APPRAISAL_CONTROLLER] Create appraisal failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp,
        });
        return;
      }

      // Extract and validate required fields
      const { employeeId, reviewerId, reviewPeriodStart, reviewPeriodEnd, goals } = req.body;

      const validationErrors: string[] = [];

      if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
        validationErrors.push('Employee ID is required');
      }

      if (!reviewerId || typeof reviewerId !== 'string' || reviewerId.trim().length === 0) {
        validationErrors.push('Reviewer ID is required');
      }

      if (!reviewPeriodStart || typeof reviewPeriodStart !== 'string') {
        validationErrors.push('Review period start date is required');
      }

      if (!reviewPeriodEnd || typeof reviewPeriodEnd !== 'string') {
        validationErrors.push('Review period end date is required');
      }

      // Validate dates
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (reviewPeriodStart) {
        startDate = new Date(reviewPeriodStart);
        if (isNaN(startDate.getTime())) {
          validationErrors.push('Invalid review period start date format');
        }
      }

      if (reviewPeriodEnd) {
        endDate = new Date(reviewPeriodEnd);
        if (isNaN(endDate.getTime())) {
          validationErrors.push('Invalid review period end date format');
        }
      }

      // Validate goals if provided
      if (goals !== undefined) {
        if (!Array.isArray(goals)) {
          validationErrors.push('Goals must be an array');
        } else {
          goals.forEach((goal, index) => {
            if (!goal.title || typeof goal.title !== 'string' || goal.title.trim().length === 0) {
              validationErrors.push(`Goal ${index + 1}: Title is required`);
            }
            if (!goal.description || typeof goal.description !== 'string' || goal.description.trim().length === 0) {
              validationErrors.push(`Goal ${index + 1}: Description is required`);
            }
            if (!goal.targetDate || typeof goal.targetDate !== 'string') {
              validationErrors.push(`Goal ${index + 1}: Target date is required`);
            } else {
              const targetDate = new Date(goal.targetDate);
              if (isNaN(targetDate.getTime())) {
                validationErrors.push(`Goal ${index + 1}: Invalid target date format`);
              }
            }
            if (!goal.status || !isValidGoalStatus(goal.status)) {
              validationErrors.push(`Goal ${index + 1}: Valid status is required`);
            }
          });
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_CONTROLLER] Create appraisal validation failed:', {
          errors: validationErrors,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: validationErrors },
          timestamp,
        });
        return;
      }

      // Build request object
      const createRequest: CreateAppraisalRequest = {
        employeeId: employeeId.trim(),
        reviewerId: reviewerId.trim(),
        reviewPeriodStart: startDate!,
        reviewPeriodEnd: endDate!,
        goals: goals ? goals.map((goal: any) => ({
          title: goal.title.trim(),
          description: goal.description.trim(),
          targetDate: new Date(goal.targetDate),
          status: goal.status,
          notes: goal.notes ? goal.notes.trim() : undefined,
        })) : undefined,
      };

      // Call service
      const result = await appraisalService.createAppraisal(createRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Appraisal created successfully:', {
          appraisalId: result.data.id,
          employeeId: result.data.employeeId,
          reviewerId: result.data.reviewerId,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Appraisal created successfully',
          data: result.data,
          timestamp,
        });
      } else {
        const statusCode = result.errorCode === 'VALIDATION_ERROR' 
          ? HTTP_STATUS.BAD_REQUEST
          : result.errorCode === 'UNAUTHORIZED'
          ? HTTP_STATUS.FORBIDDEN
          : result.errorCode === 'EMPLOYEE_NOT_FOUND' || result.errorCode === 'REVIEWER_NOT_FOUND'
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[APPRAISAL_CONTROLLER] Appraisal creation failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'APPRAISAL_CREATION_ERROR',
          message: result.error || 'Failed to create appraisal',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Create appraisal error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while creating appraisal',
        timestamp,
      });
    }
  }

  /**
   * Get appraisal by ID
   * 
   * GET /api/appraisals/:id
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getAppraisal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Get appraisal request received:', {
      appraisalId: req.params.id,
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Get appraisal failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Validate appraisal ID
      const appraisalId = req.params.id;
      if (!appraisalId || appraisalId.trim().length === 0) {
        console.warn('[APPRAISAL_CONTROLLER] Get appraisal failed - missing appraisal ID:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Appraisal ID is required',
          timestamp,
        });
        return;
      }

      // Call service
      const result = await appraisalService.getAppraisal(
        appraisalId,
        req.user.userId,
        req.user.role,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Appraisal fetched successfully:', {
          appraisalId: result.data.id,
          status: result.data.status,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp,
        });
      } else {
        const statusCode = result.errorCode === 'APPRAISAL_NOT_FOUND'
          ? HTTP_STATUS.NOT_FOUND
          : result.errorCode === 'UNAUTHORIZED'
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[APPRAISAL_CONTROLLER] Get appraisal failed:', {
          appraisalId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'FETCH_APPRAISAL_ERROR',
          message: result.error || 'Failed to fetch appraisal',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Get appraisal error:', {
        appraisalId: req.params.id,
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching appraisal',
        timestamp,
      });
    }
  }

  /**
   * Get authenticated employee's appraisals
   * 
   * GET /api/appraisals/my-appraisals
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getMyAppraisals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Get my appraisals request received:', {
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Get my appraisals failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Call service
      const result = await appraisalService.getMyAppraisals(req.user.userId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] My appraisals fetched successfully:', {
          userId: req.user.userId,
          count: result.data.length,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp,
        });
      } else {
        console.error('[APPRAISAL_CONTROLLER] Get my appraisals failed:', {
          userId: req.user.userId,
          error: result.error,
          errorCode: result.errorCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_APPRAISALS_ERROR',
          message: result.error || 'Failed to fetch appraisals',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Get my appraisals error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching appraisals',
        timestamp,
      });
    }
  }

  /**
   * Get team appraisals for manager
   * 
   * GET /api/appraisals/team
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getTeamAppraisals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Get team appraisals request received:', {
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Get team appraisals failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Call service
      const result = await appraisalService.getTeamAppraisals(req.user.userId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Team appraisals fetched successfully:', {
          userId: req.user.userId,
          count: result.data.length,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp,
        });
      } else {
        console.error('[APPRAISAL_CONTROLLER] Get team appraisals failed:', {
          userId: req.user.userId,
          error: result.error,
          errorCode: result.errorCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_TEAM_APPRAISALS_ERROR',
          message: result.error || 'Failed to fetch team appraisals',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Get team appraisals error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching team appraisals',
        timestamp,
      });
    }
  }

  /**
   * Get all appraisals (HR Admin only)
   * 
   * GET /api/appraisals
   * 
   * Query parameters:
   * - page: number (default: 1)
   * - limit: number (default: 20, max: 100)
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getAllAppraisals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Get all appraisals request received:', {
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Get all appraisals failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Parse pagination parameters
      const { page, limit } = parsePaginationParams(req.query);

      // Call service
      const result = await appraisalService.getAllAppraisals(page, limit, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        const totalPages = Math.ceil(result.data.total / limit);

        console.log('[APPRAISAL_CONTROLLER] All appraisals fetched successfully:', {
          page,
          limit,
          total: result.data.total,
          count: result.data.appraisals.length,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data.appraisals,
          pagination: {
            page,
            limit,
            total: result.data.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp,
        });
      } else {
        console.error('[APPRAISAL_CONTROLLER] Get all appraisals failed:', {
          error: result.error,
          errorCode: result.errorCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          code: result.errorCode || 'FETCH_ALL_APPRAISALS_ERROR',
          message: result.error || 'Failed to fetch all appraisals',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Get all appraisals error:', {
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching all appraisals',
        timestamp,
      });
    }
  }

  /**
   * Submit self-assessment
   * 
   * PATCH /api/appraisals/:id/self-assessment
   * 
   * Request body:
   * {
   *   selfAssessment: string,
   *   goalUpdates?: Array<{
   *     goalId: string,
   *     status: GoalStatus,
   *     notes?: string
   *   }>
   * }
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async submitSelfAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Submit self-assessment request received:', {
      appraisalId: req.params.id,
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Submit self-assessment failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[APPRAISAL_CONTROLLER] Submit self-assessment failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp,
        });
        return;
      }

      // Validate appraisal ID
      const appraisalId = req.params.id;
      if (!appraisalId || appraisalId.trim().length === 0) {
        console.warn('[APPRAISAL_CONTROLLER] Submit self-assessment failed - missing appraisal ID:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Appraisal ID is required',
          timestamp,
        });
        return;
      }

      // Extract and validate fields
      const { selfAssessment, goalUpdates } = req.body;

      const validationErrors: string[] = [];

      if (!selfAssessment || typeof selfAssessment !== 'string' || selfAssessment.trim().length === 0) {
        validationErrors.push('Self-assessment is required');
      }

      // Validate goal updates if provided
      if (goalUpdates !== undefined) {
        if (!Array.isArray(goalUpdates)) {
          validationErrors.push('Goal updates must be an array');
        } else {
          goalUpdates.forEach((update, index) => {
            if (!update.goalId || typeof update.goalId !== 'string' || update.goalId.trim().length === 0) {
              validationErrors.push(`Goal update ${index + 1}: Goal ID is required`);
            }
            if (!update.status || !isValidGoalStatus(update.status)) {
              validationErrors.push(`Goal update ${index + 1}: Valid status is required`);
            }
          });
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_CONTROLLER] Submit self-assessment validation failed:', {
          errors: validationErrors,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: validationErrors },
          timestamp,
        });
        return;
      }

      // Build request object
      const submitRequest: SubmitSelfAssessmentRequest = {
        appraisalId: appraisalId.trim(),
        selfAssessment: selfAssessment.trim(),
        goalUpdates: goalUpdates ? goalUpdates.map((update: any) => ({
          goalId: update.goalId.trim(),
          status: update.status,
          notes: update.notes ? update.notes.trim() : undefined,
        })) : undefined,
      };

      // Call service
      const result = await appraisalService.submitSelfAssessment(
        submitRequest,
        req.user.userId,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Self-assessment submitted successfully:', {
          appraisalId: result.data.id,
          status: result.data.status,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Self-assessment submitted successfully',
          data: result.data,
          timestamp,
        });
      } else {
        const statusCode = result.errorCode === 'VALIDATION_ERROR'
          ? HTTP_STATUS.BAD_REQUEST
          : result.errorCode === 'UNAUTHORIZED'
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[APPRAISAL_CONTROLLER] Submit self-assessment failed:', {
          appraisalId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'SUBMIT_SELF_ASSESSMENT_ERROR',
          message: result.error || 'Failed to submit self-assessment',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Submit self-assessment error:', {
        appraisalId: req.params.id,
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while submitting self-assessment',
        timestamp,
      });
    }
  }

  /**
   * Submit manager review
   * 
   * PATCH /api/appraisals/:id/review
   * 
   * Request body:
   * {
   *   managerFeedback: string,
   *   rating: number (1-5),
   *   goalUpdates?: Array<{
   *     goalId: string,
   *     status: GoalStatus,
   *     notes?: string
   *   }>
   * }
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async submitReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Submit review request received:', {
      appraisalId: req.params.id,
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Submit review failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[APPRAISAL_CONTROLLER] Submit review failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp,
        });
        return;
      }

      // Validate appraisal ID
      const appraisalId = req.params.id;
      if (!appraisalId || appraisalId.trim().length === 0) {
        console.warn('[APPRAISAL_CONTROLLER] Submit review failed - missing appraisal ID:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Appraisal ID is required',
          timestamp,
        });
        return;
      }

      // Extract and validate fields
      const { managerFeedback, rating, goalUpdates } = req.body;

      const validationErrors: string[] = [];

      if (!managerFeedback || typeof managerFeedback !== 'string' || managerFeedback.trim().length === 0) {
        validationErrors.push('Manager feedback is required');
      }

      if (rating === undefined || rating === null) {
        validationErrors.push('Rating is required');
      } else if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        validationErrors.push('Rating must be an integer between 1 and 5');
      }

      // Validate goal updates if provided
      if (goalUpdates !== undefined) {
        if (!Array.isArray(goalUpdates)) {
          validationErrors.push('Goal updates must be an array');
        } else {
          goalUpdates.forEach((update, index) => {
            if (!update.goalId || typeof update.goalId !== 'string' || update.goalId.trim().length === 0) {
              validationErrors.push(`Goal update ${index + 1}: Goal ID is required`);
            }
            if (!update.status || !isValidGoalStatus(update.status)) {
              validationErrors.push(`Goal update ${index + 1}: Valid status is required`);
            }
          });
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_CONTROLLER] Submit review validation failed:', {
          errors: validationErrors,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: validationErrors },
          timestamp,
        });
        return;
      }

      // Build request object
      const submitRequest: SubmitManagerReviewRequest = {
        appraisalId: appraisalId.trim(),
        managerFeedback: managerFeedback.trim(),
        rating,
        goalUpdates: goalUpdates ? goalUpdates.map((update: any) => ({
          goalId: update.goalId.trim(),
          status: update.status,
          notes: update.notes ? update.notes.trim() : undefined,
        })) : undefined,
      };

      // Call service
      const result = await appraisalService.submitReview(
        submitRequest,
        req.user.userId,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Review submitted successfully:', {
          appraisalId: result.data.id,
          rating: result.data.rating,
          status: result.data.status,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Review submitted successfully',
          data: result.data,
          timestamp,
        });
      } else {
        const statusCode = result.errorCode === 'VALIDATION_ERROR'
          ? HTTP_STATUS.BAD_REQUEST
          : result.errorCode === 'UNAUTHORIZED'
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[APPRAISAL_CONTROLLER] Submit review failed:', {
          appraisalId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'SUBMIT_REVIEW_ERROR',
          message: result.error || 'Failed to submit review',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Submit review error:', {
        appraisalId: req.params.id,
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while submitting review',
        timestamp,
      });
    }
  }

  /**
   * Update goals for an appraisal
   * 
   * PATCH /api/appraisals/:id/goals
   * 
   * Request body:
   * {
   *   goalsToAdd?: Array<{
   *     title: string,
   *     description: string,
   *     targetDate: string (ISO date),
   *     status: GoalStatus,
   *     notes?: string
   *   }>,
   *   goalsToUpdate?: Array<{
   *     goalId: string,
   *     title?: string,
   *     description?: string,
   *     targetDate?: string (ISO date),
   *     status?: GoalStatus,
   *     notes?: string
   *   }>,
   *   goalsToRemove?: string[]
   * }
   * 
   * @param {AuthenticatedRequest} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async updateGoals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = req.correlationId || generateCorrelationId();
    const clientIp = getClientIp(req);
    const timestamp = new Date();

    console.log('[APPRAISAL_CONTROLLER] Update goals request received:', {
      appraisalId: req.params.id,
      correlationId,
      clientIp,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate authentication
      if (!req.user || !req.user.userId) {
        console.warn('[APPRAISAL_CONTROLLER] Update goals failed - user not authenticated:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp,
        });
        return;
      }

      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[APPRAISAL_CONTROLLER] Update goals failed - invalid request body:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          timestamp,
        });
        return;
      }

      // Validate appraisal ID
      const appraisalId = req.params.id;
      if (!appraisalId || appraisalId.trim().length === 0) {
        console.warn('[APPRAISAL_CONTROLLER] Update goals failed - missing appraisal ID:', {
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Appraisal ID is required',
          timestamp,
        });
        return;
      }

      // Extract and validate fields
      const { goalsToAdd, goalsToUpdate, goalsToRemove } = req.body;

      const validationErrors: string[] = [];

      // Validate goalsToAdd
      if (goalsToAdd !== undefined) {
        if (!Array.isArray(goalsToAdd)) {
          validationErrors.push('Goals to add must be an array');
        } else {
          goalsToAdd.forEach((goal, index) => {
            if (!goal.title || typeof goal.title !== 'string' || goal.title.trim().length === 0) {
              validationErrors.push(`Goal to add ${index + 1}: Title is required`);
            }
            if (!goal.description || typeof goal.description !== 'string' || goal.description.trim().length === 0) {
              validationErrors.push(`Goal to add ${index + 1}: Description is required`);
            }
            if (!goal.targetDate || typeof goal.targetDate !== 'string') {
              validationErrors.push(`Goal to add ${index + 1}: Target date is required`);
            } else {
              const targetDate = new Date(goal.targetDate);
              if (isNaN(targetDate.getTime())) {
                validationErrors.push(`Goal to add ${index + 1}: Invalid target date format`);
              }
            }
            if (!goal.status || !isValidGoalStatus(goal.status)) {
              validationErrors.push(`Goal to add ${index + 1}: Valid status is required`);
            }
          });
        }
      }

      // Validate goalsToUpdate
      if (goalsToUpdate !== undefined) {
        if (!Array.isArray(goalsToUpdate)) {
          validationErrors.push('Goals to update must be an array');
        } else {
          goalsToUpdate.forEach((update, index) => {
            if (!update.goalId || typeof update.goalId !== 'string' || update.goalId.trim().length === 0) {
              validationErrors.push(`Goal to update ${index + 1}: Goal ID is required`);
            }
            if (update.targetDate !== undefined && typeof update.targetDate === 'string') {
              const targetDate = new Date(update.targetDate);
              if (isNaN(targetDate.getTime())) {
                validationErrors.push(`Goal to update ${index + 1}: Invalid target date format`);
              }
            }
            if (update.status !== undefined && !isValidGoalStatus(update.status)) {
              validationErrors.push(`Goal to update ${index + 1}: Invalid status`);
            }
          });
        }
      }

      // Validate goalsToRemove
      if (goalsToRemove !== undefined) {
        if (!Array.isArray(goalsToRemove)) {
          validationErrors.push('Goals to remove must be an array');
        } else {
          goalsToRemove.forEach((goalId, index) => {
            if (!goalId || typeof goalId !== 'string' || goalId.trim().length === 0) {
              validationErrors.push(`Goal to remove ${index + 1}: Goal ID is required`);
            }
          });
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_CONTROLLER] Update goals validation failed:', {
          errors: validationErrors,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { errors: validationErrors },
          timestamp,
        });
        return;
      }

      // Build request object
      const updateRequest: UpdateGoalsRequest = {
        appraisalId: appraisalId.trim(),
        goalsToAdd: goalsToAdd ? goalsToAdd.map((goal: any) => ({
          title: goal.title.trim(),
          description: goal.description.trim(),
          targetDate: new Date(goal.targetDate),
          status: goal.status,
          notes: goal.notes ? goal.notes.trim() : undefined,
        })) : undefined,
        goalsToUpdate: goalsToUpdate ? goalsToUpdate.map((update: any) => ({
          goalId: update.goalId.trim(),
          title: update.title ? update.title.trim() : undefined,
          description: update.description ? update.description.trim() : undefined,
          targetDate: update.targetDate ? new Date(update.targetDate) : undefined,
          status: update.status,
          notes: update.notes !== undefined ? (update.notes ? update.notes.trim() : undefined) : undefined,
        })) : undefined,
        goalsToRemove: goalsToRemove ? goalsToRemove.map((id: string) => id.trim()) : undefined,
      };

      // Call service
      const result = await appraisalService.updateGoals(
        updateRequest,
        req.user.userId,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[APPRAISAL_CONTROLLER] Goals updated successfully:', {
          appraisalId: result.data.id,
          goalCount: result.data.goals.length,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Goals updated successfully',
          data: result.data,
          timestamp,
        });
      } else {
        const statusCode = result.errorCode === 'VALIDATION_ERROR'
          ? HTTP_STATUS.BAD_REQUEST
          : result.errorCode === 'UNAUTHORIZED'
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

        console.warn('[APPRAISAL_CONTROLLER] Update goals failed:', {
          appraisalId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          executionTimeMs,
          correlationId,
          clientIp,
          timestamp: timestamp.toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'UPDATE_GOALS_ERROR',
          message: result.error || 'Failed to update goals',
          timestamp,
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_CONTROLLER] Update goals error:', {
        appraisalId: req.params.id,
        error: errorMessage,
        executionTimeMs,
        correlationId,
        clientIp,
        timestamp: timestamp.toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while updating goals',
        timestamp,
      });
    }
  }
}

/**
 * Singleton appraisal controller instance
 */
export const appraisalController = new AppraisalController();

/**
 * Default export: appraisal controller singleton
 */
export default appraisalController;