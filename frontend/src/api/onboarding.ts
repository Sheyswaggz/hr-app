/**
 * Onboarding API Service
 * 
 * Provides frontend API functions for onboarding workflow management:
 * - Template management (list, create, update, delete)
 * - Workflow assignment to employees
 * - Task management (list, update, complete)
 * - Team progress tracking
 * - Document upload handling
 * 
 * All functions include proper error handling, TypeScript types,
 * and logging for development mode.
 */

import { apiClient, ApiSuccessResponse, handleApiError } from './client';

/**
 * Task status enumeration
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/**
 * Workflow status enumeration
 */
export enum WorkflowStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/**
 * Onboarding template task definition
 */
export interface TemplateTask {
  readonly title: string;
  readonly description: string;
  readonly dueInDays: number;
  readonly order: number;
}

/**
 * Onboarding template
 */
export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tasks: TemplateTask[];
  readonly isActive: boolean;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create template request payload
 */
export interface CreateTemplateRequest {
  readonly name: string;
  readonly description: string;
  readonly tasks: TemplateTask[];
  readonly isActive?: boolean;
}

/**
 * Update template request payload
 */
export interface UpdateTemplateRequest {
  readonly name?: string;
  readonly description?: string;
  readonly tasks?: TemplateTask[];
  readonly isActive?: boolean;
}

/**
 * Onboarding workflow
 */
export interface Workflow {
  readonly id: string;
  readonly employeeId: string;
  readonly templateId: string;
  readonly status: WorkflowStatus;
  readonly startDate: string;
  readonly expectedCompletionDate: string;
  readonly actualCompletionDate: string | null;
  readonly progress: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Workflow assignment request
 */
export interface AssignWorkflowRequest {
  readonly employeeId: string;
  readonly templateId: string;
  readonly startDate?: string;
}

/**
 * Onboarding task
 */
export interface Task {
  readonly id: string;
  readonly workflowId: string;
  readonly employeeId: string;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly dueDate: string;
  readonly completedAt: string | null;
  readonly documentUrl: string | null;
  readonly order: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Task with employee information
 */
export interface TaskWithEmployee extends Task {
  readonly employee: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly department: string;
    readonly position: string;
  };
}

/**
 * Update task request payload
 */
export interface UpdateTaskRequest {
  readonly status?: TaskStatus;
  readonly notes?: string;
}

/**
 * Team progress summary
 */
export interface TeamProgress {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly department: string;
  readonly position: string;
  readonly workflowId: string;
  readonly templateName: string;
  readonly status: WorkflowStatus;
  readonly progress: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly startDate: string;
  readonly expectedCompletionDate: string;
  readonly daysRemaining: number;
}

/**
 * Get all onboarding templates
 * 
 * @returns Promise resolving to array of templates
 * @throws ApiErrorResponse on failure
 */
export async function getTemplates(): Promise<Template[]> {
  try {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching templates');
    }

    const response = await apiClient.get<ApiSuccessResponse<Template[]>>(
      '/onboarding/templates'
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Templates fetched:', response.data.data.length);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch templates:', error);
    throw handleApiError(error);
  }
}

/**
 * Get single template by ID
 * 
 * @param templateId - Template ID
 * @returns Promise resolving to template
 * @throws ApiErrorResponse on failure
 */
export async function getTemplate(templateId: string): Promise<Template> {
  try {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Invalid template ID');
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching template:', templateId);
    }

    const response = await apiClient.get<ApiSuccessResponse<Template>>(
      `/onboarding/templates/${templateId}`
    );

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch template:', error);
    throw handleApiError(error);
  }
}

/**
 * Create new onboarding template
 * 
 * @param data - Template creation data
 * @returns Promise resolving to created template
 * @throws ApiErrorResponse on failure
 */
export async function createTemplate(data: CreateTemplateRequest): Promise<Template> {
  try {
    // Validate input
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new Error('Template description is required');
    }

    if (!data.tasks || data.tasks.length === 0) {
      throw new Error('At least one task is required');
    }

    // Validate tasks
    for (const task of data.tasks) {
      if (!task.title || task.title.trim().length === 0) {
        throw new Error('Task title is required');
      }

      if (task.title.length > 200) {
        throw new Error('Task title must not exceed 200 characters');
      }

      if (!task.description || task.description.trim().length === 0) {
        throw new Error('Task description is required');
      }

      if (task.description.length > 2000) {
        throw new Error('Task description must not exceed 2000 characters');
      }

      if (typeof task.dueInDays !== 'number' || task.dueInDays < 1) {
        throw new Error('Task due date must be at least 1 day in the future');
      }

      if (typeof task.order !== 'number' || task.order < 0) {
        throw new Error('Task order must be a non-negative number');
      }
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Creating template:', data);
    }

    const response = await apiClient.post<ApiSuccessResponse<Template>>(
      '/onboarding/templates',
      data
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Template created:', response.data.data.id);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to create template:', error);
    throw handleApiError(error);
  }
}

/**
 * Update existing template
 * 
 * @param templateId - Template ID
 * @param data - Template update data
 * @returns Promise resolving to updated template
 * @throws ApiErrorResponse on failure
 */
export async function updateTemplate(
  templateId: string,
  data: UpdateTemplateRequest
): Promise<Template> {
  try {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Invalid template ID');
    }

    // Validate input if provided
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new Error('Template name cannot be empty');
    }

    if (data.description !== undefined && data.description.trim().length === 0) {
      throw new Error('Template description cannot be empty');
    }

    if (data.tasks !== undefined) {
      if (data.tasks.length === 0) {
        throw new Error('At least one task is required');
      }

      for (const task of data.tasks) {
        if (!task.title || task.title.trim().length === 0) {
          throw new Error('Task title is required');
        }

        if (task.title.length > 200) {
          throw new Error('Task title must not exceed 200 characters');
        }

        if (!task.description || task.description.trim().length === 0) {
          throw new Error('Task description is required');
        }

        if (task.description.length > 2000) {
          throw new Error('Task description must not exceed 2000 characters');
        }

        if (typeof task.dueInDays !== 'number' || task.dueInDays < 1) {
          throw new Error('Task due date must be at least 1 day in the future');
        }

        if (typeof task.order !== 'number' || task.order < 0) {
          throw new Error('Task order must be a non-negative number');
        }
      }
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Updating template:', templateId, data);
    }

    const response = await apiClient.patch<ApiSuccessResponse<Template>>(
      `/onboarding/templates/${templateId}`,
      data
    );

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to update template:', error);
    throw handleApiError(error);
  }
}

/**
 * Delete template
 * 
 * @param templateId - Template ID
 * @returns Promise resolving when deletion is complete
 * @throws ApiErrorResponse on failure
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Invalid template ID');
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Deleting template:', templateId);
    }

    await apiClient.delete(`/onboarding/templates/${templateId}`);

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Template deleted:', templateId);
    }
  } catch (error) {
    console.error('[Onboarding API] Failed to delete template:', error);
    throw handleApiError(error);
  }
}

/**
 * Assign workflow to employee
 * 
 * @param data - Workflow assignment data
 * @returns Promise resolving to created workflow
 * @throws ApiErrorResponse on failure
 */
export async function assignWorkflow(data: AssignWorkflowRequest): Promise<Workflow> {
  try {
    if (!data.employeeId || typeof data.employeeId !== 'string') {
      throw new Error('Invalid employee ID');
    }

    if (!data.templateId || typeof data.templateId !== 'string') {
      throw new Error('Invalid template ID');
    }

    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid start date');
      }
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Assigning workflow:', data);
    }

    const response = await apiClient.post<ApiSuccessResponse<Workflow>>(
      '/onboarding/workflows',
      data
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Workflow assigned:', response.data.data.id);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to assign workflow:', error);
    throw handleApiError(error);
  }
}

/**
 * Get current user's onboarding tasks
 * 
 * @returns Promise resolving to array of tasks
 * @throws ApiErrorResponse on failure
 */
export async function getMyTasks(): Promise<Task[]> {
  try {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching my tasks');
    }

    const response = await apiClient.get<ApiSuccessResponse<Task[]>>(
      '/onboarding/tasks/my-tasks'
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] My tasks fetched:', response.data.data.length);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch my tasks:', error);
    throw handleApiError(error);
  }
}

/**
 * Get single task by ID
 * 
 * @param taskId - Task ID
 * @returns Promise resolving to task
 * @throws ApiErrorResponse on failure
 */
export async function getTask(taskId: string): Promise<Task> {
  try {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('Invalid task ID');
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching task:', taskId);
    }

    const response = await apiClient.get<ApiSuccessResponse<Task>>(
      `/onboarding/tasks/${taskId}`
    );

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch task:', error);
    throw handleApiError(error);
  }
}

/**
 * Update task with optional file upload
 * 
 * @param taskId - Task ID
 * @param data - Task update data
 * @param file - Optional file to upload (PDF/DOC/DOCX/JPG/PNG, max 10MB)
 * @returns Promise resolving to updated task
 * @throws ApiErrorResponse on failure
 */
export async function updateTask(
  taskId: string,
  data: UpdateTaskRequest,
  file?: File
): Promise<Task> {
  try {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('Invalid task ID');
    }

    // Validate file if provided
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'
        );
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit.');
      }

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[Onboarding API] File upload metadata:', {
          name: file.name,
          type: file.type,
          size: file.size,
        });
      }
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Updating task:', taskId, data);
    }

    // Prepare form data if file is provided
    let requestData: FormData | UpdateTaskRequest;
    let headers: Record<string, string> = {};

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      
      if (data.status) {
        formData.append('status', data.status);
      }
      
      if (data.notes) {
        formData.append('notes', data.notes);
      }

      requestData = formData;
      headers['Content-Type'] = 'multipart/form-data';
    } else {
      requestData = data;
    }

    const response = await apiClient.patch<ApiSuccessResponse<Task>>(
      `/onboarding/tasks/${taskId}`,
      requestData,
      { headers }
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Task updated:', response.data.data.id);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to update task:', error);
    throw handleApiError(error);
  }
}

/**
 * Get team onboarding progress (for managers)
 * 
 * @returns Promise resolving to array of team progress summaries
 * @throws ApiErrorResponse on failure
 */
export async function getTeamProgress(): Promise<TeamProgress[]> {
  try {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching team progress');
    }

    const response = await apiClient.get<ApiSuccessResponse<TeamProgress[]>>(
      '/onboarding/team-progress'
    );

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Team progress fetched:', response.data.data.length);
    }

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch team progress:', error);
    throw handleApiError(error);
  }
}

/**
 * Get all tasks for a specific workflow
 * 
 * @param workflowId - Workflow ID
 * @returns Promise resolving to array of tasks
 * @throws ApiErrorResponse on failure
 */
export async function getWorkflowTasks(workflowId: string): Promise<Task[]> {
  try {
    if (!workflowId || typeof workflowId !== 'string') {
      throw new Error('Invalid workflow ID');
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching workflow tasks:', workflowId);
    }

    const response = await apiClient.get<ApiSuccessResponse<Task[]>>(
      `/onboarding/workflows/${workflowId}/tasks`
    );

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch workflow tasks:', error);
    throw handleApiError(error);
  }
}

/**
 * Get workflow by ID
 * 
 * @param workflowId - Workflow ID
 * @returns Promise resolving to workflow
 * @throws ApiErrorResponse on failure
 */
export async function getWorkflow(workflowId: string): Promise<Workflow> {
  try {
    if (!workflowId || typeof workflowId !== 'string') {
      throw new Error('Invalid workflow ID');
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[Onboarding API] Fetching workflow:', workflowId);
    }

    const response = await apiClient.get<ApiSuccessResponse<Workflow>>(
      `/onboarding/workflows/${workflowId}`
    );

    return response.data.data;
  } catch (error) {
    console.error('[Onboarding API] Failed to fetch workflow:', error);
    throw handleApiError(error);
  }
}

/**
 * Validate file before upload
 * 
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.',
    };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit.',
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Export all API functions
 */
export default {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  assignWorkflow,
  getMyTasks,
  getTask,
  updateTask,
  getTeamProgress,
  getWorkflowTasks,
  getWorkflow,
  validateFile,
  formatFileSize,
};