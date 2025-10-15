/**
 * Onboarding API Integration Tests
 * 
 * Comprehensive integration test suite for employee onboarding workflow endpoints.
 * Tests all API endpoints with proper authentication, authorization, file uploads,
 * and database state verification.
 * 
 * Test Coverage:
 * - Template management (create, list)
 * - Workflow assignment
 * - Employee task management
 * - Task completion with document upload
 * - Manager team progress monitoring
 * - Role-based access control
 * - File upload validation
 * - Error handling
 * 
 * @module tests/integration/onboarding.api
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction, shutdown } from '../../src/db/index.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';
import type { Express } from 'express';
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Test Setup and Teardown
// ============================================================================

let app: Express;
let pool: Pool;

// Test user tokens
let hrAdminToken: string;
let managerToken: string;
let employeeToken: string;
let otherEmployeeToken: string;

// Test user IDs
let hrAdminUserId: string;
let managerUserId: string;
let employeeUserId: string;
let otherEmployeeUserId: string;

// Test data IDs
let templateId: string;
let workflowId: string;
let taskId: string;

// Test file paths
const testFilesDir = path.join(__dirname, '../fixtures/files');
const uploadDir = path.join(__dirname, '../../uploads/test');

/**
 * Create test users with different roles
 */
async function createTestUsers(): Promise<void> {
  const timestamp = new Date();
  const passwordHash = (await hashPassword('TestPassword123!')).hash!;

  // Create HR Admin
  hrAdminUserId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      hrAdminUserId,
      'hradmin@test.com',
      passwordHash,
      'HR',
      'Admin',
      'HR_ADMIN',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_hr_admin' }
  );

  // Create Manager
  managerUserId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      managerUserId,
      'manager@test.com',
      passwordHash,
      'Test',
      'Manager',
      'MANAGER',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_manager' }
  );

  // Create Employee
  employeeUserId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      employeeUserId,
      'employee@test.com',
      passwordHash,
      'Test',
      'Employee',
      'EMPLOYEE',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_employee' }
  );

  // Create another Employee
  otherEmployeeUserId = crypto.randomUUID();
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      otherEmployeeUserId,
      'other@test.com',
      passwordHash,
      'Other',
      'Employee',
      'EMPLOYEE',
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_other_employee' }
  );

  // Create employee records
  await executeQuery(
    `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      crypto.randomUUID(),
      employeeUserId,
      'EMP001',
      'Software Engineer',
      null,
      managerUserId,
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
      otherEmployeeUserId,
      'EMP002',
      'Product Manager',
      null,
      managerUserId,
      timestamp,
      'ACTIVE',
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_other_employee_record' }
  );

  console.log('[TEST_SETUP] Test users created successfully');
}

/**
 * Generate authentication tokens for test users
 */
function generateTestTokens(): void {
  hrAdminToken = generateAccessToken(hrAdminUserId, 'hradmin@test.com', 'HR_ADMIN', {
    correlationId: 'test_setup',
  });

  managerToken = generateAccessToken(managerUserId, 'manager@test.com', 'MANAGER', {
    correlationId: 'test_setup',
  });

  employeeToken = generateAccessToken(employeeUserId, 'employee@test.com', 'EMPLOYEE', {
    correlationId: 'test_setup',
  });

  otherEmployeeToken = generateAccessToken(otherEmployeeUserId, 'other@test.com', 'EMPLOYEE', {
    correlationId: 'test_setup',
  });

  console.log('[TEST_SETUP] Test tokens generated successfully');
}

/**
 * Create test file fixtures
 */
function createTestFiles(): void {
  // Create directories
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Create valid PDF file (minimal valid PDF)
  const validPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  );
  fs.writeFileSync(path.join(testFilesDir, 'valid.pdf'), validPdf);

  // Create valid image file (1x1 PNG)
  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(testFilesDir, 'valid.png'), validPng);

  // Create invalid file type
  fs.writeFileSync(path.join(testFilesDir, 'invalid.txt'), 'This is a text file');

  // Create large file (> 10MB)
  const largeFile = Buffer.alloc(11 * 1024 * 1024, 'a');
  fs.writeFileSync(path.join(testFilesDir, 'large.pdf'), largeFile);

  console.log('[TEST_SETUP] Test files created successfully');
}

/**
 * Clean up test files
 */
function cleanupTestFiles(): void {
  if (fs.existsSync(testFilesDir)) {
    fs.rmSync(testFilesDir, { recursive: true, force: true });
  }
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
  console.log('[TEST_CLEANUP] Test files cleaned up');
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase(): Promise<void> {
  await executeTransaction(async (client) => {
    // Delete in reverse dependency order
    await client.query('DELETE FROM onboarding_tasks WHERE 1=1');
    await client.query('DELETE FROM onboarding_workflows WHERE 1=1');
    await client.query('DELETE FROM onboarding_templates WHERE 1=1');
    await client.query('DELETE FROM employees WHERE 1=1');
    await client.query('DELETE FROM users WHERE email LIKE \'%@test.com\'');
  }, { operation: 'cleanup_test_database' });

  console.log('[TEST_CLEANUP] Test database cleaned up');
}

// ============================================================================
// Test Suite Setup
// ============================================================================

beforeAll(async () => {
  console.log('[TEST_SUITE] Starting onboarding API integration tests...');

  // Initialize application
  app = createApp();
  pool = getPool();

  // Create test data
  await createTestUsers();
  generateTestTokens();
  createTestFiles();

  console.log('[TEST_SUITE] Setup completed successfully');
});

afterAll(async () => {
  console.log('[TEST_SUITE] Cleaning up...');

  // Cleanup
  await cleanupTestDatabase();
  cleanupTestFiles();
  await shutdown({ timeout: 5000 });

  console.log('[TEST_SUITE] Cleanup completed');
});

beforeEach(() => {
  console.log('[TEST] Starting test...');
});

afterEach(() => {
  console.log('[TEST] Test completed');
});

// ============================================================================
// Template Management Tests
// ============================================================================

describe('POST /api/onboarding/templates', () => {
  it('should create template successfully as HR Admin', async () => {
    const templateData = {
      name: 'Software Engineer Onboarding',
      description: 'Standard onboarding for software engineers',
      tasks: [
        {
          title: 'Complete HR paperwork',
          description: 'Fill out all required HR forms',
          daysUntilDue: 1,
          order: 1,
          requiresDocument: true,
        },
        {
          title: 'Setup development environment',
          description: 'Install required software and tools',
          daysUntilDue: 3,
          order: 2,
          requiresDocument: false,
        },
        {
          title: 'Complete security training',
          description: 'Watch security training videos',
          daysUntilDue: 5,
          order: 3,
          requiresDocument: true,
        },
      ],
      estimatedDays: 7,
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(templateData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      template: {
        id: expect.any(String),
        name: templateData.name,
        description: templateData.description,
        estimatedDays: templateData.estimatedDays,
        isActive: true,
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete HR paperwork',
            order: 1,
            requiresDocument: true,
          }),
          expect.objectContaining({
            title: 'Setup development environment',
            order: 2,
            requiresDocument: false,
          }),
          expect.objectContaining({
            title: 'Complete security training',
            order: 3,
            requiresDocument: true,
          }),
        ]),
      },
    });

    // Store template ID for later tests
    templateId = response.body.template.id;

    // Verify database state
    const dbTemplate = await executeQuery(
      'SELECT * FROM onboarding_templates WHERE id = $1',
      [templateId],
      { operation: 'verify_template_creation' }
    );

    expect(dbTemplate.rows).toHaveLength(1);
    expect(dbTemplate.rows[0]).toMatchObject({
      id: templateId,
      name: templateData.name,
      is_active: true,
    });
  });

  it('should return 403 when Employee tries to create template', async () => {
    const templateData = {
      name: 'Unauthorized Template',
      description: 'This should fail',
      tasks: [],
      estimatedDays: 5,
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(templateData)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
      message: expect.stringContaining('permissions'),
    });
  });

  it('should validate required fields', async () => {
    const invalidData = {
      name: '',
      tasks: [],
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(invalidData)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('should validate task structure', async () => {
    const invalidData = {
      name: 'Test Template',
      description: 'Test',
      tasks: [
        {
          title: 'Task without required fields',
          // Missing daysUntilDue, order, requiresDocument
        },
      ],
      estimatedDays: 5,
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(invalidData)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('GET /api/onboarding/templates', () => {
  it('should list templates successfully as HR Admin', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      templates: expect.arrayContaining([
        expect.objectContaining({
          id: templateId,
          name: 'Software Engineer Onboarding',
        }),
      ]),
      pagination: {
        page: 1,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
  });

  it('should list templates successfully as Manager', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      templates: expect.any(Array),
    });
  });

  it('should return 403 when Employee tries to list templates', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates?page=1&limit=10')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
  });
});

// ============================================================================
// Workflow Assignment Tests
// ============================================================================

describe('POST /api/onboarding/workflows', () => {
  it('should assign workflow successfully as HR Admin', async () => {
    const workflowData = {
      employeeId: employeeUserId,
      templateId: templateId,
      targetCompletionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(workflowData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      workflow: {
        id: expect.any(String),
        employeeId: employeeUserId,
        templateId: templateId,
        status: 'IN_PROGRESS',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete HR paperwork',
            status: 'PENDING',
          }),
        ]),
      },
    });

    // Store workflow ID for later tests
    workflowId = response.body.workflow.id;
    taskId = response.body.workflow.tasks[0].id;

    // Verify database state
    const dbWorkflow = await executeQuery(
      'SELECT * FROM onboarding_workflows WHERE id = $1',
      [workflowId],
      { operation: 'verify_workflow_creation' }
    );

    expect(dbWorkflow.rows).toHaveLength(1);
    expect(dbWorkflow.rows[0]).toMatchObject({
      id: workflowId,
      employee_id: employeeUserId,
      template_id: templateId,
      status: 'IN_PROGRESS',
    });

    // Verify tasks were created
    const dbTasks = await executeQuery(
      'SELECT * FROM onboarding_tasks WHERE workflow_id = $1 ORDER BY task_order',
      [workflowId],
      { operation: 'verify_tasks_creation' }
    );

    expect(dbTasks.rows).toHaveLength(3);
  });

  it('should return 404 when employee not found', async () => {
    const workflowData = {
      employeeId: crypto.randomUUID(),
      templateId: templateId,
    };

    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(workflowData)
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'EMPLOYEE_NOT_FOUND',
    });
  });

  it('should return 404 when template not found', async () => {
    const workflowData = {
      employeeId: employeeUserId,
      templateId: crypto.randomUUID(),
    };

    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send(workflowData)
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'TEMPLATE_NOT_FOUND',
    });
  });

  it('should return 403 when Employee tries to assign workflow', async () => {
    const workflowData = {
      employeeId: employeeUserId,
      templateId: templateId,
    };

    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(workflowData)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });
});

// ============================================================================
// Employee Task Management Tests
// ============================================================================

describe('GET /api/onboarding/my-tasks', () => {
  it('should return tasks successfully as Employee', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          title: 'Complete HR paperwork',
          status: 'PENDING',
          requiresDocument: true,
        }),
      ]),
    });
  });

  it('should return empty list when no tasks assigned', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tasks: [],
    });
  });

  it('should work for HR Admin viewing their own tasks', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tasks: expect.any(Array),
    });
  });
});

// ============================================================================
// Task Completion Tests
// ============================================================================

describe('PATCH /api/onboarding/tasks/:id', () => {
  it('should complete task with document upload successfully', async () => {
    const response = await request(app)
      .patch(`/api/onboarding/tasks/${taskId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('document', path.join(testFilesDir, 'valid.pdf'))
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      task: {
        id: taskId,
        status: 'COMPLETED',
        completedAt: expect.any(String),
        documentUrl: expect.stringContaining('uploads'),
      },
    });

    // Verify database state
    const dbTask = await executeQuery(
      'SELECT * FROM onboarding_tasks WHERE id = $1',
      [taskId],
      { operation: 'verify_task_completion' }
    );

    expect(dbTask.rows[0]).toMatchObject({
      id: taskId,
      status: 'COMPLETED',
      completed_at: expect.any(Date),
      document_url: expect.any(String),
    });

    // Verify file was uploaded
    expect(fs.existsSync(response.body.task.documentUrl)).toBe(true);
  });

  it('should reject invalid file type', async () => {
    // Get a pending task
    const tasks = await executeQuery(
      'SELECT id FROM onboarding_tasks WHERE workflow_id = $1 AND status = $2 LIMIT 1',
      [workflowId, 'PENDING'],
      { operation: 'get_pending_task' }
    );

    const pendingTaskId = tasks.rows[0].id;

    const response = await request(app)
      .patch(`/api/onboarding/tasks/${pendingTaskId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('document', path.join(testFilesDir, 'invalid.txt'))
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'INVALID_FILE_TYPE',
      message: expect.stringContaining('file type'),
    });
  });

  it('should reject file exceeding size limit', async () => {
    // Get a pending task
    const tasks = await executeQuery(
      'SELECT id FROM onboarding_tasks WHERE workflow_id = $1 AND status = $2 LIMIT 1',
      [workflowId, 'PENDING'],
      { operation: 'get_pending_task' }
    );

    const pendingTaskId = tasks.rows[0].id;

    const response = await request(app)
      .patch(`/api/onboarding/tasks/${pendingTaskId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('document', path.join(testFilesDir, 'large.pdf'))
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: expect.stringContaining('size'),
    });
  });

  it('should return 403 when trying to complete another employee\'s task', async () => {
    const response = await request(app)
      .patch(`/api/onboarding/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .attach('document', path.join(testFilesDir, 'valid.pdf'))
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('should return 404 when task not found', async () => {
    const response = await request(app)
      .patch(`/api/onboarding/tasks/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('document', path.join(testFilesDir, 'valid.pdf'))
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'TASK_NOT_FOUND',
    });
  });

  it('should require document when task requires it', async () => {
    // Get a pending task that requires document
    const tasks = await executeQuery(
      'SELECT id FROM onboarding_tasks WHERE workflow_id = $1 AND status = $2 AND requires_document = true LIMIT 1',
      [workflowId, 'PENDING'],
      { operation: 'get_pending_task_requiring_document' }
    );

    if (tasks.rows.length > 0) {
      const pendingTaskId = tasks.rows[0].id;

      const response = await request(app)
        .patch(`/api/onboarding/tasks/${pendingTaskId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'DOCUMENT_REQUIRED',
      });
    }
  });

  it('should allow completion without document when not required', async () => {
    // Get a pending task that doesn't require document
    const tasks = await executeQuery(
      'SELECT id FROM onboarding_tasks WHERE workflow_id = $1 AND status = $2 AND requires_document = false LIMIT 1',
      [workflowId, 'PENDING'],
      { operation: 'get_pending_task_no_document' }
    );

    if (tasks.rows.length > 0) {
      const pendingTaskId = tasks.rows[0].id;

      const response = await request(app)
        .patch(`/api/onboarding/tasks/${pendingTaskId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        task: {
          id: pendingTaskId,
          status: 'COMPLETED',
          documentUrl: null,
        },
      });
    }
  });
});

// ============================================================================
// Manager Team Progress Tests
// ============================================================================

describe('GET /api/onboarding/team-progress', () => {
  it('should return team progress successfully as Manager', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      teamProgress: expect.arrayContaining([
        expect.objectContaining({
          employeeId: employeeUserId,
          employeeName: expect.any(String),
          workflowStatus: 'IN_PROGRESS',
          totalTasks: 3,
          completedTasks: expect.any(Number),
          progressPercentage: expect.any(Number),
        }),
      ]),
    });
  });

  it('should return all team progress as HR Admin', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      teamProgress: expect.any(Array),
    });
  });

  it('should return 403 when Employee tries to view team progress', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('should filter by employee when specified', async () => {
    const response = await request(app)
      .get(`/api/onboarding/team-progress?employeeId=${employeeUserId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      teamProgress: expect.arrayContaining([
        expect.objectContaining({
          employeeId: employeeUserId,
        }),
      ]),
    });

    // Should only return the specified employee
    expect(response.body.teamProgress.every((p: any) => p.employeeId === employeeUserId)).toBe(true);
  });
});

// ============================================================================
// Authentication and Authorization Tests
// ============================================================================

describe('Authentication and Authorization', () => {
  it('should return 401 when no token provided', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      code: 'MISSING_TOKEN',
    });
  });

  it('should return 401 when invalid token provided', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', 'Bearer invalid_token')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      code: expect.stringMatching(/TOKEN|INVALID/),
    });
  });

  it('should enforce role-based access control', async () => {
    // Employee cannot create templates
    await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Test', tasks: [], estimatedDays: 5 })
      .expect(403);

    // Employee cannot view templates
    await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    // Employee cannot assign workflows
    await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employeeId: employeeUserId, templateId: templateId })
      .expect(403);

    // Employee cannot view team progress
    await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    // Attempt to create workflow with invalid data that would cause DB error
    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        employeeId: 'invalid-uuid',
        templateId: templateId,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: expect.any(String),
    });
  });

  it('should validate request body structure', async () => {
    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send('invalid json')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
    });
  });

  it('should handle missing required fields', async () => {
    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });
});

console.log('[TEST_MODULE] Onboarding API integration tests loaded');

export default describe;