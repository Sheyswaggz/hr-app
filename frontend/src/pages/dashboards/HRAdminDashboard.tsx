/**
 * HR Admin Dashboard Component
 * 
 * Comprehensive dashboard for HR administrators with overview of all HR operations
 * including onboarding, appraisals, leave management, and employee statistics.
 * 
 * Features:
 * - Onboarding workflow management
 * - Appraisal cycle overview with status metrics
 * - Leave request approvals
 * - Employee statistics and metrics
 * - Quick action buttons for common tasks
 * 
 * @module pages/dashboards/HRAdminDashboard
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import TemplateList from '../../components/onboarding/TemplateList';
import TeamProgressDashboard from '../../components/onboarding/TeamProgressDashboard';
import AppraisalList from '../../components/appraisal/AppraisalList';
import { useAppraisals } from '../../hooks/useAppraisals';
import { AppraisalStatus } from '../../types/appraisal';

/**
 * HR Admin Dashboard Component
 * 
 * Main dashboard for HR administrators providing comprehensive overview
 * of all HR operations and quick access to management functions.
 * 
 * @example
 * ```tsx
 * <HRAdminDashboard />
 * ```
 */
const HRAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'onboarding' | 'appraisals'>('onboarding');

  // Fetch all appraisals for metrics
  const { appraisals } = useAppraisals({
    view: 'all',
    fetchOnMount: true,
  });

  // Calculate appraisal metrics
  const appraisalMetrics = React.useMemo(() => {
    const pending = appraisals.filter(a => a.status === AppraisalStatus.DRAFT).length;
    const submitted = appraisals.filter(a => a.status === AppraisalStatus.SUBMITTED).length;
    const completed = appraisals.filter(a => a.status === AppraisalStatus.COMPLETED).length;
    const total = appraisals.length;

    return { pending, submitted, completed, total };
  }, [appraisals]);

  /**
   * Handle navigation to create new template
   */
  const handleCreateTemplate = () => {
    console.info('[HRAdminDashboard] Navigating to create template', {
      timestamp: new Date().toISOString(),
    });
    navigate('/onboarding/templates/new');
  };

  /**
   * Handle navigation to create new appraisal
   */
  const handleCreateAppraisal = () => {
    console.info('[HRAdminDashboard] Navigating to create appraisal', {
      timestamp: new Date().toISOString(),
    });
    navigate('/appraisals/new');
  };

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            HR Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage onboarding workflows, performance appraisals, and employee operations
          </Typography>
        </Box>

        {/* Quick Actions */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="h6" align="center">
                    Onboarding
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateTemplate}
                    fullWidth
                  >
                    New Template
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="h6" align="center">
                    Appraisals
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateAppraisal}
                    fullWidth
                  >
                    New Appraisal
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <EventNoteIcon color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="h6" align="center">
                    Leave Requests
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/leave/requests')}
                    fullWidth
                  >
                    View Requests
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={2} alignItems="center">
                  <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
                  <Typography variant="h6" align="center">
                    Reports
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/reports')}
                    fullWidth
                  >
                    View Reports
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tab Navigation */}
        <Paper sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ p: 2 }}>
            <Button
              variant={activeTab === 'onboarding' ? 'contained' : 'outlined'}
              onClick={() => setActiveTab('onboarding')}
            >
              Onboarding Management
            </Button>
            <Button
              variant={activeTab === 'appraisals' ? 'contained' : 'outlined'}
              onClick={() => setActiveTab('appraisals')}
            >
              Appraisal Management
            </Button>
          </Stack>
        </Paper>

        {/* Onboarding Section */}
        {activeTab === 'onboarding' && (
          <Grid container spacing={3}>
            {/* Onboarding Templates */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" component="h2">
                    Onboarding Templates
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateTemplate}
                    size="small"
                  >
                    Create Template
                  </Button>
                </Box>
                <TemplateList />
              </Paper>
            </Grid>

            {/* Team Progress */}
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  Team Onboarding Progress
                </Typography>
                <TeamProgressDashboard />
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Appraisal Section */}
        {activeTab === 'appraisals' && (
          <Grid container spacing={3}>
            {/* Appraisal Metrics */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  Appraisal Cycle Overview
                </Typography>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Total Appraisals
                        </Typography>
                        <Typography variant="h4" component="div">
                          {appraisalMetrics.total}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Pending
                        </Typography>
                        <Typography variant="h4" component="div" color="warning.main">
                          {appraisalMetrics.pending}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Submitted
                        </Typography>
                        <Typography variant="h4" component="div" color="info.main">
                          {appraisalMetrics.submitted}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Completed
                        </Typography>
                        <Typography variant="h4" component="div" color="success.main">
                          {appraisalMetrics.completed}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Appraisal List */}
            <Grid item xs={12}>
              <AppraisalList
                variant="all"
                enableFilters={true}
                enableSorting={true}
                enablePagination={true}
                initialPageSize={25}
              />
            </Grid>
          </Grid>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default HRAdminDashboard;