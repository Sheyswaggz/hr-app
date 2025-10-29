/**
 * Custom React Hook for Appraisals Management
 * 
 * Provides comprehensive state management for performance appraisals including:
 * - Fetching appraisals based on user role (my/team/all)
 * - Creating new appraisals
 * - Submitting self-assessments
 * - Submitting manager reviews
 * - Managing goals
 * - Optimistic updates for better UX
 * - Filtering and sorting capabilities
 * 
 * @module hooks/useAppraisals
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Appraisal,
  AppraisalFilters,
  CreateAppraisalRequest,
  SubmitSelfAssessmentRequest,
  SubmitManagerReviewRequest,
  UpdateGoalsRequest,
  AppraisalStatus,
  GoalStatus,
} from '../types/appraisal';
import {
  createAppraisal,
  getAppraisal,
  getMyAppraisals,
  getTeamAppraisals,
  getAllAppraisals,
  submitSelfAssessment,
  submitReview,
  updateGoals,
} from '../api/appraisal';
import { handleApiError, ApiErrorResponse } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

/**
 * Appraisal view type based on user role
 */
export type AppraisalView = 'my' | 'team' | 'all';

/**
 * Loading state for different operations
 */
interface LoadingStates {
  readonly fetch: boolean;
  readonly create: boolean;
  readonly submitAssessment: boolean;
  readonly submitReview: boolean;
  readonly updateGoals: boolean;
}

/**
 * Error state for different operations
 */
interface ErrorStates {
  readonly fetch: ApiErrorResponse | null;
  readonly create: ApiErrorResponse | null;
  readonly submitAssessment: ApiErrorResponse | null;
  readonly submitReview: ApiErrorResponse | null;
  readonly updateGoals: ApiErrorResponse | null;
}

/**
 * Hook return type
 */
export interface UseAppraisalsReturn {
  /** Array of appraisals */
  readonly appraisals: Appraisal[];
  
  /** Loading states for different operations */
  readonly loading: LoadingStates;
  
  /** Error states for different operations */
  readonly error: ErrorStates;
  
  /** Create a new appraisal */
  readonly createAppraisal: (
    employeeId: string,
    reviewPeriod: { start: string; end: string }
  ) => Promise<Appraisal | null>;
  
  /** Submit self-assessment for an appraisal */
  readonly submitSelfAssessment: (
    appraisalId: string,
    data: SubmitSelfAssessmentRequest
  ) => Promise<Appraisal | null>;
  
  /** Submit manager review for an appraisal */
  readonly submitReview: (
    appraisalId: string,
    data: SubmitManagerReviewRequest
  ) => Promise<Appraisal | null>;
  
  /** Update goals for an appraisal */
  readonly updateGoals: (
    appraisalId: string,
    goals: UpdateGoalsRequest['goals']
  ) => Promise<Appraisal | null>;
  
  /** Refetch appraisals */
  readonly refetch: () => Promise<void>;
  
  /** Get a single appraisal by ID */
  readonly getAppraisalById: (id: string) => Promise<Appraisal | null>;
  
  /** Filter appraisals locally */
  readonly filterAppraisals: (filters: AppraisalFilters) => Appraisal[];
  
  /** Sort appraisals locally */
  readonly sortAppraisals: (
    sortBy: 'createdAt' | 'updatedAt' | 'reviewPeriodStart' | 'reviewPeriodEnd' | 'rating',
    sortOrder: 'asc' | 'desc'
  ) => Appraisal[];
}

/**
 * Hook options
 */
export interface UseAppraisalsOptions {
  /** View type: 'my' for employee view, 'team' for manager view, 'all' for admin view */
  readonly view?: AppraisalView;
  
  /** Initial filters to apply */
  readonly filters?: AppraisalFilters;
  
  /** Whether to fetch on mount */
  readonly fetchOnMount?: boolean;
  
  /** Polling interval in milliseconds (0 to disable) */
  readonly pollingInterval?: number;
}

/**
 * Custom hook for managing appraisals state
 * 
 * @param options - Hook configuration options
 * @returns Appraisals state and operations
 * 
 * @example
 * ```tsx
 * // Employee view - fetch my appraisals
 * const { appraisals, loading, submitSelfAssessment } = useAppraisals({
 *   view: 'my',
 *   fetchOnMount: true,
 * });
 * 
 * // Manager view - fetch team appraisals
 * const { appraisals, loading, createAppraisal, submitReview } = useAppraisals({
 *   view: 'team',
 *   fetchOnMount: true,
 * });
 * 
 * // Admin view - fetch all appraisals with filters
 * const { appraisals, loading, filterAppraisals } = useAppraisals({
 *   view: 'all',
 *   filters: { status: AppraisalStatus.SUBMITTED },
 *   fetchOnMount: true,
 * });
 * ```
 */
export function useAppraisals(options: UseAppraisalsOptions = {}): UseAppraisalsReturn {
  const {
    view = 'my',
    filters,
    fetchOnMount = true,
    pollingInterval = 0,
  } = options;

  const { user } = useAuth();
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState<LoadingStates>({
    fetch: false,
    create: false,
    submitAssessment: false,
    submitReview: false,
    updateGoals: false,
  });
  const [error, setError] = useState<ErrorStates>({
    fetch: null,
    create: null,
    submitAssessment: null,
    submitReview: null,
    updateGoals: null,
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Update loading state for a specific operation
   */
  const setOperationLoading = useCallback((operation: keyof LoadingStates, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }));
  }, []);

  /**
   * Update error state for a specific operation
   */
  const setOperationError = useCallback((operation: keyof ErrorStates, err: ApiErrorResponse | null) => {
    setError(prev => ({ ...prev, [operation]: err }));
  }, []);

  /**
   * Fetch appraisals based on view type
   */
  const fetchAppraisals = useCallback(async () => {
    if (!user) {
      console.warn('[useAppraisals] Cannot fetch appraisals: user not authenticated', {
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setOperationLoading('fetch', true);
    setOperationError('fetch', null);

    try {
      console.info('[useAppraisals] Fetching appraisals', {
        view,
        filters,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      let fetchedAppraisals: Appraisal[];

      switch (view) {
        case 'my':
          fetchedAppraisals = await getMyAppraisals();
          break;
        case 'team':
          fetchedAppraisals = await getTeamAppraisals();
          break;
        case 'all':
          fetchedAppraisals = await getAllAppraisals(filters);
          break;
        default:
          throw new Error(`Invalid view type: ${view}`);
      }

      if (isMountedRef.current) {
        setAppraisals(fetchedAppraisals);
        console.info('[useAppraisals] Appraisals fetched successfully', {
          count: fetchedAppraisals.length,
          view,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const apiError = handleApiError(err);
      console.error('[useAppraisals] Failed to fetch appraisals', {
        view,
        error: apiError,
        timestamp: new Date().toISOString(),
      });
      if (isMountedRef.current) {
        setOperationError('fetch', apiError);
      }
    } finally {
      if (isMountedRef.current) {
        setOperationLoading('fetch', false);
      }
    }
  }, [view, filters, user, setOperationLoading, setOperationError]);

  /**
   * Create a new appraisal with optimistic update
   */
  const handleCreateAppraisal = useCallback(
    async (employeeId: string, reviewPeriod: { start: string; end: string }): Promise<Appraisal | null> => {
      if (!user) {
        console.error('[useAppraisals] Cannot create appraisal: user not authenticated', {
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      setOperationLoading('create', true);
      setOperationError('create', null);

      try {
        console.info('[useAppraisals] Creating appraisal', {
          employeeId,
          reviewPeriod,
          reviewerId: user.id,
          timestamp: new Date().toISOString(),
        });

        const newAppraisal = await createAppraisal(employeeId, reviewPeriod);

        if (isMountedRef.current) {
          // Optimistic update
          setAppraisals(prev => [newAppraisal, ...prev]);
          console.info('[useAppraisals] Appraisal created successfully', {
            appraisalId: newAppraisal.id,
            timestamp: new Date().toISOString(),
          });
        }

        return newAppraisal;
      } catch (err) {
        const apiError = handleApiError(err);
        console.error('[useAppraisals] Failed to create appraisal', {
          employeeId,
          reviewPeriod,
          error: apiError,
          timestamp: new Date().toISOString(),
        });
        if (isMountedRef.current) {
          setOperationError('create', apiError);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setOperationLoading('create', false);
        }
      }
    },
    [user, setOperationLoading, setOperationError]
  );

  /**
   * Submit self-assessment with optimistic update
   */
  const handleSubmitSelfAssessment = useCallback(
    async (appraisalId: string, data: SubmitSelfAssessmentRequest): Promise<Appraisal | null> => {
      setOperationLoading('submitAssessment', true);
      setOperationError('submitAssessment', null);

      // Store original state for rollback
      const originalAppraisals = [...appraisals];

      try {
        console.info('[useAppraisals] Submitting self-assessment', {
          appraisalId,
          assessmentLength: data.selfAssessment.length,
          goalsCount: data.goals?.length || 0,
          timestamp: new Date().toISOString(),
        });

        // Optimistic update
        if (isMountedRef.current) {
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId
                ? {
                    ...appraisal,
                    selfAssessment: data.selfAssessment,
                    status: AppraisalStatus.SUBMITTED,
                    selfAssessmentSubmittedAt: new Date().toISOString(),
                  }
                : appraisal
            )
          );
        }

        const updatedAppraisal = await submitSelfAssessment(appraisalId, data);

        if (isMountedRef.current) {
          // Update with actual server response
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId ? updatedAppraisal : appraisal
            )
          );
          console.info('[useAppraisals] Self-assessment submitted successfully', {
            appraisalId,
            status: updatedAppraisal.status,
            timestamp: new Date().toISOString(),
          });
        }

        return updatedAppraisal;
      } catch (err) {
        const apiError = handleApiError(err);
        console.error('[useAppraisals] Failed to submit self-assessment', {
          appraisalId,
          error: apiError,
          timestamp: new Date().toISOString(),
        });

        // Rollback optimistic update
        if (isMountedRef.current) {
          setAppraisals(originalAppraisals);
          setOperationError('submitAssessment', apiError);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setOperationLoading('submitAssessment', false);
        }
      }
    },
    [appraisals, setOperationLoading, setOperationError]
  );

  /**
   * Submit manager review with optimistic update
   */
  const handleSubmitReview = useCallback(
    async (appraisalId: string, data: SubmitManagerReviewRequest): Promise<Appraisal | null> => {
      setOperationLoading('submitReview', true);
      setOperationError('submitReview', null);

      // Store original state for rollback
      const originalAppraisals = [...appraisals];

      try {
        console.info('[useAppraisals] Submitting manager review', {
          appraisalId,
          feedbackLength: data.managerFeedback.length,
          rating: data.rating,
          timestamp: new Date().toISOString(),
        });

        // Optimistic update
        if (isMountedRef.current) {
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId
                ? {
                    ...appraisal,
                    managerFeedback: data.managerFeedback,
                    rating: data.rating,
                    status: AppraisalStatus.COMPLETED,
                    reviewCompletedAt: new Date().toISOString(),
                  }
                : appraisal
            )
          );
        }

        const updatedAppraisal = await submitReview(appraisalId, data);

        if (isMountedRef.current) {
          // Update with actual server response
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId ? updatedAppraisal : appraisal
            )
          );
          console.info('[useAppraisals] Manager review submitted successfully', {
            appraisalId,
            status: updatedAppraisal.status,
            rating: data.rating,
            timestamp: new Date().toISOString(),
          });
        }

        return updatedAppraisal;
      } catch (err) {
        const apiError = handleApiError(err);
        console.error('[useAppraisals] Failed to submit manager review', {
          appraisalId,
          error: apiError,
          timestamp: new Date().toISOString(),
        });

        // Rollback optimistic update
        if (isMountedRef.current) {
          setAppraisals(originalAppraisals);
          setOperationError('submitReview', apiError);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setOperationLoading('submitReview', false);
        }
      }
    },
    [appraisals, setOperationLoading, setOperationError]
  );

  /**
   * Update goals with optimistic update
   */
  const handleUpdateGoals = useCallback(
    async (appraisalId: string, goals: UpdateGoalsRequest['goals']): Promise<Appraisal | null> => {
      setOperationLoading('updateGoals', true);
      setOperationError('updateGoals', null);

      // Store original state for rollback
      const originalAppraisals = [...appraisals];

      try {
        console.info('[useAppraisals] Updating goals', {
          appraisalId,
          goalsCount: goals.length,
          timestamp: new Date().toISOString(),
        });

        // Optimistic update
        if (isMountedRef.current) {
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId
                ? { ...appraisal, goals: goals as any }
                : appraisal
            )
          );
        }

        const updatedAppraisal = await updateGoals(appraisalId, goals);

        if (isMountedRef.current) {
          // Update with actual server response
          setAppraisals(prev =>
            prev.map(appraisal =>
              appraisal.id === appraisalId ? updatedAppraisal : appraisal
            )
          );
          console.info('[useAppraisals] Goals updated successfully', {
            appraisalId,
            goalsCount: updatedAppraisal.goals.length,
            timestamp: new Date().toISOString(),
          });
        }

        return updatedAppraisal;
      } catch (err) {
        const apiError = handleApiError(err);
        console.error('[useAppraisals] Failed to update goals', {
          appraisalId,
          error: apiError,
          timestamp: new Date().toISOString(),
        });

        // Rollback optimistic update
        if (isMountedRef.current) {
          setAppraisals(originalAppraisals);
          setOperationError('updateGoals', apiError);
        }
        return null;
      } finally {
        if (isMountedRef.current) {
          setOperationLoading('updateGoals', false);
        }
      }
    },
    [appraisals, setOperationLoading, setOperationError]
  );

  /**
   * Get a single appraisal by ID
   */
  const getAppraisalById = useCallback(
    async (id: string): Promise<Appraisal | null> => {
      try {
        console.debug('[useAppraisals] Fetching appraisal by ID', {
          appraisalId: id,
          timestamp: new Date().toISOString(),
        });

        const appraisal = await getAppraisal(id);

        // Update local state if appraisal exists
        if (isMountedRef.current) {
          setAppraisals(prev => {
            const exists = prev.some(a => a.id === id);
            if (exists) {
              return prev.map(a => (a.id === id ? appraisal : a));
            }
            return [appraisal, ...prev];
          });
        }

        return appraisal;
      } catch (err) {
        const apiError = handleApiError(err);
        console.error('[useAppraisals] Failed to fetch appraisal by ID', {
          appraisalId: id,
          error: apiError,
          timestamp: new Date().toISOString(),
        });
        return null;
      }
    },
    []
  );

  /**
   * Filter appraisals locally
   */
  const filterAppraisals = useCallback(
    (filterCriteria: AppraisalFilters): Appraisal[] => {
      console.debug('[useAppraisals] Filtering appraisals', {
        filters: filterCriteria,
        totalCount: appraisals.length,
        timestamp: new Date().toISOString(),
      });

      return appraisals.filter(appraisal => {
        if (filterCriteria.status) {
          const statuses = Array.isArray(filterCriteria.status)
            ? filterCriteria.status
            : [filterCriteria.status];
          if (!statuses.includes(appraisal.status)) return false;
        }

        if (filterCriteria.employeeId && appraisal.employeeId !== filterCriteria.employeeId) {
          return false;
        }

        if (filterCriteria.reviewerId && appraisal.reviewerId !== filterCriteria.reviewerId) {
          return false;
        }

        if (filterCriteria.startDate) {
          const startDate = new Date(filterCriteria.startDate);
          const appraisalDate = new Date(appraisal.reviewPeriodStart);
          if (appraisalDate < startDate) return false;
        }

        if (filterCriteria.endDate) {
          const endDate = new Date(filterCriteria.endDate);
          const appraisalDate = new Date(appraisal.reviewPeriodEnd);
          if (appraisalDate > endDate) return false;
        }

        if (filterCriteria.minRating !== undefined && appraisal.rating !== null) {
          if (appraisal.rating < filterCriteria.minRating) return false;
        }

        if (filterCriteria.maxRating !== undefined && appraisal.rating !== null) {
          if (appraisal.rating > filterCriteria.maxRating) return false;
        }

        return true;
      });
    },
    [appraisals]
  );

  /**
   * Sort appraisals locally
   */
  const sortAppraisals = useCallback(
    (
      sortBy: 'createdAt' | 'updatedAt' | 'reviewPeriodStart' | 'reviewPeriodEnd' | 'rating',
      sortOrder: 'asc' | 'desc'
    ): Appraisal[] => {
      console.debug('[useAppraisals] Sorting appraisals', {
        sortBy,
        sortOrder,
        totalCount: appraisals.length,
        timestamp: new Date().toISOString(),
      });

      return [...appraisals].sort((a, b) => {
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];

        // Handle null values
        if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? -1 : 1;

        // Convert dates to timestamps for comparison
        if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'reviewPeriodStart' || sortBy === 'reviewPeriodEnd') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },
    [appraisals]
  );

  /**
   * Setup polling if interval is provided
   */
  useEffect(() => {
    if (pollingInterval > 0) {
      console.info('[useAppraisals] Setting up polling', {
        interval: pollingInterval,
        timestamp: new Date().toISOString(),
      });

      pollingIntervalRef.current = setInterval(() => {
        fetchAppraisals();
      }, pollingInterval);

      return () => {
        if (pollingIntervalRef.current) {
          console.info('[useAppraisals] Clearing polling interval', {
            timestamp: new Date().toISOString(),
          });
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [pollingInterval, fetchAppraisals]);

  /**
   * Fetch appraisals on mount if enabled
   */
  useEffect(() => {
    if (fetchOnMount && user) {
      fetchAppraisals();
    }
  }, [fetchOnMount, user, fetchAppraisals]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    appraisals,
    loading,
    error,
    createAppraisal: handleCreateAppraisal,
    submitSelfAssessment: handleSubmitSelfAssessment,
    submitReview: handleSubmitReview,
    updateGoals: handleUpdateGoals,
    refetch: fetchAppraisals,
    getAppraisalById,
    filterAppraisals,
    sortAppraisals,
  };
}

export default useAppraisals;