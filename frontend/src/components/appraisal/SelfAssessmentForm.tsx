/**
 * Self-Assessment Form Component
 * 
 * Provides a comprehensive interface for employees to submit their self-assessment
 * as part of the performance appraisal process. Includes:
 * - Display of appraisal information (review period, reviewer)
 * - Multi-line text area for self-assessment (max 5000 characters)
 * - Goal management section (add/edit goals)
 * - Form validation with react-hook-form
 * - Loading states and error handling
 * - Success/error notifications
 * 
 * @module components/appraisal/SelfAssessmentForm
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Chip,
  FormHelperText,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Appraisal,
  GoalStatus,
  APPRAISAL_VALIDATION,
  getGoalStatusLabel,
  getGoalStatusColor,
  isValidSelfAssessment,
  isValidGoalTitle,
  isValidGoalDescription,
} from '../../types/appraisal';
import { useAppraisals } from '../../hooks/useAppraisals';

/**
 * Form data structure for self-assessment submission
 */
interface SelfAssessmentFormData {
  /** Self-assessment text content */
  readonly selfAssessment: string;
  
  /** Array of goals to be set/updated */
  readonly goals: Array<{
    /** Goal title */
    readonly title: string;
    /** Goal description */
    readonly description: string;
    /** Target completion date */
    readonly targetDate: string;
    /** Goal status */
    readonly status: GoalStatus;
  }>;
}

/**
 * Component props interface
 */
export interface SelfAssessmentFormProps {
  /** The appraisal to submit self-assessment for */
  readonly appraisal: Appraisal;
  
  /** Whether the dialog is open */
  readonly open: boolean;
  
  /** Callback when dialog should close */
  readonly onClose: () => void;
  
  /** Callback when self-assessment is successfully submitted */
  readonly onSuccess?: (appraisal: Appraisal) => void;
}

/**
 * Self-Assessment Form Component
 * 
 * Renders a modal dialog for employees to submit their self-assessment
 * with goal management capabilities.
 * 
 * @param props - Component props
 * @returns Self-assessment form dialog
 * 
 * @example
 * ```tsx
 * <SelfAssessmentForm
 *   appraisal={appraisal}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(updated) => console.log('Submitted:', updated)}
 * />
 * ```
 */
export const SelfAssessmentForm: React.FC<SelfAssessmentFormProps> = ({
  appraisal,
  open,
  onClose,
  onSuccess,
}) => {
  const { submitSelfAssessment, loading, error } = useAppraisals();
  
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  /**
   * Initialize form with react-hook-form
   */
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<SelfAssessmentFormData>({
    defaultValues: {
      selfAssessment: appraisal.selfAssessment || '',
      goals: appraisal.goals.length > 0
        ? appraisal.goals.map(goal => ({
            title: goal.title,
            description: goal.description,
            targetDate: goal.targetDate.split('T')[0], // Convert to YYYY-MM-DD
            status: goal.status,
          }))
        : [],
    },
    mode: 'onChange',
  });

  /**
   * Field array for dynamic goal management
   */
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'goals',
  });

  /**
   * Watch self-assessment field for character count
   */
  const selfAssessmentValue = watch('selfAssessment');

  /**
   * Update character count when self-assessment changes
   */
  useEffect(() => {
    setCharacterCount(selfAssessmentValue?.length || 0);
  }, [selfAssessmentValue]);

  /**
   * Reset form when dialog opens/closes or appraisal changes
   */
  useEffect(() => {
    if (open) {
      reset({
        selfAssessment: appraisal.selfAssessment || '',
        goals: appraisal.goals.length > 0
          ? appraisal.goals.map(goal => ({
              title: goal.title,
              description: goal.description,
              targetDate: goal.targetDate.split('T')[0],
              status: goal.status,
            }))
          : [],
      });
      setSubmitError(null);
      setSubmitSuccess(false);
    }
  }, [open, appraisal, reset]);

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    async (data: SelfAssessmentFormData) => {
      console.info('[SelfAssessmentForm] Submitting self-assessment', {
        appraisalId: appraisal.id,
        assessmentLength: data.selfAssessment.length,
        goalsCount: data.goals.length,
        timestamp: new Date().toISOString(),
      });

      setSubmitError(null);
      setSubmitSuccess(false);

      try {
        // Prepare goals data
        const goalsData = data.goals.map(goal => ({
          title: goal.title.trim(),
          description: goal.description.trim(),
          targetDate: new Date(goal.targetDate).toISOString(),
          status: goal.status,
        }));

        // Submit self-assessment
        const updatedAppraisal = await submitSelfAssessment(appraisal.id, {
          selfAssessment: data.selfAssessment.trim(),
          goals: goalsData,
        });

        if (updatedAppraisal) {
          console.info('[SelfAssessmentForm] Self-assessment submitted successfully', {
            appraisalId: updatedAppraisal.id,
            status: updatedAppraisal.status,
            timestamp: new Date().toISOString(),
          });

          setSubmitSuccess(true);

          // Call success callback after a brief delay to show success message
          setTimeout(() => {
            onSuccess?.(updatedAppraisal);
            onClose();
          }, 1500);
        } else {
          throw new Error('Failed to submit self-assessment');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit self-assessment';
        console.error('[SelfAssessmentForm] Submission failed', {
          appraisalId: appraisal.id,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        setSubmitError(errorMessage);
      }
    },
    [appraisal.id, submitSelfAssessment, onSuccess, onClose]
  );

  /**
   * Handle adding a new goal
   */
  const handleAddGoal = useCallback(() => {
    console.debug('[SelfAssessmentForm] Adding new goal', {
      currentGoalsCount: fields.length,
      timestamp: new Date().toISOString(),
    });

    append({
      title: '',
      description: '',
      targetDate: new Date().toISOString().split('T')[0],
      status: GoalStatus.NOT_STARTED,
    });
  }, [append, fields.length]);

  /**
   * Handle removing a goal
   */
  const handleRemoveGoal = useCallback(
    (index: number) => {
      console.debug('[SelfAssessmentForm] Removing goal', {
        index,
        remainingGoals: fields.length - 1,
        timestamp: new Date().toISOString(),
      });

      remove(index);
    },
    [remove, fields.length]
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

    console.debug('[SelfAssessmentForm] Closing dialog', {
      isDirty,
      submitSuccess,
      timestamp: new Date().toISOString(),
    });

    onClose();
  }, [isDirty, submitSuccess, onClose]);

  /**
   * Calculate remaining characters
   */
  const remainingCharacters = APPRAISAL_VALIDATION.SELF_ASSESSMENT_MAX_LENGTH - characterCount;
  const isNearLimit = remainingCharacters < 500;
  const isOverLimit = remainingCharacters < 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="self-assessment-dialog-title"
      aria-describedby="self-assessment-dialog-description"
    >
      <DialogTitle id="self-assessment-dialog-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Submit Self-Assessment
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            disabled={loading.submitAssessment}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Appraisal Information */}
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Appraisal Information
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            <Box display="flex" flexDirection="column" gap={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Review Period:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {new Date(appraisal.reviewPeriodStart).toLocaleDateString()} -{' '}
                  {new Date(appraisal.reviewPeriodEnd).toLocaleDateString()}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Reviewer:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {appraisal.reviewerName}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Success Message */}
        {submitSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Self-assessment submitted successfully! Redirecting...
          </Alert>
        )}

        {/* Error Messages */}
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        {error.submitAssessment && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.submitAssessment.message || 'Failed to submit self-assessment'}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Self-Assessment Text Area */}
          <Box mb={3}>
            <Controller
              name="selfAssessment"
              control={control}
              rules={{
                required: 'Self-assessment is required',
                validate: {
                  notEmpty: (value) =>
                    value.trim().length > 0 || 'Self-assessment cannot be empty',
                  maxLength: (value) =>
                    value.length <= APPRAISAL_VALIDATION.SELF_ASSESSMENT_MAX_LENGTH ||
                    `Self-assessment must not exceed ${APPRAISAL_VALIDATION.SELF_ASSESSMENT_MAX_LENGTH} characters`,
                  validContent: (value) =>
                    isValidSelfAssessment(value) ||
                    'Please provide a meaningful self-assessment',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Self-Assessment"
                  multiline
                  rows={8}
                  fullWidth
                  required
                  error={!!errors.selfAssessment}
                  helperText={errors.selfAssessment?.message}
                  placeholder="Reflect on your performance during this review period. Describe your achievements, challenges, and areas for growth..."
                  disabled={loading.submitAssessment}
                  inputProps={{
                    'aria-label': 'Self-assessment text',
                    'aria-describedby': 'self-assessment-helper-text',
                  }}
                />
              )}
            />
            <FormHelperText
              id="self-assessment-helper-text"
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                color: isOverLimit ? 'error.main' : isNearLimit ? 'warning.main' : 'text.secondary',
              }}
            >
              {characterCount} / {APPRAISAL_VALIDATION.SELF_ASSESSMENT_MAX_LENGTH} characters
              {isOverLimit && ' (exceeds limit)'}
            </FormHelperText>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Goals Section */}
          <Box mb={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle1" fontWeight="medium">
                Goals
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddGoal}
                disabled={loading.submitAssessment}
                size="small"
                aria-label="Add new goal"
              >
                Add Goal
              </Button>
            </Box>

            {fields.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
                <Typography variant="body2" color="text.secondary">
                  No goals added yet. Click "Add Goal" to set your performance goals.
                </Typography>
              </Paper>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {fields.map((field, index) => (
                  <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="flex-start" gap={2}>
                      <Box flex={1}>
                        {/* Goal Title */}
                        <Controller
                          name={`goals.${index}.title`}
                          control={control}
                          rules={{
                            required: 'Goal title is required',
                            maxLength: {
                              value: APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH,
                              message: `Title must not exceed ${APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH} characters`,
                            },
                            validate: {
                              validTitle: (value) =>
                                isValidGoalTitle(value) || 'Please provide a valid goal title',
                            },
                          }}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Goal Title"
                              fullWidth
                              required
                              size="small"
                              error={!!errors.goals?.[index]?.title}
                              helperText={errors.goals?.[index]?.title?.message}
                              disabled={loading.submitAssessment}
                              sx={{ mb: 2 }}
                              inputProps={{
                                'aria-label': `Goal ${index + 1} title`,
                              }}
                            />
                          )}
                        />

                        {/* Goal Description */}
                        <Controller
                          name={`goals.${index}.description`}
                          control={control}
                          rules={{
                            required: 'Goal description is required',
                            maxLength: {
                              value: APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH,
                              message: `Description must not exceed ${APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH} characters`,
                            },
                            validate: {
                              validDescription: (value) =>
                                isValidGoalDescription(value) ||
                                'Please provide a valid goal description',
                            },
                          }}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Goal Description"
                              fullWidth
                              required
                              multiline
                              rows={3}
                              size="small"
                              error={!!errors.goals?.[index]?.description}
                              helperText={errors.goals?.[index]?.description?.message}
                              disabled={loading.submitAssessment}
                              sx={{ mb: 2 }}
                              inputProps={{
                                'aria-label': `Goal ${index + 1} description`,
                              }}
                            />
                          )}
                        />

                        <Box display="flex" gap={2}>
                          {/* Target Date */}
                          <Controller
                            name={`goals.${index}.targetDate`}
                            control={control}
                            rules={{
                              required: 'Target date is required',
                              validate: {
                                futureDate: (value) => {
                                  const date = new Date(value);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  return date >= today || 'Target date must be today or in the future';
                                },
                              },
                            }}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="Target Date"
                                type="date"
                                required
                                size="small"
                                error={!!errors.goals?.[index]?.targetDate}
                                helperText={errors.goals?.[index]?.targetDate?.message}
                                disabled={loading.submitAssessment}
                                sx={{ flex: 1 }}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{
                                  'aria-label': `Goal ${index + 1} target date`,
                                  min: new Date().toISOString().split('T')[0],
                                }}
                              />
                            )}
                          />

                          {/* Goal Status */}
                          <Controller
                            name={`goals.${index}.status`}
                            control={control}
                            rules={{ required: 'Status is required' }}
                            render={({ field }) => (
                              <FormControl size="small" sx={{ flex: 1 }} error={!!errors.goals?.[index]?.status}>
                                <InputLabel id={`goal-${index}-status-label`}>Status</InputLabel>
                                <Select
                                  {...field}
                                  labelId={`goal-${index}-status-label`}
                                  label="Status"
                                  disabled={loading.submitAssessment}
                                  inputProps={{
                                    'aria-label': `Goal ${index + 1} status`,
                                  }}
                                >
                                  {Object.values(GoalStatus).map((status) => (
                                    <MenuItem key={status} value={status}>
                                      <Chip
                                        label={getGoalStatusLabel(status)}
                                        size="small"
                                        color={getGoalStatusColor(status)}
                                      />
                                    </MenuItem>
                                  ))}
                                </Select>
                                {errors.goals?.[index]?.status && (
                                  <FormHelperText>{errors.goals[index]?.status?.message}</FormHelperText>
                                )}
                              </FormControl>
                            )}
                          />
                        </Box>
                      </Box>

                      {/* Remove Goal Button */}
                      <IconButton
                        onClick={() => handleRemoveGoal(index)}
                        disabled={loading.submitAssessment}
                        size="small"
                        color="error"
                        aria-label={`Remove goal ${index + 1}`}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        </form>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading.submitAssessment}
          aria-label="Cancel and close dialog"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={loading.submitAssessment || isOverLimit || submitSuccess}
          startIcon={loading.submitAssessment ? <CircularProgress size={20} /> : <SaveIcon />}
          aria-label="Submit self-assessment"
        >
          {loading.submitAssessment ? 'Submitting...' : 'Submit Self-Assessment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelfAssessmentForm;