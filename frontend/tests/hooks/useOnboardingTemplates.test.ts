/**
 * Test Suite: useOnboardingTemplates Hook
 * 
 * Comprehensive test coverage for the useOnboardingTemplates custom React hook.
 * Tests all CRUD operations, loading states, error handling, optimistic updates,
 * and retry functionality with proper cleanup and isolation.
 * 
 * Coverage:
 * - Initial fetch on mount
 * - Loading state management
 * - Error state handling
 * - Create template operation
 * - Update template operation
 * - Delete template operation
 * - Refetch functionality
 * - Retry failed operations
 * - Cleanup on unmount
 * 
 * @module tests/hooks/useOnboardingTemplates
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { useOnboardingTemplates } from '../../src/hooks/useOnboardingTemplates';
import type { Template, CreateTemplateRequest, UpdateTemplateRequest } from '../../src/api/onboarding';

/**
 * Mock template data factory
 */
const createMockTemplate = (overrides?: Partial<Template>): Template => ({
  id: 'template-1',
  name: 'New Employee Onboarding',
  description: 'Standard onboarding process for new employees',
  tasks: [
    {
      title: 'Complete Profile',
      description: 'Fill in personal information',
      dueInDays: 1,
      order: 1,
    },
    {
      title: 'Review Company Policies',
      description: 'Read and acknowledge company policies',
      dueInDays: 3,
      order: 2,
    },
  ],
  isActive: true,
  createdBy: 'hr-admin-1',
  createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
  ...overrides,
});

const createMockTemplates = (count: number): Template[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockTemplate({
      id: `template-${index + 1}`,
      name: `Template ${index + 1}`,
      description: `Description for template ${index + 1}`,
    })
  );
};

describe('useOnboardingTemplates', () => {
  /**
   * Reset handlers and clear console spies before each test
   */
  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  /**
   * Cleanup after each test
   */
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Fetch', () => {
    it('fetches templates on mount', async () => {
      const mockTemplates = createMockTemplates(3);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      // Initial state
      expect(result.current.templates).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.initialized).toBe(false);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify final state
      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.error).toBeNull();
      expect(result.current.initialized).toBe(true);
    });

    it('fetches empty templates list', async () => {
      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json([]);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.initialized).toBe(true);
    });

    it('does not fetch again on re-render', async () => {
      const fetchSpy = vi.fn();
      const mockTemplates = createMockTemplates(2);

      server.use(
        http.get('/api/onboarding/templates', () => {
          fetchSpy();
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result, rerender } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Re-render should not trigger another fetch
      rerender();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('handles loading state correctly', async () => {
      const mockTemplates = createMockTemplates(2);
      let resolveRequest: (value: unknown) => void;
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.get('/api/onboarding/templates', async () => {
          await requestPromise;
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      // Should be loading initially
      expect(result.current.loading).toBe(true);
      expect(result.current.templates).toEqual([]);

      // Resolve the request
      act(() => {
        resolveRequest!(null);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toEqual(mockTemplates);
    });

    it('sets loading to false after successful fetch', async () => {
      const mockTemplates = createMockTemplates(1);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.templates).toEqual(mockTemplates);
    });

    it('sets loading to false after failed fetch', async () => {
      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(
            { message: 'Internal server error', error: 'Server Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('Error State', () => {
    it('handles error state on fetch failure', async () => {
      const errorResponse = {
        message: 'Failed to fetch templates',
        error: 'Internal Server Error',
        statusCode: 500,
      };

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(errorResponse, { status: 500 });
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toMatchObject({
        message: expect.stringContaining('Failed to fetch templates'),
        statusCode: 500,
      });
      expect(result.current.templates).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.initialized).toBe(true);
    });

    it('handles network error', async () => {
      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.loading).toBe(false);
      expect(result.current.templates).toEqual([]);
    });

    it('clears error on successful retry', async () => {
      let requestCount = 0;
      const mockTemplates = createMockTemplates(1);

      server.use(
        http.get('/api/onboarding/templates', () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(
              { message: 'Server error', error: 'Error', statusCode: 500 },
              { status: 500 }
            );
          }
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      // Wait for initial error
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();

      // Retry
      await act(async () => {
        await result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.error).toBeNull();
    });

    it('clears error manually', async () => {
      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(
            { message: 'Error', error: 'Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Create Template', () => {
    it('creates template successfully', async () => {
      const existingTemplates = createMockTemplates(2);
      const newTemplateRequest: CreateTemplateRequest = {
        name: 'New Template',
        description: 'New template description',
        tasks: [
          {
            title: 'Task 1',
            description: 'Task 1 description',
            dueInDays: 1,
            order: 1,
          },
        ],
        isActive: true,
      };
      const createdTemplate = createMockTemplate({
        id: 'template-3',
        ...newTemplateRequest,
      });

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.post('/api/onboarding/templates', async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json(createdTemplate, { status: 201 });
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      let returnedTemplate: Template | undefined;
      await act(async () => {
        returnedTemplate = await result.current.createTemplate(newTemplateRequest);
      });

      expect(returnedTemplate).toEqual(createdTemplate);
      expect(result.current.templates).toHaveLength(3);
      expect(result.current.templates[2]).toEqual(createdTemplate);
      expect(result.current.error).toBeNull();
    });

    it('handles create template error', async () => {
      const existingTemplates = createMockTemplates(1);
      const newTemplateRequest: CreateTemplateRequest = {
        name: 'New Template',
        description: 'Description',
        tasks: [],
        isActive: true,
      };

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.post('/api/onboarding/templates', () => {
          return HttpResponse.json(
            { message: 'Validation failed', error: 'Bad Request', statusCode: 400 },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.createTemplate(newTemplateRequest);
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Validation failed'),
        statusCode: 400,
      });

      expect(result.current.templates).toHaveLength(1);
      expect(result.current.error).not.toBeNull();
    });

    it('does not add template to list on create error', async () => {
      const existingTemplates = createMockTemplates(2);
      const newTemplateRequest: CreateTemplateRequest = {
        name: 'New Template',
        description: 'Description',
        tasks: [],
        isActive: true,
      };

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.post('/api/onboarding/templates', () => {
          return HttpResponse.json(
            { message: 'Error', error: 'Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialLength = result.current.templates.length;

      await expect(
        act(async () => {
          await result.current.createTemplate(newTemplateRequest);
        })
      ).rejects.toBeDefined();

      expect(result.current.templates).toHaveLength(initialLength);
    });
  });

  describe('Update Template', () => {
    it('updates template successfully', async () => {
      const existingTemplates = createMockTemplates(2);
      const updateRequest: UpdateTemplateRequest = {
        name: 'Updated Template Name',
        description: 'Updated description',
      };
      const updatedTemplate = createMockTemplate({
        ...existingTemplates[0],
        ...updateRequest,
        updatedAt: new Date('2025-01-15T00:00:00Z').toISOString(),
      });

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.put('/api/onboarding/templates/:id', async ({ params, request }) => {
          const body = await request.json();
          return HttpResponse.json(updatedTemplate);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let returnedTemplate: Template | undefined;
      await act(async () => {
        returnedTemplate = await result.current.updateTemplate('template-1', updateRequest);
      });

      expect(returnedTemplate).toEqual(updatedTemplate);
      expect(result.current.templates[0]).toEqual(updatedTemplate);
      expect(result.current.error).toBeNull();
    });

    it('handles update template error', async () => {
      const existingTemplates = createMockTemplates(2);
      const updateRequest: UpdateTemplateRequest = {
        name: 'Updated Name',
      };

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.put('/api/onboarding/templates/:id', () => {
          return HttpResponse.json(
            { message: 'Not found', error: 'Not Found', statusCode: 404 },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updateTemplate('template-1', updateRequest);
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Not found'),
        statusCode: 404,
      });

      expect(result.current.error).not.toBeNull();
    });

    it('validates template ID before update', async () => {
      const existingTemplates = createMockTemplates(1);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updateTemplate('', { name: 'Updated' });
        })
      ).rejects.toMatchObject({
        message: 'Invalid template ID',
        statusCode: 400,
      });
    });

    it('does not modify list on update error', async () => {
      const existingTemplates = createMockTemplates(2);
      const originalTemplate = { ...existingTemplates[0] };

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.put('/api/onboarding/templates/:id', () => {
          return HttpResponse.json(
            { message: 'Error', error: 'Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updateTemplate('template-1', { name: 'Updated' });
        })
      ).rejects.toBeDefined();

      expect(result.current.templates[0]).toEqual(originalTemplate);
    });
  });

  describe('Delete Template', () => {
    it('deletes template successfully', async () => {
      const existingTemplates = createMockTemplates(3);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.delete('/api/onboarding/templates/:id', () => {
          return HttpResponse.json({ message: 'Template deleted' });
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(3);

      await act(async () => {
        await result.current.deleteTemplate('template-2');
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates.find((t) => t.id === 'template-2')).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('handles delete template error', async () => {
      const existingTemplates = createMockTemplates(2);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.delete('/api/onboarding/templates/:id', () => {
          return HttpResponse.json(
            { message: 'Cannot delete template', error: 'Conflict', statusCode: 409 },
            { status: 409 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.deleteTemplate('template-1');
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('Cannot delete template'),
        statusCode: 409,
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.error).not.toBeNull();
    });

    it('validates template ID before delete', async () => {
      const existingTemplates = createMockTemplates(1);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.deleteTemplate('');
        })
      ).rejects.toMatchObject({
        message: 'Invalid template ID',
        statusCode: 400,
      });
    });

    it('does not remove template on delete error', async () => {
      const existingTemplates = createMockTemplates(2);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.delete('/api/onboarding/templates/:id', () => {
          return HttpResponse.json(
            { message: 'Error', error: 'Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialLength = result.current.templates.length;

      await expect(
        act(async () => {
          await result.current.deleteTemplate('template-1');
        })
      ).rejects.toBeDefined();

      expect(result.current.templates).toHaveLength(initialLength);
    });
  });

  describe('Refetch', () => {
    it('refetches templates manually', async () => {
      const initialTemplates = createMockTemplates(2);
      const updatedTemplates = createMockTemplates(3);
      let requestCount = 0;

      server.use(
        http.get('/api/onboarding/templates', () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(initialTemplates);
          }
          return HttpResponse.json(updatedTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.templates).toHaveLength(3);
      });

      expect(result.current.templates).toEqual(updatedTemplates);
    });

    it('handles refetch error', async () => {
      const initialTemplates = createMockTemplates(2);
      let requestCount = 0;

      server.use(
        http.get('/api/onboarding/templates', () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(initialTemplates);
          }
          return HttpResponse.json(
            { message: 'Error', error: 'Error', statusCode: 500 },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();
    });
  });

  describe('Retry Functionality', () => {
    it('retries failed fetch operation', async () => {
      let requestCount = 0;
      const mockTemplates = createMockTemplates(2);

      server.use(
        http.get('/api/onboarding/templates', () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json(
              { message: 'Error', error: 'Error', statusCode: 500 },
              { status: 500 }
            );
          }
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.templates).toEqual([]);

      await act(async () => {
        await result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.error).toBeNull();
    });

    it('retries failed create operation', async () => {
      const existingTemplates = createMockTemplates(1);
      const newTemplateRequest: CreateTemplateRequest = {
        name: 'New Template',
        description: 'Description',
        tasks: [],
        isActive: true,
      };
      const createdTemplate = createMockTemplate({
        id: 'template-2',
        ...newTemplateRequest,
      });
      let createRequestCount = 0;

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.post('/api/onboarding/templates', () => {
          createRequestCount++;
          if (createRequestCount === 1) {
            return HttpResponse.json(
              { message: 'Error', error: 'Error', statusCode: 500 },
              { status: 500 }
            );
          }
          return HttpResponse.json(createdTemplate, { status: 201 });
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.createTemplate(newTemplateRequest);
        })
      ).rejects.toBeDefined();

      expect(result.current.error).not.toBeNull();

      await act(async () => {
        await result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it('handles retry with no pending operation', async () => {
      const mockTemplates = createMockTemplates(1);

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // No error, no pending operation
      await act(async () => {
        await result.current.retry();
      });

      // Should not throw or change state
      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('prevents state updates after unmount', async () => {
      const mockTemplates = createMockTemplates(1);
      let resolveRequest: (value: unknown) => void;
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.get('/api/onboarding/templates', async () => {
          await requestPromise;
          return HttpResponse.json(mockTemplates);
        })
      );

      const { result, unmount } = renderHook(() => useOnboardingTemplates());

      expect(result.current.loading).toBe(true);

      // Unmount before request completes
      unmount();

      // Resolve request after unmount
      act(() => {
        resolveRequest!(null);
      });

      // Wait a bit to ensure no state updates occur
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No errors should be thrown
    });

    it('cleans up on unmount during create operation', async () => {
      const existingTemplates = createMockTemplates(1);
      const newTemplateRequest: CreateTemplateRequest = {
        name: 'New Template',
        description: 'Description',
        tasks: [],
        isActive: true,
      };
      let resolveRequest: (value: unknown) => void;
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.get('/api/onboarding/templates', () => {
          return HttpResponse.json(existingTemplates);
        }),
        http.post('/api/onboarding/templates', async () => {
          await requestPromise;
          return HttpResponse.json(createMockTemplate({ id: 'template-2' }), { status: 201 });
        })
      );

      const { result, unmount } = renderHook(() => useOnboardingTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.createTemplate(newTemplateRequest);
      });

      unmount();

      act(() => {
        resolveRequest!(null);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});