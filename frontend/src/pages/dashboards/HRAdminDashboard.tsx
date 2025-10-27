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
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { TemplateList } from '../../components/onboarding/TemplateList';
import { TemplateForm } from '../../components/onboarding/TemplateForm';
import { WorkflowAssignment } from '../../components/onboarding/WorkflowAssignment';
import { useOnboardingTemplates } from '../../hooks/useOnboardingTemplates';

/**
 * HR Admin Dashboard Component
 * 
 * Main dashboard for HR administrators with comprehensive management capabilities.
 * Includes employee metrics, leave management, appraisal tracking, and onboarding workflow management.
 */
const HRAdminDashboard: React.FC = () => {
  // Onboarding state management
  const { createTemplate, updateTemplate } = useOnboardingTemplates();
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateFormMode, setTemplateFormMode] = useState<'create' | 'edit'>('create');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [workflowAssignmentOpen, setWorkflowAssignmentOpen] = useState(false);

  // Mock data for existing metrics
  const metrics = {
    totalEmployees: 150,
    activeLeaveRequests: 12,
    pendingAppraisals: 8,
    pendingOnboarding: 5,
  };

  // Mock employees data for workflow assignment
  const mockEmployees = [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      department: 'Engineering',
      position: 'Software Engineer',
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      department: 'Marketing',
      position: 'Marketing Manager',
    },
  ];

  /**
   * Handle create template button click
   */
  const handleCreateTemplateClick = useCallback(() => {
    setTemplateFormMode('create');
    setSelectedTemplate(null);
    setTemplateFormOpen(true);
  }, []);

  /**
   * Handle edit template button click
   */
  const handleEditTemplateClick = useCallback((template: any) => {
    setTemplateFormMode('edit');
    setSelectedTemplate(template);
    setTemplateFormOpen(true);
  }, []);

  /**
   * Handle template form submission
   */
  const handleTemplateFormSuccess = useCallback(
    async (data: any) => {
      if (templateFormMode === 'create') {
        await createTemplate(data);
      } else if (selectedTemplate) {
        await updateTemplate(selectedTemplate.id, data);
      }
    },
    [templateFormMode, selectedTemplate, createTemplate, updateTemplate]
  );

  /**
   * Handle assign workflow button click
   */
  const handleAssignWorkflowClick = useCallback(() => {
    setWorkflowAssignmentOpen(true);
  }, []);

  /**
   * Handle workflow assignment success
   */
  const handleWorkflowAssignmentSuccess = useCallback((workflowId: string) => {
    console.log('Workflow assigned successfully:', workflowId);
  }, []);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        HR Admin Dashboard
      </Typography>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Total Employees
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.totalEmployees}
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Active Leave Requests
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.activeLeaveRequests}
                  </Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize: 48, color: 'warning.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Pending Appraisals
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.pendingAppraisals}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 48, color: 'info.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Pending Onboarding
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.pendingOnboarding}
                  </Typography>
                </Box>
                <PersonAddIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onboarding Management Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography variant="h5" component="h2" fontWeight="bold">
            Onboarding Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={handleAssignWorkflowClick}
              aria-label="Assign workflow to employee"
            >
              Assign Workflow
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateTemplateClick}
              aria-label="Create new onboarding template"
            >
              Create Template
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <TemplateList
          onCreateClick={handleCreateTemplateClick}
          onEditClick={handleEditTemplateClick}
        />
      </Paper>

      {/* Template Form Dialog */}
      <TemplateForm
        open={templateFormOpen}
        mode={templateFormMode}
        initialData={selectedTemplate}
        onSuccess={handleTemplateFormSuccess}
        onClose={() => setTemplateFormOpen(false)}
      />

      {/* Workflow Assignment Dialog */}
      <WorkflowAssignment
        open={workflowAssignmentOpen}
        onClose={() => setWorkflowAssignmentOpen(false)}
        onSuccess={handleWorkflowAssignmentSuccess}
        employees={mockEmployees}
        employeesLoading={false}
      />
    </Container>
  );
};

export default HRAdminDashboard;