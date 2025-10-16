/**
 * Appraisal Service Module
 * 
 * Provides comprehensive business logic for performance appraisal management.
 * Implements appraisal cycle creation, self-assessment submission, manager reviews,
 * goal management, and status tracking with proper authorization and validation.
 * 
 * @module services/appraisal
 */

import crypto from 'crypto';

import { executeQuery, executeTransaction, queryMany, queryOne } from '../db/index.js';
import type { PoolClient } from 'pg';
import {
  AppraisalStatus,
  GoalStatus,
  validateManagerFeedback,
  validateRating,
  validateReviewPeriod,
  validateSelfAssessment,
  validateStatusTransition,
  type Appraisal,
  type AppraisalSummary,
  type CreateAppraisalRequest,
  type Goal,
  type SubmitManagerReviewRequest,
  type SubmitSelfAssessmentRequest,
  type UpdateGoalsRequest,
} from '../types/appraisal.js';
import { emailService } from './email.service.js';

/**
 * Database record types for appraisals
 */
interface AppraisalRecord {
  readonly id: string;
  readonly employee_id: string;
  readonly reviewer_id: string;
  readonly review_period_start: Date;
  readonly review_period_end: Date;
  readonly self_assessment: string | null;
  readonly manager_feedback: string | null;
  readonly rating: number | null;
  readonly goals: any;
  readonly status: string;
  readonly self_assessment_submitted_at: Date | null;
  readonly review_completed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Employee record for authorization checks
 */
interface EmployeeRecord {
  readonly id: string;
  readonly user_id: string;
  readonly manager_id: string | null;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly job_title: string | null;
}

/**
 * Service operation result
 */
interface ServiceOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: string;
  readonly executionTimeMs: number;
}

/**
 * Appraisal Service Class
 * 
 * Manages all appraisal-related business logic including cycle creation,
 * self-assessments, manager reviews, goal tracking, and status management.
 */
export class AppraisalService {
  /**
   * Create a new appraisal cycle
   * 
   * Initiates a performance appraisal cycle for an employee. Validates that
   * the reviewer is the employee's manager and that the review period is valid.
   * Sends email notification to the employee.
   * 
   * @param {CreateAppraisalRequest} request - Appraisal creation data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<Appraisal>>} Created appraisal
   * 
   * @example
   * const result = await appraisalService.createAppraisal({
   *   employeeId: 'emp-123',
   *   reviewerId: 'mgr-456',
   *   reviewPeriodStart: new Date('2024-01-01'),
   *   reviewPeriodEnd: new Date('2024-12-31'),
   *   goals: [{ title: 'Complete project X', ... }]
   * });
   */
  async createAppraisal(
    request: CreateAppraisalRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<Appraisal>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `create_appraisal_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Creating appraisal cycle:', {
      employeeId: request.employeeId,
      reviewerId: request.reviewerId,
      reviewPeriodStart: request.reviewPeriodStart,
      reviewPeriodEnd: request.reviewPeriodEnd,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.employeeId || request.employeeId.trim().length === 0) {
        validationErrors.push('Employee ID is required');
      }

      if (!request.reviewerId || request.reviewerId.trim().length === 0) {
        validationErrors.push('Reviewer ID is required');
      }

      if (!request.reviewPeriodStart || !(request.reviewPeriodStart instanceof Date)) {
        validationErrors.push('Review period start date is required');
      }

      if (!request.reviewPeriodEnd || !(request.reviewPeriodEnd instanceof Date)) {
        validationErrors.push('Review period end date is required');
      }

      // Validate review period
      if (request.reviewPeriodStart && request.reviewPeriodEnd) {
        const periodValidation = validateReviewPeriod(
          request.reviewPeriodStart,
          request.reviewPeriodEnd
        );
        if (!periodValidation.isValid) {
          validationErrors.push(...periodValidation.errors);
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_SERVICE] Appraisal creation validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Validate manager-employee relationship
      const relationshipValid = await this.validateManagerEmployeeRelationship(
        request.reviewerId,
        request.employeeId,
        cid
      );

      if (!relationshipValid.success) {
        console.warn('[APPRAISAL_SERVICE] Manager-employee relationship validation failed:', {
          employeeId: request.employeeId,
          reviewerId: request.reviewerId,
          error: relationshipValid.error,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: relationshipValid.error || 'Invalid manager-employee relationship',
          errorCode: 'UNAUTHORIZED',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch employee details for email notification
      const employee = await queryOne<EmployeeRecord>(
        `SELECT e.id, e.user_id, e.manager_id, u.first_name, u.last_name, u.email, e.job_title
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [request.employeeId],
        { correlationId: cid, operation: 'fetch_employee' }
      );

      if (!employee) {
        console.warn('[APPRAISAL_SERVICE] Employee not found:', {
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

      // Fetch reviewer details
      const reviewer = await queryOne<EmployeeRecord>(
        `SELECT e.id, e.user_id, u.first_name, u.last_name, u.email
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [request.reviewerId],
        { correlationId: cid, operation: 'fetch_reviewer' }
      );

      if (!reviewer) {
        console.warn('[APPRAISAL_SERVICE] Reviewer not found:', {
          reviewerId: request.reviewerId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Reviewer not found',
          errorCode: 'REVIEWER_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Create appraisal in transaction
      const appraisal = await executeTransaction<Appraisal>(
        async (client) => {
          const appraisalId = crypto.randomUUID();

          // Prepare goals with IDs and timestamps
          const goals: Goal[] = (request.goals || []).map(goal => ({
            id: crypto.randomUUID(),
            title: goal.title,
            description: goal.description,
            targetDate: goal.targetDate,
            status: goal.status,
            notes: goal.notes,
            createdAt: timestamp,
            updatedAt: timestamp,
          }));

          // Insert appraisal
          const result = await client.query<AppraisalRecord>(
            `INSERT INTO appraisals (
              id, employee_id, reviewer_id, review_period_start, review_period_end,
              self_assessment, manager_feedback, rating, goals, status,
              self_assessment_submitted_at, review_completed_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            [
              appraisalId,
              request.employeeId,
              request.reviewerId,
              request.reviewPeriodStart,
              request.reviewPeriodEnd,
              null, // self_assessment
              null, // manager_feedback
              null, // rating
              JSON.stringify(goals),
              AppraisalStatus.Draft,
              null, // self_assessment_submitted_at
              null, // review_completed_at
              timestamp,
              timestamp,
            ]
          );

          if (result.rows.length === 0) {
            throw new Error('Failed to create appraisal record');
          }

          const record = result.rows[0]!;

          return {
            id: record.id,
            employeeId: record.employee_id,
            reviewerId: record.reviewer_id,
            reviewPeriodStart: record.review_period_start,
            reviewPeriodEnd: record.review_period_end,
            selfAssessment: record.self_assessment || undefined,
            managerFeedback: record.manager_feedback || undefined,
            rating: record.rating || undefined,
            goals: JSON.parse(record.goals),
            status: record.status as AppraisalStatus,
            selfAssessmentSubmittedAt: record.self_assessment_submitted_at || undefined,
            reviewCompletedAt: record.review_completed_at || undefined,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'create_appraisal',
        }
      );

      // Send email notification to employee
      try {
        await emailService.sendAppraisalCycleNotification({
          employeeEmail: employee.email,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          managerName: `${reviewer.first_name} ${reviewer.last_name}`,
          reviewPeriodStart: request.reviewPeriodStart.toISOString(),
          reviewPeriodEnd: request.reviewPeriodEnd.toISOString(),
          appraisalId: appraisal.id,
        });

        console.log('[APPRAISAL_SERVICE] Appraisal cycle notification sent:', {
          appraisalId: appraisal.id,
          employeeEmail: employee.email,
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      } catch (emailError) {
        console.error('[APPRAISAL_SERVICE] Failed to send appraisal cycle notification:', {
          appraisalId: appraisal.id,
          employeeEmail: employee.email,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Appraisal created successfully:', {
        appraisalId: appraisal.id,
        employeeId: appraisal.employeeId,
        reviewerId: appraisal.reviewerId,
        goalCount: appraisal.goals.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: appraisal,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Appraisal creation failed:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'APPRAISAL_CREATION_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get appraisal by ID
   * 
   * Retrieves a single appraisal with authorization check. Employees can only
   * view their own appraisals, managers can view appraisals for their team,
   * and HR admins can view all appraisals.
   * 
   * @param {string} appraisalId - Appraisal identifier
   * @param {string} userId - User requesting the appraisal
   * @param {string} userRole - Role of the requesting user
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<Appraisal>>} Appraisal data
   */
  async getAppraisal(
    appraisalId: string,
    userId: string,
    userRole: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<Appraisal>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_appraisal_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Fetching appraisal:', {
      appraisalId,
      userId,
      userRole,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!appraisalId || appraisalId.trim().length === 0) {
        return {
          success: false,
          error: 'Appraisal ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch appraisal
      const record = await queryOne<AppraisalRecord>(
        'SELECT * FROM appraisals WHERE id = $1',
        [appraisalId],
        { correlationId: cid, operation: 'fetch_appraisal' }
      );

      if (!record) {
        console.warn('[APPRAISAL_SERVICE] Appraisal not found:', {
          appraisalId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Appraisal not found',
          errorCode: 'APPRAISAL_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Authorization check
      if (userRole !== 'HR_ADMIN') {
        // Get employee ID for the user
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

        // Check if user is the employee or the reviewer
        const isEmployee = record.employee_id === employee.id;
        const isReviewer = record.reviewer_id === employee.id;

        if (!isEmployee && !isReviewer) {
          console.warn('[APPRAISAL_SERVICE] Unauthorized appraisal access:', {
            appraisalId,
            userId,
            employeeId: employee.id,
            correlationId: cid,
            timestamp: timestamp.toISOString(),
          });

          return {
            success: false,
            error: 'Unauthorized to access this appraisal',
            errorCode: 'UNAUTHORIZED',
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      // Map to domain model
      const appraisal: Appraisal = {
        id: record.id,
        employeeId: record.employee_id,
        reviewerId: record.reviewer_id,
        reviewPeriodStart: record.review_period_start,
        reviewPeriodEnd: record.review_period_end,
        selfAssessment: record.self_assessment || undefined,
        managerFeedback: record.manager_feedback || undefined,
        rating: record.rating || undefined,
        goals: JSON.parse(record.goals),
        status: record.status as AppraisalStatus,
        selfAssessmentSubmittedAt: record.self_assessment_submitted_at || undefined,
        reviewCompletedAt: record.review_completed_at || undefined,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Appraisal fetched successfully:', {
        appraisalId: appraisal.id,
        status: appraisal.status,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: appraisal,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Failed to fetch appraisal:', {
        appraisalId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_APPRAISAL_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get appraisals for authenticated employee
   * 
   * Retrieves all appraisals for the authenticated employee.
   * 
   * @param {string} userId - User identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<AppraisalSummary[]>>} Employee appraisals
   */
  async getMyAppraisals(
    userId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<AppraisalSummary[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_my_appraisals_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Fetching employee appraisals:', {
      userId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!userId || userId.trim().length === 0) {
        return {
          success: false,
          error: 'User ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Get employee ID
      const employee = await queryOne<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [userId],
        { correlationId: cid, operation: 'fetch_employee_id' }
      );

      if (!employee) {
        return {
          success: false,
          error: 'Employee record not found',
          errorCode: 'EMPLOYEE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch appraisals with employee and reviewer details
      const records = await queryMany<AppraisalRecord & {
        employee_first_name: string;
        employee_last_name: string;
        employee_email: string;
        employee_job_title: string | null;
        reviewer_first_name: string;
        reviewer_last_name: string;
        reviewer_email: string;
      }>(
        `SELECT a.*,
                eu.first_name as employee_first_name,
                eu.last_name as employee_last_name,
                eu.email as employee_email,
                e.job_title as employee_job_title,
                ru.first_name as reviewer_first_name,
                ru.last_name as reviewer_last_name,
                ru.email as reviewer_email
         FROM appraisals a
         JOIN employees e ON a.employee_id = e.id
         JOIN users eu ON e.user_id = eu.id
         JOIN employees r ON a.reviewer_id = r.id
         JOIN users ru ON r.user_id = ru.id
         WHERE a.employee_id = $1
         ORDER BY a.created_at DESC`,
        [employee.id],
        { correlationId: cid, operation: 'fetch_employee_appraisals' }
      );

      // Map to summary format
      const summaries: AppraisalSummary[] = records.map(record => {
        const goals: Goal[] = JSON.parse(record.goals);
        const achievedGoalCount = goals.filter(g => g.status === GoalStatus.Achieved).length;

        return {
          id: record.id,
          employee: {
            id: record.employee_id,
            firstName: record.employee_first_name,
            lastName: record.employee_last_name,
            email: record.employee_email,
            jobTitle: record.employee_job_title || undefined,
          },
          reviewer: {
            id: record.reviewer_id,
            firstName: record.reviewer_first_name,
            lastName: record.reviewer_last_name,
            email: record.reviewer_email,
          },
          reviewPeriod: {
            start: record.review_period_start,
            end: record.review_period_end,
          },
          status: record.status as AppraisalStatus,
          rating: record.rating || undefined,
          goalCount: goals.length,
          achievedGoalCount,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Employee appraisals fetched successfully:', {
        userId,
        employeeId: employee.id,
        count: summaries.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: summaries,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Failed to fetch employee appraisals:', {
        userId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_APPRAISALS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get appraisals for manager's team
   * 
   * Retrieves all appraisals for employees reporting to the manager.
   * 
   * @param {string} userId - Manager user identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<AppraisalSummary[]>>} Team appraisals
   */
  async getTeamAppraisals(
    userId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<AppraisalSummary[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_team_appraisals_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Fetching team appraisals:', {
      userId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!userId || userId.trim().length === 0) {
        return {
          success: false,
          error: 'User ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Get manager employee ID
      const manager = await queryOne<{ id: string }>(
        'SELECT id FROM employees WHERE user_id = $1',
        [userId],
        { correlationId: cid, operation: 'fetch_manager_id' }
      );

      if (!manager) {
        return {
          success: false,
          error: 'Manager record not found',
          errorCode: 'MANAGER_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch appraisals for team members
      const records = await queryMany<AppraisalRecord & {
        employee_first_name: string;
        employee_last_name: string;
        employee_email: string;
        employee_job_title: string | null;
        reviewer_first_name: string;
        reviewer_last_name: string;
        reviewer_email: string;
      }>(
        `SELECT a.*,
                eu.first_name as employee_first_name,
                eu.last_name as employee_last_name,
                eu.email as employee_email,
                e.job_title as employee_job_title,
                ru.first_name as reviewer_first_name,
                ru.last_name as reviewer_last_name,
                ru.email as reviewer_email
         FROM appraisals a
         JOIN employees e ON a.employee_id = e.id
         JOIN users eu ON e.user_id = eu.id
         JOIN employees r ON a.reviewer_id = r.id
         JOIN users ru ON r.user_id = ru.id
         WHERE a.reviewer_id = $1
         ORDER BY a.created_at DESC`,
        [manager.id],
        { correlationId: cid, operation: 'fetch_team_appraisals' }
      );

      // Map to summary format
      const summaries: AppraisalSummary[] = records.map(record => {
        const goals: Goal[] = JSON.parse(record.goals);
        const achievedGoalCount = goals.filter(g => g.status === GoalStatus.Achieved).length;

        return {
          id: record.id,
          employee: {
            id: record.employee_id,
            firstName: record.employee_first_name,
            lastName: record.employee_last_name,
            email: record.employee_email,
            jobTitle: record.employee_job_title || undefined,
          },
          reviewer: {
            id: record.reviewer_id,
            firstName: record.reviewer_first_name,
            lastName: record.reviewer_last_name,
            email: record.reviewer_email,
          },
          reviewPeriod: {
            start: record.review_period_start,
            end: record.review_period_end,
          },
          status: record.status as AppraisalStatus,
          rating: record.rating || undefined,
          goalCount: goals.length,
          achievedGoalCount,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Team appraisals fetched successfully:', {
        userId,
        managerId: manager.id,
        count: summaries.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: summaries,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Failed to fetch team appraisals:', {
        userId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_TEAM_APPRAISALS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get all appraisals (HR Admin only)
   * 
   * Retrieves all appraisals in the system with pagination support.
   * 
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Items per page
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<{ appraisals: AppraisalSummary[]; total: number }>>} All appraisals
   */
  async getAllAppraisals(
    page: number,
    limit: number,
    correlationId?: string
  ): Promise<ServiceOperationResult<{ appraisals: AppraisalSummary[]; total: number }>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_all_appraisals_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Fetching all appraisals:', {
      page,
      limit,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate pagination parameters
      if (page < 1) {
        return {
          success: false,
          error: 'Page must be at least 1',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (limit < 1 || limit > 100) {
        return {
          success: false,
          error: 'Limit must be between 1 and 100',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM appraisals',
        [],
        { correlationId: cid, operation: 'count_appraisals' }
      );

      const total = parseInt(countResult?.count || '0', 10);

      // Fetch appraisals with pagination
      const records = await queryMany<AppraisalRecord & {
        employee_first_name: string;
        employee_last_name: string;
        employee_email: string;
        employee_job_title: string | null;
        reviewer_first_name: string;
        reviewer_last_name: string;
        reviewer_email: string;
      }>(
        `SELECT a.*,
                eu.first_name as employee_first_name,
                eu.last_name as employee_last_name,
                eu.email as employee_email,
                e.job_title as employee_job_title,
                ru.first_name as reviewer_first_name,
                ru.last_name as reviewer_last_name,
                ru.email as reviewer_email
         FROM appraisals a
         JOIN employees e ON a.employee_id = e.id
         JOIN users eu ON e.user_id = eu.id
         JOIN employees r ON a.reviewer_id = r.id
         JOIN users ru ON r.user_id = ru.id
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
        { correlationId: cid, operation: 'fetch_all_appraisals' }
      );

      // Map to summary format
      const summaries: AppraisalSummary[] = records.map(record => {
        const goals: Goal[] = JSON.parse(record.goals);
        const achievedGoalCount = goals.filter(g => g.status === GoalStatus.Achieved).length;

        return {
          id: record.id,
          employee: {
            id: record.employee_id,
            firstName: record.employee_first_name,
            lastName: record.employee_last_name,
            email: record.employee_email,
            jobTitle: record.employee_job_title || undefined,
          },
          reviewer: {
            id: record.reviewer_id,
            firstName: record.reviewer_first_name,
            lastName: record.reviewer_last_name,
            email: record.reviewer_email,
          },
          reviewPeriod: {
            start: record.review_period_start,
            end: record.review_period_end,
          },
          status: record.status as AppraisalStatus,
          rating: record.rating || undefined,
          goalCount: goals.length,
          achievedGoalCount,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] All appraisals fetched successfully:', {
        page,
        limit,
        total,
        count: summaries.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: {
          appraisals: summaries,
          total,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Failed to fetch all appraisals:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_ALL_APPRAISALS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Submit self-assessment
   * 
   * Allows employee to submit their self-assessment and update goal statuses.
   * Transitions appraisal status from DRAFT to SUBMITTED.
   * 
   * @param {SubmitSelfAssessmentRequest} request - Self-assessment data
   * @param {string} userId - User submitting the assessment
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<Appraisal>>} Updated appraisal
   */
  async submitSelfAssessment(
    request: SubmitSelfAssessmentRequest,
    userId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<Appraisal>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `submit_self_assessment_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Submitting self-assessment:', {
      appraisalId: request.appraisalId,
      userId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.appraisalId || request.appraisalId.trim().length === 0) {
        validationErrors.push('Appraisal ID is required');
      }

      if (!request.selfAssessment || request.selfAssessment.trim().length === 0) {
        validationErrors.push('Self-assessment is required');
      }

      // Validate self-assessment text
      if (request.selfAssessment) {
        const assessmentValidation = validateSelfAssessment(request.selfAssessment);
        if (!assessmentValidation.isValid) {
          validationErrors.push(...assessmentValidation.errors);
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_SERVICE] Self-assessment validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Update appraisal in transaction
      const appraisal = await executeTransaction<Appraisal>(
        async (client) => {
          // Fetch appraisal
          const record = await client.query<AppraisalRecord>(
            'SELECT * FROM appraisals WHERE id = $1',
            [request.appraisalId]
          );

          if (record.rows.length === 0) {
            throw new Error('Appraisal not found');
          }

          const appraisalRecord = record.rows[0]!;

          // Get employee ID for authorization
          const employee = await client.query<{ id: string }>(
            'SELECT id FROM employees WHERE user_id = $1',
            [userId]
          );

          if (employee.rows.length === 0) {
            throw new Error('Employee record not found');
          }

          const employeeId = employee.rows[0]!.id;

          // Authorization check
          if (appraisalRecord.employee_id !== employeeId) {
            throw new Error('Unauthorized to submit self-assessment for this appraisal');
          }

          // Validate status transition
          const transitionValidation = validateStatusTransition(
            appraisalRecord.status as AppraisalStatus,
            AppraisalStatus.Submitted
          );

          if (!transitionValidation.isValid) {
            throw new Error(transitionValidation.errors.join(', '));
          }

          // Update goals if provided
          let goals: Goal[] = JSON.parse(appraisalRecord.goals);

          if (request.goalUpdates && request.goalUpdates.length > 0) {
            goals = goals.map(goal => {
              const update = request.goalUpdates?.find(u => u.goalId === goal.id);
              if (update) {
                return {
                  ...goal,
                  status: update.status,
                  notes: update.notes || goal.notes,
                  updatedAt: timestamp,
                };
              }
              return goal;
            });
          }

          // Update appraisal
          const updateResult = await client.query<AppraisalRecord>(
            `UPDATE appraisals
             SET self_assessment = $1,
                 goals = $2,
                 status = $3,
                 self_assessment_submitted_at = $4,
                 updated_at = $5
             WHERE id = $6
             RETURNING *`,
            [
              request.selfAssessment.trim(),
              JSON.stringify(goals),
              AppraisalStatus.Submitted,
              timestamp,
              timestamp,
              request.appraisalId,
            ]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update appraisal');
          }

          const updatedRecord = updateResult.rows[0]!;

          return {
            id: updatedRecord.id,
            employeeId: updatedRecord.employee_id,
            reviewerId: updatedRecord.reviewer_id,
            reviewPeriodStart: updatedRecord.review_period_start,
            reviewPeriodEnd: updatedRecord.review_period_end,
            selfAssessment: updatedRecord.self_assessment || undefined,
            managerFeedback: updatedRecord.manager_feedback || undefined,
            rating: updatedRecord.rating || undefined,
            goals: JSON.parse(updatedRecord.goals),
            status: updatedRecord.status as AppraisalStatus,
            selfAssessmentSubmittedAt: updatedRecord.self_assessment_submitted_at || undefined,
            reviewCompletedAt: updatedRecord.review_completed_at || undefined,
            createdAt: updatedRecord.created_at,
            updatedAt: updatedRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'submit_self_assessment',
        }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Self-assessment submitted successfully:', {
        appraisalId: appraisal.id,
        status: appraisal.status,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: appraisal,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Self-assessment submission failed:', {
        appraisalId: request.appraisalId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'SUBMIT_SELF_ASSESSMENT_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Submit manager review
   * 
   * Allows manager to submit feedback and rating for an employee.
   * Transitions appraisal status from SUBMITTED to COMPLETED.
   * Sends email notification to employee.
   * 
   * @param {SubmitManagerReviewRequest} request - Manager review data
   * @param {string} userId - User submitting the review
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<Appraisal>>} Updated appraisal
   */
  async submitReview(
    request: SubmitManagerReviewRequest,
    userId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<Appraisal>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `submit_review_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Submitting manager review:', {
      appraisalId: request.appraisalId,
      userId,
      rating: request.rating,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.appraisalId || request.appraisalId.trim().length === 0) {
        validationErrors.push('Appraisal ID is required');
      }

      if (!request.managerFeedback || request.managerFeedback.trim().length === 0) {
        validationErrors.push('Manager feedback is required');
      }

      if (request.rating === undefined || request.rating === null) {
        validationErrors.push('Rating is required');
      }

      // Validate manager feedback
      if (request.managerFeedback) {
        const feedbackValidation = validateManagerFeedback(request.managerFeedback);
        if (!feedbackValidation.isValid) {
          validationErrors.push(...feedbackValidation.errors);
        }
      }

      // Validate rating
      if (request.rating !== undefined && request.rating !== null) {
        const ratingValidation = validateRating(request.rating);
        if (!ratingValidation.isValid) {
          validationErrors.push(...ratingValidation.errors);
        }
      }

      if (validationErrors.length > 0) {
        console.warn('[APPRAISAL_SERVICE] Manager review validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Update appraisal in transaction
      const appraisal = await executeTransaction<Appraisal>(
        async (client) => {
          // Fetch appraisal
          const record = await client.query<AppraisalRecord>(
            'SELECT * FROM appraisals WHERE id = $1',
            [request.appraisalId]
          );

          if (record.rows.length === 0) {
            throw new Error('Appraisal not found');
          }

          const appraisalRecord = record.rows[0]!;

          // Get manager employee ID for authorization
          const manager = await client.query<{ id: string }>(
            'SELECT id FROM employees WHERE user_id = $1',
            [userId]
          );

          if (manager.rows.length === 0) {
            throw new Error('Manager record not found');
          }

          const managerId = manager.rows[0]!.id;

          // Authorization check
          if (appraisalRecord.reviewer_id !== managerId) {
            throw new Error('Unauthorized to submit review for this appraisal');
          }

          // Validate status transition
          const transitionValidation = validateStatusTransition(
            appraisalRecord.status as AppraisalStatus,
            AppraisalStatus.Completed
          );

          if (!transitionValidation.isValid) {
            throw new Error(transitionValidation.errors.join(', '));
          }

          // Update goals if provided
          let goals: Goal[] = JSON.parse(appraisalRecord.goals);

          if (request.goalUpdates && request.goalUpdates.length > 0) {
            goals = goals.map(goal => {
              const update = request.goalUpdates?.find(u => u.goalId === goal.id);
              if (update) {
                return {
                  ...goal,
                  status: update.status,
                  notes: update.notes || goal.notes,
                  updatedAt: timestamp,
                };
              }
              return goal;
            });
          }

          // Update appraisal
          const updateResult = await client.query<AppraisalRecord>(
            `UPDATE appraisals
             SET manager_feedback = $1,
                 rating = $2,
                 goals = $3,
                 status = $4,
                 review_completed_at = $5,
                 updated_at = $6
             WHERE id = $7
             RETURNING *`,
            [
              request.managerFeedback.trim(),
              request.rating,
              JSON.stringify(goals),
              AppraisalStatus.Completed,
              timestamp,
              timestamp,
              request.appraisalId,
            ]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update appraisal');
          }

          const updatedRecord = updateResult.rows[0]!;

          return {
            id: updatedRecord.id,
            employeeId: updatedRecord.employee_id,
            reviewerId: updatedRecord.reviewer_id,
            reviewPeriodStart: updatedRecord.review_period_start,
            reviewPeriodEnd: updatedRecord.review_period_end,
            selfAssessment: updatedRecord.self_assessment || undefined,
            managerFeedback: updatedRecord.manager_feedback || undefined,
            rating: updatedRecord.rating || undefined,
            goals: JSON.parse(updatedRecord.goals),
            status: updatedRecord.status as AppraisalStatus,
            selfAssessmentSubmittedAt: updatedRecord.self_assessment_submitted_at || undefined,
            reviewCompletedAt: updatedRecord.review_completed_at || undefined,
            createdAt: updatedRecord.created_at,
            updatedAt: updatedRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'submit_manager_review',
        }
      );

      // Send email notification to employee
      try {
        const employee = await queryOne<EmployeeRecord>(
          `SELECT e.id, e.user_id, u.first_name, u.last_name, u.email
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1`,
          [appraisal.employeeId],
          { correlationId: cid, operation: 'fetch_employee_for_notification' }
        );

        const reviewer = await queryOne<EmployeeRecord>(
          `SELECT e.id, e.user_id, u.first_name, u.last_name, u.email
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1`,
          [appraisal.reviewerId],
          { correlationId: cid, operation: 'fetch_reviewer_for_notification' }
        );

        if (employee && reviewer) {
          await emailService.sendReviewCompletedNotification({
            employeeEmail: employee.email,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            managerName: `${reviewer.first_name} ${reviewer.last_name}`,
            rating: appraisal.rating!,
            reviewPeriodStart: appraisal.reviewPeriodStart.toISOString(),
            reviewPeriodEnd: appraisal.reviewPeriodEnd.toISOString(),
            appraisalId: appraisal.id,
          });

          console.log('[APPRAISAL_SERVICE] Review completed notification sent:', {
            appraisalId: appraisal.id,
            employeeEmail: employee.email,
            correlationId: cid,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (emailError) {
        console.error('[APPRAISAL_SERVICE] Failed to send review completed notification:', {
          appraisalId: appraisal.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Manager review submitted successfully:', {
        appraisalId: appraisal.id,
        rating: appraisal.rating,
        status: appraisal.status,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: appraisal,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Manager review submission failed:', {
        appraisalId: request.appraisalId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'SUBMIT_REVIEW_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Update goals for an appraisal
   * 
   * Allows adding, updating, or removing goals from an appraisal.
   * Only available while appraisal is in DRAFT status.
   * 
   * @param {UpdateGoalsRequest} request - Goals update data
   * @param {string} userId - User updating the goals
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<Appraisal>>} Updated appraisal
   */
  async updateGoals(
    request: UpdateGoalsRequest,
    userId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<Appraisal>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `update_goals_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Updating appraisal goals:', {
      appraisalId: request.appraisalId,
      userId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      if (!request.appraisalId || request.appraisalId.trim().length === 0) {
        return {
          success: false,
          error: 'Appraisal ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Update goals in transaction
      const appraisal = await executeTransaction<Appraisal>(
        async (client) => {
          // Fetch appraisal
          const record = await client.query<AppraisalRecord>(
            'SELECT * FROM appraisals WHERE id = $1',
            [request.appraisalId]
          );

          if (record.rows.length === 0) {
            throw new Error('Appraisal not found');
          }

          const appraisalRecord = record.rows[0]!;

          // Get employee ID for authorization
          const employee = await client.query<{ id: string }>(
            'SELECT id FROM employees WHERE user_id = $1',
            [userId]
          );

          if (employee.rows.length === 0) {
            throw new Error('Employee record not found');
          }

          const employeeId = employee.rows[0]!.id;

          // Authorization check (only reviewer can update goals)
          if (appraisalRecord.reviewer_id !== employeeId) {
            throw new Error('Unauthorized to update goals for this appraisal');
          }

          // Only allow updates in DRAFT status
          if (appraisalRecord.status !== AppraisalStatus.Draft) {
            throw new Error('Goals can only be updated while appraisal is in DRAFT status');
          }

          // Parse existing goals
          let goals: Goal[] = JSON.parse(appraisalRecord.goals);

          // Remove goals
          if (request.goalsToRemove && request.goalsToRemove.length > 0) {
            goals = goals.filter(g => !request.goalsToRemove?.includes(g.id));
          }

          // Update goals
          if (request.goalsToUpdate && request.goalsToUpdate.length > 0) {
            goals = goals.map(goal => {
              const update = request.goalsToUpdate?.find(u => u.goalId === goal.id);
              if (update) {
                return {
                  ...goal,
                  title: update.title || goal.title,
                  description: update.description || goal.description,
                  targetDate: update.targetDate || goal.targetDate,
                  status: update.status || goal.status,
                  notes: update.notes !== undefined ? update.notes : goal.notes,
                  updatedAt: timestamp,
                };
              }
              return goal;
            });
          }

          // Add new goals
          if (request.goalsToAdd && request.goalsToAdd.length > 0) {
            const newGoals: Goal[] = request.goalsToAdd.map(goal => ({
              id: crypto.randomUUID(),
              title: goal.title,
              description: goal.description,
              targetDate: goal.targetDate,
              status: goal.status,
              notes: goal.notes,
              createdAt: timestamp,
              updatedAt: timestamp,
            }));
            goals = [...goals, ...newGoals];
          }

          // Update appraisal
          const updateResult = await client.query<AppraisalRecord>(
            `UPDATE appraisals
             SET goals = $1,
                 updated_at = $2
             WHERE id = $3
             RETURNING *`,
            [JSON.stringify(goals), timestamp, request.appraisalId]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update appraisal');
          }

          const updatedRecord = updateResult.rows[0]!;

          return {
            id: updatedRecord.id,
            employeeId: updatedRecord.employee_id,
            reviewerId: updatedRecord.reviewer_id,
            reviewPeriodStart: updatedRecord.review_period_start,
            reviewPeriodEnd: updatedRecord.review_period_end,
            selfAssessment: updatedRecord.self_assessment || undefined,
            managerFeedback: updatedRecord.manager_feedback || undefined,
            rating: updatedRecord.rating || undefined,
            goals: JSON.parse(updatedRecord.goals),
            status: updatedRecord.status as AppraisalStatus,
            selfAssessmentSubmittedAt: updatedRecord.self_assessment_submitted_at || undefined,
            reviewCompletedAt: updatedRecord.review_completed_at || undefined,
            createdAt: updatedRecord.created_at,
            updatedAt: updatedRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'update_goals',
        }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[APPRAISAL_SERVICE] Goals updated successfully:', {
        appraisalId: appraisal.id,
        goalCount: appraisal.goals.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: appraisal,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Goals update failed:', {
        appraisalId: request.appraisalId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'UPDATE_GOALS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Validate manager-employee relationship
   * 
   * Checks if the reviewer is the employee's manager.
   * 
   * @param {string} reviewerId - Reviewer employee ID
   * @param {string} employeeId - Employee ID
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<boolean>>} Validation result
   */
  async validateManagerEmployeeRelationship(
    reviewerId: string,
    employeeId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<boolean>> {
    const startTime = Date.now();
    const cid = correlationId || `validate_relationship_${Date.now()}`;

    console.log('[APPRAISAL_SERVICE] Validating manager-employee relationship:', {
      reviewerId,
      employeeId,
      correlationId: cid,
      timestamp: new Date().toISOString(),
    });

    try {
      // Fetch employee with manager relationship
      const employee = await queryOne<{ id: string; manager_id: string | null }>(
        'SELECT id, manager_id FROM employees WHERE id = $1',
        [employeeId],
        { correlationId: cid, operation: 'fetch_employee_manager' }
      );

      if (!employee) {
        return {
          success: false,
          error: 'Employee not found',
          errorCode: 'EMPLOYEE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if reviewer is the employee's manager
      const isManager = employee.manager_id === reviewerId;

      const executionTimeMs = Date.now() - startTime;

      if (!isManager) {
        console.warn('[APPRAISAL_SERVICE] Manager-employee relationship validation failed:', {
          reviewerId,
          employeeId,
          actualManagerId: employee.manager_id,
          executionTimeMs,
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          error: 'Reviewer is not the employee\'s manager',
          errorCode: 'INVALID_MANAGER',
          executionTimeMs,
        };
      }

      console.log('[APPRAISAL_SERVICE] Manager-employee relationship validated:', {
        reviewerId,
        employeeId,
        executionTimeMs,
        correlationId: cid,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        data: true,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[APPRAISAL_SERVICE] Manager-employee relationship validation failed:', {
        reviewerId,
        employeeId,
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
}

/**
 * Singleton appraisal service instance
 */
export const appraisalService = new AppraisalService();

/**
 * Default export: appraisal service singleton
 */
export default appraisalService;