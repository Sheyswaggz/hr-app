/**
 * TaskDetail Component Test Suite
 * 
 * Comprehensive test coverage for TaskDetail component including:
 * - Task information rendering
 * - File upload functionality
 * - File validation (type and size)
 * - Task completion workflow
 * - Error handling and retry logic
 * - Success/error message display
 * - Loading states
 * - Accessibility compliance
 * 
 * @module tests/components/onboarding/TaskDetail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetail } from '../../../src/components/onboarding/TaskDetail';
import { Task, TaskStatus } from '../../../src/api/onboarding';
import * as useMyTasksHook from '../../../src/hooks/useMyTasks';

/**
 * Mock task data factory
 */
const createMockTask = (overrides?: Partial<Task>): Task => ({
  id: 'task-1',
  workflowId: 'workflow-1',
  employeeId: 'employee-1',
  title: 'Complete Profile Setup',
  description: 'Please fill in your personal information and upload required documents.',
  status: TaskStatus.PENDING,
  dueDate: new Date('2025-12-31').toISOString(),
  createdAt: new Date('2025-01-01').toISOString(),
  updatedAt: new Date('2025-01-01').toISOString(),
  documentUrl: null,
  completedAt: null,
  ...overrides,
});

/**
 * Mock file factory
 */
const createMockFile = (
  name: string,
  size: number,
  type: string
): File => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/**
 * Mock useMyTasks hook
 */
const mockUpdateTask = vi.fn();

describe('TaskDetail Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Mock useMyTasks hook
    vi.spyOn(useMyTasksHook, 'useMyTasks').mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      fetchTasks: vi.fn(),
      updateTask: mockUpdateTask,
      refreshTasks: vi.fn(),
    });

    // Reset mocks
    mockUpdateTask.mockReset();
    mockUpdateTask.mockResolvedValue(undefined);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Information Rendering', () => {
    it('renders task title and description', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Complete Profile Setup')).toBeInTheDocument();
      expect(
        screen.getByText('Please fill in your personal information and upload required documents.')
      ).toBeInTheDocument();
    });

    it('displays task status chip', () => {
      const task = createMockTask({ status: TaskStatus.PENDING });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('displays due date', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Due Date:')).toBeInTheDocument();
      expect(screen.getByText('12/31/2025')).toBeInTheDocument();
    });

    it('displays overdue indicator for past due tasks', () => {
      const task = createMockTask({
        dueDate: new Date('2020-01-01').toISOString(),
      });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('displays completed date when task is completed', () => {
      const task = createMockTask({
        status: TaskStatus.COMPLETED,
        completedAt: new Date('2025-06-15').toISOString(),
      });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Completed:')).toBeInTheDocument();
      expect(screen.getByText('6/15/2025')).toBeInTheDocument();
    });

    it('displays existing document when available', () => {
      const task = createMockTask({
        documentUrl: 'https://example.com/documents/profile.pdf',
      });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Uploaded Document')).toBeInTheDocument();
      expect(screen.getByText('profile.pdf')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute(
        'href',
        'https://example.com/documents/profile.pdf'
      );
    });

    it('does not render when task is null', () => {
      const { container } = render(
        <TaskDetail
          task={null}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('File Upload Functionality', () => {
    it('allows file selection', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
    });

    it('displays file size for selected file', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 2 * 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('2.00 MB')).toBeInTheDocument();
      });
    });

    it('displays image preview for image files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('photo.jpg', 1024 * 1024, 'image/jpeg');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        const preview = screen.getByAltText('Preview');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'blob:mock-url');
      });
    });

    it('allows file removal', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove file/i });
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
      });
    });

    it('displays file upload guidelines', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/accepted formats: pdf, doc, docx, jpg, png/i)).toBeInTheDocument();
      expect(screen.getByText(/maximum file size: 10\.00 mb/i)).toBeInTheDocument();
    });

    it('hides upload section for completed tasks', () => {
      const task = createMockTask({
        status: TaskStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /upload document/i })).not.toBeInTheDocument();
    });
  });

  describe('File Type Validation', () => {
    it('accepts PDF files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('accepts DOC files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.doc', 1024 * 1024, 'application/msword');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.doc')).toBeInTheDocument();
      });
    });

    it('accepts DOCX files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile(
        'document.docx',
        1024 * 1024,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.docx')).toBeInTheDocument();
      });
    });

    it('accepts JPG files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('photo.jpg', 1024 * 1024, 'image/jpeg');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      });
    });

    it('accepts PNG files', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('image.png', 1024 * 1024, 'image/png');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('image.png')).toBeInTheDocument();
      });
    });

    it('rejects invalid file types', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('script.exe', 1024 * 1024, 'application/x-msdownload');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(within(alert).getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Size Validation', () => {
    it('accepts files under 10MB', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 5 * 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('rejects files over 10MB', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('large.pdf', 15 * 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(within(alert).getByText(/file size exceeds maximum/i)).toBeInTheDocument();
      });
    });

    it('displays validation error message', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('large.pdf', 15 * 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/file size exceeds maximum allowed size of 10\.00 mb/i);
      });
    });
  });

  describe('Task Completion', () => {
    it('submits task completion with file', async () => {
      const task = createMockTask();
      const onSuccess = vi.fn();
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', {
          status: TaskStatus.COMPLETED,
          file,
        });
      });
    });

    it('displays loading state during submission', async () => {
      const task = createMockTask();
      mockUpdateTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      expect(screen.getByRole('button', { name: /completing/i })).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables complete button when no file uploaded', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      expect(completeButton).toBeDisabled();
    });

    it('enables complete button when file is uploaded', async () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        const completeButton = screen.getByRole('button', { name: /mark complete/i });
        expect(completeButton).not.toBeDisabled();
      });
    });

    it('enables complete button when document already exists', () => {
      const task = createMockTask({
        documentUrl: 'https://example.com/documents/profile.pdf',
      });
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      expect(completeButton).not.toBeDisabled();
    });
  });

  describe('Success Message Display', () => {
    it('displays success message after completion', async () => {
      const task = createMockTask();
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Task completed successfully!')).toBeInTheDocument();
      });
    });

    it('calls onSuccess callback after completion', async () => {
      const task = createMockTask();
      const onSuccess = vi.fn();
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(task);
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on submission failure', async () => {
      const task = createMockTask();
      mockUpdateTask.mockRejectedValue(new Error('Network error'));
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('displays retry button on error', async () => {
      const task = createMockTask();
      mockUpdateTask.mockRejectedValue(new Error('Network error'));
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('clears error on retry', async () => {
      const task = createMockTask();
      mockUpdateTask.mockRejectedValue(new Error('Network error'));
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(screen.queryByText('Network error')).not.toBeInTheDocument();
    });

    it('handles generic error messages', async () => {
      const task = createMockTask();
      mockUpdateTask.mockRejectedValue('Unknown error');
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to complete task. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const task = createMockTask();
      const onClose = vi.fn();
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when cancel button is clicked', async () => {
      const task = createMockTask();
      const onClose = vi.fn();
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={onClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('prevents closing during submission', async () => {
      const task = createMockTask();
      const onClose = vi.fn();
      mockUpdateTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={onClose}
        />
      );

      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
      const uploadButton = screen.getByRole('button', { name: /upload document/i });
      
      await user.click(uploadButton);
      
      const fileInput = screen.getByLabelText(/upload document/i) as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /mark complete/i });
      await user.click(completeButton);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeDisabled();
    });

    it('shows Close button for completed tasks', () => {
      const task = createMockTask({
        status: TaskStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      });
      
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/close/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/upload document/i)).toBeInTheDocument();
    });

    it('has proper dialog role', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has descriptive title', () => {
      const task = createMockTask();
      render(
        <TaskDetail
          task={task}
          open={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Task Details')).toBeInTheDocument();
    });
  });
});