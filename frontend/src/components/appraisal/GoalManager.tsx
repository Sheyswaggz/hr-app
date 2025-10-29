/**
 * GoalManager Component
 * 
 * Manages goals within an appraisal cycle. Provides functionality to:
 * - Display list of goals with their current status
 * - Add new goals with validation
 * - Edit existing goals
 * - Delete goals
 * - Track goal progress with status updates
 * 
 * Features:
 * - Client-side validation (title max 200 chars, description max 1000 chars)
 * - Read-only mode for completed appraisals
 * - Responsive design for desktop, tablet, and mobile
 * - Accessibility compliant with ARIA labels and keyboard navigation
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  Goal,
  GoalStatus,
  getGoalStatusLabel,
  getGoalStatusColor,
  APPRAISAL_VALIDATION,
  isValidGoalTitle,
  isValidGoalDescription,
} from '../../types/appraisal';

/**
 * Props interface for GoalManager component
 */
export interface GoalManagerProps {
  /** Array of goals to display and manage */
  readonly goals: Goal[];
  
  /** Callback fired when goals are modified (add, edit, delete) */
  readonly onChange: (goals: Goal[]) => void;
  
  /** If true, disables all editing functionality */
  readonly readOnly?: boolean;
}

/**
 * Form data interface for goal creation/editing
 */
interface GoalFormData {
  readonly title: string;
  readonly description: string;
  readonly targetDate: string;
  readonly status: GoalStatus;
}

/**
 * Validation errors interface
 */
interface ValidationErrors {
  readonly title?: string;
  readonly description?: string;
  readonly targetDate?: string;
}

/**
 * Initial form state for new goals
 */
const INITIAL_FORM_DATA: GoalFormData = {
  title: '',
  description: '',
  targetDate: '',
  status: GoalStatus.NOT_STARTED,
};

/**
 * GoalManager Component
 * 
 * Provides comprehensive goal management interface within appraisal context.
 * Handles CRUD operations with validation and status tracking.
 */
export const GoalManager: React.FC<GoalManagerProps> = ({
  goals,
  onChange,
  readOnly = false,
}) => {
  // ============================================================
  // State Management
  // ============================================================
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GoalFormData>(INITIAL_FORM_DATA);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ============================================================
  // Computed Values
  // ============================================================

  const isEditing = useMemo(() => editingGoalId !== null, [editingGoalId]);
  
  const dialogTitle = useMemo(
    () => (isEditing ? 'Edit Goal' : 'Add New Goal'),
    [isEditing]
  );

  const hasValidationErrors = useMemo(
    () => Object.keys(validationErrors).length > 0,
    [validationErrors]
  );

  // ============================================================
  // Validation Logic
  // ============================================================

  /**
   * Validates goal form data
   * Returns validation errors object or empty object if valid
   */
  const validateFormData = useCallback((data: GoalFormData): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Validate title
    if (!data.title.trim()) {
      errors.title = 'Title is required';
    } else if (!isValidGoalTitle(data.title)) {
      errors.title = `Title must not exceed ${APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH} characters`;
    }

    // Validate description
    if (!data.description.trim()) {
      errors.description = 'Description is required';
    } else if (!isValidGoalDescription(data.description)) {
      errors.description = `Description must not exceed ${APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH} characters`;
    }

    // Validate target date
    if (!data.targetDate) {
      errors.targetDate = 'Target date is required';
    } else {
      const targetDate = new Date(data.targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (targetDate < today) {
        errors.targetDate = 'Target date must be in the future';
      }
    }

    return errors;
  }, []);

  // ============================================================
  // Event Handlers
  // ============================================================

  /**
   * Opens dialog for adding new goal
   */
  const handleAddClick = useCallback(() => {
    if (readOnly) return;
    
    setFormData(INITIAL_FORM_DATA);
    setEditingGoalId(null);
    setValidationErrors({});
    setIsDialogOpen(true);
  }, [readOnly]);

  /**
   * Opens dialog for editing existing goal
   */
  const handleEditClick = useCallback((goal: Goal) => {
    if (readOnly) return;

    setFormData({
      title: goal.title,
      description: goal.description,
      targetDate: goal.targetDate,
      status: goal.status,
    });
    setEditingGoalId(goal.id);
    setValidationErrors({});
    setIsDialogOpen(true);
  }, [readOnly]);

  /**
   * Handles goal deletion with confirmation
   */
  const handleDeleteClick = useCallback((goalId: string) => {
    if (readOnly) return;
    setDeleteConfirmId(goalId);
  }, [readOnly]);

  /**
   * Confirms and executes goal deletion
   */
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirmId) return;

    const updatedGoals = goals.filter(goal => goal.id !== deleteConfirmId);
    onChange(updatedGoals);
    setDeleteConfirmId(null);

    console.log('[GoalManager] Goal deleted', {
      goalId: deleteConfirmId,
      remainingGoals: updatedGoals.length,
    });
  }, [deleteConfirmId, goals, onChange]);

  /**
   * Cancels delete confirmation
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  /**
   * Closes goal form dialog
   */
  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setFormData(INITIAL_FORM_DATA);
    setEditingGoalId(null);
    setValidationErrors({});
  }, []);

  /**
   * Handles form field changes with validation
   */
  const handleFieldChange = useCallback((
    field: keyof GoalFormData,
    value: string | GoalStatus
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field as keyof ValidationErrors];
        return updated;
      });
    }
  }, [validationErrors]);

  /**
   * Handles form submission (add or edit)
   */
  const handleSubmit = useCallback(() => {
    // Validate form data
    const errors = validateFormData(formData);
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (isEditing && editingGoalId) {
      // Update existing goal
      const updatedGoals = goals.map(goal =>
        goal.id === editingGoalId
          ? {
              ...goal,
              title: formData.title.trim(),
              description: formData.description.trim(),
              targetDate: formData.targetDate,
              status: formData.status,
            }
          : goal
      );
      onChange(updatedGoals);

      console.log('[GoalManager] Goal updated', {
        goalId: editingGoalId,
        changes: formData,
      });
    } else {
      // Add new goal
      const newGoal: Goal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title.trim(),
        description: formData.description.trim(),
        targetDate: formData.targetDate,
        status: formData.status,
      };
      onChange([...goals, newGoal]);

      console.log('[GoalManager] Goal added', {
        goalId: newGoal.id,
        data: formData,
      });
    }

    handleDialogClose();
  }, [formData, validateFormData, isEditing, editingGoalId, goals, onChange, handleDialogClose]);

  // ============================================================
  // Render Helpers
  // ============================================================

  /**
   * Renders individual goal card
   */
  const renderGoalCard = useCallback((goal: Goal) => {
    const statusColor = getGoalStatusColor(goal.status);
    const statusLabel = getGoalStatusLabel(goal.status);
    const targetDate = new Date(goal.targetDate);
    const isOverdue = targetDate < new Date() && goal.status !== GoalStatus.ACHIEVED;

    return (
      <Card
        key={goal.id}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        role="article"
        aria-label={`Goal: ${goal.title}`}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" component="h3" sx={{ flexGrow: 1, pr: 1 }}>
              {goal.title}
            </Typography>
            <Chip
              label={statusLabel}
              color={statusColor}
              size="small"
              aria-label={`Status: ${statusLabel}`}
            />
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {goal.description}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Target Date:
            </Typography>
            <Typography
              variant="caption"
              color={isOverdue ? 'error.main' : 'text.primary'}
              fontWeight={isOverdue ? 'bold' : 'normal'}
            >
              {targetDate.toLocaleDateString()}
            </Typography>
            {isOverdue && (
              <Chip
                label="Overdue"
                color="error"
                size="small"
                sx={{ height: 20 }}
              />
            )}
          </Box>
        </CardContent>

        {!readOnly && (
          <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
            <Tooltip title="Edit goal">
              <IconButton
                size="small"
                onClick={() => handleEditClick(goal)}
                aria-label={`Edit ${goal.title}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete goal">
              <IconButton
                size="small"
                onClick={() => handleDeleteClick(goal.id)}
                color="error"
                aria-label={`Delete ${goal.title}`}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </CardActions>
        )}
      </Card>
    );
  }, [readOnly, handleEditClick, handleDeleteClick]);

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <Box role="region" aria-label="Goal Management">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Goals ({goals.length})
        </Typography>
        {!readOnly && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddClick}
            aria-label="Add new goal"
          >
            Add Goal
          </Button>
        )}
      </Box>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No goals have been set yet. {!readOnly && 'Click "Add Goal" to create your first goal.'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {goals.map(goal => (
            <Grid item xs={12} sm={6} md={4} key={goal.id}>
              {renderGoalCard(goal)}
            </Grid>
          ))}
        </Grid>
      )}

      {/* Goal Form Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="goal-dialog-title"
      >
        <DialogTitle id="goal-dialog-title">
          {dialogTitle}
          <IconButton
            aria-label="Close dialog"
            onClick={handleDialogClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Title Field */}
            <TextField
              label="Goal Title"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              error={!!validationErrors.title}
              helperText={
                validationErrors.title ||
                `${formData.title.length}/${APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH} characters`
              }
              required
              fullWidth
              autoFocus
              inputProps={{
                maxLength: APPRAISAL_VALIDATION.GOAL_TITLE_MAX_LENGTH,
                'aria-label': 'Goal title',
                'aria-required': 'true',
              }}
            />

            {/* Description Field */}
            <TextField
              label="Goal Description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              error={!!validationErrors.description}
              helperText={
                validationErrors.description ||
                `${formData.description.length}/${APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH} characters`
              }
              required
              fullWidth
              multiline
              rows={4}
              inputProps={{
                maxLength: APPRAISAL_VALIDATION.GOAL_DESCRIPTION_MAX_LENGTH,
                'aria-label': 'Goal description',
                'aria-required': 'true',
              }}
            />

            {/* Target Date Field */}
            <TextField
              label="Target Date"
              type="date"
              value={formData.targetDate}
              onChange={(e) => handleFieldChange('targetDate', e.target.value)}
              error={!!validationErrors.targetDate}
              helperText={validationErrors.targetDate}
              required
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                min: new Date().toISOString().split('T')[0],
                'aria-label': 'Target date',
                'aria-required': 'true',
              }}
            />

            {/* Status Field */}
            <FormControl fullWidth>
              <InputLabel id="goal-status-label">Status</InputLabel>
              <Select
                labelId="goal-status-label"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value as GoalStatus)}
                label="Status"
                inputProps={{
                  'aria-label': 'Goal status',
                }}
              >
                <MenuItem value={GoalStatus.NOT_STARTED}>
                  {getGoalStatusLabel(GoalStatus.NOT_STARTED)}
                </MenuItem>
                <MenuItem value={GoalStatus.IN_PROGRESS}>
                  {getGoalStatusLabel(GoalStatus.IN_PROGRESS)}
                </MenuItem>
                <MenuItem value={GoalStatus.ACHIEVED}>
                  {getGoalStatusLabel(GoalStatus.ACHIEVED)}
                </MenuItem>
                <MenuItem value={GoalStatus.NOT_ACHIEVED}>
                  {getGoalStatusLabel(GoalStatus.NOT_ACHIEVED)}
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleDialogClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={hasValidationErrors}
          >
            {isEditing ? 'Save Changes' : 'Add Goal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this goal? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoalManager;