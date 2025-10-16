/**
 * Appraisal API Integration Tests
 * 
 * Comprehensive integration test suite for appraisal management endpoints.
 * Tests authentication, authorization, business logic, and data validation.
 * 
 * Test Coverage:
 * - POST /api/appraisals - Create appraisal cycle
 * - GET /api/appraisals/:id - Get appraisal by ID
 * - GET /api/appraisals/my-appraisals - Get employee's appraisals
 * - GET /api/appraisals/team - Get team appraisals
 * - GET /api/appraisals - Get all appraisals
 * - PATCH /api/appraisals/:id/self-assessment - Submit self-assessment
 * - PATCH /api/appraisals/:id/review - Submit manager review
 * - PATCH /api/appraisals/:id/goals - Update goals
 * 
 * @module tests/integration/appraisal.api
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import type { Application } from 'express';
import crypto from 'crypto';

// Test application instance
let app: Application;

// Test user IDs and tokens
let hrAdminId: string;
let hrAdminToken: string;
let managerId: string;
let managerToken: string;
let employeeId: string;
let employeeToken: string;
let otherEmployeeId: string;
let otherEmployeeToken: string;

// Test appraisal IDs
let testAppraisalId: string;
let draftAppraisalId: string;
let submittedAppraisalId: string;

/**
 * Setup test database and create test users
 */
beforeAll(async () => {
  console.log('[APPRAISAL_API_TEST] Setting up test environment');

  // Initialize application
  app = createApp();

  // Create test users
  const timestamp = new Date();

  // HR Admin
  hrAdminId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      hrAdminId,
      'hradmin@test.com',
      '$2b$10$test.hash',
      'HR',
      'Admin',
      'HR_ADMIN',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_hr_admin' }
  );
  hrAdminToken = generateAccessToken(hrAdminId, 'hradmin@test.com', 'HR_ADMIN');

  // Manager
  managerId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      managerId,
      'manager@test.com',
      '$2b$10$test.hash',
      'Test',
      'Manager',
      'MANAGER',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_manager' }
  );
  managerToken = generateAccessToken(managerId, 'manager@test.com', 'MANAGER');

  // Employee
  employeeId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      employeeId,
      'employee@test.com',
      '$2b$10$test.hash',
      'Test',
      'Employee',
      'EMPLOYEE',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_employee' }
  );
  employeeToken = generateAccessToken(employeeId, 'employee@test.com', 'EMPLOYEE');

  // Other Employee
  otherEmployeeId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      otherEmployeeId,
      'other@test.com',
      '$2b$10$test.hash',
      'Other',
      'Employee',
      'EMPLOYEE',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_other_employee' }
  );
  otherEmployeeToken = generateAccessToken(otherEmployeeId, 'other@test.com', 'EMPLOYEE');

  // Create employee records
  await executeQuery(
    `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      crypto.randomUUID(),
      employeeId,
      'EMP001',
      'Software Engineer',
      null,
      managerId,
      timestamp,
      'ACTIVE',
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_employee_record' }
  );

  await executeQuery(
    `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      crypto.randomUUID(),
      otherEmployeeId,
      'EMP002',
      'Software Engineer',
      null,
      managerId,
      timestamp,
      'ACTIVE',
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_other_employee_record' }
  );

  console.log('[APPRAISAL_API_TEST] Test environment setup complete');
});

/**
 * Cleanup test database
 */
afterAll(async () => {
  console.log('[APPRAISAL_API_TEST] Cleaning up test environment');

  // Delete test data
  await executeQuery('DELETE FROM appraisals WHERE employee_id IN ($1, $2)', [employeeId, otherEmployeeId]);
  await executeQuery('DELETE FROM employees WHERE user_id IN ($1, $2)', [employeeId, otherEmployeeId]);
  await executeQuery('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [hrAdminId, managerId, employeeId, otherEmployeeId]);

  // Close database connection
  const pool = getPool();
  await pool.end();

  console.log('[APPRAISAL_API_TEST] Test environment cleanup complete');
});

/**
 * Setup test appraisals before each test
 */
beforeEach(async () => {
  const timestamp = new Date();
  const reviewPeriodStart = new Date(timestamp);
  reviewPeriodStart.setMonth(reviewPeriodStart.getMonth() - 6);
  const reviewPeriodEnd = new Date(timestamp);

  // Create draft appraisal
  draftAppraisalId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO appraisals (id, employee_id, reviewer_id, review_period_start, review_period_end, status, rating, self_assessment, manager_feedback, goals, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      draftAppraisalId,
      employeeId,
      managerId,
      reviewPeriodStart,
      reviewPeriodEnd,
      'draft',
      null,
      null,
      null,
      null,
      timestamp,
      timestamp,
    ],
    { operation: 'create_draft_appraisal' }
  );

  // Create submitted appraisal
  submittedAppraisalId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO appraisals (id, employee_id, reviewer_id, review_period_start, review_period_end, status, rating, self_assessment, manager_feedback, goals, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      submittedAppraisalId,
      employeeId,
      managerId,
      reviewPeriodStart,
      reviewPeriodEnd,
      'submitted',
      null,
      'Test self-assessment',
      null,
      JSON.stringify([{ title: 'Goal 1', description: 'Test goal', status: 'in_progress' }]),
      timestamp,
      timestamp,
    ],
    { operation: 'create_submitted_appraisal' }
  );
});

/**
 * Cleanup test appraisals after each test
 */
afterEach(async () => {
  await executeQuery('DELETE FROM appraisals WHERE id IN ($1, $2)', [draftAppraisalId, submittedAppraisalId]);
  if (testAppraisalId) {
    await executeQuery('DELETE FROM appraisals WHERE id = $1', [testAppraisalId]);
    testAppraisalId = '';
  }
});

describe('POST /api/appraisals', () => {
  it('should create appraisal as Manager', async () => {
    const reviewPeriodStart = new Date();
    reviewPeriodStart.setMonth(reviewPeriodStart.getMonth() - 6);
    const reviewPeriodEnd = new Date();

    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Appraisal created successfully',
    });
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.employeeId).toBe(employeeId);
    expect(response.body.data.reviewerId).toBe(managerId);
    expect(response.body.data.status).toBe('draft');

    testAppraisalId = response.body.data.id;
  });

  it('should return 403 when Employee tries to create appraisal', async () => {
    const reviewPeriodStart = new Date();
    reviewPeriodStart.setMonth(reviewPeriodStart.getMonth() - 6);
    const reviewPeriodEnd = new Date();

    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
      })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should validate manager-employee relationship', async () => {
    const reviewPeriodStart = new Date();
    reviewPeriodStart.setMonth(reviewPeriodStart.getMonth() - 6);
    const reviewPeriodEnd = new Date();

    // Create employee with different manager
    const differentManagerId = crypto.randomUUID();
    const differentEmployeeId = crypto.randomUUID();
    const timestamp = new Date();

    await executeQuery(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        differentManagerId,
        'different@test.com',
        '$2b$10$test.hash',
        'Different',
        'Manager',
        'MANAGER',
        true,
        timestamp,
        timestamp,
      ]
    );

    await executeQuery(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        differentEmployeeId,
        'diffemp@test.com',
        '$2b$10$test.hash',
        'Different',
        'Employee',
        'EMPLOYEE',
        true,
        timestamp,
        timestamp,
      ]
    );

    await executeQuery(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        differentEmployeeId,
        'EMP999',
        'Software Engineer',
        null,
        differentManagerId,
        timestamp,
        'ACTIVE',
        timestamp,
        timestamp,
      ]
    );

    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId: differentEmployeeId,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
      })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');

    // Cleanup
    await executeQuery('DELETE FROM employees WHERE user_id = $1', [differentEmployeeId]);
    await executeQuery('DELETE FROM users WHERE id IN ($1, $2)', [differentManagerId, differentEmployeeId]);
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should validate review period dates', async () => {
    const reviewPeriodStart = new Date();
    const reviewPeriodEnd = new Date();
    reviewPeriodEnd.setMonth(reviewPeriodEnd.getMonth() - 6); // End before start

    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/appraisals/:id', () => {
  it('should get appraisal with proper authorization', async () => {
    const response = await request(app)
      .get(`/api/appraisals/${draftAppraisalId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(draftAppraisalId);
    expect(response.body.data.employeeId).toBe(employeeId);
  });

  it('should return 403 for unauthorized access', async () => {
    const response = await request(app)
      .get(`/api/appraisals/${draftAppraisalId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should allow manager to access team member appraisal', async () => {
    const response = await request(app)
      .get(`/api/appraisals/${draftAppraisalId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(draftAppraisalId);
  });

  it('should allow HR Admin to access any appraisal', async () => {
    const response = await request(app)
      .get(`/api/appraisals/${draftAppraisalId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(draftAppraisalId);
  });

  it('should return 404 for non-existent appraisal', async () => {
    const nonExistentId = crypto.randomUUID();
    const response = await request(app)
      .get(`/api/appraisals/${nonExistentId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/appraisals/my-appraisals', () => {
  it('should get employee appraisals with pagination', async () => {
    const response = await request(app)
      .get('/api/appraisals/my-appraisals')
      .set('Authorization', `Bearer ${employeeToken}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it('should return only employee own appraisals', async () => {
    const response = await request(app)
      .get('/api/appraisals/my-appraisals')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    response.body.data.forEach((appraisal: any) => {
      expect(appraisal.employeeId).toBe(employeeId);
    });
  });

  it('should handle pagination correctly', async () => {
    const response = await request(app)
      .get('/api/appraisals/my-appraisals')
      .set('Authorization', `Bearer ${employeeToken}`)
      .query({ page: 1, limit: 1 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(1);
    expect(response.body.pagination.limit).toBe(1);
  });
});

describe('GET /api/appraisals/team', () => {
  it('should get team appraisals as Manager', async () => {
    const response = await request(app)
      .get('/api/appraisals/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should return 403 as Employee', async () => {
    const response = await request(app)
      .get('/api/appraisals/team')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should return only team member appraisals', async () => {
    const response = await request(app)
      .get('/api/appraisals/team')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    response.body.data.forEach((appraisal: any) => {
      expect(appraisal.reviewerId).toBe(managerId);
    });
  });
});

describe('GET /api/appraisals', () => {
  it('should get all appraisals as HR Admin', async () => {
    const response = await request(app)
      .get('/api/appraisals')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should return 403 as Manager', async () => {
    const response = await request(app)
      .get('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 as Employee', async () => {
    const response = await request(app)
      .get('/api/appraisals')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/appraisals/:id/self-assessment', () => {
  it('should submit self-assessment as Employee', async () => {
    const selfAssessment = 'This is my self-assessment for the review period.';

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ selfAssessment })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.selfAssessment).toBe(selfAssessment);
    expect(response.body.data.status).toBe('submitted');
  });

  it('should return 422 for invalid status transition', async () => {
    const selfAssessment = 'Test self-assessment';

    const response = await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ selfAssessment })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should return 403 for other employee appraisal', async () => {
    const selfAssessment = 'Test self-assessment';

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .send({ selfAssessment })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should validate self-assessment length', async () => {
    const selfAssessment = 'a'.repeat(5001); // Exceeds max length

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ selfAssessment })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should require self-assessment text', async () => {
    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/appraisals/:id/review', () => {
  it('should submit review as Manager', async () => {
    const managerFeedback = 'Great work during this review period.';
    const rating = 4;

    const response = await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback, rating })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.managerFeedback).toBe(managerFeedback);
    expect(response.body.data.rating).toBe(rating);
    expect(response.body.data.status).toBe('completed');
  });

  it('should validate rating range', async () => {
    const managerFeedback = 'Test feedback';
    const rating = 6; // Invalid rating

    const response = await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback, rating })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 for invalid status transition', async () => {
    const managerFeedback = 'Test feedback';
    const rating = 4;

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback, rating })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should validate manager feedback length', async () => {
    const managerFeedback = 'a'.repeat(5001); // Exceeds max length
    const rating = 4;

    const response = await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback, rating })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should require both feedback and rating', async () => {
    const response = await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback: 'Test feedback' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/appraisals/:id/goals', () => {
  it('should update goals with valid JSON', async () => {
    const goals = [
      {
        title: 'Improve code quality',
        description: 'Reduce technical debt',
        status: 'in_progress',
        targetDate: new Date().toISOString(),
      },
      {
        title: 'Learn new technology',
        description: 'Complete TypeScript course',
        status: 'not_started',
        targetDate: new Date().toISOString(),
      },
    ];

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ goals })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.goals).toEqual(goals);
  });

  it('should validate goals JSON structure', async () => {
    const goals = [
      {
        title: 'Goal without required fields',
      },
    ];

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ goals })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('should allow employee to update own appraisal goals', async () => {
    const goals = [
      {
        title: 'Personal goal',
        description: 'Self-improvement',
        status: 'in_progress',
        targetDate: new Date().toISOString(),
      },
    ];

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ goals })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.goals).toEqual(goals);
  });

  it('should return 403 for unauthorized access', async () => {
    const goals = [
      {
        title: 'Test goal',
        description: 'Test description',
        status: 'in_progress',
        targetDate: new Date().toISOString(),
      },
    ];

    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .send({ goals })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should validate goals array is not empty', async () => {
    const response = await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ goals: [] })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Database state verification', () => {
  it('should verify appraisal created in database', async () => {
    const reviewPeriodStart = new Date();
    reviewPeriodStart.setMonth(reviewPeriodStart.getMonth() - 6);
    const reviewPeriodEnd = new Date();

    const response = await request(app)
      .post('/api/appraisals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        reviewPeriodStart: reviewPeriodStart.toISOString(),
        reviewPeriodEnd: reviewPeriodEnd.toISOString(),
      })
      .expect(201);

    const appraisalId = response.body.data.id;

    // Verify in database
    const result = await executeQuery(
      'SELECT * FROM appraisals WHERE id = $1',
      [appraisalId],
      { operation: 'verify_appraisal_created' }
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.employee_id).toBe(employeeId);
    expect(result.rows[0]?.reviewer_id).toBe(managerId);
    expect(result.rows[0]?.status).toBe('draft');

    // Cleanup
    await executeQuery('DELETE FROM appraisals WHERE id = $1', [appraisalId]);
  });

  it('should verify self-assessment updated in database', async () => {
    const selfAssessment = 'Database verification test';

    await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/self-assessment`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ selfAssessment })
      .expect(200);

    // Verify in database
    const result = await executeQuery(
      'SELECT * FROM appraisals WHERE id = $1',
      [draftAppraisalId],
      { operation: 'verify_self_assessment_updated' }
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.self_assessment).toBe(selfAssessment);
    expect(result.rows[0]?.status).toBe('submitted');
  });

  it('should verify review updated in database', async () => {
    const managerFeedback = 'Database verification test';
    const rating = 5;

    await request(app)
      .patch(`/api/appraisals/${submittedAppraisalId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerFeedback, rating })
      .expect(200);

    // Verify in database
    const result = await executeQuery(
      'SELECT * FROM appraisals WHERE id = $1',
      [submittedAppraisalId],
      { operation: 'verify_review_updated' }
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.manager_feedback).toBe(managerFeedback);
    expect(result.rows[0]?.rating).toBe(rating);
    expect(result.rows[0]?.status).toBe('completed');
  });

  it('should verify goals updated in database', async () => {
    const goals = [
      {
        title: 'Database test goal',
        description: 'Test description',
        status: 'in_progress',
        targetDate: new Date().toISOString(),
      },
    ];

    await request(app)
      .patch(`/api/appraisals/${draftAppraisalId}/goals`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ goals })
      .expect(200);

    // Verify in database
    const result = await executeQuery(
      'SELECT * FROM appraisals WHERE id = $1',
      [draftAppraisalId],
      { operation: 'verify_goals_updated' }
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.goals).toEqual(goals);
  });
});