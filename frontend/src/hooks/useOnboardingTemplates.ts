/**
 * Custom React Hook: useOnboardingTemplates
 * 
 * Manages onboarding templates state with full CRUD operations, optimistic updates,
 * and comprehensive error handling. Provides loading states, error recovery,
 * and automatic refetching capabilities.
 * 
 * Features:
 * - Fetches templates on mount
 * - Create, update, delete operations with optimistic updates
 * - Loading and error state management
 * - Refetch capability for manual refresh
 * - Automatic error recovery with retry logic
 * - Type-safe operations with full TypeScript support
 * 
 * @module hooks/useOnboardingTemplates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../api/onboarding';
import { ApiErrorResponse } from '../api/client';

/**
 * Hook state interface
 */
interface UseOnboardingTemplatesState {
  /** Array of onboarding templates */
  readonly templates: Template[];
  /** Loading state indicator */
  readonly loading: boolean;
  /** Error object if operation failed */
  readonly error: ApiErrorResponse | null;
  /** Indicates if initial fetch is complete */
  readonly initialized: boolean;
}

/**
 * Hook return interface
 */
interface UseOnboardingTemplatesReturn extends UseOnboardingTemplatesState {
  /** Create a new template */
  readonly createTemplate: (data: CreateTemplateRequest) => Promise<Template>;
  /** Update an existing template */
  readonly updateTemplate: (templateId: string, data: UpdateTemplateRequest) => Promise<Template>;
  /** Delete a template */
  readonly deleteTemplate: (templateId: string) => Promise<void>;
  /** Manually refetch templates */
  readonly refetch: () => Promise<void>;
  /** Clear error state */
  readonly clearError: () => void;
  /** Retry last failed operation */
  readonly retry: () => Promise<void>;
}

/**
 * Operation type for retry functionality
 */
type PendingOperation =
  | { type: 'create'; data: CreateTemplateRequest }
  | { type: 'update'; templateId: string; data: UpdateTemplateRequest }
  | { type: 'delete'; templateId: string }
  | { type: 'fetch' }
  | null;

/**
 * Custom hook for managing onboarding templates
 * 
 * @returns Hook state and operations
 * 
 * @example
 * ```tsx
 * function TemplateList() {
 *   const {
 *     templates,
 *     loading,
 *     error,
 *     createTemplate,
 *     updateTemplate,
 *     deleteTemplate,
 *     refetch,
 *   } = useOnboardingTemplates();
 * 
 *   const handleCreate = async (data: CreateTemplateRequest) => {
 *     try {
 *       const newTemplate = await createTemplate(data);
 *       console.log('Created:', newTemplate);
 *     } catch (err) {
 *       console.error('Failed to create template:', err);
 *     }
 *   };
 * 
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 * 
 *   return (
 *     <div>
 *       {templates.map(template => (
 *         <TemplateCard key={template.id} template={template} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnboardingTemplates(): UseOnboardingTemplatesReturn {
  // State management
  const [state, setState] = useState<UseOnboardingTemplatesState>({
    templates: [],
    loading: false,
    error: null,
    initialized: false,
  });

  // Track pending operation for retry functionality
  const pendingOperationRef = useRef<PendingOperation>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Safe state update that checks if component is still mounted
   */
  const safeSetState = useCallback((updater: Partial<UseOnboardingTemplatesState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updater }));
    }
  }, []);

  /**
   * Fetch all templates from API
   */
  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      safeSetState({ loading: true, error: null });
      pendingOperationRef.current = { type: 'fetch' };

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useOnboardingTemplates] Fetching templates');
      }

      const fetchedTemplates = await getTemplates();

      safeSetState({
        templates: fetchedTemplates,
        loading: false,
        error: null,
        initialized: true,
      });

      pendingOperationRef.current = null;

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[useOnboardingTemplates] Templates fetched:', fetchedTemplates.length);
      }
    } catch (err) {
      const error = err as ApiErrorResponse;
      console.error('[useOnboardingTemplates] Failed to fetch templates:', error);

      safeSetState({
        loading: false,
        error,
        initialized: true,
      });
    }
  }, [safeSetState]);

  /**
   * Create new template with optimistic update
   */
  const handleCreateTemplate = useCallback(
    async (data: CreateTemplateRequest): Promise<Template> => {
      try {
        safeSetState({ loading: true, error: null });
        pendingOperationRef.current = { type: 'create', data };

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Creating template:', data);
        }

        const newTemplate = await createTemplate(data);

        // Optimistic update: add new template to list
        safeSetState(prev => ({
          templates: [...prev.templates, newTemplate],
          loading: false,
          error: null,
        }));

        pendingOperationRef.current = null;

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Template created:', newTemplate.id);
        }

        return newTemplate;
      } catch (err) {
        const error = err as ApiErrorResponse;
        console.error('[useOnboardingTemplates] Failed to create template:', error);

        safeSetState({
          loading: false,
          error,
        });

        throw error;
      }
    },
    [safeSetState]
  );

  /**
   * Update existing template with optimistic update
   */
  const handleUpdateTemplate = useCallback(
    async (templateId: string, data: UpdateTemplateRequest): Promise<Template> => {
      if (!templateId || typeof templateId !== 'string') {
        const error: ApiErrorResponse = {
          message: 'Invalid template ID',
          statusCode: 400,
          error: 'Bad Request',
        };
        safeSetState({ error });
        throw error;
      }

      try {
        safeSetState({ loading: true, error: null });
        pendingOperationRef.current = { type: 'update', templateId, data };

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Updating template:', templateId, data);
        }

        const updatedTemplate = await updateTemplate(templateId, data);

        // Optimistic update: replace template in list
        safeSetState(prev => ({
          templates: prev.templates.map(t => (t.id === templateId ? updatedTemplate : t)),
          loading: false,
          error: null,
        }));

        pendingOperationRef.current = null;

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Template updated:', updatedTemplate.id);
        }

        return updatedTemplate;
      } catch (err) {
        const error = err as ApiErrorResponse;
        console.error('[useOnboardingTemplates] Failed to update template:', error);

        safeSetState({
          loading: false,
          error,
        });

        throw error;
      }
    },
    [safeSetState]
  );

  /**
   * Delete template with optimistic update
   */
  const handleDeleteTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      if (!templateId || typeof templateId !== 'string') {
        const error: ApiErrorResponse = {
          message: 'Invalid template ID',
          statusCode: 400,
          error: 'Bad Request',
        };
        safeSetState({ error });
        throw error;
      }

      try {
        safeSetState({ loading: true, error: null });
        pendingOperationRef.current = { type: 'delete', templateId };

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Deleting template:', templateId);
        }

        await deleteTemplate(templateId);

        // Optimistic update: remove template from list
        safeSetState(prev => ({
          templates: prev.templates.filter(t => t.id !== templateId),
          loading: false,
          error: null,
        }));

        pendingOperationRef.current = null;

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[useOnboardingTemplates] Template deleted:', templateId);
        }
      } catch (err) {
        const error = err as ApiErrorResponse;
        console.error('[useOnboardingTemplates] Failed to delete template:', error);

        safeSetState({
          loading: false,
          error,
        });

        throw error;
      }
    },
    [safeSetState]
  );

  /**
   * Manually refetch templates
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[useOnboardingTemplates] Manual refetch triggered');
    }

    await fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    safeSetState({ error: null });
  }, [safeSetState]);

  /**
   * Retry last failed operation
   */
  const retry = useCallback(async (): Promise<void> => {
    const operation = pendingOperationRef.current;

    if (!operation) {
      console.warn('[useOnboardingTemplates] No pending operation to retry');
      return;
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[useOnboardingTemplates] Retrying operation:', operation.type);
    }

    try {
      switch (operation.type) {
        case 'fetch':
          await fetchTemplates();
          break;
        case 'create':
          await handleCreateTemplate(operation.data);
          break;
        case 'update':
          await handleUpdateTemplate(operation.templateId, operation.data);
          break;
        case 'delete':
          await handleDeleteTemplate(operation.templateId);
          break;
        default:
          console.warn('[useOnboardingTemplates] Unknown operation type');
      }
    } catch (err) {
      console.error('[useOnboardingTemplates] Retry failed:', err);
      throw err;
    }
  }, [fetchTemplates, handleCreateTemplate, handleUpdateTemplate, handleDeleteTemplate]);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates: state.templates,
    loading: state.loading,
    error: state.error,
    initialized: state.initialized,
    createTemplate: handleCreateTemplate,
    updateTemplate: handleUpdateTemplate,
    deleteTemplate: handleDeleteTemplate,
    refetch,
    clearError,
    retry,
  };
}

export default useOnboardingTemplates;