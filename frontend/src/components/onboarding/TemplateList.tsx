/**
 * TemplateList Component
 * 
 * Displays a list of onboarding templates for HR Admin with full CRUD operations.
 * Features include:
 * - MUI DataGrid with pagination and sorting
 * - Create new template button
 * - Edit/delete actions per row
 * - Loading skeleton states
 * - Error display with retry functionality
 * - Search and filter capabilities
 * - Responsive design
 * 
 * @module components/onboarding/TemplateList
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useOnboardingTemplates } from '../../hooks/useOnboardingTemplates';
import { Template } from '../../api/onboarding';

/**
 * Props interface for TemplateList component
 */
export interface TemplateListProps {
  /** Callback when create button is clicked */
  readonly onCreateClick?: () => void;
  /** Callback when edit button is clicked */
  readonly onEditClick?: (template: Template) => void;
  /** Callback when delete is confirmed */
  readonly onDeleteConfirm?: (templateId: string) => void;
  /** Optional CSS class name */
  readonly className?: string;
}

/**
 * TemplateList Component
 * 
 * Displays onboarding templates in a data grid with CRUD operations
 */
export const TemplateList: React.FC<TemplateListProps> = ({
  onCreateClick,
  onEditClick,
  onDeleteConfirm,
  className,
}) => {
  // Hook for template data management
  const {
    templates,
    loading,
    error,
    deleteTemplate,
    refetch,
    clearError,
    retry,
  } = useOnboardingTemplates();

  // Local state for search and pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'name', sort: 'asc' },
  ]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  }, []);

  /**
   * Handle template deletion
   */
  const handleDelete = useCallback(async (templateId: string) => {
    if (!templateId) {
      console.error('[TemplateList] Invalid template ID for deletion');
      return;
    }

    try {
      setDeletingId(templateId);

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TemplateList] Deleting template:', templateId);
      }

      await deleteTemplate(templateId);

      if (onDeleteConfirm) {
        onDeleteConfirm(templateId);
      }

      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TemplateList] Template deleted successfully');
      }
    } catch (err) {
      console.error('[TemplateList] Failed to delete template:', err);
    } finally {
      setDeletingId(null);
    }
  }, [deleteTemplate, onDeleteConfirm]);

  /**
   * Handle edit button click
   */
  const handleEdit = useCallback((template: Template) => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TemplateList] Edit clicked for template:', template.id);
    }

    if (onEditClick) {
      onEditClick(template);
    }
  }, [onEditClick]);

  /**
   * Handle create button click
   */
  const handleCreate = useCallback(() => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TemplateList] Create new template clicked');
    }

    if (onCreateClick) {
      onCreateClick();
    }
  }, [onCreateClick]);

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(async () => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TemplateList] Manual refresh triggered');
    }

    await refetch();
  }, [refetch]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(async () => {
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TemplateList] Retry clicked');
    }

    clearError();
    await retry();
  }, [clearError, retry]);

  /**
   * Filter templates based on search query
   */
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }

    const query = searchQuery.toLowerCase();
    return templates.filter(template => 
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  /**
   * DataGrid column definitions
   */
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Template Name',
      flex: 1,
      minWidth: 200,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Template>) => (
        <Typography variant="body2" fontWeight="medium">
          {params.row.name}
        </Typography>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 300,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Template>) => (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {params.row.description}
        </Typography>
      ),
    },
    {
      field: 'tasks',
      headerName: 'Tasks',
      width: 120,
      sortable: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Template>) => (
        <Chip
          label={params.row.tasks.length}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Template>) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(params.row.createdAt).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Template>) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Edit template">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEdit(params.row)}
              disabled={loading || deletingId === params.row.id}
              aria-label={`Edit ${params.row.name}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete template">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(params.row.id)}
              disabled={loading || deletingId === params.row.id}
              aria-label={`Delete ${params.row.name}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [handleEdit, handleDelete, loading, deletingId]);

  /**
   * Render loading skeleton
   */
  if (loading && templates.length === 0) {
    return (
      <Paper className={className} sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={36} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Paper>
    );
  }

  return (
    <Paper className={className} sx={{ p: 3 }}>
      {/* Header Section */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" component="h2" fontWeight="bold">
          Onboarding Templates
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh templates">
            <IconButton
              color="primary"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh templates"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            disabled={loading}
            aria-label="Create new template"
          >
            Create Template
          </Button>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
          onClose={clearError}
        >
          <Typography variant="body2" fontWeight="medium">
            {error.message || 'Failed to load templates'}
          </Typography>
          {error.statusCode && (
            <Typography variant="caption" color="text.secondary">
              Error Code: {error.statusCode}
            </Typography>
          )}
        </Alert>
      )}

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search templates by name or description..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          aria-label="Search templates"
        />
      </Box>

      {/* Data Grid */}
      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredTemplates}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          pageSizeOptions={[5, 10, 25, 50]}
          disableRowSelectionOnClick
          loading={loading}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          getRowId={(row) => row.id}
          aria-label="Onboarding templates table"
          localeText={{
            noRowsLabel: searchQuery
              ? 'No templates match your search'
              : 'No templates available. Create your first template to get started.',
          }}
        />
      </Box>

      {/* Results Summary */}
      {filteredTemplates.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredTemplates.length} of {templates.length} template(s)
          </Typography>
          {searchQuery && (
            <Typography variant="body2" color="text.secondary">
              Filtered by: "{searchQuery}"
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default TemplateList;