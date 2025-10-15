/**
 * Email Service Module
 * 
 * Provides email notification functionality using nodemailer with SMTP transport.
 * Implements retry logic for transient failures and comprehensive error handling.
 * Supports HTML email templates for professional communication.
 * 
 * @module services/email
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

import { getEmailConfig, isEmailEnabled } from '../config/email.js';

/**
 * Email recipient information
 */
export interface EmailRecipient {
  /**
   * Recipient email address
   */
  readonly email: string;

  /**
   * Optional recipient name
   */
  readonly name?: string;
}

/**
 * Email sending options
 */
export interface EmailOptions {
  /**
   * Email recipient(s)
   */
  readonly to: EmailRecipient | EmailRecipient[];

  /**
   * Email subject line
   */
  readonly subject: string;

  /**
   * Plain text email body
   */
  readonly text: string;

  /**
   * HTML email body
   */
  readonly html: string;

  /**
   * Optional CC recipients
   */
  readonly cc?: EmailRecipient | EmailRecipient[];

  /**
   * Optional BCC recipients
   */
  readonly bcc?: EmailRecipient | EmailRecipient[];

  /**
   * Optional reply-to address
   */
  readonly replyTo?: string;

  /**
   * Optional correlation ID for tracing
   */
  readonly correlationId?: string;
}

/**
 * Email sending result
 */
export interface EmailResult {
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
   * Timestamp when email was sent
   */
  readonly timestamp: Date;
}

/**
 * Task completion notification data
 */
export interface TaskCompletionData {
  /**
   * Employee who completed the task
   */
  readonly employee: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
  };

  /**
   * Completed task information
   */
  readonly task: {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly completedAt: Date;
  };

  /**
   * HR admin to notify
   */
  readonly hrAdmin: {
    readonly email: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };

  /**
   * Optional uploaded documents
   */
  readonly documents?: Array<{
    readonly filename: string;
    readonly size: number;
  }>;
}

/**
 * Workflow assignment notification data
 */
export interface WorkflowAssignmentData {
  /**
   * Employee assigned to workflow
   */
  readonly employee: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
  };

  /**
   * Workflow information
   */
  readonly workflow: {
    readonly id: string;
    readonly templateName: string;
    readonly taskCount: number;
    readonly dueDate?: Date;
  };

  /**
   * Tasks in the workflow
   */
  readonly tasks: Array<{
    readonly title: string;
    readonly description?: string;
    readonly dueDate?: Date;
  }>;

  /**
   * HR admin who assigned the workflow
   */
  readonly assignedBy: {
    readonly firstName?: string;
    readonly lastName?: string;
  };
}

/**
 * Email Service Class
 * 
 * Handles all email sending operations with retry logic and error handling.
 * Uses nodemailer with SMTP transport configured from environment variables.
 */
export class EmailService {
  /**
   * Nodemailer transporter instance
   */
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

  /**
   * Whether the service has been initialized
   */
  private initialized = false;

  /**
   * Initialize email service
   * 
   * Creates nodemailer transporter with SMTP configuration.
   * Safe to call multiple times - will only initialize once.
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[EMAIL_SERVICE] Initializing email service...', {
        timestamp: new Date().toISOString(),
      });

      const config = getEmailConfig();

      // Create SMTP transport options
      const transportOptions: SMTPTransport.Options = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        connectionTimeout: config.connectionTimeout,
        socketTimeout: config.socketTimeout,
      };

      // Add authentication if configured
      if (config.auth) {
        transportOptions.auth = {
          user: config.auth.user,
          pass: config.auth.pass,
        };
      }

      // Create transporter
      this.transporter = nodemailer.createTransport(transportOptions);

      // Verify connection
      await this.transporter.verify();

      this.initialized = true;

      console.log('[EMAIL_SERVICE] Email service initialized successfully', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        hasAuth: !!config.auth,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Failed to initialize email service:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`[EMAIL_SERVICE] Initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Format email recipient for nodemailer
   * 
   * @private
   * @param {EmailRecipient} recipient - Recipient information
   * @returns {string} Formatted email address
   */
  private formatRecipient(recipient: EmailRecipient): string {
    if (recipient.name) {
      return `"${recipient.name}" <${recipient.email}>`;
    }
    return recipient.email;
  }

  /**
   * Format multiple recipients
   * 
   * @private
   * @param {EmailRecipient | EmailRecipient[]} recipients - Recipients
   * @returns {string} Comma-separated formatted addresses
   */
  private formatRecipients(recipients: EmailRecipient | EmailRecipient[]): string {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    return recipientArray.map(r => this.formatRecipient(r)).join(', ');
  }

  /**
   * Send email with retry logic
   * 
   * Implements exponential backoff for transient failures.
   * Retries on network errors and temporary SMTP failures.
   * 
   * @param {EmailOptions} options - Email options
   * @returns {Promise<EmailResult>} Send result
   * 
   * @example
   * const result = await emailService.sendEmail({
   *   to: { email: 'user@example.com', name: 'John Doe' },
   *   subject: 'Welcome',
   *   text: 'Welcome to our platform!',
   *   html: '<h1>Welcome to our platform!</h1>'
   * });
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const correlationId = options.correlationId || `email_${Date.now()}`;

    console.log('[EMAIL_SERVICE] Sending email:', {
      to: Array.isArray(options.to) ? options.to.map(r => r.email) : options.to.email,
      subject: options.subject,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    // Check if email service is enabled
    if (!isEmailEnabled()) {
      console.warn('[EMAIL_SERVICE] Email service is disabled:', {
        correlationId,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: 'Email service is disabled',
        errorCode: 'SERVICE_DISABLED',
        retryAttempts: 0,
        executionTimeMs: Date.now() - startTime,
        timestamp,
      };
    }

    // Initialize service if needed
    try {
      await this.initialize();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Initialization failed:', {
        error: errorMessage,
        correlationId,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: 'INITIALIZATION_ERROR',
        retryAttempts: 0,
        executionTimeMs: Date.now() - startTime,
        timestamp,
      };
    }

    if (!this.transporter) {
      console.error('[EMAIL_SERVICE] Transporter not initialized:', {
        correlationId,
        timestamp: timestamp.toISOString(),
      });

      return {
        success: false,
        error: 'Email transporter not initialized',
        errorCode: 'TRANSPORTER_ERROR',
        retryAttempts: 0,
        executionTimeMs: Date.now() - startTime,
        timestamp,
      };
    }

    const config = getEmailConfig();
    const maxRetries = config.maxRetries;
    let retryAttempts = 0;
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    while (retryAttempts <= maxRetries) {
      try {
        // Build mail options
        const mailOptions = {
          from: config.from,
          to: this.formatRecipients(options.to),
          subject: options.subject,
          text: options.text,
          html: options.html,
          cc: options.cc ? this.formatRecipients(options.cc) : undefined,
          bcc: options.bcc ? this.formatRecipients(options.bcc) : undefined,
          replyTo: options.replyTo,
        };

        // Send email
        const info = await this.transporter.sendMail(mailOptions);

        const executionTimeMs = Date.now() - startTime;

        console.log('[EMAIL_SERVICE] Email sent successfully:', {
          messageId: info.messageId,
          to: mailOptions.to,
          subject: options.subject,
          retryAttempts,
          executionTimeMs,
          correlationId,
          timestamp: timestamp.toISOString(),
        });

        return {
          success: true,
          messageId: info.messageId,
          retryAttempts,
          executionTimeMs,
          timestamp,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryAttempts++;

        const errorMessage = lastError.message;
        const errorCode = (error as any).code;

        console.warn('[EMAIL_SERVICE] Email send attempt failed:', {
          attempt: retryAttempts,
          maxRetries,
          error: errorMessage,
          code: errorCode,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || retryAttempts > maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const backoffMs = Math.min(1000 * Math.pow(2, retryAttempts - 1), 10000);

        console.log('[EMAIL_SERVICE] Retrying after backoff:', {
          backoffMs,
          attempt: retryAttempts,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // All retries exhausted
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = lastError?.message || 'Unknown error';
    const errorCode = (lastError as any)?.code || 'SEND_ERROR';

    console.error('[EMAIL_SERVICE] Email send failed after retries:', {
      error: errorMessage,
      code: errorCode,
      retryAttempts,
      executionTimeMs,
      correlationId,
      timestamp: timestamp.toISOString(),
    });

    return {
      success: false,
      error: errorMessage,
      errorCode,
      retryAttempts,
      executionTimeMs,
      timestamp,
    };
  }

  /**
   * Check if error is retryable
   * 
   * @private
   * @param {unknown} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorCode = (error as any).code;
    const errorMessage = error.message.toLowerCase();

    // Network errors are retryable
    const networkErrors = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
    ];

    if (networkErrors.includes(errorCode)) {
      return true;
    }

    // Temporary SMTP errors are retryable
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('temporary') ||
        errorMessage.includes('try again')) {
      return true;
    }

    // SMTP 4xx errors are temporary and retryable
    if (errorCode && errorCode >= 400 && errorCode < 500) {
      return true;
    }

    return false;
  }

  /**
   * Send task completion notification to HR admin
   * 
   * Notifies HR admin when an employee completes an onboarding task.
   * Includes task details and any uploaded documents.
   * 
   * @param {TaskCompletionData} data - Task completion data
   * @returns {Promise<EmailResult>} Send result
   * 
   * @example
   * const result = await emailService.sendTaskCompletionNotification({
   *   employee: { id: '123', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
   *   task: { id: '456', title: 'Complete I-9 Form', completedAt: new Date() },
   *   hrAdmin: { email: 'hr@example.com', firstName: 'Jane', lastName: 'Smith' }
   * });
   */
  async sendTaskCompletionNotification(data: TaskCompletionData): Promise<EmailResult> {
    const correlationId = `task_completion_${data.task.id}_${Date.now()}`;

    console.log('[EMAIL_SERVICE] Sending task completion notification:', {
      taskId: data.task.id,
      employeeId: data.employee.id,
      hrAdminEmail: data.hrAdmin.email,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    // Build email subject
    const subject = `Task Completed: ${data.task.title} - ${data.employee.firstName} ${data.employee.lastName}`;

    // Build plain text body
    const text = `
Hello ${data.hrAdmin.firstName || 'HR Admin'},

${data.employee.firstName} ${data.employee.lastName} has completed the following onboarding task:

Task: ${data.task.title}
${data.task.description ? `Description: ${data.task.description}` : ''}
Completed: ${data.task.completedAt.toLocaleString()}

${data.documents && data.documents.length > 0 ? `
Documents Uploaded:
${data.documents.map(doc => `- ${doc.filename} (${(doc.size / 1024).toFixed(2)} KB)`).join('\n')}
` : ''}

Employee Details:
Name: ${data.employee.firstName} ${data.employee.lastName}
Email: ${data.employee.email}

Please review the completed task in the HR system.

Best regards,
HR System
    `.trim();

    // Build HTML body
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Completion Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .task-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
    .employee-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
    .documents { background-color: white; padding: 15px; margin: 15px 0; }
    .document-item { padding: 5px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    h2 { margin-top: 0; color: #4CAF50; }
    .label { font-weight: bold; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Task Completed</h1>
    </div>
    <div class="content">
      <p>Hello ${data.hrAdmin.firstName || 'HR Admin'},</p>
      
      <p><strong>${data.employee.firstName} ${data.employee.lastName}</strong> has completed an onboarding task.</p>
      
      <div class="task-info">
        <h2>Task Details</h2>
        <p><span class="label">Task:</span> ${data.task.title}</p>
        ${data.task.description ? `<p><span class="label">Description:</span> ${data.task.description}</p>` : ''}
        <p><span class="label">Completed:</span> ${data.task.completedAt.toLocaleString()}</p>
      </div>
      
      ${data.documents && data.documents.length > 0 ? `
      <div class="documents">
        <h2>Documents Uploaded</h2>
        ${data.documents.map(doc => `
          <div class="document-item">
            📄 ${doc.filename} <span style="color: #666;">(${(doc.size / 1024).toFixed(2)} KB)</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <div class="employee-info">
        <h2>Employee Details</h2>
        <p><span class="label">Name:</span> ${data.employee.firstName} ${data.employee.lastName}</p>
        <p><span class="label">Email:</span> ${data.employee.email}</p>
      </div>
      
      <p>Please review the completed task in the HR system.</p>
      
      <div class="footer">
        <p>This is an automated notification from the HR System.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email
    return this.sendEmail({
      to: {
        email: data.hrAdmin.email,
        name: data.hrAdmin.firstName && data.hrAdmin.lastName 
          ? `${data.hrAdmin.firstName} ${data.hrAdmin.lastName}`
          : undefined,
      },
      subject,
      text,
      html,
      correlationId,
    });
  }

  /**
   * Send workflow assignment notification to employee
   * 
   * Notifies employee when an onboarding workflow is assigned to them.
   * Includes workflow details and list of tasks to complete.
   * 
   * @param {WorkflowAssignmentData} data - Workflow assignment data
   * @returns {Promise<EmailResult>} Send result
   * 
   * @example
   * const result = await emailService.sendWorkflowAssignmentNotification({
   *   employee: { id: '123', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
   *   workflow: { id: '789', templateName: 'New Hire Onboarding', taskCount: 5 },
   *   tasks: [{ title: 'Complete I-9 Form', dueDate: new Date() }],
   *   assignedBy: { firstName: 'Jane', lastName: 'Smith' }
   * });
   */
  async sendWorkflowAssignmentNotification(data: WorkflowAssignmentData): Promise<EmailResult> {
    const correlationId = `workflow_assignment_${data.workflow.id}_${Date.now()}`;

    console.log('[EMAIL_SERVICE] Sending workflow assignment notification:', {
      workflowId: data.workflow.id,
      employeeId: data.employee.id,
      employeeEmail: data.employee.email,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    // Build email subject
    const subject = `New Onboarding Workflow Assigned: ${data.workflow.templateName}`;

    // Build plain text body
    const text = `
Hello ${data.employee.firstName},

Welcome! An onboarding workflow has been assigned to you.

Workflow: ${data.workflow.templateName}
Tasks: ${data.workflow.taskCount}
${data.workflow.dueDate ? `Due Date: ${data.workflow.dueDate.toLocaleDateString()}` : ''}

Your Tasks:
${data.tasks.map((task, index) => `
${index + 1}. ${task.title}
   ${task.description ? `   ${task.description}` : ''}
   ${task.dueDate ? `   Due: ${task.dueDate.toLocaleDateString()}` : ''}
`).join('\n')}

${data.assignedBy.firstName && data.assignedBy.lastName 
  ? `Assigned by: ${data.assignedBy.firstName} ${data.assignedBy.lastName}` 
  : ''}

Please log in to the HR system to view and complete your onboarding tasks.

Best regards,
HR Team
    `.trim();

    // Build HTML body
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workflow Assignment Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .workflow-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
    .tasks-list { background-color: white; padding: 15px; margin: 15px 0; }
    .task-item { padding: 10px; margin: 10px 0; border-left: 3px solid #4CAF50; background-color: #f5f5f5; }
    .task-title { font-weight: bold; color: #333; }
    .task-description { color: #666; margin: 5px 0; }
    .task-due { color: #FF9800; font-size: 14px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    h2 { margin-top: 0; color: #2196F3; }
    .label { font-weight: bold; color: #555; }
    .welcome { font-size: 18px; color: #4CAF50; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Onboarding Workflow</h1>
    </div>
    <div class="content">
      <p class="welcome">Welcome, ${data.employee.firstName}!</p>
      
      <p>An onboarding workflow has been assigned to you. Please complete the following tasks to get started.</p>
      
      <div class="workflow-info">
        <h2>Workflow Details</h2>
        <p><span class="label">Workflow:</span> ${data.workflow.templateName}</p>
        <p><span class="label">Total Tasks:</span> ${data.workflow.taskCount}</p>
        ${data.workflow.dueDate ? `<p><span class="label">Due Date:</span> ${data.workflow.dueDate.toLocaleDateString()}</p>` : ''}
        ${data.assignedBy.firstName && data.assignedBy.lastName 
          ? `<p><span class="label">Assigned by:</span> ${data.assignedBy.firstName} ${data.assignedBy.lastName}</p>` 
          : ''}
      </div>
      
      <div class="tasks-list">
        <h2>Your Tasks</h2>
        ${data.tasks.map((task, index) => `
          <div class="task-item">
            <div class="task-title">${index + 1}. ${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            ${task.dueDate ? `<div class="task-due">📅 Due: ${task.dueDate.toLocaleDateString()}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <p>Please log in to the HR system to view and complete your onboarding tasks.</p>
      
      <div class="footer">
        <p>This is an automated notification from the HR System.</p>
        <p>If you have any questions, please contact your HR representative.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email
    return this.sendEmail({
      to: {
        email: data.employee.email,
        name: `${data.employee.firstName} ${data.employee.lastName}`,
      },
      subject,
      text,
      html,
      correlationId,
    });
  }

  /**
   * Close email service
   * 
   * Closes the nodemailer transporter connection.
   * Safe to call multiple times.
   * 
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    if (!this.transporter) {
      return;
    }

    try {
      console.log('[EMAIL_SERVICE] Closing email service...', {
        timestamp: new Date().toISOString(),
      });

      this.transporter.close();
      this.transporter = null;
      this.initialized = false;

      console.log('[EMAIL_SERVICE] Email service closed successfully', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[EMAIL_SERVICE] Failed to close email service:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Singleton email service instance
 */
export const emailService = new EmailService();

/**
 * Default export
 */
export default emailService;