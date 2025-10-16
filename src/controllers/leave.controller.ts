/**
 * Leave Controller Module
 * 
 * Handles HTTP request/response processing for leave management endpoints.
 * Implements comprehensive input validation, error handling, and structured
 * logging for all leave operations including request submission, approval/rejection,
 * balance tracking, and leave history.
 * 
 * This controller acts as the HTTP layer adapter, translating HTTP requests
 * into service calls and formatting service responses into appropriate HTTP
 * responses with proper status codes and error handling.
 * 
 * @module controllers/leave
 */

import type { Request, Response, NextFunction } from 'express';

import { LeaveService } from '../services/leave.service.js';
import type {
  SubmitLeaveRequest,
  ApproveLeaveRequest,
  RejectLeaveRequest,
  LeaveType,
} from '../types/leave.js';

/**
 * HTTP Status Codes
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
 * Pagination defaults
 */
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Error code to HTTP status mapping
 */
const ERROR_CODE_TO_STATUS: Record<string, number> = {
  VALIDATION_ERROR: HTTP_STATUS.BAD_REQUEST,
  EMPLOYEE_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  REQUEST_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  BALANCE_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  UNAUTHORIZED: HTTP_STATUS.FORBIDDEN,
  OVERLAPPING_REQUEST: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  INSUFFICIENT_BALANCE: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  CREATE_REQUEST_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  FETCH_REQUEST_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  FETCH_REQUESTS_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  FETCH_TEAM_REQUESTS_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  APPROVE_REQUEST_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  REJECT_REQUEST_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  FETCH_BALANCE_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
};

/**
 * Get HTTP status code from error code
 */
function getStatusFromErrorCode(errorCode: string): number {
  return ERROR_CODE_TO_STATUS[errorCode] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(req: Request): string {
  const existingId = req.headers['x-correlation-id'] as string | undefined;
  if (existingId) {
    return existingId;
  }

  return `leave_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
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
 * Leave Controller Class
 * 
 * Provides HTTP request handlers for all leave management endpoints.
 * Each method validates input, calls the appropriate service method,
 * and formats the response with proper HTTP status codes.
 */
export class LeaveController {
  private readonly leaveService = new LeaveService();

  /**
   * Create leave request
   * 
   * POST /api/leave/requests
   * 
   * Request body:
   * {
   *   leaveType: string,
   *   startDate: string (ISO 8601),
   *   endDate: string (ISO 8601),
   *   reason: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async createRequest(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Create leave request received:', {
      correlationId,
      clientIp,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[LEAVE_CONTROLLER] Create leave request failed - invalid request body:', {
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
        console.warn('[LEAVE_CONTROLLER] Create leave request failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Create leave request failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const employeeId = employeeResult.rows[0]!.id;

      // Parse dates
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);

      // Validate date parsing
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('[LEAVE_CONTROLLER] Create leave request failed - invalid dates:', {
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Invalid date format. Expected ISO 8601 format.',
          timestamp: new Date(),
        });
        return;
      }

      // Build leave request data
      const leaveRequestData: SubmitLeaveRequest = {
        employeeId,
        leaveType: req.body.leaveType as LeaveType,
        startDate,
        endDate,
        reason: req.body.reason,
      };

      // Call service
      const result = await this.leaveService.createLeaveRequest(
        leaveRequestData,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[LEAVE_CONTROLLER] Leave request created successfully:', {
          requestId: result.data.id,
          employeeId: result.data.employeeId,
          leaveType: result.data.leaveType,
          daysCount: result.data.daysCount,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Leave request submitted successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Leave request creation failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'CREATE_REQUEST_ERROR',
          message: result.error || 'Failed to create leave request',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Create leave request error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while creating leave request',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get leave request by ID
   * 
   * GET /api/leave/requests/:id
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getRequest(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Get leave request received:', {
      requestId: req.params.id,
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[LEAVE_CONTROLLER] Get leave request failed - user not authenticated:', {
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

      const requestId = req.params.id;

      // Validate request ID
      if (!requestId || requestId.trim().length === 0) {
        console.warn('[LEAVE_CONTROLLER] Get leave request failed - missing request ID:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Request ID is required',
          timestamp: new Date(),
        });
        return;
      }

      // Call service
      const result = await this.leaveService.getLeaveRequest(
        requestId,
        user.userId,
        user.role,
        correlationId
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[LEAVE_CONTROLLER] Leave request fetched successfully:', {
          requestId: result.data.id,
          status: result.data.status,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Get leave request failed:', {
          requestId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'FETCH_REQUEST_ERROR',
          message: result.error || 'Failed to fetch leave request',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Get leave request error:', {
        error: errorMessage,
        requestId: req.params.id,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching leave request',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get employee's own leave requests
   * 
   * GET /api/leave/my-requests
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
  async getMyRequests(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Get my leave requests received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[LEAVE_CONTROLLER] Get my requests failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Get my requests failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const employeeId = employeeResult.rows[0]!.id;

      // Parse pagination parameters
      const { page, limit, offset } = parsePaginationParams(req.query);

      // Call service
      const result = await this.leaveService.getMyRequests(employeeId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination
        const total = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        console.log('[LEAVE_CONTROLLER] My leave requests fetched successfully:', {
          employeeId,
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
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Get my requests failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'FETCH_REQUESTS_ERROR',
          message: result.error || 'Failed to fetch leave requests',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Get my requests error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching leave requests',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get team leave requests
   * 
   * GET /api/leave/team-requests
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
  async getTeamRequests(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Get team leave requests received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[LEAVE_CONTROLLER] Get team requests failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Get team requests failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const managerId = employeeResult.rows[0]!.id;

      // Parse pagination parameters
      const { page, limit, offset } = parsePaginationParams(req.query);

      // Call service
      const result = await this.leaveService.getTeamRequests(managerId, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        // Apply pagination
        const total = result.data.length;
        const paginatedData = result.data.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        console.log('[LEAVE_CONTROLLER] Team leave requests fetched successfully:', {
          managerId,
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
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Get team requests failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'FETCH_TEAM_REQUESTS_ERROR',
          message: result.error || 'Failed to fetch team leave requests',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Get team requests error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching team leave requests',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Approve leave request
   * 
   * PATCH /api/leave/requests/:id/approve
   * 
   * Request body:
   * {
   *   comments?: string
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async approveRequest(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Approve leave request received:', {
      requestId: req.params.id,
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[LEAVE_CONTROLLER] Approve request failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Approve request failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const approverId = employeeResult.rows[0]!.id;
      const requestId = req.params.id;

      // Validate request ID
      if (!requestId || requestId.trim().length === 0) {
        console.warn('[LEAVE_CONTROLLER] Approve request failed - missing request ID:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Request ID is required',
          timestamp: new Date(),
        });
        return;
      }

      // Build approval request
      const approvalRequest: ApproveLeaveRequest = {
        requestId,
        approverId,
      };

      // Call service
      const result = await this.leaveService.approveRequest(approvalRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[LEAVE_CONTROLLER] Leave request approved successfully:', {
          requestId: result.data.id,
          approverId: result.data.approvedBy,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Leave request approved successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Approve request failed:', {
          requestId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'APPROVE_REQUEST_ERROR',
          message: result.error || 'Failed to approve leave request',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Approve request error:', {
        error: errorMessage,
        requestId: req.params.id,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while approving leave request',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Reject leave request
   * 
   * PATCH /api/leave/requests/:id/reject
   * 
   * Request body:
   * {
   *   reason: string (required)
   * }
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async rejectRequest(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Reject leave request received:', {
      requestId: req.params.id,
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate request body exists
      if (!req.body || typeof req.body !== 'object') {
        console.warn('[LEAVE_CONTROLLER] Reject request failed - invalid request body:', {
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
        console.warn('[LEAVE_CONTROLLER] Reject request failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Reject request failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const approverId = employeeResult.rows[0]!.id;
      const requestId = req.params.id;

      // Validate request ID
      if (!requestId || requestId.trim().length === 0) {
        console.warn('[LEAVE_CONTROLLER] Reject request failed - missing request ID:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Request ID is required',
          timestamp: new Date(),
        });
        return;
      }

      // Validate rejection reason
      const rejectionReason = req.body.reason;
      if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
        console.warn('[LEAVE_CONTROLLER] Reject request failed - missing rejection reason:', {
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          code: 'INVALID_REQUEST',
          message: 'Rejection reason is required',
          timestamp: new Date(),
        });
        return;
      }

      // Build rejection request
      const rejectionRequest: RejectLeaveRequest = {
        requestId,
        approverId,
        rejectionReason,
      };

      // Call service
      const result = await this.leaveService.rejectRequest(rejectionRequest, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[LEAVE_CONTROLLER] Leave request rejected successfully:', {
          requestId: result.data.id,
          approverId: result.data.approvedBy,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Leave request rejected successfully',
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Reject request failed:', {
          requestId,
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'REJECT_REQUEST_ERROR',
          message: result.error || 'Failed to reject leave request',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Reject request error:', {
        error: errorMessage,
        requestId: req.params.id,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while rejecting leave request',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get employee's leave balance
   * 
   * GET /api/leave/my-balance
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {NextFunction} next - Express next function
   * @returns {Promise<void>}
   */
  async getMyBalance(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId(req);
    const clientIp = getClientIp(req);

    console.log('[LEAVE_CONTROLLER] Get my leave balance received:', {
      correlationId,
      clientIp,
      timestamp: new Date().toISOString(),
    });

    try {
      // Extract authenticated user
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.warn('[LEAVE_CONTROLLER] Get my balance failed - user not authenticated:', {
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

      // Fetch employee ID from user ID
      const { executeQuery } = await import('../db/index.js');
      const employeeResult = await executeQuery<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [user.userId],
        { correlationId, operation: 'fetch_employee_by_user' }
      );

      if (employeeResult.rows.length === 0) {
        console.warn('[LEAVE_CONTROLLER] Get my balance failed - employee not found:', {
          userId: user.userId,
          correlationId,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'Employee record not found',
          timestamp: new Date(),
        });
        return;
      }

      const employeeId = employeeResult.rows[0]!.id;

      // Call service
      const result = await this.leaveService.getMyBalance(employeeId, undefined, correlationId);

      const executionTimeMs = Date.now() - startTime;

      if (result.success && result.data) {
        console.log('[LEAVE_CONTROLLER] Leave balance fetched successfully:', {
          employeeId,
          year: result.data.year,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(HTTP_STATUS.OK).json({
          success: true,
          data: result.data,
          timestamp: new Date(),
        });
      } else {
        const statusCode = getStatusFromErrorCode(result.errorCode || '');

        console.warn('[LEAVE_CONTROLLER] Get my balance failed:', {
          error: result.error,
          errorCode: result.errorCode,
          statusCode,
          correlationId,
          clientIp,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        res.status(statusCode).json({
          success: false,
          code: result.errorCode || 'FETCH_BALANCE_ERROR',
          message: result.error || 'Failed to fetch leave balance',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_CONTROLLER] Get my balance error:', {
        error: errorMessage,
        correlationId,
        clientIp,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching leave balance',
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Export singleton instance
 */
export const leaveController = new LeaveController();

/**
 * Default export
 */
export default leaveController;
