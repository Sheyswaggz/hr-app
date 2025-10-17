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
  Paper,
  Stack,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Metric card data structure
 */
interface MetricCardData {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  subtitle?: string;
}

/**
 * Quick action button configuration
 */
interface QuickAction {
  label: string;
  icon: React.ReactElement;
  path: string;
  color: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';
}

/**
 * Manager Dashboard Component
 * 
 * Displays manager-specific dashboard with:
 * - Team metrics (team size, pending approvals, onboarding progress)
 * - Quick action buttons for common manager tasks
 * - Responsive grid layout across all breakpoints
 * - Material-UI themed components
 * 
 * @component
 * @example
 * ```tsx
 * <Route path="/dashboard" element={<ManagerDashboard />} />
 * ```
 */
export const ManagerDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  console.log('[ManagerDashboard] Rendering dashboard', {
    isMobile,
    isTablet,
    timestamp: new Date().toISOString(),
  });

  /**
   * Handles navigation to specified route
   */
  const handleNavigate = (path: string): void => {
    console.log('[ManagerDashboard] Navigating to:', { path });
    navigate(path);
  };

  /**
   * Metric cards configuration
   * TODO: Replace with actual data from API
   */
  const metricCards: MetricCardData[] = [
    {
      title: 'Team Size',
      value: 12,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.primary.main,
      subtitle: 'Active team members',
    },
    {
      title: 'Pending Approvals',
      value: 5,
      icon: <PendingIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.warning.main,
      subtitle: 'Require your attention',
    },
    {
      title: 'Team Onboarding',
      value: '75%',
      icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.success.main,
      subtitle: 'Average completion rate',
    },
    {
      title: 'Leave Requests',
      value: 3,
      icon: <EventNoteIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.info.main,
      subtitle: 'Pending review',
    },
  ];

  /**
   * Quick action buttons configuration
   */
  const quickActions: QuickAction[] = [
    {
      label: 'View Team',
      icon: <PeopleIcon />,
      path: '/employees',
      color: 'primary',
    },
    {
      label: 'Approve Requests',
      icon: <CheckCircleIcon />,
      path: '/leave',
      color: 'success',
    },
    {
      label: 'Onboarding Tasks',
      icon: <AssignmentIcon />,
      path: '/onboarding',
      color: 'info',
    },
    {
      label: 'Team Appraisals',
      icon: <TrendingUpIcon />,
      path: '/appraisals',
      color: 'secondary',
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Dashboard Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          Manager Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back! Here's an overview of your team's status.
        </Typography>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metricCards.map((metric, index) => (
          <Grid item xs={12} sm={6} md={6} lg={3} key={index}>
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
                        color: metric.color,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {metric.icon}
                    </Box>
                  </Box>
                  <Typography
                    variant={isMobile ? 'h4' : 'h3'}
                    component="div"
                    sx={{ fontWeight: 700, color: metric.color }}
                  >
                    {metric.value}
                  </Typography>
                  {metric.subtitle && (
                    <Typography variant="caption" color="text.secondary">
                      {metric.subtitle}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{ fontWeight: 600, mb: 3 }}
        >
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Button
                variant="contained"
                color={action.color}
                fullWidth
                size="large"
                startIcon={action.icon}
                onClick={() => handleNavigate(action.path)}
                sx={{
                  py: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500,
                  boxShadow: theme.shadows[2],
                  '&:hover': {
                    boxShadow: theme.shadows[6],
                  },
                }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Recent Activity Section - Placeholder */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{ fontWeight: 600, mb: 3 }}
        >
          Recent Team Activity
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            backgroundColor: theme.palette.grey[50],
            borderRadius: 1,
            border: `1px dashed ${theme.palette.grey[300]}`,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <AssignmentIcon
              sx={{ fontSize: 48, color: theme.palette.grey[400] }}
            />
            <Typography variant="body1" color="text.secondary">
              Recent activity will appear here
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Team member actions, approvals, and updates
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default ManagerDashboard;