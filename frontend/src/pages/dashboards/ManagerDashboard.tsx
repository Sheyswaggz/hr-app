/**
 * Manager Dashboard Component
 * 
 * Main dashboard for managers to view team metrics, leave requests, and onboarding progress.
 * Provides overview of team performance, pending approvals, and onboarding status.
 * 
 * Features:
 * - Team metrics overview
 * - Pending leave requests
 * - Team onboarding progress tracking
 * - Quick action buttons
 * - Responsive layout
 * 
 * @module pages/dashboards/ManagerDashboard
 */

import React from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  EventAvailable as EventAvailableIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { TeamProgressDashboard } from '../../components/onboarding/TeamProgressDashboard';

/**
 * Metric card component for displaying key statistics
 */
interface MetricCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly icon: React.ReactElement;
  readonly color: string;
  readonly subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
}) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            backgroundColor: `${color}15`,
            borderRadius: 2,
            p: 1,
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 32 } })}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * Manager Dashboard Component
 * 
 * Main dashboard view for managers with team metrics and onboarding progress.
 * Displays key performance indicators and team onboarding status.
 * 
 * @example
 * ```tsx
 * <ManagerDashboard />
 * ```
 */
export const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          Manager Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your team's performance and onboarding progress
        </Typography>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Team Members"
            value={12}
            icon={<PeopleIcon />}
            color="#1976d2"
            subtitle="Active employees"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Pending Approvals"
            value={5}
            icon={<EventAvailableIcon />}
            color="#ed6c02"
            subtitle="Leave requests"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Onboarding"
            value={3}
            icon={<AssignmentIcon />}
            color="#9c27b0"
            subtitle="In progress"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Team Performance"
            value="92%"
            icon={<TrendingUpIcon />}
            color="#2e7d32"
            subtitle="Average completion"
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" fontWeight="medium" gutterBottom>
          Quick Actions
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<EventAvailableIcon />}
            onClick={() => navigate('/leave/approvals')}
          >
            Review Leave Requests
          </Button>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => navigate('/onboarding/team')}
          >
            View Team Onboarding
          </Button>
          <Button
            variant="outlined"
            startIcon={<PeopleIcon />}
            onClick={() => navigate('/team')}
          >
            Manage Team
          </Button>
        </Box>
      </Paper>

      {/* Team Onboarding Progress Section */}
      <Box sx={{ mb: 4 }}>
        <TeamProgressDashboard
          title="Team Onboarding Progress"
          height={600}
          onRowClick={(employeeId) => {
            if (import.meta.env.VITE_API_DEBUG === 'true') {
              console.debug('[ManagerDashboard] Employee row clicked', {
                employeeId,
                timestamp: new Date().toISOString(),
              });
            }
            navigate(`/employee/${employeeId}/onboarding`);
          }}
        />
      </Box>

      {/* Additional Sections Placeholder */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, minHeight: 300 }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Recent Activity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Team activity feed will be displayed here
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, minHeight: 300 }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Upcoming Events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Team calendar and events will be displayed here
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

/**
 * Export component as default
 */
export default ManagerDashboard;