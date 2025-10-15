/**
 * Onboarding Service Unit Tests
 * 
 * Comprehensive test suite for OnboardingService class.
 * Tests all service methods including success cases, validation errors,
 * and error handling scenarios. Mocks database queries and email service.
 * 
 * @module tests/unit/services/onboarding.service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

import { OnboardingService } from '../../../src/services/onboarding.service.js';
import * as db from '../../../src/db/index.js';
import { emailService } from '../../../src/services/email.service.js';
import type {
  OnboardingTemplate,
  OnboardingWorkflow,
  OnboardingTask,
  TemplateCreationRequest,
  WorkflowAssignmentRequest,
  WorkflowProgressSummary,
} from '../../../src/types/onboarding.js';

// Mock dependencies
vi.mock('../../../src/db/index.js');
vi.mock('../../../src/services/email.service.js');

describe('OnboardingService', () => {
  let service: OnboardingService;
  const mockTimestamp = new Date('2024-01-15T10:00:00.000Z');
  const mockUUID = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    service = new OnboardingService();
    vi.useFakeTimers();
    vi.setSystemTime(mockTimestamp);
    
    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('createTemplate', () => {
    const validRequest: TemplateCreationRequest = {
      name: 'New Hire Onboarding',
      description: 'Standard onboarding process for new employees',
      tasks: [
        {
          title: 'Complete I-9 Form',
          description: 'Fill out employment eligibility verification',
          daysUntilDue: 1,
          order: 1,
          requiresDocument: true,
        },
        {
          title: 'Setup Workstation',
          description: 'Configure computer and software',
          daysUntilDue: 2,
          order: 2,
          requiresDocument: false,
        },
      ],
      createdBy: 'hr-admin-123',
      departmentId: 'dept-456',
    };

    it('should create template successfully', async () => {
      const mockTemplateRecord = {
        id: mockUUID,
        name: validRequest.name,
        description: validRequest.description,
        is_active: true,
        created_by: validRequest.createdBy,
        department_id: validRequest.departmentId,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      const mockTaskRecords = validRequest.tasks.map((task, index) => ({
        id: `${mockUUID}-task-${index}`,
        template_id: mockUUID,
        title: task.title,
        description: task.description,
        days_until_due: task.daysUntilDue,
        order_number: task.order,
        requires_document: task.requiresDocument,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      }));

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [mockTemplateRecord] })
            .mockResolvedValueOnce({ rows: [mockTaskRecords[0]] })
            .mockResolvedValueOnce({ rows: [mockTaskRecords[1]] }),
        };
        return callback(mockClient as any);
      });

      const result = await service.createTemplate(validRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(mockUUID);
      expect(result.data?.name).toBe(validRequest.name);
      expect(result.data?.tasks).toHaveLength(2);
      expect(result.data?.tasks[0]?.title).toBe('Complete I-9 Form');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail validation when name is empty', async () => {
      const invalidRequest = {
        ...validRequest,
        name: '',
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template name is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when name exceeds 200 characters', async () => {
      const invalidRequest = {
        ...validRequest,
        name: 'a'.repeat(201),
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must not exceed 200 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when description is empty', async () => {
      const invalidRequest = {
        ...validRequest,
        description: '',
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template description is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when description exceeds 2000 characters', async () => {
      const invalidRequest = {
        ...validRequest,
        description: 'a'.repeat(2001),
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must not exceed 2000 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when no tasks provided', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [],
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one task is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when task title is empty', async () => {
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

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task 1: Title is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when task has negative days until due', async () => {
      const invalidRequest = {
        ...validRequest,
        tasks: [
          {
            title: 'Valid Title',
            description: 'Valid description',
            daysUntilDue: -1,
            order: 1,
            requiresDocument: false,
          },
        ],
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Days until due must be non-negative');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when createdBy is missing', async () => {
      const invalidRequest = {
        ...validRequest,
        createdBy: '',
      };

      const result = await service.createTemplate(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Created by user ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database transaction error', async () => {
      vi.mocked(db.executeTransaction).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.createTemplate(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.errorCode).toBe('TEMPLATE_CREATION_ERROR');
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
          department_id: null,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Description 2',
          is_active: true,
          created_by: 'user-2',
          department_id: 'dept-1',
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      const mockTasks = [
        {
          id: 'task-1',
          template_id: 'template-1',
          title: 'Task 1',
          description: 'Task 1 description',
          days_until_due: 1,
          order_number: 1,
          requires_document: true,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-2',
          template_id: 'template-2',
          title: 'Task 2',
          description: 'Task 2 description',
          days_until_due: 2,
          order_number: 1,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      vi.mocked(db.queryMany)
        .mockResolvedValueOnce(mockTemplates)
        .mockResolvedValueOnce(mockTasks);

      const result = await service.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.id).toBe('template-1');
      expect(result.data?.[0]?.tasks).toHaveLength(1);
      expect(result.data?.[1]?.id).toBe('template-2');
      expect(result.data?.[1]?.tasks).toHaveLength(1);
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(db.queryMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database query error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Query execution failed')
      );

      const result = await service.getTemplates();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query execution failed');
      expect(result.errorCode).toBe('FETCH_TEMPLATES_ERROR');
    });
  });

  describe('assignWorkflow', () => {
    const validRequest: WorkflowAssignmentRequest = {
      templateId: 'template-123',
      employeeId: 'employee-456',
      assignedBy: 'hr-admin-789',
      startDate: mockTimestamp,
      managerId: 'manager-101',
    };

    const mockTemplate = {
      id: 'template-123',
      name: 'New Hire Onboarding',
      description: 'Standard onboarding',
      is_active: true,
      created_by: 'hr-admin-789',
      department_id: null,
      created_at: mockTimestamp,
      updated_at: mockTimestamp,
    };

    const mockTemplateTasks = [
      {
        id: 'task-1',
        template_id: 'template-123',
        title: 'Complete I-9',
        description: 'Fill out form',
        days_until_due: 1,
        order_number: 1,
        requires_document: true,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      },
    ];

    const mockEmployee = {
      id: 'employee-456',
      user_id: 'user-456',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      manager_id: 'manager-101',
    };

    it('should assign workflow successfully', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockEmployee);

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTemplateTasks);

      const mockWorkflowRecord = {
        id: mockUUID,
        employee_id: validRequest.employeeId,
        template_id: validRequest.templateId,
        status: 'NOT_STARTED' as const,
        progress: 0,
        start_date: mockTimestamp,
        expected_completion_date: new Date(mockTimestamp.getTime() + 86400000),
        actual_completion_date: null,
        assigned_by: validRequest.assignedBy,
        manager_id: validRequest.managerId,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      const mockTaskRecord = {
        id: `${mockUUID}-task`,
        workflow_id: mockUUID,
        employee_id: validRequest.employeeId,
        title: 'Complete I-9',
        description: 'Fill out form',
        due_date: new Date(mockTimestamp.getTime() + 86400000),
        status: 'PENDING' as const,
        document_url: null,
        completed_at: null,
        order_number: 1,
        requires_document: true,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [mockWorkflowRecord] })
            .mockResolvedValueOnce({ rows: [mockTaskRecord] }),
        };
        return callback(mockClient as any);
      });

      vi.mocked(emailService.sendWorkflowAssignmentNotification).mockResolvedValue();

      const result = await service.assignWorkflow(validRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(mockUUID);
      expect(result.data?.employeeId).toBe(validRequest.employeeId);
      expect(result.data?.tasks).toHaveLength(1);
      expect(emailService.sendWorkflowAssignmentNotification).toHaveBeenCalled();
    });

    it('should fail validation when templateId is missing', async () => {
      const invalidRequest = {
        ...validRequest,
        templateId: '',
      };

      const result = await service.assignWorkflow(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when employeeId is missing', async () => {
      const invalidRequest = {
        ...validRequest,
        employeeId: '',
      };

      const result = await service.assignWorkflow(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail when template not found', async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      const result = await service.assignWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found or inactive');
      expect(result.errorCode).toBe('TEMPLATE_NOT_FOUND');
    });

    it('should fail when employee not found', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(null);

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTemplateTasks);

      const result = await service.assignWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should handle email notification failure gracefully', async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockEmployee);

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTemplateTasks);

      const mockWorkflowRecord = {
        id: mockUUID,
        employee_id: validRequest.employeeId,
        template_id: validRequest.templateId,
        status: 'NOT_STARTED' as const,
        progress: 0,
        start_date: mockTimestamp,
        expected_completion_date: new Date(mockTimestamp.getTime() + 86400000),
        actual_completion_date: null,
        assigned_by: validRequest.assignedBy,
        manager_id: validRequest.managerId,
        created_at: mockTimestamp,
        updated_at: mockTimestamp,
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [mockWorkflowRecord] })
            .mockResolvedValueOnce({ rows: [{ id: 'task-1' }] }),
        };
        return callback(mockClient as any);
      });

      vi.mocked(emailService.sendWorkflowAssignmentNotification).mockRejectedValue(
        new Error('Email service unavailable')
      );

      const result = await service.assignWorkflow(validRequest);

      expect(result.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send workflow assignment email'),
        expect.any(Object)
      );
    });
  });

  describe('getMyTasks', () => {
    const employeeId = 'employee-123';

    it('should return employee tasks successfully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          workflow_id: 'workflow-1',
          employee_id: employeeId,
          title: 'Complete I-9',
          description: 'Fill out form',
          due_date: mockTimestamp,
          status: 'PENDING' as const,
          document_url: null,
          completed_at: null,
          order_number: 1,
          requires_document: true,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-2',
          workflow_id: 'workflow-1',
          employee_id: employeeId,
          title: 'Setup Workstation',
          description: 'Configure computer',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: 'https://example.com/doc.pdf',
          completed_at: mockTimestamp,
          order_number: 2,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTasks);

      const result = await service.getMyTasks(employeeId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.id).toBe('task-1');
      expect(result.data?.[0]?.status).toBe('PENDING');
      expect(result.data?.[1]?.id).toBe('task-2');
      expect(result.data?.[1]?.status).toBe('COMPLETED');
    });

    it('should return empty list when no tasks exist', async () => {
      vi.mocked(db.queryMany).mockResolvedValueOnce([]);

      const result = await service.getMyTasks(employeeId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail validation when employeeId is empty', async () => {
      const result = await service.getMyTasks('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database query error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getMyTasks(employeeId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.errorCode).toBe('FETCH_TASKS_ERROR');
    });
  });

  describe('updateTaskStatus', () => {
    const taskId = 'task-123';
    const employeeId = 'employee-456';
    const documentUrl = 'https://example.com/document.pdf';

    const mockTaskRecord = {
      id: taskId,
      workflow_id: 'workflow-123',
      employee_id: employeeId,
      title: 'Complete I-9',
      description: 'Fill out form',
      due_date: mockTimestamp,
      status: 'PENDING' as const,
      document_url: null,
      completed_at: null,
      order_number: 1,
      requires_document: true,
      created_at: mockTimestamp,
      updated_at: mockTimestamp,
    };

    it('should update task status successfully', async () => {
      const updatedTaskRecord = {
        ...mockTaskRecord,
        status: 'COMPLETED' as const,
        document_url: documentUrl,
        completed_at: mockTimestamp,
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [mockTaskRecord] })
            .mockResolvedValueOnce({ rows: [updatedTaskRecord] })
            .mockResolvedValueOnce({ rows: [mockTaskRecord, updatedTaskRecord] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient as any);
      });

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({
          id: employeeId,
          user_id: 'user-456',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
        })
        .mockResolvedValueOnce({
          id: 'workflow-123',
          assigned_by: 'hr-admin-789',
        })
        .mockResolvedValueOnce({
          email: 'hr@example.com',
          first_name: 'HR',
          last_name: 'Admin',
        });

      vi.mocked(emailService.sendTaskCompletionNotification).mockResolvedValue();

      const result = await service.updateTaskStatus(taskId, employeeId, documentUrl);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('COMPLETED');
      expect(result.data?.documentUrl).toBe(documentUrl);
      expect(emailService.sendTaskCompletionNotification).toHaveBeenCalled();
    });

    it('should fail validation when taskId is empty', async () => {
      const result = await service.updateTaskStatus('', employeeId, documentUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when employeeId is empty', async () => {
      const result = await service.updateTaskStatus(taskId, '', documentUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail when task not found or unauthorized', async () => {
      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient as any);
      });

      const result = await service.updateTaskStatus(taskId, employeeId, documentUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found or unauthorized');
      expect(result.errorCode).toBe('UPDATE_TASK_ERROR');
    });

    it('should fail when document required but not provided', async () => {
      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({ rows: [mockTaskRecord] }),
        };
        return callback(mockClient as any);
      });

      const result = await service.updateTaskStatus(taskId, employeeId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document upload is required for this task');
      expect(result.errorCode).toBe('UPDATE_TASK_ERROR');
    });

    it('should handle email notification failure gracefully', async () => {
      const updatedTaskRecord = {
        ...mockTaskRecord,
        status: 'COMPLETED' as const,
        document_url: documentUrl,
        completed_at: mockTimestamp,
      };

      vi.mocked(db.executeTransaction).mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [mockTaskRecord] })
            .mockResolvedValueOnce({ rows: [updatedTaskRecord] })
            .mockResolvedValueOnce({ rows: [mockTaskRecord] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient as any);
      });

      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: employeeId,
        user_id: 'user-456',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
      });

      vi.mocked(emailService.sendTaskCompletionNotification).mockRejectedValue(
        new Error('Email service error')
      );

      const result = await service.updateTaskStatus(taskId, employeeId, documentUrl);

      expect(result.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send task completion email'),
        expect.any(Object)
      );
    });
  });

  describe('getTeamProgress', () => {
    const managerId = 'manager-123';

    it('should return team progress successfully', async () => {
      const mockWorkflows = [
        {
          id: 'workflow-1',
          employee_id: 'employee-1',
          template_id: 'template-1',
          status: 'IN_PROGRESS' as const,
          progress: 50,
          start_date: mockTimestamp,
          expected_completion_date: new Date(mockTimestamp.getTime() + 86400000 * 7),
          actual_completion_date: null,
          assigned_by: 'hr-admin',
          manager_id: managerId,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
          employee_first_name: 'John',
          employee_last_name: 'Doe',
          employee_email: 'john.doe@example.com',
          template_name: 'New Hire Onboarding',
        },
      ];

      const mockTasks = [
        {
          id: 'task-1',
          workflow_id: 'workflow-1',
          employee_id: 'employee-1',
          title: 'Task 1',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: null,
          completed_at: mockTimestamp,
          order_number: 1,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-2',
          workflow_id: 'workflow-1',
          employee_id: 'employee-1',
          title: 'Task 2',
          description: 'Description',
          due_date: new Date(mockTimestamp.getTime() - 86400000),
          status: 'PENDING' as const,
          document_url: null,
          completed_at: null,
          order_number: 2,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      vi.mocked(db.queryMany)
        .mockResolvedValueOnce(mockWorkflows)
        .mockResolvedValueOnce(mockTasks);

      const result = await service.getTeamProgress(managerId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.workflowId).toBe('workflow-1');
      expect(result.data?.[0]?.totalTasks).toBe(2);
      expect(result.data?.[0]?.completedTasks).toBe(1);
      expect(result.data?.[0]?.pendingTasks).toBe(1);
      expect(result.data?.[0]?.overdueTasks).toBe(1);
    });

    it('should return empty list when manager has no team members', async () => {
      vi.mocked(db.queryMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getTeamProgress(managerId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail validation when managerId is empty', async () => {
      const result = await service.getTeamProgress('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Manager ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database query error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Database connection lost')
      );

      const result = await service.getTeamProgress(managerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
      expect(result.errorCode).toBe('FETCH_TEAM_PROGRESS_ERROR');
    });
  });

  describe('calculateProgress', () => {
    const workflowId = 'workflow-123';

    it('should calculate progress correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 1',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: null,
          completed_at: mockTimestamp,
          order_number: 1,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-2',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 2',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: null,
          completed_at: mockTimestamp,
          order_number: 2,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-3',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 3',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'PENDING' as const,
          document_url: null,
          completed_at: null,
          order_number: 3,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-4',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 4',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'PENDING' as const,
          document_url: null,
          completed_at: null,
          order_number: 4,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTasks);

      const result = await service.calculateProgress(workflowId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(50); // 2 out of 4 tasks completed = 50%
    });

    it('should return 0 when no tasks exist', async () => {
      vi.mocked(db.queryMany).mockResolvedValueOnce([]);

      const result = await service.calculateProgress(workflowId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should return 100 when all tasks completed', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 1',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: null,
          completed_at: mockTimestamp,
          order_number: 1,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
        {
          id: 'task-2',
          workflow_id: workflowId,
          employee_id: 'employee-1',
          title: 'Task 2',
          description: 'Description',
          due_date: mockTimestamp,
          status: 'COMPLETED' as const,
          document_url: null,
          completed_at: mockTimestamp,
          order_number: 2,
          requires_document: false,
          created_at: mockTimestamp,
          updated_at: mockTimestamp,
        },
      ];

      vi.mocked(db.queryMany).mockResolvedValueOnce(mockTasks);

      const result = await service.calculateProgress(workflowId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(100);
    });

    it('should fail validation when workflowId is empty', async () => {
      const result = await service.calculateProgress('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle database query error', async () => {
      vi.mocked(db.queryMany).mockRejectedValue(
        new Error('Query timeout')
      );

      const result = await service.calculateProgress(workflowId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query timeout');
      expect(result.errorCode).toBe('CALCULATE_PROGRESS_ERROR');
    });
  });
});