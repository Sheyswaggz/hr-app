/**
 * TemplateForm Component Test Suite
 * 
 * Comprehensive test coverage for the TemplateForm component including:
 * - Form rendering and field validation
 * - Task management (add/remove)
 * - Form submission with success and error scenarios
 * - Create and edit mode behavior
 * - Accessibility and keyboard navigation
 * - Error handling and user feedback
 * 
 * @module tests/components/onboarding/TemplateForm.test
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateForm } from '../../../src/components/onboarding/TemplateForm';

/**
 * Mock data for testing
 */
const mockInitialData = {
  id: 'template-123',
  name: 'Software Engineer Onboarding',
  description: 'Complete onboarding process for new software engineers',
  tasks: [
    {
      title: 'Complete Profile',
      description: 'Fill in your personal and professional information',
      dueDate: 7,
    },
    {
      title: 'Setup Development Environment',
      description: 'Install required tools and configure your workstation',
      dueDate: 14,
    },
  ],
};

/**
 * Helper function to setup user event
 */
const setupUser = () => userEvent.setup();

/**
 * Helper function to get form fields
 */
const getFormFields = () => ({
  nameInput: screen.getByLabelText(/template name/i),
  descriptionInput: screen.getByLabelText(/template description/i),
  addTaskButton: screen.getByRole('button', { name: /add task/i }),
  submitButton: screen.getByRole('button', { name: /(create template|save changes)/i }),
  cancelButton: screen.getByRole('button', { name: /cancel/i }),
});

/**
 * Helper function to get task fields by index
 */
const getTaskFields = (index: number) => {
  const taskBoxes = screen.getAllByRole('heading', { level: 4 });
  const taskBox = taskBoxes[index].closest('div[style*="border"]');
  
  if (!taskBox) {
    throw new Error(`Task box ${index} not found`);
  }

  return {
    titleInput: within(taskBox).getByLabelText(/task.*title/i),
    descriptionInput: within(taskBox).getByLabelText(/task.*description/i),
    dueDateInput: within(taskBox).getByLabelText(/due date/i),
    removeButton: within(taskBox).getByRole('button', { name: /remove task/i }),
  };
};

describe('TemplateForm', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn().mockResolvedValue(undefined);
    mockOnClose = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders form fields in create mode', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create onboarding template/i)).toBeInTheDocument();
      
      const fields = getFormFields();
      expect(fields.nameInput).toBeInTheDocument();
      expect(fields.descriptionInput).toBeInTheDocument();
      expect(fields.addTaskButton).toBeInTheDocument();
      expect(fields.submitButton).toHaveTextContent(/create template/i);
      expect(fields.cancelButton).toBeInTheDocument();
    });

    it('renders form fields in edit mode', () => {
      render(
        <TemplateForm
          open={true}
          mode="edit"
          initialData={mockInitialData}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/edit onboarding template/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('renders with initial task in create mode', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/task 1/i)).toBeInTheDocument();
      const taskFields = getTaskFields(0);
      expect(taskFields.titleInput).toBeInTheDocument();
      expect(taskFields.descriptionInput).toBeInTheDocument();
      expect(taskFields.dueDateInput).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <TemplateForm
          open={false}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders close button in dialog title', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Field Validation', () => {
    it('validates required template name field', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      // Focus and blur without entering value
      await user.click(fields.nameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
      });
    });

    it('validates template name max length', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      const longName = 'a'.repeat(201);
      
      await user.type(fields.nameInput, longName);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must not exceed 200 characters/i)).toBeInTheDocument();
      });
    });

    it('validates empty template name after trimming', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      await user.type(fields.nameInput, '   ');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/template name cannot be empty/i)).toBeInTheDocument();
      });
    });

    it('validates required description field', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      await user.click(fields.descriptionInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/template description is required/i)).toBeInTheDocument();
      });
    });

    it('validates description max length', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      const longDescription = 'a'.repeat(2001);
      
      await user.type(fields.descriptionInput, longDescription);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must not exceed 2000 characters/i)).toBeInTheDocument();
      });
    });

    it('validates required task title', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      
      await user.click(taskFields.titleInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/task title is required/i)).toBeInTheDocument();
      });
    });

    it('validates task title max length', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      const longTitle = 'a'.repeat(201);
      
      await user.type(taskFields.titleInput, longTitle);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/title must not exceed 200 characters/i)).toBeInTheDocument();
      });
    });

    it('validates required task description', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      
      await user.click(taskFields.descriptionInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/task description is required/i)).toBeInTheDocument();
      });
    });

    it('validates task description max length', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      const longDescription = 'a'.repeat(2001);
      
      await user.type(taskFields.descriptionInput, longDescription);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/description must not exceed 2000 characters/i)).toBeInTheDocument();
      });
    });

    it('validates due date minimum value', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      
      await user.clear(taskFields.dueDateInput);
      await user.type(taskFields.dueDateInput, '0');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/due date must be at least 1 day/i)).toBeInTheDocument();
      });
    });

    it('validates due date maximum value', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      
      await user.clear(taskFields.dueDateInput);
      await user.type(taskFields.dueDateInput, '366');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/due date must not exceed 365 days/i)).toBeInTheDocument();
      });
    });

    it('displays character count for name field', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      await user.type(fields.nameInput, 'Test Template');

      expect(screen.getByText(/13\/200 characters/i)).toBeInTheDocument();
    });

    it('displays character count for description field', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      await user.type(fields.descriptionInput, 'Test description');

      expect(screen.getByText(/16\/2000 characters/i)).toBeInTheDocument();
    });
  });

  describe('Task Management', () => {
    it('allows adding new tasks', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      // Initially one task
      expect(screen.getByText(/task 1/i)).toBeInTheDocument();
      expect(screen.queryByText(/task 2/i)).not.toBeInTheDocument();

      // Add second task
      await user.click(fields.addTaskButton);

      await waitFor(() => {
        expect(screen.getByText(/task 2/i)).toBeInTheDocument();
      });
    });

    it('allows adding multiple tasks', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Add three more tasks (total 4)
      await user.click(fields.addTaskButton);
      await user.click(fields.addTaskButton);
      await user.click(fields.addTaskButton);

      await waitFor(() => {
        expect(screen.getByText(/task 4/i)).toBeInTheDocument();
      });
    });

    it('allows removing tasks', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Add second task
      await user.click(fields.addTaskButton);

      await waitFor(() => {
        expect(screen.getByText(/task 2/i)).toBeInTheDocument();
      });

      // Remove second task
      const task2Fields = getTaskFields(1);
      await user.click(task2Fields.removeButton);

      await waitFor(() => {
        expect(screen.queryByText(/task 2/i)).not.toBeInTheDocument();
      });
    });

    it('prevents removing last task', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const taskFields = getTaskFields(0);
      
      // Remove button should be disabled
      expect(taskFields.removeButton).toBeDisabled();

      // Try to click anyway
      await user.click(taskFields.removeButton);

      // Task should still be there
      expect(screen.getByText(/task 1/i)).toBeInTheDocument();
    });

    it('shows error when trying to add more than 50 tasks', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Add 49 more tasks (total 50)
      for (let i = 0; i < 49; i++) {
        await user.click(fields.addTaskButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/task 50/i)).toBeInTheDocument();
      });

      // Try to add 51st task
      await user.click(fields.addTaskButton);

      await waitFor(() => {
        expect(screen.getByText(/maximum 50 tasks allowed/i)).toBeInTheDocument();
      });
    });

    it('new tasks have default due date of 7 days', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      await user.click(fields.addTaskButton);

      const task2Fields = getTaskFields(1);
      expect(task2Fields.dueDateInput).toHaveValue(7);
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data in create mode', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      const taskFields = getTaskFields(0);

      // Fill in template fields
      await user.type(fields.nameInput, 'New Template');
      await user.type(fields.descriptionInput, 'Template description');

      // Fill in task fields
      await user.type(taskFields.titleInput, 'Task 1');
      await user.type(taskFields.descriptionInput, 'Task 1 description');

      // Submit form
      await user.click(fields.submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          name: 'New Template',
          description: 'Template description',
          tasks: [
            {
              title: 'Task 1',
              description: 'Task 1 description',
              dueDate: 7,
            },
          ],
        });
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('submits form with multiple tasks', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Fill in template fields
      await user.type(fields.nameInput, 'Multi-task Template');
      await user.type(fields.descriptionInput, 'Template with multiple tasks');

      // Fill in first task
      const task1Fields = getTaskFields(0);
      await user.type(task1Fields.titleInput, 'Task 1');
      await user.type(task1Fields.descriptionInput, 'First task');

      // Add and fill second task
      await user.click(fields.addTaskButton);
      const task2Fields = getTaskFields(1);
      await user.type(task2Fields.titleInput, 'Task 2');
      await user.type(task2Fields.descriptionInput, 'Second task');
      await user.clear(task2Fields.dueDateInput);
      await user.type(task2Fields.dueDateInput, '14');

      // Submit form
      await user.click(fields.submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          name: 'Multi-task Template',
          description: 'Template with multiple tasks',
          tasks: [
            {
              title: 'Task 1',
              description: 'First task',
              dueDate: 7,
            },
            {
              title: 'Task 2',
              description: 'Second task',
              dueDate: 14,
            },
          ],
        });
      });
    });

    it('displays loading state during submission', async () => {
      const user = setupUser();
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      
      mockOnSuccess.mockReturnValue(submitPromise);
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      const taskFields = getTaskFields(0);

      // Fill in form
      await user.type(fields.nameInput, 'Test Template');
      await user.type(fields.descriptionInput, 'Test description');
      await user.type(taskFields.titleInput, 'Test Task');
      await user.type(taskFields.descriptionInput, 'Test task description');

      // Submit form
      await user.click(fields.submitButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
        expect(fields.submitButton).toBeDisabled();
        expect(fields.cancelButton).toBeDisabled();
      });

      // Resolve submission
      resolveSubmit!();

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('displays error on submission failure', async () => {
      const user = setupUser();
      const errorMessage = 'Failed to create template';
      mockOnSuccess.mockRejectedValue(new Error(errorMessage));
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      const taskFields = getTaskFields(0);

      // Fill in form
      await user.type(fields.nameInput, 'Test Template');
      await user.type(fields.descriptionInput, 'Test description');
      await user.type(taskFields.titleInput, 'Test Task');
      await user.type(taskFields.descriptionInput, 'Test task description');

      // Submit form
      await user.click(fields.submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('prevents submission with invalid data', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Try to submit without filling required fields
      await user.click(fields.submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/template name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/template description is required/i)).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('hydrates form with initial data', () => {
      render(
        <TemplateForm
          open={true}
          mode="edit"
          initialData={mockInitialData}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      expect(fields.nameInput).toHaveValue(mockInitialData.name);
      expect(fields.descriptionInput).toHaveValue(mockInitialData.description);
    });

    it('hydrates tasks with initial data', () => {
      render(
        <TemplateForm
          open={true}
          mode="edit"
          initialData={mockInitialData}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const task1Fields = getTaskFields(0);
      const task2Fields = getTaskFields(1);

      expect(task1Fields.titleInput).toHaveValue(mockInitialData.tasks[0].title);
      expect(task1Fields.descriptionInput).toHaveValue(mockInitialData.tasks[0].description);
      expect(task1Fields.dueDateInput).toHaveValue(mockInitialData.tasks[0].dueDate);

      expect(task2Fields.titleInput).toHaveValue(mockInitialData.tasks[1].title);
      expect(task2Fields.descriptionInput).toHaveValue(mockInitialData.tasks[1].description);
      expect(task2Fields.dueDateInput).toHaveValue(mockInitialData.tasks[1].dueDate);
    });

    it('submits updated data in edit mode', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="edit"
          initialData={mockInitialData}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Update name
      await user.clear(fields.nameInput);
      await user.type(fields.nameInput, 'Updated Template Name');

      // Submit form
      await user.click(fields.submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Template Name',
          })
        );
      });
    });

    it('shows "Save Changes" button in edit mode', () => {
      render(
        <TemplateForm
          open={true}
          mode="edit"
          initialData={mockInitialData}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('Dialog Behavior', () => {
    it('closes dialog on cancel button click', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      await user.click(fields.cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes dialog on close icon click', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows confirmation when closing with unsaved changes', async () => {
      const user = setupUser();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Make changes
      await user.type(fields.nameInput, 'Test');

      // Try to close
      await user.click(fields.cancelButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('unsaved changes')
      );
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('closes without confirmation when no changes made', async () => {
      const user = setupUser();
      const confirmSpy = vi.spyOn(window, 'confirm');
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      await user.click(fields.cancelButton);

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('resets form when reopened', async () => {
      const user = setupUser();
      const { rerender } = render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Fill in form
      await user.type(fields.nameInput, 'Test Template');

      // Close dialog
      rerender(
        <TemplateForm
          open={false}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Reopen dialog
      rerender(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Form should be reset
      const newFields = getFormFields();
      expect(newFields.nameInput).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby');
    });

    it('marks required fields with aria-required', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();
      
      expect(fields.nameInput).toHaveAttribute('aria-required', 'true');
      expect(fields.descriptionInput).toHaveAttribute('aria-required', 'true');
    });

    it('marks invalid fields with aria-invalid', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Trigger validation
      await user.click(fields.nameInput);
      await user.tab();

      await waitFor(() => {
        expect(fields.nameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = setupUser();
      
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const fields = getFormFields();

      // Tab through fields
      await user.tab();
      expect(fields.nameInput).toHaveFocus();

      await user.tab();
      expect(fields.descriptionInput).toHaveFocus();
    });

    it('has accessible button labels', () => {
      render(
        <TemplateForm
          open={true}
          mode="create"
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel and close dialog/i })).toBeInTheDocument();
    });
  });
});