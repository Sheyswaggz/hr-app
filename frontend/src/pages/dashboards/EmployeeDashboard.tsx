/**
 * Employee Dashboard Page
 * 
 * Main dashboard view for employees showing their personal information,
 * onboarding tasks, leave requests, and performance appraisals.
 * 
 * Features:
 * - Personal information summary
 * - Pending onboarding tasks
 * - Leave balance and requests
 * - Performance appraisals (self-assessments)
 * - Quick action buttons
 * 
 * @module pages/dashboards/EmployeeDashboard
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Chip,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  BeachAccess as LeaveIcon,
  Assessment as AppraisalIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { EmployeeTaskList } from '../../components/onboarding/EmployeeTaskList';
import { AppraisalList } from '../../components/appraisal/AppraisalList';
import { SelfAssessmentForm } from '../../components/appraisal/SelfAssessmentForm';
import { useAppraisals } from '../../hooks/useAppraisals';
import { Appraisal, AppraisalStatus } from '../../types/appraisal';

/**
 * Metric card component for displaying dashboard statistics
 */
interface MetricCardProps {
  readonly title: string;
  readonly value: number;
  readonly icon: React.ReactNode;
  readonly color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="text.secondary" variant="body2" gutterBottom>
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
 * Employee Dashboard Component
 * 
 * Main dashboard view for employees with overview of tasks, leave, and appraisals.
 * 
 * @returns Employee dashboard page
 */
export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { appraisals } = useAppraisals({ view: 'my', fetchOnMount: true });

  // State for self-assessment form
  const [selectedAppraisal, setSelectedAppraisal] = useState<Appraisal | null>(null);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);

  /**
   * Calculate pending self-assessments count
   */
  const pendingSelfAssessments = appraisals.filter(
    (appraisal) => appraisal.status === AppraisalStatus.DRAFT && !appraisal.selfAssessment
  ).length;

  /**
   * Handle opening self-assessment form
   */
  const handleOpenAssessment = useCallback((appraisal: Appraisal) => {
    console.info('[EmployeeDashboard] Opening self-assessment form', {
      appraisalId: appraisal.id,
      timestamp: new Date().toISOString(),
    });

    setSelectedAppraisal(appraisal);
    setAssessmentFormOpen(true);
  }, []);

  /**
   * Handle closing self-assessment form
   */
  const handleCloseAssessment = useCallback(() => {
    console.debug('[EmployeeDashboard] Closing self-assessment form', {
      timestamp: new Date().toISOString(),
    });

    setAssessmentFormOpen(false);
    setSelectedAppraisal(null);
  }, []);

  /**
   * Handle successful self-assessment submission
   */
  const handleAssessmentSuccess = useCallback((updatedAppraisal: Appraisal) => {
    console.info('[EmployeeDashboard] Self-assessment submitted successfully', {
      appraisalId: updatedAppraisal.id,
      status: updatedAppraisal.status,
      timestamp: new Date().toISOString(),
    });

    // Form will close automatically after success
  }, []);

  /**
   * Handle appraisal click from list
   */
  const handleAppraisalClick = useCallback((appraisalId: string) => {
    const appraisal = appraisals.find((a) => a.id === appraisalId);
    
    if (appraisal && appraisal.status === AppraisalStatus.DRAFT && !appraisal.selfAssessment) {
      handleOpenAssessment(appraisal);
    }
  }, [appraisals, handleOpenAssessment]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name || 'Employee'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's an overview of your tasks, leave, and performance appraisals.
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Pending Tasks"
            value={0}
            icon={<AssignmentIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Leave Balance"
            value={0}
            icon={<LeaveIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            title="Pending Self-Assessments"
            value={pendingSelfAssessments}
            icon={<AppraisalIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Pending Self-Assessments Alert */}
      {pendingSelfAssessments > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have {pendingSelfAssessments} pending self-assessment{pendingSelfAssessments > 1 ? 's' : ''} to complete.
          Click on an appraisal below to submit your self-assessment.
        </Alert>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Onboarding Tasks Section */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" component="h2">
                My Onboarding Tasks
              </Typography>
              <Chip label="Active" color="primary" size="small" />
            </Box>
            <EmployeeTaskList />
          </Paper>
        </Grid>

        {/* Leave Requests Section */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" component="h2">
                My Leave Requests
              </Typography>
              <Button variant="outlined" size="small">
                Request Leave
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              No leave requests yet. Click "Request Leave" to submit a new request.
            </Typography>
          </Paper>
        </Grid>

        {/* Performance Appraisals Section */}
        <Grid item xs={12}>
          <AppraisalList
            variant="my"
            onAppraisalClick={handleAppraisalClick}
            enableFilters={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={10}
            emptyStateMessage="No appraisals found. Your manager will initiate appraisals when it's time for your performance review."
          />
        </Grid>
      </Grid>

      {/* Self-Assessment Form Dialog */}
      {selectedAppraisal && (
        <SelfAssessmentForm
          appraisal={selectedAppraisal}
          open={assessmentFormOpen}
          onClose={handleCloseAssessment}
          onSuccess={handleAssessmentSuccess}
        />
      )}
    </Container>
  );
};

export default EmployeeDashboard;