/**
 * Appraisal API Service
 * 
 * Provides frontend API functions for performance appraisal management.
 * Handles appraisal creation, self-assessment submission, manager reviews,
 * goal management, and appraisal history retrieval.
 * 
 * All functions include proper error handling, TypeScript types, and logging.
 */

import { apiClient, ApiSuccessResponse, handleApiError } from './client';

/**
 * Appraisal status enum matching backend
 */
export enum AppraisalStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Goal status enum matching backend
 */
export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Goal interface
 */
export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly targetDate?: string;
  readonly completedDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Appraisal interface
 */
export interface Appraisal {
  readonly id: string;
  readonly employeeId: string;
  readonly reviewerId: string;
  readonly reviewPeriodStart: string;
  readonly reviewPeriodEnd: string;
  readonly status: AppraisalStatus;
  readonly selfAssessment?: string;
  readonly managerFeedback?: string;
  readonly rating?: number;
  readonly goals: Goal[];
  readonly selfAssessmentSubmittedAt?: string;
  readonly reviewCompletedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly employee?: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly position?: string;
    readonly department?: string;
  };
  readonly reviewer?: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
  };
}

/**
 * Create appraisal request payload
 */
export interface CreateAppraisalRequest {
  readonly employeeId: string;
  readonly reviewPeriodStart: string;
  readonly reviewPeriodEnd: string;
}

/**
 * Submit self-assessment request payload
 */
export interface SubmitSelfAssessmentRequest {
  readonly selfAssessment: string;
  readonly goals?: Array<{
    readonly title: string;
    readonly description: string;
    readonly targetDate?: string;
  }>;
}

/**
 * Submit manager review request payload
 */
export interface SubmitManagerReviewRequest {
  readonly managerFeedback: string;
  readonly rating: number;
}

/**
 * Update goals request payload
 */
export interface UpdateGoalsRequest {
  readonly goals: Array<{
    readonly id?: string;
    readonly title: string;
    readonly description: string;
    readonly status: GoalStatus;
    readonly targetDate?: string;
    readonly completedDate?: string;
  }>;
}

/**
 * Appraisal filter options
 */
export interface AppraisalFilters {
  readonly status?: AppraisalStatus | AppraisalStatus[];
  readonly employeeId?: string;
  readonly reviewerId?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly minRating?: number;
  readonly maxRating?: number;
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'reviewPeriodStart' | 'reviewPeriodEnd' | 'rating';
  readonly sortOrder?: 'asc' | 'desc';
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Create a new appraisal
 * 
 * @param employeeId - ID of the employee being appraised
 * @param reviewPeriod - Review period with start and end dates
 * @returns Promise resolving to created appraisal
 * @throws ApiErrorResponse on failure
 */
export async function createAppraisal(
  employeeId: string,
  reviewPeriod: { start: string; end: string }
): Promise<Appraisal> {
  try {
    console.info('[Appraisal API] Creating appraisal', {
      employeeId,
      reviewPeriod,
      timestamp: new Date().toISOString(),
    });

    const payload: CreateAppraisalRequest = {
      employeeId,
      reviewPeriodStart: reviewPeriod.start,
      reviewPeriodEnd: reviewPeriod.end,
    };

    const response = await apiClient.post<ApiSuccessResponse<Appraisal>>(
      '/appraisals',
      payload
    );

    console.info('[Appraisal API] Appraisal created successfully', {
      appraisalId: response.data.data.id,
      status: response.data.data.status,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to create appraisal', {
      employeeId,
      reviewPeriod,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Get a single appraisal by ID
 * 
 * @param id - Appraisal ID
 * @returns Promise resolving to appraisal details
 * @throws ApiErrorResponse on failure
 */
export async function getAppraisal(id: string): Promise<Appraisal> {
  try {
    console.debug('[Appraisal API] Fetching appraisal', {
      appraisalId: id,
      timestamp: new Date().toISOString(),
    });

    const response = await apiClient.get<ApiSuccessResponse<Appraisal>>(
      `/appraisals/${id}`
    );

    console.debug('[Appraisal API] Appraisal fetched successfully', {
      appraisalId: id,
      status: response.data.data.status,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to fetch appraisal', {
      appraisalId: id,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Get current user's appraisals (employee view)
 * 
 * @returns Promise resolving to array of appraisals
 * @throws ApiErrorResponse on failure
 */
export async function getMyAppraisals(): Promise<Appraisal[]> {
  try {
    console.debug('[Appraisal API] Fetching my appraisals', {
      timestamp: new Date().toISOString(),
    });

    const response = await apiClient.get<ApiSuccessResponse<Appraisal[]>>(
      '/appraisals/my-appraisals'
    );

    console.debug('[Appraisal API] My appraisals fetched successfully', {
      count: response.data.data.length,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to fetch my appraisals', {
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Get team appraisals (manager view)
 * 
 * @returns Promise resolving to array of team member appraisals
 * @throws ApiErrorResponse on failure
 */
export async function getTeamAppraisals(): Promise<Appraisal[]> {
  try {
    console.debug('[Appraisal API] Fetching team appraisals', {
      timestamp: new Date().toISOString(),
    });

    const response = await apiClient.get<ApiSuccessResponse<Appraisal[]>>(
      '/appraisals/team'
    );

    console.debug('[Appraisal API] Team appraisals fetched successfully', {
      count: response.data.data.length,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to fetch team appraisals', {
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Get all appraisals with optional filters (admin/manager view)
 * 
 * @param filters - Optional filter criteria
 * @returns Promise resolving to array of appraisals
 * @throws ApiErrorResponse on failure
 */
export async function getAllAppraisals(
  filters?: AppraisalFilters
): Promise<Appraisal[]> {
  try {
    console.debug('[Appraisal API] Fetching all appraisals', {
      filters,
      timestamp: new Date().toISOString(),
    });

    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        statuses.forEach(status => params.append('status', status));
      }
      if (filters.employeeId) params.append('employeeId', filters.employeeId);
      if (filters.reviewerId) params.append('reviewerId', filters.reviewerId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minRating !== undefined) params.append('minRating', filters.minRating.toString());
      if (filters.maxRating !== undefined) params.append('maxRating', filters.maxRating.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.page !== undefined) params.append('page', filters.page.toString());
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    }

    const queryString = params.toString();
    const url = queryString ? `/appraisals?${queryString}` : '/appraisals';

    const response = await apiClient.get<ApiSuccessResponse<Appraisal[]>>(url);

    console.debug('[Appraisal API] All appraisals fetched successfully', {
      count: response.data.data.length,
      filters,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to fetch all appraisals', {
      filters,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Submit self-assessment for an appraisal
 * 
 * @param id - Appraisal ID
 * @param data - Self-assessment data including text and optional goals
 * @returns Promise resolving to updated appraisal
 * @throws ApiErrorResponse on failure
 */
export async function submitSelfAssessment(
  id: string,
  data: SubmitSelfAssessmentRequest
): Promise<Appraisal> {
  try {
    console.info('[Appraisal API] Submitting self-assessment', {
      appraisalId: id,
      assessmentLength: data.selfAssessment.length,
      goalsCount: data.goals?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Validate self-assessment length
    if (data.selfAssessment.length > 5000) {
      const error = {
        message: 'Self-assessment text exceeds maximum length of 5000 characters',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      };
      console.error('[Appraisal API] Self-assessment validation failed', error);
      throw error;
    }

    const response = await apiClient.post<ApiSuccessResponse<Appraisal>>(
      `/appraisals/${id}/self-assessment`,
      data
    );

    console.info('[Appraisal API] Self-assessment submitted successfully', {
      appraisalId: id,
      status: response.data.data.status,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to submit self-assessment', {
      appraisalId: id,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Submit manager review for an appraisal
 * 
 * @param id - Appraisal ID
 * @param data - Manager review data including feedback and rating
 * @returns Promise resolving to updated appraisal
 * @throws ApiErrorResponse on failure
 */
export async function submitReview(
  id: string,
  data: SubmitManagerReviewRequest
): Promise<Appraisal> {
  try {
    console.info('[Appraisal API] Submitting manager review', {
      appraisalId: id,
      feedbackLength: data.managerFeedback.length,
      rating: data.rating,
      timestamp: new Date().toISOString(),
    });

    // Validate manager feedback length
    if (data.managerFeedback.length > 5000) {
      const error = {
        message: 'Manager feedback text exceeds maximum length of 5000 characters',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      };
      console.error('[Appraisal API] Manager feedback validation failed', error);
      throw error;
    }

    // Validate rating range
    if (data.rating < 1 || data.rating > 5) {
      const error = {
        message: 'Rating must be between 1 and 5',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      };
      console.error('[Appraisal API] Rating validation failed', error);
      throw error;
    }

    const response = await apiClient.post<ApiSuccessResponse<Appraisal>>(
      `/appraisals/${id}/review`,
      data
    );

    console.info('[Appraisal API] Manager review submitted successfully', {
      appraisalId: id,
      status: response.data.data.status,
      rating: data.rating,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to submit manager review', {
      appraisalId: id,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Update goals for an appraisal
 * 
 * @param id - Appraisal ID
 * @param goals - Array of goals to update/create
 * @returns Promise resolving to updated appraisal
 * @throws ApiErrorResponse on failure
 */
export async function updateGoals(
  id: string,
  goals: UpdateGoalsRequest['goals']
): Promise<Appraisal> {
  try {
    console.info('[Appraisal API] Updating goals', {
      appraisalId: id,
      goalsCount: goals.length,
      timestamp: new Date().toISOString(),
    });

    // Validate goal fields
    for (const goal of goals) {
      if (goal.title.length > 200) {
        const error = {
          message: 'Goal title exceeds maximum length of 200 characters',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        console.error('[Appraisal API] Goal title validation failed', error);
        throw error;
      }

      if (goal.description.length > 1000) {
        const error = {
          message: 'Goal description exceeds maximum length of 1000 characters',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        };
        console.error('[Appraisal API] Goal description validation failed', error);
        throw error;
      }
    }

    const payload: UpdateGoalsRequest = { goals };

    const response = await apiClient.put<ApiSuccessResponse<Appraisal>>(
      `/appraisals/${id}/goals`,
      payload
    );

    console.info('[Appraisal API] Goals updated successfully', {
      appraisalId: id,
      goalsCount: response.data.data.goals.length,
      timestamp: new Date().toISOString(),
    });

    return response.data.data;
  } catch (error) {
    console.error('[Appraisal API] Failed to update goals', {
      appraisalId: id,
      error: handleApiError(error),
      timestamp: new Date().toISOString(),
    });
    throw handleApiError(error);
  }
}

/**
 * Type guard to check if value is AppraisalStatus
 */
export function isAppraisalStatus(value: unknown): value is AppraisalStatus {
  return (
    typeof value === 'string' &&
    Object.values(AppraisalStatus).includes(value as AppraisalStatus)
  );
}

/**
 * Type guard to check if value is GoalStatus
 */
export function isGoalStatus(value: unknown): value is GoalStatus {
  return (
    typeof value === 'string' &&
    Object.values(GoalStatus).includes(value as GoalStatus)
  );
}

/**
 * Type guard to check if value is Appraisal
 */
export function isAppraisal(value: unknown): value is Appraisal {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.employeeId === 'string' &&
    typeof obj.reviewerId === 'string' &&
    typeof obj.reviewPeriodStart === 'string' &&
    typeof obj.reviewPeriodEnd === 'string' &&
    isAppraisalStatus(obj.status) &&
    Array.isArray(obj.goals)
  );
}

/**
 * Default export with all API functions
 */
export default {
  createAppraisal,
  getAppraisal,
  getMyAppraisals,
  getTeamAppraisals,
  getAllAppraisals,
  submitSelfAssessment,
  submitReview,
  updateGoals,
  isAppraisalStatus,
  isGoalStatus,
  isAppraisal,
};