/**
 * Onboarding Service Module
 * 
 * Provides comprehensive business logic for employee onboarding workflow management.
 * Implements template creation, workflow assignment, task tracking, and progress monitoring
 * with full transaction support, error handling, and structured logging.
 * 
 * @module services/onboarding
 */

import crypto from 'crypto';

import { executeQuery, executeTransaction, queryOne, queryMany } from '../db/index.js';
import type { PoolClient } from 'pg';

import { emailService } from './email.service.js';
import type {
  TaskCompletionNotificationData,
  WorkflowAssignmentNotificationData,
} from './email.service.js';

import {
  TaskStatus,
  WorkflowStatus,
  type OnboardingTemplate,
  type OnboardingWorkflow,
  type OnboardingTask,
  type CreateTemplateRequest,
  type AssignWorkflowRequest,
  type TeamProgressSummary,
  type UpdateTaskRequest,
} from '../types/onboarding.js';

/**
 * Database record types for internal use
 */
interface TemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly is_active: boolean;
  readonly created_by: string;
  readonly department_id: string | null;
  readonly estimated_days: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface TaskRecord {
  readonly id: string;
  readonly template_id: string | null;
  readonly workflow_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly due_date: Date;
  readonly status: string;
  readonly document_url: string | null;
  readonly order_number: number;
  readonly requires_document: boolean;
  readonly completed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface WorkflowRecord {
  readonly id: string;
  readonly employee_id: string;
  readonly template_id: string;
  readonly status: string;
  readonly progress: number;
  readonly assigned_by: string;
  readonly assigned_at: Date;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly target_completion_date: Date;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface EmployeeRecord {
  readonly id: string;
  readonly user_id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly job_title: string;
  readonly department_id: string;
  readonly manager_id: string | null;
}

interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly first_name: string;
  readonly last_name: string;
}

/**
 * Service operation result type
 */
interface ServiceOperationResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: string;
  readonly executionTimeMs: number;
}

/**
 * Onboarding Service Class
 * 
 * Handles all business logic for onboarding workflow management including
 * template creation, workflow assignment, task tracking, and progress monitoring.
 */
export class OnboardingService {
  /**
   * Create a new onboarding template with tasks
   * 
   * Creates a template that can be reused for multiple employees.
   * All tasks are created within a transaction to ensure data consistency.
   * 
   * @param {CreateTemplateRequest} request - Template creation data
   * @param {string} createdBy - User ID of the creator (HR admin)
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTemplate>>} Created template
   * 
   * @example
   * const result = await onboardingService.createTemplate({
   *   name: 'Software Engineer Onboarding',
   *   description: 'Standard onboarding for engineering team',
   *   tasks: [
   *     { title: 'Complete I-9', description: '...', daysUntilDue: 1, order: 1, requiresDocument: true }
   *   ],
   *   estimatedDays: 30
   * }, userId);
   */
  async createTemplate(
    request: CreateTemplateRequest,
    createdBy: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTemplate>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `create_template_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Creating onboarding template:', {
      name: request.name,
      taskCount: request.tasks.length,
      createdBy,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.name || request.name.trim().length === 0) {
        validationErrors.push('Template name is required');
      } else if (request.name.length > 200) {
        validationErrors.push('Template name must not exceed 200 characters');
      }

      if (!request.description || request.description.trim().length === 0) {
        validationErrors.push('Template description is required');
      } else if (request.description.length > 2000) {
        validationErrors.push('Template description must not exceed 2000 characters');
      }

      if (!request.tasks || request.tasks.length === 0) {
        validationErrors.push('At least one task is required');
      } else {
        request.tasks.forEach((task, index) => {
          if (!task.title || task.title.trim().length === 0) {
            validationErrors.push(`Task ${index + 1}: Title is required`);
          } else if (task.title.length > 200) {
            validationErrors.push(`Task ${index + 1}: Title must not exceed 200 characters`);
          }

          if (!task.description || task.description.trim().length === 0) {
            validationErrors.push(`Task ${index + 1}: Description is required`);
          } else if (task.description.length > 2000) {
            validationErrors.push(`Task ${index + 1}: Description must not exceed 2000 characters`);
          }

          if (typeof task.daysUntilDue !== 'number' || task.daysUntilDue < 0) {
            validationErrors.push(`Task ${index + 1}: Days until due must be a non-negative number`);
          }

          if (typeof task.order !== 'number' || task.order < 1) {
            validationErrors.push(`Task ${index + 1}: Order must be a positive number`);
          }

          if (typeof task.requiresDocument !== 'boolean') {
            validationErrors.push(`Task ${index + 1}: Requires document must be a boolean`);
          }
        });
      }

      if (typeof request.estimatedDays !== 'number' || request.estimatedDays < 1) {
        validationErrors.push('Estimated days must be a positive number');
      }

      if (validationErrors.length > 0) {
        const executionTimeMs = Date.now() - startTime;

        console.warn('[ONBOARDING_SERVICE] Template creation validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          executionTimeMs,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs,
        };
      }

      // Create template and tasks in transaction
      const template = await executeTransaction<OnboardingTemplate>(
        async (client) => {
          const templateId = crypto.randomUUID();

          // Insert template
          await client.query(
            `INSERT INTO onboarding_templates (
              id, name, description, is_active, created_by, 
              department_id, estimated_days, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              templateId,
              request.name.trim(),
              request.description.trim(),
              true,
              createdBy,
              request.departmentId || null,
              request.estimatedDays,
              timestamp,
              timestamp,
            ]
          );

          // Insert tasks
          const tasks: OnboardingTask[] = [];
          for (const taskData of request.tasks) {
            const taskId = crypto.randomUUID();
            const dueDate = new Date(timestamp.getTime() + taskData.daysUntilDue * 24 * 60 * 60 * 1000);

            await client.query(
              `INSERT INTO onboarding_tasks (
                id, template_id, workflow_id, title, description, 
                due_date, status, document_url, order_number, 
                requires_document, completed_at, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                taskId,
                templateId,
                null,
                taskData.title.trim(),
                taskData.description.trim(),
                dueDate,
                TaskStatus.Pending,
                null,
                taskData.order,
                taskData.requiresDocument,
                null,
                timestamp,
                timestamp,
              ]
            );

            tasks.push({
              id: taskId,
              title: taskData.title.trim(),
              description: taskData.description.trim(),
              dueDate,
              status: TaskStatus.Pending,
              documentUrl: undefined,
              order: taskData.order,
              requiresDocument: taskData.requiresDocument,
              completedAt: undefined,
            });
          }

          return {
            id: templateId,
            name: request.name.trim(),
            description: request.description.trim(),
            tasks,
            isActive: true,
            createdBy,
            departmentId: request.departmentId,
            estimatedDays: request.estimatedDays,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
        },
        {
          correlationId: cid,
          operation: 'create_template',
        }
      );

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Template created successfully:', {
        templateId: template.id,
        name: template.name,
        taskCount: template.tasks.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: template,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Template creation failed:', {
        name: request.name,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'CREATE_TEMPLATE_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get all onboarding templates
   * 
   * Retrieves all templates with their associated tasks.
   * Optionally filters by active status or department.
   * 
   * @param {object} [options] - Query options
   * @param {boolean} [options.activeOnly] - Only return active templates
   * @param {string} [options.departmentId] - Filter by department
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTemplate[]>>} List of templates
   */
  async getTemplates(
    options?: {
      readonly activeOnly?: boolean;
      readonly departmentId?: string;
    },
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTemplate[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_templates_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching templates:', {
      activeOnly: options?.activeOnly ?? false,
      departmentId: options?.departmentId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Build query
      let query = 'SELECT * FROM onboarding_templates WHERE 1=1';
      const params: unknown[] = [];
      let paramIndex = 1;

      if (options?.activeOnly) {
        query += ` AND is_active = $${paramIndex++}`;
        params.push(true);
      }

      if (options?.departmentId) {
        query += ` AND department_id = $${paramIndex++}`;
        params.push(options.departmentId);
      }

      query += ' ORDER BY created_at DESC';

      // Fetch templates
      const templateRecords = await queryMany<TemplateRecord>(
        query,
        params,
        { correlationId: cid, operation: 'fetch_templates' }
      );

      // Fetch tasks for all templates
      const templates: OnboardingTemplate[] = [];
      for (const record of templateRecords) {
        const taskRecords = await queryMany<TaskRecord>(
          'SELECT * FROM onboarding_tasks WHERE template_id = $1 ORDER BY order_number',
          [record.id],
          { correlationId: cid, operation: 'fetch_template_tasks' }
        );

        const tasks: OnboardingTask[] = taskRecords.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: new Date(task.due_date),
          status: task.status as TaskStatus,
          documentUrl: task.document_url || undefined,
          order: task.order_number,
          requiresDocument: task.requires_document,
          completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
        }));

        templates.push({
          id: record.id,
          name: record.name,
          description: record.description,
          tasks,
          isActive: record.is_active,
          createdBy: record.created_by,
          departmentId: record.department_id || undefined,
          estimatedDays: record.estimated_days,
          createdAt: new Date(record.created_at),
          updatedAt: new Date(record.updated_at),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Templates fetched successfully:', {
        count: templates.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: templates,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Failed to fetch templates:', {
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_TEMPLATES_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Assign onboarding workflow to employee
   * 
   * Creates a workflow instance from a template and assigns it to an employee.
   * Copies all tasks from the template and calculates due dates.
   * Sends email notification to the employee.
   * 
   * @param {AssignWorkflowRequest} request - Workflow assignment data
   * @param {string} assignedBy - User ID of the assigner (HR admin)
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingWorkflow>>} Created workflow
   */
  async assignWorkflow(
    request: AssignWorkflowRequest,
    assignedBy: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingWorkflow>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `assign_workflow_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Assigning workflow:', {
      employeeId: request.employeeId,
      templateId: request.templateId,
      assignedBy,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      if (!request.employeeId || request.employeeId.trim().length === 0) {
        return {
          success: false,
          error: 'Employee ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (!request.templateId || request.templateId.trim().length === 0) {
        return {
          success: false,
          error: 'Template ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if employee exists
      const employee = await queryOne<EmployeeRecord>(
        `SELECT e.*, u.email, u.first_name, u.last_name 
         FROM employees e 
         JOIN users u ON e.user_id = u.id 
         WHERE e.id = $1`,
        [request.employeeId],
        { correlationId: cid, operation: 'fetch_employee' }
      );

      if (!employee) {
        return {
          success: false,
          error: 'Employee not found',
          errorCode: 'EMPLOYEE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if template exists
      const template = await queryOne<TemplateRecord>(
        'SELECT * FROM onboarding_templates WHERE id = $1 AND is_active = true',
        [request.templateId],
        { correlationId: cid, operation: 'fetch_template' }
      );

      if (!template) {
        return {
          success: false,
          error: 'Template not found or inactive',
          errorCode: 'TEMPLATE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if employee already has an active workflow
      const existingWorkflow = await queryOne<WorkflowRecord>(
        'SELECT * FROM onboarding_workflows WHERE employee_id = $1 AND status != $2',
        [request.employeeId, WorkflowStatus.Completed],
        { correlationId: cid, operation: 'check_existing_workflow' }
      );

      if (existingWorkflow) {
        return {
          success: false,
          error: 'Employee already has an active onboarding workflow',
          errorCode: 'WORKFLOW_EXISTS',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch template tasks
      const templateTasks = await queryMany<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE template_id = $1 ORDER BY order_number',
        [request.templateId],
        { correlationId: cid, operation: 'fetch_template_tasks' }
      );

      // Calculate target completion date
      const targetCompletionDate = request.targetCompletionDate
        ? new Date(request.targetCompletionDate)
        : new Date(timestamp.getTime() + template.estimated_days * 24 * 60 * 60 * 1000);

      // Create workflow and tasks in transaction
      const workflow = await executeTransaction<OnboardingWorkflow>(
        async (client) => {
          const workflowId = crypto.randomUUID();

          // Insert workflow
          await client.query(
            `INSERT INTO onboarding_workflows (
              id, employee_id, template_id, status, progress, 
              assigned_by, assigned_at, started_at, completed_at, 
              target_completion_date, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              workflowId,
              request.employeeId,
              request.templateId,
              WorkflowStatus.NotStarted,
              0,
              assignedBy,
              timestamp,
              null,
              null,
              targetCompletionDate,
              timestamp,
              timestamp,
            ]
          );

          // Copy tasks from template
          const tasks: OnboardingTask[] = [];
          for (const templateTask of templateTasks) {
            const taskId = crypto.randomUUID();

            // Check for task overrides
            const override = request.taskOverrides?.find(o => o.order === templateTask.order_number);
            
            // Calculate due date
            let dueDate: Date;
            if (override?.dueDate) {
              dueDate = new Date(override.dueDate);
            } else {
              // Calculate based on template task's due date offset
              const templateDueDate = new Date(templateTask.due_date);
              const templateCreatedAt = new Date(template.created_at);
              const daysOffset = Math.floor(
                (templateDueDate.getTime() - templateCreatedAt.getTime()) / (24 * 60 * 60 * 1000)
              );
              dueDate = new Date(timestamp.getTime() + daysOffset * 24 * 60 * 60 * 1000);
            }

            const title = override?.title || templateTask.title;
            const description = override?.description || templateTask.description;

            await client.query(
              `INSERT INTO onboarding_tasks (
                id, template_id, workflow_id, title, description, 
                due_date, status, document_url, order_number, 
                requires_document, completed_at, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                taskId,
                null,
                workflowId,
                title,
                description,
                dueDate,
                TaskStatus.Pending,
                null,
                templateTask.order_number,
                templateTask.requires_document,
                null,
                timestamp,
                timestamp,
              ]
            );

            tasks.push({
              id: taskId,
              title,
              description,
              dueDate,
              status: TaskStatus.Pending,
              documentUrl: undefined,
              order: templateTask.order_number,
              requiresDocument: templateTask.requires_document,
              completedAt: undefined,
            });
          }

          return {
            id: workflowId,
            employeeId: request.employeeId,
            templateId: request.templateId,
            status: WorkflowStatus.NotStarted,
            progress: 0,
            tasks,
            assignedBy,
            assignedAt: timestamp,
            startedAt: undefined,
            completedAt: undefined,
            targetCompletionDate,
            completedTaskCount: 0,
            totalTaskCount: tasks.length,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
        },
        {
          correlationId: cid,
          operation: 'assign_workflow',
        }
      );

      // Send email notification to employee
      try {
        const notificationData: WorkflowAssignmentNotificationData = {
          employeeEmail: employee.email,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          workflowName: template.name,
          taskCount: workflow.tasks.length,
          workflowId: workflow.id,
          assignedAt: timestamp,
          dueDate: targetCompletionDate,
        };

        await emailService.sendWorkflowAssignmentNotification(notificationData, cid);
      } catch (emailError) {
        // Log email error but don't fail the workflow assignment
        console.error('[ONBOARDING_SERVICE] Failed to send workflow assignment email:', {
          workflowId: workflow.id,
          employeeEmail: employee.email,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Workflow assigned successfully:', {
        workflowId: workflow.id,
        employeeId: request.employeeId,
        templateId: request.templateId,
        taskCount: workflow.tasks.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: workflow,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Workflow assignment failed:', {
        employeeId: request.employeeId,
        templateId: request.templateId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'ASSIGN_WORKFLOW_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get workflow for specific employee
   * 
   * Retrieves the active or most recent workflow for an employee.
   * 
   * @param {string} employeeId - Employee identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingWorkflow | null>>} Employee workflow
   */
  async getEmployeeWorkflow(
    employeeId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingWorkflow | null>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_employee_workflow_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching employee workflow:', {
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

      // Fetch workflow
      const workflowRecord = await queryOne<WorkflowRecord>(
        `SELECT * FROM onboarding_workflows 
         WHERE employee_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [employeeId],
        { correlationId: cid, operation: 'fetch_employee_workflow' }
      );

      if (!workflowRecord) {
        const executionTimeMs = Date.now() - startTime;

        console.log('[ONBOARDING_SERVICE] No workflow found for employee:', {
          employeeId,
          executionTimeMs,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: true,
          data: null,
          executionTimeMs,
        };
      }

      // Fetch tasks
      const taskRecords = await queryMany<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE workflow_id = $1 ORDER BY order_number',
        [workflowRecord.id],
        { correlationId: cid, operation: 'fetch_workflow_tasks' }
      );

      const tasks: OnboardingTask[] = taskRecords.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: new Date(task.due_date),
        status: task.status as TaskStatus,
        documentUrl: task.document_url || undefined,
        order: task.order_number,
        requiresDocument: task.requires_document,
        completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
      }));

      const completedTaskCount = tasks.filter(t => t.status === TaskStatus.Completed).length;
      const progress = tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0;

      const workflow: OnboardingWorkflow = {
        id: workflowRecord.id,
        employeeId: workflowRecord.employee_id,
        templateId: workflowRecord.template_id,
        status: workflowRecord.status as WorkflowStatus,
        progress,
        tasks,
        assignedBy: workflowRecord.assigned_by,
        assignedAt: new Date(workflowRecord.assigned_at),
        startedAt: workflowRecord.started_at ? new Date(workflowRecord.started_at) : undefined,
        completedAt: workflowRecord.completed_at ? new Date(workflowRecord.completed_at) : undefined,
        targetCompletionDate: new Date(workflowRecord.target_completion_date),
        completedTaskCount,
        totalTaskCount: tasks.length,
        createdAt: new Date(workflowRecord.created_at),
        updatedAt: new Date(workflowRecord.updated_at),
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Employee workflow fetched successfully:', {
        workflowId: workflow.id,
        employeeId,
        status: workflow.status,
        progress: workflow.progress,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: workflow,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Failed to fetch employee workflow:', {
        employeeId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_WORKFLOW_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get tasks for authenticated employee
   * 
   * Retrieves all tasks for the employee's active workflow.
   * 
   * @param {string} employeeId - Employee identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTask[]>>} Employee tasks
   */
  async getMyTasks(
    employeeId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTask[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_my_tasks_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching employee tasks:', {
      employeeId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      const workflowResult = await this.getEmployeeWorkflow(employeeId, cid);

      if (!workflowResult.success) {
        return {
          success: false,
          error: workflowResult.error,
          errorCode: workflowResult.errorCode,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const tasks = workflowResult.data?.tasks || [];
      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Employee tasks fetched successfully:', {
        employeeId,
        taskCount: tasks.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: tasks,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Failed to fetch employee tasks:', {
        employeeId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_TASKS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Update task status and mark as complete
   * 
   * Marks a task as complete, updates document URL if provided,
   * recalculates workflow progress, and sends email notification to HR admin.
   * 
   * @param {string} taskId - Task identifier
   * @param {string} employeeId - Employee identifier (for authorization)
   * @param {string} [documentUrl] - Optional document URL
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTask>>} Updated task
   */
  async updateTaskStatus(
    taskId: string,
    employeeId: string,
    documentUrl?: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTask>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `update_task_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Updating task status:', {
      taskId,
      employeeId,
      hasDocument: !!documentUrl,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      if (!taskId || taskId.trim().length === 0) {
        return {
          success: false,
          error: 'Task ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (!employeeId || employeeId.trim().length === 0) {
        return {
          success: false,
          error: 'Employee ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch task
      const task = await queryOne<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE id = $1',
        [taskId],
        { correlationId: cid, operation: 'fetch_task' }
      );

      if (!task) {
        return {
          success: false,
          error: 'Task not found',
          errorCode: 'TASK_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      if (!task.workflow_id) {
        return {
          success: false,
          error: 'Task is not associated with a workflow',
          errorCode: 'INVALID_TASK',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Verify task belongs to employee's workflow
      const workflow = await queryOne<WorkflowRecord>(
        'SELECT * FROM onboarding_workflows WHERE id = $1 AND employee_id = $2',
        [task.workflow_id, employeeId],
        { correlationId: cid, operation: 'verify_workflow_ownership' }
      );

      if (!workflow) {
        return {
          success: false,
          error: 'Unauthorized: Task does not belong to employee',
          errorCode: 'UNAUTHORIZED',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Check if task is already completed
      if (task.status === TaskStatus.Completed) {
        return {
          success: false,
          error: 'Task is already completed',
          errorCode: 'TASK_ALREADY_COMPLETED',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Validate document requirement
      if (task.requires_document && !documentUrl) {
        return {
          success: false,
          error: 'Document upload is required for this task',
          errorCode: 'DOCUMENT_REQUIRED',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Update task and workflow in transaction
      const updatedTask = await executeTransaction<OnboardingTask>(
        async (client) => {
          // Update task
          await client.query(
            `UPDATE onboarding_tasks 
             SET status = $1, document_url = $2, completed_at = $3, updated_at = $4 
             WHERE id = $5`,
            [TaskStatus.Completed, documentUrl || null, timestamp, timestamp, taskId]
          );

          // Calculate new progress
          const allTasks = await client.query<TaskRecord>(
            'SELECT * FROM onboarding_tasks WHERE workflow_id = $1',
            [task.workflow_id]
          );

          const completedCount = allTasks.rows.filter(
            t => t.status === TaskStatus.Completed || t.id === taskId
          ).length;
          const totalCount = allTasks.rows.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          // Determine new workflow status
          let newStatus = workflow.status;
          let startedAt = workflow.started_at;
          let completedAt = workflow.completed_at;

          if (workflow.status === WorkflowStatus.NotStarted) {
            newStatus = WorkflowStatus.InProgress;
            startedAt = timestamp;
          }

          if (progress === 100) {
            newStatus = WorkflowStatus.Completed;
            completedAt = timestamp;
          }

          // Update workflow
          await client.query(
            `UPDATE onboarding_workflows 
             SET status = $1, progress = $2, started_at = $3, completed_at = $4, updated_at = $5 
             WHERE id = $6`,
            [newStatus, progress, startedAt, completedAt, timestamp, task.workflow_id]
          );

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            dueDate: new Date(task.due_date),
            status: TaskStatus.Completed,
            documentUrl: documentUrl || undefined,
            order: task.order_number,
            requiresDocument: task.requires_document,
            completedAt: timestamp,
          };
        },
        {
          correlationId: cid,
          operation: 'update_task_status',
        }
      );

      // Send email notification to HR admin
      try {
        // Fetch employee details
        const employee = await queryOne<EmployeeRecord>(
          `SELECT e.*, u.email, u.first_name, u.last_name 
           FROM employees e 
           JOIN users u ON e.user_id = u.id 
           WHERE e.id = $1`,
          [employeeId],
          { correlationId: cid, operation: 'fetch_employee_for_notification' }
        );

        // Fetch HR admin details
        const hrAdmin = await queryOne<UserRecord>(
          'SELECT * FROM users WHERE id = $1',
          [workflow.assigned_by],
          { correlationId: cid, operation: 'fetch_hr_admin' }
        );

        if (employee && hrAdmin) {
          const notificationData: TaskCompletionNotificationData = {
            hrAdminEmail: hrAdmin.email,
            hrAdminName: `${hrAdmin.first_name} ${hrAdmin.last_name}`,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            employeeEmail: employee.email,
            taskTitle: task.title,
            taskId: task.id,
            completedAt: timestamp,
            documentInfo: documentUrl
              ? {
                  fileName: documentUrl.split('/').pop() || 'document',
                  fileSize: 0, // Size not available here
                }
              : undefined,
          };

          await emailService.sendTaskCompletionNotification(notificationData, cid);
        }
      } catch (emailError) {
        // Log email error but don't fail the task update
        console.error('[ONBOARDING_SERVICE] Failed to send task completion email:', {
          taskId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Task status updated successfully:', {
        taskId,
        employeeId,
        status: TaskStatus.Completed,
        hasDocument: !!documentUrl,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: updatedTask,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Failed to update task status:', {
        taskId,
        employeeId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'UPDATE_TASK_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get onboarding progress for manager's team
   * 
   * Retrieves progress information for all team members with active workflows.
   * 
   * @param {string} managerId - Manager identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<TeamProgressSummary>>} Team progress summary
   */
  async getTeamProgress(
    managerId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<TeamProgressSummary>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_team_progress_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching team progress:', {
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

      // Fetch team members with workflows
      const teamWorkflows = await queryMany<WorkflowRecord & EmployeeRecord>(
        `SELECT w.*, e.id as employee_id, u.first_name, u.last_name 
         FROM onboarding_workflows w
         JOIN employees e ON w.employee_id = e.id
         JOIN users u ON e.user_id = u.id
         WHERE e.manager_id = $1
         ORDER BY w.created_at DESC`,
        [managerId],
        { correlationId: cid, operation: 'fetch_team_workflows' }
      );

      const employees: TeamProgressSummary['employees'] = [];
      let notStartedCount = 0;
      let inProgressCount = 0;
      let completedCount = 0;
      let totalProgress = 0;

      for (const record of teamWorkflows) {
        // Fetch tasks for progress calculation
        const tasks = await queryMany<TaskRecord>(
          'SELECT * FROM onboarding_tasks WHERE workflow_id = $1',
          [record.id],
          { correlationId: cid, operation: 'fetch_workflow_tasks_for_progress' }
        );

        const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).length;
        const totalTasks = tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const targetDate = new Date(record.target_completion_date);
        const daysRemaining = Math.ceil((targetDate.getTime() - timestamp.getTime()) / (24 * 60 * 60 * 1000));
        const isOverdue = daysRemaining < 0;

        employees.push({
          employeeId: record.employee_id,
          employeeName: `${record.first_name} ${record.last_name}`,
          workflowId: record.id,
          status: record.status as WorkflowStatus,
          progress,
          completedTasks,
          totalTasks,
          targetCompletionDate: targetDate,
          isOverdue,
          daysRemaining,
        });

        // Update counts
        if (record.status === WorkflowStatus.NotStarted) {
          notStartedCount++;
        } else if (record.status === WorkflowStatus.InProgress) {
          inProgressCount++;
        } else if (record.status === WorkflowStatus.Completed) {
          completedCount++;
        }

        totalProgress += progress;
      }

      const averageProgress = employees.length > 0 ? Math.round(totalProgress / employees.length) : 0;

      const summary: TeamProgressSummary = {
        managerId,
        totalEmployees: employees.length,
        notStartedCount,
        inProgressCount,
        completedCount,
        averageProgress,
        employees,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Team progress fetched successfully:', {
        managerId,
        totalEmployees: summary.totalEmployees,
        averageProgress: summary.averageProgress,
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

      console.error('[ONBOARDING_SERVICE] Failed to fetch team progress:', {
        managerId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'FETCH_TEAM_PROGRESS_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Calculate workflow progress percentage
   * 
   * Calculates the completion percentage based on completed tasks.
   * 
   * @param {string} workflowId - Workflow identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<number>>} Progress percentage (0-100)
   */
  async calculateProgress(
    workflowId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<number>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `calculate_progress_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Calculating workflow progress:', {
      workflowId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      if (!workflowId || workflowId.trim().length === 0) {
        return {
          success: false,
          error: 'Workflow ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch tasks
      const tasks = await queryMany<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE workflow_id = $1',
        [workflowId],
        { correlationId: cid, operation: 'fetch_tasks_for_progress' }
      );

      if (tasks.length === 0) {
        return {
          success: true,
          data: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const completedCount = tasks.filter(t => t.status === TaskStatus.Completed).length;
      const progress = Math.round((completedCount / tasks.length) * 100);

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Progress calculated successfully:', {
        workflowId,
        completedCount,
        totalCount: tasks.length,
        progress,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: progress,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Failed to calculate progress:', {
        workflowId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'CALCULATE_PROGRESS_ERROR',
        executionTimeMs,
      };
    }
  }
}

/**
 * Singleton onboarding service instance
 */
export const onboardingService = new OnboardingService();

/**
 * Export default instance
 */
export default onboardingService;