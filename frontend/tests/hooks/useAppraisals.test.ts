/**
 * Test Suite for useAppraisals Hook
 * 
 * Comprehensive tests for the useAppraisals custom React hook covering:
 * - Initial data fetching on mount
 * - Loading state management
 * - Error handling and recovery
 * - CRUD operations (create, submit assessment, submit review, update goals)
 * - Filtering and sorting functionality
 * - Optimistic updates and rollback
 * - Polling and refetch mechanisms
 * 
 * @module tests/hooks/useAppraisals
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { useAppraisals, AppraisalView } from '../../src/hooks/useAppraisals';
import { AppraisalStatus, GoalStatus } from '../../src/types/appraisal';
import type { Appraisal, Goal } from '../../src/types/appraisal';
import { AuthProvider } from '../../src/contexts/AuthContext';
import React from 'react';

/**
 * Test wrapper component providing AuthContext
 */
const createWrapper = (user = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'EMPLOYEE' as const,
  firstName: 'Test',
  lastName: 'User',
}) => {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

/**
 * Mock appraisal data factory
 */
const createMockAppraisal = (overrides?: Partial<Appraisal>): Appraisal => ({
  id: 'appraisal-1',
  employeeId: 'test-user-id',
  reviewerId: 'manager-id',
  reviewPeriodStart: '2025-01-01T00:00:00.000Z',
  reviewPeriodEnd: '2025-12-31T23:59:59.999Z',
  status: AppraisalStatus.DRAFT,
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
 * Mock goal data factory
 */
const createMockGoal = (overrides?: Partial<Goal>): Goal => ({
  id: 'goal-1',
  title: 'Complete project X',
  description: 'Deliver project X by Q2',
  status: GoalStatus.NOT_STARTED,
  targetDate: '2025-06-30T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useAppraisals Hook', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorage.clear();
    
    // Set mock auth token
    localStorage.setItem('accessToken', 'mock-access-token');
    
    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Data Fetching', () => {
    it('fetches appraisals on mount when fetchOnMount is true', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: 'appraisal-1' }),
        createMockAppraisal({ id: 'appraisal-2', status: AppraisalStatus.SUBMITTED }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(mockAppraisals);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      // Initially loading
      expect(result.current.loading.fetch).toBe(true);
      expect(result.current.appraisals).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      expect(result.current.appraisals).toHaveLength(2);
      expect(result.current.appraisals[0].id).toBe('appraisal-1');
      expect(result.current.appraisals[1].id).toBe('appraisal-2');
      expect(result.current.error.fetch).toBeNull();
    });

    it('does not fetch appraisals when fetchOnMount is false', async () => {
      const fetchSpy = vi.fn();
      
      server.use(
        http.get('/api/appraisals/my', () => {
          fetchSpy();
          return HttpResponse.json([]);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: false }),
        { wrapper: createWrapper() }
      );

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.loading.fetch).toBe(false);
      expect(result.current.appraisals).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches team appraisals for manager view', async () => {
      const mockAppraisals = [createMockAppraisal()];

      server.use(
        http.get('/api/appraisals/team', () => {
          return HttpResponse.json(mockAppraisals);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'team', fetchOnMount: true }),
        { wrapper: createWrapper({ id: 'manager-id', email: 'manager@example.com', role: 'MANAGER', firstName: 'Manager', lastName: 'User' }) }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      expect(result.current.appraisals).toHaveLength(1);
    });

    it('fetches all appraisals for admin view', async () => {
      const mockAppraisals = [createMockAppraisal()];

      server.use(
        http.get('/api/appraisals', () => {
          return HttpResponse.json(mockAppraisals);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'all', fetchOnMount: true }),
        { wrapper: createWrapper({ id: 'admin-id', email: 'admin@example.com', role: 'HR_ADMIN', firstName: 'Admin', lastName: 'User' }) }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      expect(result.current.appraisals).toHaveLength(1);
    });
  });

  describe('Loading State Management', () => {
    it('handles loading state correctly during fetch', async () => {
      server.use(
        http.get('/api/appraisals/my', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json([]);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      expect(result.current.loading.fetch).toBe(true);

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });
    });

    it('sets loading state for create operation', async () => {
      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([])),
        http.post('/api/appraisals', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return HttpResponse.json(createMockAppraisal());
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      act(() => {
        result.current.createAppraisal('employee-id', {
          start: '2025-01-01',
          end: '2025-12-31',
        });
      });

      expect(result.current.loading.create).toBe(true);

      await waitFor(() => {
        expect(result.current.loading.create).toBe(false);
      });
    });

    it('manages loading state for submitSelfAssessment', async () => {
      const mockAppraisal = createMockAppraisal();
      
      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([mockAppraisal])),
        http.post('/api/appraisals/:id/self-assessment', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return HttpResponse.json({
            ...mockAppraisal,
            status: AppraisalStatus.SUBMITTED,
            selfAssessment: 'Test assessment',
          });
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      act(() => {
        result.current.submitSelfAssessment('appraisal-1', {
          selfAssessment: 'Test assessment',
          goals: [],
        });
      });

      expect(result.current.loading.submitAssessment).toBe(true);

      await waitFor(() => {
        expect(result.current.loading.submitAssessment).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles error state when fetch fails', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.json(
            { error: 'Failed to fetch appraisals', code: 'FETCH_ERROR' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      expect(result.current.error.fetch).not.toBeNull();
      expect(result.current.error.fetch?.message).toContain('Failed to fetch appraisals');
      expect(result.current.appraisals).toEqual([]);
    });

    it('handles error when createAppraisal fails', async () => {
      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([])),
        http.post('/api/appraisals', () => {
          return HttpResponse.json(
            { error: 'Invalid employee ID', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      let createdAppraisal: Appraisal | null = null;

      await act(async () => {
        createdAppraisal = await result.current.createAppraisal('invalid-id', {
          start: '2025-01-01',
          end: '2025-12-31',
        });
      });

      expect(createdAppraisal).toBeNull();
      expect(result.current.error.create).not.toBeNull();
      expect(result.current.error.create?.message).toContain('Invalid employee ID');
    });

    it('handles network errors gracefully', async () => {
      server.use(
        http.get('/api/appraisals/my', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      expect(result.current.error.fetch).not.toBeNull();
      expect(result.current.appraisals).toEqual([]);
    });
  });

  describe('createAppraisal Function', () => {
    it('creates appraisal successfully', async () => {
      const newAppraisal = createMockAppraisal({ id: 'new-appraisal' });

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([])),
        http.post('/api/appraisals', async ({ request }) => {
          const body = await request.json() as any;
          expect(body.employeeId).toBe('employee-id');
          expect(body.reviewPeriod.start).toBe('2025-01-01');
          expect(body.reviewPeriod.end).toBe('2025-12-31');
          return HttpResponse.json(newAppraisal);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      let createdAppraisal: Appraisal | null = null;

      await act(async () => {
        createdAppraisal = await result.current.createAppraisal('employee-id', {
          start: '2025-01-01',
          end: '2025-12-31',
        });
      });

      expect(createdAppraisal).not.toBeNull();
      expect(createdAppraisal?.id).toBe('new-appraisal');
      expect(result.current.appraisals).toHaveLength(1);
      expect(result.current.appraisals[0].id).toBe('new-appraisal');
    });

    it('adds created appraisal to the beginning of the list', async () => {
      const existingAppraisal = createMockAppraisal({ id: 'existing' });
      const newAppraisal = createMockAppraisal({ id: 'new' });

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([existingAppraisal])),
        http.post('/api/appraisals', () => HttpResponse.json(newAppraisal))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      await act(async () => {
        await result.current.createAppraisal('employee-id', {
          start: '2025-01-01',
          end: '2025-12-31',
        });
      });

      expect(result.current.appraisals).toHaveLength(2);
      expect(result.current.appraisals[0].id).toBe('new');
      expect(result.current.appraisals[1].id).toBe('existing');
    });
  });

  describe('submitSelfAssessment Function', () => {
    it('submits self-assessment successfully', async () => {
      const mockAppraisal = createMockAppraisal();
      const updatedAppraisal = {
        ...mockAppraisal,
        status: AppraisalStatus.SUBMITTED,
        selfAssessment: 'My self-assessment text',
        selfAssessmentSubmittedAt: '2025-01-15T10:00:00.000Z',
      };

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([mockAppraisal])),
        http.post('/api/appraisals/:id/self-assessment', async ({ request }) => {
          const body = await request.json() as any;
          expect(body.selfAssessment).toBe('My self-assessment text');
          return HttpResponse.json(updatedAppraisal);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      let submittedAppraisal: Appraisal | null = null;

      await act(async () => {
        submittedAppraisal = await result.current.submitSelfAssessment('appraisal-1', {
          selfAssessment: 'My self-assessment text',
          goals: [],
        });
      });

      expect(submittedAppraisal).not.toBeNull();
      expect(submittedAppraisal?.status).toBe(AppraisalStatus.SUBMITTED);
      expect(submittedAppraisal?.selfAssessment).toBe('My self-assessment text');
      expect(result.current.appraisals[0].status).toBe(AppraisalStatus.SUBMITTED);
    });

    it('performs optimistic update and rolls back on error', async () => {
      const mockAppraisal = createMockAppraisal();

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([mockAppraisal])),
        http.post('/api/appraisals/:id/self-assessment', () => {
          return HttpResponse.json(
            { error: 'Submission failed', code: 'SUBMIT_ERROR' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      expect(result.current.appraisals[0].status).toBe(AppraisalStatus.DRAFT);

      await act(async () => {
        await result.current.submitSelfAssessment('appraisal-1', {
          selfAssessment: 'Test',
          goals: [],
        });
      });

      // Should roll back to original state
      expect(result.current.appraisals[0].status).toBe(AppraisalStatus.DRAFT);
      expect(result.current.error.submitAssessment).not.toBeNull();
    });
  });

  describe('submitReview Function', () => {
    it('submits manager review successfully', async () => {
      const mockAppraisal = createMockAppraisal({ status: AppraisalStatus.SUBMITTED });
      const updatedAppraisal = {
        ...mockAppraisal,
        status: AppraisalStatus.COMPLETED,
        managerFeedback: 'Great work!',
        rating: 4,
        reviewCompletedAt: '2025-01-20T10:00:00.000Z',
      };

      server.use(
        http.get('/api/appraisals/team', () => HttpResponse.json([mockAppraisal])),
        http.post('/api/appraisals/:id/review', async ({ request }) => {
          const body = await request.json() as any;
          expect(body.managerFeedback).toBe('Great work!');
          expect(body.rating).toBe(4);
          return HttpResponse.json(updatedAppraisal);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'team', fetchOnMount: true }),
        { wrapper: createWrapper({ id: 'manager-id', email: 'manager@example.com', role: 'MANAGER', firstName: 'Manager', lastName: 'User' }) }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      let reviewedAppraisal: Appraisal | null = null;

      await act(async () => {
        reviewedAppraisal = await result.current.submitReview('appraisal-1', {
          managerFeedback: 'Great work!',
          rating: 4,
        });
      });

      expect(reviewedAppraisal).not.toBeNull();
      expect(reviewedAppraisal?.status).toBe(AppraisalStatus.COMPLETED);
      expect(reviewedAppraisal?.rating).toBe(4);
      expect(result.current.appraisals[0].status).toBe(AppraisalStatus.COMPLETED);
    });

    it('validates rating range', async () => {
      const mockAppraisal = createMockAppraisal({ status: AppraisalStatus.SUBMITTED });

      server.use(
        http.get('/api/appraisals/team', () => HttpResponse.json([mockAppraisal])),
        http.post('/api/appraisals/:id/review', () => {
          return HttpResponse.json(
            { error: 'Rating must be between 1 and 5', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'team', fetchOnMount: true }),
        { wrapper: createWrapper({ id: 'manager-id', email: 'manager@example.com', role: 'MANAGER', firstName: 'Manager', lastName: 'User' }) }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      await act(async () => {
        await result.current.submitReview('appraisal-1', {
          managerFeedback: 'Feedback',
          rating: 6,
        });
      });

      expect(result.current.error.submitReview).not.toBeNull();
    });
  });

  describe('updateGoals Function', () => {
    it('updates goals successfully', async () => {
      const mockGoals = [
        createMockGoal({ id: 'goal-1', title: 'Goal 1' }),
        createMockGoal({ id: 'goal-2', title: 'Goal 2' }),
      ];
      const mockAppraisal = createMockAppraisal({ goals: [] });
      const updatedAppraisal = { ...mockAppraisal, goals: mockGoals };

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([mockAppraisal])),
        http.put('/api/appraisals/:id/goals', async ({ request }) => {
          const body = await request.json() as any;
          expect(body.goals).toHaveLength(2);
          return HttpResponse.json(updatedAppraisal);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      let updatedResult: Appraisal | null = null;

      await act(async () => {
        updatedResult = await result.current.updateGoals('appraisal-1', mockGoals as any);
      });

      expect(updatedResult).not.toBeNull();
      expect(updatedResult?.goals).toHaveLength(2);
      expect(result.current.appraisals[0].goals).toHaveLength(2);
    });

    it('performs optimistic update for goals', async () => {
      const mockAppraisal = createMockAppraisal({ goals: [] });
      const newGoals = [createMockGoal()];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([mockAppraisal])),
        http.put('/api/appraisals/:id/goals', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ ...mockAppraisal, goals: newGoals });
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      act(() => {
        result.current.updateGoals('appraisal-1', newGoals as any);
      });

      // Optimistic update should be immediate
      expect(result.current.appraisals[0].goals).toHaveLength(1);

      await waitFor(() => {
        expect(result.current.loading.updateGoals).toBe(false);
      });
    });
  });

  describe('Filtering Functionality', () => {
    it('filters appraisals by status', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', status: AppraisalStatus.DRAFT }),
        createMockAppraisal({ id: '2', status: AppraisalStatus.SUBMITTED }),
        createMockAppraisal({ id: '3', status: AppraisalStatus.COMPLETED }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const filtered = result.current.filterAppraisals({
        status: AppraisalStatus.SUBMITTED,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe(AppraisalStatus.SUBMITTED);
    });

    it('filters appraisals by multiple statuses', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', status: AppraisalStatus.DRAFT }),
        createMockAppraisal({ id: '2', status: AppraisalStatus.SUBMITTED }),
        createMockAppraisal({ id: '3', status: AppraisalStatus.COMPLETED }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const filtered = result.current.filterAppraisals({
        status: [AppraisalStatus.DRAFT, AppraisalStatus.SUBMITTED],
      });

      expect(filtered).toHaveLength(2);
    });

    it('filters appraisals by date range', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', reviewPeriodStart: '2025-01-01T00:00:00.000Z' }),
        createMockAppraisal({ id: '2', reviewPeriodStart: '2025-06-01T00:00:00.000Z' }),
        createMockAppraisal({ id: '3', reviewPeriodStart: '2025-12-01T00:00:00.000Z' }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const filtered = result.current.filterAppraisals({
        startDate: '2025-05-01',
        endDate: '2025-12-31',
      });

      expect(filtered).toHaveLength(2);
    });

    it('filters appraisals by rating range', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', rating: 2 }),
        createMockAppraisal({ id: '2', rating: 4 }),
        createMockAppraisal({ id: '3', rating: 5 }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const filtered = result.current.filterAppraisals({
        minRating: 4,
        maxRating: 5,
      });

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts appraisals by createdAt ascending', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', createdAt: '2025-03-01T00:00:00.000Z' }),
        createMockAppraisal({ id: '2', createdAt: '2025-01-01T00:00:00.000Z' }),
        createMockAppraisal({ id: '3', createdAt: '2025-02-01T00:00:00.000Z' }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const sorted = result.current.sortAppraisals('createdAt', 'asc');

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('sorts appraisals by rating descending', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', rating: 3 }),
        createMockAppraisal({ id: '2', rating: 5 }),
        createMockAppraisal({ id: '3', rating: 4 }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const sorted = result.current.sortAppraisals('rating', 'desc');

      expect(sorted[0].rating).toBe(5);
      expect(sorted[1].rating).toBe(4);
      expect(sorted[2].rating).toBe(3);
    });

    it('handles null values in sorting', async () => {
      const mockAppraisals = [
        createMockAppraisal({ id: '1', rating: 3 }),
        createMockAppraisal({ id: '2', rating: null }),
        createMockAppraisal({ id: '3', rating: 5 }),
      ];

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json(mockAppraisals))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(3);
      });

      const sorted = result.current.sortAppraisals('rating', 'asc');

      expect(sorted[0].rating).toBe(3);
      expect(sorted[1].rating).toBe(5);
      expect(sorted[2].rating).toBeNull();
    });
  });

  describe('Refetch Functionality', () => {
    it('refetches appraisals when refetch is called', async () => {
      let callCount = 0;
      const mockAppraisals = [createMockAppraisal()];

      server.use(
        http.get('/api/appraisals/my', () => {
          callCount++;
          return HttpResponse.json(mockAppraisals);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      expect(callCount).toBe(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(callCount).toBe(2);
    });

    it('updates appraisals after refetch', async () => {
      const initialAppraisals = [createMockAppraisal({ id: '1' })];
      const updatedAppraisals = [
        createMockAppraisal({ id: '1' }),
        createMockAppraisal({ id: '2' }),
      ];

      let fetchCount = 0;

      server.use(
        http.get('/api/appraisals/my', () => {
          fetchCount++;
          return HttpResponse.json(fetchCount === 1 ? initialAppraisals : updatedAppraisals);
        })
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(1);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.appraisals).toHaveLength(2);
    });
  });

  describe('Polling Functionality', () => {
    it('polls at specified interval', async () => {
      vi.useFakeTimers();
      
      let callCount = 0;
      const mockAppraisals = [createMockAppraisal()];

      server.use(
        http.get('/api/appraisals/my', () => {
          callCount++;
          return HttpResponse.json(mockAppraisals);
        })
      );

      renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true, pollingInterval: 5000 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(callCount).toBe(1);
      });

      // Fast-forward 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(callCount).toBe(2);
      });

      // Fast-forward another 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(callCount).toBe(3);
      });

      vi.useRealTimers();
    });

    it('does not poll when interval is 0', async () => {
      vi.useFakeTimers();
      
      let callCount = 0;

      server.use(
        http.get('/api/appraisals/my', () => {
          callCount++;
          return HttpResponse.json([]);
        })
      );

      renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true, pollingInterval: 0 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(callCount).toBe(1);
      });

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(callCount).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('getAppraisalById Function', () => {
    it('fetches single appraisal by ID', async () => {
      const mockAppraisal = createMockAppraisal({ id: 'specific-id' });

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([])),
        http.get('/api/appraisals/:id', () => HttpResponse.json(mockAppraisal))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loading.fetch).toBe(false);
      });

      let fetchedAppraisal: Appraisal | null = null;

      await act(async () => {
        fetchedAppraisal = await result.current.getAppraisalById('specific-id');
      });

      expect(fetchedAppraisal).not.toBeNull();
      expect(fetchedAppraisal?.id).toBe('specific-id');
    });

    it('adds fetched appraisal to local state', async () => {
      const mockAppraisal = createMockAppraisal({ id: 'new-id' });

      server.use(
        http.get('/api/appraisals/my', () => HttpResponse.json([])),
        http.get('/api/appraisals/:id', () => HttpResponse.json(mockAppraisal))
      );

      const { result } = renderHook(
        () => useAppraisals({ view: 'my', fetchOnMount: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.appraisals).toHaveLength(0);
      });

      await act(async () => {
        await result.current.getAppraisalById('new-id');
      });

      expect(result.current.appraisals).toHaveLength(1);
      expect(result.current.appraisals[0].id).toBe('new-id');
    });
  });
});