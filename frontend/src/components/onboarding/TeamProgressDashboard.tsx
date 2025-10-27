/**
 * Team Progress Dashboard Component
 * 
 * Displays onboarding progress for team members in a manager dashboard.
 * Features include progress visualization, filtering, sorting, and real-time updates.
 * 
 * Features:
 * - MUI DataGrid with team member progress data
 * - Visual progress indicators (progress bars)
 * - Filter by completion status
 * - Sort by completion percentage
 * - Loading skeleton states
 * - Error display with retry functionality
 * - Empty state messaging
 * - Responsive design
 * - Accessibility compliant (WCAG 2.1 AA)
 * 
 * @module components/onboarding/TeamProgressDashboard
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridFilterModel,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import { useTeamProgress } from '../../hooks/useTeamProgress';
import { TeamProgress } from '../../types/onboarding';

/**
 * Status filter options
 */
type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

/**
 * Component props interface
 */
interface TeamProgressDashboardProps {
  /** Optional title override */
  readonly title?: string;
  
  /** Optional height for the data grid */
  readonly height?: number | string;
  
  /** Optional callback when a row is clicked */
  readonly onRowClick?: (employeeId: string) => void;
  
  /** Optional custom empty state message */
  readonly emptyStateMessage?: string;
}

/**
 * Get status label and color based on completion percentage
 */
function getStatusInfo(completionPercentage: number): {
  label: string;
  color: 'default' | 'primary' | 'success' | 'warning';
  icon: React.ReactElement;
} {
  if (completionPercentage === 0) {
    return {
      label: 'Not Started',
      color: 'default',
      icon: <PendingIcon fontSize="small" />,
    };
  }
  if (completionPercentage === 100) {
    return {
      label: 'Completed',
      color: 'success',
      icon: <CheckCircleIcon fontSize="small" />,
    };
  }
  return {
    label: 'In Progress',
    color: 'primary',
    icon: <PendingIcon fontSize="small" />,
  };
}

/**
 * Filter team progress data by status
 */
function filterByStatus(
  data: readonly TeamProgress[],
  filter: StatusFilter
): readonly TeamProgress[] {
  if (filter === 'all') {
    return data;
  }

  return data.filter((item) => {
    const { completionPercentage } = item;
    
    switch (filter) {
      case 'not_started':
        return completionPercentage === 0;
      case 'in_progress':
        return completionPercentage > 0 && completionPercentage < 100;
      case 'completed':
        return completionPercentage === 100;
      default:
        return true;
    }
  });
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Team Progress Dashboard Component
 * 
 * Displays team onboarding progress with filtering, sorting, and visual indicators.
 * Implements loading states, error handling, and accessibility features.
 * 
 * @example
 * ```tsx
 * <TeamProgressDashboard
 *   title="Team Onboarding Progress"
 *   onRowClick={(employeeId) => navigate(`/employee/${employeeId}`)}
 * />
 * ```
 */
export const TeamProgressDashboard: React.FC<TeamProgressDashboardProps> = ({
  title = 'Team Onboarding Progress',
  height = 600,
  onRowClick,
  emptyStateMessage = 'No team members with active onboarding workflows.',
}) => {
  // Fetch team progress data
  const { data, isLoading, error, refetch, isRefetching } = useTeamProgress();

  // Local state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'completionPercentage', sort: 'desc' },
  ]);

  /**
   * Handle status filter change
   */
  const handleStatusFilterChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const newFilter = event.target.value as StatusFilter;
      setStatusFilter(newFilter);

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TeamProgressDashboard] Status filter changed', {
          filter: newFilter,
          timestamp: new Date().toISOString(),
        });
      }
    },
    []
  );

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(async () => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TeamProgressDashboard] Manual refresh triggered');
    }

    await refetch();
  }, [refetch]);

  /**
   * Handle row click
   */
  const handleRowClick = useCallback(
    (params: any) => {
      if (onRowClick) {
        onRowClick(params.row.employeeId);
      }
    },
    [onRowClick]
  );

  /**
   * Filter data based on status filter
   */
  const filteredData = useMemo(() => {
    return filterByStatus(data, statusFilter);
  }, [data, statusFilter]);

  /**
   * Define DataGrid columns
   */
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'employeeName',
        headerName: 'Employee Name',
        flex: 1,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => (
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'templateName',
        headerName: 'Template',
        flex: 1,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => (
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'completionPercentage',
        headerName: 'Progress',
        width: 200,
        sortable: true,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => {
          const percentage = params.value as number;
          return (
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  color={percentage === 100 ? 'success' : 'primary'}
                  sx={{ height: 8, borderRadius: 1 }}
                  aria-label={`${percentage}% complete`}
                />
              </Box>
              <Typography variant="body2" fontWeight="medium" sx={{ minWidth: 40 }}>
                {percentage}%
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'tasksCompleted',
        headerName: 'Tasks',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => {
          const row = params.row as TeamProgress;
          return (
            <Typography variant="body2">
              {row.tasksCompleted} / {row.tasksTotal}
            </Typography>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        sortable: false,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => {
          const row = params.row as TeamProgress;
          const statusInfo = getStatusInfo(row.completionPercentage);
          return (
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
              icon={statusInfo.icon}
              aria-label={`Status: ${statusInfo.label}`}
            />
          );
        },
      },
      {
        field: 'assignedAt',
        headerName: 'Assigned Date',
        width: 130,
        sortable: true,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value as Date)}
          </Typography>
        ),
      },
      {
        field: 'expectedCompletionDate',
        headerName: 'Expected Completion',
        width: 160,
        sortable: true,
        renderCell: (params: GridRenderCellParams<TeamProgress>) => {
          const row = params.row as TeamProgress;
          const isOverdue =
            row.completionPercentage < 100 &&
            new Date() > new Date(row.expectedCompletionDate);
          
          return (
            <Tooltip
              title={isOverdue ? 'Overdue' : 'On track'}
              arrow
            >
              <Typography
                variant="body2"
                color={isOverdue ? 'error' : 'text.secondary'}
                fontWeight={isOverdue ? 'medium' : 'normal'}
              >
                {formatDate(params.value as Date)}
              </Typography>
            </Tooltip>
          );
        },
      },
    ],
    []
  );

  /**
   * Render loading skeleton
   */
  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="rectangular" height={60} />
          <Skeleton variant="rectangular" height={400} />
        </Stack>
      </Paper>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRefresh}
              disabled={isRefetching}
              aria-label="Retry loading team progress"
            >
              Retry
            </Button>
          }
        >
          <Typography variant="body2" fontWeight="medium">
            Failed to load team progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </Typography>
        </Alert>
      </Paper>
    );
  }

  /**
   * Render empty state
   */
  if (data.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            textAlign: 'center',
          }}
        >
          <PendingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Team Members Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
            {emptyStateMessage}
          </Typography>
        </Box>
      </Paper>
    );
  }

  /**
   * Render main content
   */
  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" component="h2" fontWeight="medium">
          {title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="status-filter-label">
              <FilterListIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
              Status
            </InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange as any}
              aria-label="Filter by status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="not_started">Not Started</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>

          {/* Refresh Button */}
          <Tooltip title="Refresh data" arrow>
            <IconButton
              onClick={handleRefresh}
              disabled={isRefetching}
              color="primary"
              aria-label="Refresh team progress data"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip
          label={`Total: ${data.length}`}
          color="default"
          variant="outlined"
        />
        <Chip
          label={`Completed: ${data.filter((d) => d.completionPercentage === 100).length}`}
          color="success"
          variant="outlined"
        />
        <Chip
          label={`In Progress: ${data.filter((d) => d.completionPercentage > 0 && d.completionPercentage < 100).length}`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={`Not Started: ${data.filter((d) => d.completionPercentage === 0).length}`}
          color="default"
          variant="outlined"
        />
      </Box>

      {/* Data Grid */}
      <Box sx={{ height, width: '100%' }}>
        <DataGrid
          rows={filteredData}
          columns={columns}
          getRowId={(row) => row.employeeId}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          onRowClick={handleRowClick}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10, page: 0 },
            },
          }}
          disableRowSelectionOnClick
          loading={isRefetching}
          sx={{
            '& .MuiDataGrid-row': {
              cursor: onRowClick ? 'pointer' : 'default',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: onRowClick ? 'action.hover' : 'transparent',
            },
          }}
          aria-label="Team onboarding progress table"
        />
      </Box>
    </Paper>
  );
};

/**
 * Export component as default
 */
export default TeamProgressDashboard;