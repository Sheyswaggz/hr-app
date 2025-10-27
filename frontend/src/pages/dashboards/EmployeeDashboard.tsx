/**
 * EmployeeDashboard Component
 * 
 * Main dashboard view for employees displaying their personal information,
 * leave balances, upcoming appraisals, and onboarding tasks.
 * 
 * Features:
 * - Personal information display
 * - Leave balance cards
 * - Upcoming appraisals list
 * - Onboarding tasks section with progress tracking
 * - Responsive grid layout
 * - Loading states
 * - Error handling
 * 
 * @module pages/dashboards/EmployeeDashboard
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
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  EventAvailable as EventAvailableIcon,
  Assessment as AssessmentIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { EmployeeTaskList } from '../../components/onboarding/EmployeeTaskList';
import { TaskDetail } from '../../components/onboarding/TaskDetail';
import { useMyTasks } from '../../hooks/useMyTasks';
import { Task, TaskStatus, calculateCompletionPercentage } from '../../types/onboarding';

/**
 * Metric card component for displaying key statistics
 */
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color?: string;
}> = ({ title, value, icon, color = 'primary.main' }) => (
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
            backgroundColor: color,
            borderRadius: '50%',
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

/**
 * EmployeeDashboard Component
 * 
 * Main dashboard for employee users
 */
export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tasks } = useMyTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Calculate onboarding completion percentage
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalTasks = tasks.length;
  const completionPercentage = calculateCompletionPercentage(completedTasks, totalTasks);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name || 'Employee'}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's an overview of your HR information and tasks.
        </Typography>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Profile Status"
            value="Active"
            icon={<PersonIcon />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Leave Balance"
            value="15 days"
            icon={<EventAvailableIcon />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Next Appraisal"
            value="2 months"
            icon={<AssessmentIcon />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Onboarding Progress"
            value={`${completionPercentage}%`}
            icon={<AssignmentIcon />}
            color="primary.main"
          />
        </Grid>
      </Grid>

      {/* Onboarding Tasks Section */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            My Onboarding Tasks
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <EmployeeTaskList
          onTaskClick={(taskId) => {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
              setSelectedTask(task);
            }
          }}
          emptyMessage="No onboarding tasks assigned"
          errorMessage="Failed to load onboarding tasks. Please try again."
        />
      </Paper>

      {/* Quick Links Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Quick Links
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Leave Requests
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View and manage your leave requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Appraisals
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View your performance appraisals
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Documents
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Access your HR documents
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Profile
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Update your personal information
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSuccess={() => {
          setSelectedTask(null);
        }}
      />
    </Container>
  );
};

export default EmployeeDashboard;