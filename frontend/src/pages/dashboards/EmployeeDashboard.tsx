import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  EventNote as EventNoteIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Metric card data structure
 */
interface MetricCardData {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactElement;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  progress?: number;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

/**
 * Quick action button configuration
 */
interface QuickAction {
  label: string;
  icon: React.ReactElement;
  path: string;
  variant: 'contained' | 'outlined';
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * Onboarding task summary
 */
interface OnboardingTaskSummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

/**
 * Appraisal summary
 */
interface AppraisalSummary {
  status: 'not_started' | 'in_progress' | 'completed';
  dueDate?: Date;
  lastRating?: number;
}

/**
 * Leave balance summary
 */
interface LeaveBalanceSummary {
  annual: number;
  sick: number;
  personal: number;
  total: number;
}

/**
 * Employee Dashboard Component
 * 
 * Displays employee-specific dashboard with:
 * - Onboarding tasks progress
 * - Appraisal status
 * - Leave balance summary
 * - Quick action buttons for common tasks
 * 
 * Features:
 * - Responsive grid layout (desktop, tablet, mobile)
 * - Material-UI components with custom theme
 * - TypeScript type safety
 * - Structured logging for user interactions
 * - Accessible keyboard navigation and ARIA labels
 * 
 * @component
 * @example
 * ```tsx
 * <Route path="/dashboard" element={<EmployeeDashboard />} />
 * ```
 */
export const EmployeeDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Mock data - In production, this would come from API calls
  const onboardingTasks: OnboardingTaskSummary = {
    total: 12,
    completed: 8,
    pending: 3,
    overdue: 1,
  };

  const appraisalStatus: AppraisalSummary = {
    status: 'in_progress',
    dueDate: new Date('2025-02-15'),
    lastRating: 4.2,
  };

  const leaveBalance: LeaveBalanceSummary = {
    annual: 15,
    sick: 10,
    personal: 5,
    total: 30,
  };

  /**
   * Calculate onboarding progress percentage
   */
  const onboardingProgress = onboardingTasks.total > 0
    ? Math.round((onboardingTasks.completed / onboardingTasks.total) * 100)
    : 0;

  /**
   * Format appraisal status for display
   */
  const getAppraisalStatusLabel = (): string => {
    switch (appraisalStatus.status) {
      case 'not_started':
        return 'Not Started';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  /**
   * Get appraisal status color
   */
  const getAppraisalStatusColor = (): 'warning' | 'info' | 'success' => {
    switch (appraisalStatus.status) {
      case 'not_started':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      default:
        return 'info';
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  /**
   * Metric cards configuration
   */
  const metricCards: MetricCardData[] = [
    {
      title: 'My Onboarding Tasks',
      value: `${onboardingTasks.completed}/${onboardingTasks.total}`,
      subtitle: `${onboardingTasks.pending} pending, ${onboardingTasks.overdue} overdue`,
      icon: <AssignmentIcon />,
      color: 'primary',
      progress: onboardingProgress,
    },
    {
      title: 'My Appraisals',
      value: getAppraisalStatusLabel(),
      subtitle: appraisalStatus.dueDate
        ? `Due: ${formatDate(appraisalStatus.dueDate)}`
        : undefined,
      icon: <AssessmentIcon />,
      color: getAppraisalStatusColor(),
    },
    {
      title: 'Leave Balance',
      value: leaveBalance.total,
      subtitle: `Annual: ${leaveBalance.annual} | Sick: ${leaveBalance.sick} | Personal: ${leaveBalance.personal}`,
      icon: <EventNoteIcon />,
      color: 'success',
    },
  ];

  /**
   * Quick action buttons configuration
   */
  const quickActions: QuickAction[] = [
    {
      label: 'View Tasks',
      icon: <AssignmentIcon />,
      path: '/onboarding',
      variant: 'contained',
      color: 'primary',
    },
    {
      label: 'Request Leave',
      icon: <EventNoteIcon />,
      path: '/leave/request',
      variant: 'outlined',
      color: 'primary',
    },
    {
      label: 'View Appraisals',
      icon: <AssessmentIcon />,
      path: '/appraisals',
      variant: 'outlined',
      color: 'secondary',
    },
  ];

  /**
   * Handle navigation to specific route
   */
  const handleNavigate = (path: string, actionLabel: string): void => {
    console.log('[EmployeeDashboard] Quick action clicked:', {
      action: actionLabel,
      path,
      timestamp: new Date().toISOString(),
    });
    navigate(path);
  };

  /**
   * Handle metric card click
   */
  const handleMetricClick = (title: string): void => {
    console.log('[EmployeeDashboard] Metric card clicked:', {
      metric: title,
      timestamp: new Date().toISOString(),
    });

    // Navigate based on metric type
    if (title.includes('Onboarding')) {
      navigate('/onboarding');
    } else if (title.includes('Appraisals')) {
      navigate('/appraisals');
    } else if (title.includes('Leave')) {
      navigate('/leave');
    }
  };

  console.log('[EmployeeDashboard] Rendering dashboard:', {
    onboardingProgress,
    appraisalStatus: appraisalStatus.status,
    leaveBalance: leaveBalance.total,
    isMobile,
    isTablet,
  });

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100%',
      }}
    >
      {/* Dashboard Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          Employee Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back! Here's an overview of your tasks and information.
        </Typography>
      </Box>

      {/* Metric Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metricCards.map((metric, index) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            key={index}
          >
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
              onClick={() => handleMetricClick(metric.title)}
              role="button"
              tabIndex={0}
              aria-label={`${metric.title}: ${metric.value}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMetricClick(metric.title);
                }
              }}
            >
              <CardContent>
                <Stack spacing={2}>
                  {/* Card Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ fontWeight: 500 }}
                    >
                      {metric.title}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: `${metric.color}.light`,
                        color: `${metric.color}.main`,
                      }}
                    >
                      {metric.icon}
                    </Box>
                  </Box>

                  {/* Card Value */}
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{ fontWeight: 700 }}
                  >
                    {metric.value}
                  </Typography>

                  {/* Progress Bar (if applicable) */}
                  {metric.progress !== undefined && (
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={metric.progress}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: `${metric.color}.light`,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: `${metric.color}.main`,
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: 'block' }}
                      >
                        {metric.progress}% Complete
                      </Typography>
                    </Box>
                  )}

                  {/* Card Subtitle */}
                  {metric.subtitle && (
                    <Typography variant="body2" color="text.secondary">
                      {metric.subtitle}
                    </Typography>
                  )}

                  {/* Trend Indicator (if applicable) */}
                  {metric.trend && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUpIcon
                        fontSize="small"
                        sx={{
                          color: metric.trend.direction === 'up' ? 'success.main' : 'error.main',
                          transform: metric.trend.direction === 'down' ? 'rotate(180deg)' : 'none',
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: metric.trend.direction === 'up' ? 'success.main' : 'error.main',
                          fontWeight: 600,
                        }}
                      >
                        {metric.trend.value}%
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{ fontWeight: 600, mb: 2 }}
        >
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={index}
            >
              <Button
                variant={action.variant}
                color={action.color}
                fullWidth
                size="large"
                startIcon={action.icon}
                onClick={() => handleNavigate(action.path, action.label)}
                sx={{
                  py: 1.5,
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
                aria-label={action.label}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Status Indicators Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ fontWeight: 600, mb: 2 }}
          >
            Current Status
          </Typography>
          <Stack spacing={2}>
            {/* Onboarding Status */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon color="primary" />
                <Typography variant="body1">Onboarding Progress</Typography>
              </Box>
              <Chip
                label={`${onboardingProgress}% Complete`}
                color={onboardingProgress === 100 ? 'success' : 'primary'}
                icon={onboardingProgress === 100 ? <CheckCircleIcon /> : <PendingIcon />}
              />
            </Box>

            {/* Appraisal Status */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="secondary" />
                <Typography variant="body1">Appraisal Status</Typography>
              </Box>
              <Chip
                label={getAppraisalStatusLabel()}
                color={getAppraisalStatusColor()}
              />
            </Box>

            {/* Leave Balance Status */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventNoteIcon color="success" />
                <Typography variant="body1">Available Leave Days</Typography>
              </Box>
              <Chip
                label={`${leaveBalance.total} days`}
                color="success"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{ fontWeight: 600, mb: 2 }}
          >
            Need Help?
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            If you have any questions or need assistance, please contact your manager or HR department.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              console.log('[EmployeeDashboard] Help button clicked');
              navigate('/help');
            }}
          >
            View Help Center
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EmployeeDashboard;