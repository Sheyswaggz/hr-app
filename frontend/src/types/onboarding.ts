/**
 * Onboarding Domain Type Definitions
 * 
 * TypeScript interfaces and types for the onboarding workflow system.
 * Defines templates, tasks, workflow assignments, and progress tracking.
 * 
 * @module types/onboarding
 */

/**
 * Task status enumeration
 * Represents the current state of an onboarding task
 */
export enum TaskStatus {
  /** Task has been assigned but not yet started */
  PENDING = 'pending',
  
  /** Task is currently being worked on by the employee */
  IN_PROGRESS = 'in_progress',
  
  /** Task has been completed by the employee */
  COMPLETED = 'completed',
}

/**
 * Template task definition
 * Represents a task template that can be reused across multiple onboarding workflows
 */
export interface TemplateTask {
  /** Task title (max 200 characters) */
  readonly title: string;
  
  /** Detailed task description (max 2000 characters) */
  readonly description: string;
  
  /** Number of days from workflow start date to complete the task */
  readonly dueDate: number;
}

/**
 * Onboarding template interface
 * Defines a reusable template for employee onboarding workflows
 */
export interface OnboardingTemplate {
  /** Unique identifier for the template */
  readonly id: string;
  
  /** Template name */
  readonly name: string;
  
  /** Template description */
  readonly description: string;
  
  /** Array of tasks included in this template */
  readonly tasks: readonly TemplateTask[];
  
  /** Timestamp when the template was created */
  readonly createdAt: Date;
  
  /** Timestamp when the template was last updated */
  readonly updatedAt: Date;
}

/**
 * Onboarding task interface
 * Represents an individual task assigned to an employee
 */
export interface OnboardingTask {
  /** Unique identifier for the task */
  readonly id: string;
  
  /** Task title (max 200 characters) */
  readonly title: string;
  
  /** Detailed task description (max 2000 characters) */
  readonly description: string;
  
  /** Due date for task completion */
  readonly dueDate: Date;
  
  /** Current status of the task */
  readonly status: TaskStatus;
  
  /** URL to uploaded document (if applicable) */
  readonly documentUrl: string | null;
  
  /** Timestamp when the task was completed (null if not completed) */
  readonly completedAt: Date | null;
  
  /** Timestamp when the task was created */
  readonly createdAt: Date;
  
  /** Timestamp when the task was last updated */
  readonly updatedAt: Date;
}

/**
 * Team progress tracking interface
 * Represents onboarding progress for a team member
 */
export interface TeamProgress {
  /** Employee's unique identifier */
  readonly employeeId: string;
  
  /** Employee's full name */
  readonly employeeName: string;
  
  /** Name of the assigned onboarding template */
  readonly templateName: string;
  
  /** Completion percentage (0-100) */
  readonly completionPercentage: number;
  
  /** Number of tasks completed */
  readonly tasksCompleted: number;
  
  /** Total number of tasks in the workflow */
  readonly tasksTotal: number;
  
  /** Timestamp when the workflow was assigned */
  readonly assignedAt: Date;
  
  /** Expected completion date based on template */
  readonly expectedCompletionDate: Date;
  
  /** Actual completion date (null if not completed) */
  readonly actualCompletionDate: Date | null;
}

/**
 * Template creation payload
 * Data required to create a new onboarding template
 */
export interface CreateTemplatePayload {
  /** Template name */
  readonly name: string;
  
  /** Template description */
  readonly description: string;
  
  /** Array of tasks to include in the template */
  readonly tasks: readonly TemplateTask[];
}

/**
 * Template update payload
 * Data for updating an existing onboarding template
 */
export interface UpdateTemplatePayload {
  /** Optional template name update */
  readonly name?: string;
  
  /** Optional template description update */
  readonly description?: string;
  
  /** Optional tasks array update */
  readonly tasks?: readonly TemplateTask[];
}

/**
 * Workflow assignment payload
 * Data required to assign an onboarding workflow to an employee
 */
export interface WorkflowAssignmentPayload {
  /** ID of the employee to assign the workflow to */
  readonly employeeId: string;
  
  /** ID of the template to use for the workflow */
  readonly templateId: string;
  
  /** Optional start date (defaults to current date) */
  readonly startDate?: Date;
}

/**
 * Task completion payload
 * Data for marking a task as complete
 */
export interface TaskCompletionPayload {
  /** Task ID to mark as complete */
  readonly taskId: string;
  
  /** Optional document file for upload */
  readonly document?: File;
}

/**
 * File upload validation result
 * Result of client-side file validation
 */
export interface FileValidationResult {
  /** Whether the file is valid */
  readonly valid: boolean;
  
  /** Error message if validation failed */
  readonly error?: string;
  
  /** File metadata if valid */
  readonly metadata?: {
    readonly name: string;
    readonly size: number;
    readonly type: string;
  };
}

/**
 * Onboarding workflow summary
 * Summary view of an employee's onboarding workflow
 */
export interface OnboardingWorkflowSummary {
  /** Workflow unique identifier */
  readonly id: string;
  
  /** Employee ID */
  readonly employeeId: string;
  
  /** Template name */
  readonly templateName: string;
  
  /** Workflow start date */
  readonly startDate: Date;
  
  /** Expected completion date */
  readonly expectedCompletionDate: Date;
  
  /** Completion percentage (0-100) */
  readonly completionPercentage: number;
  
  /** Number of pending tasks */
  readonly pendingTasks: number;
  
  /** Number of in-progress tasks */
  readonly inProgressTasks: number;
  
  /** Number of completed tasks */
  readonly completedTasks: number;
  
  /** Total number of tasks */
  readonly totalTasks: number;
}

/**
 * Task list filter options
 * Options for filtering task lists
 */
export interface TaskFilterOptions {
  /** Filter by task status */
  readonly status?: TaskStatus;
  
  /** Filter by due date range */
  readonly dueDateFrom?: Date;
  readonly dueDateTo?: Date;
  
  /** Search by task title or description */
  readonly search?: string;
  
  /** Sort field */
  readonly sortBy?: 'dueDate' | 'title' | 'status' | 'createdAt';
  
  /** Sort order */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    Object.values(TaskStatus).includes(value as TaskStatus)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingTask
 */
export function isOnboardingTask(value: unknown): value is OnboardingTask {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'description' in value &&
    'dueDate' in value &&
    'status' in value &&
    typeof (value as OnboardingTask).id === 'string' &&
    typeof (value as OnboardingTask).title === 'string' &&
    typeof (value as OnboardingTask).description === 'string' &&
    isTaskStatus((value as OnboardingTask).status)
  );
}

/**
 * Type guard to check if a value is a valid OnboardingTemplate
 */
export function isOnboardingTemplate(value: unknown): value is OnboardingTemplate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'description' in value &&
    'tasks' in value &&
    typeof (value as OnboardingTemplate).id === 'string' &&
    typeof (value as OnboardingTemplate).name === 'string' &&
    typeof (value as OnboardingTemplate).description === 'string' &&
    Array.isArray((value as OnboardingTemplate).tasks)
  );
}

/**
 * Type guard to check if a value is a valid TeamProgress
 */
export function isTeamProgress(value: unknown): value is TeamProgress {
  return (
    typeof value === 'object' &&
    value !== null &&
    'employeeId' in value &&
    'employeeName' in value &&
    'templateName' in value &&
    'completionPercentage' in value &&
    'tasksCompleted' in value &&
    'tasksTotal' in value &&
    typeof (value as TeamProgress).employeeId === 'string' &&
    typeof (value as TeamProgress).employeeName === 'string' &&
    typeof (value as TeamProgress).templateName === 'string' &&
    typeof (value as TeamProgress).completionPercentage === 'number' &&
    typeof (value as TeamProgress).tasksCompleted === 'number' &&
    typeof (value as TeamProgress).tasksTotal === 'number'
  );
}

/**
 * Helper function to calculate completion percentage
 */
export function calculateCompletionPercentage(
  completed: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Helper function to validate file for upload
 */
export function validateFile(file: File): FileValidationResult {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];

  if (!file) {
    return {
      valid: false,
      error: 'No file selected',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed types: PDF, DOC, DOCX, JPG, PNG',
    };
  }

  return {
    valid: true,
    metadata: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
  };
}

/**
 * Helper function to format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Helper function to check if a task is overdue
 */
export function isTaskOverdue(task: OnboardingTask): boolean {
  if (task.status === TaskStatus.COMPLETED) return false;
  return new Date() > new Date(task.dueDate);
}

/**
 * Helper function to get task status color
 */
export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'default';
    case TaskStatus.IN_PROGRESS:
      return 'primary';
    case TaskStatus.COMPLETED:
      return 'success';
    default:
      return 'default';
  }
}

/**
 * Helper function to get task status label
 */
export function getTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'Pending';
    case TaskStatus.IN_PROGRESS:
      return 'In Progress';
    case TaskStatus.COMPLETED:
      return 'Completed';
    default:
      return 'Unknown';
  }
}

/**
 * Allowed file types for document upload
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
] as const;

/**
 * Maximum file size for document upload (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File type extensions mapping
 */
export const FILE_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const;