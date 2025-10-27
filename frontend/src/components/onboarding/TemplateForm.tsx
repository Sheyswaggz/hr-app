/**
 * TemplateForm Component
 * 
 * Production-ready form component for creating and editing onboarding templates.
 * Implements comprehensive validation, error handling, and accessibility features.
 * 
 * Features:
 * - Create/Edit mode support with initial data hydration
 * - Dynamic task list management (add/remove tasks)
 * - React Hook Form integration with validation
 * - Material-UI Dialog wrapper with responsive design
 * - Loading states during API submission
 * - Error display with user-friendly messages
 * - Keyboard navigation and ARIA labels
 * - Client-side validation before submission
 * 
 * @module components/onboarding/TemplateForm
 */

import React, { useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

/**
 * Template task form data structure
 */
interface TemplateTaskFormData {
  /** Task title (max 200 characters) */
  readonly title: string;
  /** Task description (max 2000 characters) */
  readonly description: string;
  /** Due date offset in days from workflow start */
  readonly dueDate: number;
}

/**
 * Template form data structure
 */
interface TemplateFormData {
  /** Template name (required, max 200 characters) */
  readonly name: string;
  /** Template description (max 2000 characters) */
  readonly description: string;
  /** Array of tasks in the template */
  readonly tasks: readonly TemplateTaskFormData[];
}

/**
 * Initial template data for edit mode
 */
interface InitialTemplateData {
  /** Template unique identifier */
  readonly id: string;
  /** Template name */
  readonly name: string;
  /** Template description */
  readonly description: string;
  /** Array of template tasks */
  readonly tasks: readonly {
    readonly title: string;
    readonly description: string;
    readonly dueDate: number;
  }[];
}

/**
 * Component props interface
 */
interface TemplateFormProps {
  /** Whether dialog is open */
  readonly open: boolean;
  /** Form mode: create or edit */
  readonly mode: 'create' | 'edit';
  /** Initial data for edit mode */
  readonly initialData?: InitialTemplateData;
  /** Callback when form is successfully submitted */
  readonly onSuccess: (data: TemplateFormData) => Promise<void>;
  /** Callback when dialog is closed */
  readonly onClose: () => void;
}

/**
 * Validation constants
 */
const VALIDATION_RULES = {
  NAME_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 2000,
  TASK_TITLE_MAX_LENGTH: 200,
  TASK_DESCRIPTION_MAX_LENGTH: 2000,
  MIN_DUE_DATE_OFFSET: 1,
  MAX_DUE_DATE_OFFSET: 365,
  MIN_TASKS: 1,
  MAX_TASKS: 50,
} as const;

/**
 * Default form values
 */
const DEFAULT_FORM_VALUES: TemplateFormData = {
  name: '',
  description: '',
  tasks: [
    {
      title: '',
      description: '',
      dueDate: 7,
    },
  ],
};

/**
 * TemplateForm Component
 * 
 * Form component for creating and editing onboarding templates with
 * comprehensive validation and error handling.
 * 
 * @param props - Component props
 * @returns React component
 * 
 * @example
 * ```tsx
 * <TemplateForm
 *   open={isOpen}
 *   mode="create"
 *   onSuccess={handleSuccess}
 *   onClose={handleClose}
 * />
 * ```
 */
export const TemplateForm: React.FC<TemplateFormProps> = ({
  open,
  mode,
  initialData,
  onSuccess,
  onClose,
}) => {
  // Form state management with React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setError,
    clearErrors,
  } = useForm<TemplateFormData>({
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  });

  // Dynamic task array management
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tasks',
  });

  // Submission error state
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  /**
   * Reset form when dialog opens/closes or mode changes
   */
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        // Hydrate form with initial data for edit mode
        reset({
          name: initialData.name,
          description: initialData.description,
          tasks: initialData.tasks.map(task => ({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
          })),
        });

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[TemplateForm] Form hydrated with initial data:', initialData.id);
        }
      } else {
        // Reset to default values for create mode
        reset(DEFAULT_FORM_VALUES);
      }

      // Clear any previous errors
      clearErrors();
      setSubmissionError(null);
    }
  }, [open, mode, initialData, reset, clearErrors]);

  /**
   * Add new task to the form
   */
  const handleAddTask = useCallback(() => {
    if (fields.length >= VALIDATION_RULES.MAX_TASKS) {
      setSubmissionError(`Maximum ${VALIDATION_RULES.MAX_TASKS} tasks allowed per template`);
      return;
    }

    append({
      title: '',
      description: '',
      dueDate: 7,
    });

    setSubmissionError(null);

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TemplateForm] Task added, total tasks:', fields.length + 1);
    }
  }, [fields.length, append]);

  /**
   * Remove task from the form
   */
  const handleRemoveTask = useCallback(
    (index: number) => {
      if (fields.length <= VALIDATION_RULES.MIN_TASKS) {
        setSubmissionError(`At least ${VALIDATION_RULES.MIN_TASKS} task required`);
        return;
      }

      remove(index);
      setSubmissionError(null);

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TemplateForm] Task removed, remaining tasks:', fields.length - 1);
      }
    },
    [fields.length, remove]
  );

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: TemplateFormData) => {
      try {
        setSubmissionError(null);

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[TemplateForm] Submitting form:', { mode, data });
        }

        // Validate tasks array
        if (data.tasks.length < VALIDATION_RULES.MIN_TASKS) {
          setError('tasks', {
            type: 'manual',
            message: `At least ${VALIDATION_RULES.MIN_TASKS} task required`,
          });
          return;
        }

        if (data.tasks.length > VALIDATION_RULES.MAX_TASKS) {
          setError('tasks', {
            type: 'manual',
            message: `Maximum ${VALIDATION_RULES.MAX_TASKS} tasks allowed`,
          });
          return;
        }

        // Call success callback
        await onSuccess(data);

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[TemplateForm] Form submitted successfully');
        }

        // Reset form and close dialog
        reset(DEFAULT_FORM_VALUES);
        onClose();
      } catch (error) {
        console.error('[TemplateForm] Form submission failed:', error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to save template. Please try again.';

        setSubmissionError(errorMessage);
      }
    },
    [mode, onSuccess, onClose, reset, setError]
  );

  /**
   * Handle dialog close with unsaved changes warning
   */
  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }

    reset(DEFAULT_FORM_VALUES);
    setSubmissionError(null);
    onClose();
  }, [isDirty, reset, onClose]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSubmit(onSubmit)();
      }

      // Escape to close
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    },
    [handleSubmit, onSubmit, handleClose]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="template-form-dialog-title"
      aria-describedby="template-form-dialog-description"
      onKeyDown={handleKeyDown}
    >
      <DialogTitle id="template-form-dialog-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="span">
            {mode === 'create' ? 'Create Onboarding Template' : 'Edit Onboarding Template'}
          </Typography>
          <IconButton
            aria-label="close dialog"
            onClick={handleClose}
            disabled={isSubmitting}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          component="form"
          id="template-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          {/* Submission Error Alert */}
          {submissionError && (
            <Alert
              severity="error"
              onClose={() => setSubmissionError(null)}
              sx={{ mb: 2 }}
            >
              {submissionError}
            </Alert>
          )}

          {/* Template Name Field */}
          <Controller
            name="name"
            control={control}
            rules={{
              required: 'Template name is required',
              maxLength: {
                value: VALIDATION_RULES.NAME_MAX_LENGTH,
                message: `Template name must not exceed ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`,
              },
              validate: (value) => {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                  return 'Template name cannot be empty';
                }
                return true;
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Template Name"
                placeholder="e.g., Software Engineer Onboarding"
                required
                fullWidth
                error={!!errors.name}
                helperText={
                  errors.name?.message ||
                  `${field.value.length}/${VALIDATION_RULES.NAME_MAX_LENGTH} characters`
                }
                disabled={isSubmitting}
                inputProps={{
                  'aria-label': 'Template name',
                  'aria-required': 'true',
                  'aria-invalid': !!errors.name,
                  maxLength: VALIDATION_RULES.NAME_MAX_LENGTH,
                }}
              />
            )}
          />

          {/* Template Description Field */}
          <Controller
            name="description"
            control={control}
            rules={{
              required: 'Template description is required',
              maxLength: {
                value: VALIDATION_RULES.DESCRIPTION_MAX_LENGTH,
                message: `Description must not exceed ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`,
              },
              validate: (value) => {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                  return 'Description cannot be empty';
                }
                return true;
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                placeholder="Describe the purpose and scope of this onboarding template"
                required
                fullWidth
                multiline
                rows={3}
                error={!!errors.description}
                helperText={
                  errors.description?.message ||
                  `${field.value.length}/${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`
                }
                disabled={isSubmitting}
                inputProps={{
                  'aria-label': 'Template description',
                  'aria-required': 'true',
                  'aria-invalid': !!errors.description,
                  maxLength: VALIDATION_RULES.DESCRIPTION_MAX_LENGTH,
                }}
              />
            )}
          />

          <Divider />

          {/* Tasks Section */}
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" component="h3">
                Tasks
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddTask}
                disabled={isSubmitting || fields.length >= VALIDATION_RULES.MAX_TASKS}
                aria-label="Add new task"
              >
                Add Task
              </Button>
            </Box>

            {errors.tasks && typeof errors.tasks.message === 'string' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.tasks.message}
              </Alert>
            )}

            <Stack spacing={3}>
              {fields.map((field, index) => (
                <Box
                  key={field.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    position: 'relative',
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle2" component="h4">
                      Task {index + 1}
                    </Typography>
                    <IconButton
                      aria-label={`Remove task ${index + 1}`}
                      onClick={() => handleRemoveTask(index)}
                      disabled={isSubmitting || fields.length <= VALIDATION_RULES.MIN_TASKS}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Stack spacing={2}>
                    {/* Task Title */}
                    <Controller
                      name={`tasks.${index}.title`}
                      control={control}
                      rules={{
                        required: 'Task title is required',
                        maxLength: {
                          value: VALIDATION_RULES.TASK_TITLE_MAX_LENGTH,
                          message: `Title must not exceed ${VALIDATION_RULES.TASK_TITLE_MAX_LENGTH} characters`,
                        },
                        validate: (value) => {
                          const trimmed = value.trim();
                          if (trimmed.length === 0) {
                            return 'Task title cannot be empty';
                          }
                          return true;
                        },
                      }}
                      render={({ field: taskField }) => (
                        <TextField
                          {...taskField}
                          label="Task Title"
                          placeholder="e.g., Complete profile setup"
                          required
                          fullWidth
                          error={!!errors.tasks?.[index]?.title}
                          helperText={
                            errors.tasks?.[index]?.title?.message ||
                            `${taskField.value.length}/${VALIDATION_RULES.TASK_TITLE_MAX_LENGTH} characters`
                          }
                          disabled={isSubmitting}
                          inputProps={{
                            'aria-label': `Task ${index + 1} title`,
                            'aria-required': 'true',
                            'aria-invalid': !!errors.tasks?.[index]?.title,
                            maxLength: VALIDATION_RULES.TASK_TITLE_MAX_LENGTH,
                          }}
                        />
                      )}
                    />

                    {/* Task Description */}
                    <Controller
                      name={`tasks.${index}.description`}
                      control={control}
                      rules={{
                        required: 'Task description is required',
                        maxLength: {
                          value: VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH,
                          message: `Description must not exceed ${VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH} characters`,
                        },
                        validate: (value) => {
                          const trimmed = value.trim();
                          if (trimmed.length === 0) {
                            return 'Task description cannot be empty';
                          }
                          return true;
                        },
                      }}
                      render={({ field: taskField }) => (
                        <TextField
                          {...taskField}
                          label="Task Description"
                          placeholder="Provide detailed instructions for this task"
                          required
                          fullWidth
                          multiline
                          rows={2}
                          error={!!errors.tasks?.[index]?.description}
                          helperText={
                            errors.tasks?.[index]?.description?.message ||
                            `${taskField.value.length}/${VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH} characters`
                          }
                          disabled={isSubmitting}
                          inputProps={{
                            'aria-label': `Task ${index + 1} description`,
                            'aria-required': 'true',
                            'aria-invalid': !!errors.tasks?.[index]?.description,
                            maxLength: VALIDATION_RULES.TASK_DESCRIPTION_MAX_LENGTH,
                          }}
                        />
                      )}
                    />

                    {/* Due Date Offset */}
                    <Controller
                      name={`tasks.${index}.dueDate`}
                      control={control}
                      rules={{
                        required: 'Due date offset is required',
                        min: {
                          value: VALIDATION_RULES.MIN_DUE_DATE_OFFSET,
                          message: `Due date must be at least ${VALIDATION_RULES.MIN_DUE_DATE_OFFSET} day`,
                        },
                        max: {
                          value: VALIDATION_RULES.MAX_DUE_DATE_OFFSET,
                          message: `Due date must not exceed ${VALIDATION_RULES.MAX_DUE_DATE_OFFSET} days`,
                        },
                        validate: (value) => {
                          if (!Number.isInteger(value)) {
                            return 'Due date must be a whole number';
                          }
                          return true;
                        },
                      }}
                      render={({ field: taskField }) => (
                        <TextField
                          {...taskField}
                          label="Due Date (days from start)"
                          type="number"
                          required
                          fullWidth
                          error={!!errors.tasks?.[index]?.dueDate}
                          helperText={
                            errors.tasks?.[index]?.dueDate?.message ||
                            'Number of days from workflow start date'
                          }
                          disabled={isSubmitting}
                          inputProps={{
                            'aria-label': `Task ${index + 1} due date offset`,
                            'aria-required': 'true',
                            'aria-invalid': !!errors.tasks?.[index]?.dueDate,
                            min: VALIDATION_RULES.MIN_DUE_DATE_OFFSET,
                            max: VALIDATION_RULES.MAX_DUE_DATE_OFFSET,
                            step: 1,
                          }}
                        />
                      )}
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Cancel and close dialog"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="template-form"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          aria-label={mode === 'create' ? 'Create template' : 'Save changes'}
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateForm;