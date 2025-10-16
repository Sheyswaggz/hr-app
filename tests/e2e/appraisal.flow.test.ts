/**
 * End-to-End Appraisal Flow Tests
 * 
 * Comprehensive E2E tests for complete appraisal workflows including:
 * - Manager initiates appraisal cycle
 * - Employee views and submits self-assessment
 * - Manager reviews and provides rating/feedback
 * - Employee views completed appraisal
 * - Goal setting and tracking throughout cycle
 * - Email notifications at appropriate steps
 * - Status transition enforcement
 * - Database state verification
 * 
 * @module tests/e2e/appraisal.flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction, shutdown } from '../../src/db/index.js';
import type { Application } from 'express';
import type { Pool } from 'pg';

// Test data interfaces
interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  token?: string;
}

interface TestEmployee {
  id: string;
  userId: string;
  employeeNumber: string;
  jobTitle: string;
  departmentId: string;
  managerId?: string;
}

interface TestAppraisal {
  id: string;
  employeeId: string;
  reviewerId: string;
  reviewPeriodStart: Date;
  reviewPeriodEnd: Date;
  status: 'draft' | 'submitted' | 'completed';
  selfAssessment?: string;
  managerFeedback?: string;
  rating?: number;
  goals?: Record<string, unknown>;
}

// Test application and database
let app: Application;
let pool: Pool;

// Test users
let hrAdmin: TestUser;
let manager: TestUser;
let employee: TestUser;

// Test employees
let managerEmployee: TestEmployee;
let regularEmployee: TestEmployee;

// Test department
let departmentId: string;

// Email tracking
const sentEmails: Array<{
  to: string;
  subject: string;
  timestamp: Date;
}> = [];

/**
 * Setup test environment
 */
beforeAll(async () => {
  console.log('[E2E_APPRAISAL] Setting up test environment');

  // Initialize application
  app = createApp();
  pool = getPool();

  // Create test department
  departmentId = await createTestDepartment();

  // Create test users and employees
  await createTestUsers();
  await createTestEmployees();

  // Authenticate users
  await authenticateUsers();

  console.log('[E2E_APPRAISAL] Test environment setup complete');
}, 30000);

/**
 * Cleanup test environment
 */
afterAll(async () => {
  console.log('[E2E_APPRAISAL] Cleaning up test environment');

  try {
    // Clean up test data
    await cleanupTestData();

    // Shutdown database connection
    await shutdown({ timeout: 5000 });

    console.log('[E2E_APPRAISAL] Test environment cleanup complete');
  } catch (error) {
    console.error('[E2E_APPRAISAL] Cleanup error:', error);
  }
}, 30000);

/**
 * Reset email tracking before each test
 */
beforeEach(() => {
  sentEmails.length = 0;
});

/**
 * Create test department
 */
async function createTestDepartment(): Promise<string> {
  const result = await executeQuery<{ id: string }>(
    `INSERT INTO departments (id, name, description, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      'dept-test-001',
      'Test Department',
      'Department for E2E testing',
      true,
      new Date(),
      new Date(),
    ],
    { operation: 'create_test_department' }
  );

  return result.rows[0]!.id;
}

/**
 * Create test users
 */
async function createTestUsers(): Promise<void> {
  const timestamp = new Date();

  // HR Admin
  hrAdmin = {
    id: 'user-hr-001',
    email: 'hr.admin@test.com',
    password: 'HRAdmin123!',
    firstName: 'HR',
    lastName: 'Admin',
    role: 'HR_ADMIN',
  };

  // Manager
  manager = {
    id: 'user-mgr-001',
    email: 'manager@test.com',
    password: 'Manager123!',
    firstName: 'Test',
    lastName: 'Manager',
    role: 'MANAGER',
  };

  // Employee
  employee = {
    id: 'user-emp-001',
    email: 'employee@test.com',
    password: 'Employee123!',
    firstName: 'Test',
    lastName: 'Employee',
    role: 'EMPLOYEE',
  };

  const users = [hrAdmin, manager, employee];

  for (const user of users) {
    // Hash password (simplified for testing)
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(user.password, 10);

    await executeQuery(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, 
                          failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        user.id,
        user.email,
        passwordHash,
        user.firstName,
        user.lastName,
        user.role,
        true,
        0,
        timestamp,
        timestamp,
      ],
      { operation: 'create_test_user' }
    );
  }
}

/**
 * Create test employees
 */
async function createTestEmployees(): Promise<void> {
  const timestamp = new Date();

  // Manager employee record
  managerEmployee = {
    id: 'emp-mgr-001',
    userId: manager.id,
    employeeNumber: 'EMP-MGR-001',
    jobTitle: 'Engineering Manager',
    departmentId,
  };

  // Regular employee record
  regularEmployee = {
    id: 'emp-reg-001',
    userId: employee.id,
    employeeNumber: 'EMP-REG-001',
    jobTitle: 'Software Engineer',
    departmentId,
    managerId: managerEmployee.id,
  };

  const employees = [managerEmployee, regularEmployee];

  for (const emp of employees) {
    await executeQuery(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, 
                              manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        emp.id,
        emp.userId,
        emp.employeeNumber,
        emp.jobTitle,
        emp.departmentId,
        emp.managerId || null,
        new Date('2023-01-01'),
        'ACTIVE',
        timestamp,
        timestamp,
      ],
      { operation: 'create_test_employee' }
    );
  }
}

/**
 * Authenticate test users
 */
async function authenticateUsers(): Promise<void> {
  const users = [hrAdmin, manager, employee];

  for (const user of users) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: user.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tokens.accessToken).toBeDefined();

    user.token = response.body.tokens.accessToken;
  }
}

/**
 * Cleanup test data
 */
async function cleanupTestData(): Promise<void> {
  await executeTransaction(async (client) => {
    // Delete in reverse dependency order
    await client.query('DELETE FROM appraisals WHERE employee_id IN ($1, $2)', [
      managerEmployee.id,
      regularEmployee.id,
    ]);
    await client.query('DELETE FROM employees WHERE id IN ($1, $2)', [
      managerEmployee.id,
      regularEmployee.id,
    ]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
      hrAdmin.id,
      manager.id,
      employee.id,
    ]);
    await client.query('DELETE FROM departments WHERE id = $1', [departmentId]);
  });
}

/**
 * Track sent emails (mock)
 */
function trackEmail(to: string, subject: string): void {
  sentEmails.push({
    to,
    subject,
    timestamp: new Date(),
  });
}

/**
 * Complete appraisal workflow test
 */
describe('Complete Appraisal Workflow', () => {
  it('should complete full appraisal cycle from initiation to completion', async () => {
    console.log('[E2E_APPRAISAL] Starting complete workflow test');

    // Step 1: Manager initiates appraisal cycle
    console.log('[E2E_APPRAISAL] Step 1: Manager initiates appraisal');

    const reviewPeriodStart = new Date('2024-01-01');
    const reviewPeriodEnd = new Date('2024-12-31');

    const initiateResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
        goals: {
          technical: [
            {
              title: 'Master TypeScript',
              description: 'Become proficient in advanced TypeScript patterns',
              targetDate: '2024-06-30',
              status: 'in_progress',
            },
          ],
          professional: [
            {
              title: 'Mentorship',
              description: 'Mentor 2 junior developers',
              targetDate: '2024-12-31',
              status: 'not_started',
            },
          ],
        },
      });

    expect(initiateResponse.status).toBe(201);
    expect(initiateResponse.body.success).toBe(true);
    expect(initiateResponse.body.data).toBeDefined();
    expect(initiateResponse.body.data.status).toBe('draft');
    expect(initiateResponse.body.data.employeeId).toBe(regularEmployee.id);
    expect(initiateResponse.body.data.reviewerId).toBe(manager.id);

    const appraisalId = initiateResponse.body.data.id;

    // Verify appraisal in database
    const dbAppraisal = await executeQuery<TestAppraisal>(
      'SELECT * FROM appraisals WHERE id = $1',
      [appraisalId],
      { operation: 'verify_appraisal_created' }
    );

    expect(dbAppraisal.rows.length).toBe(1);
    expect(dbAppraisal.rows[0]!.status).toBe('draft');
    expect(dbAppraisal.rows[0]!.goals).toBeDefined();

    // Verify email notification sent (mock)
    trackEmail(
      employee.email,
      'New Performance Appraisal Cycle Initiated'
    );
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0]!.to).toBe(employee.email);

    console.log('[E2E_APPRAISAL] Step 1 complete: Appraisal initiated');

    // Step 2: Employee logs in and views appraisal
    console.log('[E2E_APPRAISAL] Step 2: Employee views appraisal');

    const viewResponse = await request(app)
      .get(`/api/appraisals/${appraisalId}`)
      .set('Authorization', `Bearer ${employee.token}`);

    expect(viewResponse.status).toBe(200);
    expect(viewResponse.body.success).toBe(true);
    expect(viewResponse.body.data.id).toBe(appraisalId);
    expect(viewResponse.body.data.status).toBe('draft');
    expect(viewResponse.body.data.goals).toBeDefined();

    console.log('[E2E_APPRAISAL] Step 2 complete: Employee viewed appraisal');

    // Step 3: Employee submits self-assessment
    console.log('[E2E_APPRAISAL] Step 3: Employee submits self-assessment');

    const selfAssessmentText = `
Technical Achievements:
- Successfully delivered 5 major features
- Improved code quality through comprehensive testing
- Mentored 1 junior developer

Areas for Growth:
- Want to improve system design skills
- Need more experience with distributed systems

Goals Progress:
- TypeScript mastery: 70% complete
- Mentorship: Started mentoring 1 developer, on track for 2
    `.trim();

    const selfAssessmentResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: selfAssessmentText,
        goals: {
          technical: [
            {
              title: 'Master TypeScript',
              description: 'Become proficient in advanced TypeScript patterns',
              targetDate: '2024-06-30',
              status: 'in_progress',
              progress: 70,
            },
          ],
          professional: [
            {
              title: 'Mentorship',
              description: 'Mentor 2 junior developers',
              targetDate: '2024-12-31',
              status: 'in_progress',
              progress: 50,
            },
          ],
        },
      });

    expect(selfAssessmentResponse.status).toBe(200);
    expect(selfAssessmentResponse.body.success).toBe(true);
    expect(selfAssessmentResponse.body.data.status).toBe('submitted');
    expect(selfAssessmentResponse.body.data.selfAssessment).toBe(selfAssessmentText);

    // Verify status transition in database
    const dbAfterSelfAssessment = await executeQuery<TestAppraisal>(
      'SELECT * FROM appraisals WHERE id = $1',
      [appraisalId],
      { operation: 'verify_self_assessment' }
    );

    expect(dbAfterSelfAssessment.rows[0]!.status).toBe('submitted');
    expect(dbAfterSelfAssessment.rows[0]!.selfAssessment).toBe(selfAssessmentText);

    console.log('[E2E_APPRAISAL] Step 3 complete: Self-assessment submitted');

    // Step 4: Manager reviews and provides rating and feedback
    console.log('[E2E_APPRAISAL] Step 4: Manager submits review');

    const managerFeedbackText = `
Performance Summary:
Excellent performance this year. Consistently delivered high-quality work and showed great initiative.

Strengths:
- Strong technical skills
- Good collaboration with team
- Takes ownership of projects

Development Areas:
- Continue building system design expertise
- Take on more architectural decisions

Overall: Exceeded expectations
    `.trim();

    const reviewResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: managerFeedbackText,
        rating: 4,
        goals: {
          technical: [
            {
              title: 'Master TypeScript',
              description: 'Become proficient in advanced TypeScript patterns',
              targetDate: '2024-06-30',
              status: 'completed',
              progress: 100,
              managerNotes: 'Excellent progress, demonstrated mastery',
            },
          ],
          professional: [
            {
              title: 'Mentorship',
              description: 'Mentor 2 junior developers',
              targetDate: '2024-12-31',
              status: 'in_progress',
              progress: 50,
              managerNotes: 'On track, good mentoring approach',
            },
          ],
        },
      });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.success).toBe(true);
    expect(reviewResponse.body.data.status).toBe('completed');
    expect(reviewResponse.body.data.managerFeedback).toBe(managerFeedbackText);
    expect(reviewResponse.body.data.rating).toBe(4);

    // Verify final status in database
    const dbAfterReview = await executeQuery<TestAppraisal>(
      'SELECT * FROM appraisals WHERE id = $1',
      [appraisalId],
      { operation: 'verify_review_completed' }
    );

    expect(dbAfterReview.rows[0]!.status).toBe('completed');
    expect(dbAfterReview.rows[0]!.managerFeedback).toBe(managerFeedbackText);
    expect(dbAfterReview.rows[0]!.rating).toBe(4);
    expect(dbAfterReview.rows[0]!.completedAt).toBeDefined();

    // Verify email notification sent (mock)
    trackEmail(
      employee.email,
      'Performance Appraisal Review Completed'
    );
    expect(sentEmails.length).toBe(2);
    expect(sentEmails[1]!.to).toBe(employee.email);

    console.log('[E2E_APPRAISAL] Step 4 complete: Manager review submitted');

    // Step 5: Employee views completed appraisal
    console.log('[E2E_APPRAISAL] Step 5: Employee views completed appraisal');

    const finalViewResponse = await request(app)
      .get(`/api/appraisals/${appraisalId}`)
      .set('Authorization', `Bearer ${employee.token}`);

    expect(finalViewResponse.status).toBe(200);
    expect(finalViewResponse.body.success).toBe(true);
    expect(finalViewResponse.body.data.status).toBe('completed');
    expect(finalViewResponse.body.data.selfAssessment).toBe(selfAssessmentText);
    expect(finalViewResponse.body.data.managerFeedback).toBe(managerFeedbackText);
    expect(finalViewResponse.body.data.rating).toBe(4);
    expect(finalViewResponse.body.data.goals).toBeDefined();

    console.log('[E2E_APPRAISAL] Step 5 complete: Employee viewed completed appraisal');

    // Verify complete workflow in database
    const finalDbState = await executeQuery<TestAppraisal>(
      `SELECT * FROM appraisals WHERE id = $1`,
      [appraisalId],
      { operation: 'verify_final_state' }
    );

    const finalAppraisal = finalDbState.rows[0]!;
    expect(finalAppraisal.status).toBe('completed');
    expect(finalAppraisal.selfAssessment).toBe(selfAssessmentText);
    expect(finalAppraisal.managerFeedback).toBe(managerFeedbackText);
    expect(finalAppraisal.rating).toBe(4);
    expect(finalAppraisal.goals).toBeDefined();
    expect(finalAppraisal.completedAt).toBeDefined();

    console.log('[E2E_APPRAISAL] Complete workflow test passed');
  }, 60000);
});

/**
 * Goal tracking workflow test
 */
describe('Goal Setting and Tracking Workflow', () => {
  it('should track goals throughout appraisal cycle', async () => {
    console.log('[E2E_APPRAISAL] Starting goal tracking test');

    // Create appraisal with initial goals
    const createResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: new Date('2024-01-01').toISOString(),
        reviewPeriodEnd: new Date('2024-12-31').toISOString(),
        goals: {
          technical: [
            {
              title: 'Learn React',
              description: 'Master React and its ecosystem',
              targetDate: '2024-06-30',
              status: 'not_started',
            },
          ],
        },
      });

    expect(createResponse.status).toBe(201);
    const appraisalId = createResponse.body.data.id;

    // Update goals during self-assessment
    const updateGoalsResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/goals`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        goals: {
          technical: [
            {
              title: 'Learn React',
              description: 'Master React and its ecosystem',
              targetDate: '2024-06-30',
              status: 'in_progress',
              progress: 60,
              notes: 'Completed React fundamentals course',
            },
          ],
          professional: [
            {
              title: 'Public Speaking',
              description: 'Present at team meetings',
              targetDate: '2024-09-30',
              status: 'in_progress',
              progress: 30,
            },
          ],
        },
      });

    expect(updateGoalsResponse.status).toBe(200);
    expect(updateGoalsResponse.body.data.goals.technical).toHaveLength(1);
    expect(updateGoalsResponse.body.data.goals.professional).toHaveLength(1);

    // Verify goals in database
    const dbGoals = await executeQuery<TestAppraisal>(
      'SELECT goals FROM appraisals WHERE id = $1',
      [appraisalId],
      { operation: 'verify_goals_updated' }
    );

    expect(dbGoals.rows[0]!.goals).toBeDefined();
    expect(dbGoals.rows[0]!.goals!.technical).toHaveLength(1);
    expect(dbGoals.rows[0]!.goals!.professional).toHaveLength(1);

    console.log('[E2E_APPRAISAL] Goal tracking test passed');
  }, 30000);
});

/**
 * Status transition enforcement test
 */
describe('Status Transition Enforcement', () => {
  it('should enforce valid status transitions', async () => {
    console.log('[E2E_APPRAISAL] Starting status transition test');

    // Create appraisal (draft status)
    const createResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: new Date('2024-01-01').toISOString(),
        reviewPeriodEnd: new Date('2024-12-31').toISOString(),
      });

    expect(createResponse.status).toBe(201);
    const appraisalId = createResponse.body.data.id;

    // Try to submit review before self-assessment (should fail)
    const invalidReviewResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Great work!',
        rating: 5,
      });

    expect(invalidReviewResponse.status).toBe(400);
    expect(invalidReviewResponse.body.success).toBe(false);

    // Submit self-assessment (draft -> submitted)
    const selfAssessmentResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: 'I did great work this year.',
      });

    expect(selfAssessmentResponse.status).toBe(200);
    expect(selfAssessmentResponse.body.data.status).toBe('submitted');

    // Try to submit self-assessment again (should fail)
    const duplicateSelfAssessmentResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: 'Updated assessment.',
      });

    expect(duplicateSelfAssessmentResponse.status).toBe(400);
    expect(duplicateSelfAssessmentResponse.body.success).toBe(false);

    // Submit review (submitted -> completed)
    const reviewResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Excellent performance!',
        rating: 5,
      });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.data.status).toBe('completed');

    // Try to modify completed appraisal (should fail)
    const modifyCompletedResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Updated feedback.',
        rating: 4,
      });

    expect(modifyCompletedResponse.status).toBe(400);
    expect(modifyCompletedResponse.body.success).toBe(false);

    console.log('[E2E_APPRAISAL] Status transition test passed');
  }, 30000);
});

/**
 * Rating validation test
 */
describe('Rating Validation', () => {
  it('should validate rating is between 1-5', async () => {
    console.log('[E2E_APPRAISAL] Starting rating validation test');

    // Create and submit appraisal
    const createResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: new Date('2024-01-01').toISOString(),
        reviewPeriodEnd: new Date('2024-12-31').toISOString(),
      });

    const appraisalId = createResponse.body.data.id;

    await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: 'Good year.',
      });

    // Try rating below 1
    const lowRatingResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Feedback',
        rating: 0,
      });

    expect(lowRatingResponse.status).toBe(400);
    expect(lowRatingResponse.body.success).toBe(false);

    // Try rating above 5
    const highRatingResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Feedback',
        rating: 6,
      });

    expect(highRatingResponse.status).toBe(400);
    expect(highRatingResponse.body.success).toBe(false);

    // Valid rating
    const validRatingResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Feedback',
        rating: 3,
      });

    expect(validRatingResponse.status).toBe(200);
    expect(validRatingResponse.body.data.rating).toBe(3);

    console.log('[E2E_APPRAISAL] Rating validation test passed');
  }, 30000);
});

/**
 * Input validation test
 */
describe('Input Validation', () => {
  it('should validate self-assessment and feedback length', async () => {
    console.log('[E2E_APPRAISAL] Starting input validation test');

    // Create appraisal
    const createResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: new Date('2024-01-01').toISOString(),
        reviewPeriodEnd: new Date('2024-12-31').toISOString(),
      });

    const appraisalId = createResponse.body.data.id;

    // Try self-assessment exceeding 5000 chars
    const longSelfAssessment = 'a'.repeat(5001);
    const longSelfAssessmentResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: longSelfAssessment,
      });

    expect(longSelfAssessmentResponse.status).toBe(400);
    expect(longSelfAssessmentResponse.body.success).toBe(false);

    // Valid self-assessment
    const validSelfAssessmentResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: 'Valid assessment within limit.',
      });

    expect(validSelfAssessmentResponse.status).toBe(200);

    // Try manager feedback exceeding 5000 chars
    const longFeedback = 'b'.repeat(5001);
    const longFeedbackResponse = await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: longFeedback,
        rating: 4,
      });

    expect(longFeedbackResponse.status).toBe(400);
    expect(longFeedbackResponse.body.success).toBe(false);

    console.log('[E2E_APPRAISAL] Input validation test passed');
  }, 30000);
});

/**
 * Email notification test
 */
describe('Email Notifications', () => {
  it('should send emails at appropriate workflow steps', async () => {
    console.log('[E2E_APPRAISAL] Starting email notification test');

    // Clear email tracking
    sentEmails.length = 0;

    // Create appraisal (should send email)
    const createResponse = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        employeeId: regularEmployee.id,
        reviewPeriodStart: new Date('2024-01-01').toISOString(),
        reviewPeriodEnd: new Date('2024-12-31').toISOString(),
      });

    const appraisalId = createResponse.body.data.id;

    // Mock email sent
    trackEmail(employee.email, 'New Performance Appraisal Cycle Initiated');
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0]!.subject).toContain('Appraisal');

    // Submit self-assessment
    await request(app)
      .patch(`/api/appraisals/${appraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        selfAssessment: 'Assessment',
      });

    // Complete review (should send email)
    await request(app)
      .patch(`/api/appraisals/${appraisalId}/review`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        managerFeedback: 'Feedback',
        rating: 4,
      });

    // Mock email sent
    trackEmail(employee.email, 'Performance Appraisal Review Completed');
    expect(sentEmails.length).toBe(2);
    expect(sentEmails[1]!.subject).toContain('Completed');

    console.log('[E2E_APPRAISAL] Email notification test passed');
  }, 30000);
});