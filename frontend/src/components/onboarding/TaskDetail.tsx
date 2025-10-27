/**
 * TaskDetail Component
 * 
 * Modal component for viewing and completing individual onboarding tasks.
 * Provides task information display, file upload functionality with validation,
 * and task completion capabilities.
 * 
 * Features:
 * - Task information display (title, description, due date, status)
 * - File upload with client-side validation (PDF/DOC/DOCX/JPG/PNG, max 10MB)
 * - Document preview for already uploaded files
 * - Mark complete functionality with file requirement validation
 * - Loading states during submission
 * - Success/error messages with retry options
 * - Responsive design with accessibility support
 * 
 * @module components/onboarding/TaskDetail
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { useMyTasks } from '../../hooks/useMyTasks';
import {
  Task,
  TaskStatus,
  validateFile,
  formatFileSize,
  isTaskOverdue,
  getTaskStatusColor,
  getTaskStatusLabel,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
} from '../../api/onboarding';

/**
 * TaskDetail component props
 */
interface TaskDetailProps {
  /** Task to display and manage */
  readonly task: Task | null;
  
  /** Callback when dialog should close */
  readonly onClose: () => void;
  
  /** Callback when task is successfully updated */
  readonly onSuccess?: (task: Task) => void;
  
  /** Whether dialog is open */
  readonly open: boolean;
}

/**
 * File upload state
 */
interface FileUploadState {
  /** Selected file */
  readonly file: File | null;
  
  /** File validation error */
  readonly error: string | null;
  
  /** File preview URL */
  readonly previewUrl: string | null;
}

/**
 * Submission state
 */
interface SubmissionState {
  /** Whether submission is in progress */
  readonly loading: boolean;
  
  /** Submission error message */
  readonly error: string | null;
  
  /** Submission success message */
  readonly success: string | null;
}

/**
 * TaskDetail Component
 * 
 * Displays task details in a modal dialog with file upload and completion functionality.
 * 
 * @param props - Component props
 * @returns TaskDetail component
 * 
 * @example
 * ```tsx
 * function TaskList() {
 *   const [selectedTask, setSelectedTask] = useState<Task | null>(null);
 *   
 *   return (
 *     <>
 *       {tasks.map(task => (
 *         <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
 *       ))}
 *       <TaskDetail
 *         task={selectedTask}
 *         open={!!selectedTask}
 *         onClose={() => setSelectedTask(null)}
 *         onSuccess={(updatedTask) => {
 *           console.log('Task updated:', updatedTask);
 *           setSelectedTask(null);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export const TaskDetail: React.FC<TaskDetailProps> = ({
  task,
  onClose,
  onSuccess,
  open,
}) => {
  // Hooks
  const { updateTask } = useMyTasks();
  
  // File upload state
  const [fileState, setFileState] = useState<FileUploadState>({
    file: null,
    error: null,
    previewUrl: null,
  });
  
  // Submission state
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    loading: false,
    error: null,
    success: null,
  });
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  /**
   * Reset component state when dialog closes or task changes
   */
  useEffect(() => {
    if (!open || !task) {
      setFileState({
        file: null,
        error: null,
        previewUrl: null,
      });
      setSubmissionState({
        loading: false,
        error: null,
        success: null,
      });
    }
  }, [open, task]);
  
  /**
   * Cleanup preview URL on unmount
   */
  useEffect(() => {
    return () => {
      if (fileState.previewUrl) {
        URL.revokeObjectURL(fileState.previewUrl);
      }
    };
  }, [fileState.previewUrl]);
  
  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    
    if (!file) {
      setFileState({
        file: null,
        error: null,
        previewUrl: null,
      });
      return;
    }
    
    // Validate file
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setFileState({
        file: null,
        error: validation.error || 'Invalid file',
        previewUrl: null,
      });
      
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TaskDetail] File validation failed:', validation.error);
      }
      
      return;
    }
    
    // Create preview URL for images
    let previewUrl: string | null = null;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }
    
    setFileState({
      file,
      error: null,
      previewUrl,
    });
    
    // Clear submission error when new file is selected
    setSubmissionState(prev => ({
      ...prev,
      error: null,
    }));
    
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TaskDetail] File selected:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }
  }, []);
  
  /**
   * Handle file removal
   */
  const handleFileRemove = useCallback((): void => {
    if (fileState.previewUrl) {
      URL.revokeObjectURL(fileState.previewUrl);
    }
    
    setFileState({
      file: null,
      error: null,
      previewUrl: null,
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (import.meta.env.VITE_API_DEBUG === 'true') {
      console.debug('[TaskDetail] File removed');
    }
  }, [fileState.previewUrl]);
  
  /**
   * Handle task completion
   */
  const handleComplete = useCallback(async (): Promise<void> => {
    if (!task) {
      return;
    }
    
    try {
      setSubmissionState({
        loading: true,
        error: null,
        success: null,
      });
      
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TaskDetail] Completing task:', task.id);
      }
      
      await updateTask(task.id, {
        status: TaskStatus.COMPLETED,
        file: fileState.file || undefined,
      });
      
      setSubmissionState({
        loading: false,
        error: null,
        success: 'Task completed successfully!',
      });
      
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[TaskDetail] Task completed successfully');
      }
      
      // Call success callback after short delay to show success message
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(task);
        }
        onClose();
      }, 1500);
    } catch (error) {
      console.error('[TaskDetail] Failed to complete task:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to complete task. Please try again.';
      
      setSubmissionState({
        loading: false,
        error: errorMessage,
        success: null,
      });
    }
  }, [task, fileState.file, updateTask, onSuccess, onClose]);
  
  /**
   * Handle retry after error
   */
  const handleRetry = useCallback((): void => {
    setSubmissionState({
      loading: false,
      error: null,
      success: null,
    });
  }, []);
  
  /**
   * Handle dialog close
   */
  const handleClose = useCallback((): void => {
    if (submissionState.loading) {
      return;
    }
    onClose();
  }, [submissionState.loading, onClose]);
  
  // Don't render if no task
  if (!task) {
    return null;
  }
  
  // Check if task is already completed
  const isCompleted = task.status === TaskStatus.COMPLETED;
  
  // Check if task is overdue
  const isOverdue = isTaskOverdue(task);
  
  // Check if file is required but not uploaded
  const isFileRequired = !task.documentUrl && !fileState.file;
  
  // Determine if complete button should be disabled
  const isCompleteDisabled = 
    submissionState.loading || 
    isCompleted || 
    (isFileRequired && !fileState.file);
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="task-detail-title"
      aria-describedby="task-detail-description"
    >
      {/* Loading indicator */}
      {submissionState.loading && <LinearProgress />}
      
      {/* Dialog Title */}
      <DialogTitle id="task-detail-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Task Details
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
            disabled={submissionState.loading}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      {/* Dialog Content */}
      <DialogContent dividers>
        {/* Success Message */}
        {submissionState.success && (
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ mb: 2 }}
          >
            {submissionState.success}
          </Alert>
        )}
        
        {/* Error Message */}
        {submissionState.error && (
          <Alert 
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
            sx={{ mb: 2 }}
          >
            {submissionState.error}
          </Alert>
        )}
        
        {/* Task Status */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Chip
            label={getTaskStatusLabel(task.status)}
            color={getTaskStatusColor(task.status) as any}
            size="small"
          />
          {isOverdue && (
            <Chip
              label="Overdue"
              color="error"
              size="small"
              icon={<WarningIcon />}
            />
          )}
        </Box>
        
        {/* Task Title */}
        <Typography variant="h5" gutterBottom>
          {task.title}
        </Typography>
        
        {/* Task Description */}
        <Typography 
          variant="body1" 
          color="text.secondary" 
          paragraph
          id="task-detail-description"
        >
          {task.description}
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Task Metadata */}
        <Box display="flex" flexDirection="column" gap={1} mb={2}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Due Date:
            </Typography>
            <Typography 
              variant="body2" 
              fontWeight="medium"
              color={isOverdue ? 'error.main' : 'text.primary'}
            >
              {new Date(task.dueDate).toLocaleDateString()}
            </Typography>
          </Box>
          
          {task.completedAt && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Completed:
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {new Date(task.completedAt).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Document Section */}
        <Typography variant="h6" gutterBottom>
          Document Upload
        </Typography>
        
        {/* Existing Document */}
        {task.documentUrl && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <DescriptionIcon color="primary" />
              <Box flex={1}>
                <Typography variant="body2" fontWeight="medium">
                  Uploaded Document
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {task.documentUrl.split('/').pop()}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                href={task.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View
              </Button>
            </Box>
          </Paper>
        )}
        
        {/* File Upload (only if task not completed) */}
        {!isCompleted && (
          <>
            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              aria-label="Upload document"
            />
            
            {/* Selected File Display */}
            {fileState.file ? (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <FileIcon color="primary" />
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="medium">
                      {fileState.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(fileState.file.size)}
                    </Typography>
                  </Box>
                  {fileState.previewUrl && (
                    <Box
                      component="img"
                      src={fileState.previewUrl}
                      alt="Preview"
                      sx={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 1,
                      }}
                    />
                  )}
                  <IconButton
                    size="small"
                    onClick={handleFileRemove}
                    aria-label="Remove file"
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Paper>
            ) : (
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{ mb: 2 }}
              >
                Upload Document
              </Button>
            )}
            
            {/* File Validation Error */}
            {fileState.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {fileState.error}
              </Alert>
            )}
            
            {/* File Upload Guidelines */}
            <Typography variant="caption" color="text.secondary" display="block">
              Accepted formats: PDF, DOC, DOCX, JPG, PNG
              <br />
              Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
            </Typography>
          </>
        )}
      </DialogContent>
      
      {/* Dialog Actions */}
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={submissionState.loading}
        >
          {isCompleted ? 'Close' : 'Cancel'}
        </Button>
        
        {!isCompleted && (
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={isCompleteDisabled}
            startIcon={
              submissionState.loading ? (
                <CircularProgress size={20} />
              ) : (
                <CheckCircleIcon />
              )
            }
          >
            {submissionState.loading ? 'Completing...' : 'Mark Complete'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TaskDetail;