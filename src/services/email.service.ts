/**
 * Email Service Module
 * 
 * Provides email notification functionality for the HR application using nodemailer.
 * Implements retry logic, error handling, and structured logging for production use.
 * Supports task completion notifications and workflow assignment notifications.
 * 
 * @module services/email
 */

import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { getEmailConfig } from '../config/email.js';
import type { EmailConfig } from '../config/email.js';

/**
 * Email notification types
 */
export type EmailNotificationType = 'task_completion' | 'workflow_assignment';

/**
 * Task completion notification data
 */
export interface TaskCompletionNotificationData {
  /**
   * HR admin email address
   */
  readonly hrAdminEmail: string;

  /**
   * HR admin name
   */
  readonly hrAdminName: string;

  /**
   * Employee who completed the task
   */
  readonly employeeName: string;

  /**
   * Employee email
   */
  readonly employeeEmail: string;

  /**
   * Task title
   */
  readonly taskTitle: string;

  /**
   * Task ID
   */
  readonly taskId: string;

  /**
   * Completion timestamp
   */
  readonly completedAt: Date;

  /**
   * Optional document information
   */
  readonly documentInfo?: {
    readonly fileName: string;
    readonly fileSize: number;
  };
}

/**
 * Workflow assignment notification data
 */
export interface WorkflowAssignmentNotificationData {
  /**
   * Employee email address
   */
  readonly employeeEmail: string;

  /**
   * Employee name
   */
  readonly employeeName: string;

  /**
   * Workflow template name
   */
  readonly workflowName: string;

  /**
   * Number of tasks in workflow
   */
  readonly taskCount: number;

  /**
   * Workflow ID
   */
  readonly workflowId: string;

  /**
   * Assignment timestamp
   */
  readonly assignedAt: Date;

  /**
   * Optional due date
   */
  readonly dueDate?: Date;
}

/**
 * Email sending result
 */
export interface EmailSendResult {
  /**
   * Whether email was sent successfully
   */
  readonly success: boolean;

  /**
   * Message ID from email server (if successful)
   */
  readonly messageId?: string;

  /**
   * Error message (if failed)
   */
  readonly error?: string;

  /**
   * Error code for programmatic handling
   */
  readonly errorCode?: string;

  /**
   * Number of retry attempts made
   */
  readonly retryAttempts: number;

  /**
   * Execution time in milliseconds
   */
  readonly executionTimeMs: number;

  /**
   * Timestamp of send attempt
   */
  readonly timestamp: Date;
}

/**
 * Email service configuration
 */
interface EmailServiceConfig {
  /**
   * Email configuration
   */
  readonly emailConfig: EmailConfig;

  /**
   * SMTP transporter
   */
  readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;
}

/**
 * Email Service Class
 * 
 * Handles all email notification functionality for the HR application.
 * Implements retry logic, error handling, and comprehensive logging.
 */
export class EmailService {
  private config: EmailServiceConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize email service
   * 
   * Creates SMTP transporter and validates configuration.
   * Must be called before sending emails.
   * 
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[EMAIL_SERVICE] Already initialized, skipping initialization');
      return;
    }

    const startTime = Date.now();

    try {
      console.log('[EMAIL_SERVICE] Initializing email service...', {
        timestamp: new Date().toISOString(),
      });

      // Load email configuration
      const emailConfig = getEmailConfig();

      // Create SMTP transporter
      const transportOptions: SMTPTransport.Options = {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        connectionTimeout: emailConfig.connectionTimeout,
        socketTimeout: emailConfig.socketTimeout,
        debug: emailConfig.debug,
      };

      // Add authentication if required
      if (emailConfig.requireAuth && emailConfig.auth) {
        transportOptions.auth = {
          user: emailConfig.auth.user,
          pass: emailConfig.auth.pass,
        };
      }

      const transporter = nodemailer.createTransport(transportOptions);

      // Verify SMTP connection
      await transporter.verify();

      this.config = {
        emailConfig,
        transporter,
      };

      this.isInitialized = true;

      const executionTimeMs = Date.now() - startTime;

      console.log('[EMAIL_SERVICE] Email service initialized successfully', {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        requireAuth: emailConfig.requireAuth,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Failed to initialize email service:', {
        error: errorMessage,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`[EMAIL_SERVICE] Initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Ensure service is initialized
   * 
   * @private
   * @throws {Error} If service is not initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error('[EMAIL_SERVICE] Service not initialized. Call initialize() first.');
    }
  }

  /**
   * Send task completion notification to HR admin
   * 
   * Notifies HR admin when an employee completes an onboarding task.
   * Includes task details and optional document information.
   * 
   * @param {TaskCompletionNotificationData} data - Notification data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<EmailSendResult>} Send result
   * 
   * @example
   * const result = await emailService.sendTaskCompletionNotification({
   *   hrAdminEmail: 'admin@company.com',
   *   hrAdminName: 'Jane Admin',
   *   employeeName: 'John Doe',
   *   employeeEmail: 'john@company.com',
   *   taskTitle: 'Complete I-9 Form',
   *   taskId: 'task-123',
   *   completedAt: new Date(),
   *   documentInfo: {
   *     fileName: 'i9-form.pdf',
   *     fileSize: 245678
   *   }
   * });
   */
  async sendTaskCompletionNotification(
    data: TaskCompletionNotificationData,
    correlationId?: string
  ): Promise<EmailSendResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `task_completion_${Date.now()}`;

    console.log('[EMAIL_SERVICE] Sending task completion notification:', {
      hrAdminEmail: data.hrAdminEmail,
      employeeName: data.employeeName,
      taskTitle: data.taskTitle,
      taskId: data.taskId,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input data
      const validationErrors: string[] = [];

      if (!data.hrAdminEmail || !this.isValidEmail(data.hrAdminEmail)) {
        validationErrors.push('Invalid HR admin email address');
      }
      if (!data.hrAdminName || data.hrAdminName.trim().length === 0) {
        validationErrors.push('HR admin name is required');
      }
      if (!data.employeeName || data.employeeName.trim().length === 0) {
        validationErrors.push('Employee name is required');
      }
      if (!data.employeeEmail || !this.isValidEmail(data.employeeEmail)) {
        validationErrors.push('Invalid employee email address');
      }
      if (!data.taskTitle || data.taskTitle.trim().length === 0) {
        validationErrors.push('Task title is required');
      }
      if (!data.taskId || data.taskId.trim().length === 0) {
        validationErrors.push('Task ID is required');
      }
      if (!(data.completedAt instanceof Date) || isNaN(data.completedAt.getTime())) {
        validationErrors.push('Invalid completion date');
      }

      if (validationErrors.length > 0) {
        const executionTimeMs = Date.now() - startTime;

        console.error('[EMAIL_SERVICE] Task completion notification validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          executionTimeMs,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          retryAttempts: 0,
          executionTimeMs,
          timestamp,
        };
      }

      // Build email content
      const subject = `Task Completed: ${data.taskTitle}`;
      const htmlContent = this.buildTaskCompletionEmailHtml(data);
      const textContent = this.buildTaskCompletionEmailText(data);

      // Send email with retry logic
      const result = await this.sendEmailWithRetry(
        {
          to: data.hrAdminEmail,
          subject,
          html: htmlContent,
          text: textContent,
        },
        cid
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        console.log('[EMAIL_SERVICE] Task completion notification sent successfully:', {
          hrAdminEmail: data.hrAdminEmail,
          employeeName: data.employeeName,
          taskTitle: data.taskTitle,
          taskId: data.taskId,
          messageId: result.messageId,
          retryAttempts: result.retryAttempts,
          executionTimeMs,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });
      } else {
        console.error('[EMAIL_SERVICE] Task completion notification failed:', {
          hrAdminEmail: data.hrAdminEmail,
          employeeName: data.employeeName,
          taskTitle: data.taskTitle,
          taskId: data.taskId,
          error: result.error,
          errorCode: result.errorCode,
          retryAttempts: result.retryAttempts,
          executionTimeMs,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });
      }

      return {
        ...result,
        executionTimeMs,
        timestamp,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Task completion notification error:', {
        hrAdminEmail: data.hrAdminEmail,
        employeeName: data.employeeName,
        taskTitle: data.taskTitle,
        taskId: data.taskId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'SEND_ERROR',
        retryAttempts: 0,
        executionTimeMs,
        timestamp,
      };
    }
  }

  /**
   * Send workflow assignment notification to employee
   * 
   * Notifies employee when an onboarding workflow is assigned to them.
   * Includes workflow details and task count.
   * 
   * @param {WorkflowAssignmentNotificationData} data - Notification data
   * @param {string} [correlationId] - Optional correlation ID for tracing
   * @returns {Promise<EmailSendResult>} Send result
   * 
   * @example
   * const result = await emailService.sendWorkflowAssignmentNotification({
   *   employeeEmail: 'john@company.com',
   *   employeeName: 'John Doe',
   *   workflowName: 'New Employee Onboarding',
   *   taskCount: 5,
   *   workflowId: 'workflow-123',
   *   assignedAt: new Date(),
   *   dueDate: new Date('2024-12-31')
   * });
   */
  async sendWorkflowAssignmentNotification(
    data: WorkflowAssignmentNotificationData,
    correlationId?: string
  ): Promise<EmailSendResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const timestamp = new Date();
    const cid = correlationId || `workflow_assignment_${Date.now()}`;

    console.log('[EMAIL_SERVICE] Sending workflow assignment notification:', {
      employeeEmail: data.employeeEmail,
      employeeName: data.employeeName,
      workflowName: data.workflowName,
      workflowId: data.workflowId,
      taskCount: data.taskCount,
      correlationId: cid,
      timestamp: timestamp.toISOString(),
    });

    try {
      // Validate input data
      const validationErrors: string[] = [];

      if (!data.employeeEmail || !this.isValidEmail(data.employeeEmail)) {
        validationErrors.push('Invalid employee email address');
      }
      if (!data.employeeName || data.employeeName.trim().length === 0) {
        validationErrors.push('Employee name is required');
      }
      if (!data.workflowName || data.workflowName.trim().length === 0) {
        validationErrors.push('Workflow name is required');
      }
      if (!data.workflowId || data.workflowId.trim().length === 0) {
        validationErrors.push('Workflow ID is required');
      }
      if (typeof data.taskCount !== 'number' || data.taskCount < 1) {
        validationErrors.push('Task count must be a positive number');
      }
      if (!(data.assignedAt instanceof Date) || isNaN(data.assignedAt.getTime())) {
        validationErrors.push('Invalid assignment date');
      }
      if (data.dueDate && (!(data.dueDate instanceof Date) || isNaN(data.dueDate.getTime()))) {
        validationErrors.push('Invalid due date');
      }

      if (validationErrors.length > 0) {
        const executionTimeMs = Date.now() - startTime;

        console.error('[EMAIL_SERVICE] Workflow assignment notification validation failed:', {
          errors: validationErrors,
          correlationId: cid,
          executionTimeMs,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: false,
          error: validationErrors.join(', '),
          errorCode: 'VALIDATION_ERROR',
          retryAttempts: 0,
          executionTimeMs,
          timestamp,
        };
      }

      // Build email content
      const subject = `New Onboarding Workflow Assigned: ${data.workflowName}`;
      const htmlContent = this.buildWorkflowAssignmentEmailHtml(data);
      const textContent = this.buildWorkflowAssignmentEmailText(data);

      // Send email with retry logic
      const result = await this.sendEmailWithRetry(
        {
          to: data.employeeEmail,
          subject,
          html: htmlContent,
          text: textContent,
        },
        cid
      );

      const executionTimeMs = Date.now() - startTime;

      if (result.success) {
        console.log('[EMAIL_SERVICE] Workflow assignment notification sent successfully:', {
          employeeEmail: data.employeeEmail,
          employeeName: data.employeeName,
          workflowName: data.workflowName,
          workflowId: data.workflowId,
          messageId: result.messageId,
          retryAttempts: result.retryAttempts,
          executionTimeMs,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });
      } else {
        console.error('[EMAIL_SERVICE] Workflow assignment notification failed:', {
          employeeEmail: data.employeeEmail,
          employeeName: data.employeeName,
          workflowName: data.workflowName,
          workflowId: data.workflowId,
          error: result.error,
          errorCode: result.errorCode,
          retryAttempts: result.retryAttempts,
          executionTimeMs,
          correlationId: cid,
          timestamp: timestamp.toISOString(),
        });
      }

      return {
        ...result,
        executionTimeMs,
        timestamp,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Workflow assignment notification error:', {
        employeeEmail: data.employeeEmail,
        employeeName: data.employeeName,
        workflowName: data.workflowName,
        workflowId: data.workflowId,
        error: errorMessage,
        executionTimeMs,
        correlationId: cid,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'SEND_ERROR',
        retryAttempts: 0,
        executionTimeMs,
        timestamp,
      };
    }
  }

  /**
   * Send email with retry logic
   * 
   * @private
   * @param {SendMailOptions} mailOptions - Email options
   * @param {string} correlationId - Correlation ID for tracing
   * @returns {Promise<EmailSendResult>} Send result
   */
  private async sendEmailWithRetry(
    mailOptions: SendMailOptions,
    correlationId: string
  ): Promise<EmailSendResult> {
    if (!this.config) {
      throw new Error('[EMAIL_SERVICE] Service not initialized');
    }

    const { emailConfig, transporter } = this.config;
    const maxRetries = emailConfig.maxRetries;
    let lastError: Error | null = null;
    let retryAttempts = 0;

    // Add from address
    const fullMailOptions: SendMailOptions = {
      ...mailOptions,
      from: emailConfig.from,
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      retryAttempts = attempt;

      try {
        console.log('[EMAIL_SERVICE] Sending email (attempt ${attempt + 1}/${maxRetries + 1}):', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        const info = await transporter.sendMail(fullMailOptions);

        console.log('[EMAIL_SERVICE] Email sent successfully:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          messageId: info.messageId,
          response: info.response,
          attempt: attempt + 1,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          messageId: info.messageId,
          retryAttempts,
          executionTimeMs: 0, // Will be set by caller
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn('[EMAIL_SERVICE] Email send attempt failed:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          error: lastError.message,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delayMs = Math.pow(2, attempt) * 1000;

          console.log('[EMAIL_SERVICE] Retrying email send after delay:', {
            delayMs,
            nextAttempt: attempt + 2,
            correlationId,
            timestamp: new Date().toISOString(),
          });

          await this.delay(delayMs);
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || 'Unknown error';
    const errorCode = this.getErrorCode(lastError);

    console.error('[EMAIL_SERVICE] Email send failed after all retries:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      error: errorMessage,
      errorCode,
      retryAttempts,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      error: errorMessage,
      errorCode,
      retryAttempts,
      executionTimeMs: 0, // Will be set by caller
      timestamp: new Date(),
    };
  }

  /**
   * Build HTML content for task completion email
   * 
   * @private
   * @param {TaskCompletionNotificationData} data - Notification data
   * @returns {string} HTML content
   */
  private buildTaskCompletionEmailHtml(data: TaskCompletionNotificationData): string {
    const documentSection = data.documentInfo
      ? `
        <tr>
          <td style="padding: 15px 0; border-top: 1px solid #e0e0e0;">
            <strong>Document Uploaded:</strong><br>
            ${this.escapeHtml(data.documentInfo.fileName)} (${this.formatFileSize(data.documentInfo.fileSize)})
          </td>
        </tr>
      `
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 30px;">
              <h1 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Task Completed</h1>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hello ${this.escapeHtml(data.hrAdminName)},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                <strong>${this.escapeHtml(data.employeeName)}</strong> has completed an onboarding task.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 4px; padding: 20px; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px 0;">
                    <strong>Task:</strong><br>
                    ${this.escapeHtml(data.taskTitle)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e0e0e0;">
                    <strong>Employee:</strong><br>
                    ${this.escapeHtml(data.employeeName)} (${this.escapeHtml(data.employeeEmail)})
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e0e0e0;">
                    <strong>Completed:</strong><br>
                    ${this.formatDate(data.completedAt)}
                  </td>
                </tr>
                ${documentSection}
              </table>
              
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                This is an automated notification from the HR Onboarding System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Build plain text content for task completion email
   * 
   * @private
   * @param {TaskCompletionNotificationData} data - Notification data
   * @returns {string} Plain text content
   */
  private buildTaskCompletionEmailText(data: TaskCompletionNotificationData): string {
    const documentSection = data.documentInfo
      ? `\nDocument Uploaded: ${data.documentInfo.fileName} (${this.formatFileSize(data.documentInfo.fileSize)})`
      : '';

    return `
Task Completed

Hello ${data.hrAdminName},

${data.employeeName} has completed an onboarding task.

Task Details:
-------------
Task: ${data.taskTitle}
Employee: ${data.employeeName} (${data.employeeEmail})
Completed: ${this.formatDate(data.completedAt)}${documentSection}

This is an automated notification from the HR Onboarding System.
    `.trim();
  }

  /**
   * Build HTML content for workflow assignment email
   * 
   * @private
   * @param {WorkflowAssignmentNotificationData} data - Notification data
   * @returns {string} HTML content
   */
  private buildWorkflowAssignmentEmailHtml(data: WorkflowAssignmentNotificationData): string {
    const dueDateSection = data.dueDate
      ? `
        <tr>
          <td style="padding: 10px 0; border-top: 1px solid #e0e0e0;">
            <strong>Due Date:</strong><br>
            ${this.formatDate(data.dueDate)}
          </td>
        </tr>
      `
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Onboarding Workflow Assigned</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 30px;">
              <h1 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Welcome to Your Onboarding!</h1>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Hello ${this.escapeHtml(data.employeeName)},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                A new onboarding workflow has been assigned to you. Please complete the tasks to finish your onboarding process.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 4px; padding: 20px; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px 0;">
                    <strong>Workflow:</strong><br>
                    ${this.escapeHtml(data.workflowName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e0e0e0;">
                    <strong>Number of Tasks:</strong><br>
                    ${data.taskCount} ${data.taskCount === 1 ? 'task' : 'tasks'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e0e0e0;">
                    <strong>Assigned:</strong><br>
                    ${this.formatDate(data.assignedAt)}
                  </td>
                </tr>
                ${dueDateSection}
              </table>
              
              <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Please log in to the HR portal to view and complete your onboarding tasks.
              </p>
              
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                This is an automated notification from the HR Onboarding System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Build plain text content for workflow assignment email
   * 
   * @private
   * @param {WorkflowAssignmentNotificationData} data - Notification data
   * @returns {string} Plain text content
   */
  private buildWorkflowAssignmentEmailText(data: WorkflowAssignmentNotificationData): string {
    const dueDateSection = data.dueDate
      ? `\nDue Date: ${this.formatDate(data.dueDate)}`
      : '';

    return `
Welcome to Your Onboarding!

Hello ${data.employeeName},

A new onboarding workflow has been assigned to you. Please complete the tasks to finish your onboarding process.

Workflow Details:
-----------------
Workflow: ${data.workflowName}
Number of Tasks: ${data.taskCount} ${data.taskCount === 1 ? 'task' : 'tasks'}
Assigned: ${this.formatDate(data.assignedAt)}${dueDateSection}

Please log in to the HR portal to view and complete your onboarding tasks.

This is an automated notification from the HR Onboarding System.
    `.trim();
  }

  /**
   * Validate email address format
   * 
   * @private
   * @param {string} email - Email address to validate
   * @returns {boolean} True if valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Escape HTML special characters
   * 
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  private escapeHtml(text: string): string {
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
  }

  /**
   * Format date for display
   * 
   * @private
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  /**
   * Format file size for display
   * 
   * @private
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  /**
   * Get error code from error object
   * 
   * @private
   * @param {Error | null} error - Error object
   * @returns {string} Error code
   */
  private getErrorCode(error: Error | null): string {
    if (!error) {
      return 'UNKNOWN_ERROR';
    }

    // Check for common SMTP error codes
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
      return 'CONNECTION_REFUSED';
    }
    if (errorMessage.includes('etimedout') || errorMessage.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
      return 'AUTH_ERROR';
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
      return 'INVALID_EMAIL';
    }
    if (errorMessage.includes('recipient') || errorMessage.includes('mailbox')) {
      return 'RECIPIENT_ERROR';
    }

    return 'SMTP_ERROR';
  }

  /**
   * Delay execution
   * 
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close email service and cleanup resources
   * 
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    if (!this.isInitialized || !this.config) {
      console.log('[EMAIL_SERVICE] Service not initialized, nothing to close');
      return;
    }

    try {
      console.log('[EMAIL_SERVICE] Closing email service...', {
        timestamp: new Date().toISOString(),
      });

      // Close transporter
      this.config.transporter.close();

      this.config = null;
      this.isInitialized = false;

      console.log('[EMAIL_SERVICE] Email service closed successfully', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Error closing email service:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`[EMAIL_SERVICE] Close failed: ${errorMessage}`);
    }
  }
}

/**
 * Singleton email service instance
 */
export const emailService = new EmailService();

/**
 * Export default instance
 */
export default emailService;