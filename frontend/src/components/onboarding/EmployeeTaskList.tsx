/**
 * EmployeeTaskList Component
 * 
 * Displays employee's assigned onboarding tasks with progress tracking,
 * task cards, and comprehensive state management.
 * 
 * Features:
 * - Task list with progress indicator
 * - Task cards with title, description, due date, status
 * - Click to view task detail
 * - Loading skeleton states
 * - Error display with retry
 * - Empty state message
 * - Responsive grid layout
 * - Accessibility compliant
 * 
 * @module components/onboarding/EmployeeTaskList
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Alert,
  Button,
  Skeleton,
  Stack,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useMyTasks } from '../../hooks/useMyTasks';
import {
  TaskStatus,
  getTaskStatusColor,
  getTaskStatusLabel,
  isTaskOverdue,
  calculateCompletionPercentage,
} from '../../types/onboarding';

/**
 * Component props interface
 */
interface EmployeeTaskListProps {
  /** Callback when task is clicked */
  readonly onTaskClick?: (taskId: string) => void;
  
  /** Optional filter by status */
  readonly filterStatus?: TaskStatus;
  
  /** Optional custom empty message */
  readonly emptyMessage?: string;
  
  /** Optional custom error message */
  readonly errorMessage?: string;
}

/**
 * Task status icon mapping
 */
const STATUS_ICONS: Record<TaskStatus, React.ReactElement> = {
  [TaskStatus.PENDING]: <ScheduleIcon />,
  [TaskStatus.IN_PROGRESS]: <PlayArrowIcon />,
  [TaskStatus.COMPLETED]: <CheckCircleIcon />,
};

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: Date | string): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Loading skeleton component
 */
const TaskCardSkeleton: React.FC = () => (
  <Card>
    <CardContent>
      <Stack spacing={2}>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Skeleton variant="rectangular" width={100} height={24} />
          <Skeleton variant="rectangular" width={80} height={24} />
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

/**
 * Empty state component
 */
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Paper
    elevation={0}
    sx={{
      p: 6,
      textAlign: 'center',
      backgroundColor: 'background.default',
      border: '1px dashed',
      borderColor: 'divider',
    }}
  >
    <AssignmentIcon
      sx={{
        fontSize: 64,
        color: 'text.secondary',
        mb: 2,
      }}
    />
    <Typography variant="h6" color="text.secondary" gutterBottom>
      {message}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      You don't have any onboarding tasks assigned yet.
    </Typography>
  </Paper>
);

/**
 * Error state component
 */
const ErrorState: React.FC<{
  message: string;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <Alert
    severity="error"
    action={
      <Button
        color="inherit"
        size="small"
        startIcon={<RefreshIcon />}
        onClick={onRetry}
      >
        Retry
      </Button>
    }
  >
    <Typography variant="body2">{message}</Typography>
  </Alert>
);

/**
 * Progress indicator component
 */
const ProgressIndicator: React.FC<{
  completed: number;
  total: number;
}> = ({ completed, total }) => {
  const percentage = calculateCompletionPercentage(completed, total);

  return (
    <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" component="h2">
          Onboarding Progress
        </Typography>
        <Typography variant="h6" color="primary" fontWeight="bold">
          {percentage}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 10,
          borderRadius: 5,
          mb: 1,
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {completed} of {total} tasks completed
      </Typography>
    </Paper>
  );
};

/**
 * Task card component
 */
const TaskCard: React.FC<{
  task: {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly dueDate: Date | string;
    readonly status: TaskStatus;
  };
  onClick: (taskId: string) => void;
}> = ({ task, onClick }) => {
  const isOverdue = useMemo(() => {
    return task.status !== TaskStatus.COMPLETED && isTaskOverdue({
      ...task,
      dueDate: typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate,
      documentUrl: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, [task]);

  const daysUntilDue = useMemo(() => getDaysUntilDue(task.dueDate), [task.dueDate]);

  const statusColor = getTaskStatusColor(task.status);
  const statusLabel = getTaskStatusLabel(task.status);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardActionArea
        onClick={() => onClick(task.id)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <CardContent sx={{ flexGrow: 1, width: '100%' }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontWeight: 600,
                flexGrow: 1,
                pr: 2,
              }}
            >
              {task.title}
            </Typography>
            <Chip
              icon={STATUS_ICONS[task.status]}
              label={statusLabel}
              color={statusColor as any}
              size="small"
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
              textOverflow: 'ellipsis',
            }}
          >
            {task.description}
          </Typography>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={0.5}>
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Due: {formatDate(task.dueDate)}
              </Typography>
            </Box>

            {isOverdue && (
              <Chip
                icon={<WarningIcon />}
                label="Overdue"
                color="error"
                size="small"
                variant="outlined"
              />
            )}

            {!isOverdue && task.status !== TaskStatus.COMPLETED && daysUntilDue <= 3 && (
              <Chip
                icon={<WarningIcon />}
                label={`${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} left`}
                color="warning"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

/**
 * EmployeeTaskList Component
 * 
 * Main component for displaying employee onboarding tasks
 */
export const EmployeeTaskList: React.FC<EmployeeTaskListProps> = ({
  onTaskClick,
  filterStatus,
  emptyMessage = 'No tasks assigned',
  errorMessage = 'Failed to load tasks. Please try again.',
}) => {
  const {
    tasks,
    loading,
    error,
    initialized,
    refetch,
    getTasksByStatus,
  } = useMyTasks();

  // Filter tasks by status if specified
  const filteredTasks = useMemo(() => {
    if (filterStatus) {
      return getTasksByStatus(filterStatus);
    }
    return tasks;
  }, [tasks, filterStatus, getTasksByStatus]);

  // Calculate completion statistics
  const completionStats = useMemo(() => {
    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const total = tasks.length;
    return { completed, total };
  }, [tasks]);

  // Handle task click
  const handleTaskClick = (taskId: string): void => {
    if (onTaskClick) {
      onTaskClick(taskId);
    }

    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[EmployeeTaskList] Task clicked:', taskId);
    }
  };

  // Handle retry
  const handleRetry = (): void => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[EmployeeTaskList] Retrying task fetch');
    }
    refetch();
  };

  // Loading state
  if (loading && !initialized) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={120} sx={{ mb: 3, borderRadius: 1 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <TaskCardSkeleton />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Error state
  if (error && initialized) {
    return (
      <ErrorState
        message={error.message || errorMessage}
        onRetry={handleRetry}
      />
    );
  }

  // Empty state
  if (filteredTasks.length === 0 && initialized) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <Box>
      {/* Progress Indicator */}
      {!filterStatus && (
        <ProgressIndicator
          completed={completionStats.completed}
          total={completionStats.total}
        />
      )}

      {/* Task Grid */}
      <Grid container spacing={3}>
        {filteredTasks.map(task => (
          <Grid item xs={12} sm={6} md={4} key={task.id}>
            <TaskCard task={task} onClick={handleTaskClick} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default EmployeeTaskList;