/**
 * Email Service Module
 * 
 * Provides email sending functionality using nodemailer.
 * Supports transactional emails for authentication, onboarding, appraisals, and leave management.
 * All emails are sent asynchronously with error handling and logging.
 * 
 * @module services/email
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getEmailConfig } from '../config/email.js';

/**
 * Email recipient interface
 */
export interface EmailRecipient {
  /**
   * Recipient email address
   */
  readonly email: string;

  /**
   * Recipient display name (optional)
   */
  readonly name?: string;
}

/**
 * Email options interface
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
   * HTML email body (optional)
   */
  readonly html?: string;

  /**
   * CC recipients (optional)
   */
  readonly cc?: EmailRecipient | EmailRecipient[];

  /**
   * BCC recipients (optional)
   */
  readonly bcc?: EmailRecipient | EmailRecipient[];

  /**
   * Reply-to address (optional)
   */
  readonly replyTo?: string;
}

/**
 * Email send result interface
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
   * Timestamp when email was sent
   */
  readonly timestamp: Date;
}

/**
 * Onboarding task notification data
 */
export interface OnboardingTaskData {
  /**
   * Employee name
   */
  readonly employeeName: string;

  /**
   * Task title
   */
  readonly taskTitle: string;

  /**
   * Task description
   */
  readonly taskDescription: string;

  /**
   * Task due date
   */
  readonly dueDate: Date;

  /**
   * Dashboard URL
   */
  readonly dashboardUrl: string;
}

/**
 * Appraisal notification data
 */
export interface AppraisalNotificationData {
  /**
   * Employee name
   */
  readonly employeeName: string;

  /**
   * Appraisal period
   */
  readonly period: string;

  /**
   * Appraisal status
   */
  readonly status: string;

  /**
   * Dashboard URL
   */
  readonly dashboardUrl: string;

  /**
   * Due date (optional)
   */
  readonly dueDate?: Date;
}

/**
 * Leave request notification data
 */
export interface LeaveRequestData {
  /**
   * Employee name who requested leave
   */
  readonly employeeName: string;

  /**
   * Manager name who will approve/reject
   */
  readonly managerName: string;

  /**
   * Leave type (annual, sick, unpaid, other)
   */
  readonly leaveType: string;

  /**
   * Leave start date
   */
  readonly startDate: Date;

  /**
   * Leave end date
   */
  readonly endDate: Date;

  /**
   * Number of days requested
   */
  readonly days: number;

  /**
   * Leave request reason
   */
  readonly reason: string;

  /**
   * Dashboard URL for manager to review
   */
  readonly dashboardUrl: string;
}

/**
 * Leave approval notification data
 */
export interface LeaveApprovalData {
  /**
   * Employee name who requested leave
   */
  readonly employeeName: string;

  /**
   * Manager name who approved
   */
  readonly managerName: string;

  /**
   * Leave type (annual, sick, unpaid, other)
   */
  readonly leaveType: string;

  /**
   * Leave start date
   */
  readonly startDate: Date;

  /**
   * Leave end date
   */
  readonly endDate: Date;

  /**
   * Number of days approved
   */
  readonly days: number;

  /**
   * Dashboard URL
   */
  readonly dashboardUrl: string;
}

/**
 * Leave rejection notification data
 */
export interface LeaveRejectionData {
  /**
   * Employee name who requested leave
   */
  readonly employeeName: string;

  /**
   * Manager name who rejected
   */
  readonly managerName: string;

  /**
   * Leave type (annual, sick, unpaid, other)
   */
  readonly leaveType: string;

  /**
   * Leave start date
   */
  readonly startDate: Date;

  /**
   * Leave end date
   */
  readonly endDate: Date;

  /**
   * Number of days requested
   */
  readonly days: number;

  /**
   * Rejection reason
   */
  readonly rejectionReason: string;

  /**
   * Dashboard URL
   */
  readonly dashboardUrl: string;
}

/**
 * Email Service Class
 * 
 * Handles all email sending operations for the HR application.
 * Uses nodemailer with SMTP transport configured from environment variables.
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private readonly config = getEmailConfig();

  /**
   * Initialize email service
   * 
   * Creates nodemailer transporter with SMTP configuration.
   * Logs initialization status and configuration details.
   */
  constructor() {
    if (!this.config.enabled) {
      console.log('[EMAIL_SERVICE] Email service is disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        connectionTimeout: this.config.connectionTimeout,
        socketTimeout: this.config.socketTimeout,
      });

      console.log('[EMAIL_SERVICE] Email service initialized successfully:', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        hasAuth: !!this.config.auth,
      });
    } catch (error) {
      console.error('[EMAIL_SERVICE] Failed to initialize email service:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Format email recipient
   * 
   * @private
   * @param {EmailRecipient | EmailRecipient[]} recipient - Recipient(s) to format
   * @returns {string} Formatted recipient string
   */
  private formatRecipient(recipient: EmailRecipient | EmailRecipient[]): string {
    const recipients = Array.isArray(recipient) ? recipient : [recipient];
    return recipients
      .map(r => (r.name ? `"${r.name}" <${r.email}>` : r.email))
      .join(', ');
  }

  /**
   * Send email
   * 
   * @param {EmailOptions} options - Email options
   * @returns {Promise<EmailSendResult>} Send result
   * 
   * @example
   * const result = await emailService.sendEmail({
   *   to: { email: 'user@example.com', name: 'John Doe' },
   *   subject: 'Welcome',
   *   text: 'Welcome to our platform!',
   *   html: '<p>Welcome to our platform!</p>'
   * });
   */
  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      console.log('[EMAIL_SERVICE] Email service disabled, skipping send:', {
        to: this.formatRecipient(options.to),
        subject: options.subject,
      });
      return {
        success: false,
        error: 'Email service is disabled',
        timestamp: new Date(),
      };
    }

    if (!this.transporter) {
      console.error('[EMAIL_SERVICE] Email transporter not initialized');
      return {
        success: false,
        error: 'Email transporter not initialized',
        timestamp: new Date(),
      };
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: this.formatRecipient(options.to),
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc ? this.formatRecipient(options.cc) : undefined,
        bcc: options.bcc ? this.formatRecipient(options.bcc) : undefined,
        replyTo: options.replyTo,
      };

      console.log('[EMAIL_SERVICE] Sending email:', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        timestamp: new Date().toISOString(),
      });

      const info = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      console.log('[EMAIL_SERVICE] Email sent successfully:', {
        messageId: info.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        messageId: info.messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[EMAIL_SERVICE] Failed to send email:', {
        error: error instanceof Error ? error.message : String(error),
        to: this.formatRecipient(options.to),
        subject: options.subject,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send welcome email to new user
   * 
   * @param {EmailRecipient} recipient - Email recipient
   * @param {string} temporaryPassword - Temporary password for first login
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendWelcomeEmail(
    recipient: EmailRecipient,
    temporaryPassword: string
  ): Promise<EmailSendResult> {
    const subject = 'Welcome to HR Management System';
    const text = `
Welcome to the HR Management System!

Your account has been created successfully.

Login Credentials:
Email: ${recipient.email}
Temporary Password: ${temporaryPassword}

Please log in and change your password immediately.

Best regards,
HR Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .credentials { background-color: #fff; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to HR Management System</h1>
    </div>
    <div class="content">
      <p>Hello ${recipient.name || 'there'},</p>
      <p>Your account has been created successfully. You can now access the HR Management System.</p>
      
      <div class="credentials">
        <h3>Login Credentials</h3>
        <p><strong>Email:</strong> ${recipient.email}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      </div>
      
      <p><strong>Important:</strong> Please log in and change your password immediately for security reasons.</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${this.config.environment === 'production' ? 'https://hr.example.com' : 'http://localhost:3000'}/login" class="button">Log In Now</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send password reset email
   * 
   * @param {EmailRecipient} recipient - Email recipient
   * @param {string} resetToken - Password reset token
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendPasswordResetEmail(
    recipient: EmailRecipient,
    resetToken: string
  ): Promise<EmailSendResult> {
    const resetUrl = `${this.config.environment === 'production' ? 'https://hr.example.com' : 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const subject = 'Password Reset Request';
    const text = `
You have requested to reset your password.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
HR Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; }
    .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${recipient.name || 'there'},</p>
      <p>You have requested to reset your password for the HR Management System.</p>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      
      <div class="warning">
        <p><strong>Important:</strong></p>
        <ul>
          <li>This link will expire in 1 hour</li>
          <li>If you did not request this, please ignore this email</li>
          <li>Your password will not change until you create a new one</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send onboarding task assignment notification
   * 
   * @param {EmailRecipient} recipient - Email recipient
   * @param {OnboardingTaskData} taskData - Task data
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendOnboardingTaskNotification(
    recipient: EmailRecipient,
    taskData: OnboardingTaskData
  ): Promise<EmailSendResult> {
    const subject = `New Onboarding Task: ${taskData.taskTitle}`;
    const text = `
Hello ${taskData.employeeName},

You have been assigned a new onboarding task.

Task: ${taskData.taskTitle}
Description: ${taskData.taskDescription}
Due Date: ${taskData.dueDate.toLocaleDateString()}

Please complete this task by the due date.

View your tasks: ${taskData.dashboardUrl}

Best regards,
HR Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #9C27B0; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .task-details { background-color: #fff; padding: 15px; border-left: 4px solid #9C27B0; margin: 20px 0; }
    .button { display: inline-block; padding: 10px 20px; background-color: #9C27B0; color: white; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Onboarding Task</h1>
    </div>
    <div class="content">
      <p>Hello ${taskData.employeeName},</p>
      <p>You have been assigned a new onboarding task.</p>
      
      <div class="task-details">
        <h3>${taskData.taskTitle}</h3>
        <p><strong>Description:</strong> ${taskData.taskDescription}</p>
        <p><strong>Due Date:</strong> ${taskData.dueDate.toLocaleDateString()}</p>
      </div>
      
      <p>Please complete this task by the due date.</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${taskData.dashboardUrl}" class="button">View My Tasks</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send appraisal notification
   * 
   * @param {EmailRecipient} recipient - Email recipient
   * @param {AppraisalNotificationData} appraisalData - Appraisal data
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendAppraisalNotification(
    recipient: EmailRecipient,
    appraisalData: AppraisalNotificationData
  ): Promise<EmailSendResult> {
    const subject = `Appraisal ${appraisalData.status}: ${appraisalData.period}`;
    const text = `
Hello ${appraisalData.employeeName},

Your appraisal for ${appraisalData.period} has been ${appraisalData.status.toLowerCase()}.

${appraisalData.dueDate ? `Due Date: ${appraisalData.dueDate.toLocaleDateString()}` : ''}

View your appraisal: ${appraisalData.dashboardUrl}

Best regards,
HR Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .appraisal-details { background-color: #fff; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
    .button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appraisal ${appraisalData.status}</h1>
    </div>
    <div class="content">
      <p>Hello ${appraisalData.employeeName},</p>
      <p>Your appraisal for ${appraisalData.period} has been ${appraisalData.status.toLowerCase()}.</p>
      
      <div class="appraisal-details">
        <p><strong>Period:</strong> ${appraisalData.period}</p>
        <p><strong>Status:</strong> ${appraisalData.status}</p>
        ${appraisalData.dueDate ? `<p><strong>Due Date:</strong> ${appraisalData.dueDate.toLocaleDateString()}</p>` : ''}
      </div>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${appraisalData.dashboardUrl}" class="button">View Appraisal</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send leave request notification to manager
   * 
   * Notifies manager when an employee submits a leave request.
   * 
   * @param {EmailRecipient} recipient - Manager email recipient
   * @param {LeaveRequestData} leaveData - Leave request data
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendLeaveRequestNotification(
    recipient: EmailRecipient,
    leaveData: LeaveRequestData
  ): Promise<EmailSendResult> {
    const subject = `Leave Request from ${leaveData.employeeName}`;
    const text = `
Hello ${leaveData.managerName},

${leaveData.employeeName} has submitted a leave request that requires your approval.

Leave Details:
Type: ${leaveData.leaveType}
Start Date: ${leaveData.startDate.toLocaleDateString()}
End Date: ${leaveData.endDate.toLocaleDateString()}
Duration: ${leaveData.days} day(s)
Reason: ${leaveData.reason}

Please review and approve or reject this request.

Review request: ${leaveData.dashboardUrl}

Best regards,
HR System
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #3F51B5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .leave-details { background-color: #fff; padding: 15px; border-left: 4px solid #3F51B5; margin: 20px 0; }
    .button { display: inline-block; padding: 10px 20px; background-color: #3F51B5; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Leave Request Pending Approval</h1>
    </div>
    <div class="content">
      <p>Hello ${leaveData.managerName},</p>
      <p><strong>${leaveData.employeeName}</strong> has submitted a leave request that requires your approval.</p>
      
      <div class="leave-details">
        <h3>Leave Details</h3>
        <p><strong>Type:</strong> ${leaveData.leaveType}</p>
        <p><strong>Start Date:</strong> ${leaveData.startDate.toLocaleDateString()}</p>
        <p><strong>End Date:</strong> ${leaveData.endDate.toLocaleDateString()}</p>
        <p><strong>Duration:</strong> ${leaveData.days} day(s)</p>
        <p><strong>Reason:</strong> ${leaveData.reason}</p>
      </div>
      
      <p>Please review and approve or reject this request at your earliest convenience.</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${leaveData.dashboardUrl}" class="button">Review Request</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send leave approval notification to employee
   * 
   * Notifies employee when their leave request has been approved.
   * 
   * @param {EmailRecipient} recipient - Employee email recipient
   * @param {LeaveApprovalData} leaveData - Leave approval data
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendLeaveApprovalNotification(
    recipient: EmailRecipient,
    leaveData: LeaveApprovalData
  ): Promise<EmailSendResult> {
    const subject = `Leave Request Approved`;
    const text = `
Hello ${leaveData.employeeName},

Good news! Your leave request has been approved by ${leaveData.managerName}.

Leave Details:
Type: ${leaveData.leaveType}
Start Date: ${leaveData.startDate.toLocaleDateString()}
End Date: ${leaveData.endDate.toLocaleDateString()}
Duration: ${leaveData.days} day(s)

Your leave balance has been updated accordingly.

View your leave history: ${leaveData.dashboardUrl}

Best regards,
HR System
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .leave-details { background-color: #fff; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    .success-badge { background-color: #4CAF50; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-bottom: 10px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Leave Request Approved</h1>
    </div>
    <div class="content">
      <p>Hello ${leaveData.employeeName},</p>
      <p><span class="success-badge">APPROVED</span></p>
      <p>Good news! Your leave request has been approved by <strong>${leaveData.managerName}</strong>.</p>
      
      <div class="leave-details">
        <h3>Approved Leave Details</h3>
        <p><strong>Type:</strong> ${leaveData.leaveType}</p>
        <p><strong>Start Date:</strong> ${leaveData.startDate.toLocaleDateString()}</p>
        <p><strong>End Date:</strong> ${leaveData.endDate.toLocaleDateString()}</p>
        <p><strong>Duration:</strong> ${leaveData.days} day(s)</p>
      </div>
      
      <p>Your leave balance has been updated accordingly. Enjoy your time off!</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${leaveData.dashboardUrl}" class="button">View Leave History</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Send leave rejection notification to employee
   * 
   * Notifies employee when their leave request has been rejected.
   * 
   * @param {EmailRecipient} recipient - Employee email recipient
   * @param {LeaveRejectionData} leaveData - Leave rejection data
   * @returns {Promise<EmailSendResult>} Send result
   */
  async sendLeaveRejectionNotification(
    recipient: EmailRecipient,
    leaveData: LeaveRejectionData
  ): Promise<EmailSendResult> {
    const subject = `Leave Request Not Approved`;
    const text = `
Hello ${leaveData.employeeName},

Your leave request has not been approved by ${leaveData.managerName}.

Leave Details:
Type: ${leaveData.leaveType}
Start Date: ${leaveData.startDate.toLocaleDateString()}
End Date: ${leaveData.endDate.toLocaleDateString()}
Duration: ${leaveData.days} day(s)

Reason for rejection:
${leaveData.rejectionReason}

If you have questions about this decision, please contact your manager directly.

View your leave history: ${leaveData.dashboardUrl}

Best regards,
HR System
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .leave-details { background-color: #fff; padding: 15px; border-left: 4px solid #f44336; margin: 20px 0; }
    .rejection-reason { background-color: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .rejected-badge { background-color: #f44336; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-bottom: 10px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Leave Request Not Approved</h1>
    </div>
    <div class="content">
      <p>Hello ${leaveData.employeeName},</p>
      <p><span class="rejected-badge">NOT APPROVED</span></p>
      <p>Your leave request has not been approved by <strong>${leaveData.managerName}</strong>.</p>
      
      <div class="leave-details">
        <h3>Leave Request Details</h3>
        <p><strong>Type:</strong> ${leaveData.leaveType}</p>
        <p><strong>Start Date:</strong> ${leaveData.startDate.toLocaleDateString()}</p>
        <p><strong>End Date:</strong> ${leaveData.endDate.toLocaleDateString()}</p>
        <p><strong>Duration:</strong> ${leaveData.days} day(s)</p>
      </div>
      
      <div class="rejection-reason">
        <h3>Reason for Rejection</h3>
        <p>${leaveData.rejectionReason}</p>
      </div>
      
      <p>If you have questions about this decision, please contact your manager directly.</p>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${leaveData.dashboardUrl}" class="button">View Leave History</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} HR Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: recipient,
      subject,
      text,
      html,
    });
  }

  /**
   * Verify email service connection
   * 
   * @returns {Promise<boolean>} True if connection is successful
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('[EMAIL_SERVICE] Email service is disabled, skipping verification');
      return false;
    }

    if (!this.transporter) {
      console.error('[EMAIL_SERVICE] Email transporter not initialized');
      return false;
    }

    try {
      console.log('[EMAIL_SERVICE] Verifying email service connection...');
      await this.transporter.verify();
      console.log('[EMAIL_SERVICE] Email service connection verified successfully');
      return true;
    } catch (error) {
      console.error('[EMAIL_SERVICE] Email service connection verification failed:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }
}

/**
 * Singleton instance of email service
 */
let emailServiceInstance: EmailService | null = null;

/**
 * Get email service singleton instance
 * 
 * @returns {EmailService} Email service instance
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

/**
 * Reset email service singleton
 * 
 * Forces service to be recreated on next call to getEmailService().
 * Useful for testing.
 */
export function resetEmailService(): void {
  emailServiceInstance = null;
  console.log('[EMAIL_SERVICE] Email service reset');
}

/**
 * Default export: email service singleton
 */
export default getEmailService();