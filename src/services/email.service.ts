/**
 * Email Service Module
 * 
 * Provides email sending functionality using nodemailer with SMTP transport.
 * Supports HTML and plain text emails with retry logic and error handling.
 * All configuration is loaded from environment variables via email config module.
 * 
 * @module services/email
 */

import nodemailer, { Transporter } from 'nodemailer';
import { getEmailConfig, isEmailEnabled } from '../config/email';

/**
 * Email sending options
 */
export interface EmailOptions {
  /**
   * Recipient email address
   */
  readonly to: string;

  /**
   * Email subject line
   */
  readonly subject: string;

  /**
   * Plain text email body
   */
  readonly text?: string;

  /**
   * HTML email body
   */
  readonly html?: string;

  /**
   * Optional CC recipients
   */
  readonly cc?: string | string[];

  /**
   * Optional BCC recipients
   */
  readonly bcc?: string | string[];

  /**
   * Optional reply-to address
   */
  readonly replyTo?: string;
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
   * Message ID from SMTP server (if successful)
   */
  readonly messageId?: string;

  /**
   * Error message (if failed)
   */
  readonly error?: string;

  /**
   * Number of retry attempts made
   */
  readonly attempts: number;
}

/**
 * Email Service Class
 * 
 * Handles email sending with retry logic and error handling.
 * Uses nodemailer with SMTP transport configured from environment variables.
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private readonly config = getEmailConfig();

  /**
   * Initialize email service and create SMTP transport
   * 
   * @private
   */
  private initializeTransporter(): void {
    if (this.transporter) {
      return;
    }

    console.log('[EMAIL_SERVICE] Initializing SMTP transport...', {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      hasAuth: !!this.config.auth,
    });

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      connectionTimeout: this.config.connectionTimeout,
      socketTimeout: this.config.socketTimeout,
    });

    console.log('[EMAIL_SERVICE] SMTP transport initialized successfully');
  }

  /**
   * Send email with retry logic
   * 
   * @param {EmailOptions} options - Email sending options
   * @returns {Promise<EmailResult>} Email sending result
   * 
   * @example
   * const result = await emailService.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Welcome',
   *   html: '<h1>Welcome to our platform!</h1>',
   * });
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    // Check if email service is enabled
    if (!isEmailEnabled()) {
      console.log('[EMAIL_SERVICE] Email service is disabled, skipping send:', {
        to: options.to,
        subject: options.subject,
      });
      return {
        success: false,
        error: 'Email service is disabled',
        attempts: 0,
      };
    }

    // Validate email options
    const validationError = this.validateEmailOptions(options);
    if (validationError) {
      console.error('[EMAIL_SERVICE] Invalid email options:', {
        error: validationError,
        to: options.to,
        subject: options.subject,
      });
      return {
        success: false,
        error: validationError,
        attempts: 0,
      };
    }

    // Initialize transporter if not already done
    this.initializeTransporter();

    // Attempt to send email with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log('[EMAIL_SERVICE] Sending email (attempt ${attempt}/${this.config.maxRetries})...', {
          to: options.to,
          subject: options.subject,
          attempt,
        });

        const info = await this.transporter!.sendMail({
          from: this.config.from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          cc: options.cc,
          bcc: options.bcc,
          replyTo: options.replyTo,
        });

        console.log('[EMAIL_SERVICE] Email sent successfully:', {
          messageId: info.messageId,
          to: options.to,
          subject: options.subject,
          attempt,
        });

        return {
          success: true,
          messageId: info.messageId,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error('[EMAIL_SERVICE] Failed to send email (attempt ${attempt}/${this.config.maxRetries}):', {
          error: lastError.message,
          to: options.to,
          subject: options.subject,
          attempt,
        });

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log('[EMAIL_SERVICE] Retrying in ${delay}ms...');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('[EMAIL_SERVICE] All retry attempts failed:', {
      error: lastError?.message,
      to: options.to,
      subject: options.subject,
      attempts: this.config.maxRetries,
    });

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts: this.config.maxRetries,
    };
  }

  /**
   * Send onboarding welcome email to new employee
   * 
   * @param {string} employeeEmail - Employee email address
   * @param {string} employeeName - Employee full name
   * @param {Date} startDate - Employee start date
   * @returns {Promise<EmailResult>} Email sending result
   */
  async sendOnboardingEmail(
    employeeEmail: string,
    employeeName: string,
    startDate: Date
  ): Promise<EmailResult> {
    const formattedDate = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Our Team!</h1>
            </div>
            <div class="content">
              <h2>Hello ${employeeName},</h2>
              <p>We're excited to welcome you to our organization! Your onboarding journey begins on <strong>${formattedDate}</strong>.</p>
              <p>Here's what you can expect:</p>
              <ul>
                <li>Access to your onboarding tasks and checklist</li>
                <li>Introduction to your team and manager</li>
                <li>Setup of your workspace and tools</li>
                <li>Overview of company policies and procedures</li>
              </ul>
              <p>Please log in to your account to view your personalized onboarding tasks.</p>
              <p>If you have any questions, don't hesitate to reach out to your manager or HR team.</p>
              <p>We look forward to working with you!</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the HR Management System.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to Our Team!

Hello ${employeeName},

We're excited to welcome you to our organization! Your onboarding journey begins on ${formattedDate}.

Here's what you can expect:
- Access to your onboarding tasks and checklist
- Introduction to your team and manager
- Setup of your workspace and tools
- Overview of company policies and procedures

Please log in to your account to view your personalized onboarding tasks.

If you have any questions, don't hesitate to reach out to your manager or HR team.

We look forward to working with you!

---
This is an automated message from the HR Management System.
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: 'Welcome to the Team - Your Onboarding Journey Begins',
      html,
      text,
    });
  }

  /**
   * Send task assignment notification email
   * 
   * @param {string} employeeEmail - Employee email address
   * @param {string} employeeName - Employee full name
   * @param {string} taskTitle - Task title
   * @param {string} taskDescription - Task description
   * @param {Date} dueDate - Task due date
   * @returns {Promise<EmailResult>} Email sending result
   */
  async sendTaskAssignmentEmail(
    employeeEmail: string,
    employeeName: string,
    taskTitle: string,
    taskDescription: string,
    dueDate: Date
  ): Promise<EmailResult> {
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .task-box { background-color: white; padding: 15px; border-left: 4px solid #2196F3; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Task Assigned</h1>
            </div>
            <div class="content">
              <h2>Hello ${employeeName},</h2>
              <p>A new onboarding task has been assigned to you.</p>
              <div class="task-box">
                <h3>${taskTitle}</h3>
                <p>${taskDescription}</p>
                <p><strong>Due Date:</strong> ${formattedDate}</p>
              </div>
              <p>Please log in to your account to view the task details and mark it as complete when finished.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the HR Management System.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
New Task Assigned

Hello ${employeeName},

A new onboarding task has been assigned to you.

Task: ${taskTitle}
Description: ${taskDescription}
Due Date: ${formattedDate}

Please log in to your account to view the task details and mark it as complete when finished.

---
This is an automated message from the HR Management System.
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: `New Task Assigned: ${taskTitle}`,
      html,
      text,
    });
  }

  /**
   * Send appraisal cycle notification email to employee
   * 
   * @param {string} employeeEmail - Employee email address
   * @param {string} employeeName - Employee full name
   * @param {string} reviewerName - Manager/reviewer full name
   * @param {Date} reviewPeriodStart - Review period start date
   * @param {Date} reviewPeriodEnd - Review period end date
   * @returns {Promise<EmailResult>} Email sending result
   */
  async sendAppraisalCycleNotification(
    employeeEmail: string,
    employeeName: string,
    reviewerName: string,
    reviewPeriodStart: Date,
    reviewPeriodEnd: Date
  ): Promise<EmailResult> {
    const formattedStartDate = reviewPeriodStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedEndDate = reviewPeriodEnd.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .info-box { background-color: white; padding: 15px; border-left: 4px solid #FF9800; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Performance Appraisal Cycle Initiated</h1>
            </div>
            <div class="content">
              <h2>Hello ${employeeName},</h2>
              <p>Your manager, <strong>${reviewerName}</strong>, has initiated a performance appraisal cycle for you.</p>
              <div class="info-box">
                <h3>Review Period</h3>
                <p><strong>From:</strong> ${formattedStartDate}</p>
                <p><strong>To:</strong> ${formattedEndDate}</p>
              </div>
              <p>As part of this appraisal cycle, you will be able to:</p>
              <ul>
                <li>Submit a self-assessment reflecting on your performance</li>
                <li>Set and track your professional goals</li>
                <li>Review feedback and ratings from your manager</li>
              </ul>
              <p>Please log in to your account to begin your self-assessment when you're ready.</p>
              <p>This is an important opportunity to reflect on your achievements and discuss your career development with your manager.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the HR Management System.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Performance Appraisal Cycle Initiated

Hello ${employeeName},

Your manager, ${reviewerName}, has initiated a performance appraisal cycle for you.

Review Period:
From: ${formattedStartDate}
To: ${formattedEndDate}

As part of this appraisal cycle, you will be able to:
- Submit a self-assessment reflecting on your performance
- Set and track your professional goals
- Review feedback and ratings from your manager

Please log in to your account to begin your self-assessment when you're ready.

This is an important opportunity to reflect on your achievements and discuss your career development with your manager.

---
This is an automated message from the HR Management System.
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: 'Performance Appraisal Cycle Initiated',
      html,
      text,
    });
  }

  /**
   * Send review completed notification email to employee
   * 
   * @param {string} employeeEmail - Employee email address
   * @param {string} employeeName - Employee full name
   * @param {string} reviewerName - Manager/reviewer full name
   * @param {number} rating - Performance rating (1-5)
   * @param {Date} reviewPeriodStart - Review period start date
   * @param {Date} reviewPeriodEnd - Review period end date
   * @returns {Promise<EmailResult>} Email sending result
   */
  async sendReviewCompletedNotification(
    employeeEmail: string,
    employeeName: string,
    reviewerName: string,
    rating: number,
    reviewPeriodStart: Date,
    reviewPeriodEnd: Date
  ): Promise<EmailResult> {
    const formattedStartDate = reviewPeriodStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedEndDate = reviewPeriodEnd.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const ratingStars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .info-box { background-color: white; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
            .rating { font-size: 24px; color: #FF9800; margin: 10px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Performance Review Completed</h1>
            </div>
            <div class="content">
              <h2>Hello ${employeeName},</h2>
              <p>Your manager, <strong>${reviewerName}</strong>, has completed your performance review.</p>
              <div class="info-box">
                <h3>Review Period</h3>
                <p><strong>From:</strong> ${formattedStartDate}</p>
                <p><strong>To:</strong> ${formattedEndDate}</p>
                <h3>Overall Rating</h3>
                <div class="rating">${ratingStars} (${rating}/5)</div>
              </div>
              <p>Your complete performance review, including detailed feedback and comments, is now available in your account.</p>
              <p>Please log in to view:</p>
              <ul>
                <li>Detailed feedback from your manager</li>
                <li>Your self-assessment and manager's review side-by-side</li>
                <li>Goals and achievements for the review period</li>
                <li>Development areas and action items</li>
              </ul>
              <p>We encourage you to review the feedback carefully and schedule a follow-up discussion with your manager if you have any questions.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the HR Management System.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Performance Review Completed

Hello ${employeeName},

Your manager, ${reviewerName}, has completed your performance review.

Review Period:
From: ${formattedStartDate}
To: ${formattedEndDate}

Overall Rating: ${rating}/5

Your complete performance review, including detailed feedback and comments, is now available in your account.

Please log in to view:
- Detailed feedback from your manager
- Your self-assessment and manager's review side-by-side
- Goals and achievements for the review period
- Development areas and action items

We encourage you to review the feedback carefully and schedule a follow-up discussion with your manager if you have any questions.

---
This is an automated message from the HR Management System.
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: 'Your Performance Review is Complete',
      html,
      text,
    });
  }

  /**
   * Validate email options
   * 
   * @private
   * @param {EmailOptions} options - Email options to validate
   * @returns {string | null} Error message if invalid, null if valid
   */
  private validateEmailOptions(options: EmailOptions): string | null {
    // Validate recipient email
    if (!options.to || options.to.trim().length === 0) {
      return 'Recipient email address is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.to)) {
      return `Invalid recipient email address: ${options.to}`;
    }

    // Validate subject
    if (!options.subject || options.subject.trim().length === 0) {
      return 'Email subject is required';
    }

    if (options.subject.length > 200) {
      return 'Email subject must be 200 characters or less';
    }

    // Validate that at least one body is provided
    if (!options.text && !options.html) {
      return 'Either text or html body must be provided';
    }

    // Validate text body length if provided
    if (options.text && options.text.length > 50000) {
      return 'Text body must be 50000 characters or less';
    }

    // Validate HTML body length if provided
    if (options.html && options.html.length > 100000) {
      return 'HTML body must be 100000 characters or less';
    }

    // Validate CC emails if provided
    if (options.cc) {
      const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
      for (const email of ccEmails) {
        if (!emailRegex.test(email)) {
          return `Invalid CC email address: ${email}`;
        }
      }
    }

    // Validate BCC emails if provided
    if (options.bcc) {
      const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
      for (const email of bccEmails) {
        if (!emailRegex.test(email)) {
          return `Invalid BCC email address: ${email}`;
        }
      }
    }

    // Validate reply-to email if provided
    if (options.replyTo && !emailRegex.test(options.replyTo)) {
      return `Invalid reply-to email address: ${options.replyTo}`;
    }

    return null;
  }

  /**
   * Verify SMTP connection
   * 
   * @returns {Promise<boolean>} True if connection is successful
   */
  async verifyConnection(): Promise<boolean> {
    if (!isEmailEnabled()) {
      console.log('[EMAIL_SERVICE] Email service is disabled, skipping connection verification');
      return false;
    }

    try {
      this.initializeTransporter();
      console.log('[EMAIL_SERVICE] Verifying SMTP connection...');
      await this.transporter!.verify();
      console.log('[EMAIL_SERVICE] SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('[EMAIL_SERVICE] SMTP connection verification failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close SMTP connection
   */
  async close(): Promise<void> {
    if (this.transporter) {
      console.log('[EMAIL_SERVICE] Closing SMTP connection...');
      this.transporter.close();
      this.transporter = null;
      console.log('[EMAIL_SERVICE] SMTP connection closed');
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
 * 
 * @example
 * const emailService = getEmailService();
 * await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Test',
 *   text: 'Test message',
 * });
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
 * Useful for testing to force recreation of service instance.
 */
export function resetEmailService(): void {
  if (emailServiceInstance) {
    emailServiceInstance.close();
  }
  emailServiceInstance = null;
}

/**
 * Default export: email service singleton
 */
export default getEmailService();