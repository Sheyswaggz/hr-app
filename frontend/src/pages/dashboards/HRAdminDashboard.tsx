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
  Divider,
  alpha,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  EventNote as EventNoteIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

/**
 * Metric card data structure
 */
interface MetricCardData {
  title: string;
  value: number;
  icon: React.ReactElement;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

/**
 * Quick action button configuration
 */
interface QuickAction {
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}

/**
 * HR Admin Dashboard Component
 * 
 * Provides comprehensive overview for HR administrators with:
 * - Key metrics cards (total employees, pending onboarding, pending appraisals, pending leave requests)
 * - Quick action buttons for common HR tasks
 * - Responsive grid layout (12 columns desktop, 6 tablet, 12 mobile)
 * - Material-UI themed components
 * 
 * @component
 * @example
 * ```tsx
 * <Route path="/dashboard" element={<HRAdminDashboard />} />
 * ```
 */
export const HRAdminDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  /**
   * Handles navigation to create onboarding workflow
   */
  const handleCreateOnboarding = (): void => {
    console.log('[HRAdminDashboard] Create onboarding action triggered');
    // TODO: Navigate to onboarding creation page
    // navigate('/onboarding/create');
  };

  /**
   * Handles navigation to create appraisal
   */
  const handleCreateAppraisal = (): void => {
    console.log('[HRAdminDashboard] Create appraisal action triggered');
    // TODO: Navigate to appraisal creation page
    // navigate('/appraisals/create');
  };

  /**
   * Handles navigation to employees list
   */
  const handleViewEmployees = (): void => {
    console.log('[HRAdminDashboard] View employees action triggered');
    // TODO: Navigate to employees page
    // navigate('/employees');
  };

  /**
   * Handles navigation to pending leave requests
   */
  const handleViewLeaveRequests = (): void => {
    console.log('[HRAdminDashboard] View leave requests action triggered');
    // TODO: Navigate to leave requests page
    // navigate('/leave');
  };

  /**
   * Metric cards configuration
   * In production, these values would come from API calls
   */
  const metrics: MetricCardData[] = [
    {
      title: 'Total Employees',
      value: 247,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.primary.main,
      trend: {
        value: 12,
        isPositive: true,
      },
    },
    {
      title: 'Pending Onboarding',
      value: 8,
      icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.warning.main,
      trend: {
        value: 3,
        isPositive: false,
      },
    },
    {
      title: 'Pending Appraisals',
      value: 15,
      icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.info.main,
      trend: {
        value: 5,
        isPositive: true,
      },
    },
    {
      title: 'Pending Leave Requests',
      value: 12,
      icon: <EventNoteIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.error.main,
      trend: {
        value: 2,
        isPositive: false,
      },
    },
  ];

  /**
   * Quick actions configuration
   */
  const quickActions: QuickAction[] = [
    {
      label: 'Create Onboarding',
      icon: <AddIcon />,
      onClick: handleCreateOnboarding,
      color: 'primary',
    },
    {
      label: 'Create Appraisal',
      icon: <AddIcon />,
      onClick: handleCreateAppraisal,
      color: 'secondary',
    },
    {
      label: 'View Employees',
      icon: <PeopleIcon />,
      onClick: handleViewEmployees,
      color: 'info',
    },
    {
      label: 'Review Leave Requests',
      icon: <EventNoteIcon />,
      onClick: handleViewLeaveRequests,
      color: 'warning',
    },
  ];

  /**
   * Renders a metric card with icon, value, and optional trend
   */
  const renderMetricCard = (metric: MetricCardData): React.ReactElement => (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Box
              sx={{
                backgroundColor: alpha(metric.color, 0.1),
                borderRadius: 2,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.cloneElement(metric.icon, {
                sx: { ...metric.icon.props.sx, color: metric.color },
              })}
            </Box>
            {metric.trend && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: metric.trend.isPositive
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                }}
              >
                <TrendingUpIcon
                  sx={{
                    fontSize: 20,
                    transform: metric.trend.isPositive ? 'none' : 'rotate(180deg)',
                  }}
                />
                <Typography variant="body2" fontWeight={600}>
                  {metric.trend.value}
                </Typography>
              </Box>
            )}
          </Box>
          <Box>
            <Typography
              variant="h3"
              component="div"
              fontWeight={700}
              color="text.primary"
              sx={{ mb: 0.5 }}
            >
              {metric.value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {metric.title}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  /**
   * Renders a quick action button
   */
  const renderQuickAction = (action: QuickAction): React.ReactElement => (
    <Button
      variant="contained"
      color={action.color}
      startIcon={action.icon}
      onClick={action.onClick}
      fullWidth
      size={isMobile ? 'medium' : 'large'}
      sx={{
        py: isMobile ? 1.5 : 2,
        textTransform: 'none',
        fontWeight: 600,
        boxShadow: theme.shadows[2],
        '&:hover': {
          boxShadow: theme.shadows[6],
        },
      }}
    >
      {action.label}
    </Button>
  );

  console.log('[HRAdminDashboard] Rendering dashboard', {
    isMobile,
    isTablet,
    metricsCount: metrics.length,
    actionsCount: quickActions.length,
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant={isMobile ? 'h4' : 'h3'}
          component="h1"
          fontWeight={700}
          color="text.primary"
          gutterBottom
        >
          HR Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of key HR metrics and quick actions
        </Typography>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metrics.map((metric, index) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={3}
            key={`metric-${index}`}
          >
            {renderMetricCard(metric)}
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Quick Actions Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h2"
          fontWeight={600}
          color="text.primary"
          gutterBottom
          sx={{ mb: 3 }}
        >
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={6}
              lg={3}
              key={`action-${index}`}
            >
              {renderQuickAction(action)}
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Recent Activity Section - Placeholder */}
      <Box sx={{ mt: 4 }}>
        <Card elevation={2}>
          <CardContent>
            <Typography
              variant="h6"
              component="h3"
              fontWeight={600}
              color="text.primary"
              gutterBottom
            >
              Recent Activity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Recent activity feed will be displayed here
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default HRAdminDashboard;