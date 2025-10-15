/**
 * Onboarding Service Module
 * 
 * Provides business logic for employee onboarding workflow management.
 * Handles template creation, workflow assignment, task tracking, and progress monitoring.
 * Implements comprehensive error handling, transaction management, and logging.
 * 
 * @module services/onboarding
 */

import crypto from 'crypto';

import { executeQuery, executeTransaction, queryMany, queryOne } from '../db/index.js';
import { emailService } from './email.service.js';
import type {
  OnboardingTask,
  OnboardingTemplate,
  OnboardingTemplateTask,
  OnboardingWorkflow,
  TaskStatus,
  TemplateCreationRequest,
  WorkflowAssignmentRequest,
  WorkflowProgressSummary,
  WorkflowStatus,
} from '../types/onboarding.js';

/**
 * Database record for onboarding template
 */
interface TemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly is_active: boolean;
  readonly created_by: string;
  readonly department_id: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record for template task
 */
interface TemplateTaskRecord {
  readonly id: string;
  readonly template_id: string;
  readonly title: string;
  readonly description: string;
  readonly days_until_due: number;
  readonly order_number: number;
  readonly requires_document: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record for onboarding workflow
 */
interface WorkflowRecord {
  readonly id: string;
  readonly employee_id: string;
  readonly template_id: string;
  readonly status: WorkflowStatus;
  readonly progress: number;
  readonly start_date: Date;
  readonly expected_completion_date: Date;
  readonly actual_completion_date: Date | null;
  readonly assigned_by: string;
  readonly manager_id: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record for onboarding task
 */
interface TaskRecord {
  readonly id: string;
  readonly workflow_id: string;
  readonly employee_id: string;
  readonly title: string;
  readonly description: string;
  readonly due_date: Date;
  readonly status: TaskStatus;
  readonly document_url: string | null;
  readonly completed_at: Date | null;
  readonly order_number: number;
  readonly requires_document: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/**
 * Database record for employee
 */
interface EmployeeRecord {
  readonly id: string;
  readonly user_id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly manager_id: string | null;
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
 * Onboarding Service Class
 * 
 * Implements business logic for onboarding workflow management.
 * Provides methods for template management, workflow assignment, and progress tracking.
 */
export class OnboardingService {
  /**
   * Create onboarding template with tasks
   * 
   * Creates a new onboarding template with associated task definitions.
   * Uses database transaction to ensure data consistency.
   * 
   * @param {TemplateCreationRequest} request - Template creation data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTemplate>>} Created template
   * 
   * @example
   * const result = await onboardingService.createTemplate({
   *   name: 'New Hire Onboarding',
   *   description: 'Standard onboarding for new employees',
   *   tasks: [
   *     { title: 'Complete I-9 Form', description: '...', daysUntilDue: 1, order: 1, requiresDocument: true }
   *   ],
   *   createdBy: 'hr-admin-id'
   * });
   */
  async createTemplate(
    request: TemplateCreationRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTemplate>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `create_template_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Creating onboarding template:', {
      name: request.name,
      taskCount: request.tasks.length,
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

          if (task.daysUntilDue < 0) {
            validationErrors.push(`Task ${index + 1}: Days until due must be non-negative`);
          }

          if (task.order < 0) {
            validationErrors.push(`Task ${index + 1}: Order must be non-negative`);
          }
        });
      }

      if (!request.createdBy || request.createdBy.trim().length === 0) {
        validationErrors.push('Created by user ID is required');
      }

      if (validationErrors.length > 0) {
        console.warn('[ONBOARDING_SERVICE] Template creation validation failed:', {
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

      // Create template and tasks in transaction
      const template = await executeTransaction<OnboardingTemplate>(
        async (client) => {
          const templateId = crypto.randomUUID();

          // Insert template
          const templateResult = await client.query<TemplateRecord>(
            `INSERT INTO onboarding_templates (
              id, name, description, is_active, created_by, department_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              templateId,
              request.name.trim(),
              request.description.trim(),
              true,
              request.createdBy,
              request.departmentId || null,
              timestamp,
              timestamp,
            ]
          );

          if (templateResult.rows.length === 0) {
            throw new Error('Failed to create template record');
          }

          const templateRecord = templateResult.rows[0]!;

          // Insert tasks
          const taskRecords: TemplateTaskRecord[] = [];
          for (const task of request.tasks) {
            const taskId = crypto.randomUUID();
            const taskResult = await client.query<TemplateTaskRecord>(
              `INSERT INTO onboarding_template_tasks (
                id, template_id, title, description, days_until_due, order_number, 
                requires_document, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING *`,
              [
                taskId,
                templateId,
                task.title.trim(),
                task.description.trim(),
                task.daysUntilDue,
                task.order,
                task.requiresDocument,
                timestamp,
                timestamp,
              ]
            );

            if (taskResult.rows.length === 0) {
              throw new Error(`Failed to create task: ${task.title}`);
            }

            taskRecords.push(taskResult.rows[0]!);
          }

          // Map to domain model
          const templateTasks: OnboardingTemplateTask[] = taskRecords.map(record => ({
            title: record.title,
            description: record.description,
            daysUntilDue: record.days_until_due,
            order: record.order_number,
            requiresDocument: record.requires_document,
          }));

          return {
            id: templateRecord.id,
            name: templateRecord.name,
            description: templateRecord.description,
            tasks: templateTasks,
            isActive: templateRecord.is_active,
            createdBy: templateRecord.created_by,
            departmentId: templateRecord.department_id || undefined,
            createdAt: templateRecord.created_at,
            updatedAt: templateRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'create_onboarding_template',
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
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'TEMPLATE_CREATION_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get all onboarding templates
   * 
   * Retrieves all active onboarding templates with their task definitions.
   * 
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTemplate[]>>} List of templates
   * 
   * @example
   * const result = await onboardingService.getTemplates();
   */
  async getTemplates(
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingTemplate[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_templates_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching onboarding templates:', {
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Fetch templates
      const templates = await queryMany<TemplateRecord>(
        `SELECT * FROM onboarding_templates 
         WHERE is_active = true 
         ORDER BY created_at DESC`,
        [],
        { correlationId: cid, operation: 'fetch_templates' }
      );

      // Fetch tasks for all templates
      const templateIds = templates.map(t => t.id);
      const tasks = templateIds.length > 0
        ? await queryMany<TemplateTaskRecord>(
            `SELECT * FROM onboarding_template_tasks 
             WHERE template_id = ANY($1) 
             ORDER BY order_number ASC`,
            [templateIds],
            { correlationId: cid, operation: 'fetch_template_tasks' }
          )
        : [];

      // Group tasks by template
      const tasksByTemplate = new Map<string, TemplateTaskRecord[]>();
      tasks.forEach(task => {
        const templateTasks = tasksByTemplate.get(task.template_id) || [];
        templateTasks.push(task);
        tasksByTemplate.set(task.template_id, templateTasks);
      });

      // Map to domain models
      const result: OnboardingTemplate[] = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        tasks: (tasksByTemplate.get(template.id) || []).map(task => ({
          title: task.title,
          description: task.description,
          daysUntilDue: task.days_until_due,
          order: task.order_number,
          requiresDocument: task.requires_document,
        })),
        isActive: template.is_active,
        createdBy: template.created_by,
        departmentId: template.department_id || undefined,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      }));

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Templates fetched successfully:', {
        count: result.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: result,
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
   * Creates a new workflow instance from a template and assigns it to an employee.
   * Creates individual tasks with calculated due dates.
   * Sends email notification to employee.
   * 
   * @param {WorkflowAssignmentRequest} request - Workflow assignment data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingWorkflow>>} Created workflow
   * 
   * @example
   * const result = await onboardingService.assignWorkflow({
   *   templateId: 'template-id',
   *   employeeId: 'employee-id',
   *   startDate: new Date(),
   *   assignedBy: 'hr-admin-id'
   * });
   */
  async assignWorkflow(
    request: WorkflowAssignmentRequest,
    correlationId?: string
  ): Promise<ServiceOperationResult<OnboardingWorkflow>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `assign_workflow_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Assigning onboarding workflow:', {
      templateId: request.templateId,
      employeeId: request.employeeId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input
      const validationErrors: string[] = [];

      if (!request.templateId || request.templateId.trim().length === 0) {
        validationErrors.push('Template ID is required');
      }

      if (!request.employeeId || request.employeeId.trim().length === 0) {
        validationErrors.push('Employee ID is required');
      }

      if (!request.assignedBy || request.assignedBy.trim().length === 0) {
        validationErrors.push('Assigned by user ID is required');
      }

      if (validationErrors.length > 0) {
        console.warn('[ONBOARDING_SERVICE] Workflow assignment validation failed:', {
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

      // Fetch template with tasks
      const template = await queryOne<TemplateRecord>(
        'SELECT * FROM onboarding_templates WHERE id = $1 AND is_active = true',
        [request.templateId],
        { correlationId: cid, operation: 'fetch_template' }
      );

      if (!template) {
        console.warn('[ONBOARDING_SERVICE] Template not found:', {
          templateId: request.templateId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: 'Template not found or inactive',
          errorCode: 'TEMPLATE_NOT_FOUND',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const templateTasks = await queryMany<TemplateTaskRecord>(
        'SELECT * FROM onboarding_template_tasks WHERE template_id = $1 ORDER BY order_number ASC',
        [request.templateId],
        { correlationId: cid, operation: 'fetch_template_tasks' }
      );

      // Fetch employee details
      const employee = await queryOne<EmployeeRecord>(
        `SELECT e.id, e.user_id, u.first_name, u.last_name, u.email, e.manager_id
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [request.employeeId],
        { correlationId: cid, operation: 'fetch_employee' }
      );

      if (!employee) {
        console.warn('[ONBOARDING_SERVICE] Employee not found:', {
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

      // Create workflow and tasks in transaction
      const workflow = await executeTransaction<OnboardingWorkflow>(
        async (client) => {
          const workflowId = crypto.randomUUID();
          const startDate = request.startDate || timestamp;
          
          // Calculate expected completion date (max days until due)
          const maxDaysUntilDue = Math.max(...templateTasks.map(t => t.days_until_due), 0);
          const expectedCompletionDate = new Date(startDate);
          expectedCompletionDate.setDate(expectedCompletionDate.getDate() + maxDaysUntilDue);

          // Insert workflow
          const workflowResult = await client.query<WorkflowRecord>(
            `INSERT INTO onboarding_workflows (
              id, employee_id, template_id, status, progress, start_date, 
              expected_completion_date, assigned_by, manager_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
              workflowId,
              request.employeeId,
              request.templateId,
              'NOT_STARTED',
              0,
              startDate,
              expectedCompletionDate,
              request.assignedBy,
              request.managerId || employee.manager_id || null,
              timestamp,
              timestamp,
            ]
          );

          if (workflowResult.rows.length === 0) {
            throw new Error('Failed to create workflow record');
          }

          const workflowRecord = workflowResult.rows[0]!;

          // Insert tasks
          const taskRecords: TaskRecord[] = [];
          for (const templateTask of templateTasks) {
            const taskId = crypto.randomUUID();
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + templateTask.days_until_due);

            const taskResult = await client.query<TaskRecord>(
              `INSERT INTO onboarding_tasks (
                id, workflow_id, employee_id, title, description, due_date, status, 
                order_number, requires_document, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING *`,
              [
                taskId,
                workflowId,
                request.employeeId,
                templateTask.title,
                templateTask.description,
                dueDate,
                'PENDING',
                templateTask.order_number,
                templateTask.requires_document,
                timestamp,
                timestamp,
              ]
            );

            if (taskResult.rows.length === 0) {
              throw new Error(`Failed to create task: ${templateTask.title}`);
            }

            taskRecords.push(taskResult.rows[0]!);
          }

          // Map to domain model
          const tasks: OnboardingTask[] = taskRecords.map(record => ({
            id: record.id,
            title: record.title,
            description: record.description,
            dueDate: record.due_date,
            status: record.status,
            documentUrl: record.document_url || undefined,
            workflowId: record.workflow_id,
            employeeId: record.employee_id,
            completedAt: record.completed_at || undefined,
            order: record.order_number,
            requiresDocument: record.requires_document,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          }));

          return {
            id: workflowRecord.id,
            employeeId: workflowRecord.employee_id,
            templateId: workflowRecord.template_id,
            status: workflowRecord.status,
            progress: workflowRecord.progress,
            tasks,
            startDate: workflowRecord.start_date,
            expectedCompletionDate: workflowRecord.expected_completion_date,
            actualCompletionDate: workflowRecord.actual_completion_date || undefined,
            assignedBy: workflowRecord.assigned_by,
            managerId: workflowRecord.manager_id || undefined,
            createdAt: workflowRecord.created_at,
            updatedAt: workflowRecord.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'assign_onboarding_workflow',
        }
      );

      // Send email notification to employee
      try {
        await emailService.sendWorkflowAssignmentNotification({
          employee: {
            id: employee.id,
            firstName: employee.first_name,
            lastName: employee.last_name,
            email: employee.email,
          },
          workflow: {
            id: workflow.id,
            templateName: template.name,
            taskCount: workflow.tasks.length,
            dueDate: workflow.expectedCompletionDate,
          },
          tasks: workflow.tasks.map(task => ({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
          })),
          assignedBy: {
            firstName: undefined,
            lastName: undefined,
          },
        });

        console.log('[ONBOARDING_SERVICE] Workflow assignment email sent:', {
          workflowId: workflow.id,
          employeeEmail: employee.email,
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      } catch (emailError) {
        console.error('[ONBOARDING_SERVICE] Failed to send workflow assignment email:', {
          workflowId: workflow.id,
          employeeEmail: employee.email,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Workflow assigned successfully:', {
        workflowId: workflow.id,
        employeeId: workflow.employeeId,
        templateId: workflow.templateId,
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
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'WORKFLOW_ASSIGNMENT_ERROR',
        executionTimeMs,
      };
    }
  }

  /**
   * Get workflow for specific employee
   * 
   * Retrieves the onboarding workflow and tasks for a specific employee.
   * 
   * @param {string} employeeId - Employee identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingWorkflow | null>>} Employee workflow
   * 
   * @example
   * const result = await onboardingService.getEmployeeWorkflow('employee-id');
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
      const workflow = await queryOne<WorkflowRecord>(
        'SELECT * FROM onboarding_workflows WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 1',
        [employeeId],
        { correlationId: cid, operation: 'fetch_employee_workflow' }
      );

      if (!workflow) {
        console.log('[ONBOARDING_SERVICE] No workflow found for employee:', {
          employeeId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: true,
          data: null,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch tasks
      const tasks = await queryMany<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE workflow_id = $1 ORDER BY order_number ASC',
        [workflow.id],
        { correlationId: cid, operation: 'fetch_workflow_tasks' }
      );

      // Map to domain model
      const result: OnboardingWorkflow = {
        id: workflow.id,
        employeeId: workflow.employee_id,
        templateId: workflow.template_id,
        status: workflow.status,
        progress: workflow.progress,
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.due_date,
          status: task.status,
          documentUrl: task.document_url || undefined,
          workflowId: task.workflow_id,
          employeeId: task.employee_id,
          completedAt: task.completed_at || undefined,
          order: task.order_number,
          requiresDocument: task.requires_document,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
        })),
        startDate: workflow.start_date,
        expectedCompletionDate: workflow.expected_completion_date,
        actualCompletionDate: workflow.actual_completion_date || undefined,
        assignedBy: workflow.assigned_by,
        managerId: workflow.manager_id || undefined,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      };

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Employee workflow fetched successfully:', {
        workflowId: result.id,
        employeeId,
        taskCount: result.tasks.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: result,
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
   * Retrieves all onboarding tasks for the authenticated employee.
   * 
   * @param {string} employeeId - Employee identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTask[]>>} Employee tasks
   * 
   * @example
   * const result = await onboardingService.getMyTasks('employee-id');
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
      if (!employeeId || employeeId.trim().length === 0) {
        return {
          success: false,
          error: 'Employee ID is required',
          errorCode: 'VALIDATION_ERROR',
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Fetch tasks
      const tasks = await queryMany<TaskRecord>(
        'SELECT * FROM onboarding_tasks WHERE employee_id = $1 ORDER BY order_number ASC',
        [employeeId],
        { correlationId: cid, operation: 'fetch_employee_tasks' }
      );

      // Map to domain model
      const result: OnboardingTask[] = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        status: task.status,
        documentUrl: task.document_url || undefined,
        workflowId: task.workflow_id,
        employeeId: task.employee_id,
        completedAt: task.completed_at || undefined,
        order: task.order_number,
        requiresDocument: task.requires_document,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      }));

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Employee tasks fetched successfully:', {
        employeeId,
        taskCount: result.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: result,
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
   * Update task status and document URL
   * 
   * Marks a task as complete and updates the document URL if provided.
   * Recalculates workflow progress and updates workflow status.
   * Sends email notification to HR admin.
   * 
   * @param {string} taskId - Task identifier
   * @param {string} employeeId - Employee identifier (for authorization)
   * @param {string} [documentUrl] - Optional document URL
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<OnboardingTask>>} Updated task
   * 
   * @example
   * const result = await onboardingService.updateTaskStatus('task-id', 'employee-id', 'https://...');
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

      // Update task and workflow in transaction
      const task = await executeTransaction<OnboardingTask>(
        async (client) => {
          // Fetch task
          const taskResult = await client.query<TaskRecord>(
            'SELECT * FROM onboarding_tasks WHERE id = $1 AND employee_id = $2',
            [taskId, employeeId]
          );

          if (taskResult.rows.length === 0) {
            throw new Error('Task not found or unauthorized');
          }

          const taskRecord = taskResult.rows[0]!;

          // Check if document is required
          if (taskRecord.requires_document && !documentUrl) {
            throw new Error('Document upload is required for this task');
          }

          // Update task
          const updateResult = await client.query<TaskRecord>(
            `UPDATE onboarding_tasks 
             SET status = $1, document_url = $2, completed_at = $3, updated_at = $4
             WHERE id = $5
             RETURNING *`,
            ['COMPLETED', documentUrl || null, timestamp, timestamp, taskId]
          );

          if (updateResult.rows.length === 0) {
            throw new Error('Failed to update task');
          }

          const updatedTask = updateResult.rows[0]!;

          // Recalculate workflow progress
          const workflowTasks = await client.query<TaskRecord>(
            'SELECT * FROM onboarding_tasks WHERE workflow_id = $1',
            [taskRecord.workflow_id]
          );

          const totalTasks = workflowTasks.rows.length;
          const completedTasks = workflowTasks.rows.filter(t => t.status === 'COMPLETED').length;
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const allCompleted = completedTasks === totalTasks;

          // Update workflow
          await client.query(
            `UPDATE onboarding_workflows 
             SET progress = $1, status = $2, actual_completion_date = $3, updated_at = $4
             WHERE id = $5`,
            [
              progress,
              allCompleted ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
              allCompleted ? timestamp : null,
              timestamp,
              taskRecord.workflow_id,
            ]
          );

          return {
            id: updatedTask.id,
            title: updatedTask.title,
            description: updatedTask.description,
            dueDate: updatedTask.due_date,
            status: updatedTask.status,
            documentUrl: updatedTask.document_url || undefined,
            workflowId: updatedTask.workflow_id,
            employeeId: updatedTask.employee_id,
            completedAt: updatedTask.completed_at || undefined,
            order: updatedTask.order_number,
            requiresDocument: updatedTask.requires_document,
            createdAt: updatedTask.created_at,
            updatedAt: updatedTask.updated_at,
          };
        },
        {
          correlationId: cid,
          operation: 'update_task_status',
        }
      );

      // Fetch employee and HR admin details for email notification
      try {
        const employee = await queryOne<EmployeeRecord>(
          `SELECT e.id, e.user_id, u.first_name, u.last_name, u.email
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1`,
          [employeeId],
          { correlationId: cid, operation: 'fetch_employee_for_notification' }
        );

        const workflow = await queryOne<WorkflowRecord>(
          'SELECT * FROM onboarding_workflows WHERE id = $1',
          [task.workflowId],
          { correlationId: cid, operation: 'fetch_workflow_for_notification' }
        );

        if (employee && workflow) {
          const hrAdmin = await queryOne<{ email: string; first_name: string; last_name: string }>(
            'SELECT email, first_name, last_name FROM users WHERE id = $1',
            [workflow.assigned_by],
            { correlationId: cid, operation: 'fetch_hr_admin' }
          );

          if (hrAdmin) {
            await emailService.sendTaskCompletionNotification({
              employee: {
                id: employee.id,
                firstName: employee.first_name,
                lastName: employee.last_name,
                email: employee.email,
              },
              task: {
                id: task.id,
                title: task.title,
                description: task.description,
                completedAt: task.completedAt!,
              },
              hrAdmin: {
                email: hrAdmin.email,
                firstName: hrAdmin.first_name,
                lastName: hrAdmin.last_name,
              },
              documents: documentUrl ? [{
                filename: documentUrl.split('/').pop() || 'document',
                size: 0,
              }] : undefined,
            });

            console.log('[ONBOARDING_SERVICE] Task completion email sent:', {
              taskId: task.id,
              hrAdminEmail: hrAdmin.email,
              correlationId: cid,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (emailError) {
        console.error('[ONBOARDING_SERVICE] Failed to send task completion email:', {
          taskId: task.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          correlationId: cid,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Task status updated successfully:', {
        taskId: task.id,
        status: task.status,
        hasDocument: !!task.documentUrl,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: task,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[ONBOARDING_SERVICE] Task status update failed:', {
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
   * Get onboarding progress for team members
   * 
   * Retrieves onboarding progress summaries for all team members reporting to a manager.
   * 
   * @param {string} managerId - Manager identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<WorkflowProgressSummary[]>>} Team progress summaries
   * 
   * @example
   * const result = await onboardingService.getTeamProgress('manager-id');
   */
  async getTeamProgress(
    managerId: string,
    correlationId?: string
  ): Promise<ServiceOperationResult<WorkflowProgressSummary[]>> {
    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `get_team_progress_${Date.now()}`;

    console.log('[ONBOARDING_SERVICE] Fetching team onboarding progress:', {
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

      // Fetch workflows for team members
      const workflows = await queryMany<WorkflowRecord & {
        employee_first_name: string;
        employee_last_name: string;
        employee_email: string;
        template_name: string;
      }>(
        `SELECT w.*, u.first_name as employee_first_name, u.last_name as employee_last_name, 
                u.email as employee_email, t.name as template_name
         FROM onboarding_workflows w
         JOIN employees e ON w.employee_id = e.id
         JOIN users u ON e.user_id = u.id
         JOIN onboarding_templates t ON w.template_id = t.id
         WHERE w.manager_id = $1 OR e.manager_id = $1
         ORDER BY w.created_at DESC`,
        [managerId],
        { correlationId: cid, operation: 'fetch_team_workflows' }
      );

      // Fetch tasks for all workflows
      const workflowIds = workflows.map(w => w.id);
      const tasks = workflowIds.length > 0
        ? await queryMany<TaskRecord>(
            'SELECT * FROM onboarding_tasks WHERE workflow_id = ANY($1)',
            [workflowIds],
            { correlationId: cid, operation: 'fetch_workflow_tasks' }
          )
        : [];

      // Group tasks by workflow
      const tasksByWorkflow = new Map<string, TaskRecord[]>();
      tasks.forEach(task => {
        const workflowTasks = tasksByWorkflow.get(task.workflow_id) || [];
        workflowTasks.push(task);
        tasksByWorkflow.set(task.workflow_id, workflowTasks);
      });

      // Calculate progress summaries
      const result: WorkflowProgressSummary[] = workflows.map(workflow => {
        const workflowTasks = tasksByWorkflow.get(workflow.id) || [];
        const totalTasks = workflowTasks.length;
        const completedTasks = workflowTasks.filter(t => t.status === 'COMPLETED').length;
        const pendingTasks = workflowTasks.filter(t => t.status === 'PENDING').length;
        const inProgressTasks = workflowTasks.filter(t => t.status === 'IN_PROGRESS').length;
        const overdueTasks = workflowTasks.filter(
          t => t.status !== 'COMPLETED' && new Date(t.due_date) < timestamp
        ).length;

        const daysRemaining = Math.ceil(
          (new Date(workflow.expected_completion_date).getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          workflowId: workflow.id,
          employee: {
            id: workflow.employee_id,
            firstName: workflow.employee_first_name,
            lastName: workflow.employee_last_name,
            email: workflow.employee_email,
          },
          templateName: workflow.template_name,
          status: workflow.status,
          progress: workflow.progress,
          totalTasks,
          completedTasks,
          pendingTasks,
          inProgressTasks,
          overdueTasks,
          startDate: workflow.start_date,
          expectedCompletionDate: workflow.expected_completion_date,
          actualCompletionDate: workflow.actual_completion_date || undefined,
          daysRemaining,
        };
      });

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Team progress fetched successfully:', {
        managerId,
        workflowCount: result.length,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: true,
        data: result,
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
   * Calculate workflow completion percentage
   * 
   * Calculates the completion percentage for a workflow based on completed tasks.
   * 
   * @param {string} workflowId - Workflow identifier
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<ServiceOperationResult<number>>} Completion percentage (0-100)
   * 
   * @example
   * const result = await onboardingService.calculateProgress('workflow-id');
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
        { correlationId: cid, operation: 'fetch_workflow_tasks' }
      );

      if (tasks.length === 0) {
        console.warn('[ONBOARDING_SERVICE] No tasks found for workflow:', {
          workflowId,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: true,
          data: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Calculate progress
      const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
      const progress = Math.round((completedTasks / tasks.length) * 100);

      const executionTimeMs = Date.now() - startTime;

      console.log('[ONBOARDING_SERVICE] Progress calculated successfully:', {
        workflowId,
        totalTasks: tasks.length,
        completedTasks,
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
 * Default export
 */
export default onboardingService;