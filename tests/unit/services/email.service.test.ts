/**
 * Email Service Unit Tests
 * 
 * Comprehensive test suite for EmailService class covering:
 * - Task completion notifications (success, SMTP errors, retry logic)
 * - Workflow assignment notifications (success, invalid recipients)
 * - Email content formatting and validation
 * - Error handling and logging verification
 * - Mock nodemailer transport behavior
 * 
 * @module tests/unit/services/email.service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { EmailService } from '../../../src/services/email.service.js';
import type {
  TaskCompletionNotificationData,
  WorkflowAssignmentNotificationData,
  EmailSendResult,
} from '../../../src/services/email.service.js';
import { getEmailConfig } from '../../../src/config/email.js';

// Mock nodemailer
vi.mock('nodemailer');

// Mock email config
vi.mock('../../../src/config/email.js', () => ({
  getEmailConfig: vi.fn(),
}));

// Mock console methods for log verification
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: {
    sendMail: Mock;
    verify: Mock;
    close: Mock;
  };
  let mockCreateTransport: Mock;

  const defaultEmailConfig = {
    host: 'smtp.test.com',
    port: 587,
    secure: false,
    requireAuth: true,
    auth: {
      user: 'test@example.com',
      pass: 'test-password',
    },
    from: 'noreply@example.com',
    maxRetries: 3,
    connectionTimeout: 5000,
    socketTimeout: 10000,
    debug: false,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
      close: vi.fn(),
    };

    // Mock nodemailer.createTransport
    mockCreateTransport = vi.fn().mockReturnValue(mockTransporter);
    (nodemailer.createTransport as unknown as Mock) = mockCreateTransport;

    // Mock getEmailConfig
    (getEmailConfig as Mock).mockReturnValue(defaultEmailConfig);

    // Create new service instance
    emailService = new EmailService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid configuration', async () => {
      await emailService.initialize();

      expect(getEmailConfig).toHaveBeenCalledTimes(1);
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: defaultEmailConfig.host,
        port: defaultEmailConfig.port,
        secure: defaultEmailConfig.secure,
        connectionTimeout: defaultEmailConfig.connectionTimeout,
        socketTimeout: defaultEmailConfig.socketTimeout,
        debug: defaultEmailConfig.debug,
        auth: {
          user: defaultEmailConfig.auth.user,
          pass: defaultEmailConfig.auth.pass,
        },
      });
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Email service initialized successfully'),
        expect.any(Object)
      );
    });

    it('should skip initialization if already initialized', async () => {
      await emailService.initialize();
      vi.clearAllMocks();

      await emailService.initialize();

      expect(getEmailConfig).not.toHaveBeenCalled();
      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Already initialized, skipping initialization'
      );
    });

    it('should throw error if SMTP verification fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(emailService.initialize()).rejects.toThrow(
        '[EMAIL_SERVICE] Initialization failed: SMTP connection failed'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Failed to initialize email service:',
        expect.objectContaining({
          error: 'SMTP connection failed',
        })
      );
    });

    it('should initialize without auth if requireAuth is false', async () => {
      const configWithoutAuth = {
        ...defaultEmailConfig,
        requireAuth: false,
        auth: undefined,
      };
      (getEmailConfig as Mock).mockReturnValue(configWithoutAuth);

      await emailService.initialize();

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.not.objectContaining({
          auth: expect.anything(),
        })
      );
    });
  });

  describe('sendTaskCompletionNotification', () => {
    const validNotificationData: TaskCompletionNotificationData = {
      hrAdminEmail: 'admin@example.com',
      hrAdminName: 'Jane Admin',
      employeeName: 'John Doe',
      employeeEmail: 'john@example.com',
      taskTitle: 'Complete I-9 Form',
      taskId: 'task-123',
      completedAt: new Date('2024-01-15T10:30:00Z'),
      documentInfo: {
        fileName: 'i9-form.pdf',
        fileSize: 245678,
      },
    };

    beforeEach(async () => {
      await emailService.initialize();
      vi.clearAllMocks();
    });

    it('should send task completion notification successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      const result = await emailService.sendTaskCompletionNotification(
        validNotificationData,
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.retryAttempts).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: defaultEmailConfig.from,
          to: validNotificationData.hrAdminEmail,
          subject: `Task Completed: ${validNotificationData.taskTitle}`,
          html: expect.stringContaining(validNotificationData.employeeName),
          text: expect.stringContaining(validNotificationData.taskTitle),
        })
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Task completion notification sent successfully:',
        expect.objectContaining({
          hrAdminEmail: validNotificationData.hrAdminEmail,
          employeeName: validNotificationData.employeeName,
          taskTitle: validNotificationData.taskTitle,
          messageId: 'msg-123',
        })
      );
    });

    it('should include document information in email content', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      await emailService.sendTaskCompletionNotification(validNotificationData);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).toContain('i9-form.pdf');
      expect(sendMailCall?.html).toContain('239.92 KB');
      expect(sendMailCall?.text).toContain('i9-form.pdf');
    });

    it('should handle notification without document information', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-124',
        response: '250 OK',
      });

      const dataWithoutDoc = {
        ...validNotificationData,
        documentInfo: undefined,
      };

      const result = await emailService.sendTaskCompletionNotification(dataWithoutDoc);

      expect(result.success).toBe(true);
      const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).not.toContain('Document Uploaded');
    });

    it('should validate required fields and return validation errors', async () => {
      const invalidData = {
        ...validNotificationData,
        hrAdminEmail: '',
        taskTitle: '',
      };

      const result = await emailService.sendTaskCompletionNotification(invalidData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid HR admin email address');
      expect(result.error).toContain('Task title is required');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validNotificationData,
        hrAdminEmail: 'invalid-email',
      };

      const result = await emailService.sendTaskCompletionNotification(invalidEmailData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid HR admin email address');
    });

    it('should validate completion date', async () => {
      const invalidDateData = {
        ...validNotificationData,
        completedAt: new Date('invalid'),
      };

      const result = await emailService.sendTaskCompletionNotification(invalidDateData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid completion date');
    });

    it('should retry on SMTP error and succeed', async () => {
      mockTransporter.sendMail
        .mockRejectedValueOnce(new Error('SMTP connection timeout'))
        .mockRejectedValueOnce(new Error('SMTP connection timeout'))
        .mockResolvedValueOnce({
          messageId: 'msg-retry-success',
          response: '250 OK',
        });

      const result = await emailService.sendTaskCompletionNotification(
        validNotificationData
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-retry-success');
      expect(result.retryAttempts).toBe(2);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Email send attempt failed:',
        expect.objectContaining({
          attempt: 1,
          error: 'SMTP connection timeout',
        })
      );
    });

    it('should fail after max retries exhausted', async () => {
      mockTransporter.sendMail.mockRejectedValue(
        new Error('SMTP connection refused')
      );

      const result = await emailService.sendTaskCompletionNotification(
        validNotificationData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection refused');
      expect(result.errorCode).toBe('CONNECTION_REFUSED');
      expect(result.retryAttempts).toBe(3);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(4); // Initial + 3 retries

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Email send failed after all retries:',
        expect.objectContaining({
          error: 'SMTP connection refused',
          errorCode: 'CONNECTION_REFUSED',
        })
      );
    });

    it('should categorize SMTP errors correctly', async () => {
      const errorTests = [
        { error: 'ETIMEDOUT', expectedCode: 'TIMEOUT' },
        { error: 'Authentication failed', expectedCode: 'AUTH_ERROR' },
        { error: 'Invalid recipient', expectedCode: 'RECIPIENT_ERROR' },
        { error: 'Malformed email', expectedCode: 'INVALID_EMAIL' },
        { error: 'Unknown error', expectedCode: 'SMTP_ERROR' },
      ];

      for (const { error, expectedCode } of errorTests) {
        vi.clearAllMocks();
        mockTransporter.sendMail.mockRejectedValue(new Error(error));

        const result = await emailService.sendTaskCompletionNotification(
          validNotificationData
        );

        expect(result.errorCode).toBe(expectedCode);
      }
    });

    it('should throw error if service not initialized', async () => {
      const uninitializedService = new EmailService();

      await expect(
        uninitializedService.sendTaskCompletionNotification(validNotificationData)
      ).rejects.toThrow('[EMAIL_SERVICE] Service not initialized');
    });

    it('should escape HTML in email content', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      const dataWithHtml = {
        ...validNotificationData,
        taskTitle: '<script>alert("xss")</script>',
        employeeName: 'John <b>Doe</b>',
      };

      await emailService.sendTaskCompletionNotification(dataWithHtml);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).not.toContain('<script>');
      expect(sendMailCall?.html).toContain('&lt;script&gt;');
      expect(sendMailCall?.html).toContain('&lt;b&gt;');
    });

    it('should format file sizes correctly', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      const testCases = [
        { size: 500, expected: '500 B' },
        { size: 1024, expected: '1.00 KB' },
        { size: 1048576, expected: '1.00 MB' },
        { size: 245678, expected: '239.92 KB' },
      ];

      for (const { size, expected } of testCases) {
        vi.clearAllMocks();
        const data = {
          ...validNotificationData,
          documentInfo: { fileName: 'test.pdf', fileSize: size },
        };

        await emailService.sendTaskCompletionNotification(data);

        const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
        expect(sendMailCall?.html).toContain(expected);
      }
    });

    it('should log execution time', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      const result = await emailService.sendTaskCompletionNotification(
        validNotificationData
      );

      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          executionTimeMs: expect.any(Number),
        })
      );
    });
  });

  describe('sendWorkflowAssignmentNotification', () => {
    const validWorkflowData: WorkflowAssignmentNotificationData = {
      employeeEmail: 'john@example.com',
      employeeName: 'John Doe',
      workflowName: 'New Employee Onboarding',
      taskCount: 5,
      workflowId: 'workflow-123',
      assignedAt: new Date('2024-01-15T10:30:00Z'),
      dueDate: new Date('2024-02-15T10:30:00Z'),
    };

    beforeEach(async () => {
      await emailService.initialize();
      vi.clearAllMocks();
    });

    it('should send workflow assignment notification successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-workflow-123',
        response: '250 OK',
      });

      const result = await emailService.sendWorkflowAssignmentNotification(
        validWorkflowData,
        'test-correlation-id'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-workflow-123');
      expect(result.retryAttempts).toBe(0);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: defaultEmailConfig.from,
          to: validWorkflowData.employeeEmail,
          subject: `New Onboarding Workflow Assigned: ${validWorkflowData.workflowName}`,
          html: expect.stringContaining(validWorkflowData.employeeName),
          text: expect.stringContaining(validWorkflowData.workflowName),
        })
      );
    });

    it('should include due date in email content when provided', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      await emailService.sendWorkflowAssignmentNotification(validWorkflowData);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).toContain('Due Date');
      expect(sendMailCall?.text).toContain('Due Date');
    });

    it('should handle notification without due date', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-124',
        response: '250 OK',
      });

      const dataWithoutDueDate = {
        ...validWorkflowData,
        dueDate: undefined,
      };

      const result = await emailService.sendWorkflowAssignmentNotification(
        dataWithoutDueDate
      );

      expect(result.success).toBe(true);
      const sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).not.toContain('Due Date');
    });

    it('should validate employee email address', async () => {
      const invalidEmailData = {
        ...validWorkflowData,
        employeeEmail: 'not-an-email',
      };

      const result = await emailService.sendWorkflowAssignmentNotification(
        invalidEmailData
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid employee email address');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        ...validWorkflowData,
        employeeName: '',
        workflowName: '',
        taskCount: 0,
      };

      const result = await emailService.sendWorkflowAssignmentNotification(invalidData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Employee name is required');
      expect(result.error).toContain('Workflow name is required');
      expect(result.error).toContain('Task count must be a positive number');
    });

    it('should validate task count is positive number', async () => {
      const invalidTaskCountData = {
        ...validWorkflowData,
        taskCount: -1,
      };

      const result = await emailService.sendWorkflowAssignmentNotification(
        invalidTaskCountData
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Task count must be a positive number');
    });

    it('should validate assignment date', async () => {
      const invalidDateData = {
        ...validWorkflowData,
        assignedAt: new Date('invalid'),
      };

      const result = await emailService.sendWorkflowAssignmentNotification(
        invalidDateData
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid assignment date');
    });

    it('should validate due date if provided', async () => {
      const invalidDueDateData = {
        ...validWorkflowData,
        dueDate: new Date('invalid'),
      };

      const result = await emailService.sendWorkflowAssignmentNotification(
        invalidDueDateData
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error).toContain('Invalid due date');
    });

    it('should retry on SMTP error', async () => {
      mockTransporter.sendMail
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          messageId: 'msg-retry',
          response: '250 OK',
        });

      const result = await emailService.sendWorkflowAssignmentNotification(
        validWorkflowData
      );

      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Permanent failure'));

      const result = await emailService.sendWorkflowAssignmentNotification(
        validWorkflowData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permanent failure');
      expect(result.retryAttempts).toBe(3);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(4);
    });

    it('should format task count with singular/plural', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      // Test singular
      const singleTaskData = { ...validWorkflowData, taskCount: 1 };
      await emailService.sendWorkflowAssignmentNotification(singleTaskData);
      let sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).toContain('1 task');

      vi.clearAllMocks();

      // Test plural
      const multipleTasksData = { ...validWorkflowData, taskCount: 5 };
      await emailService.sendWorkflowAssignmentNotification(multipleTasksData);
      sendMailCall = mockTransporter.sendMail.mock.calls[0]?.[0];
      expect(sendMailCall?.html).toContain('5 tasks');
    });

    it('should log workflow assignment details', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        response: '250 OK',
      });

      await emailService.sendWorkflowAssignmentNotification(validWorkflowData);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Workflow assignment notification sent successfully:',
        expect.objectContaining({
          employeeEmail: validWorkflowData.employeeEmail,
          workflowName: validWorkflowData.workflowName,
          workflowId: validWorkflowData.workflowId,
        })
      );
    });
  });

  describe('close', () => {
    it('should close transporter successfully', async () => {
      await emailService.initialize();
      vi.clearAllMocks();

      await emailService.close();

      expect(mockTransporter.close).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Email service closed successfully',
        expect.any(Object)
      );
    });

    it('should handle close when not initialized', async () => {
      await emailService.close();

      expect(mockTransporter.close).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Service not initialized, nothing to close'
      );
    });

    it('should throw error if close fails', async () => {
      await emailService.initialize();
      mockTransporter.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      await expect(emailService.close()).rejects.toThrow(
        '[EMAIL_SERVICE] Close failed: Close failed'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[EMAIL_SERVICE] Error closing email service:',
        expect.objectContaining({
          error: 'Close failed',
        })
      );
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(async () => {
      await emailService.initialize();
      vi.clearAllMocks();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockTransporter.sendMail.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await emailService.sendTaskCompletionNotification({
        hrAdminEmail: 'admin@example.com',
        hrAdminName: 'Admin',
        employeeName: 'Employee',
        employeeEmail: 'employee@example.com',
        taskTitle: 'Task',
        taskId: 'task-1',
        completedAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SEND_ERROR');
    });

    it('should handle empty string validation', async () => {
      const result = await emailService.sendTaskCompletionNotification({
        hrAdminEmail: '   ',
        hrAdminName: '   ',
        employeeName: '   ',
        employeeEmail: '   ',
        taskTitle: '   ',
        taskId: '   ',
        completedAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should implement exponential backoff for retries', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void, delay: number) => {
        delays.push(delay);
        callback();
        return 0 as any;
      }) as any);

      mockTransporter.sendMail.mockRejectedValue(new Error('Retry test'));

      await emailService.sendTaskCompletionNotification({
        hrAdminEmail: 'admin@example.com',
        hrAdminName: 'Admin',
        employeeName: 'Employee',
        employeeEmail: 'employee@example.com',
        taskTitle: 'Task',
        taskId: 'task-1',
        completedAt: new Date(),
      });

      // Verify exponential backoff: 1s, 2s, 4s
      expect(delays).toEqual([1000, 2000, 4000]);

      vi.spyOn(global, 'setTimeout').mockRestore();
    });
  });
});