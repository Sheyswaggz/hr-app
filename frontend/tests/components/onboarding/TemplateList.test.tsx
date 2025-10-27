/**
 * TemplateList Component Test Suite
 * 
 * Comprehensive tests for the TemplateList component covering:
 * - Template list rendering from API
 * - Loading states
 * - Error states with retry functionality
 * - Create template action
 * - Edit template action
 * - Delete template action
 * - Pagination functionality
 * - Search functionality
 * - Accessibility compliance
 * 
 * @module tests/components/onboarding/TemplateList.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup';
import { TemplateList } from '../../../src/components/onboarding/TemplateList';
import type { Template } from '../../../src/api/onboarding';

/**
 * Mock template data factory
 */
const createMockTemplate = (overrides?: Partial<Template>): Template => ({
  id: `template-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Onboarding Template',
  description: 'Standard onboarding process for new employees',
  tasks: [
    {
      title: 'Complete Profile',
      description: 'Fill in personal information',
      dueInDays: 1,
    },
    {
      title: 'Review Policies',
      description: 'Read and acknowledge company policies',
      dueInDays: 3,
    },
  ],
  createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
  createdBy: 'hr-admin-id',
  ...overrides,
});

/**
 * Mock templates list
 */
const mockTemplates: Template[] = [
  createMockTemplate({
    id: 'template-1',
    name: 'Engineering Onboarding',
    description: 'Onboarding process for engineering team members',
    tasks: [
      { title: 'Setup Development Environment', description: 'Install required tools', dueInDays: 1 },
      { title: 'Complete Security Training', description: 'Review security protocols', dueInDays: 2 },
      { title: 'Meet the Team', description: 'Introduction to team members', dueInDays: 3 },
    ],
  }),
  createMockTemplate({
    id: 'template-2',
    name: 'Sales Onboarding',
    description: 'Onboarding process for sales team members',
    tasks: [
      { title: 'Product Training', description: 'Learn about products', dueInDays: 2 },
      { title: 'CRM Setup', description: 'Configure CRM access', dueInDays: 1 },
    ],
  }),
  createMockTemplate({
    id: 'template-3',
    name: 'Marketing Onboarding',
    description: 'Onboarding process for marketing team members',
    tasks: [
      { title: 'Brand Guidelines', description: 'Review brand standards', dueInDays: 1 },
    ],
  }),
];

/**
 * Setup MSW handlers for template API
 */
const setupSuccessHandlers = (templates: Template[] = mockTemplates) => {
  server.use(
    http.get('/api/onboarding/templates', () => {
      return HttpResponse.json({
        data: templates,
        total: templates.length,
        page: 1,
        limit: 10,
      });
    })
  );
};

const setupErrorHandler = (statusCode: number = 500, message: string = 'Internal Server Error') => {
  server.use(
    http.get('/api/onboarding/templates', () => {
      return HttpResponse.json(
        {
          error: message,
          code: 'SERVER_ERROR',
          statusCode,
          timestamp: new Date().toISOString(),
        },
        { status: statusCode }
      );
    })
  );
};

const setupDeleteHandler = (shouldFail: boolean = false) => {
  server.use(
    http.delete('/api/onboarding/templates/:id', ({ params }) => {
      if (shouldFail) {
        return HttpResponse.json(
          {
            error: 'Failed to delete template',
            code: 'DELETE_ERROR',
            statusCode: 500,
          },
          { status: 500 }
        );
      }

      return HttpResponse.json(
        { message: 'Template deleted successfully' },
        { status: 200 }
      );
    })
  );
};

describe('TemplateList Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Template List Rendering', () => {
    it('renders template list from API successfully', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      // Verify loading state appears initially
      expect(screen.getByText(/onboarding templates/i)).toBeInTheDocument();

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Verify all templates are rendered
      expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Sales Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Marketing Onboarding')).toBeInTheDocument();

      // Verify descriptions are shown
      expect(screen.getByText(/onboarding process for engineering team members/i)).toBeInTheDocument();
      expect(screen.getByText(/onboarding process for sales team members/i)).toBeInTheDocument();

      // Verify task counts are displayed
      const taskChips = screen.getAllByText(/3|2|1/);
      expect(taskChips.length).toBeGreaterThan(0);
    });

    it('renders empty state when no templates exist', async () => {
      setupSuccessHandlers([]);

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText(/no templates available/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/create your first template to get started/i)).toBeInTheDocument();
    });

    it('displays template metadata correctly', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Verify created date is formatted
      const dateElements = screen.getAllByText(/1\/1\/2025/);
      expect(dateElements.length).toBeGreaterThan(0);

      // Verify task count chips
      expect(screen.getByText('3')).toBeInTheDocument(); // Engineering has 3 tasks
      expect(screen.getByText('2')).toBeInTheDocument(); // Sales has 2 tasks
      expect(screen.getByText('1')).toBeInTheDocument(); // Marketing has 1 task
    });
  });

  describe('Loading State', () => {
    it('displays loading skeleton while fetching templates', () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      // Verify skeleton elements are present
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('removes loading state after data loads', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Verify no skeleton elements remain
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBe(0);
    });

    it('disables actions during loading', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      // Create button should be disabled during initial load
      const createButton = screen.getByRole('button', { name: /create new template/i });
      expect(createButton).toBeDisabled();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Create button should be enabled after load
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('displays error message when API fails', async () => {
      setupErrorHandler(500, 'Failed to fetch templates');

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch templates/i)).toBeInTheDocument();
      });

      // Verify error code is displayed
      expect(screen.getByText(/error code: 500/i)).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      setupErrorHandler();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('retries fetching templates when retry button clicked', async () => {
      let callCount = 0;
      server.use(
        http.get('/api/onboarding/templates', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: 'Server error', code: 'ERROR', statusCode: 500 },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            data: mockTemplates,
            total: mockTemplates.length,
            page: 1,
            limit: 10,
          });
        })
      );

      render(<TemplateList />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Verify templates load after retry
      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      expect(callCount).toBe(2);
    });

    it('allows dismissing error alert', async () => {
      setupErrorHandler();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });

      // Find and click close button on alert
      const alert = screen.getByRole('alert');
      const closeButton = within(alert).getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Error should be dismissed
      await waitFor(() => {
        expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Create Template Action', () => {
    it('calls onCreateClick when create button clicked', async () => {
      setupSuccessHandlers();
      const onCreateClick = vi.fn();

      render(<TemplateList onCreateClick={onCreateClick} />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new template/i });
      await user.click(createButton);

      expect(onCreateClick).toHaveBeenCalledTimes(1);
    });

    it('displays create button with correct label', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new template/i });
      expect(createButton).toBeInTheDocument();
      expect(within(createButton).getByText(/create template/i)).toBeInTheDocument();
    });
  });

  describe('Edit Template Action', () => {
    it('calls onEditClick with template when edit button clicked', async () => {
      setupSuccessHandlers();
      const onEditClick = vi.fn();

      render(<TemplateList onEditClick={onEditClick} />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Find edit button for first template
      const editButtons = screen.getAllByLabelText(/edit/i);
      await user.click(editButtons[0]);

      expect(onEditClick).toHaveBeenCalledTimes(1);
      expect(onEditClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'template-1',
          name: 'Engineering Onboarding',
        })
      );
    });

    it('displays edit button for each template', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByLabelText(/edit/i);
      expect(editButtons).toHaveLength(mockTemplates.length);
    });

    it('disables edit button during delete operation', async () => {
      setupSuccessHandlers();
      setupDeleteHandler();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);

      // Edit button should be disabled during delete
      const editButtons = screen.getAllByLabelText(/edit/i);
      expect(editButtons[0]).toBeDisabled();
    });
  });

  describe('Delete Template Action', () => {
    it('calls onDeleteConfirm when delete succeeds', async () => {
      setupSuccessHandlers();
      setupDeleteHandler();
      const onDeleteConfirm = vi.fn();

      render(<TemplateList onDeleteConfirm={onDeleteConfirm} />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Click delete button for first template
      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(onDeleteConfirm).toHaveBeenCalledWith('template-1');
      });
    });

    it('displays delete button for each template', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete/i);
      expect(deleteButtons).toHaveLength(mockTemplates.length);
    });

    it('disables delete button during operation', async () => {
      setupSuccessHandlers();
      setupDeleteHandler();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);

      // Button should be disabled during delete
      expect(deleteButtons[0]).toBeDisabled();
    });

    it('handles delete error gracefully', async () => {
      setupSuccessHandlers();
      setupDeleteHandler(true);

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete/i);
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  describe('Pagination', () => {
    it('displays pagination controls', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Verify pagination controls exist
      const pagination = document.querySelector('.MuiTablePagination-root');
      expect(pagination).toBeInTheDocument();
    });

    it('changes page when pagination controls used', async () => {
      const manyTemplates = Array.from({ length: 25 }, (_, i) =>
        createMockTemplate({
          id: `template-${i}`,
          name: `Template ${i}`,
        })
      );

      setupSuccessHandlers(manyTemplates);

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Template 0')).toBeInTheDocument();
      });

      // Find next page button
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Verify page changed
      await waitFor(() => {
        expect(screen.getByText('Template 10')).toBeInTheDocument();
      });
    });

    it('displays correct page size options', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Find rows per page selector
      const rowsPerPage = screen.getByRole('combobox', { name: /rows per page/i });
      expect(rowsPerPage).toBeInTheDocument();
    });

    it('updates results when page size changed', async () => {
      const manyTemplates = Array.from({ length: 25 }, (_, i) =>
        createMockTemplate({
          id: `template-${i}`,
          name: `Template ${i}`,
        })
      );

      setupSuccessHandlers(manyTemplates);

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Template 0')).toBeInTheDocument();
      });

      // Change page size
      const rowsPerPage = screen.getByRole('combobox', { name: /rows per page/i });
      await user.click(rowsPerPage);

      const option25 = screen.getByRole('option', { name: '25' });
      await user.click(option25);

      // Verify more items are shown
      await waitFor(() => {
        expect(screen.getByText('Template 24')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters templates by name', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'Engineering');

      // Verify filtered results
      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
        expect(screen.queryByText('Sales Onboarding')).not.toBeInTheDocument();
        expect(screen.queryByText('Marketing Onboarding')).not.toBeInTheDocument();
      });
    });

    it('filters templates by description', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'sales team');

      await waitFor(() => {
        expect(screen.getByText('Sales Onboarding')).toBeInTheDocument();
        expect(screen.queryByText('Engineering Onboarding')).not.toBeInTheDocument();
      });
    });

    it('shows no results message when search has no matches', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'nonexistent template');

      await waitFor(() => {
        expect(screen.getByText(/no templates match your search/i)).toBeInTheDocument();
      });
    });

    it('resets pagination when searching', async () => {
      const manyTemplates = Array.from({ length: 25 }, (_, i) =>
        createMockTemplate({
          id: `template-${i}`,
          name: i < 5 ? `Engineering Template ${i}` : `Template ${i}`,
        })
      );

      setupSuccessHandlers(manyTemplates);

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Template 0')).toBeInTheDocument();
      });

      // Go to page 2
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Search should reset to page 1
      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'Engineering');

      await waitFor(() => {
        expect(screen.getByText('Engineering Template 0')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('refetches templates when refresh button clicked', async () => {
      let callCount = 0;
      server.use(
        http.get('/api/onboarding/templates', () => {
          callCount++;
          return HttpResponse.json({
            data: mockTemplates,
            total: mockTemplates.length,
            page: 1,
            limit: 10,
          });
        })
      );

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      expect(callCount).toBe(1);

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh templates/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(callCount).toBe(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on buttons', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /create new template/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh templates/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/search templates/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new template/i });
      createButton.focus();
      expect(document.activeElement).toBe(createButton);
    });

    it('has proper table semantics', async () => {
      setupSuccessHandlers();

      render(<TemplateList />);

      await waitFor(() => {
        expect(screen.getByText('Engineering Onboarding')).toBeInTheDocument();
      });

      const table = screen.getByRole('grid');
      expect(table).toBeInTheDocument();
    });
  });
});