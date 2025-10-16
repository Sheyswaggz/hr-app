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

import { leaveController } from '../controllers/leave.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { UserRole } from '../types/index.js';

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
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Create leave request:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.createRequest(req, res, next);
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
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Get leave request:', {
        path: req.path,
        method: req.method,
        requestId: req.params.id,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.getRequest(req, res, next);
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
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Get my leave requests:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.getMyRequests(req, res, next);
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
    authorize(UserRole.Manager, { useHierarchy: true }),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Get team leave requests:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.getTeamRequests(req, res, next);
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
    authorize(UserRole.Manager, { useHierarchy: true }),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Approve leave request:', {
        path: req.path,
        method: req.method,
        requestId: req.params.id,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.approveRequest(req, res, next);
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
    authorize(UserRole.Manager, { useHierarchy: true }),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Reject leave request:', {
        path: req.path,
        method: req.method,
        requestId: req.params.id,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.rejectRequest(req, res, next);
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
    authorize([UserRole.HRAdmin, UserRole.Manager, UserRole.Employee]),
    (req, res, next) => {
      console.log('[LEAVE_ROUTES] Get my leave balance:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
      return leaveController.getMyBalance(req, res, next);
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