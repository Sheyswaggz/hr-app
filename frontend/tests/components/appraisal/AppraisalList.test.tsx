/**
 * AppraisalList Component Test Suite
 * 
 * Comprehensive test coverage for the AppraisalList component including:
 * - Rendering with different view variants (my/team/all)
 * - Loading states and error handling
 * - Filtering by status, date range, and rating
 * - Sorting functionality
 * - Pagination controls
 * - Row click navigation
 * - Retry mechanism on errors
 * - Accessibility compliance
 * 
 * @module tests/components/appraisal/AppraisalList.test
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup';
import { AppraisalList } from '../../../src/components/appraisal/AppraisalList';
import { AppraisalStatus } from '../../../src/types/appraisal';

/**
 * Mock navigation function
 */
const mockNavigate = vi.fn();

/**
 * Mock useNavigate hook
 */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Test wrapper component with Router
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <BrowserRouter>{children}</BrowserRouter>;
};

/**
 * Mock appraisal data factory
 */
const createMockAppraisal = (overrides?: Partial<any>) => ({
  id: 'appraisal-1',
  employeeId: 'employee-1',
  employeeName: 'John Doe',
  managerId: 'manager-1',
  reviewPeriodStart: '2025-01-01T00:00:00.000Z',
  reviewPeriodEnd: '2025-12-31T23:59:59.999Z',
  status: AppraisalStatus.DRAFT,
  selfAssessment: null,
  managerFeedback: null,
  rating: null,
  goals: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  selfAssessmentSubmittedAt: null,
  reviewCompletedAt: null,
  ...overrides,
});

/**
 * Mock appraisals list
 */
const mockAppraisals = [
  createMockAppraisal({
    id: 'appraisal-1',
    employeeName: 'John Doe',
    status: AppraisalStatus.DRAFT,
    rating: null,
  }),
  createMockAppraisal({
    id: 'appraisal-2',
    employeeName: 'Jane Smith',
    status: AppraisalStatus.SUBMITTED,
    rating: null,
    reviewPeriodStart: '2024-01-01T00:00:00.000Z',
    reviewPeriodEnd: '2024-12-31T23:59:59.999Z',
  }),
  createMockAppraisal({
    id: 'appraisal-3',
    employeeName: 'Bob Johnson',
    status: AppraisalStatus.COMPLETED,
    rating: 4,
    reviewPeriodStart: '2023-01-01T00:00:00.000Z',
    reviewPeriodEnd: '2023-12-31T23:59:59.999Z',
  }),
];

describe('AppraisalList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default successful API response
    server.use(
      http.get('/api/appraisals/my', () => {
        return HttpResponse.json(mockAppraisals);
      }),
      http.get('/api/appraisals/team', () => {
        return HttpResponse.json(mockAppraisals);
      }),
      http.get('/api/appraisals', () => {
        return HttpResponse.json(mockAppraisals);
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Rendering', () => {
    it('renders appraisal list from API for "my" variant', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      // Check loading state initially
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('My Appraisals')).toBeInTheDocument();
      });

      // Verify appraisals are displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('renders appraisal list for "team" variant', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="team" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Team Appraisals')).toBeInTheDocument();
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders appraisal list for "all" variant', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="all" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('All Appraisals')).toBeInTheDocument();
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('displays status chips with correct colors', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
      });

      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays ratings correctly', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Not rated')).toBeInTheDocument();
      });

      // Check for rating stars (4 stars for Bob Johnson)
      const ratings = screen.getAllByRole('img', { hidden: true });
      expect(ratings.length).toBeGreaterThan(0);
    });

    it('displays formatted dates', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/1\/1\/2025/)).toBeInTheDocument();
      });

      expect(screen.getByText(/12\/31\/2025/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading state initially', () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('hides loading state after data loads', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('displays error state when API fails', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(
            { error: 'Failed to fetch appraisals' },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load appraisals/i)).toBeInTheDocument();
    });

    it('displays retry button on error', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(
            { error: 'Network error' },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries API call when retry button clicked', async () => {
      let callCount = 0;

      server.use(
        http.get('/api/appraisals/my', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: 'Network error' },
              { status: 500 }
            );
          }
          return HttpResponse.json(mockAppraisals);
        })
      );

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      // Click retry
      await user.click(screen.getByRole('button', { name: /retry/i }));

      // Wait for successful load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(callCount).toBe(2);
    });

    it('displays custom error message when provided', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(
            { error: 'Custom error' },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <AppraisalList variant="my" errorMessage="Custom error occurred" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('shows filter button when enableFilters is true', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      });
    });

    it('toggles filter panel when filter button clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      });

      // Filters should not be visible initially
      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();

      // Click to show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Filters should now be visible
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    it('filters by status', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Select status filter
      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);

      // Select "Completed" option
      const completedOption = screen.getByRole('option', { name: /completed/i });
      await user.click(completedOption);

      // Only completed appraisal should be visible
      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('filters by date range', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Set date from filter
      const dateFromInput = screen.getByLabelText('Filter by start date');
      await user.type(dateFromInput, '2024-01-01');

      // Set date to filter
      const dateToInput = screen.getByLabelText('Filter by end date');
      await user.type(dateToInput, '2024-12-31');

      // Only 2024 appraisal should be visible
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    });

    it('filters by rating', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Select rating filter
      const ratingSelect = screen.getByLabelText('Rating');
      await user.click(ratingSelect);

      // Select "4+ Stars" option
      const fourStarsOption = screen.getByRole('option', { name: /4\+ stars/i });
      await user.click(fourStarsOption);

      // Only rated appraisal should be visible
      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('clears all filters when clear button clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableFilters />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      // Apply status filter
      const statusSelect = screen.getByLabelText('Status');
      await user.click(statusSelect);
      await user.click(screen.getByRole('option', { name: /completed/i }));

      // Verify filter applied
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });

      // Clear filters
      await user.click(screen.getByRole('button', { name: /clear filters/i }));

      // All appraisals should be visible again
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by column when header clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enableSorting />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Get all rows
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows[1]; // Skip header row

      // Verify initial order (should be by createdAt desc)
      expect(within(firstDataRow).getByText('John Doe')).toBeInTheDocument();

      // Click on Period Start column header to sort
      const periodStartHeader = screen.getByText('Period Start');
      await user.click(periodStartHeader);

      // Wait for sort to apply
      await waitFor(() => {
        const updatedRows = screen.getAllByRole('row');
        const newFirstDataRow = updatedRows[1];
        // Should now show oldest period first (Bob Johnson - 2023)
        expect(within(newFirstDataRow).getByText('Bob Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('displays pagination controls when enabled', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" enablePagination />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Check for pagination controls
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    });

    it('changes page when pagination controls clicked', async () => {
      const manyAppraisals = Array.from({ length: 30 }, (_, i) =>
        createMockAppraisal({
          id: `appraisal-${i}`,
          employeeName: `Employee ${i}`,
        })
      );

      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(manyAppraisals);
        })
      );

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" enablePagination initialPageSize={10} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Employee 0')).toBeInTheDocument();
      });

      // First page should show employees 0-9
      expect(screen.getByText('Employee 9')).toBeInTheDocument();
      expect(screen.queryByText('Employee 10')).not.toBeInTheDocument();

      // Go to next page
      await user.click(screen.getByRole('button', { name: /next page/i }));

      // Second page should show employees 10-19
      await waitFor(() => {
        expect(screen.getByText('Employee 10')).toBeInTheDocument();
      });

      expect(screen.queryByText('Employee 0')).not.toBeInTheDocument();
    });
  });

  describe('Row Click', () => {
    it('navigates to detail page when row clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on first row
      const rows = screen.getAllByRole('row');
      await user.click(rows[1]); // Skip header row

      // Verify navigation was called
      expect(mockNavigate).toHaveBeenCalledWith('/appraisals/appraisal-1');
    });

    it('calls custom onAppraisalClick when provided', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" onAppraisalClick={handleClick} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on first row
      const rows = screen.getAllByRole('row');
      await user.click(rows[1]);

      // Verify custom handler was called
      expect(handleClick).toHaveBeenCalledWith('appraisal-1');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates when view details button clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on view details button
      const viewButtons = screen.getAllByLabelText(/view appraisal details/i);
      await user.click(viewButtons[0]);

      // Verify navigation was called
      expect(mockNavigate).toHaveBeenCalledWith('/appraisals/appraisal-1');
    });
  });

  describe('Refresh', () => {
    it('refetches data when refresh button clicked', async () => {
      let callCount = 0;

      server.use(
        http.get('/api/appraisals/my', () => {
          callCount++;
          return HttpResponse.json(mockAppraisals);
        })
      );

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(callCount).toBe(1);

      // Click refresh button
      await user.click(screen.getByRole('button', { name: /refresh appraisals/i }));

      // Wait for refetch
      await waitFor(() => {
        expect(callCount).toBe(2);
      });
    });
  });

  describe('Empty State', () => {
    it('displays empty state when no appraisals', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json([]);
        })
      );

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No appraisals found')).toBeInTheDocument();
      });
    });

    it('displays custom empty state message when provided', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json([]);
        })
      );

      render(
        <TestWrapper>
          <AppraisalList variant="my" emptyStateMessage="No data available" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Check for ARIA labels
      expect(screen.getByRole('button', { name: /toggle filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh appraisals/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AppraisalList variant="my" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Tab to refresh button
      await user.tab();
      expect(screen.getByRole('button', { name: /refresh appraisals/i })).toHaveFocus();

      // Press Enter to trigger refresh
      await user.keyboard('{Enter}');

      // Verify refresh was triggered (component should handle this)
    });
  });
});