/**
 * WorkflowAssignment Component
 * 
 * Production-ready component for assigning onboarding workflows to employees.
 * Provides a modal interface with employee and template selection, comprehensive
 * validation, loading states, and error handling with retry capabilities.
 * 
 * Features:
 * - Employee autocomplete with search
 * - Template dropdown selection
 * - Client-side validation
 * - Loading states during submission
 * - Success/error notifications
 * - Retry mechanism for failed requests
 * - Keyboard navigation support
 * - WCAG 2.1 AA compliant
 * - Responsive design
 * 
 * @module components/onboarding/WorkflowAssignment
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { assignWorkflow, AssignWorkflowRequest } from '../../api/onboarding';
import { useOnboardingTemplates } from '../../hooks/useOnboardingTemplates';
import { ApiErrorResponse } from '../../api/client';

/**
 * Employee interface for autocomplete
 */
interface Employee {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly department: string;
  readonly position: string;
}

/**
 * Form data interface
 */
interface WorkflowAssignmentFormData {
  readonly employee: Employee | null;
  readonly templateId: string;
  readonly startDate: string;
}

/**
 * Component props interface
 */
interface WorkflowAssignmentProps {
  /** Whether the dialog is open */
  readonly open: boolean;
  /** Callback when dialog should close */
  readonly onClose: () => void;
  /** Callback when workflow is successfully assigned */
  readonly onSuccess?: (workflowId: string) => void;
  /** List of employees to choose from */
  readonly employees: readonly Employee[];
  /** Whether employees are loading */
  readonly employeesLoading?: boolean;
}

/**
 * Submission state type
 */
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * WorkflowAssignment Component
 * 
 * Modal dialog for assigning onboarding workflows to employees.
 * Integrates with useOnboardingTemplates hook for template data.
 * 
 * @param props - Component props
 * @returns React component
 * 
 * @example
 * ```tsx
 * <WorkflowAssignment
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(workflowId) => console.log('Assigned:', workflowId)}
 *   employees={employeeList}
 *   employeesLoading={loading}
 * />
 * ```
 */
export const WorkflowAssignment: React.FC<WorkflowAssignmentProps> = ({
  open,
  onClose,
  onSuccess,
  employees,
  employeesLoading = false,
}) => {
  // Template data from custom hook
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useOnboardingTemplates();

  // Form management
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<WorkflowAssignmentFormData>({
    mode: 'onChange',
    defaultValues: {
      employee: null,
      templateId: '',
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  // Component state
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionError, setSubmissionError] = useState<ApiErrorResponse | null>(null);
  const [lastSubmittedData, setLastSubmittedData] = useState<AssignWorkflowRequest | null>(null);

  // Filter active templates
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.isActive),
    [templates]
  );

  /**
   * Reset form and state when dialog closes
   */
  useEffect(() => {
    if (!open) {
      reset();
      setSubmissionState('idle');
      setSubmissionError(null);
      setLastSubmittedData(null);
    }
  }, [open, reset]);

  /**
   * Log component mount for debugging
   */
  useEffect(() => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[WorkflowAssignment] Component mounted');
    }

    return () => {
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[WorkflowAssignment] Component unmounted');
      }
    };
  }, []);

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: WorkflowAssignmentFormData): Promise<void> => {
      if (!data.employee) {
        console.error('[WorkflowAssignment] No employee selected');
        return;
      }

      try {
        setSubmissionState('submitting');
        setSubmissionError(null);

        const requestData: AssignWorkflowRequest = {
          employeeId: data.employee.id,
          templateId: data.templateId,
          startDate: data.startDate,
        };

        setLastSubmittedData(requestData);

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[WorkflowAssignment] Submitting workflow assignment:', requestData);
        }

        const workflow = await assignWorkflow(requestData);

        if (import.meta.env.VITE_API_DEBUG === 'true') {
          console.debug('[WorkflowAssignment] Workflow assigned successfully:', workflow.id);
        }

        setSubmissionState('success');

        // Call success callback
        if (onSuccess) {
          onSuccess(workflow.id);
        }

        // Close dialog after short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (error) {
        const apiError = error as ApiErrorResponse;
        console.error('[WorkflowAssignment] Failed to assign workflow:', apiError);

        setSubmissionState('error');
        setSubmissionError(apiError);
      }
    },
    [onSuccess, onClose]
  );

  /**
   * Retry last failed submission
   */
  const handleRetry = useCallback(async (): Promise<void> => {
    if (!lastSubmittedData) {
      console.warn('[WorkflowAssignment] No previous submission to retry');
      return;
    }

    try {
      setSubmissionState('submitting');
      setSubmissionError(null);

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[WorkflowAssignment] Retrying workflow assignment:', lastSubmittedData);
      }

      const workflow = await assignWorkflow(lastSubmittedData);

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[WorkflowAssignment] Workflow assigned successfully on retry:', workflow.id);
      }

      setSubmissionState('success');

      if (onSuccess) {
        onSuccess(workflow.id);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      const apiError = error as ApiErrorResponse;
      console.error('[WorkflowAssignment] Retry failed:', apiError);

      setSubmissionState('error');
      setSubmissionError(apiError);
    }
  }, [lastSubmittedData, onSuccess, onClose]);

  /**
   * Handle dialog close
   */
  const handleClose = useCallback((): void => {
    if (submissionState === 'submitting') {
      console.warn('[WorkflowAssignment] Cannot close dialog during submission');
      return;
    }

    onClose();
  }, [submissionState, onClose]);

  /**
   * Render employee option label
   */
  const getEmployeeOptionLabel = useCallback((employee: Employee): string => {
    return `${employee.firstName} ${employee.lastName} (${employee.email})`;
  }, []);

  /**
   * Check if employee options are equal
   */
  const isEmployeeOptionEqual = useCallback(
    (option: Employee, value: Employee): boolean => {
      return option.id === value.id;
    },
    []
  );

  // Loading state
  const isLoading = templatesLoading || employeesLoading || submissionState === 'submitting';

  // Disable form during submission or success
  const isFormDisabled = submissionState === 'submitting' || submissionState === 'success';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="workflow-assignment-dialog-title"
      aria-describedby="workflow-assignment-dialog-description"
    >
      <DialogTitle id="workflow-assignment-dialog-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="span">
            Assign Onboarding Workflow
          </Typography>
          <IconButton
            aria-label="close dialog"
            onClick={handleClose}
            disabled={isFormDisabled}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography
          id="workflow-assignment-dialog-description"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Select an employee and onboarding template to create a new workflow assignment.
        </Typography>

        {/* Templates loading error */}
        {templatesError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={refetchTemplates}>
                Retry
              </Button>
            }
          >
            Failed to load templates: {templatesError.message}
          </Alert>
        )}

        {/* Submission success message */}
        {submissionState === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Workflow assigned successfully! Closing...
          </Alert>
        )}

        {/* Submission error message */}
        {submissionState === 'error' && submissionError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            {submissionError.message || 'Failed to assign workflow. Please try again.'}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Employee selection */}
          <Controller
            name="employee"
            control={control}
            rules={{
              required: 'Employee is required',
              validate: (value) => value !== null || 'Please select an employee',
            }}
            render={({ field: { onChange, value } }) => (
              <Autocomplete
                options={employees as Employee[]}
                getOptionLabel={getEmployeeOptionLabel}
                isOptionEqualToValue={isEmployeeOptionEqual}
                loading={employeesLoading}
                disabled={isFormDisabled}
                value={value}
                onChange={(_, newValue) => onChange(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Employee"
                    required
                    error={!!errors.employee}
                    helperText={errors.employee?.message}
                    placeholder="Search by name or email"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {employeesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body1">
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} • {option.department} • {option.position}
                      </Typography>
                    </Box>
                  </li>
                )}
                sx={{ mb: 2 }}
              />
            )}
          />

          {/* Template selection */}
          <Controller
            name="templateId"
            control={control}
            rules={{
              required: 'Template is required',
              validate: (value) => value.length > 0 || 'Please select a template',
            }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Onboarding Template"
                required
                fullWidth
                disabled={isFormDisabled || templatesLoading}
                error={!!errors.templateId}
                helperText={errors.templateId?.message || `${activeTemplates.length} templates available`}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: templatesLoading ? (
                    <CircularProgress color="inherit" size={20} sx={{ mr: 2 }} />
                  ) : null,
                }}
              >
                {activeTemplates.length === 0 && !templatesLoading && (
                  <MenuItem value="" disabled>
                    No active templates available
                  </MenuItem>
                )}
                {activeTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    <Box>
                      <Typography variant="body1">{template.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {template.tasks.length} tasks • {template.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Start date selection */}
          <Controller
            name="startDate"
            control={control}
            rules={{
              required: 'Start date is required',
              validate: (value) => {
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return selectedDate >= today || 'Start date cannot be in the past';
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label="Start Date"
                required
                fullWidth
                disabled={isFormDisabled}
                error={!!errors.startDate}
                helperText={errors.startDate?.message || 'Workflow will begin on this date'}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            )}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isFormDisabled}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={!isValid || isFormDisabled || activeTemplates.length === 0}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {submissionState === 'submitting' ? 'Assigning...' : 'Assign Workflow'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowAssignment;