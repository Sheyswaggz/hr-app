/**
 * Team Progress Hook
 * 
 * Custom React hook for fetching and managing team onboarding progress data.
 * Provides loading states, error handling, and refetch capabilities for manager dashboards.
 * 
 * Features:
 * - Automatic data fetching on mount
 * - Loading and error state management
 * - Manual refetch capability
 * - Proper cleanup on unmount
 * - TypeScript type safety
 * - Development mode logging
 * 
 * @module hooks/useTeamProgress
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTeamProgress, TeamProgress } from '../api/onboarding';
import { ApiErrorResponse } from '../api/client';

/**
 * Hook state interface
 */
interface UseTeamProgressState {
  /** Team progress data array */
  readonly data: TeamProgress[];
  
  /** Loading state indicator */
  readonly isLoading: boolean;
  
  /** Error object if request failed */
  readonly error: ApiErrorResponse | null;
  
  /** Indicates if this is the initial load */
  readonly isInitialLoad: boolean;
}

/**
 * Hook return type
 */
interface UseTeamProgressReturn extends UseTeamProgressState {
  /** Function to manually refetch team progress data */
  readonly refetch: () => Promise<void>;
  
  /** Indicates if a refetch is currently in progress */
  readonly isRefetching: boolean;
}

/**
 * Custom hook for fetching team onboarding progress
 * 
 * Automatically fetches team progress data on component mount and provides
 * methods to refetch data manually. Handles loading states, errors, and
 * cleanup properly.
 * 
 * @returns Object containing team progress data, loading states, error, and refetch function
 * 
 * @example
 * ```tsx
 * function TeamProgressDashboard() {
 *   const { data, isLoading, error, refetch, isRefetching } = useTeamProgress();
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 * 
 *   return (
 *     <div>
 *       <Button onClick={refetch} disabled={isRefetching}>
 *         Refresh
 *       </Button>
 *       <TeamProgressList data={data} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useTeamProgress(): UseTeamProgressReturn {
  // State management
  const [state, setState] = useState<UseTeamProgressState>({
    data: [],
    isLoading: true,
    error: null,
    isInitialLoad: true,
  });

  const [isRefetching, setIsRefetching] = useState<boolean>(false);

  // Ref to track if component is mounted
  const isMountedRef = useRef<boolean>(true);

  // Ref to track if initial fetch has been triggered
  const initialFetchTriggeredRef = useRef<boolean>(false);

  /**
   * Fetch team progress data
   * 
   * @param isRefetch - Whether this is a manual refetch operation
   */
  const fetchTeamProgress = useCallback(async (isRefetch: boolean = false): Promise<void> => {
    try {
      // Set loading state
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setState(prev => ({
          ...prev,
          isLoading: true,
          error: null,
        }));
      }

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useTeamProgress] Fetching team progress data', {
          isRefetch,
          timestamp: new Date().toISOString(),
        });
      }

      // Fetch data from API
      const teamProgressData = await getTeamProgress();

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useTeamProgress] Component unmounted, skipping state update');
        }
        return;
      }

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useTeamProgress] Team progress data fetched successfully', {
          count: teamProgressData.length,
          isRefetch,
        });
      }

      // Update state with fetched data
      setState({
        data: teamProgressData,
        isLoading: false,
        error: null,
        isInitialLoad: false,
      });

      if (isRefetch) {
        setIsRefetching(false);
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useTeamProgress] Component unmounted, skipping error state update');
        }
        return;
      }

      console.error('[useTeamProgress] Failed to fetch team progress:', err);

      const errorResponse = err as ApiErrorResponse;

      // Update state with error
      setState({
        data: [],
        isLoading: false,
        error: errorResponse,
        isInitialLoad: false,
      });

      if (isRefetch) {
        setIsRefetching(false);
      }
    }
  }, []);

  /**
   * Manual refetch function
   * 
   * Allows components to manually trigger a data refresh.
   * Sets isRefetching state to indicate background refresh.
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[useTeamProgress] Manual refetch triggered');
    }

    await fetchTeamProgress(true);
  }, [fetchTeamProgress]);

  /**
   * Effect: Fetch data on mount
   * 
   * Triggers initial data fetch when component mounts.
   * Uses ref to ensure fetch only happens once.
   */
  useEffect(() => {
    // Prevent double fetch in React StrictMode
    if (initialFetchTriggeredRef.current) {
      return;
    }

    initialFetchTriggeredRef.current = true;

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[useTeamProgress] Hook mounted, initiating data fetch');
    }

    fetchTeamProgress(false);
  }, [fetchTeamProgress]);

  /**
   * Effect: Cleanup on unmount
   * 
   * Sets mounted ref to false to prevent state updates after unmount.
   */
  useEffect(() => {
    return () => {
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useTeamProgress] Hook unmounting, cleaning up');
      }

      isMountedRef.current = false;
    };
  }, []);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isInitialLoad: state.isInitialLoad,
    refetch,
    isRefetching,
  };
}

/**
 * Export hook as default
 */
export default useTeamProgress;