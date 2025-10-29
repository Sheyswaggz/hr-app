/**
 * ManagerReviewForm Component Tests
 * 
 * Comprehensive test suite for the ManagerReviewForm component that validates:
 * - Form rendering and field display
 * - Employee self-assessment display
 * - Form validation (required fields, text length, rating)
 * - Goal review functionality
 * - Form submission with valid data
 * - Error handling and retry capability
 * - Success message display
 * 
 * @module tests/components/appraisal/ManagerReviewForm
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup';
import { ManagerReviewForm } from '../../../src/components/appraisal/ManagerReviewForm';
import {
  Appraisal,
  AppraisalStatus,
  GoalStatus,
  APPRAISAL_VALIDATION,
} from '../../../src/types/appraisal';

/**
 * Mock appraisal data factory
 */
const createMockAppraisal = (overrides?: Partial<Appraisal>): Appraisal => ({
  id: 'appraisal-1',
  employeeId: 'employee-1',
  employeeName: 'John Doe',
  managerId: 'manager-1',
  managerName: 'Jane Smith',
  reviewPeriodStart: new Date('2025-01-01').toISOString(),
  reviewPeriodEnd: new Date('2025-12-31').toISOString(),
  status: AppraisalStatus.Submitted,
  selfAssessment: 'This is my self-assessment. I have achieved all my goals and exceeded expectations in several areas.',
  selfAssessmentSubmittedAt: new Date('2025-06-15T10:00:00Z').toISOString(),
  managerFeedback: null,
  rating: null,
  goals: [
    {
      id: 'goal-1',
      title: 'Complete Project Alpha',
      description: 'Lead the development of Project Alpha and deliver on time',
      targetDate: new Date('2025-06-30').toISOString(),
      status: GoalStatus.Completed,
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date('2025-06-30').toISOString(),
    },
    {
      id: 'goal-2',
      title: 'Improve Team Collaboration',
      description: 'Implement weekly team sync meetings and improve communication',
      targetDate: new Date('2025-12-31').toISOString(),
      status: GoalStatus.InProgress,
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date('2025-06-15').toISOString(),
    },
  ],
  createdAt: new Date('2025-01-01').toISOString(),
  updatedAt: new Date('2025-06-15').toISOString(),
  ...overrides,
});

/**
 * Mock useAppraisals hook
 */
const mockSubmitReview = vi.fn();
const mockUseAppraisals = {
  submitReview: mockSubmitReview,
  loading: {
    submitReview: false,
  },
  error: {
    submitReview: null,
  },
};

vi.mock('../../../src/hooks/useAppraisals', () => ({
  useAppraisals: () => mockUseAppraisals,
}));

describe('ManagerReviewForm', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockAppraisal = createMockAppraisal();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppraisals.loading.submitReview = false;
    mockUseAppraisals.error.submitReview = null;
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Form Rendering', () => {
    it('renders form fields correctly', () => {
      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Dialog title
      expect(screen.getByText('Manager Review')).toBeInTheDocument();

      // Employee information
      expect(screen.getByText('Employee')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Review period
      expect(screen.getByText('Review Period')).toBeInTheDocument();
      expect(screen.getByText(/January 1, 2025 - December 31, 2025/i)).toBeInTheDocument();

      // Rating field
      expect(screen.getByText('Performance Rating *')).toBeInTheDocument();
      expect(screen.getByLabelText('Performance rating')).toBeInTheDocument();

      // Feedback field
      expect(screen.getByText('Manager Feedback *')).toBeInTheDocument();
      expect(screen.getByLabelText('Manager feedback')).toBeInTheDocument();

      // Action buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
    });

    it('displays employee self-assessment', () => {
      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Employee Self-Assessment')).toBeInTheDocument();
      expect(screen.getByText(mockAppraisal.selfAssessment!)).toBeInTheDocument();
      expect(screen.getByText(/Submitted on June 15, 2025/i)).toBeInTheDocument();
    });

    it('displays message when self-assessment is not submitted', () => {
      const appraisalWithoutSelfAssessment = createMockAppraisal({
        selfAssessment: null,
        selfAssessmentSubmittedAt: null,
      });

      render(
        <ManagerReviewForm
          appraisal={appraisalWithoutSelfAssessment}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Employee has not submitted self-assessment yet.')).toBeInTheDocument();
    });

    it('displays employee goals', () => {
      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Performance Goals')).toBeInTheDocument();
      expect(screen.getByText('Complete Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Improve Team Collaboration')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('displays message when no goals are set', () => {
      const appraisalWithoutGoals = createMockAppraisal({
        goals: [],
      });

      render(
        <ManagerReviewForm
          appraisal={appraisalWithoutGoals}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('No goals have been set for this appraisal period.')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates required rating field', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Great performance this year!');

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      expect(submitButton).toBeDisabled();
    });

    it('validates required feedback field', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]); // 5 stars

      const submitButton = screen.getByRole('button', { name: /submit review/i });
      expect(submitButton).toBeDisabled();
    });

    it('validates feedback text length limit', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const feedbackInput = screen.getByLabelText('Manager feedback');
      const longText = 'a'.repeat(APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH + 1);

      await user.type(feedbackInput, longText);

      // Input should be limited to max length
      expect(feedbackInput).toHaveValue('a'.repeat(APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH));
    });

    it('displays character count for feedback', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const feedbackInput = screen.getByLabelText('Manager feedback');
      const testText = 'Great work!';

      await user.type(feedbackInput, testText);

      const remainingChars = APPRAISAL_VALIDATION.MANAGER_FEEDBACK_MAX_LENGTH - testText.length;
      expect(screen.getByText(`${remainingChars} characters remaining`)).toBeInTheDocument();
    });

    it('validates rating range (1-5)', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const ratingStars = screen.getAllByRole('radio');
      expect(ratingStars).toHaveLength(5);

      // Click 5-star rating
      await user.click(ratingStars[4]);

      await waitFor(() => {
        expect(screen.getByText('5 out of 5 stars')).toBeInTheDocument();
      });
    });

    it('enables submit button when all fields are valid', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]); // 5 stars

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Excellent performance throughout the year. Exceeded all expectations.');

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit review/i });
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Completed,
        managerFeedback: 'Excellent performance throughout the year.',
        rating: 5,
      });

      mockSubmitReview.mockResolvedValueOnce(updatedAppraisal);

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]); // 5 stars

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Excellent performance throughout the year.');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSubmitReview).toHaveBeenCalledWith('appraisal-1', {
          managerFeedback: 'Excellent performance throughout the year.',
          rating: 5,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Review submitted successfully! Closing...')).toBeInTheDocument();
      });
    });

    it('displays loading state during submission', async () => {
      const user = userEvent.setup();

      mockUseAppraisals.loading.submitReview = true;
      mockSubmitReview.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]);

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Great work!');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });
    });

    it('displays error on submission failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to submit review';

      mockSubmitReview.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]);

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Great work!');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Verify retry button is present
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('allows retry after submission failure', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Completed,
        managerFeedback: 'Great work!',
        rating: 5,
      });

      mockSubmitReview
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(updatedAppraisal);

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]);

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Great work!');

      // Submit form (first attempt - fails)
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockSubmitReview).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText('Review submitted successfully! Closing...')).toBeInTheDocument();
      });
    });

    it('displays success message after successful submission', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Completed,
        managerFeedback: 'Excellent work!',
        rating: 5,
      });

      mockSubmitReview.mockResolvedValueOnce(updatedAppraisal);

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[4]);

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Excellent work!');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Review submitted successfully! Closing...')).toBeInTheDocument();
      });
    });

    it('calls onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      const updatedAppraisal = createMockAppraisal({
        status: AppraisalStatus.Completed,
        managerFeedback: 'Great performance!',
        rating: 4,
      });

      mockSubmitReview.mockResolvedValueOnce(updatedAppraisal);

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Select rating
      const ratingStars = screen.getAllByRole('radio');
      await user.click(ratingStars[3]); // 4 stars

      // Enter feedback
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Great performance!');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit review/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(updatedAppraisal);
      }, { timeout: 2000 });
    });
  });

  describe('Dialog Interaction', () => {
    it('closes dialog when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows confirmation when closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Make changes
      const feedbackInput = screen.getByLabelText('Manager feedback');
      await user.type(feedbackInput, 'Some feedback');

      // Try to close
      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to close?'
      );
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('does not render when open is false', () => {
      const { container } = render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={false}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText('Performance rating')).toBeInTheDocument();
      expect(screen.getByLabelText('Manager feedback')).toBeInTheDocument();
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Submit review')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <ManagerReviewForm
          appraisal={mockAppraisal}
          open={true}
          onClose={mockOnClose}
        />
      );

      const feedbackInput = screen.getByLabelText('Manager feedback');
      
      // Tab to feedback input
      await user.tab();
      await user.tab();
      await user.tab();
      
      // Type in feedback
      await user.keyboard('Excellent performance!');

      expect(feedbackInput).toHaveValue('Excellent performance!');
    });
  });
});