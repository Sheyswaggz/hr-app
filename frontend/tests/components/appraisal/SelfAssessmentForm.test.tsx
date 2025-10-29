/**
 * SelfAssessmentForm Component Test Suite
 * 
 * Comprehensive test coverage for the SelfAssessmentForm component including:
 * - Form rendering and field validation
 * - Character limit validation (5000 chars)
 * - Goal management (add/edit/remove)
 * - Form submission with valid data
 * - Error handling and display
 * - Success message display
 * - Loading states
 * - Accessibility compliance
 * 
 * @module tests/components/appraisal/SelfAssessmentForm.test
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SelfAssessmentForm } from '../../../src/components/appraisal/SelfAssessmentForm';
import { Appraisal, AppraisalStatus, GoalStatus } from '../../../src/types/appraisal';
import * as useAppraisalsHook from '../../../src/hooks/useAppraisals';

/**
 * Mock the useAppraisals hook
 */
vi.mock('../../../src/hooks/useAppraisals');

/**
 * Test data factory for creating mock appraisals
 */
const createMockAppraisal = (overrides?: Partial<Appraisal>): Appraisal => ({
  id: 'appraisal-1',
  employeeId: 'employee-1',
  employeeName: 'John Doe',
  reviewerId: 'manager-1',
  reviewerName: 'Jane Manager',
  reviewPeriodStart: '2025-01-01T00:00:00.000Z',
  reviewPeriodEnd: '2025-12-31T23:59:59.999Z',
  status: AppraisalStatus.Draft,
  selfAssessment: null,
  managerFeedback: null,
  rating: null,
  goals: [],
  selfAssessmentSubmittedAt: null,
  reviewCompletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Default mock implementation for useAppraisals hook
 */
const createMockUseAppraisals = (overrides?: Partial<ReturnType<typeof useAppraisalsHook.useAppraisals>>) => ({
  appraisals: [],
  myAppraisals: [],
  teamAppraisals: [],
  loading: {
    list: false,
    create: false,
    submitAssessment: false,
    submitReview: false,
  },
  error: {
    list: null,
    create: null,
    submitAssessment: null,
    submitReview: null,
  },
  createAppraisal: vi.fn(),
  submitSelfAssessment: vi.fn(),
  submitManagerReview: vi.fn(),
  fetchAppraisals: vi.fn(),
  fetchMyAppraisals: vi.fn(),
  fetchTeamAppraisals: vi.fn(),
  ...overrides,
});

describe('SelfAssessmentForm', () => {
  let mockUseAppraisals: ReturnType<typeof createMockUseAppraisals>;
  let mockAppraisal: Appraisal;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh mock instances
    mockAppraisal = createMockAppraisal();
    mockOnClose = vi.fn();
    mockOnSuccess = vi.fn();

    // Setup default mock implementation
    mockUseAppraisals = createMockUseAppraisals();
    vi.mocked(useAppraisalsHook.useAppraisals).mockReturnValue(mockUseAppraisals);

    console.info('[SelfAssessmentForm.test] Test setup complete', {
      testName: expect.getState().currentTestName,
      timestamp: new Date().toISOString(),
    });
  });

  afterEach(() => {
    console.info('[SelfAssessmentForm.test] Test cleanup', {
      testName: expect.getState().currentTestName,
      timestamp: new Date().toISOString(),
    });
  });

  describe('Form Rendering', () => {
    it('renders form fields correctly', () => {
      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Verify dialog is rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Submit Self-Assessment')).toBeInTheDocument();

      // Verify appraisal information is displayed
      expect(screen.getByText('Appraisal Information')).toBeInTheDocument();
      expect(screen.getByText('Jane Manager')).toBeInTheDocument();

      // Verify self-assessment field
      expect(screen.getByLabelText(/self-assessment/i)).toBeInTheDocument();

      // Verify goals section
      expect(screen.getByText('Goals')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add goal/i })).toBeInTheDocument();

      // Verify action buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit self-assessment/i })).toBeInTheDocument();

      console.debug('[SelfAssessmentForm.test] Form rendered successfully');
    });

    it('displays existing self-assessment when present', () => {
      const existingAssessment = 'This is my existing self-assessment text.';
      const appraisalWithAssessment = createMockAppraisal({
        selfAssessment: existingAssessment,
      });

      render(
        <SelfAssessmentForm
          appraisal={appraisalWithAssessment}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textField = screen.getByLabelText(/self-assessment/i) as HTMLTextAreaElement;
      expect(textField.value).toBe(existingAssessment);

      console.debug('[SelfAssessmentForm.test] Existing assessment displayed');
    });

    it('displays existing goals when present', () => {
      const appraisalWithGoals = createMockAppraisal({
        goals: [
          {
            id: 'goal-1',
            title: 'Improve TypeScript skills',
            description: 'Complete advanced TypeScript course',
            targetDate: '2025-06-30T00:00:00.000Z',
            status: GoalStatus.IN_PROGRESS,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      render(
        <SelfAssessmentForm
          appraisal={appraisalWithGoals}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByDisplayValue('Improve TypeScript skills')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Complete advanced TypeScript course')).toBeInTheDocument();

      console.debug('[SelfAssessmentForm.test] Existing goals displayed');
    });

    it('does not render when open is false', () => {
      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      console.debug('[SelfAssessmentForm.test] Dialog hidden when closed');
    });
  });

  describe('Field Validation', () => {
    it('validates required self-assessment field', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Try to submit without entering assessment
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation error is displayed
      await waitFor(() => {
        expect(screen.getByText(/self-assessment is required/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Required field validation working');
    });

    it('validates self-assessment text length limit (5000 chars)', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textField = screen.getByLabelText(/self-assessment/i);
      const longText = 'a'.repeat(5001);

      await user.clear(textField);
      await user.type(textField, longText);

      // Verify character count is displayed
      await waitFor(() => {
        expect(screen.getByText(/5001 \/ 5000 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/exceeds limit/i)).toBeInTheDocument();
      });

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/must not exceed 5000 characters/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Character limit validation working');
    });

    it('shows character count as text is entered', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textField = screen.getByLabelText(/self-assessment/i);
      const testText = 'This is a test assessment.';

      await user.clear(textField);
      await user.type(textField, testText);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${testText.length} / 5000 characters`, 'i'))).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Character count updates correctly');
    });

    it('validates empty self-assessment (whitespace only)', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const textField = screen.getByLabelText(/self-assessment/i);
      await user.clear(textField);
      await user.type(textField, '   ');

      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/self-assessment cannot be empty/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Whitespace validation working');
    });
  });

  describe('Goal Management', () => {
    it('allows adding a new goal', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Initially no goals
      expect(screen.getByText(/no goals added yet/i)).toBeInTheDocument();

      // Click add goal button
      const addButton = screen.getByRole('button', { name: /add goal/i });
      await user.click(addButton);

      // Verify goal form appears
      await waitFor(() => {
        expect(screen.getByLabelText(/goal title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/goal description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/target date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Goal added successfully');
    });

    it('allows editing goal fields', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Fill in goal details
      const titleField = screen.getByLabelText(/goal title/i);
      const descriptionField = screen.getByLabelText(/goal description/i);
      const targetDateField = screen.getByLabelText(/target date/i);

      await user.type(titleField, 'Learn React Testing');
      await user.type(descriptionField, 'Master React Testing Library and write comprehensive tests');
      await user.type(targetDateField, '2025-06-30');

      // Verify values are set
      expect(titleField).toHaveValue('Learn React Testing');
      expect(descriptionField).toHaveValue('Master React Testing Library and write comprehensive tests');
      expect(targetDateField).toHaveValue('2025-06-30');

      console.debug('[SelfAssessmentForm.test] Goal fields edited successfully');
    });

    it('allows removing a goal', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Verify goal form is present
      expect(screen.getByLabelText(/goal title/i)).toBeInTheDocument();

      // Click remove button
      const removeButton = screen.getByRole('button', { name: /remove goal 1/i });
      await user.click(removeButton);

      // Verify goal is removed
      await waitFor(() => {
        expect(screen.queryByLabelText(/goal title/i)).not.toBeInTheDocument();
        expect(screen.getByText(/no goals added yet/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Goal removed successfully');
    });

    it('validates required goal fields', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add self-assessment text
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'Valid self-assessment text');

      // Add a goal but leave fields empty
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation errors for goal fields
      await waitFor(() => {
        expect(screen.getByText(/goal title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/goal description is required/i)).toBeInTheDocument();
        expect(screen.getByText(/target date is required/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Goal field validation working');
    });

    it('validates goal title length', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Enter title exceeding max length (200 chars)
      const titleField = screen.getByLabelText(/goal title/i);
      const longTitle = 'a'.repeat(201);
      await user.type(titleField, longTitle);

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/title must not exceed 200 characters/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Goal title length validation working');
    });

    it('validates goal description length', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Enter description exceeding max length (1000 chars)
      const descriptionField = screen.getByLabelText(/goal description/i);
      const longDescription = 'a'.repeat(1001);
      await user.type(descriptionField, longDescription);

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/description must not exceed 1000 characters/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Goal description length validation working');
    });

    it('validates target date is not in the past', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Enter past date
      const targetDateField = screen.getByLabelText(/target date/i);
      await user.type(targetDateField, '2020-01-01');

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/target date must be today or in the future/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Target date validation working');
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Submitted,
        selfAssessment: 'My self-assessment',
      });

      mockUseAppraisals.submitSelfAssessment.mockResolvedValue(updatedAppraisal);

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in self-assessment
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment for this review period');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify API was called
      await waitFor(() => {
        expect(mockUseAppraisals.submitSelfAssessment).toHaveBeenCalledWith(
          mockAppraisal.id,
          expect.objectContaining({
            selfAssessment: 'My self-assessment for this review period',
            goals: [],
          })
        );
      });

      // Verify success callback was called
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(updatedAppraisal);
      });

      console.debug('[SelfAssessmentForm.test] Form submitted successfully');
    });

    it('submits form with goals', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Submitted,
        selfAssessment: 'My self-assessment',
        goals: [
          {
            id: 'goal-1',
            title: 'Learn TypeScript',
            description: 'Complete TypeScript course',
            targetDate: '2025-06-30T00:00:00.000Z',
            status: GoalStatus.NOT_STARTED,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      mockUseAppraisals.submitSelfAssessment.mockResolvedValue(updatedAppraisal);

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in self-assessment
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment');

      // Add a goal
      await user.click(screen.getByRole('button', { name: /add goal/i }));

      // Fill in goal details
      await user.type(screen.getByLabelText(/goal title/i), 'Learn TypeScript');
      await user.type(screen.getByLabelText(/goal description/i), 'Complete TypeScript course');
      await user.type(screen.getByLabelText(/target date/i), '2025-06-30');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify API was called with goals
      await waitFor(() => {
        expect(mockUseAppraisals.submitSelfAssessment).toHaveBeenCalledWith(
          mockAppraisal.id,
          expect.objectContaining({
            selfAssessment: 'My self-assessment',
            goals: expect.arrayContaining([
              expect.objectContaining({
                title: 'Learn TypeScript',
                description: 'Complete TypeScript course',
                status: GoalStatus.NOT_STARTED,
              }),
            ]),
          })
        );
      });

      console.debug('[SelfAssessmentForm.test] Form with goals submitted successfully');
    });

    it('displays loading state during submission', async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      mockUseAppraisals.submitSelfAssessment.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockAppraisal()), 1000))
      );
      mockUseAppraisals.loading.submitAssessment = true;

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in self-assessment
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      console.debug('[SelfAssessmentForm.test] Loading state displayed');
    });

    it('displays success message after submission', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Submitted,
      });

      mockUseAppraisals.submitSelfAssessment.mockResolvedValue(updatedAppraisal);

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill and submit
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment');

      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify success message
      await waitFor(() => {
        expect(screen.getByText(/self-assessment submitted successfully/i)).toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Success message displayed');
    });
  });

  describe('Error Handling', () => {
    it('displays error message on submission failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to submit self-assessment';

      mockUseAppraisals.submitSelfAssessment.mockRejectedValue(new Error(errorMessage));

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill and submit
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment');

      const submitButton = screen.getByRole('button', { name: /submit self-assessment/i });
      await user.click(submitButton);

      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Verify onSuccess was not called
      expect(mockOnSuccess).not.toHaveBeenCalled();

      console.debug('[SelfAssessmentForm.test] Error message displayed');
    });

    it('displays error from hook error state', () => {
      const errorMessage = 'Network error occurred';
      mockUseAppraisals.error.submitAssessment = new Error(errorMessage);

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();

      console.debug('[SelfAssessmentForm.test] Hook error displayed');
    });

    it('allows dismissing error message', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Submission failed';

      mockUseAppraisals.submitSelfAssessment.mockRejectedValue(new Error(errorMessage));

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Trigger error
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'My self-assessment');
      await user.click(screen.getByRole('button', { name: /submit self-assessment/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Dismiss error
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Verify error is dismissed
      await waitFor(() => {
        expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
      });

      console.debug('[SelfAssessmentForm.test] Error dismissed successfully');
    });
  });

  describe('Dialog Behavior', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);

      console.debug('[SelfAssessmentForm.test] Cancel button works');
    });

    it('calls onClose when close icon is clicked', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);

      console.debug('[SelfAssessmentForm.test] Close icon works');
    });

    it('shows confirmation when closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Make changes
      const assessmentField = screen.getByLabelText(/self-assessment/i);
      await user.type(assessmentField, 'Some changes');

      // Try to close
      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      // Verify confirmation was shown
      expect(confirmSpy).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();

      console.debug('[SelfAssessmentForm.test] Confirmation shown for unsaved changes');
    });

    it('closes without confirmation when no changes made', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Close without making changes
      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      // Verify no confirmation shown
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();

      confirmSpy.mockRestore();

      console.debug('[SelfAssessmentForm.test] Closes without confirmation when pristine');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'self-assessment-dialog-title');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'self-assessment-dialog-description');

      console.debug('[SelfAssessmentForm.test] ARIA labels present');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/close/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/self-assessment/i)).toHaveFocus();

      console.debug('[SelfAssessmentForm.test] Keyboard navigation works');
    });

    it('has descriptive button labels', () => {
      render(
        <SelfAssessmentForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: /add new goal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel and close dialog/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit self-assessment/i })).toBeInTheDocument();

      console.debug('[SelfAssessmentForm.test] Descriptive button labels present');
    });
  });
});