/**
 * AppraisalDetail Component
 * 
 * Displays complete appraisal details in a modal dialog with role-based actions.
 * Shows employee information, review period, self-assessment, manager feedback,
 * rating, and goals with their statuses. Provides action buttons based on
 * appraisal status and user role.
 * 
 * Features:
 * - Full appraisal information display
 * - Self-assessment and manager feedback sections
 * - Star rating visualization
 * - Goals list with status indicators
 * - Role-based action buttons (submit self-assessment, submit review)
 * - Responsive modal layout
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Keyboard navigation support
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
  Rating,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack,
  Paper,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FeedbackIcon from '@mui/icons-material/Feedback';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';

import {
  Appraisal,
  AppraisalStatus,
  GoalStatus,
  getAppraisalStatusLabel,
  getAppraisalStatusColor,
  getGoalStatusLabel,
  getGoalStatusColor,
} from '../../types/appraisal';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

/**
 * Props for AppraisalDetail component
 */
export interface AppraisalDetailProps {
  /** The appraisal to display */
  readonly appraisal: Appraisal;
  
  /** Callback when dialog is closed */
  readonly onClose: () => void;
  
  /** Optional callback for action buttons (submit self-assessment, submit review) */
  readonly onAction?: (action: 'submit-self-assessment' | 'submit-review') => void;
  
  /** Whether the dialog is open */
  readonly open?: boolean;
}

/**
 * Formats ISO date string to readable format
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    console.error('[AppraisalDetail] Error formatting date:', error);
    return isoDate;
  }
}

/**
 * Determines if user can submit self-assessment
 */
function canSubmitSelfAssessment(
  appraisal: Appraisal,
  userId: string,
  userRole: UserRole
): boolean {
  return (
    appraisal.status === AppraisalStatus.DRAFT &&
    appraisal.employeeId === userId &&
    (userRole === UserRole.EMPLOYEE || userRole === UserRole.MANAGER)
  );
}

/**
 * Determines if user can submit manager review
 */
function canSubmitManagerReview(
  appraisal: Appraisal,
  userId: string,
  userRole: UserRole
): boolean {
  return (
    appraisal.status === AppraisalStatus.SUBMITTED &&
    appraisal.reviewerId === userId &&
    (userRole === UserRole.MANAGER || userRole === UserRole.HR_ADMIN)
  );
}

/**
 * AppraisalDetail Component
 * 
 * Displays complete appraisal information in a modal dialog with
 * role-based action buttons and comprehensive details.
 */
export const AppraisalDetail: React.FC<AppraisalDetailProps> = ({
  appraisal,
  onClose,
  onAction,
  open = true,
}) => {
  const { user } = useAuth();

  // Determine available actions based on user role and appraisal status
  const showSubmitSelfAssessment = user
    ? canSubmitSelfAssessment(appraisal, user.id, user.role)
    : false;

  const showSubmitReview = user
    ? canSubmitManagerReview(appraisal, user.id, user.role)
    : false;

  /**
   * Handles action button clicks
   */
  const handleAction = (action: 'submit-self-assessment' | 'submit-review') => {
    console.log('[AppraisalDetail] Action triggered:', {
      action,
      appraisalId: appraisal.id,
      userId: user?.id,
    });

    if (onAction) {
      onAction(action);
    }
  };

  /**
   * Handles dialog close
   */
  const handleClose = () => {
    console.log('[AppraisalDetail] Dialog closed:', {
      appraisalId: appraisal.id,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="appraisal-detail-title"
      aria-describedby="appraisal-detail-description"
      PaperProps={{
        sx: {
          maxHeight: '90vh',
        },
      }}
    >
      {/* Dialog Title with Close Button */}
      <DialogTitle
        id="appraisal-detail-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 2,
        }}
      >
        <Typography variant="h5" component="span">
          Performance Appraisal Details
        </Typography>
        <IconButton
          aria-label="close dialog"
          onClick={handleClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Dialog Content */}
      <DialogContent dividers id="appraisal-detail-description">
        <Stack spacing={3}>
          {/* Status Badge */}
          <Box>
            <Chip
              label={getAppraisalStatusLabel(appraisal.status)}
              color={getAppraisalStatusColor(appraisal.status)}
              size="medium"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>

          {/* Employee and Reviewer Information */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon color="primary" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Employee
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {appraisal.employeeName}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon color="secondary" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Reviewer
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {appraisal.reviewerName}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Review Period */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <CalendarTodayIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" color="text.secondary">
                Review Period
              </Typography>
            </Stack>
            <Typography variant="body1">
              {formatDate(appraisal.reviewPeriodStart)} -{' '}
              {formatDate(appraisal.reviewPeriodEnd)}
            </Typography>
          </Box>

          <Divider />

          {/* Self-Assessment Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <AssignmentIcon color="primary" />
              <Typography variant="h6">Self-Assessment</Typography>
            </Stack>
            {appraisal.selfAssessment ? (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {appraisal.selfAssessment}
                </Typography>
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                Self-assessment not yet submitted
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Manager Feedback Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <FeedbackIcon color="secondary" />
              <Typography variant="h6">Manager Feedback</Typography>
            </Stack>
            {appraisal.managerFeedback ? (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {appraisal.managerFeedback}
                </Typography>
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                Manager feedback not yet provided
              </Typography>
            )}
          </Box>

          {/* Rating Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <StarIcon color="warning" />
              <Typography variant="h6">Rating</Typography>
            </Stack>
            {appraisal.rating !== null ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <Rating
                  value={appraisal.rating}
                  readOnly
                  precision={1}
                  size="large"
                  aria-label={`Rating: ${appraisal.rating} out of 5 stars`}
                />
                <Typography variant="h6" color="text.secondary">
                  {appraisal.rating}/5
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                Rating not yet provided
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Goals Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <FlagIcon color="success" />
              <Typography variant="h6">Goals</Typography>
            </Stack>
            {appraisal.goals.length > 0 ? (
              <List sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                {appraisal.goals.map((goal, index) => (
                  <React.Fragment key={goal.id}>
                    <ListItem
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        py: 2,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        width="100%"
                        mb={1}
                      >
                        <Typography variant="subtitle1" fontWeight="medium" flex={1}>
                          {goal.title}
                        </Typography>
                        <Chip
                          label={getGoalStatusLabel(goal.status)}
                          color={getGoalStatusColor(goal.status)}
                          size="small"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {goal.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Target Date: {formatDate(goal.targetDate)}
                      </Typography>
                    </ListItem>
                    {index < appraisal.goals.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                No goals set for this appraisal
              </Typography>
            )}
          </Box>

          {/* Timestamps */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Created: {formatDate(appraisal.createdAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Last Updated: {formatDate(appraisal.updatedAt)}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Close
        </Button>
        {showSubmitSelfAssessment && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleAction('submit-self-assessment')}
            aria-label="Submit self-assessment"
          >
            Submit Self-Assessment
          </Button>
        )}
        {showSubmitReview && (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleAction('submit-review')}
            aria-label="Submit manager review"
          >
            Submit Review
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AppraisalDetail;