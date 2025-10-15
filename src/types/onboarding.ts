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
 * Onboarding task interface
 * 
 * Represents a single task within an onboarding workflow or template.
 * Tasks can include document uploads, training completion, or other activities.
 */
export interface OnboardingTask extends BaseEntity {
  /**
   * Task title (max 200 characters)
   */
  title: string;

  /**
   * Detailed task description (max 2000 characters)
   */
  description: string;

  /**
   * Due date for task completion (must be future date)
   */
  dueDate: Date;

  /**
   * Current status of the task
   */
  status: TaskStatus;

  /**
   * URL to uploaded document (if applicable)
   */
  documentUrl?: string;

  /**
   * Workflow this task belongs to
   */
  workflowId: string;

  /**
   * Employee assigned to this task
   */
  employeeId: string;

  /**
   * Date when task was completed
   */
  completedAt?: Date;

  /**
   * Order/sequence number within the workflow
   */
  order: number;

  /**
   * Whether document upload is required for this task
   */
  requiresDocument: boolean;
}

/**
 * Onboarding template interface
 * 
 * Represents a reusable template for creating onboarding workflows.
 * Templates define the standard set of tasks for new employees.
 */
export interface OnboardingTemplate extends BaseEntity {
  /**
   * Template name
   */
  name: string;

  /**
   * Template description
   */
  description: string;

  /**
   * Array of task definitions in this template
   */
  tasks: OnboardingTemplateTask[];

  /**
   * Whether this template is currently active
   */
  isActive: boolean;

  /**
   * HR admin who created the template
   */
  createdBy: string;

  /**
   * Department this template is designed for (optional)
   */
  departmentId?: string;
}

/**
 * Template task definition interface
 * 
 * Defines a task within a template (before it's assigned to an employee).
 */
export interface OnboardingTemplateTask {
  /**
   * Task title (max 200 characters)
   */
  title: string;

  /**
   * Detailed task description (max 2000 characters)
   */
  description: string;

  /**
   * Number of days from workflow start date for due date
   */
  daysUntilDue: number;

  /**
   * Order/sequence number within the template
   */
  order: number;

  /**
   * Whether document upload is required for this task
   */
  requiresDocument: boolean;
}

/**
 * Onboarding workflow interface
 * 
 * Represents an active onboarding workflow assigned to a specific employee.
 * Created from a template and tracks progress through completion.
 */
export interface OnboardingWorkflow extends BaseEntity {
  /**
   * Employee assigned to this workflow
   */
  employeeId: string;

  /**
   * Template this workflow was created from
   */
  templateId: string;

  /**
   * Current status of the workflow
   */
  status: WorkflowStatus;

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Array of tasks in this workflow
   */
  tasks: OnboardingTask[];

  /**
   * Date when workflow was started
   */
  startDate: Date;

  /**
   * Expected completion date (based on template)
   */
  expectedCompletionDate: Date;

  /**
   * Actual completion date (when all tasks completed)
   */
  actualCompletionDate?: Date;

  /**
   * HR admin who assigned this workflow
   */
  assignedBy: string;

  /**
   * Manager who will monitor this workflow
   */
  managerId?: string;
}

/**
 * Workflow progress summary interface
 * 
 * Provides a summary view of workflow progress for managers and HR admins.
 */
export interface WorkflowProgressSummary {
  /**
   * Workflow identifier
   */
  workflowId: string;

  /**
   * Employee information
   */
  employee: {
    /**
     * Employee ID
     */
    id: string;

    /**
     * Employee first name
     */
    firstName: string;

    /**
     * Employee last name
     */
    lastName: string;

    /**
     * Employee email
     */
    email: string;
  };

  /**
   * Template name
   */
  templateName: string;

  /**
   * Current workflow status
   */
  status: WorkflowStatus;

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Total number of tasks
   */
  totalTasks: number;

  /**
   * Number of completed tasks
   */
  completedTasks: number;

  /**
   * Number of pending tasks
   */
  pendingTasks: number;

  /**
   * Number of in-progress tasks
   */
  inProgressTasks: number;

  /**
   * Number of overdue tasks
   */
  overdueTasks: number;

  /**
   * Workflow start date
   */
  startDate: Date;

  /**
   * Expected completion date
   */
  expectedCompletionDate: Date;

  /**
   * Actual completion date (if completed)
   */
  actualCompletionDate?: Date;

  /**
   * Days remaining until expected completion (negative if overdue)
   */
  daysRemaining: number;
}

/**
 * Task completion request interface
 * 
 * Data required to mark a task as complete.
 */
export interface TaskCompletionRequest {
  /**
   * Task identifier
   */
  taskId: string;

  /**
   * Employee completing the task
   */
  employeeId: string;

  /**
   * Optional notes about task completion
   */
  notes?: string;

  /**
   * Uploaded document URL (if document was required)
   */
  documentUrl?: string;
}

/**
 * Workflow assignment request interface
 * 
 * Data required to assign an onboarding workflow to an employee.
 */
export interface WorkflowAssignmentRequest {
  /**
   * Template to use for the workflow
   */
  templateId: string;

  /**
   * Employee to assign the workflow to
   */
  employeeId: string;

  /**
   * Workflow start date (defaults to today)
   */
  startDate?: Date;

  /**
   * Manager to monitor this workflow (optional)
   */
  managerId?: string;

  /**
   * HR admin assigning the workflow
   */
  assignedBy: string;
}

/**
 * Template creation request interface
 * 
 * Data required to create a new onboarding template.
 */
export interface TemplateCreationRequest {
  /**
   * Template name
   */
  name: string;

  /**
   * Template description
   */
  description: string;

  /**
   * Array of task definitions
   */
  tasks: OnboardingTemplateTask[];

  /**
   * Department this template is for (optional)
   */
  departmentId?: string;

  /**
   * HR admin creating the template
   */
  createdBy: string;
}

/**
 * Document upload metadata interface
 * 
 * Metadata for uploaded onboarding documents.
 */
export interface DocumentUploadMetadata {
  /**
   * Original filename
   */
  originalName: string;

  /**
   * File MIME type
   */
  mimeType: string;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Storage path/URL
   */
  url: string;

  /**
   * Upload timestamp
   */
  uploadedAt: Date;

  /**
   * Employee who uploaded the document
   */
  uploadedBy: string;

  /**
   * Task this document is associated with
   */
  taskId: string;
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
    typeof task.workflowId === 'string' &&
    typeof task.employeeId === 'string' &&
    typeof task.order === 'number' &&
    typeof task.requiresDocument === 'boolean' &&
    (task.documentUrl === undefined || typeof task.documentUrl === 'string') &&
    (task.completedAt === undefined || task.completedAt instanceof Date)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingWorkflow
 * 
 * @param value - Value to check
 * @returns True if value is a valid OnboardingWorkflow
 */
export function isOnboardingWorkflow(value: unknown): value is OnboardingWorkflow {
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
    workflow.startDate instanceof Date &&
    workflow.expectedCompletionDate instanceof Date &&
    typeof workflow.assignedBy === 'string' &&
    (workflow.managerId === undefined || typeof workflow.managerId === 'string') &&
    (workflow.actualCompletionDate === undefined || workflow.actualCompletionDate instanceof Date)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingTemplate
 * 
 * @param value - Value to check
 * @returns True if value is a valid OnboardingTemplate
 */
export function isOnboardingTemplate(value: unknown): value is OnboardingTemplate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const template = value as Record<string, unknown>;

  return (
    typeof template.id === 'string' &&
    typeof template.name === 'string' &&
    typeof template.description === 'string' &&
    Array.isArray(template.tasks) &&
    typeof template.isActive === 'boolean' &&
    typeof template.createdBy === 'string' &&
    (template.departmentId === undefined || typeof template.departmentId === 'string')
  );
}

/**
 * Utility type for creating a new onboarding task (without generated fields)
 */
export type CreateOnboardingTaskPayload = Omit<
  OnboardingTask,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt'
>;

/**
 * Utility type for updating an onboarding task
 */
export type UpdateOnboardingTaskPayload = Partial<
  Omit<OnboardingTask, 'id' | 'createdAt' | 'updatedAt' | 'workflowId' | 'employeeId'>
>;

/**
 * Utility type for creating a new onboarding workflow (without generated fields)
 */
export type CreateOnboardingWorkflowPayload = Omit<
  OnboardingWorkflow,
  'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'progress' | 'actualCompletionDate'
>;

/**
 * Utility type for creating a new onboarding template (without generated fields)
 */
export type CreateOnboardingTemplatePayload = Omit<
  OnboardingTemplate,
  'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Utility type for updating an onboarding template
 */
export type UpdateOnboardingTemplatePayload = Partial<
  Omit<OnboardingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
>;