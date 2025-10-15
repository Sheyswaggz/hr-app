/**
 * Email Service Unit Tests
 * 
 * Comprehensive test suite for EmailService class covering:
 * - Task completion notifications
 * - Workflow assignment notifications
 * - SMTP error handling
 * - Retry logic
 * - Email content formatting
 * - Error logging
 * 
 * @module tests/unit/services/email.service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import {
  EmailService,
  type TaskCompletionData,
  type WorkflowAssignmentData,
  type EmailResult,
} from '../../../src/services/email.service.js';

// Mock nodemailer
vi.mock('nodemailer');

// Mock email config
vi.mock('../../../src/config/email.js', () => ({
  getEmailConfig: vi.fn(() => ({
    enabled: true,
    host: 'smtp.test.com',
    port: 587,
    secure: false,
    auth: {
      user: 'test@example.com',
      pass: 'testpassword',
    },
    from: 'noreply@example.com',
    maxRetries: 3,
    retryDelay: 1000,
    connectionTimeout: 5000,
    socketTimeout: 10000,
  })),
  isEmailEnabled: vi.fn(() => true),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: {
    sendMail: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock transporter
    mockTransporter = {
      sendMail: vi.fn(),
      verify: vi.fn(),
      close: vi.fn(),
    };

    // Mock nodemailer.createTransport
    vi.mocked(nodemailer.createTransport).mockReturnValue(
      mockTransporter as unknown as Transporter<SMTPTransport.SentMessageInfo>
    );

    // Create new service instance
    emailService = new EmailService();

    // Mock console methods to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendTaskCompletionNotification', () => {
    const mockTaskCompletionData: TaskCompletionData = {
      employee: {
        id: 'emp-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      },
      task: {
        id: 'task-456',
        title: 'Complete I-9 Form',
        description: 'Fill out and submit I-9 employment verification form',
        completedAt: new Date('2024-01-15T10:30:00Z'),
      },
      hrAdmin: {
        email: 'hr@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      },
      documents: [
        { filename: 'i9-form.pdf', size: 102400 },
        { filename: 'id-scan.jpg', size: 51200 },
      ],
    };

    it('should send task completion notification successfully', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['hr@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.retryAttempts).toBe(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify transporter was created and verified
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);

      // Verify email was sent with correct parameters
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];

      expect(emailCall.from).toBe('noreply@example.com');
      expect(emailCall.to).toBe('"Jane Smith" <hr@example.com>');
      expect(emailCall.subject).toContain('Task Completed');
      expect(emailCall.subject).toContain('Complete I-9 Form');
      expect(emailCall.subject).toContain('John Doe');
      expect(emailCall.text).toContain('John Doe');
      expect(emailCall.text).toContain('Complete I-9 Form');
      expect(emailCall.text).toContain('i9-form.pdf');
      expect(emailCall.html).toContain('John Doe');
      expect(emailCall.html).toContain('Complete I-9 Form');
      expect(emailCall.html).toContain('i9-form.pdf');
    });

    it('should send notification without documents', async () => {
      // Arrange
      const dataWithoutDocs: TaskCompletionData = {
        ...mockTaskCompletionData,
        documents: undefined,
      };

      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-124',
        accepted: ['hr@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendTaskCompletionNotification(dataWithoutDocs);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.text).not.toContain('Documents Uploaded');
      expect(emailCall.html).not.toContain('Documents Uploaded');
    });

    it('should send notification without task description', async () => {
      // Arrange
      const dataWithoutDescription: TaskCompletionData = {
        ...mockTaskCompletionData,
        task: {
          ...mockTaskCompletionData.task,
          description: undefined,
        },
      };

      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-125',
        accepted: ['hr@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendTaskCompletionNotification(dataWithoutDescription);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.text).not.toContain('Description:');
    });

    it('should handle SMTP connection error', async () => {
      // Arrange
      mockTransporter.verify.mockRejectedValue(new Error('SMTP connection failed'));

      // Act
      const result = await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Initialization failed');
      expect(result.errorCode).toBe('INITIALIZATION_ERROR');
      expect(result.retryAttempts).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle SMTP send error with retry', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // First 3 attempts fail with retryable error
      mockTransporter.sendMail
        .mockRejectedValueOnce(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }))
        .mockRejectedValueOnce(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }))
        .mockRejectedValueOnce(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce({
          messageId: 'msg-126',
          accepted: ['hr@example.com'],
          rejected: [],
          response: '250 OK',
        });

      // Act
      const result = await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-126');
      expect(result.retryAttempts).toBe(3);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(4);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should fail after max retries exceeded', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // All attempts fail
      const error = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
      mockTransporter.sendMail.mockRejectedValue(error);

      // Act
      const result = await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
      expect(result.errorCode).toBe('ETIMEDOUT');
      expect(result.retryAttempts).toBe(4); // Initial + 3 retries
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(4);
      expect(console.error).toHaveBeenCalled();
    });

    it('should not retry non-retryable errors', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // Non-retryable error (authentication failure)
      const error = Object.assign(new Error('Authentication failed'), { code: 535 });
      mockTransporter.sendMail.mockRejectedValue(error);

      // Act
      const result = await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.retryAttempts).toBe(1); // Only initial attempt
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should format email content correctly', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-127',
        accepted: ['hr@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];

      // Check text content
      expect(emailCall.text).toContain('Hello Jane');
      expect(emailCall.text).toContain('John Doe has completed');
      expect(emailCall.text).toContain('Complete I-9 Form');
      expect(emailCall.text).toContain('Fill out and submit I-9');
      expect(emailCall.text).toContain('i9-form.pdf (100.00 KB)');
      expect(emailCall.text).toContain('id-scan.jpg (50.00 KB)');
      expect(emailCall.text).toContain('john.doe@example.com');

      // Check HTML content
      expect(emailCall.html).toContain('<!DOCTYPE html>');
      expect(emailCall.html).toContain('Task Completed');
      expect(emailCall.html).toContain('Hello Jane');
      expect(emailCall.html).toContain('<strong>John Doe</strong>');
      expect(emailCall.html).toContain('Complete I-9 Form');
      expect(emailCall.html).toContain('i9-form.pdf');
      expect(emailCall.html).toContain('100.00 KB');
    });

    it('should log email sending events', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-128',
        accepted: ['hr@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      await emailService.sendTaskCompletionNotification(mockTaskCompletionData);

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Sending task completion notification:'),
        expect.objectContaining({
          taskId: 'task-456',
          employeeId: 'emp-123',
          hrAdminEmail: 'hr@example.com',
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Email sent successfully:'),
        expect.objectContaining({
          messageId: 'msg-128',
        })
      );
    });
  });

  describe('sendWorkflowAssignmentNotification', () => {
    const mockWorkflowAssignmentData: WorkflowAssignmentData = {
      employee: {
        id: 'emp-789',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
      },
      workflow: {
        id: 'workflow-101',
        templateName: 'New Hire Onboarding',
        taskCount: 5,
        dueDate: new Date('2024-02-01T00:00:00Z'),
      },
      tasks: [
        {
          title: 'Complete I-9 Form',
          description: 'Fill out employment verification',
          dueDate: new Date('2024-01-20T00:00:00Z'),
        },
        {
          title: 'Review Company Policies',
          dueDate: new Date('2024-01-22T00:00:00Z'),
        },
        {
          title: 'Setup Email Account',
        },
      ],
      assignedBy: {
        firstName: 'Bob',
        lastName: 'Manager',
      },
    };

    it('should send workflow assignment notification successfully', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-201',
        accepted: ['alice.johnson@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendWorkflowAssignmentNotification(mockWorkflowAssignmentData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-201');
      expect(result.retryAttempts).toBe(0);

      // Verify email parameters
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];

      expect(emailCall.to).toBe('"Alice Johnson" <alice.johnson@example.com>');
      expect(emailCall.subject).toContain('New Onboarding Workflow Assigned');
      expect(emailCall.subject).toContain('New Hire Onboarding');
      expect(emailCall.text).toContain('Hello Alice');
      expect(emailCall.text).toContain('New Hire Onboarding');
      expect(emailCall.text).toContain('5');
      expect(emailCall.text).toContain('Complete I-9 Form');
      expect(emailCall.html).toContain('Welcome, Alice!');
      expect(emailCall.html).toContain('New Hire Onboarding');
    });

    it('should send notification without workflow due date', async () => {
      // Arrange
      const dataWithoutDueDate: WorkflowAssignmentData = {
        ...mockWorkflowAssignmentData,
        workflow: {
          ...mockWorkflowAssignmentData.workflow,
          dueDate: undefined,
        },
      };

      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-202',
        accepted: ['alice.johnson@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendWorkflowAssignmentNotification(dataWithoutDueDate);

      // Assert
      expect(result.success).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.text).not.toContain('Due Date:');
    });

    it('should send notification without assigned by information', async () => {
      // Arrange
      const dataWithoutAssignedBy: WorkflowAssignmentData = {
        ...mockWorkflowAssignmentData,
        assignedBy: {},
      };

      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-203',
        accepted: ['alice.johnson@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      const result = await emailService.sendWorkflowAssignmentNotification(dataWithoutAssignedBy);

      // Assert
      expect(result.success).toBe(true);
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.text).not.toContain('Assigned by:');
    });

    it('should handle invalid recipient email', async () => {
      // Arrange
      const dataWithInvalidEmail: WorkflowAssignmentData = {
        ...mockWorkflowAssignmentData,
        employee: {
          ...mockWorkflowAssignmentData.employee,
          email: '',
        },
      };

      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockRejectedValue(
        Object.assign(new Error('Invalid recipient'), { code: 'EENVELOPE' })
      );

      // Act
      const result = await emailService.sendWorkflowAssignmentNotification(dataWithInvalidEmail);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient');
    });

    it('should format workflow email content correctly', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-204',
        accepted: ['alice.johnson@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      await emailService.sendWorkflowAssignmentNotification(mockWorkflowAssignmentData);

      // Assert
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];

      // Check text content
      expect(emailCall.text).toContain('Hello Alice');
      expect(emailCall.text).toContain('New Hire Onboarding');
      expect(emailCall.text).toContain('Tasks: 5');
      expect(emailCall.text).toContain('1. Complete I-9 Form');
      expect(emailCall.text).toContain('Fill out employment verification');
      expect(emailCall.text).toContain('2. Review Company Policies');
      expect(emailCall.text).toContain('3. Setup Email Account');
      expect(emailCall.text).toContain('Assigned by: Bob Manager');

      // Check HTML content
      expect(emailCall.html).toContain('<!DOCTYPE html>');
      expect(emailCall.html).toContain('New Onboarding Workflow');
      expect(emailCall.html).toContain('Welcome, Alice!');
      expect(emailCall.html).toContain('New Hire Onboarding');
      expect(emailCall.html).toContain('Total Tasks:</span> 5');
      expect(emailCall.html).toContain('1. Complete I-9 Form');
      expect(emailCall.html).toContain('Fill out employment verification');
    });

    it('should handle SMTP error with retry for workflow notification', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // First attempt fails, second succeeds
      mockTransporter.sendMail
        .mockRejectedValueOnce(Object.assign(new Error('Temporary failure'), { code: 'ECONNRESET' }))
        .mockResolvedValueOnce({
          messageId: 'msg-205',
          accepted: ['alice.johnson@example.com'],
          rejected: [],
          response: '250 OK',
        });

      // Act
      const result = await emailService.sendWorkflowAssignmentNotification(mockWorkflowAssignmentData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-205');
      expect(result.retryAttempts).toBe(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should log workflow assignment events', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-206',
        accepted: ['alice.johnson@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      await emailService.sendWorkflowAssignmentNotification(mockWorkflowAssignmentData);

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Sending workflow assignment notification:'),
        expect.objectContaining({
          workflowId: 'workflow-101',
          employeeId: 'emp-789',
          employeeEmail: 'alice.johnson@example.com',
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Email sent successfully:'),
        expect.objectContaining({
          messageId: 'msg-206',
        })
      );
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should identify retryable network errors', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      const retryableErrors = [
        { code: 'ECONNREFUSED', message: 'Connection refused' },
        { code: 'ECONNRESET', message: 'Connection reset' },
        { code: 'ETIMEDOUT', message: 'Connection timeout' },
        { code: 'ENOTFOUND', message: 'DNS lookup failed' },
        { code: 'ENETUNREACH', message: 'Network unreachable' },
        { code: 'EAI_AGAIN', message: 'DNS temporary failure' },
      ];

      for (const errorInfo of retryableErrors) {
        vi.clearAllMocks();
        mockTransporter.sendMail
          .mockRejectedValueOnce(Object.assign(new Error(errorInfo.message), { code: errorInfo.code }))
          .mockResolvedValueOnce({
            messageId: 'msg-success',
            accepted: ['test@example.com'],
            rejected: [],
            response: '250 OK',
          });

        // Act
        const result = await emailService.sendTaskCompletionNotification({
          employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
          task: { id: '1', title: 'Test', completedAt: new Date() },
          hrAdmin: { email: 'hr@example.com' },
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.retryAttempts).toBe(1);
      }
    });

    it('should not retry non-retryable errors', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      const nonRetryableErrors = [
        { code: 550, message: 'Mailbox unavailable' },
        { code: 551, message: 'User not local' },
        { code: 552, message: 'Exceeded storage allocation' },
        { code: 553, message: 'Mailbox name not allowed' },
      ];

      for (const errorInfo of nonRetryableErrors) {
        vi.clearAllMocks();
        mockTransporter.sendMail.mockRejectedValue(
          Object.assign(new Error(errorInfo.message), { code: errorInfo.code })
        );

        // Act
        const result = await emailService.sendTaskCompletionNotification({
          employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
          task: { id: '1', title: 'Test', completedAt: new Date() },
          hrAdmin: { email: 'hr@example.com' },
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.retryAttempts).toBe(1); // Only initial attempt
        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      }
    });

    it('should apply exponential backoff between retries', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      const sendTimes: number[] = [];
      mockTransporter.sendMail.mockImplementation(() => {
        sendTimes.push(Date.now());
        if (sendTimes.length < 3) {
          return Promise.reject(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }));
        }
        return Promise.resolve({
          messageId: 'msg-success',
          accepted: ['test@example.com'],
          rejected: [],
          response: '250 OK',
        });
      });

      // Act
      const result = await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(2);
      expect(sendTimes.length).toBe(3);

      // Check backoff delays (approximately 1s, 2s)
      const delay1 = sendTimes[1]! - sendTimes[0]!;
      const delay2 = sendTimes[2]! - sendTimes[1]!;

      expect(delay1).toBeGreaterThanOrEqual(900); // ~1s with tolerance
      expect(delay1).toBeLessThan(1500);
      expect(delay2).toBeGreaterThanOrEqual(1900); // ~2s with tolerance
      expect(delay2).toBeLessThan(2500);
    });

    it('should log retry attempts', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail
        .mockRejectedValueOnce(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce({
          messageId: 'msg-success',
          accepted: ['test@example.com'],
          rejected: [],
          response: '250 OK',
        });

      // Act
      await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Email send attempt failed:'),
        expect.objectContaining({
          attempt: 1,
          error: 'Timeout',
          code: 'ETIMEDOUT',
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Retrying after backoff:'),
        expect.objectContaining({
          attempt: 1,
        })
      );
    });
  });

  describe('Service Initialization', () => {
    it('should initialize transporter on first email send', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-init',
        accepted: ['test@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act
      await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    });

    it('should reuse transporter for subsequent emails', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'msg-reuse',
        accepted: ['test@example.com'],
        rejected: [],
        response: '250 OK',
      });

      // Act - Send two emails
      await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      await emailService.sendTaskCompletionNotification({
        employee: { id: '2', firstName: 'Test2', lastName: 'User2', email: 'test2@example.com' },
        task: { id: '2', title: 'Test2', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert - Transporter created only once
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should handle initialization failure', async () => {
      // Arrange
      mockTransporter.verify.mockRejectedValue(new Error('SMTP server unavailable'));

      // Act
      const result = await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Initialization failed');
      expect(result.errorCode).toBe('INITIALIZATION_ERROR');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL_SERVICE] Failed to initialize email service:'),
        expect.any(Object)
      );
    });
  });

  describe('Email Service Disabled', () => {
    it('should return error when email service is disabled', async () => {
      // Arrange
      const { isEmailEnabled } = await import('../../../src/config/email.js');
      vi.mocked(isEmailEnabled).mockReturnValue(false);

      // Act
      const result = await emailService.sendTaskCompletionNotification({
        employee: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        task: { id: '1', title: 'Test', completedAt: new Date() },
        hrAdmin: { email: 'hr@example.com' },
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service is disabled');
      expect(result.errorCode).toBe('SERVICE_DISABLED');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });
});