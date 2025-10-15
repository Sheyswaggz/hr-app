/**
 * Onboarding Service Unit Tests
 * 
 * Comprehensive test suite for OnboardingService covering all business logic,
 * error handling, validation, and edge cases. Tests are isolated using mocked
 * database queries and email service calls.
 * 
 * @module tests/unit/services/onboarding.service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

import { OnboardingService } from '../../../src/services/onboarding.service.js';
import * as db from '../../../src/db/index.js';
import { emailService } from '../../../src/services/email.service.js';
import {
  TaskStatus,
  WorkflowStatus,
  type OnboardingTemplate,
  type OnboardingWorkflow,
  type OnboardingTask,
  type CreateTemplateRequest,
  type AssignWorkflowRequest,
  type TeamProgressSummary,
} from '../../../src/types/onboarding.js';

// Mock dependencies
vi.mock('../../../src/db/index.js');
vi.mock('../../../src/services/email.service.js');

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockDate: Date;

  beforeEach(() => {
    service = new OnboardingService();
    mockDate = new Date('2025-01-15T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTemplate', () => {
    const validRequest: CreateTemplateRequest = {
      name: 'Software Engineer Onboarding',
      description: 'Standard onboarding process for software engineers',
      tasks: [
        {
          title: 'Complete I-9 Form',
          description: 'Fill out employment eligibility verification',
          daysUntilDue: 1,
          order: 1,
          requiresDocument: true,
        },
        {
          title: 'Setup Development Environment',
          description: 'Install required software and tools',
          daysUntilDue: 3,
          order: 2,
          requiresDocument: false,
        },
      ],
      estimatedDays: 30,
      departmentId: 'dept-123',
    };

    it('should create template successfully with valid data', async () => {
      const templateId = 'template-123';
      const taskId1 = 'task-123';
      const taskId2 = 'task-456';
      const createdBy = 'user-123';

      // Mock crypto.randomUUID
      vi.spyOn(crypto, 'randomUUID')
        .mockReturnValueOnce(templateId)
        .mockReturnValueOnce(taskId1)
        .mockReturnValueOnce(taskId2);

      // Mock executeTransaction
      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        };
        return callback(mockClient as any);
      });

      const result = await service.createTemplate(validRequest, createdBy);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(templateId);
      expect(result.data?.name).toBe(validRequest.name);
      expect(result.data?.description).toBe(validRequest.description);
      expect(result.data?.tasks).toHaveLength(2);
      expect(result.data?.tasks[0]?.id).toBe(taskId1);
      expect(result.data?.tasks[1]?.id).toBe(taskId2);
      expect(result.data?.isActive).toBe(true);
      expect(result.data?.createdBy).toBe(createdBy);
      expect(result.data?.estimatedDays).toBe(30);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

      // Verify transaction was called
      expect(db.executeTransaction).toHaveBeenCalledTimes(1);
    });

    it('should return validation error for empty name', async () => {
      const invalidRequest = {
        ...validRequest,
        name: '',
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template name is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(db.executeTransaction).not.toHaveBeenCalled();
    });

    it('should return validation error for name exceeding 200 characters', async () => {
      const invalidRequest = {
        ...validRequest,
        name: 'a'.repeat(201),
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template name must not exceed 200 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for empty description', async () => {
      const invalidRequest = {
        ...validRequest,
        description: '',
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template description is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for description exceeding 2000 characters', async () => {
      const invalidRequest = {
        ...validRequest,
        description: 'a'.repeat(2001),
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template description must not exceed 2000 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for empty tasks array', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [],
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one task is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for task with empty title', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [
          {
            title: '',
            description: 'Valid description',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: false,
          },
        ],
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task 1: Title is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for task title exceeding 200 characters', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [
          {
            title: 'a'.repeat(201),
            description: 'Valid description',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: false,
          },
        ],
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task 1: Title must not exceed 200 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for task with negative daysUntilDue', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [
          {
            title: 'Valid title',
            description: 'Valid description',
            daysUntilDue: -1,
            order: 1,
            requiresDocument: false,
          },
        ],
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task 1: Days until due must be a non-negative number');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for invalid estimatedDays', async () => {
      const invalidRequest = {
        ...validRequest,
        estimatedDays: 0,
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Estimated days must be a positive number');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database transaction error', async () => {
      vi.mocked(db.executeTransaction).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.createTemplate(validRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.errorCode).toBe('CREATE_TEMPLATE_ERROR');
    });

    it('should return multiple validation errors', async () => {
      const invalidRequest = {
        name: '',
        description: '',
        tasks: [],
        estimatedDays: -1,
      };

      const result = await service.createTemplate(invalidRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template name is required');
      expect(result.error).toContain('Template description is required');
      expect(result.error).toContain('At least one task is required');
      expect(result.error).toContain('Estimated days must be a positive number');
    });
  });

  describe('getTemplates', () => {
    it('should return all templates successfully', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'Description 1',
          is_active: true,
          created_by: 'user-1',
          department_id: 'dept-1',
          estimated_days: 30,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Description 2',
          is_active: true,
          created_by: 'user-2',
          department_id: null,
          estimated_days: 45,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      const mockTasks = [
        {
          id: 'task-1',
          template_id: 'template-1',
          workflow_id: null,
          title: 'Task 1',
          description: 'Task description',
          due_date: mockDate,
          status: TaskStatus.Pending,
          document_url: null,
          order_number: 1,
          requires_document: true,
          completed_at: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      vi.mocked(db.queryMany)
        .mockResolvedValueOnce(mockTemplates)
        .mockResolvedValue(mockTasks);

      const result = await service.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.id).toBe('template-1');
      expect(result.data?.[0]?.tasks).toHaveLength(1);
      expect(result.data?.[1]?.id).toBe('template-2');
      expect(db.queryMany).toHaveBeenCalledTimes(3); // 1 for templates, 2 for tasks
    });

    it('should filter by active status', async () => {
      vi.mocked(db.queryMany).mockResolvedValue([]);

      await service.getTemplates({ activeOnly: true });

      expect(db.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('is_active = $1'),
        [true],
        expect.any(Object)
      );
    });

    it('should filter by department', async () => {
      vi.mocked(db.queryMany).mockResolvedValue([]);

      await service.getTemplates({ departmentId: 'dept-123' });

      expect(db.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('department_id = $1'),
        ['dept-123'],
        expect.any(Object)
      );
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(db.queryMany).mockResolvedValue([]);

      const result = await service.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Database query failed')
      );

      const result = await service.getTemplates();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database query failed');
      expect(result.errorCode).toBe('FETCH_TEMPLATES_ERROR');
    });
  });

  describe('assignWorkflow', () => {
    const validRequest: AssignWorkflowRequest = {
      employeeId: 'emp-123',
      templateId: 'template-123',
      targetCompletionDate: new Date('2025-02-15T10:00:00.000Z'),
    };

    const mockEmployee = {
      id: 'emp-123',
      user_id: 'user-123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      job_title: 'Software Engineer',
      department_id: 'dept-123',
      manager_id: 'manager-123',
    };

    const mockTemplate = {
      id: 'template-123',
      name: 'Onboarding Template',
      description: 'Standard onboarding',
      is_active: true,
      created_by: 'user-456',
      department_id: 'dept-123',
      estimated_days: 30,
      created_at: mockDate,
      updated_at: mockDate,
    };

    const mockTemplateTasks = [
      {
        id: 'task-1',
        template_id: 'template-123',
        workflow_id: null,
        title: 'Task 1',
        description: 'Description 1',
        due_date: new Date(mockDate.getTime() + 24 * 60 * 60 * 1000),
        status: TaskStatus.Pending,
        document_url: null,
        order_number: 1,
        requires_document: true,
        completed_at: null,
        created_at: mockDate,
        updated_at: mockDate,
      },
    ];

    beforeEach(() => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(null); // No existing workflow

      vi.mocked(db.queryMany).mockResolvedValue(mockTemplateTasks);

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        };
        return callback(mockClient as any);
      });

      vi.mocked(emailService.sendWorkflowAssignmentNotification).mockResolvedValue();
    });

    it('should assign workflow successfully', async () => {
      const workflowId = 'workflow-123';
      const taskId = 'new-task-123';

      vi.spyOn(crypto, 'randomUUID')
        .mockReturnValueOnce(workflowId)
        .mockReturnValueOnce(taskId);

      const result = await service.assignWorkflow(validRequest, 'user-456');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(workflowId);
      expect(result.data?.employeeId).toBe('emp-123');
      expect(result.data?.templateId).toBe('template-123');
      expect(result.data?.status).toBe(WorkflowStatus.NotStarted);
      expect(result.data?.progress).toBe(0);
      expect(result.data?.tasks).toHaveLength(1);

      // Verify email was sent
      expect(emailService.sendWorkflowAssignmentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeEmail: 'john.doe@example.com',
          employeeName: 'John Doe',
          workflowName: 'Onboarding Template',
        }),
        expect.any(String)
      );
    });

    it('should return validation error for missing employeeId', async () => {
      const invalidRequest = {
        ...validRequest,
        employeeId: '',
      };

      const result = await service.assignWorkflow(invalidRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for missing templateId', async () => {
      const invalidRequest = {
        ...validRequest,
        templateId: '',
      };

      const result = await service.assignWorkflow(invalidRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return error when employee not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await service.assignWorkflow(validRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should return error when template not found', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(null);

      const result = await service.assignWorkflow(validRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found or inactive');
      expect(result.errorCode).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should return error when employee already has active workflow', async () => {
      const existingWorkflow = {
        id: 'existing-workflow',
        employee_id: 'emp-123',
        template_id: 'template-123',
        status: WorkflowStatus.InProgress,
        progress: 50,
        assigned_by: 'user-456',
        assigned_at: mockDate,
        started_at: mockDate,
        completed_at: null,
        target_completion_date: mockDate,
        created_at: mockDate,
        updated_at: mockDate,
      };

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(existingWorkflow);

      const result = await service.assignWorkflow(validRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee already has an active onboarding workflow');
      expect(result.errorCode).toBe('WORKFLOW_EXISTS');
    });

    it('should handle email notification failure gracefully', async () => {
      vi.mocked(emailService.sendWorkflowAssignmentNotification).mockRejectedValue(
        new Error('Email service unavailable')
      );

      const result = await service.assignWorkflow(validRequest, 'user-456');

      // Should still succeed even if email fails
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle database transaction error', async () => {
      vi.mocked(db.executeTransaction).mockRejectedValue(
        new Error('Transaction failed')
      );

      const result = await service.assignWorkflow(validRequest, 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
      expect(result.errorCode).toBe('ASSIGN_WORKFLOW_ERROR');
    });
  });

  describe('getMyTasks', () => {
    it('should return employee tasks successfully', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        employee_id: 'emp-123',
        template_id: 'template-123',
        status: WorkflowStatus.InProgress,
        progress: 50,
        assigned_by: 'user-456',
        assigned_at: mockDate,
        started_at: mockDate,
        completed_at: null,
        target_completion_date: mockDate,
        created_at: mockDate,
        updated_at: mockDate,
      };

      const mockTasks = [
        {
          id: 'task-1',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 1',
          description: 'Description 1',
          due_date: mockDate,
          status: TaskStatus.Completed,
          document_url: 'https://example.com/doc.pdf',
          order_number: 1,
          requires_document: true,
          completed_at: mockDate,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'task-2',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 2',
          description: 'Description 2',
          due_date: mockDate,
          status: TaskStatus.Pending,
          document_url: null,
          order_number: 2,
          requires_document: false,
          completed_at: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      vi.mocked(db.queryOne).mockResolvedValue(mockWorkflow);
      vi.mocked(db.queryMany).mockResolvedValue(mockTasks);

      const result = await service.getMyTasks('emp-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.id).toBe('task-1');
      expect(result.data?.[0]?.status).toBe(TaskStatus.Completed);
      expect(result.data?.[1]?.id).toBe('task-2');
      expect(result.data?.[1]?.status).toBe(TaskStatus.Pending);
    });

    it('should return empty array when employee has no workflow', async () => {
      vi.mocked(db.queryOne).mockResolvedValue(null);

      const result = await service.getMyTasks('emp-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error', async () => {
      vi.mocked(db.queryOne).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getMyTasks('emp-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.errorCode).toBe('FETCH_WORKFLOW_ERROR');
    });
  });

  describe('updateTaskStatus', () => {
    const mockTask = {
      id: 'task-123',
      template_id: null,
      workflow_id: 'workflow-123',
      title: 'Complete I-9',
      description: 'Fill out form',
      due_date: mockDate,
      status: TaskStatus.Pending,
      document_url: null,
      order_number: 1,
      requires_document: true,
      completed_at: null,
      created_at: mockDate,
      updated_at: mockDate,
    };

    const mockWorkflow = {
      id: 'workflow-123',
      employee_id: 'emp-123',
      template_id: 'template-123',
      status: WorkflowStatus.NotStarted,
      progress: 0,
      assigned_by: 'user-456',
      assigned_at: mockDate,
      started_at: null,
      completed_at: null,
      target_completion_date: mockDate,
      created_at: mockDate,
      updated_at: mockDate,
    };

    beforeEach(() => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockWorkflow);

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Update task
            .mockResolvedValueOnce({ rows: [mockTask], rowCount: 1 }) // Fetch all tasks
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }), // Update workflow
        };
        return callback(mockClient as any);
      });

      vi.mocked(emailService.sendTaskCompletionNotification).mockResolvedValue();
    });

    it('should update task status successfully', async () => {
      const result = await service.updateTaskStatus(
        'task-123',
        'emp-123',
        'https://example.com/document.pdf'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('task-123');
      expect(result.data?.status).toBe(TaskStatus.Completed);
      expect(result.data?.documentUrl).toBe('https://example.com/document.pdf');
      expect(result.data?.completedAt).toEqual(mockDate);
    });

    it('should return validation error for missing taskId', async () => {
      const result = await service.updateTaskStatus('', 'emp-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for missing employeeId', async () => {
      const result = await service.updateTaskStatus('task-123', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return error when task not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await service.updateTaskStatus('task-123', 'emp-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
      expect(result.errorCode).toBe('TASK_NOT_FOUND');
    });

    it('should return error when task does not belong to employee', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(null); // Workflow not found for employee

      const result = await service.updateTaskStatus('task-123', 'wrong-emp-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized: Task does not belong to employee');
      expect(result.errorCode).toBe('UNAUTHORIZED');
    });

    it('should return error when task is already completed', async () => {
      const completedTask = {
        ...mockTask,
        status: TaskStatus.Completed,
        completed_at: mockDate,
      };

      vi.mocked(db.queryOne).mockResolvedValueOnce(completedTask);

      const result = await service.updateTaskStatus('task-123', 'emp-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task is already completed');
      expect(result.errorCode).toBe('TASK_ALREADY_COMPLETED');
    });

    it('should return error when document is required but not provided', async () => {
      const result = await service.updateTaskStatus('task-123', 'emp-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Document upload is required for this task');
      expect(result.errorCode).toBe('DOCUMENT_REQUIRED');
    });

    it('should handle email notification failure gracefully', async () => {
      vi.mocked(emailService.sendTaskCompletionNotification).mockRejectedValue(
        new Error('Email failed')
      );

      const result = await service.updateTaskStatus(
        'task-123',
        'emp-123',
        'https://example.com/doc.pdf'
      );

      // Should still succeed even if email fails
      expect(result.success).toBe(true);
    });

    it('should handle database transaction error', async () => {
      vi.mocked(db.executeTransaction).mockRejectedValue(
        new Error('Transaction failed')
      );

      const result = await service.updateTaskStatus(
        'task-123',
        'emp-123',
        'https://example.com/doc.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
      expect(result.errorCode).toBe('UPDATE_TASK_ERROR');
    });
  });

  describe('getTeamProgress', () => {
    it('should return team progress successfully', async () => {
      const mockTeamWorkflows = [
        {
          id: 'workflow-1',
          employee_id: 'emp-1',
          template_id: 'template-1',
          status: WorkflowStatus.InProgress,
          progress: 50,
          assigned_by: 'manager-123',
          assigned_at: mockDate,
          started_at: mockDate,
          completed_at: null,
          target_completion_date: new Date('2025-02-15T10:00:00.000Z'),
          created_at: mockDate,
          updated_at: mockDate,
          first_name: 'John',
          last_name: 'Doe',
        },
        {
          id: 'workflow-2',
          employee_id: 'emp-2',
          template_id: 'template-1',
          status: WorkflowStatus.Completed,
          progress: 100,
          assigned_by: 'manager-123',
          assigned_at: mockDate,
          started_at: mockDate,
          completed_at: mockDate,
          target_completion_date: new Date('2025-02-15T10:00:00.000Z'),
          created_at: mockDate,
          updated_at: mockDate,
          first_name: 'Jane',
          last_name: 'Smith',
        },
      ];

      const mockTasks = [
        {
          id: 'task-1',
          template_id: null,
          workflow_id: 'workflow-1',
          title: 'Task 1',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Completed,
          document_url: null,
          order_number: 1,
          requires_document: false,
          completed_at: mockDate,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'task-2',
          template_id: null,
          workflow_id: 'workflow-1',
          title: 'Task 2',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Pending,
          document_url: null,
          order_number: 2,
          requires_document: false,
          completed_at: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      vi.mocked(db.queryMany)
        .mockResolvedValueOnce(mockTeamWorkflows)
        .mockResolvedValue(mockTasks);

      const result = await service.getTeamProgress('manager-123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.managerId).toBe('manager-123');
      expect(result.data?.totalEmployees).toBe(2);
      expect(result.data?.inProgressCount).toBe(1);
      expect(result.data?.completedCount).toBe(1);
      expect(result.data?.employees).toHaveLength(2);
      expect(result.data?.employees[0]?.employeeName).toBe('John Doe');
      expect(result.data?.employees[1]?.employeeName).toBe('Jane Smith');
    });

    it('should return validation error for missing managerId', async () => {
      const result = await service.getTeamProgress('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Manager ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return empty summary when manager has no team members', async () => {
      vi.mocked(db.queryMany).mockResolvedValue([]);

      const result = await service.getTeamProgress('manager-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalEmployees).toBe(0);
      expect(result.data?.employees).toEqual([]);
      expect(result.data?.averageProgress).toBe(0);
    });

    it('should handle database error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getTeamProgress('manager-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.errorCode).toBe('FETCH_TEAM_PROGRESS_ERROR');
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 1',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Completed,
          document_url: null,
          order_number: 1,
          requires_document: false,
          completed_at: mockDate,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'task-2',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 2',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Completed,
          document_url: null,
          order_number: 2,
          requires_document: false,
          completed_at: mockDate,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'task-3',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 3',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Pending,
          document_url: null,
          order_number: 3,
          requires_document: false,
          completed_at: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'task-4',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 4',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Pending,
          document_url: null,
          order_number: 4,
          requires_document: false,
          completed_at: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      vi.mocked(db.queryMany).mockResolvedValue(mockTasks);

      const result = await service.calculateProgress('workflow-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(50); // 2 out of 4 tasks completed = 50%
    });

    it('should return 0 for workflow with no tasks', async () => {
      vi.mocked(db.queryMany).mockResolvedValue([]);

      const result = await service.calculateProgress('workflow-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should return 100 for workflow with all tasks completed', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          template_id: null,
          workflow_id: 'workflow-123',
          title: 'Task 1',
          description: 'Description',
          due_date: mockDate,
          status: TaskStatus.Completed,
          document_url: null,
          order_number: 1,
          requires_document: false,
          completed_at: mockDate,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      vi.mocked(db.queryMany).mockResolvedValue(mockTasks);

      const result = await service.calculateProgress('workflow-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(100);
    });

    it('should return validation error for missing workflowId', async () => {
      const result = await service.calculateProgress('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.calculateProgress('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.errorCode).toBe('CALCULATE_PROGRESS_ERROR');
    });
  });
});