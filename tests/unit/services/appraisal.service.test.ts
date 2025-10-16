import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppraisalService } from '../../../src/services/appraisal.service';
import { AppraisalStatus, GoalStatus } from '../../../src/types/appraisal';
import * as db from '../../../src/db/index';
import * as emailService from '../../../src/services/email.service';

// Mock database module
vi.mock('../../../src/db/index', () => ({
  executeQuery: vi.fn(),
  executeTransaction: vi.fn(),
  queryOne: vi.fn(),
  queryMany: vi.fn(),
}));

// Mock email service
vi.mock('../../../src/services/email.service', () => ({
  emailService: {
    sendAppraisalCycleNotification: vi.fn(),
    sendReviewCompletedNotification: vi.fn(),
  },
}));

describe('AppraisalService', () => {
  let appraisalService: AppraisalService;
  const mockTimestamp = new Date('2024-01-15T10:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(mockTimestamp);
    appraisalService = new AppraisalService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAppraisal', () => {
    const validRequest = {
      employeeId: 'emp-123',
      reviewerId: 'mgr-456',
      reviewPeriodStart: new Date('2024-01-01'),
      reviewPeriodEnd: new Date('2024-12-31'),
      goals: [
        {
          title: 'Complete Project X',
          description: 'Deliver project by Q2',
          targetDate: new Date('2024-06-30'),
          status: GoalStatus.NotStarted,
        },
      ],
    };

    it('should create appraisal successfully', async () => {
      const mockEmployee = {
        id: 'emp-123',
        user_id: 'user-123',
        manager_id: 'mgr-456',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        job_title: 'Software Engineer',
      };

      const mockReviewer = {
        id: 'mgr-456',
        user_id: 'user-456',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
      };

      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        review_period_start: new Date('2024-01-01'),
        review_period_end: new Date('2024-12-31'),
        self_assessment: null,
        manager_feedback: null,
        rating: null,
        goals: JSON.stringify([
          {
            id: expect.any(String),
            title: 'Complete Project X',
            description: 'Deliver project by Q2',
            targetDate: new Date('2024-06-30'),
            status: GoalStatus.NotStarted,
            notes: undefined,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
        status: AppraisalStatus.Draft,
        self_assessment_submitted_at: null,
        review_completed_at: null,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: 'emp-123', manager_id: 'mgr-456' }) // validateManagerEmployeeRelationship
        .mockResolvedValueOnce(mockEmployee) // fetch employee
        .mockResolvedValueOnce(mockReviewer); // fetch reviewer

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [mockAppraisalRecord] }),
        };
        return callback(mockClient);
      });

      vi.mocked(emailService.emailService.sendAppraisalCycleNotification).mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        retryAttempts: 0,
        executionTimeMs: 100,
        timestamp: mockTimestamp,
      });

      const result = await appraisalService.createAppraisal(validRequest, 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('appraisal-789');
      expect(result.data?.employeeId).toBe('emp-123');
      expect(result.data?.reviewerId).toBe('mgr-456');
      expect(result.data?.status).toBe(AppraisalStatus.Draft);
      expect(result.data?.goals).toHaveLength(1);
      expect(result.data?.goals[0]?.title).toBe('Complete Project X');
      expect(emailService.emailService.sendAppraisalCycleNotification).toHaveBeenCalledWith({
        employeeEmail: 'john.doe@example.com',
        employeeName: 'John Doe',
        managerName: 'Jane Smith',
        reviewPeriodStart: '2024-01-01T00:00:00.000Z',
        reviewPeriodEnd: '2024-12-31T00:00:00.000Z',
        appraisalId: 'appraisal-789',
      });
    });

    it('should fail when manager-employee relationship is invalid', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: 'emp-123', manager_id: 'different-mgr' });

      const result = await appraisalService.createAppraisal(validRequest, 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not the employee');
      expect(result.errorCode).toBe('UNAUTHORIZED');
    });

    it('should fail when employee not found', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: 'emp-123', manager_id: 'mgr-456' }) // validateManagerEmployeeRelationship
        .mockResolvedValueOnce(null); // fetch employee

      const result = await appraisalService.createAppraisal(validRequest, 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        employeeId: '',
        reviewerId: 'mgr-456',
        reviewPeriodStart: new Date('2024-01-01'),
        reviewPeriodEnd: new Date('2024-12-31'),
      };

      const result = await appraisalService.createAppraisal(invalidRequest as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate review period dates', async () => {
      const invalidRequest = {
        ...validRequest,
        reviewPeriodStart: new Date('2024-12-31'),
        reviewPeriodEnd: new Date('2024-01-01'),
      };

      const result = await appraisalService.createAppraisal(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('start date must be before end date');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('getAppraisal', () => {
    const mockAppraisalRecord = {
      id: 'appraisal-789',
      employee_id: 'emp-123',
      reviewer_id: 'mgr-456',
      review_period_start: new Date('2024-01-01'),
      review_period_end: new Date('2024-12-31'),
      self_assessment: 'My self assessment',
      manager_feedback: null,
      rating: null,
      goals: JSON.stringify([]),
      status: AppraisalStatus.Submitted,
      self_assessment_submitted_at: mockTimestamp,
      review_completed_at: null,
      created_at: mockTimestamp,
      updated_at: mockTimestamp,
    };

    it('should fetch appraisal successfully for HR Admin', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(mockAppraisalRecord);

      const result = await appraisalService.getAppraisal(
        'appraisal-789',
        'user-admin',
        'HR_ADMIN',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('appraisal-789');
      expect(result.data?.status).toBe(AppraisalStatus.Submitted);
    });

    it('should return not found when appraisal does not exist', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await appraisalService.getAppraisal(
        'non-existent',
        'user-123',
        'EMPLOYEE',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appraisal not found');
      expect(result.errorCode).toBe('APPRAISAL_NOT_FOUND');
    });

    it('should enforce authorization for non-admin users', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockAppraisalRecord) // fetch appraisal
        .mockResolvedValueOnce({ id: 'different-emp', manager_id: null }); // fetch employee

      const result = await appraisalService.getAppraisal(
        'appraisal-789',
        'user-other',
        'EMPLOYEE',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(result.errorCode).toBe('UNAUTHORIZED');
    });

    it('should allow employee to view their own appraisal', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockAppraisalRecord) // fetch appraisal
        .mockResolvedValueOnce({ id: 'emp-123', manager_id: null }); // fetch employee

      const result = await appraisalService.getAppraisal(
        'appraisal-789',
        'user-123',
        'EMPLOYEE',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('appraisal-789');
    });

    it('should allow reviewer to view appraisal', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockAppraisalRecord) // fetch appraisal
        .mockResolvedValueOnce({ id: 'mgr-456', manager_id: null }); // fetch employee

      const result = await appraisalService.getAppraisal(
        'appraisal-789',
        'user-456',
        'MANAGER',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('appraisal-789');
    });
  });

  describe('getMyAppraisals', () => {
    it('should return employee appraisals', async () => {
      const mockEmployee = { id: 'emp-123' };
      const mockAppraisals = [
        {
          id: 'appraisal-1',
          employee_id: 'emp-123',
          reviewer_id: 'mgr-456',
          review_period_start: new Date('2024-01-01'),
          review_period_end: new Date('2024-12-31'),
          self_assessment: null,
          manager_feedback: null,
          rating: null,
          goals: JSON.stringify([{ id: 'goal-1', status: GoalStatus.Achieved }]),
          status: AppraisalStatus.Completed,
          self_assessment_submitted_at: null,
          review_completed_at: mockTimestamp,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
          employee_first_name: 'John',
          employee_last_name: 'Doe',
          employee_email: 'john@example.com',
          employee_job_title: 'Engineer',
          reviewer_first_name: 'Jane',
          reviewer_last_name: 'Smith',
          reviewer_email: 'jane@example.com',
        },
      ];

      vi.mocked(db.queryOne).mockResolvedValueOnce(mockEmployee);
      vi.mocked(db.queryMany).mockResolvedValueOnce(mockAppraisals);

      const result = await appraisalService.getMyAppraisals('user-123', 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.id).toBe('appraisal-1');
      expect(result.data?.[0]?.employee.firstName).toBe('John');
      expect(result.data?.[0]?.achievedGoalCount).toBe(1);
    });

    it('should return empty list when no appraisals exist', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: 'emp-123' });
      vi.mocked(db.queryMany).mockResolvedValueOnce([]);

      const result = await appraisalService.getMyAppraisals('user-123', 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail when employee not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await appraisalService.getMyAppraisals('user-123', 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee record not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });
  });

  describe('getTeamAppraisals', () => {
    it('should return team appraisals for manager', async () => {
      const mockManager = { id: 'mgr-456' };
      const mockAppraisals = [
        {
          id: 'appraisal-1',
          employee_id: 'emp-123',
          reviewer_id: 'mgr-456',
          review_period_start: new Date('2024-01-01'),
          review_period_end: new Date('2024-12-31'),
          self_assessment: null,
          manager_feedback: null,
          rating: 4,
          goals: JSON.stringify([]),
          status: AppraisalStatus.Completed,
          self_assessment_submitted_at: null,
          review_completed_at: mockTimestamp,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
          employee_first_name: 'John',
          employee_last_name: 'Doe',
          employee_email: 'john@example.com',
          employee_job_title: 'Engineer',
          reviewer_first_name: 'Jane',
          reviewer_last_name: 'Smith',
          reviewer_email: 'jane@example.com',
        },
      ];

      vi.mocked(db.queryOne).mockResolvedValueOnce(mockManager);
      vi.mocked(db.queryMany).mockResolvedValueOnce(mockAppraisals);

      const result = await appraisalService.getTeamAppraisals('user-456', 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.reviewer.id).toBe('mgr-456');
    });

    it('should return empty list for manager with no team', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: 'mgr-456' });
      vi.mocked(db.queryMany).mockResolvedValueOnce([]);

      const result = await appraisalService.getTeamAppraisals('user-456', 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail when manager not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await appraisalService.getTeamAppraisals('user-456', 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Manager record not found');
      expect(result.errorCode).toBe('MANAGER_NOT_FOUND');
    });
  });

  describe('getAllAppraisals', () => {
    it('should return all appraisals with pagination', async () => {
      const mockAppraisals = [
        {
          id: 'appraisal-1',
          employee_id: 'emp-123',
          reviewer_id: 'mgr-456',
          review_period_start: new Date('2024-01-01'),
          review_period_end: new Date('2024-12-31'),
          self_assessment: null,
          manager_feedback: null,
          rating: null,
          goals: JSON.stringify([]),
          status: AppraisalStatus.Draft,
          self_assessment_submitted_at: null,
          review_completed_at: null,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
          employee_first_name: 'John',
          employee_last_name: 'Doe',
          employee_email: 'john@example.com',
          employee_job_title: 'Engineer',
          reviewer_first_name: 'Jane',
          reviewer_last_name: 'Smith',
          reviewer_email: 'jane@example.com',
        },
      ];

      vi.mocked(db.queryOne).mockResolvedValueOnce({ count: '1' });
      vi.mocked(db.queryMany).mockResolvedValueOnce(mockAppraisals);

      const result = await appraisalService.getAllAppraisals(1, 20, 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.data?.appraisals).toHaveLength(1);
      expect(result.data?.total).toBe(1);
    });

    it('should validate page parameter', async () => {
      const result = await appraisalService.getAllAppraisals(0, 20, 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Page must be at least 1');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate limit parameter', async () => {
      const result = await appraisalService.getAllAppraisals(1, 150, 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Limit must be between 1 and 100');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('submitSelfAssessment', () => {
    const validRequest = {
      appraisalId: 'appraisal-789',
      selfAssessment: 'This is my self assessment for the year.',
      goalUpdates: [
        {
          goalId: 'goal-1',
          status: GoalStatus.InProgress,
          notes: 'Making good progress',
        },
      ],
    };

    it('should submit self assessment successfully', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        review_period_start: new Date('2024-01-01'),
        review_period_end: new Date('2024-12-31'),
        self_assessment: null,
        manager_feedback: null,
        rating: null,
        goals: JSON.stringify([
          {
            id: 'goal-1',
            title: 'Goal 1',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.NotStarted,
            notes: undefined,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
        status: AppraisalStatus.Draft,
        self_assessment_submitted_at: null,
        review_completed_at: null,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      const mockUpdatedRecord = {
        ...mockAppraisalRecord,
        self_assessment: validRequest.selfAssessment,
        status: AppraisalStatus.Submitted,
        self_assessment_submitted_at: mockTimestamp,
        goals: JSON.stringify([
          {
            id: 'goal-1',
            title: 'Goal 1',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.InProgress,
            notes: 'Making good progress',
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] }) // fetch appraisal
            .mockResolvedValueOnce({ rows: [{ id: 'emp-123' }] }) // fetch employee
            .mockResolvedValueOnce({ rows: [mockUpdatedRecord] }), // update appraisal
        };
        return callback(mockClient);
      });

      const result = await appraisalService.submitSelfAssessment(
        validRequest,
        'user-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data?.selfAssessment).toBe(validRequest.selfAssessment);
      expect(result.data?.status).toBe(AppraisalStatus.Submitted);
      expect(result.data?.goals[0]?.status).toBe(GoalStatus.InProgress);
    });

    it('should fail with invalid status transition', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        status: AppraisalStatus.Completed,
        goals: JSON.stringify([]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] })
            .mockResolvedValueOnce({ rows: [{ id: 'emp-123' }] }),
        };
        return callback(mockClient);
      });

      const result = await appraisalService.submitSelfAssessment(
        validRequest,
        'user-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it('should fail when unauthorized', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'different-emp',
        status: AppraisalStatus.Draft,
        goals: JSON.stringify([]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] })
            .mockResolvedValueOnce({ rows: [{ id: 'emp-123' }] }),
        };
        return callback(mockClient);
      });

      const result = await appraisalService.submitSelfAssessment(
        validRequest,
        'user-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should validate self assessment length', async () => {
      const invalidRequest = {
        ...validRequest,
        selfAssessment: 'a'.repeat(5001),
      };

      const result = await appraisalService.submitSelfAssessment(
        invalidRequest,
        'user-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('5000 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('submitReview', () => {
    const validRequest = {
      appraisalId: 'appraisal-789',
      managerFeedback: 'Great work this year. Keep it up!',
      rating: 4,
      goalUpdates: [
        {
          goalId: 'goal-1',
          status: GoalStatus.Achieved,
          notes: 'Successfully completed',
        },
      ],
    };

    it('should submit review successfully', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        review_period_start: new Date('2024-01-01'),
        review_period_end: new Date('2024-12-31'),
        self_assessment: 'Self assessment',
        manager_feedback: null,
        rating: null,
        goals: JSON.stringify([
          {
            id: 'goal-1',
            title: 'Goal 1',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.InProgress,
            notes: undefined,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
        status: AppraisalStatus.Submitted,
        self_assessment_submitted_at: mockTimestamp,
        review_completed_at: null,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      const mockUpdatedRecord = {
        ...mockAppraisalRecord,
        manager_feedback: validRequest.managerFeedback,
        rating: validRequest.rating,
        status: AppraisalStatus.Completed,
        review_completed_at: mockTimestamp,
        goals: JSON.stringify([
          {
            id: 'goal-1',
            title: 'Goal 1',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.Achieved,
            notes: 'Successfully completed',
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
      };

      const mockEmployee = {
        id: 'emp-123',
        user_id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      };

      const mockReviewer = {
        id: 'mgr-456',
        user_id: 'user-456',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] }) // fetch appraisal
            .mockResolvedValueOnce({ rows: [{ id: 'mgr-456' }] }) // fetch manager
            .mockResolvedValueOnce({ rows: [mockUpdatedRecord] }), // update appraisal
        };
        return callback(mockClient);
      });

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockEmployee) // fetch employee for notification
        .mockResolvedValueOnce(mockReviewer); // fetch reviewer for notification

      vi.mocked(emailService.emailService.sendReviewCompletedNotification).mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        retryAttempts: 0,
        executionTimeMs: 100,
        timestamp: mockTimestamp,
      });

      const result = await appraisalService.submitReview(
        validRequest,
        'user-456',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data?.managerFeedback).toBe(validRequest.managerFeedback);
      expect(result.data?.rating).toBe(validRequest.rating);
      expect(result.data?.status).toBe(AppraisalStatus.Completed);
      expect(emailService.emailService.sendReviewCompletedNotification).toHaveBeenCalledWith({
        employeeEmail: 'john@example.com',
        employeeName: 'John Doe',
        managerName: 'Jane Smith',
        rating: 4,
        reviewPeriodStart: '2024-01-01T00:00:00.000Z',
        reviewPeriodEnd: '2024-12-31T00:00:00.000Z',
        appraisalId: 'appraisal-789',
      });
    });

    it('should fail with invalid rating', async () => {
      const invalidRequest = {
        ...validRequest,
        rating: 6,
      };

      const result = await appraisalService.submitReview(
        invalidRequest,
        'user-456',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rating must be between 1 and 5');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with invalid status transition', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        status: AppraisalStatus.Draft,
        goals: JSON.stringify([]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] })
            .mockResolvedValueOnce({ rows: [{ id: 'mgr-456' }] }),
        };
        return callback(mockClient);
      });

      const result = await appraisalService.submitReview(
        validRequest,
        'user-456',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });
  });

  describe('updateGoals', () => {
    const validRequest = {
      appraisalId: 'appraisal-789',
      goalsToAdd: [
        {
          title: 'New Goal',
          description: 'New goal description',
          targetDate: new Date('2024-12-31'),
          status: GoalStatus.NotStarted,
        },
      ],
      goalsToUpdate: [
        {
          goalId: 'goal-1',
          title: 'Updated Goal',
        },
      ],
      goalsToRemove: ['goal-2'],
    };

    it('should update goals successfully', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        status: AppraisalStatus.Draft,
        goals: JSON.stringify([
          {
            id: 'goal-1',
            title: 'Goal 1',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.NotStarted,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: 'goal-2',
            title: 'Goal 2',
            description: 'Description',
            targetDate: new Date('2024-12-31'),
            status: GoalStatus.NotStarted,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] }) // fetch appraisal
            .mockResolvedValueOnce({ rows: [{ id: 'mgr-456' }] }) // fetch employee
            .mockResolvedValueOnce({
              rows: [
                {
                  ...mockAppraisalRecord,
                  goals: JSON.stringify([
                    {
                      id: 'goal-1',
                      title: 'Updated Goal',
                      description: 'Description',
                      targetDate: new Date('2024-12-31'),
                      status: GoalStatus.NotStarted,
                      createdAt: mockTimestamp,
                      updatedAt: mockTimestamp,
                    },
                    {
                      id: expect.any(String),
                      title: 'New Goal',
                      description: 'New goal description',
                      targetDate: new Date('2024-12-31'),
                      status: GoalStatus.NotStarted,
                      createdAt: mockTimestamp,
                      updatedAt: mockTimestamp,
                    },
                  ]),
                },
              ],
            }), // update appraisal
        };
        return callback(mockClient);
      });

      const result = await appraisalService.updateGoals(
        validRequest,
        'user-456',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data?.goals).toHaveLength(2);
      expect(result.data?.goals.find((g) => g.title === 'Updated Goal')).toBeDefined();
      expect(result.data?.goals.find((g) => g.title === 'New Goal')).toBeDefined();
      expect(result.data?.goals.find((g) => g.id === 'goal-2')).toBeUndefined();
    });

    it('should fail when not in draft status', async () => {
      const mockAppraisalRecord = {
        id: 'appraisal-789',
        employee_id: 'emp-123',
        reviewer_id: 'mgr-456',
        status: AppraisalStatus.Submitted,
        goals: JSON.stringify([]),
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({ rows: [mockAppraisalRecord] })
            .mockResolvedValueOnce({ rows: [{ id: 'mgr-456' }] }),
        };
        return callback(mockClient);
      });

      const result = await appraisalService.updateGoals(
        validRequest,
        'user-456',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('DRAFT status');
    });
  });

  describe('validateManagerEmployeeRelationship', () => {
    it('should validate valid relationship', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: 'emp-123', manager_id: 'mgr-456' });

      const result = await appraisalService.validateManagerEmployeeRelationship(
        'mgr-456',
        'emp-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should fail with invalid relationship', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: 'emp-123', manager_id: 'different-mgr' });

      const result = await appraisalService.validateManagerEmployeeRelationship(
        'mgr-456',
        'emp-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not the employee');
      expect(result.errorCode).toBe('INVALID_MANAGER');
    });

    it('should fail when employee not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await appraisalService.validateManagerEmployeeRelationship(
        'mgr-456',
        'emp-123',
        'test-correlation-id'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });
  });
});