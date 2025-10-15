/**
 * Onboarding Domain Type Definitions
 * 
 * This module defines TypeScript interfaces and enums for the employee onboarding
 * workflow system. It provides type safety for onboarding templates, tasks, workflows,
 * and their associated states.
 * 
 * @module types/onboarding
 */

import type { BaseEntity } from './index';

/**
 * Task status enumeration
 * 
 * Defines the lifecycle states of an onboarding task.
 */
export enum TaskStatus {
  /**
   * Task has been created but not yet started
   */
  Pending = 'PENDING',

  /**
   * Task is currently being worked on
   */
  InProgress = 'IN_PROGRESS',

  /**
   * Task has been completed successfully
   */
  Completed = 'COMPLETED',
}

/**
 * Workflow status enumeration
 * 
 * Defines the lifecycle states of an onboarding workflow.
 */
export enum WorkflowStatus {
  /**
   * Workflow has been created but employee hasn't started
   */
  NotStarted = 'NOT_STARTED',

  /**
   * Workflow is in progress with some tasks completed
   */
  InProgress = 'IN_PROGRESS',

  /**
   * All tasks in the workflow have been completed
   */
  Completed = 'COMPLETED',
}

/**
 * Onboarding task definition
 * 
 * Represents a single task within an onboarding template or workflow.
 * Tasks can include document uploads, training completion, or other activities.
 */
export interface OnboardingTask {
  /**
   * Unique identifier for the task
   */
  readonly id: string;

  /**
   * Task title (max 200 characters)
   */
  readonly title: string;

  /**
   * Detailed task description (max 2000 characters)
   */
  readonly description: string;

  /**
   * Due date for task completion (must be a future date)
   */
  readonly dueDate: Date;

  /**
   * Current status of the task
   */
  readonly status: TaskStatus;

  /**
   * URL to uploaded document (if applicable)
   */
  readonly documentUrl?: string;

  /**
   * Order/sequence number for task display
   */
  readonly order: number;

  /**
   * Whether document upload is required for this task
   */
  readonly requiresDocument: boolean;

  /**
   * Timestamp when task was completed (if completed)
   */
  readonly completedAt?: Date;
}

/**
 * Onboarding template definition
 * 
 * Represents a reusable template for onboarding workflows.
 * Templates define the standard set of tasks for new employees.
 */
export interface OnboardingTemplate extends BaseEntity {
  /**
   * Template name
   */
  readonly name: string;

  /**
   * Template description
   */
  readonly description: string;

  /**
   * Array of tasks included in this template
   */
  readonly tasks: OnboardingTask[];

  /**
   * Whether this template is currently active
   */
  readonly isActive: boolean;

  /**
   * HR admin who created the template
   */
  readonly createdBy: string;

  /**
   * Department this template is designed for (optional)
   */
  readonly departmentId?: string;

  /**
   * Estimated number of days to complete all tasks
   */
  readonly estimatedDays: number;
}

/**
 * Onboarding workflow instance
 * 
 * Represents an active onboarding workflow assigned to a specific employee.
 * Tracks progress through the onboarding tasks.
 */
export interface OnboardingWorkflow extends BaseEntity {
  /**
   * Employee assigned to this workflow
   */
  readonly employeeId: string;

  /**
   * Template this workflow is based on
   */
  readonly templateId: string;

  /**
   * Current status of the workflow
   */
  readonly status: WorkflowStatus;

  /**
   * Progress percentage (0-100)
   */
  readonly progress: number;

  /**
   * Array of tasks in this workflow instance
   */
  readonly tasks: OnboardingTask[];

  /**
   * HR admin who assigned this workflow
   */
  readonly assignedBy: string;

  /**
   * Date when workflow was assigned
   */
  readonly assignedAt: Date;

  /**
   * Date when workflow was started by employee
   */
  readonly startedAt?: Date;

  /**
   * Date when all tasks were completed
   */
  readonly completedAt?: Date;

  /**
   * Target completion date for the workflow
   */
  readonly targetCompletionDate: Date;

  /**
   * Number of completed tasks
   */
  readonly completedTaskCount: number;

  /**
   * Total number of tasks
   */
  readonly totalTaskCount: number;
}

/**
 * Task completion request payload
 * 
 * Data structure for marking a task as complete.
 */
export interface TaskCompletionRequest {
  /**
   * Task identifier
   */
  readonly taskId: string;

  /**
   * Optional notes about task completion
   */
  readonly notes?: string;

  /**
   * Uploaded document file (if required)
   */
  readonly document?: {
    /**
     * Original filename
     */
    readonly filename: string;

    /**
     * File MIME type
     */
    readonly mimeType: string;

    /**
     * File size in bytes
     */
    readonly size: number;

    /**
     * Storage path or URL
     */
    readonly path: string;
  };
}

/**
 * Template creation request payload
 * 
 * Data structure for creating a new onboarding template.
 */
export interface CreateTemplateRequest {
  /**
   * Template name
   */
  readonly name: string;

  /**
   * Template description
   */
  readonly description: string;

  /**
   * Array of task definitions
   */
  readonly tasks: Array<{
    /**
     * Task title (max 200 characters)
     */
    readonly title: string;

    /**
     * Task description (max 2000 characters)
     */
    readonly description: string;

    /**
     * Number of days from workflow start for due date
     */
    readonly daysUntilDue: number;

    /**
     * Display order
     */
    readonly order: number;

    /**
     * Whether document upload is required
     */
    readonly requiresDocument: boolean;
  }>;

  /**
   * Optional department identifier
   */
  readonly departmentId?: string;

  /**
   * Estimated completion time in days
   */
  readonly estimatedDays: number;
}

/**
 * Workflow assignment request payload
 * 
 * Data structure for assigning an onboarding workflow to an employee.
 */
export interface AssignWorkflowRequest {
  /**
   * Employee to assign workflow to
   */
  readonly employeeId: string;

  /**
   * Template to use for workflow
   */
  readonly templateId: string;

  /**
   * Optional custom target completion date
   * If not provided, calculated from template estimatedDays
   */
  readonly targetCompletionDate?: Date;

  /**
   * Optional custom task modifications
   */
  readonly taskOverrides?: Array<{
    /**
     * Task order number to override
     */
    readonly order: number;

    /**
     * Custom due date for this task
     */
    readonly dueDate?: Date;

    /**
     * Custom title
     */
    readonly title?: string;

    /**
     * Custom description
     */
    readonly description?: string;
  }>;
}

/**
 * Team progress summary
 * 
 * Aggregated onboarding progress data for a manager's team.
 */
export interface TeamProgressSummary {
  /**
   * Manager identifier
   */
  readonly managerId: string;

  /**
   * Total number of team members with active workflows
   */
  readonly totalEmployees: number;

  /**
   * Number of employees who haven't started
   */
  readonly notStartedCount: number;

  /**
   * Number of employees in progress
   */
  readonly inProgressCount: number;

  /**
   * Number of employees who completed onboarding
   */
  readonly completedCount: number;

  /**
   * Average progress percentage across team
   */
  readonly averageProgress: number;

  /**
   * Individual employee progress details
   */
  readonly employees: Array<{
    /**
     * Employee identifier
     */
    readonly employeeId: string;

    /**
     * Employee name
     */
    readonly employeeName: string;

    /**
     * Workflow identifier
     */
    readonly workflowId: string;

    /**
     * Current workflow status
     */
    readonly status: WorkflowStatus;

    /**
     * Progress percentage
     */
    readonly progress: number;

    /**
     * Number of completed tasks
     */
    readonly completedTasks: number;

    /**
     * Total number of tasks
     */
    readonly totalTasks: number;

    /**
     * Target completion date
     */
    readonly targetCompletionDate: Date;

    /**
     * Whether workflow is overdue
     */
    readonly isOverdue: boolean;

    /**
     * Days remaining until target date (negative if overdue)
     */
    readonly daysRemaining: number;
  }>;
}

/**
 * Task update payload
 * 
 * Data structure for updating task properties.
 */
export interface UpdateTaskRequest {
  /**
   * Updated task title
   */
  readonly title?: string;

  /**
   * Updated task description
   */
  readonly description?: string;

  /**
   * Updated due date
   */
  readonly dueDate?: Date;

  /**
   * Updated status
   */
  readonly status?: TaskStatus;
}

/**
 * Workflow statistics
 * 
 * Aggregated statistics for onboarding workflows.
 */
export interface WorkflowStatistics {
  /**
   * Total number of active workflows
   */
  readonly totalActive: number;

  /**
   * Total number of completed workflows
   */
  readonly totalCompleted: number;

  /**
   * Average completion time in days
   */
  readonly averageCompletionDays: number;

  /**
   * Number of overdue workflows
   */
  readonly overdueCount: number;

  /**
   * Average progress percentage
   */
  readonly averageProgress: number;

  /**
   * Completion rate (completed / total)
   */
  readonly completionRate: number;

  /**
   * Most used templates
   */
  readonly topTemplates: Array<{
    /**
     * Template identifier
     */
    readonly templateId: string;

    /**
     * Template name
     */
    readonly templateName: string;

    /**
     * Number of times used
     */
    readonly usageCount: number;
  }>;
}

/**
 * Document upload validation result
 * 
 * Result of validating an uploaded document.
 */
export interface DocumentValidationResult {
  /**
   * Whether document is valid
   */
  readonly isValid: boolean;

  /**
   * Validation errors (if any)
   */
  readonly errors: string[];

  /**
   * Validated file metadata (if valid)
   */
  readonly metadata?: {
    /**
     * Original filename
     */
    readonly filename: string;

    /**
     * File MIME type
     */
    readonly mimeType: string;

    /**
     * File size in bytes
     */
    readonly size: number;

    /**
     * File extension
     */
    readonly extension: string;
  };
}

/**
 * Type guard to check if a value is a valid TaskStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    Object.values(TaskStatus).includes(value as TaskStatus)
  );
}

/**
 * Type guard to check if a value is a valid WorkflowStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid WorkflowStatus
 */
export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    typeof value === 'string' &&
    Object.values(WorkflowStatus).includes(value as WorkflowStatus)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingTask
 * 
 * @param value - Value to check
 * @returns True if value is a valid OnboardingTask
 */
export function isOnboardingTask(value: unknown): value is OnboardingTask {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const task = value as Record<string, unknown>;

  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.description === 'string' &&
    task.dueDate instanceof Date &&
    isTaskStatus(task.status) &&
    typeof task.order === 'number' &&
    typeof task.requiresDocument === 'boolean' &&
    (task.documentUrl === undefined || typeof task.documentUrl === 'string') &&
    (task.completedAt === undefined || task.completedAt instanceof Date)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingTemplate
 * 
 * @param value - Value to check
 * @returns True if value is a valid OnboardingTemplate
 */
export function isOnboardingTemplate(
  value: unknown
): value is OnboardingTemplate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const template = value as Record<string, unknown>;

  return (
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.description === 'string' &&
    Array.isArray(template.tasks) &&
    template.tasks.every(isOnboardingTask) &&
    typeof template.isActive === 'boolean' &&
    typeof template.createdBy === 'string' &&
    typeof template.estimatedDays === 'number' &&
    template.createdAt instanceof Date &&
    template.updatedAt instanceof Date &&
    (template.departmentId === undefined ||
      typeof template.departmentId === 'string')
  );
}

/**
 * Type guard to check if a value is a valid OnboardingWorkflow
 * 
 * @param value - Value to check
 * @returns True if value is a valid OnboardingWorkflow
 */
export function isOnboardingWorkflow(
  value: unknown
): value is OnboardingWorkflow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const workflow = value as Record<string, unknown>;

  return (
    typeof workflow.id === 'string' &&
    typeof workflow.employeeId === 'string' &&
    typeof workflow.templateId === 'string' &&
    isWorkflowStatus(workflow.status) &&
    typeof workflow.progress === 'number' &&
    Array.isArray(workflow.tasks) &&
    workflow.tasks.every(isOnboardingTask) &&
    typeof workflow.assignedBy === 'string' &&
    workflow.assignedAt instanceof Date &&
    workflow.targetCompletionDate instanceof Date &&
    typeof workflow.completedTaskCount === 'number' &&
    typeof workflow.totalTaskCount === 'number' &&
    workflow.createdAt instanceof Date &&
    workflow.updatedAt instanceof Date &&
    (workflow.startedAt === undefined || workflow.startedAt instanceof Date) &&
    (workflow.completedAt === undefined ||
      workflow.completedAt instanceof Date)
  );
}

/**
 * Utility type for creating a new onboarding template
 * 
 * Omits system-generated fields
 */
export type CreateOnboardingTemplate = Omit<
  OnboardingTemplate,
  'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Utility type for updating an onboarding template
 * 
 * Makes all fields optional except id
 */
export type UpdateOnboardingTemplate = Partial<
  Omit<OnboardingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
> & {
  readonly id: string;
};

/**
 * Utility type for creating a new onboarding workflow
 * 
 * Omits system-generated fields
 */
export type CreateOnboardingWorkflow = Omit<
  OnboardingWorkflow,
  'id' | 'createdAt' | 'updatedAt' | 'progress' | 'completedTaskCount'
>;

/**
 * Utility type for workflow with employee details
 * 
 * Extends workflow with employee information
 */
export type WorkflowWithEmployee = OnboardingWorkflow & {
  readonly employee: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly jobTitle: string;
    readonly departmentId: string;
  };
};

/**
 * Utility type for template with usage statistics
 * 
 * Extends template with usage metrics
 */
export type TemplateWithStats = OnboardingTemplate & {
  readonly stats: {
    readonly totalUsage: number;
    readonly activeWorkflows: number;
    readonly completedWorkflows: number;
    readonly averageCompletionDays: number;
    readonly averageProgress: number;
  };
};

/**
 * Export all types for convenient importing
 */
export type {
  OnboardingTask,
  OnboardingTemplate,
  OnboardingWorkflow,
  TaskCompletionRequest,
  CreateTemplateRequest,
  AssignWorkflowRequest,
  TeamProgressSummary,
  UpdateTaskRequest,
  WorkflowStatistics,
  DocumentValidationResult,
};

/**
 * Export all enums
 */
export { TaskStatus, WorkflowStatus };

/**
 * Export all type guards
 */
export {
  isTaskStatus,
  isWorkflowStatus,
  isOnboardingTask,
  isOnboardingTemplate,
  isOnboardingWorkflow,
};

/**
 * Default export for convenient importing
 */
export default {
  TaskStatus,
  WorkflowStatus,
  isTaskStatus,
  isWorkflowStatus,
  isOnboardingTask,
  isOnboardingTemplate,
  isOnboardingWorkflow,
};