/**
 * Leave Routes Module
 * 
 * Express router for leave management endpoints with role-based access control.
 * Provides RESTful API for leave request submission, approval/rejection, balance
 * tracking, and leave history management.
 * 
 * This module handles:
 * - Leave request submission by employees
 * - Leave request approval/rejection by managers
 * - Leave balance retrieval
 * - Leave request history for employees and managers
 * - Role-based authorization for all endpoints
 * 
 * @module routes/leave
 */

import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

/**
 * Create and configure leave management router
 * 
 * Sets up all leave-related routes with appropriate authentication and
 * authorization middleware. All routes require authentication, with specific
 * role requirements for different operations.
 * 
 * @returns {Router} Configured Express router
 * 
 * @example
 * import { leaveRouter } from './routes/leave.routes.js';
 * app.use('/api/leave', leaveRouter);
 */
export function createLeaveRouter(): Router {
  const router = Router();

  console.log('[LEAVE_ROUTES] Initializing leave management routes');

  // Apply authentication middleware to all routes
  router.use(authenticate);

  /**
   * Submit leave request
   * 
   * POST /api/leave/requests
   * 
   * Allows employees to submit new leave requests. Validates leave balance,
   * checks for overlapping requests, and sends notification to manager.
   * 
   * Authorization: Employee (authenticated)
   * 
   * Request body:
   * {
   *   leaveType: string,
   *   startDate: string (ISO 8601),
   *   endDate: string (ISO 8601),
   *   reason?: string
   * }
   * 
   * Response: 201 Created
   * {
   *   success: true,
   *   message: string,
   *   data: LeaveRequest
   * }
   */
  router.post(
    '/requests',
    authorize(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Leave request submission endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get leave request by ID
   * 
   * GET /api/leave/requests/:id
   * 
   * Retrieves a specific leave request. Employees can only view their own
   * requests, managers can view team member requests, HR admins can view all.
   * 
   * Authorization: Employee (own requests), Manager (team requests), HR Admin (all)
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   data: LeaveRequest
   * }
   */
  router.get(
    '/requests/:id',
    authorize(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Get leave request endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get employee's own leave requests
   * 
   * GET /api/leave/my-requests
   * 
   * Retrieves all leave requests for the authenticated employee with optional
   * filtering by status and date range.
   * 
   * Authorization: Employee (authenticated)
   * 
   * Query parameters:
   * - status?: string (pending|approved|rejected|cancelled)
   * - startDate?: string (ISO 8601)
   * - endDate?: string (ISO 8601)
   * - page?: number (default: 1)
   * - limit?: number (default: 20, max: 100)
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   data: LeaveRequest[],
   *   pagination: PaginationMetadata
   * }
   */
  router.get(
    '/my-requests',
    authorize(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Get my leave requests endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get team leave requests
   * 
   * GET /api/leave/team-requests
   * 
   * Retrieves leave requests for all team members reporting to the authenticated
   * manager. Supports filtering by status, employee, and date range.
   * 
   * Authorization: Manager only
   * 
   * Query parameters:
   * - status?: string (pending|approved|rejected|cancelled)
   * - employeeId?: string
   * - startDate?: string (ISO 8601)
   * - endDate?: string (ISO 8601)
   * - page?: number (default: 1)
   * - limit?: number (default: 20, max: 100)
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   data: LeaveRequest[],
   *   pagination: PaginationMetadata
   * }
   */
  router.get(
    '/team-requests',
    authorize('MANAGER', { useHierarchy: true }),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Get team leave requests endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Approve leave request
   * 
   * PATCH /api/leave/requests/:id/approve
   * 
   * Approves a pending leave request. Only managers can approve requests from
   * their team members. Updates leave balance and sends notification to employee.
   * 
   * Authorization: Manager (team member requests only)
   * 
   * Request body:
   * {
   *   comments?: string
   * }
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   message: string,
   *   data: LeaveRequest
   * }
   */
  router.patch(
    '/requests/:id/approve',
    authorize('MANAGER', { useHierarchy: true }),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Approve leave request endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Reject leave request
   * 
   * PATCH /api/leave/requests/:id/reject
   * 
   * Rejects a pending leave request. Only managers can reject requests from
   * their team members. Rejection reason is required. Sends notification to employee.
   * 
   * Authorization: Manager (team member requests only)
   * 
   * Request body:
   * {
   *   reason: string (required, max 500 characters)
   * }
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   message: string,
   *   data: LeaveRequest
   * }
   */
  router.patch(
    '/requests/:id/reject',
    authorize('MANAGER', { useHierarchy: true }),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Reject leave request endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get employee's leave balance
   * 
   * GET /api/leave/my-balance
   * 
   * Retrieves leave balance information for the authenticated employee,
   * including available days for each leave type and usage history.
   * 
   * Authorization: Employee (authenticated)
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     employeeId: string,
   *     balances: Array<{
   *       leaveType: string,
   *       totalDays: number,
   *       usedDays: number,
   *       remainingDays: number,
   *       pendingDays: number
   *     }>,
   *     lastUpdated: string
   *   }
   * }
   */
  router.get(
    '/my-balance',
    authorize(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']),
    async (req, res, next) => {
      try {
        // Controller implementation will be added
        res.status(501).json({
          success: false,
          code: 'NOT_IMPLEMENTED',
          message: 'Get leave balance endpoint not yet implemented',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  console.log('[LEAVE_ROUTES] Leave management routes initialized successfully');

  return router;
}

/**
 * Pre-configured leave router instance
 * 
 * @example
 * import { leaveRouter } from './routes/leave.routes.js';
 * app.use('/api/leave', leaveRouter);
 */
export const leaveRouter = createLeaveRouter();

/**
 * Default export
 */
export default leaveRouter;