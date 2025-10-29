/**
 * AppraisalForm Component
 * 
 * Form component for initiating a new performance appraisal cycle.
 * Allows managers to select an employee and define the review period.
 * 
 * Features:
 * - Employee selection via autocomplete
 * - Review period date range picker
 * - Client-side validation
 * - Loading states during submission
 * - Error handling with retry capability
 * - Responsive dialog/modal wrapper
 * - Accessibility compliant (WCAG 2.1 AA)
 * 
 * @module components/appraisal/AppraisalForm
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
  Box,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAppraisals } from '../../hooks/useAppraisals';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, handleApiError, ApiErrorResponse } from '../../api/client';

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
 * Form validation errors
 */
interface FormErrors {
  readonly employee?: string;
  readonly reviewPeriodStart?: string;
  readonly reviewPeriodEnd?: string;
}

/**
 * AppraisalForm component props
 */
export interface AppraisalFormProps {
  /** Whether the dialog is open */
  readonly open: boolean;
  
  /** Callback when dialog should close */
  readonly onClose: () => void;
  
  /** Callback when appraisal is successfully created */
  readonly onSuccess?: (appraisalId: string) => void;
}

/**
 * AppraisalForm Component
 * 
 * Renders a modal form for creating new performance appraisals.
 * Handles employee selection, date range validation, and submission.
 * 
 * @param props - Component props
 * @returns Rendered AppraisalForm component
 * 
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * 
 * <AppraisalForm
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onSuccess={(id) => {
 *     console.log('Created appraisal:', id);
 *     setOpen(false);
 *   }}
 * />
 * ```
 */
export const AppraisalForm: React.FC<AppraisalFormProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { createAppraisal, loading: appraisalLoading, error: appraisalError } = useAppraisals({
    view: 'team',
    fetchOnMount: false,
  });

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [reviewPeriodStart, setReviewPeriodStart] = useState<string>('');
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<ApiErrorResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Employee loading state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeesError, setEmployeesError] = useState<ApiErrorResponse | null>(null);

  /**
   * Fetch team members for employee selection
   */
  const fetchTeamMembers = useCallback(async () => {
    if (!user) {
      console.warn('[AppraisalForm] Cannot fetch team members: user not authenticated', {
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setLoadingEmployees(true);
    setEmployeesError(null);

    try {
      console.info('[AppraisalForm] Fetching team members', {
        managerId: user.id,
        timestamp: new Date().toISOString(),
      });

      const response = await apiClient.get<{ data: Employee[] }>('/employees/team');
      
      setEmployees(response.data.data);
      
      console.info('[AppraisalForm] Team members fetched successfully', {
        count: response.data.data.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const apiError = handleApiError(err);
      console.error('[AppraisalForm] Failed to fetch team members', {
        error: apiError,
        timestamp: new Date().toISOString(),
      });
      setEmployeesError(apiError);
    } finally {
      setLoadingEmployees(false);
    }
  }, [user]);

  /**
   * Fetch employees when dialog opens
   */
  useEffect(() => {
    if (open && employees.length === 0) {
      fetchTeamMembers();
    }
  }, [open, employees.length, fetchTeamMembers]);

  /**
   * Reset form when dialog closes
   */
  useEffect(() => {
    if (!open) {
      setSelectedEmployee(null);
      setReviewPeriodStart('');
      setReviewPeriodEnd('');
      setFormErrors({});
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  /**
   * Validate form fields
   */
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    // Validate employee selection
    if (!selectedEmployee) {
      errors.employee = 'Please select an employee';
    }

    // Validate review period start date
    if (!reviewPeriodStart) {
      errors.reviewPeriodStart = 'Please select a start date';
    } else {
      const startDate = new Date(reviewPeriodStart);
      if (isNaN(startDate.getTime())) {
        errors.reviewPeriodStart = 'Invalid start date';
      }
    }

    // Validate review period end date
    if (!reviewPeriodEnd) {
      errors.reviewPeriodEnd = 'Please select an end date';
    } else {
      const endDate = new Date(reviewPeriodEnd);
      if (isNaN(endDate.getTime())) {
        errors.reviewPeriodEnd = 'Invalid end date';
      }
    }

    // Validate date range
    if (reviewPeriodStart && reviewPeriodEnd && !errors.reviewPeriodStart && !errors.reviewPeriodEnd) {
      const startDate = new Date(reviewPeriodStart);
      const endDate = new Date(reviewPeriodEnd);

      if (endDate <= startDate) {
        errors.reviewPeriodEnd = 'End date must be after start date';
      }

      // Check if date range is reasonable (not more than 2 years)
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 730) {
        errors.reviewPeriodEnd = 'Review period cannot exceed 2 years';
      }

      // Check if date range is too short (less than 1 month)
      if (daysDiff < 30) {
        errors.reviewPeriodEnd = 'Review period must be at least 1 month';
      }
    }

    setFormErrors(errors);

    const isValid = Object.keys(errors).length === 0;
    
    console.debug('[AppraisalForm] Form validation', {
      isValid,
      errors,
      timestamp: new Date().toISOString(),
    });

    return isValid;
  }, [selectedEmployee, reviewPeriodStart, reviewPeriodEnd]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      console.warn('[AppraisalForm] Form validation failed', {
        errors: formErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!selectedEmployee) {
      console.error('[AppraisalForm] Cannot submit: no employee selected', {
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      console.info('[AppraisalForm] Submitting appraisal creation', {
        employeeId: selectedEmployee.id,
        reviewPeriodStart,
        reviewPeriodEnd,
        timestamp: new Date().toISOString(),
      });

      const appraisal = await createAppraisal(selectedEmployee.id, {
        start: reviewPeriodStart,
        end: reviewPeriodEnd,
      });

      if (appraisal) {
        console.info('[AppraisalForm] Appraisal created successfully', {
          appraisalId: appraisal.id,
          timestamp: new Date().toISOString(),
        });

        if (onSuccess) {
          onSuccess(appraisal.id);
        }

        // Close dialog after successful submission
        onClose();
      } else {
        throw new Error('Failed to create appraisal: no appraisal returned');
      }
    } catch (err) {
      const apiError = handleApiError(err);
      console.error('[AppraisalForm] Failed to create appraisal', {
        error: apiError,
        timestamp: new Date().toISOString(),
      });
      setSubmitError(apiError);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, selectedEmployee, reviewPeriodStart, reviewPeriodEnd, createAppraisal, onSuccess, onClose, formErrors]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    setSubmitError(null);
    setEmployeesError(null);
    
    if (employeesError) {
      fetchTeamMembers();
    } else {
      handleSubmit();
    }
  }, [employeesError, fetchTeamMembers, handleSubmit]);

  /**
   * Get employee display label
   */
  const getEmployeeLabel = useCallback((employee: Employee): string => {
    return `${employee.firstName} ${employee.lastName} - ${employee.position}`;
  }, []);

  /**
   * Check if form is valid for submission
   */
  const isFormValid = useMemo(() => {
    return selectedEmployee !== null && 
           reviewPeriodStart !== '' && 
           reviewPeriodEnd !== '' &&
           Object.keys(formErrors).length === 0;
  }, [selectedEmployee, reviewPeriodStart, reviewPeriodEnd, formErrors]);

  /**
   * Get minimum date for date pickers (today)
   */
  const minDate = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  /**
   * Get minimum end date (start date + 1 day)
   */
  const minEndDate = useMemo(() => {
    if (!reviewPeriodStart) return minDate;
    
    const startDate = new Date(reviewPeriodStart);
    startDate.setDate(startDate.getDate() + 1);
    return startDate.toISOString().split('T')[0];
  }, [reviewPeriodStart, minDate]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="appraisal-form-title"
      aria-describedby="appraisal-form-description"
    >
      <DialogTitle id="appraisal-form-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="span">
            Initiate Performance Appraisal
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            disabled={isSubmitting}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography
          id="appraisal-form-description"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Select an employee and define the review period to initiate a new performance appraisal cycle.
        </Typography>

        {/* Error display for employee loading */}
        {employeesError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            <Typography variant="body2">
              Failed to load team members: {employeesError.message}
            </Typography>
          </Alert>
        )}

        {/* Error display for submission */}
        {submitError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            <Typography variant="body2">
              Failed to create appraisal: {submitError.message}
            </Typography>
          </Alert>
        )}

        {/* Employee selection */}
        <Autocomplete
          id="employee-select"
          options={employees}
          getOptionLabel={getEmployeeLabel}
          value={selectedEmployee}
          onChange={(_, newValue) => {
            setSelectedEmployee(newValue);
            const { employee, ...rest } = formErrors;
            setFormErrors(rest);
          }}
          loading={loadingEmployees}
          disabled={isSubmitting || loadingEmployees}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Employee"
              required
              error={Boolean(formErrors.employee)}
              helperText={formErrors.employee}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingEmployees && <CircularProgress color="inherit" size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              inputProps={{
                ...params.inputProps,
                'aria-label': 'Select employee for appraisal',
                'aria-required': 'true',
                'aria-invalid': Boolean(formErrors.employee),
              }}
            />
          )}
          sx={{ mb: 3 }}
        />

        {/* Review period start date */}
        <TextField
          id="review-period-start"
          label="Review Period Start"
          type="date"
          value={reviewPeriodStart}
          onChange={(e) => {
            setReviewPeriodStart(e.target.value);
            const { reviewPeriodStart: _, ...rest } = formErrors;
            setFormErrors(rest);
          }}
          required
          fullWidth
          disabled={isSubmitting}
          error={Boolean(formErrors.reviewPeriodStart)}
          helperText={formErrors.reviewPeriodStart || 'Select the start date of the review period'}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            min: minDate,
            'aria-label': 'Review period start date',
            'aria-required': 'true',
            'aria-invalid': Boolean(formErrors.reviewPeriodStart),
          }}
          sx={{ mb: 3 }}
        />

        {/* Review period end date */}
        <TextField
          id="review-period-end"
          label="Review Period End"
          type="date"
          value={reviewPeriodEnd}
          onChange={(e) => {
            setReviewPeriodEnd(e.target.value);
            const { reviewPeriodEnd: _, ...rest } = formErrors;
            setFormErrors(rest);
          }}
          required
          fullWidth
          disabled={isSubmitting || !reviewPeriodStart}
          error={Boolean(formErrors.reviewPeriodEnd)}
          helperText={formErrors.reviewPeriodEnd || 'Select the end date of the review period'}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            min: minEndDate,
            'aria-label': 'Review period end date',
            'aria-required': 'true',
            'aria-invalid': Boolean(formErrors.reviewPeriodEnd),
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Cancel appraisal creation"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid || isSubmitting || loadingEmployees}
          startIcon={isSubmitting && <CircularProgress size={16} color="inherit" />}
          aria-label="Create appraisal"
        >
          {isSubmitting ? 'Creating...' : 'Create Appraisal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppraisalForm;