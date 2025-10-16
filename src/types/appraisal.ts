/**
 * Appraisal Type Definitions
 * 
 * Comprehensive type definitions for the performance appraisal system.
 * Includes interfaces for appraisals, goals, status enums, and validation helpers.
 * 
 * @module types/appraisal
 */

import type { BaseEntity } from './index';

/**
 * Appraisal status enumeration
 * 
 * Defines the workflow states for performance appraisals.
 * Follows a linear progression: draft -> submitted -> completed
 */
export enum AppraisalStatus {
  /**
   * Appraisal has been created but not yet submitted by employee
   */
  Draft = 'DRAFT',

  /**
   * Employee has submitted self-assessment, awaiting manager review
   */
  Submitted = 'SUBMITTED',

  /**
   * Manager has completed review and provided rating
   */
  Completed = 'COMPLETED',
}

/**
 * Goal status enumeration
 * 
 * Defines the lifecycle states for individual goals within an appraisal.
 */
export enum GoalStatus {
  /**
   * Goal has been defined but work has not started
   */
  NotStarted = 'NOT_STARTED',

  /**
   * Goal is actively being worked on
   */
  InProgress = 'IN_PROGRESS',

  /**
   * Goal has been successfully achieved
   */
  Achieved = 'ACHIEVED',

  /**
   * Goal was not achieved within the review period
   */
  NotAchieved = 'NOT_ACHIEVED',
}

/**
 * Individual goal within an appraisal
 * 
 * Represents a specific objective or target set for an employee
 * during the review period.
 */
export interface Goal {
  /**
   * Unique identifier for the goal
   */
  readonly id: string;

  /**
   * Goal title (max 200 characters)
   */
  title: string;

  /**
   * Detailed description of the goal (max 2000 characters)
   */
  description: string;

  /**
   * Target date for goal completion
   */
  targetDate: Date;

  /**
   * Current status of the goal
   */
  status: GoalStatus;

  /**
   * Optional notes about goal progress or completion
   */
  notes?: string;

  /**
   * Timestamp when goal was created
   */
  readonly createdAt: Date;

  /**
   * Timestamp when goal was last updated
   */
  readonly updatedAt: Date;
}

/**
 * Performance appraisal entity
 * 
 * Represents a complete performance review cycle including self-assessment,
 * manager feedback, rating, and goals.
 */
export interface Appraisal extends BaseEntity {
  /**
   * Employee being appraised
   */
  employeeId: string;

  /**
   * Manager conducting the review
   */
  reviewerId: string;

  /**
   * Start date of the review period
   */
  reviewPeriodStart: Date;

  /**
   * End date of the review period
   */
  reviewPeriodEnd: Date;

  /**
   * Employee's self-assessment text (max 5000 characters)
   */
  selfAssessment?: string;

  /**
   * Manager's feedback and comments (max 5000 characters)
   */
  managerFeedback?: string;

  /**
   * Overall performance rating (1-5 scale)
   * 1 = Needs Improvement, 2 = Below Expectations, 3 = Meets Expectations,
   * 4 = Exceeds Expectations, 5 = Outstanding
   */
  rating?: number;

  /**
   * Array of goals set for this review period
   */
  goals: Goal[];

  /**
   * Current status of the appraisal
   */
  status: AppraisalStatus;

  /**
   * Timestamp when self-assessment was submitted
   */
  selfAssessmentSubmittedAt?: Date;

  /**
   * Timestamp when manager review was completed
   */
  reviewCompletedAt?: Date;
}

/**
 * Request payload for creating a new appraisal
 */
export interface CreateAppraisalRequest {
  /**
   * Employee to be appraised
   */
  employeeId: string;

  /**
   * Manager conducting the review
   */
  reviewerId: string;

  /**
   * Start date of the review period
   */
  reviewPeriodStart: Date;

  /**
   * End date of the review period
   */
  reviewPeriodEnd: Date;

  /**
   * Optional initial goals for the review period
   */
  goals?: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>[];
}

/**
 * Request payload for submitting self-assessment
 */
export interface SubmitSelfAssessmentRequest {
  /**
   * Appraisal identifier
   */
  appraisalId: string;

  /**
   * Employee's self-assessment text (max 5000 characters)
   */
  selfAssessment: string;

  /**
   * Optional updates to goal statuses
   */
  goalUpdates?: Array<{
    goalId: string;
    status: GoalStatus;
    notes?: string;
  }>;
}

/**
 * Request payload for submitting manager review
 */
export interface SubmitManagerReviewRequest {
  /**
   * Appraisal identifier
   */
  appraisalId: string;

  /**
   * Manager's feedback and comments (max 5000 characters)
   */
  managerFeedback: string;

  /**
   * Overall performance rating (1-5)
   */
  rating: number;

  /**
   * Optional updates to goal statuses
   */
  goalUpdates?: Array<{
    goalId: string;
    status: GoalStatus;
    notes?: string;
  }>;
}

/**
 * Request payload for updating goals
 */
export interface UpdateGoalsRequest {
  /**
   * Appraisal identifier
   */
  appraisalId: string;

  /**
   * Goals to add
   */
  goalsToAdd?: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>[];

  /**
   * Goals to update
   */
  goalsToUpdate?: Array<{
    goalId: string;
    title?: string;
    description?: string;
    targetDate?: Date;
    status?: GoalStatus;
    notes?: string;
  }>;

  /**
   * Goal IDs to remove
   */
  goalsToRemove?: string[];
}

/**
 * Appraisal summary for list views
 */
export interface AppraisalSummary {
  /**
   * Appraisal identifier
   */
  id: string;

  /**
   * Employee information
   */
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle?: string;
  };

  /**
   * Reviewer information
   */
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  /**
   * Review period
   */
  reviewPeriod: {
    start: Date;
    end: Date;
  };

  /**
   * Current status
   */
  status: AppraisalStatus;

  /**
   * Overall rating (if completed)
   */
  rating?: number;

  /**
   * Number of goals
   */
  goalCount: number;

  /**
   * Number of achieved goals
   */
  achievedGoalCount: number;

  /**
   * Timestamp when created
   */
  createdAt: Date;

  /**
   * Timestamp when last updated
   */
  updatedAt: Date;
}

/**
 * Validation result for appraisal operations
 */
export interface AppraisalValidationResult {
  /**
   * Whether validation passed
   */
  isValid: boolean;

  /**
   * Array of validation errors
   */
  errors: string[];
}

/**
 * Type guard to check if a value is a valid AppraisalStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid AppraisalStatus
 */
export function isAppraisalStatus(value: unknown): value is AppraisalStatus {
  return (
    typeof value === 'string' &&
    Object.values(AppraisalStatus).includes(value as AppraisalStatus)
  );
}

/**
 * Type guard to check if a value is a valid GoalStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid GoalStatus
 */
export function isGoalStatus(value: unknown): value is GoalStatus {
  return (
    typeof value === 'string' &&
    Object.values(GoalStatus).includes(value as GoalStatus)
  );
}

/**
 * Type guard to check if a value is a valid Goal
 * 
 * @param value - Value to check
 * @returns True if value is a valid Goal
 */
export function isGoal(value: unknown): value is Goal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const goal = value as Record<string, unknown>;

  return (
    typeof goal.id === 'string' &&
    typeof goal.title === 'string' &&
    typeof goal.description === 'string' &&
    goal.targetDate instanceof Date &&
    isGoalStatus(goal.status) &&
    (goal.notes === undefined || typeof goal.notes === 'string') &&
    goal.createdAt instanceof Date &&
    goal.updatedAt instanceof Date
  );
}

/**
 * Type guard to check if a value is a valid Appraisal
 * 
 * @param value - Value to check
 * @returns True if value is a valid Appraisal
 */
export function isAppraisal(value: unknown): value is Appraisal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const appraisal = value as Record<string, unknown>;

  return (
    typeof appraisal.id === 'string' &&
    typeof appraisal.employeeId === 'string' &&
    typeof appraisal.reviewerId === 'string' &&
    appraisal.reviewPeriodStart instanceof Date &&
    appraisal.reviewPeriodEnd instanceof Date &&
    (appraisal.selfAssessment === undefined || typeof appraisal.selfAssessment === 'string') &&
    (appraisal.managerFeedback === undefined || typeof appraisal.managerFeedback === 'string') &&
    (appraisal.rating === undefined || typeof appraisal.rating === 'number') &&
    Array.isArray(appraisal.goals) &&
    isAppraisalStatus(appraisal.status) &&
    (appraisal.selfAssessmentSubmittedAt === undefined || appraisal.selfAssessmentSubmittedAt instanceof Date) &&
    (appraisal.reviewCompletedAt === undefined || appraisal.reviewCompletedAt instanceof Date) &&
    appraisal.createdAt instanceof Date &&
    appraisal.updatedAt instanceof Date
  );
}

/**
 * Validate appraisal status transition
 * 
 * Ensures status transitions follow the valid workflow:
 * draft -> submitted -> completed
 * 
 * @param currentStatus - Current appraisal status
 * @param newStatus - Desired new status
 * @returns Validation result with errors if invalid
 */
export function validateStatusTransition(
  currentStatus: AppraisalStatus,
  newStatus: AppraisalStatus
): AppraisalValidationResult {
  const errors: string[] = [];

  // Define valid transitions
  const validTransitions: Record<AppraisalStatus, AppraisalStatus[]> = {
    [AppraisalStatus.Draft]: [AppraisalStatus.Submitted],
    [AppraisalStatus.Submitted]: [AppraisalStatus.Completed],
    [AppraisalStatus.Completed]: [], // No transitions from completed
  };

  // Check if transition is valid
  const allowedTransitions = validTransitions[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    errors.push(
      `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
      `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none'}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate rating value
 * 
 * Ensures rating is within valid range (1-5)
 * 
 * @param rating - Rating value to validate
 * @returns Validation result with errors if invalid
 */
export function validateRating(rating: number): AppraisalValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(rating)) {
    errors.push('Rating must be an integer');
  }

  if (rating < 1 || rating > 5) {
    errors.push('Rating must be between 1 and 5');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate self-assessment text
 * 
 * Ensures self-assessment meets length requirements
 * 
 * @param selfAssessment - Self-assessment text to validate
 * @returns Validation result with errors if invalid
 */
export function validateSelfAssessment(selfAssessment: string): AppraisalValidationResult {
  const errors: string[] = [];

  if (typeof selfAssessment !== 'string') {
    errors.push('Self-assessment must be a string');
    return { isValid: false, errors };
  }

  const trimmed = selfAssessment.trim();

  if (trimmed.length === 0) {
    errors.push('Self-assessment cannot be empty');
  }

  if (trimmed.length > 5000) {
    errors.push('Self-assessment must not exceed 5000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate manager feedback text
 * 
 * Ensures manager feedback meets length requirements
 * 
 * @param managerFeedback - Manager feedback text to validate
 * @returns Validation result with errors if invalid
 */
export function validateManagerFeedback(managerFeedback: string): AppraisalValidationResult {
  const errors: string[] = [];

  if (typeof managerFeedback !== 'string') {
    errors.push('Manager feedback must be a string');
    return { isValid: false, errors };
  }

  const trimmed = managerFeedback.trim();

  if (trimmed.length === 0) {
    errors.push('Manager feedback cannot be empty');
  }

  if (trimmed.length > 5000) {
    errors.push('Manager feedback must not exceed 5000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate goal data
 * 
 * Ensures goal meets all requirements
 * 
 * @param goal - Goal data to validate
 * @returns Validation result with errors if invalid
 */
export function validateGoal(
  goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
): AppraisalValidationResult {
  const errors: string[] = [];

  if (!goal.title || goal.title.trim().length === 0) {
    errors.push('Goal title is required');
  } else if (goal.title.length > 200) {
    errors.push('Goal title must not exceed 200 characters');
  }

  if (!goal.description || goal.description.trim().length === 0) {
    errors.push('Goal description is required');
  } else if (goal.description.length > 2000) {
    errors.push('Goal description must not exceed 2000 characters');
  }

  if (!(goal.targetDate instanceof Date)) {
    errors.push('Goal target date must be a valid Date');
  } else if (goal.targetDate < new Date()) {
    errors.push('Goal target date must be in the future');
  }

  if (!isGoalStatus(goal.status)) {
    errors.push('Goal status must be a valid GoalStatus');
  }

  if (goal.notes !== undefined) {
    if (typeof goal.notes !== 'string') {
      errors.push('Goal notes must be a string');
    } else if (goal.notes.length > 2000) {
      errors.push('Goal notes must not exceed 2000 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate review period dates
 * 
 * Ensures review period dates are valid and logical
 * 
 * @param startDate - Review period start date
 * @param endDate - Review period end date
 * @returns Validation result with errors if invalid
 */
export function validateReviewPeriod(
  startDate: Date,
  endDate: Date
): AppraisalValidationResult {
  const errors: string[] = [];

  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    errors.push('Review period start date must be a valid Date');
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    errors.push('Review period end date must be a valid Date');
  }

  if (startDate >= endDate) {
    errors.push('Review period end date must be after start date');
  }

  const periodLengthDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (periodLengthDays < 30) {
    errors.push('Review period must be at least 30 days');
  }

  if (periodLengthDays > 365) {
    errors.push('Review period must not exceed 365 days');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Utility type for creating new appraisals
 */
export type CreateAppraisalPayload = Omit<
  Appraisal,
  'id' | 'createdAt' | 'updatedAt' | 'selfAssessment' | 'managerFeedback' | 'rating' | 'status' | 'selfAssessmentSubmittedAt' | 'reviewCompletedAt'
>;

/**
 * Utility type for updating appraisals
 */
export type UpdateAppraisalPayload = Partial<
  Omit<Appraisal, 'id' | 'createdAt' | 'updatedAt' | 'employeeId' | 'reviewerId'>
>;

/**
 * Utility type for creating new goals
 */
export type CreateGoalPayload = Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Utility type for updating goals
 */
export type UpdateGoalPayload = Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>>;