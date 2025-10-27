/**
 * Custom React Hook: useMyTasks
 * 
 * Manages employee onboarding tasks with comprehensive state management,
 * file upload support, optimistic updates, and error handling.
 * 
 * Features:
 * - Automatic task fetching on mount
 * - Loading and error state management
 * - Task update with optional file upload
 * - Optimistic UI updates for better UX
 * - Manual refetch capability
 * - Client-side file validation
 * - Comprehensive error handling with recovery
 * 
 * @module hooks/useMyTasks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMyTasks,
  updateTask,
  Task,
  TaskStatus,
  UpdateTaskRequest,
  validateFile,
} from '../api/onboarding';
import { ApiErrorResponse } from '../api/client';

/**
 * Hook state interface
 */
interface UseMyTasksState {
  /** Array of employee's onboarding tasks */
  readonly tasks: Task[];
  
  /** Loading state indicator */
  readonly loading: boolean;
  
  /** Error object if fetch/update failed */
  readonly error: ApiErrorResponse | null;
  
  /** Indicates if initial fetch is complete */
  readonly initialized: boolean;
  
  /** Task ID currently being updated */
  readonly updatingTaskId: string | null;
}

/**
 * Task update options
 */
interface UpdateTaskOptions {
  /** New task status */
  readonly status?: TaskStatus;
  
  /** Optional notes for the update */
  readonly notes?: string;
  
  /** Optional file to upload */
  readonly file?: File;
  
  /** Enable optimistic update (default: true) */
  readonly optimistic?: boolean;
}

/**
 * Hook return type
 */
interface UseMyTasksReturn {
  /** Current tasks array */
  readonly tasks: Task[];
  
  /** Loading state */
  readonly loading: boolean;
  
  /** Error state */
  readonly error: ApiErrorResponse | null;
  
  /** Indicates if initial fetch is complete */
  readonly initialized: boolean;
  
  /** Task ID currently being updated */
  readonly updatingTaskId: string | null;
  
  /** Update a task with optional file upload */
  readonly updateTask: (taskId: string, options: UpdateTaskOptions) => Promise<void>;
  
  /** Manually refetch tasks */
  readonly refetch: () => Promise<void>;
  
  /** Clear error state */
  readonly clearError: () => void;
  
  /** Get task by ID */
  readonly getTaskById: (taskId: string) => Task | undefined;
  
  /** Get tasks by status */
  readonly getTasksByStatus: (status: TaskStatus) => Task[];
}

/**
 * Custom hook for managing employee onboarding tasks
 * 
 * @returns Hook state and methods
 * 
 * @example
 * ```tsx
 * function TaskList() {
 *   const { tasks, loading, error, updateTask, refetch } = useMyTasks();
 * 
 *   const handleComplete = async (taskId: string, file?: File) => {
 *     await updateTask(taskId, {
 *       status: TaskStatus.COMPLETED,
 *       file,
 *     });
 *   };
 * 
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 * 
 *   return (
 *     <div>
 *       {tasks.map(task => (
 *         <TaskCard key={task.id} task={task} onComplete={handleComplete} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMyTasks(): UseMyTasksReturn {
  // State management
  const [state, setState] = useState<UseMyTasksState>({
    tasks: [],
    loading: true,
    error: null,
    initialized: false,
    updatingTaskId: null,
  });

  // Ref to track if component is mounted
  const isMountedRef = useRef<boolean>(true);

  // Ref to store abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch tasks from API
   */
  const fetchTasks = useCallback(async (): Promise<void> => {
    try {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useMyTasks] Fetching tasks');
      }

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const tasks = await getMyTasks();

      if (!isMountedRef.current) {
        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useMyTasks] Component unmounted, skipping state update');
        }
        return;
      }

      setState(prev => ({
        ...prev,
        tasks,
        loading: false,
        initialized: true,
        error: null,
      }));

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useMyTasks] Tasks fetched successfully:', tasks.length);
      }
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      console.error('[useMyTasks] Failed to fetch tasks:', error);

      const apiError = error as ApiErrorResponse;
      setState(prev => ({
        ...prev,
        loading: false,
        initialized: true,
        error: apiError,
      }));
    }
  }, []);

  /**
   * Update task with optional file upload
   */
  const handleUpdateTask = useCallback(
    async (taskId: string, options: UpdateTaskOptions): Promise<void> => {
      try {
        // Validate task ID
        if (!taskId || typeof taskId !== 'string') {
          throw new Error('Invalid task ID');
        }

        // Find task in current state
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        // Validate file if provided
        if (options.file) {
          const validation = validateFile(options.file);
          if (!validation.valid) {
            throw new Error(validation.error || 'Invalid file');
          }

          if (import.meta.env.VITE_API_DEBUG === 'true') {
            console.debug('[useMyTasks] File validation passed:', {
              name: options.file.name,
              type: options.file.type,
              size: options.file.size,
            });
          }
        }

        // Prepare update request
        const updateRequest: UpdateTaskRequest = {};
        if (options.status) {
          updateRequest.status = options.status;
        }
        if (options.notes) {
          updateRequest.notes = options.notes;
        }

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useMyTasks] Updating task:', taskId, updateRequest);
        }

        // Optimistic update
        const shouldOptimisticUpdate = options.optimistic !== false;
        let previousTasks: Task[] = [];

        if (shouldOptimisticUpdate) {
          previousTasks = [...state.tasks];
          
          const optimisticTask: Task = {
            ...task,
            ...(options.status && { status: options.status }),
            ...(options.status === TaskStatus.COMPLETED && {
              completedAt: new Date().toISOString(),
            }),
            updatedAt: new Date().toISOString(),
          };

          setState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => (t.id === taskId ? optimisticTask : t)),
            updatingTaskId: taskId,
          }));

          if (import.meta.env.VITE_API_DEBUG === 'true') {
            console.debug('[useMyTasks] Optimistic update applied');
          }
        } else {
          setState(prev => ({
            ...prev,
            updatingTaskId: taskId,
          }));
        }

        // Perform API update
        const updatedTask = await updateTask(taskId, updateRequest, options.file);

        if (!isMountedRef.current) {
          if (import.meta.env.VITE_API_DEBUG === 'true') {
            console.debug('[useMyTasks] Component unmounted, skipping state update');
          }
          return;
        }

        // Update with actual response
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => (t.id === taskId ? updatedTask : t)),
          updatingTaskId: null,
          error: null,
        }));

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useMyTasks] Task updated successfully:', updatedTask.id);
        }
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        console.error('[useMyTasks] Failed to update task:', error);

        // Revert optimistic update on error
        if (options.optimistic !== false && previousTasks.length > 0) {
          setState(prev => ({
            ...prev,
            tasks: previousTasks,
            updatingTaskId: null,
            error: error as ApiErrorResponse,
          }));

          if (import.meta.env.VITE_API_DEBUG === 'true') {
            console.debug('[useMyTasks] Optimistic update reverted');
          }
        } else {
          setState(prev => ({
            ...prev,
            updatingTaskId: null,
            error: error as ApiErrorResponse,
          }));
        }

        throw error;
      }
    },
    [state.tasks]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Get task by ID
   */
  const getTaskById = useCallback(
    (taskId: string): Task | undefined => {
      return state.tasks.find(task => task.id === taskId);
    },
    [state.tasks]
  );

  /**
   * Get tasks by status
   */
  const getTasksByStatus = useCallback(
    (status: TaskStatus): Task[] => {
      return state.tasks.filter(task => task.status === status);
    },
    [state.tasks]
  );

  /**
   * Fetch tasks on mount
   */
  useEffect(() => {
    isMountedRef.current = true;

    fetchTasks();

    return () => {
      isMountedRef.current = false;
      
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTasks]);

  return {
    tasks: state.tasks,
    loading: state.loading,
    error: state.error,
    initialized: state.initialized,
    updatingTaskId: state.updatingTaskId,
    updateTask: handleUpdateTask,
    refetch: fetchTasks,
    clearError,
    getTaskById,
    getTasksByStatus,
  };
}

export default useMyTasks;