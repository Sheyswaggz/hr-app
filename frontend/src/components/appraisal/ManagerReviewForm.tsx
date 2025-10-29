/**
 * Manager Review Form Component
 * 
 * Production-ready form component for managers to submit performance reviews
 * with feedback and ratings. Includes employee self-assessment display,
 * goal review section, and comprehensive validation.
 * 
 * @module components/appraisal/ManagerReviewForm
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Rating,
  Box,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Stack,
  FormHelperText,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Send as SendIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import {
  Appraisal,
  SubmitManagerReviewRequest,
  APPRAISAL_VALIDATION,
  isValidManagerFeedback,
  isValidRating,
  getGoalStatusLabel,
  getGoalStatusColor,
  GoalStatus,
} from '../../types/appraisal';
import { useAppraisals } from '../../hooks/useAppraisals';

/**
 * Manager review form data structure
 */
interface ManagerReviewFormData {
  /** Manager's feedback text */
  readonly managerFeedback: string;
  
  /** Performance rating (1-5 stars) */
  readonly rating: number;
}

/**
 * Component props interface
 */
export interface ManagerReviewFormProps {
  /** Appraisal to review */
  readonly appraisal: Appraisal;
  
  /** Whether the dialog is open */
  readonly open: boolean;
  
  /** Callback when dialog should close */
  readonly onClose: () => void;
  
  /** Callback on successful submission */
  readonly onSuccess?: (appraisal: Appraisal) => void;
}

/**
 * Manager Review Form Component
 * 
 * Provides a comprehensive interface for managers to:
 * - View employee self-assessment
 * - Review employee goals
 * - Provide detailed feedback
 * - Assign performance rating
 * 
 * Features:
 * - Real-time character counting
 * - Client-side validation
 * - Loading states during submission
 * - Error handling with retry capability
 * - Responsive design
 * - Keyboard navigation support
 * - ARIA labels for accessibility
 * 
 * @param props - Component props
 * @returns Manager review form dialog
 * 
 * @example
 * ```tsx
 * <ManagerReviewForm
 *   appraisal={selectedAppraisal}
 *   open={isDialogOpen}
 *   onClose={() => setIsDialogOpen(false)}
 *   onSuccess={(updated) => {
 *     console.log('Review submitted:', updated);
 *     setIsDialogOpen(false);
 *   }}
 * />
 * ```
 */
export const ManagerReviewForm: React.FC<ManagerReviewFormProps> = ({
  appraisal,
  open,
  onClose,
  onSuccess,
}) => {
  // ============================================================
  // Hooks and State Management
  // ============================================================

  const { submitReview, loading, error } = useAppraisals();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
  } = useForm<ManagerReviewFormData>({
    defaultValues: {
      managerFeedback: appraisal.managerFeedback || '',
      rating: appraisal.rating || 0,
    },
    mode: 'onChange',
  });

  // Watch form values for character counting
  const managerFeedback = watch('managerFeedback');
  const rating = watch('rating');

  // ============================================================
  // Computed Values
  // ============================================================

  /**
   * Calculate remaining characters for feedback
   */
  const feedbackCharsRemaining = useMemo(() => {
    return APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH - (managerFeedback?.length || 0);
  }, [managerFeedback]);

  /**
   * Check if feedback is approaching character limit
   */
  const isFeedbackNearLimit = useMemo(() => {
    return feedbackCharsRemaining < 500;
  }, [feedbackCharsRemaining]);

  /**
   * Format review period for display
   */
  const reviewPeriodDisplay = useMemo(() => {
    const start = new Date(appraisal.reviewPeriodStart).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const end = new Date(appraisal.reviewPeriodEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `${start} - ${end}`;
  }, [appraisal.reviewPeriodStart, appraisal.reviewPeriodEnd]);

  /**
   * Check if form can be submitted
   */
  const canSubmit = useMemo(() => {
    return (
      isDirty &&
      !loading.submitReview &&
      isValidManagerFeedback(managerFeedback || '') &&
      isValidRating(rating || 0)
    );
  }, [isDirty, loading.submitReview, managerFeedback, rating]);

  // ============================================================
  // Event Handlers
  // ============================================================

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: ManagerReviewFormData) => {
      setSubmitError(null);
      setSubmitSuccess(false);

      console.info('[ManagerReviewForm] Submitting manager review', {
        appraisalId: appraisal.id,
        employeeId: appraisal.employeeId,
        rating: data.rating,
        feedbackLength: data.managerFeedback.length,
        timestamp: new Date().toISOString(),
      });

      try {
        const payload: SubmitManagerReviewRequest = {
          managerFeedback: data.managerFeedback.trim(),
          rating: data.rating,
        };

        const updatedAppraisal = await submitReview(appraisal.id, payload);

        if (updatedAppraisal) {
          console.info('[ManagerReviewForm] Manager review submitted successfully', {
            appraisalId: updatedAppraisal.id,
            status: updatedAppraisal.status,
            rating: updatedAppraisal.rating,
            timestamp: new Date().toISOString(),
          });

          setSubmitSuccess(true);

          // Call success callback after short delay to show success message
          setTimeout(() => {
            onSuccess?.(updatedAppraisal);
            handleClose();
          }, 1500);
        } else {
          throw new Error('Failed to submit manager review');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit review';
        console.error('[ManagerReviewForm] Failed to submit manager review', {
          appraisalId: appraisal.id,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        setSubmitError(errorMessage);
      }
    },
    [appraisal.id, appraisal.employeeId, submitReview, onSuccess]
  );

  /**
   * Handle dialog close with confirmation if form is dirty
   */
  const handleClose = useCallback(() => {
    if (isDirty && !submitSuccess) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }

    console.debug('[ManagerReviewForm] Closing dialog', {
      appraisalId: appraisal.id,
      isDirty,
      timestamp: new Date().toISOString(),
    });

    reset();
    setSubmitError(null);
    setSubmitSuccess(false);
    onClose();
  }, [isDirty, submitSuccess, reset, onClose, appraisal.id]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    setSubmitError(null);
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  // ============================================================
  // Render Helpers
  // ============================================================

  /**
   * Render employee self-assessment section
   */
  const renderSelfAssessment = () => {
    if (!appraisal.selfAssessment) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          Employee has not submitted self-assessment yet.
        </Alert>
      );
    }

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Employee Self-Assessment
        </Typography>
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            mt: 1,
          }}
        >
          {appraisal.selfAssessment}
        </Typography>
        {appraisal.selfAssessmentSubmittedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Submitted on{' '}
            {new Date(appraisal.selfAssessmentSubmittedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Typography>
        )}
      </Paper>
    );
  };

  /**
   * Render goals review section
   */
  const renderGoals = () => {
    if (!appraisal.goals || appraisal.goals.length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          No goals have been set for this appraisal period.
        </Alert>
      );
    }

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Performance Goals
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {appraisal.goals.map((goal) => (
            <Paper key={goal.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {goal.title}
                </Typography>
                <Chip
                  label={getGoalStatusLabel(goal.status)}
                  color={getGoalStatusColor(goal.status)}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {goal.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Target Date:{' '}
                {new Date(goal.targetDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>
    );
  };

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="manager-review-dialog-title"
      aria-describedby="manager-review-dialog-description"
    >
      <DialogTitle id="manager-review-dialog-title">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            Manager Review
          </Typography>
          <Button
            onClick={handleClose}
            size="small"
            startIcon={<CloseIcon />}
            disabled={loading.submitReview}
            aria-label="Close dialog"
          >
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Appraisal Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Employee
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
            {appraisal.employeeName}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Review Period
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {reviewPeriodDisplay}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Employee Self-Assessment */}
        {renderSelfAssessment()}

        <Divider sx={{ my: 3 }} />

        {/* Goals Review */}
        {renderGoals()}

        <Divider sx={{ my: 3 }} />

        {/* Manager Review Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Performance Rating *
            </Typography>
            <Controller
              name="rating"
              control={control}
              rules={{
                required: 'Rating is required',
                min: {
                  value: APPRAISAL_VALIDATION.MIN_RATING,
                  message: `Rating must be at least ${APPRAISAL_VALIDATION.MIN_RATING}`,
                },
                max: {
                  value: APPRAISAL_VALIDATION.MAX_RATING,
                  message: `Rating must be at most ${APPRAISAL_VALIDATION.MAX_RATING}`,
                },
                validate: (value) =>
                  isValidRating(value) || 'Please select a valid rating (1-5 stars)',
              }}
              render={({ field }) => (
                <Box>
                  <Rating
                    {...field}
                    value={field.value || 0}
                    onChange={(_, newValue) => {
                      field.onChange(newValue || 0);
                    }}
                    precision={1}
                    size="large"
                    icon={<StarIcon fontSize="inherit" />}
                    emptyIcon={<StarBorderIcon fontSize="inherit" />}
                    aria-label="Performance rating"
                    disabled={loading.submitReview}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {rating > 0 ? `${rating} out of 5 stars` : 'Select a rating'}
                  </Typography>
                  {errors.rating && (
                    <FormHelperText error>{errors.rating.message}</FormHelperText>
                  )}
                </Box>
              )}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Manager Feedback *
            </Typography>
            <Controller
              name="managerFeedback"
              control={control}
              rules={{
                required: 'Manager feedback is required',
                validate: (value) =>
                  isValidManagerFeedback(value) ||
                  `Feedback must be between 1 and ${APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH} characters`,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  multiline
                  rows={8}
                  fullWidth
                  placeholder="Provide detailed feedback on the employee's performance, achievements, areas for improvement, and development recommendations..."
                  error={!!errors.managerFeedback}
                  helperText={
                    errors.managerFeedback?.message ||
                    `${feedbackCharsRemaining} characters remaining`
                  }
                  disabled={loading.submitReview}
                  inputProps={{
                    maxLength: APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH,
                    'aria-label': 'Manager feedback',
                  }}
                  FormHelperTextProps={{
                    sx: {
                      color: isFeedbackNearLimit ? 'warning.main' : undefined,
                    },
                  }}
                />
              )}
            />
          </Box>

          {/* Error Display */}
          {(submitError || error.submitReview) && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleRetry}>
                  Retry
                </Button>
              }
            >
              {submitError || error.submitReview?.message || 'Failed to submit review'}
            </Alert>
          )}

          {/* Success Display */}
          {submitSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Review submitted successfully! Closing...
            </Alert>
          )}
        </form>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading.submitReview}
          aria-label="Cancel review"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          startIcon={loading.submitReview ? <CircularProgress size={20} /> : <SendIcon />}
          disabled={!canSubmit || loading.submitReview}
          aria-label="Submit review"
        >
          {loading.submitReview ? 'Submitting...' : 'Submit Review'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManagerReviewForm;