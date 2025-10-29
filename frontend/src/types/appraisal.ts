/**
 * Frontend Appraisal Type Definitions
 * 
 * TypeScript interfaces and enums for the performance appraisal domain.
 * Defines the complete type system for appraisal management including
 * appraisals, goals, filters, and status enums.
 */

/**
 * Appraisal status enumeration
 * Represents the lifecycle states of a performance appraisal
 */
export enum AppraisalStatus {
  /** Appraisal created but employee hasn't submitted self-assessment */
  DRAFT = 'draft',
  
  /** Employee has submitted self-assessment, awaiting manager review */
  SUBMITTED = 'submitted',
  
  /** Manager has completed review with feedback and rating */
  COMPLETED = 'completed',
}

/**
 * Goal status enumeration
 * Tracks the progress state of individual performance goals
 */
export enum GoalStatus {
  /** Goal defined but work hasn't started */
  NOT_STARTED = 'not_started',
  
  /** Goal is actively being worked on */
  IN_PROGRESS = 'in_progress',
  
  /** Goal has been successfully achieved */
  ACHIEVED = 'achieved',
  
  /** Goal was not achieved by target date */
  NOT_ACHIEVED = 'not_achieved',
}

/**
 * Performance goal interface
 * Represents an individual goal within an appraisal
 */
export interface Goal {
  /** Unique identifier for the goal */
  readonly id: string;
  
  /** Goal title (max 200 characters) */
  readonly title: string;
  
  /** Detailed goal description (max 1000 characters) */
  readonly description: string;
  
  /** Target completion date for the goal */
  readonly targetDate: string;
  
  /** Current status of the goal */
  readonly status: GoalStatus;
}

/**
 * Complete appraisal interface
 * Represents a full performance appraisal cycle
 */
export interface Appraisal {
  /** Unique identifier for the appraisal */
  readonly id: string;
  
  /** ID of the employee being appraised */
  readonly employeeId: string;
  
  /** Full name of the employee being appraised */
  readonly employeeName: string;
  
  /** ID of the manager conducting the review */
  readonly reviewerId: string;
  
  /** Full name of the reviewing manager */
  readonly reviewerName: string;
  
  /** Start date of the review period (ISO 8601 format) */
  readonly reviewPeriodStart: string;
  
  /** End date of the review period (ISO 8601 format) */
  readonly reviewPeriodEnd: string;
  
  /** Employee's self-assessment text (max 5000 characters, null if not submitted) */
  readonly selfAssessment: string | null;
  
  /** Manager's feedback text (max 5000 characters, null if not completed) */
  readonly managerFeedback: string | null;
  
  /** Manager's rating (1-5 stars, null if not completed) */
  readonly rating: number | null;
  
  /** Array of performance goals associated with this appraisal */
  readonly goals: Goal[];
  
  /** Current status of the appraisal */
  readonly status: AppraisalStatus;
  
  /** Timestamp when the appraisal was created (ISO 8601 format) */
  readonly createdAt: string;
  
  /** Timestamp when the appraisal was last updated (ISO 8601 format) */
  readonly updatedAt: string;
}

/**
 * Appraisal filter criteria interface
 * Used for filtering and searching appraisals in the history view
 */
export interface AppraisalFilters {
  /** Filter by appraisal status */
  readonly status?: AppraisalStatus;
  
  /** Filter by appraisals created on or after this date (ISO 8601 format) */
  readonly dateFrom?: string;
  
  /** Filter by appraisals created on or before this date (ISO 8601 format) */
  readonly dateTo?: string;
  
  /** Filter by specific rating value (1-5) */
  readonly rating?: number;
}

/**
 * Create appraisal request payload
 * Used when a manager initiates a new appraisal
 */
export interface CreateAppraisalRequest {
  /** ID of the employee to appraise */
  readonly employeeId: string;
  
  /** Start date of the review period (ISO 8601 format) */
  readonly reviewPeriodStart: string;
  
  /** End date of the review period (ISO 8601 format) */
  readonly reviewPeriodEnd: string;
}

/**
 * Self-assessment submission payload
 * Used when an employee submits their self-assessment
 */
export interface SubmitSelfAssessmentRequest {
  /** Self-assessment text (max 5000 characters) */
  readonly selfAssessment: string;
  
  /** Optional goals to set during self-assessment */
  readonly goals?: Omit<Goal, 'id'>[];
}

/**
 * Manager review submission payload
 * Used when a manager completes their review
 */
export interface SubmitManagerReviewRequest {
  /** Manager's feedback text (max 5000 characters) */
  readonly managerFeedback: string;
  
  /** Manager's rating (1-5 stars) */
  readonly rating: number;
  
  /** Optional updated goals */
  readonly goals?: Goal[];
}

/**
 * Goal creation payload
 * Used when adding a new goal to an appraisal
 */
export interface CreateGoalRequest {
  /** Goal title (max 200 characters) */
  readonly title: string;
  
  /** Goal description (max 1000 characters) */
  readonly description: string;
  
  /** Target completion date (ISO 8601 format) */
  readonly targetDate: string;
  
  /** Initial status (defaults to NOT_STARTED) */
  readonly status?: GoalStatus;
}

/**
 * Goal update payload
 * Used when updating an existing goal
 */
export interface UpdateGoalRequest {
  /** Updated goal title (max 200 characters) */
  readonly title?: string;
  
  /** Updated goal description (max 1000 characters) */
  readonly description?: string;
  
  /** Updated target date (ISO 8601 format) */
  readonly targetDate?: string;
  
  /** Updated status */
  readonly status?: GoalStatus;
}

/**
 * Type guard to check if a value is a valid AppraisalStatus
 */
export function isAppraisalStatus(value: unknown): value is AppraisalStatus {
  return (
    typeof value === 'string' &&
    Object.values(AppraisalStatus).includes(value as AppraisalStatus)
  );
}

/**
 * Type guard to check if a value is a valid GoalStatus
 */
export function isGoalStatus(value: unknown): value is GoalStatus {
  return (
    typeof value === 'string' &&
    Object.values(GoalStatus).includes(value as GoalStatus)
  );
}

/**
 * Type guard to check if a value is a valid Goal object
 */
export function isGoal(value: unknown): value is Goal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'description' in value &&
    'targetDate' in value &&
    'status' in value &&
    typeof (value as Goal).id === 'string' &&
    typeof (value as Goal).title === 'string' &&
    typeof (value as Goal).description === 'string' &&
    typeof (value as Goal).targetDate === 'string' &&
    isGoalStatus((value as Goal).status)
  );
}

/**
 * Type guard to check if a value is a valid Appraisal object
 */
export function isAppraisal(value: unknown): value is Appraisal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'employeeId' in value &&
    'employeeName' in value &&
    'reviewerId' in value &&
    'reviewerName' in value &&
    'reviewPeriodStart' in value &&
    'reviewPeriodEnd' in value &&
    'status' in value &&
    'goals' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    typeof (value as Appraisal).id === 'string' &&
    typeof (value as Appraisal).employeeId === 'string' &&
    typeof (value as Appraisal).employeeName === 'string' &&
    typeof (value as Appraisal).reviewerId === 'string' &&
    typeof (value as Appraisal).reviewerName === 'string' &&
    typeof (value as Appraisal).reviewPeriodStart === 'string' &&
    typeof (value as Appraisal).reviewPeriodEnd === 'string' &&
    isAppraisalStatus((value as Appraisal).status) &&
    Array.isArray((value as Appraisal).goals) &&
    (value as Appraisal).goals.every(isGoal)
  );
}

/**
 * Helper function to get human-readable status label
 */
export function getAppraisalStatusLabel(status: AppraisalStatus): string {
  const labels: Record<AppraisalStatus, string> = {
    [AppraisalStatus.DRAFT]: 'Draft',
    [AppraisalStatus.SUBMITTED]: 'Submitted',
    [AppraisalStatus.COMPLETED]: 'Completed',
  };
  return labels[status];
}

/**
 * Helper function to get human-readable goal status label
 */
export function getGoalStatusLabel(status: GoalStatus): string {
  const labels: Record<GoalStatus, string> = {
    [GoalStatus.NOT_STARTED]: 'Not Started',
    [GoalStatus.IN_PROGRESS]: 'In Progress',
    [GoalStatus.ACHIEVED]: 'Achieved',
    [GoalStatus.NOT_ACHIEVED]: 'Not Achieved',
  };
  return labels[status];
}

/**
 * Helper function to get status color for UI display
 */
export function getAppraisalStatusColor(
  status: AppraisalStatus
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  const colors: Record<AppraisalStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
    [AppraisalStatus.DRAFT]: 'default',
    [AppraisalStatus.SUBMITTED]: 'primary',
    [AppraisalStatus.COMPLETED]: 'success',
  };
  return colors[status];
}

/**
 * Helper function to get goal status color for UI display
 */
export function getGoalStatusColor(
  status: GoalStatus
): 'default' | 'primary' | 'success' | 'error' {
  const colors: Record<GoalStatus, 'default' | 'primary' | 'success' | 'error'> = {
    [GoalStatus.NOT_STARTED]: 'default',
    [GoalStatus.IN_PROGRESS]: 'primary',
    [GoalStatus.ACHIEVED]: 'success',
    [GoalStatus.NOT_ACHIEVED]: 'error',
  };
  return colors[status];
}

/**
 * Validation constants for appraisal fields
 */
export const APPRAISAL_VALIDATION = {
  SELF_ASSESSMENT_MAX_LENGTH: 5000,
  MANAGER_FEEDBACK_MAX_LENGTH: 5000,
  GOAL_TITLE_MAX_LENGTH: 200,
  GOAL_DESCRIPTION_MAX_LENGTH: 1000,
  MIN_RATING: 1,
  MAX_RATING: 5,
} as const;

/**
 * Helper function to validate rating value
 */
export function isValidRating(rating: number): boolean {
  return (
    Number.isInteger(rating) &&
    rating >= APPRAISAL_VALIDATION.MIN_RATING &&
    rating <= APPRAISAL_VALIDATION.MAX_RATING
  );
}

/**
 * Helper function to validate self-assessment text length
 */
export function isValidSelfAssessment(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.trim().length > 0 &&
    text.length <= APPRAISAL_VALIDATION.SELF_ASSESSMENT_MAX_LENGTH
  );
}

/**
 * Helper function to validate manager feedback text length
 */
export function isValidManagerFeedback(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.trim().length > 0 &&
    text.length <= APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH
  );
}

/**
 * Helper function to validate goal title
 */
export function isValidGoalTitle(title: string): boolean {
  return (
    typeof title === 'string' &&
    title.trim().length > 0 &&
    title.length <= APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH
  );
}

/**
 * Helper function to validate goal description
 */
export function isValidGoalDescription(description: string): boolean {
  return (
    typeof description === 'string' &&
    description.trim().length > 0 &&
    description.length <= APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH
  );
}

/**
 * Type for appraisal sort fields
 */
export type AppraisalSortField = 'createdAt' | 'updatedAt' | 'rating' | 'status';

/**
 * Type for sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Appraisal list query parameters
 */
export interface AppraisalListParams {
  /** Filter criteria */
  readonly filters?: AppraisalFilters;
  
  /** Sort field */
  readonly sortBy?: AppraisalSortField;
  
  /** Sort order */
  readonly sortOrder?: SortOrder;
  
  /** Page number for pagination */
  readonly page?: number;
  
  /** Items per page */
  readonly limit?: number;
}

/**
 * Export all types for convenient importing
 */
export type {
  Goal,
  Appraisal,
  AppraisalFilters,
  CreateAppraisalRequest,
  SubmitSelfAssessmentRequest,
  SubmitManagerReviewRequest,
  CreateGoalRequest,
  UpdateGoalRequest,
  AppraisalSortField,
  SortOrder,
  AppraisalListParams,
};

export {
  AppraisalStatus,
  GoalStatus,
  APPRAISAL_VALIDATION,
};