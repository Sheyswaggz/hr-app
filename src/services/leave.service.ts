/**
 * Leave Service Module
 * 
 * Comprehensive business logic for leave request and approval workflow.
 * Implements leave request submission, manager approval/rejection, leave balance tracking,
 * leave history, and calendar integration with full transaction support.
 * 
 * @module services/leave
 */

import crypto from 'crypto';
import type { PoolClient } from 'pg';

import { executeQuery, executeTransaction, queryOne, queryMany } from '../db/index.js';
import { getEmailService } from './email.service.js';
import {
  LeaveType,
  LeaveStatus,
  type LeaveRequest,
  type LeaveBalance,
  type SubmitLeaveRequest,
  type ApproveLeaveRequest,
  type RejectLeaveRequest,
  type LeaveBalanceSummary,
  type LeaveRequestWithEmployee,
  validateLeaveDates,
  validateLeaveReason,
  validateRejectionReason,
  calculateDaysCount,
  calculateRemainingBalance,
  hasSufficientBalance,
  validateStatusTransition,
  createBalanceSummary,
} from '../types/leave.js';
import { calculateDaysBetween, checkDateOverlap, validateDateRange } from '../utils/date.js';

/**
 * Database record interface for leave requests
 */
interface LeaveRequestRecord {
  readonly id: string;
  readonly employee_id: string;
  readonly leave_type: string;
  readonly start_date: Date;
  readonly end_date: Date;
  readonly days_count: number;
  readonly reason: string;
  readonly status: string;
  readonly approved_by: string | null;
  readonly approved_at: Date | null;
  readonly rejection_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record interface for leave balances
 */
interface LeaveBalanceRecord {
  readonly id: string;
  readonly employee_id: string;
  readonly annual_leave_total: number;
  readonly annual_leave_used: number;
  readonly sick_leave_total: number;
  readonly sick_leave_used: number;
  readonly year: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record interface for employee details
 */
interface EmployeeRecord {
  readonly id: string;
  readonly user_id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly job_title: string | null;
  readonly manager_id: string | null;
}

/**
 * Service operation result interface
 */
interface ServiceOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: string;
  readonly executionTimeMs: number;
}

/**
 * Leave Service Class
 * 
 * Handles all leave management operations including request submission,
 * approval/rejection workflow, balance tracking, and validation.
 */
export class LeaveService {
  private readonly emailService = getEmailService();

  /**
   * Create a new leave request
   * 
   * Validates leave dates, checks balance availability, prevents overlapping requests,
   * and creates the leave request in pending status. Sends email notification to manager.
   * 
   * @param request - Leave request submission data
   * @param correlationId - Optional correlation ID for tracing
   * @returns Created leave request
   */
  async createLeaveRequest(
    request: SubmitLeaveRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequest>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `create_leave_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Creating leave request:', {
      employeeId: request.employeeId,
      leaveType: request.leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationResult = await this.validateLeaveRequest(request, cid);
      if (!validationResult.success) {
        console.warn('[LEAVE_SERVICE] Leave request validation failed:', {
          error: validationResult.error,
          errorCode: validationResult.errorCode,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationResult.error,
          errorCode: validationResult.errorCode,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Calculate days count
      const daysCount = calculateDaysBetween(request.startDate, request.endDate);

      // Fetch employee details
      const employee = await queryOne<EmployeeRecord>(
        `SELECT e.id, e.user_id, e.manager_id, u.first_name, u.last_name, u.email, e.job_title
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [request.employeeId],
        { correlationId: cid, operation: 'fetch_employee' }
      );

      if (!employee) {
        console.warn('[LEAVE_SERVICE] Employee not found:', {
          employeeId: request.employeeId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Employee not found',
          errorCode: 'EMPLOYEE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Create leave request in transaction
      const leaveRequest = await executeTransaction<LeaveRequest>(
        async (client) => {
          const requestId = crypto.randomUUID();

          // Insert leave request
          const result = await client.query<LeaveRequestRecord>(
            `INSERT INTO leave_requests (
              id, employee_id, leave_type, start_date, end_date, days_count,
              reason, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
              requestId,
              request.employeeId,
              request.leaveType,
              request.startDate,
              request.endDate,
              daysCount,
              request.reason.trim(),
              LeaveStatus.Pending,
              timestamp,
              timestamp,
            ]
          );

          if (result.rows.length === 0) {
            throw new Error('Failed to create leave request record');
          }

          const record = result.rows[0]!;

          return {
            id: record.id,
            employeeId: record.employee_id,
            leaveType: record.leave_type as LeaveType,
            startDate: record.start_date,
            endDate: record.end_date,
            daysCount: record.days_count,
            reason: record.reason,
            status: record.status as LeaveStatus,
            approvedBy: record.approved_by || undefined,
            approvedAt: record.approved_at || undefined,
            rejectionReason: record.rejection_reason || undefined,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'create_leave_request',
        }
      );

      // Send email notification to manager
      if (employee.manager_id) {
        try {
          const manager = await queryOne<EmployeeRecord>(
            `SELECT e.id, u.first_name, u.last_name, u.email
             FROM employees e
             JOIN users u ON e.user_id = u.id
             WHERE e.id = $1`,
            [employee.manager_id],
            { correlationId: cid, operation: 'fetch_manager' }
          );

          if (manager) {
            await this.emailService.sendEmail({
              to: manager.email,
              subject: `Leave Request Submitted - ${employee.first_name} ${employee.last_name}`,
              html: this.generateLeaveRequestEmailHtml(employee, leaveRequest),
              text: this.generateLeaveRequestEmailText(employee, leaveRequest),
            });

            console.log('[LEAVE_SERVICE] Leave request notification sent:', {
              requestId: leaveRequest.id,
              managerEmail: manager.email,
              correlationId: cid,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (emailError) {
          console.error('[LEAVE_SERVICE] Failed to send leave request notification:', {
            requestId: leaveRequest.id,
            error: emailError instanceof Error ? emailError.message : String(emailError),
            correlationId: cid,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Leave request created successfully:', {
        requestId: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        leaveType: leaveRequest.leaveType,
        daysCount: leaveRequest.daysCount,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: leaveRequest,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Leave request creation failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'CREATE_REQUEST_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get leave request by ID
   * 
   * Retrieves a single leave request with authorization check.
   * 
   * @param requestId - Leave request identifier
   * @param userId - User requesting the data
   * @param userRole - Role of the requesting user
   * @param correlationId - Optional correlation ID for tracing
   * @returns Leave request data
   */
  async getLeaveRequest(
    requestId: string,
    userId: string,
    userRole: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequest>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_leave_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Fetching leave request:', {
      requestId,
      userId,
      userRole,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!requestId || requestId.trim().length === 0) {
        return {
          success: false,
          error: 'Request ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch leave request
      const record = await queryOne<LeaveRequestRecord>(
        'SELECT * FROM leave_requests WHERE id = $1',
        [requestId],
        { correlationId: cid, operation: 'fetch_leave_request' }
      );

      if (!record) {
        console.warn('[LEAVE_SERVICE] Leave request not found:', {
          requestId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Leave request not found',
          errorCode: 'REQUEST_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Authorization check
      if (userRole !== 'HR_ADMIN') {
        const employee = await queryOne<{ id: string; manager_id: string | null }>(
          'SELECT id, manager_id FROM employees WHERE user_id = $1',
          [userId],
          { correlationId: cid, operation: 'fetch_user_employee' }
        );

        if (!employee) {
          return {
            success: false,
            error: 'Employee record not found',
            errorCode: 'UNAUTHORIZED',
            executionTimeMs: Date.now() - startTime,
          };
        }

        const isOwner = record.employee_id === employee.id;
        const isManager = record.approved_by === employee.id || 
                         (await this.isManagerOfEmployee(employee.id, record.employee_id, cid));

        if (!isOwner && !isManager) {
          console.warn('[LEAVE_SERVICE] Unauthorized leave request access:', {
            requestId,
            userId,
            employeeId: employee.id,
            correlationId: cid,
            timestamp: timestamp.toISOString(),
          });

          return {
            success: false,
            error: 'Unauthorized to access this leave request',
            errorCode: 'UNAUTHORIZED',
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      // Map to domain model
      const leaveRequest: LeaveRequest = {
        id: record.id,
        employeeId: record.employee_id,
        leaveType: record.leave_type as LeaveType,
        startDate: record.start_date,
        endDate: record.end_date,
        daysCount: record.days_count,
        reason: record.reason,
        status: record.status as LeaveStatus,
        approvedBy: record.approved_by || undefined,
        approvedAt: record.approved_at || undefined,
        rejectionReason: record.rejection_reason || undefined,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Leave request fetched successfully:', {
        requestId: leaveRequest.id,
        status: leaveRequest.status,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: leaveRequest,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Failed to fetch leave request:', {
        requestId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_REQUEST_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get leave requests for authenticated employee
   * 
   * Retrieves all leave requests for the authenticated employee.
   * 
   * @param employeeId - Employee identifier
   * @param correlationId - Optional correlation ID for tracing
   * @returns Employee leave requests
   */
  async getMyRequests(
    employeeId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequest[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_my_requests_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Fetching employee leave requests:', {
      employeeId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!employeeId || employeeId.trim().length === 0) {
        return {
          success: false,
          error: 'Employee ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch leave requests
      const records = await queryMany<LeaveRequestRecord>(
        `SELECT * FROM leave_requests 
         WHERE employee_id = $1 
         ORDER BY created_at DESC`,
        [employeeId],
        { correlationId: cid, operation: 'fetch_employee_requests' }
      );

      // Map to domain models
      const requests: LeaveRequest[] = records.map(record => ({
        id: record.id,
        employeeId: record.employee_id,
        leaveType: record.leave_type as LeaveType,
        startDate: record.start_date,
        endDate: record.end_date,
        daysCount: record.days_count,
        reason: record.reason,
        status: record.status as LeaveStatus,
        approvedBy: record.approved_by || undefined,
        approvedAt: record.approved_at || undefined,
        rejectionReason: record.rejection_reason || undefined,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      }));

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Employee leave requests fetched successfully:', {
        employeeId,
        count: requests.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: requests,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Failed to fetch employee leave requests:', {
        employeeId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_REQUESTS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get leave requests for manager's team
   * 
   * Retrieves all leave requests for employees reporting to the manager.
   * 
   * @param managerId - Manager identifier
   * @param correlationId - Optional correlation ID for tracing
   * @returns Team leave requests
   */
  async getTeamRequests(
    managerId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequestWithEmployee[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_team_requests_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Fetching team leave requests:', {
      managerId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!managerId || managerId.trim().length === 0) {
        return {
          success: false,
          error: 'Manager ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch leave requests with employee details
      const records = await queryMany<LeaveRequestRecord & {
        employee_first_name: string;
        employee_last_name: string;
        employee_email: string;
        employee_job_title: string | null;
        approver_first_name: string | null;
        approver_last_name: string | null;
        approver_email: string | null;
      }>(
        `SELECT lr.*,
                eu.first_name as employee_first_name,
                eu.last_name as employee_last_name,
                eu.email as employee_email,
                e.job_title as employee_job_title,
                au.first_name as approver_first_name,
                au.last_name as approver_last_name,
                au.email as approver_email
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         JOIN users eu ON e.user_id = eu.id
         LEFT JOIN employees a ON lr.approved_by = a.id
         LEFT JOIN users au ON a.user_id = au.id
         WHERE e.manager_id = $1
         ORDER BY lr.created_at DESC`,
        [managerId],
        { correlationId: cid, operation: 'fetch_team_requests' }
      );

      // Map to domain models
      const requests: LeaveRequestWithEmployee[] = records.map(record => ({
        id: record.id,
        employeeId: record.employee_id,
        leaveType: record.leave_type as LeaveType,
        startDate: record.start_date,
        endDate: record.end_date,
        daysCount: record.days_count,
        reason: record.reason,
        status: record.status as LeaveStatus,
        approvedBy: record.approved_by || undefined,
        approvedAt: record.approved_at || undefined,
        rejectionReason: record.rejection_reason || undefined,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        employee: {
          id: record.employee_id,
          firstName: record.employee_first_name,
          lastName: record.employee_last_name,
          email: record.employee_email,
          jobTitle: record.employee_job_title || undefined,
        },
        approver: record.approver_first_name ? {
          id: record.approved_by!,
          firstName: record.approver_first_name,
          lastName: record.approver_last_name!,
          email: record.approver_email!,
        } : undefined,
      }));

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Team leave requests fetched successfully:', {
        managerId,
        count: requests.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: requests,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Failed to fetch team leave requests:', {
        managerId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_TEAM_REQUESTS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Approve leave request
   * 
   * Approves a leave request, updates leave balance, and sends email notification.
   * Uses transaction to ensure atomicity.
   * 
   * @param request - Leave approval data
   * @param correlationId - Optional correlation ID for tracing
   * @returns Updated leave request
   */
  async approveRequest(
    request: ApproveLeaveRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequest>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `approve_leave_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Approving leave request:', {
      requestId: request.requestId,
      approverId: request.approverId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      if (!request.requestId || request.requestId.trim().length === 0) {
        return {
          success: false,
          error: 'Request ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (!request.approverId || request.approverId.trim().length === 0) {
        return {
          success: false,
          error: 'Approver ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Approve request and update balance in transaction
      const leaveRequest = await executeTransaction<LeaveRequest>(
        async (client) => {
          // Fetch leave request
          const record = await client.query<LeaveRequestRecord>(
            'SELECT * FROM leave_requests WHERE id = $1',
            [request.requestId]
          );

          if (record.rows.length === 0) {
            throw new Error('Leave request not found');
          }

          const requestRecord = record.rows[0]!;

          // Validate status transition
          const transitionValidation = validateStatusTransition(
            requestRecord.status as LeaveStatus,
            LeaveStatus.Approved
          );

          if (!transitionValidation.isValid) {
            throw new Error(transitionValidation.errors.join(', '));
          }

          // Verify approver is manager
          const isManager = await this.isManagerOfEmployee(
            request.approverId,
            requestRecord.employee_id,
            cid
          );

          if (!isManager) {
            throw new Error('Approver is not the employee\'s manager');
          }

          // Update leave request
          const updateResult = await client.query<LeaveRequestRecord>(
            `UPDATE leave_requests
             SET status = $1, approved_by = $2, approved_at = $3, updated_at = $4
             WHERE id = $5
             RETURNING *`,
            [LeaveStatus.Approved, request.approverId, timestamp, timestamp, request.requestId]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update leave request');
          }

          const updatedRecord = updateResult.rows[0]!;

          // Update leave balance
          await this.updateLeaveBalance(
            client,
            requestRecord.employee_id,
            requestRecord.leave_type as LeaveType,
            requestRecord.days_count,
            cid
          );

          return {
            id: updatedRecord.id,
            employeeId: updatedRecord.employee_id,
            leaveType: updatedRecord.leave_type as LeaveType,
            startDate: updatedRecord.start_date,
            endDate: updatedRecord.end_date,
            daysCount: updatedRecord.days_count,
            reason: updatedRecord.reason,
            status: updatedRecord.status as LeaveStatus,
            approvedBy: updatedRecord.approved_by || undefined,
            approvedAt: updatedRecord.approved_at || undefined,
            rejectionReason: updatedRecord.rejection_reason || undefined,
            createdAt: updatedRecord.created_at,
            updatedAt: updatedRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'approve_leave_request',
        }
      );

      // Send email notification
      try {
        const employee = await queryOne<EmployeeRecord>(
          `SELECT e.id, u.first_name, u.last_name, u.email
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1`,
          [leaveRequest.employeeId],
          { correlationId: cid, operation: 'fetch_employee_for_notification' }
        );

        if (employee) {
          await this.emailService.sendEmail({
            to: employee.email,
            subject: 'Leave Request Approved',
            html: this.generateApprovalEmailHtml(employee, leaveRequest),
            text: this.generateApprovalEmailText(employee, leaveRequest),
          });

          console.log('[LEAVE_SERVICE] Leave approval notification sent:', {
            requestId: leaveRequest.id,
            employeeEmail: employee.email,
            correlationId: cid,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (emailError) {
        console.error('[LEAVE_SERVICE] Failed to send approval notification:', {
          requestId: leaveRequest.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Leave request approved successfully:', {
        requestId: leaveRequest.id,
        approverId: leaveRequest.approvedBy,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: leaveRequest,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Leave approval failed:', {
        requestId: request.requestId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'APPROVE_REQUEST_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Reject leave request
   * 
   * Rejects a leave request with reason and sends email notification.
   * 
   * @param request - Leave rejection data
   * @param correlationId - Optional correlation ID for tracing
   * @returns Updated leave request
   */
  async rejectRequest(
    request: RejectLeaveRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveRequest>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `reject_leave_${Date.now()}`;

    console.log('[LEAVE_SERVICE] Rejecting leave request:', {
      requestId: request.requestId,
      approverId: request.approverId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.requestId || request.requestId.trim().length === 0) {
        validationErrors.push('Request ID is required');
      }

      if (!request.approverId || request.approverId.trim().length === 0) {
        validationErrors.push('Approver ID is required');
      }

      const reasonValidation = validateRejectionReason(request.rejectionReason);
      if (!reasonValidation.isValid) {
        validationErrors.push(...reasonValidation.errors);
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Reject request in transaction
      const leaveRequest = await executeTransaction<LeaveRequest>(
        async (client) => {
          // Fetch leave request
          const record = await client.query<LeaveRequestRecord>(
            'SELECT * FROM leave_requests WHERE id = $1',
            [request.requestId]
          );

          if (record.rows.length === 0) {
            throw new Error('Leave request not found');
          }

          const requestRecord = record.rows[0]!;

          // Validate status transition
          const transitionValidation = validateStatusTransition(
            requestRecord.status as LeaveStatus,
            LeaveStatus.Rejected
          );

          if (!transitionValidation.isValid) {
            throw new Error(transitionValidation.errors.join(', '));
          }

          // Verify approver is manager
          const isManager = await this.isManagerOfEmployee(
            request.approverId,
            requestRecord.employee_id,
            cid
          );

          if (!isManager) {
            throw new Error('Approver is not the employee\'s manager');
          }

          // Update leave request
          const updateResult = await client.query<LeaveRequestRecord>(
            `UPDATE leave_requests
             SET status = $1, approved_by = $2, approved_at = $3, 
                 rejection_reason = $4, updated_at = $5
             WHERE id = $6
             RETURNING *`,
            [
              LeaveStatus.Rejected,
              request.approverId,
              timestamp,
              request.rejectionReason.trim(),
              timestamp,
              request.requestId,
            ]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update leave request');
          }

          const updatedRecord = updateResult.rows[0]!;

          return {
            id: updatedRecord.id,
            employeeId: updatedRecord.employee_id,
            leaveType: updatedRecord.leave_type as LeaveType,
            startDate: updatedRecord.start_date,
            endDate: updatedRecord.end_date,
            daysCount: updatedRecord.days_count,
            reason: updatedRecord.reason,
            status: updatedRecord.status as LeaveStatus,
            approvedBy: updatedRecord.approved_by || undefined,
            approvedAt: updatedRecord.approved_at || undefined,
            rejectionReason: updatedRecord.rejection_reason || undefined,
            createdAt: updatedRecord.created_at,
            updatedAt: updatedRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'reject_leave_request',
        }
      );

      // Send email notification
      try {
        const employee = await queryOne<EmployeeRecord>(
          `SELECT e.id, u.first_name, u.last_name, u.email
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1`,
          [leaveRequest.employeeId],
          { correlationId: cid, operation: 'fetch_employee_for_notification' }
        );

        if (employee) {
          await this.emailService.sendEmail({
            to: employee.email,
            subject: 'Leave Request Rejected',
            html: this.generateRejectionEmailHtml(employee, leaveRequest),
            text: this.generateRejectionEmailText(employee, leaveRequest),
          });

          console.log('[LEAVE_SERVICE] Leave rejection notification sent:', {
            requestId: leaveRequest.id,
            employeeEmail: employee.email,
            correlationId: cid,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (emailError) {
        console.error('[LEAVE_SERVICE] Failed to send rejection notification:', {
          requestId: leaveRequest.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Leave request rejected successfully:', {
        requestId: leaveRequest.id,
        approverId: leaveRequest.approvedBy,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: leaveRequest,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Leave rejection failed:', {
        requestId: request.requestId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'REJECT_REQUEST_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get leave balance for employee
   * 
   * Retrieves leave balance summary for the authenticated employee.
   * 
   * @param employeeId - Employee identifier
   * @param year - Year for balance (defaults to current year)
   * @param correlationId - Optional correlation ID for tracing
   * @returns Leave balance summary
   */
  async getMyBalance(
    employeeId: string,
    year?: number,
    correlationId?: string
  ): Promise<ServiceOperationResult<LeaveBalanceSummary>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_balance_${Date.now()}`;
    const balanceYear = year || new Date().getFullYear();

    console.log('[LEAVE_SERVICE] Fetching leave balance:', {
      employeeId,
      year: balanceYear,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!employeeId || employeeId.trim().length === 0) {
        return {
          success: false,
          error: 'Employee ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch leave balance
      const record = await queryOne<LeaveBalanceRecord>(
        'SELECT * FROM leave_balances WHERE employee_id = $1 AND year = $2',
        [employeeId, balanceYear],
        { correlationId: cid, operation: 'fetch_leave_balance' }
      );

      if (!record) {
        console.warn('[LEAVE_SERVICE] Leave balance not found:', {
          employeeId,
          year: balanceYear,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Leave balance not found for the specified year',
          errorCode: 'BALANCE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Map to domain model
      const balance: LeaveBalance = {
        id: record.id,
        employeeId: record.employee_id,
        annualLeaveTotal: record.annual_leave_total,
        annualLeaveUsed: record.annual_leave_used,
        sickLeaveTotal: record.sick_leave_total,
        sickLeaveUsed: record.sick_leave_used,
        year: record.year,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };

      const summary = createBalanceSummary(balance);

      const executionTimeMs = Date.now() - startTime;

      console.log('[LEAVE_SERVICE] Leave balance fetched successfully:', {
        employeeId,
        year: balanceYear,
        annualRemaining: summary.annualLeave.remaining,
        sickRemaining: summary.sickLeave.remaining,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: summary,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Failed to fetch leave balance:', {
        employeeId,
        year: balanceYear,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_BALANCE_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Validate leave request
   * 
   * Validates leave request against business rules.
   * 
   * @param request - Leave request data
   * @param correlationId - Optional correlation ID for tracing
   * @returns Validation result
   */
  private async validateLeaveRequest(
    request: SubmitLeaveRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<boolean>> {
    const startTime = Date.now();
    const cid = correlationId || `validate_leave_${Date.now()}`;

    try {
      const validationErrors: string[] = [];

      // Validate dates
      const dateValidation = validateLeaveDates(request.startDate, request.endDate);
      if (!dateValidation.isValid) {
        validationErrors.push(...dateValidation.errors);
      }

      // Validate reason
      const reasonValidation = validateLeaveReason(request.reason);
      if (!reasonValidation.isValid) {
        validationErrors.push(...reasonValidation.errors);
      }

      // Validate leave type
      if (!Object.values(LeaveType).includes(request.leaveType)) {
        validationErrors.push('Invalid leave type');
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check for overlapping requests
      const hasOverlap = await this.checkOverlappingRequests(
        request.employeeId,
        request.startDate,
        request.endDate,
        cid
      );

      if (hasOverlap) {
        return {
          success: false,
          error: 'Leave request overlaps with existing approved request',
          errorCode: 'OVERLAPPING_REQUEST',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check leave balance (only for annual and sick leave)
      if (request.leaveType === LeaveType.Annual || request.leaveType === LeaveType.Sick) {
        const daysCount = calculateDaysBetween(request.startDate, request.endDate);
        const year = request.startDate.getFullYear();

        const balance = await queryOne<LeaveBalanceRecord>(
          'SELECT * FROM leave_balances WHERE employee_id = $1 AND year = $2',
          [request.employeeId, year],
          { correlationId: cid, operation: 'fetch_balance_for_validation' }
        );

        if (!balance) {
          return {
            success: false,
            error: `Leave balance not found for year ${year}`,
            errorCode: 'BALANCE_NOT_FOUND',
            executionTimeMs: Date.now() - startTime,
          };
        }

        const leaveBalance: LeaveBalance = {
          id: balance.id,
          employeeId: balance.employee_id,
          annualLeaveTotal: balance.annual_leave_total,
          annualLeaveUsed: balance.annual_leave_used,
          sickLeaveTotal: balance.sick_leave_total,
          sickLeaveUsed: balance.sick_leave_used,
          year: balance.year,
          createdAt: balance.created_at,
          updatedAt: balance.updated_at,
        };

        if (!hasSufficientBalance(leaveBalance, request.leaveType, daysCount)) {
          const remaining = calculateRemainingBalance(leaveBalance, request.leaveType);
          return {
            success: false,
            error: `Insufficient leave balance. Requested: ${daysCount} days, Available: ${remaining} days`,
            errorCode: 'INSUFFICIENT_BALANCE',
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      return {
        success: true,
        data: true,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LEAVE_SERVICE] Leave validation failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'VALIDATION_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Check for overlapping leave requests
   * 
   * Checks if employee has any approved leave requests that overlap with the requested dates.
   * 
   * @param employeeId - Employee identifier
   * @param startDate - Leave start date
   * @param endDate - Leave end date
   * @param correlationId - Optional correlation ID for tracing
   * @returns True if overlapping requests exist
   */
  private async checkOverlappingRequests(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    correlationId?: string
  ): Promise<boolean> {
    const cid = correlationId || `check_overlap_${Date.now()}`;

    try {
      const records = await queryMany<LeaveRequestRecord>(
        `SELECT * FROM leave_requests 
         WHERE employee_id = $1 
         AND status = $2
         AND (
           (start_date <= $3 AND end_date >= $3) OR
           (start_date <= $4 AND end_date >= $4) OR
           (start_date >= $3 AND end_date <= $4)
         )`,
        [employeeId, LeaveStatus.Approved, startDate, endDate],
        { correlationId: cid, operation: 'check_overlapping_requests' }
      );

      return records.length > 0;
    } catch (error) {
      console.error('[LEAVE_SERVICE] Failed to check overlapping requests:', {
        employeeId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Update leave balance
   * 
   * Updates leave balance after approval. Uses transaction client.
   * 
   * @param client - Database transaction client
   * @param employeeId - Employee identifier
   * @param leaveType - Type of leave
   * @param daysCount - Number of days to deduct
   * @param correlationId - Optional correlation ID for tracing
   */
  private async updateLeaveBalance(
    client: PoolClient,
    employeeId: string,
    leaveType: LeaveType,
    daysCount: number,
    correlationId?: string
  ): Promise<void> {
    const cid = correlationId || `update_balance_${Date.now()}`;

    try {
      // Only update balance for annual and sick leave
      if (leaveType !== LeaveType.Annual && leaveType !== LeaveType.Sick) {
        console.log('[LEAVE_SERVICE] Skipping balance update for leave type:', {
          leaveType,
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const year = new Date().getFullYear();
      const field = leaveType === LeaveType.Annual ? 'annual_leave_used' : 'sick_leave_used';

      const result = await client.query(
        `UPDATE leave_balances 
         SET ${field} = ${field} + $1, updated_at = $2
         WHERE employee_id = $3 AND year = $4
         RETURNING *`,
        [daysCount, new Date(), employeeId, year]
      );

      if (result.rows.length === 0) {
        throw new Error(`Leave balance not found for employee ${employeeId} and year ${year}`);
      }

      console.log('[LEAVE_SERVICE] Leave balance updated:', {
        employeeId,
        leaveType,
        daysCount,
        year,
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[LEAVE_SERVICE] Failed to update leave balance:', {
        employeeId,
        leaveType,
        daysCount,
        error: error instanceof Error ? error.message : String(error),
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Check if user is manager of employee
   * 
   * Verifies manager-employee relationship.
   * 
   * @param managerId - Manager employee identifier
   * @param employeeId - Employee identifier
   * @param correlationId - Optional correlation ID for tracing
   * @returns True if manager relationship exists
   */
  private async isManagerOfEmployee(
    managerId: string,
    employeeId: string,
    correlationId?: string
  ): Promise<boolean> {
    const cid = correlationId || `check_manager_${Date.now()}`;

    try {
      const employee = await queryOne<{ manager_id: string | null }>(
        'SELECT manager_id FROM employees WHERE id = $1',
        [employeeId],
        { correlationId: cid, operation: 'check_manager_relationship' }
      );

      return employee?.manager_id === managerId;
    } catch (error) {
      console.error('[LEAVE_SERVICE] Failed to check manager relationship:', {
        managerId,
        employeeId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Generate leave request email HTML
   */
  private generateLeaveRequestEmailHtml(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
      <h2>New Leave Request</h2>
      <p><strong>${employee.first_name} ${employee.last_name}</strong> has submitted a leave request.</p>
      <ul>
        <li><strong>Leave Type:</strong> ${request.leaveType}</li>
        <li><strong>Start Date:</strong> ${request.startDate.toLocaleDateString()}</li>
        <li><strong>End Date:</strong> ${request.endDate.toLocaleDateString()}</li>
        <li><strong>Days:</strong> ${request.daysCount}</li>
        <li><strong>Reason:</strong> ${request.reason}</li>
      </ul>
      <p>Please review and approve or reject this request.</p>
    `;
  }

  /**
   * Generate leave request email text
   */
  private generateLeaveRequestEmailText(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
New Leave Request

${employee.first_name} ${employee.last_name} has submitted a leave request.

Leave Type: ${request.leaveType}
Start Date: ${request.startDate.toLocaleDateString()}
End Date: ${request.endDate.toLocaleDateString()}
Days: ${request.daysCount}
Reason: ${request.reason}

Please review and approve or reject this request.
    `;
  }

  /**
   * Generate approval email HTML
   */
  private generateApprovalEmailHtml(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
      <h2>Leave Request Approved</h2>
      <p>Your leave request has been approved.</p>
      <ul>
        <li><strong>Leave Type:</strong> ${request.leaveType}</li>
        <li><strong>Start Date:</strong> ${request.startDate.toLocaleDateString()}</li>
        <li><strong>End Date:</strong> ${request.endDate.toLocaleDateString()}</li>
        <li><strong>Days:</strong> ${request.daysCount}</li>
      </ul>
    `;
  }

  /**
   * Generate approval email text
   */
  private generateApprovalEmailText(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
Leave Request Approved

Your leave request has been approved.

Leave Type: ${request.leaveType}
Start Date: ${request.startDate.toLocaleDateString()}
End Date: ${request.endDate.toLocaleDateString()}
Days: ${request.daysCount}
    `;
  }

  /**
   * Generate rejection email HTML
   */
  private generateRejectionEmailHtml(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
      <h2>Leave Request Rejected</h2>
      <p>Your leave request has been rejected.</p>
      <ul>
        <li><strong>Leave Type:</strong> ${request.leaveType}</li>
        <li><strong>Start Date:</strong> ${request.startDate.toLocaleDateString()}</li>
        <li><strong>End Date:</strong> ${request.endDate.toLocaleDateString()}</li>
        <li><strong>Days:</strong> ${request.daysCount}</li>
        <li><strong>Rejection Reason:</strong> ${request.rejectionReason}</li>
      </ul>
    `;
  }

  /**
   * Generate rejection email text
   */
  private generateRejectionEmailText(employee: EmployeeRecord, request: LeaveRequest): string {
    return `
Leave Request Rejected

Your leave request has been rejected.

Leave Type: ${request.leaveType}
Start Date: ${request.startDate.toLocaleDateString()}
End Date: ${request.endDate.toLocaleDateString()}
Days: ${request.daysCount}
Rejection Reason: ${request.rejectionReason}
    `;
  }
}