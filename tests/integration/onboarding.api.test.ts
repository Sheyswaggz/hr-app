/**
 * Onboarding API Integration Tests
 * 
 * Comprehensive integration test suite for employee onboarding workflow endpoints.
 * Tests all API routes with proper authentication, authorization, file uploads,
 * and database state verification.
 * 
 * @module tests/integration/onboarding.api
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test user credentials and tokens
 */
interface TestUser {
  id: string;
  email: string;
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  token: string;
}

let testUsers: {
  hrAdmin: TestUser;
  manager: TestUser;
  employee: TestUser;
  employee2: TestUser;
};

let testTemplateId: string;
let testWorkflowId: string;
let testTaskId: string;

/**
 * Setup test database and users
 */
beforeAll(async () => {
  console.log('[ONBOARDING_API_TEST] Setting up test environment');

  // Create test users
  const hrAdminId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const employee2Id = crypto.randomUUID();

  const passwordHash = (await hashPassword('TestPassword123!')).hash!;
  const timestamp = new Date();

  await executeTransaction(async (client) => {
    // Create users
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9),
         ($10, $11, $12, $13, $14, $15, $16, $17, $18),
         ($19, $20, $21, $22, $23, $24, $25, $26, $27),
         ($28, $29, $30, $31, $32, $33, $34, $35, $36)`,
      [
        hrAdminId, 'hradmin@test.com', passwordHash, 'HR', 'Admin', 'HR_ADMIN', true, timestamp, timestamp,
        managerId, 'manager@test.com', passwordHash, 'Test', 'Manager', 'MANAGER', true, timestamp, timestamp,
        employeeId, 'employee@test.com', passwordHash, 'Test', 'Employee', 'EMPLOYEE', true, timestamp, timestamp,
        employee2Id, 'employee2@test.com', passwordHash, 'Test', 'Employee2', 'EMPLOYEE', true, timestamp, timestamp,
      ]
    );

    // Create employees
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
         ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20),
         ($21, $22, $23, $24, $25, $26, $27, $28, $29, $30)`,
      [
        crypto.randomUUID(), managerId, 'MGR001', 'Manager', 'dept-1', null, timestamp, 'ACTIVE', timestamp, timestamp,
        crypto.randomUUID(), employeeId, 'EMP001', 'Employee', 'dept-1', managerId, timestamp, 'ACTIVE', timestamp, timestamp,
        crypto.randomUUID(), employee2Id, 'EMP002', 'Employee', 'dept-1', managerId, timestamp, 'ACTIVE', timestamp, timestamp,
      ]
    );
  });

  // Generate tokens
  testUsers = {
    hrAdmin: {
      id: hrAdminId,
      email: 'hradmin@test.com',
      role: 'HR_ADMIN',
      token: generateAccessToken(hrAdminId, 'hradmin@test.com', 'HR_ADMIN'),
    },
    manager: {
      id: managerId,
      email: 'manager@test.com',
      role: 'MANAGER',
      token: generateAccessToken(managerId, 'manager@test.com', 'MANAGER'),
    },
    employee: {
      id: employeeId,
      email: 'employee@test.com',
      role: 'EMPLOYEE',
      token: generateAccessToken(employeeId, 'employee@test.com', 'EMPLOYEE'),
    },
    employee2: {
      id: employee2Id,
      email: 'employee2@test.com',
      role: 'EMPLOYEE',
      token: generateAccessToken(employee2Id, 'employee2@test.com', 'EMPLOYEE'),
    },
  };

  console.log('[ONBOARDING_API_TEST] Test environment setup complete');
});

/**
 * Cleanup test database
 */
afterAll(async () => {
  console.log('[ONBOARDING_API_TEST] Cleaning up test environment');

  await executeTransaction(async (client) => {
    await client.query('DELETE FROM onboarding_tasks WHERE 1=1');
    await client.query('DELETE FROM onboarding_workflows WHERE 1=1');
    await client.query('DELETE FROM onboarding_templates WHERE 1=1');
    await client.query('DELETE FROM employees WHERE 1=1');
    await client.query('DELETE FROM users WHERE email LIKE \'%@test.com\'');
  });

  // Clean up uploaded test files
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file.startsWith('test-')) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
  }

  await getPool().end();

  console.log('[ONBOARDING_API_TEST] Test environment cleanup complete');
});

/**
 * Clean up test data between tests
 */
beforeEach(async () => {
  await executeTransaction(async (client) => {
    await client.query('DELETE FROM onboarding_tasks WHERE 1=1');
    await client.query('DELETE FROM onboarding_workflows WHERE 1=1');
    await client.query('DELETE FROM onboarding_templates WHERE 1=1');
  });
});

describe('POST /api/onboarding/templates', () => {
  it('should create template successfully as HR Admin', async () => {
    const templateData = {
      name: 'New Employee Onboarding',
      description: 'Standard onboarding process for new employees',
      tasks: [
        {
          title: 'Complete HR paperwork',
          description: 'Fill out all required HR forms',
          daysUntilDue: 1,
          order: 1,
          requiresDocument: true,
        },
        {
          title: 'Setup workstation',
          description: 'Configure computer and access',
          daysUntilDue: 2,
          order: 2,
          requiresDocument: false,
        },
      ],
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send(templateData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      template: {
        id: expect.any(String),
        name: templateData.name,
        description: templateData.description,
        isActive: true,
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete HR paperwork',
            order: 1,
          }),
          expect.objectContaining({
            title: 'Setup workstation',
            order: 2,
          }),
        ]),
      },
    });

    testTemplateId = response.body.template.id;

    // Verify database state
    const dbTemplate = await executeQuery(
      'SELECT * FROM onboarding_templates WHERE id = $1',
      [testTemplateId]
    );
    expect(dbTemplate.rows).toHaveLength(1);
    expect(dbTemplate.rows[0]?.name).toBe(templateData.name);

    const dbTasks = await executeQuery(
      'SELECT * FROM onboarding_template_tasks WHERE template_id = $1 ORDER BY task_order',
      [testTemplateId]
    );
    expect(dbTasks.rows).toHaveLength(2);
  });

  it('should return 403 when Employee tries to create template', async () => {
    const templateData = {
      name: 'Unauthorized Template',
      description: 'Should not be created',
      tasks: [],
    };

    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .send(templateData)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send({
        name: '',
        tasks: [],
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('should validate task structure', async () => {
    const response = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send({
        name: 'Test Template',
        description: 'Test',
        tasks: [
          {
            title: 'Task without required fields',
          },
        ],
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('GET /api/onboarding/templates', () => {
  beforeEach(async () => {
    // Create test templates
    const timestamp = new Date();
    testTemplateId = crypto.randomUUID();

    await executeTransaction(async (client) => {
      await client.query(
        `INSERT INTO onboarding_templates (id, name, description, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testTemplateId, 'Test Template', 'Test Description', true, testUsers.hrAdmin.id, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_template_tasks (id, template_id, title, description, days_until_due, task_order, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [crypto.randomUUID(), testTemplateId, 'Test Task', 'Test Task Description', 1, 1, false, timestamp, timestamp]
      );
    });
  });

  it('should return templates with pagination as HR Admin', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      templates: expect.arrayContaining([
        expect.objectContaining({
          id: testTemplateId,
          name: 'Test Template',
          tasks: expect.any(Array),
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

  it('should return templates as Manager', async () => {
    const response = await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.manager.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.templates).toBeInstanceOf(Array);
  });

  it('should return 403 as Employee', async () => {
    await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .expect(403);
  });
});

describe('POST /api/onboarding/workflows', () => {
  beforeEach(async () => {
    // Create test template
    const timestamp = new Date();
    testTemplateId = crypto.randomUUID();

    await executeTransaction(async (client) => {
      await client.query(
        `INSERT INTO onboarding_templates (id, name, description, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testTemplateId, 'Test Template', 'Test Description', true, testUsers.hrAdmin.id, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_template_tasks (id, template_id, title, description, days_until_due, task_order, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [crypto.randomUUID(), testTemplateId, 'Test Task', 'Test Task Description', 3, 1, true, timestamp, timestamp]
      );
    });
  });

  it('should assign workflow successfully as HR Admin', async () => {
    const workflowData = {
      templateId: testTemplateId,
      employeeId: testUsers.employee.id,
      startDate: new Date().toISOString(),
    };

    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send(workflowData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.any(String),
      workflow: {
        id: expect.any(String),
        templateId: testTemplateId,
        employeeId: testUsers.employee.id,
        status: 'IN_PROGRESS',
        tasks: expect.arrayContaining([
          expect.objectContaining({
            title: 'Test Task',
            status: 'PENDING',
            dueDate: expect.any(String),
          }),
        ]),
      },
    });

    testWorkflowId = response.body.workflow.id;

    // Verify database state
    const dbWorkflow = await executeQuery(
      'SELECT * FROM onboarding_workflows WHERE id = $1',
      [testWorkflowId]
    );
    expect(dbWorkflow.rows).toHaveLength(1);

    const dbTasks = await executeQuery(
      'SELECT * FROM onboarding_tasks WHERE workflow_id = $1',
      [testWorkflowId]
    );
    expect(dbTasks.rows).toHaveLength(1);
    expect(dbTasks.rows[0]?.status).toBe('PENDING');
  });

  it('should return 404 when employee not found', async () => {
    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send({
        templateId: testTemplateId,
        employeeId: 'non-existent-id',
      })
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'EMPLOYEE_NOT_FOUND',
    });
  });

  it('should return 404 when template not found', async () => {
    const response = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .send({
        templateId: 'non-existent-id',
        employeeId: testUsers.employee.id,
      })
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'TEMPLATE_NOT_FOUND',
    });
  });

  it('should return 403 as Employee', async () => {
    await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .send({
        templateId: testTemplateId,
        employeeId: testUsers.employee.id,
      })
      .expect(403);
  });
});

describe('GET /api/onboarding/my-tasks', () => {
  beforeEach(async () => {
    // Create workflow and tasks for employee
    const timestamp = new Date();
    testWorkflowId = crypto.randomUUID();
    testTaskId = crypto.randomUUID();

    await executeTransaction(async (client) => {
      await client.query(
        `INSERT INTO onboarding_workflows (id, employee_id, template_id, status, start_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testWorkflowId, testUsers.employee.id, crypto.randomUUID(), 'IN_PROGRESS', timestamp, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_tasks (id, workflow_id, title, description, status, due_date, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [testTaskId, testWorkflowId, 'My Task', 'Task Description', 'PENDING', new Date(Date.now() + 86400000), true, timestamp, timestamp]
      );
    });
  });

  it('should return employee tasks successfully', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: testTaskId,
          title: 'My Task',
          status: 'PENDING',
        }),
      ]),
      pagination: expect.any(Object),
    });
  });

  it('should return empty list for employee with no tasks', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${testUsers.employee2.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      tasks: [],
      pagination: {
        total: 0,
      },
    });
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
  });
});

describe('PATCH /api/onboarding/tasks/:id', () => {
  beforeEach(async () => {
    // Create workflow and task
    const timestamp = new Date();
    testWorkflowId = crypto.randomUUID();
    testTaskId = crypto.randomUUID();

    await executeTransaction(async (client) => {
      await client.query(
        `INSERT INTO onboarding_workflows (id, employee_id, template_id, status, start_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [testWorkflowId, testUsers.employee.id, crypto.randomUUID(), 'IN_PROGRESS', timestamp, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_tasks (id, workflow_id, title, description, status, due_date, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [testTaskId, testWorkflowId, 'Task to Complete', 'Description', 'PENDING', new Date(Date.now() + 86400000), true, timestamp, timestamp]
      );
    });
  });

  it('should complete task with file upload successfully', async () => {
    // Create test file
    const testFilePath = path.join(__dirname, 'test-document.pdf');
    fs.writeFileSync(testFilePath, 'Test PDF content');

    try {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${testUsers.employee.token}`)
        .attach('document', testFilePath)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        task: {
          id: testTaskId,
          status: 'COMPLETED',
          documentUrl: expect.stringContaining('/uploads/'),
          completedAt: expect.any(String),
        },
      });

      // Verify database state
      const dbTask = await executeQuery(
        'SELECT * FROM onboarding_tasks WHERE id = $1',
        [testTaskId]
      );
      expect(dbTask.rows[0]?.status).toBe('COMPLETED');
      expect(dbTask.rows[0]?.document_url).toBeTruthy();
      expect(dbTask.rows[0]?.completed_at).toBeTruthy();
    } finally {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should reject invalid file type', async () => {
    const testFilePath = path.join(__dirname, 'test-invalid.exe');
    fs.writeFileSync(testFilePath, 'Invalid file');

    try {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${testUsers.employee.token}`)
        .attach('document', testFilePath)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_FILE_TYPE',
      });
    } finally {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should reject file exceeding size limit', async () => {
    const testFilePath = path.join(__dirname, 'test-large.pdf');
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    fs.writeFileSync(testFilePath, largeBuffer);

    try {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${testUsers.employee.token}`)
        .attach('document', testFilePath)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'FILE_TOO_LARGE',
      });
    } finally {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should return 403 when accessing other employee task', async () => {
    await request(app)
      .patch(`/api/onboarding/tasks/${testTaskId}`)
      .set('Authorization', `Bearer ${testUsers.employee2.token}`)
      .expect(403);
  });

  it('should return 404 for non-existent task', async () => {
    await request(app)
      .patch('/api/onboarding/tasks/non-existent-id')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .expect(404);
  });

  it('should allow HR Admin to complete any task', async () => {
    const response = await request(app)
      .patch(`/api/onboarding/tasks/${testTaskId}`)
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

describe('GET /api/onboarding/team-progress', () => {
  beforeEach(async () => {
    // Create workflows for team members
    const timestamp = new Date();
    const workflow1Id = crypto.randomUUID();
    const workflow2Id = crypto.randomUUID();

    await executeTransaction(async (client) => {
      // Workflow for employee 1
      await client.query(
        `INSERT INTO onboarding_workflows (id, employee_id, template_id, status, start_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [workflow1Id, testUsers.employee.id, crypto.randomUUID(), 'IN_PROGRESS', timestamp, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_tasks (id, workflow_id, title, description, status, due_date, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9), ($10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          crypto.randomUUID(), workflow1Id, 'Task 1', 'Description', 'COMPLETED', new Date(), false, timestamp, timestamp,
          crypto.randomUUID(), workflow1Id, 'Task 2', 'Description', 'PENDING', new Date(Date.now() + 86400000), false, timestamp, timestamp,
        ]
      );

      // Workflow for employee 2
      await client.query(
        `INSERT INTO onboarding_workflows (id, employee_id, template_id, status, start_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [workflow2Id, testUsers.employee2.id, crypto.randomUUID(), 'IN_PROGRESS', timestamp, timestamp, timestamp]
      );

      await client.query(
        `INSERT INTO onboarding_tasks (id, workflow_id, title, description, status, due_date, requires_document, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [crypto.randomUUID(), workflow2Id, 'Task 1', 'Description', 'PENDING', new Date(Date.now() + 86400000), false, timestamp, timestamp]
      );
    });
  });

  it('should return team progress as Manager', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${testUsers.manager.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      progress: expect.arrayContaining([
        expect.objectContaining({
          employeeId: testUsers.employee.id,
          totalTasks: 2,
          completedTasks: 1,
          progressPercentage: 50,
        }),
        expect.objectContaining({
          employeeId: testUsers.employee2.id,
          totalTasks: 1,
          completedTasks: 0,
          progressPercentage: 0,
        }),
      ]),
      pagination: expect.any(Object),
    });
  });

  it('should return team progress as HR Admin', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${testUsers.hrAdmin.token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.progress).toBeInstanceOf(Array);
  });

  it('should return 403 as Employee', async () => {
    await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${testUsers.employee.token}`)
      .expect(403);
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${testUsers.manager.token}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
  });
});

describe('Authentication and Authorization', () => {
  it('should return 401 without token', async () => {
    await request(app)
      .get('/api/onboarding/templates')
      .expect(401);
  });

  it('should return 401 with invalid token', async () => {
    await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should return 401 with malformed authorization header', async () => {
    await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', 'InvalidScheme token')
      .expect(401);
  });
});