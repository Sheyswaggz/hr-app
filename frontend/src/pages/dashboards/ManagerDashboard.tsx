/**
 * ManagerDashboard Component
 * 
 * Dashboard for managers to view team metrics, manage onboarding workflows,
 * and handle performance appraisals.
 * 
 * Features:
 * - Team progress overview
 * - Onboarding workflow management
 * - Performance appraisal management
 * - Pending reviews tracking
 * - Responsive layout
 * 
 * @module pages/dashboards/ManagerDashboard
 */

import React, { useState } from 'react';
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
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  RateReview as RateReviewIcon,
} from '@mui/icons-material';
import { TeamProgressDashboard } from '../../components/onboarding/TeamProgressDashboard';
import { WorkflowAssignment } from '../../components/onboarding/WorkflowAssignment';
import { AppraisalList } from '../../components/appraisal/AppraisalList';
import { AppraisalForm } from '../../components/appraisal/AppraisalForm';
import { useAppraisals } from '../../hooks/useAppraisals';

/**
 * Metric card component for displaying key statistics
 */
interface MetricCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly icon: React.ReactNode;
  readonly color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: `${color}.light`,
            color: `${color}.main`,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * ManagerDashboard Component
 * 
 * Main dashboard view for managers with team overview, onboarding management,
 * and performance appraisal features.
 * 
 * @returns Rendered ManagerDashboard component
 */
export const ManagerDashboard: React.FC = () => {
  const [showWorkflowAssignment, setShowWorkflowAssignment] = useState(false);
  const [showAppraisalForm, setShowAppraisalForm] = useState(false);

  // Fetch team appraisals for pending reviews count
  const { appraisals } = useAppraisals({
    view: 'team',
    fetchOnMount: true,
  });

  // Calculate pending reviews count (appraisals in submitted status awaiting manager review)
  const pendingReviewsCount = React.useMemo(() => {
    return appraisals.filter(appraisal => appraisal.status === 'submitted').length;
  }, [appraisals]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manager Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your team's onboarding and performance
        </Typography>
      </Box>

      {/* Metrics Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Team Members"
            value="12"
            icon={<PeopleIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Onboarding"
            value="3"
            icon={<AssignmentIcon />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Completed Tasks"
            value="45"
            icon={<CheckCircleIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Pending Reviews"
            value={pendingReviewsCount}
            icon={<RateReviewIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Team Progress Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="h2">
                Team Onboarding Progress
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowWorkflowAssignment(true)}
              >
                Assign Workflow
              </Button>
            </Box>
            <TeamProgressDashboard />
          </Paper>
        </Grid>
      </Grid>

      {/* Performance Appraisal Section */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="h2">
                Team Appraisals
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAppraisalForm(true)}
              >
                Initiate Appraisal
              </Button>
            </Box>
            <AppraisalList
              variant="team"
              enableFilters
              enableSorting
              enablePagination
              initialPageSize={10}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Workflow Assignment Dialog */}
      <WorkflowAssignment
        open={showWorkflowAssignment}
        onClose={() => setShowWorkflowAssignment(false)}
      />

      {/* Appraisal Form Dialog */}
      <AppraisalForm
        open={showAppraisalForm}
        onClose={() => setShowAppraisalForm(false)}
        onSuccess={(appraisalId) => {
          console.info('[ManagerDashboard] Appraisal created successfully', {
            appraisalId,
            timestamp: new Date().toISOString(),
          });
          setShowAppraisalForm(false);
        }}
      />
    </Container>
  );
};

export default ManagerDashboard;