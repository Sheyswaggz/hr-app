/**
 * Onboarding Authorization Integration Tests
 * 
 * Comprehensive test suite verifying role-based access control (RBAC) for all
 * onboarding workflow endpoints. Tests ensure proper authorization enforcement
 * across different user roles (HR_ADMIN, MANAGER, EMPLOYEE) and validates that
 * users can only access resources they are authorized to view or modify.
 * 
 * This test suite validates:
 * - HR Admin can create templates and assign workflows
 * - Manager can view templates and team progress but not create templates
 * - Employee can view own tasks and update own tasks only
 * - Employee cannot view other employee's tasks
 * - Manager can only view own team members' progress
 * - All unauthorized access attempts return 403 Forbidden
 * 
 * @module tests/integration/onboarding.authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { type Express } from 'express';

import { createApp } from '../../src/app.js';
import { initializePool, shutdown, executeQuery, executeTransaction } from '../../src/db/index.js';
import { hashPassword } from '../../src/utils/password.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { type UserRole } from '../../src/types/index.js';

/**
 * Test user data structure
 */
interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly token: string;
  readonly employeeId?: string;
  readonly managerId?: string;
}

/**
 * Test template data structure
 */
interface TestTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/**
 * Test workflow data structure
 */
interface TestWorkflow {
  readonly id: string;
  readonly employeeId: string;
  readonly templateId: string;
}

/**
 * Test task data structure
 */
interface TestTask {
  readonly id: string;
  readonly workflowId: string;
  readonly employeeId: string;
  readonly title: string;
}

// Test fixtures
let app: Express;
let hrAdminUser: TestUser;
let managerUser: TestUser;
let employeeUser1: TestUser;
let employeeUser2: TestUser;
let managerUser2: TestUser;
let testTemplate: TestTemplate;
let testWorkflow: TestWorkflow;
let testTask: TestTask;

/**
 * Create a test user with authentication token
 * 
 * @param {object} userData - User data
 * @returns {Promise<TestUser>} Created test user with token
 */
async function createTestUser(userData: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  managerId?: string;
}): Promise<TestUser> {
  const userId = `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const passwordHash = (await hashPassword('TestPassword123!')).hash!;
  const timestamp = new Date();

  await executeQuery(
    `INSERT INTO users (
      id, email, password_hash, first_name, last_name, role,
      is_active, failed_login_attempts, locked_until,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      userId,
      userData.email,
      passwordHash,
      userData.firstName,
      userData.lastName,
      userData.role,
      true,
      0,
      null,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_user' }
  );

  // Create employee record if not HR_ADMIN
  let employeeId: string | undefined;
  if (userData.role !== 'HR_ADMIN') {
    employeeId = `test-employee-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await executeQuery(
      `INSERT INTO employees (
        id, user_id, employee_number, job_title, department_id,
        manager_id, hire_date, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        employeeId,
        userId,
        `EMP${Date.now()}`,
        userData.role === 'MANAGER' ? 'Manager' : 'Employee',
        'test-dept-1',
        userData.managerId || null,
        timestamp,
        'ACTIVE',
        timestamp,
        timestamp,
      ],
      { operation: 'create_test_employee' }
    );
  }

  const token = generateAccessToken(userId, userData.email, userData.role);

  return {
    id: userId,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role,
    token,
    employeeId,
    managerId: userData.managerId,
  };
}

/**
 * Create a test onboarding template
 * 
 * @param {string} createdBy - User ID who created the template
 * @returns {Promise<TestTemplate>} Created test template
 */
async function createTestTemplate(createdBy: string): Promise<TestTemplate> {
  const templateId = `test-template-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date();

  await executeQuery(
    `INSERT INTO onboarding_templates (
      id, name, description, created_by, is_active,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      templateId,
      'Test Onboarding Template',
      'Template for testing authorization',
      createdBy,
      true,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_template' }
  );

  return {
    id: templateId,
    name: 'Test Onboarding Template',
    description: 'Template for testing authorization',
  };
}

/**
 * Create a test onboarding workflow
 * 
 * @param {string} employeeId - Employee ID
 * @param {string} templateId - Template ID
 * @param {string} assignedBy - User ID who assigned the workflow
 * @returns {Promise<TestWorkflow>} Created test workflow
 */
async function createTestWorkflow(
  employeeId: string,
  templateId: string,
  assignedBy: string
): Promise<TestWorkflow> {
  const workflowId = `test-workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date();

  await executeQuery(
    `INSERT INTO onboarding_workflows (
      id, employee_id, template_id, assigned_by, status,
      start_date, target_completion_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      workflowId,
      employeeId,
      templateId,
      assignedBy,
      'IN_PROGRESS',
      timestamp,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_workflow' }
  );

  return {
    id: workflowId,
    employeeId,
    templateId,
  };
}

/**
 * Create a test onboarding task
 * 
 * @param {string} workflowId - Workflow ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<TestTask>} Created test task
 */
async function createTestTask(workflowId: string, employeeId: string): Promise<TestTask> {
  const taskId = `test-task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date();

  await executeQuery(
    `INSERT INTO onboarding_tasks (
      id, workflow_id, title, description, task_order,
      due_date, status, requires_document, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      taskId,
      workflowId,
      'Test Task',
      'Task for testing authorization',
      1,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      'PENDING',
      false,
      timestamp,
      timestamp,
    ],
    { operation: 'create_test_task' }
  );

  return {
    id: taskId,
    workflowId,
    employeeId,
    title: 'Test Task',
  };
}

/**
 * Clean up test data
 */
async function cleanupTestData(): Promise<void> {
  await executeTransaction(async (client) => {
    await client.query('DELETE FROM onboarding_tasks WHERE id LIKE $1', ['test-task-%']);
    await client.query('DELETE FROM onboarding_workflows WHERE id LIKE $1', ['test-workflow-%']);
    await client.query('DELETE FROM onboarding_templates WHERE id LIKE $1', ['test-template-%']);
    await client.query('DELETE FROM employees WHERE id LIKE $1', ['test-employee-%']);
    await client.query('DELETE FROM users WHERE id LIKE $1', ['test-user-%']);
  }, { operation: 'cleanup_test_data' });
}

describe('Onboarding Authorization Tests', () => {
  beforeAll(async () => {
    console.log('[TEST] Initializing onboarding authorization tests...');

    // Initialize database connection
    initializePool();

    // Create Express app
    app = createApp();

    // Create test users
    hrAdminUser = await createTestUser({
      email: 'hradmin@test.com',
      firstName: 'HR',
      lastName: 'Admin',
      role: 'HR_ADMIN',
    });

    managerUser = await createTestUser({
      email: 'manager@test.com',
      firstName: 'Test',
      lastName: 'Manager',
      role: 'MANAGER',
    });

    managerUser2 = await createTestUser({
      email: 'manager2@test.com',
      firstName: 'Test',
      lastName: 'Manager2',
      role: 'MANAGER',
    });

    employeeUser1 = await createTestUser({
      email: 'employee1@test.com',
      firstName: 'Test',
      lastName: 'Employee1',
      role: 'EMPLOYEE',
      managerId: managerUser.employeeId,
    });

    employeeUser2 = await createTestUser({
      email: 'employee2@test.com',
      firstName: 'Test',
      lastName: 'Employee2',
      role: 'EMPLOYEE',
      managerId: managerUser2.employeeId,
    });

    // Create test template
    testTemplate = await createTestTemplate(hrAdminUser.id);

    // Create test workflow for employee1
    testWorkflow = await createTestWorkflow(
      employeeUser1.employeeId!,
      testTemplate.id,
      hrAdminUser.id
    );

    // Create test task for employee1
    testTask = await createTestTask(testWorkflow.id, employeeUser1.employeeId!);

    console.log('[TEST] Test setup completed successfully');
  });

  afterAll(async () => {
    console.log('[TEST] Cleaning up test data...');
    await cleanupTestData();
    await shutdown({ timeout: 5000 });
    console.log('[TEST] Cleanup completed');
  });

  beforeEach(() => {
    console.log('[TEST] Starting new test case...');
  });

  describe('Template Management Authorization', () => {
    it('should allow HR_ADMIN to create templates', async () => {
      const response = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${hrAdminUser.token}`)
        .send({
          name: 'New Template',
          description: 'Test template creation',
          tasks: [
            {
              title: 'Task 1',
              description: 'First task',
              daysUntilDue: 7,
              order: 1,
              requiresDocument: false,
            },
          ],
          estimatedDays: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('New Template');
    });

    it('should deny MANAGER from creating templates', async () => {
      const response = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
          estimatedDays: 30,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should deny EMPLOYEE from creating templates', async () => {
      const response = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${employeeUser1.token}`)
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
          estimatedDays: 30,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow HR_ADMIN to view templates', async () => {
      const response = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', `Bearer ${hrAdminUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow MANAGER to view templates', async () => {
      const response = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', `Bearer ${managerUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should deny EMPLOYEE from viewing templates', async () => {
      const response = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', `Bearer ${employeeUser1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Workflow Assignment Authorization', () => {
    it('should allow HR_ADMIN to assign workflows', async () => {
      const response = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${hrAdminUser.token}`)
        .send({
          employeeId: employeeUser2.employeeId,
          templateId: testTemplate.id,
          targetCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.employeeId).toBe(employeeUser2.employeeId);
    });

    it('should deny MANAGER from assigning workflows', async () => {
      const response = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          employeeId: employeeUser1.employeeId,
          templateId: testTemplate.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should deny EMPLOYEE from assigning workflows', async () => {
      const response = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${employeeUser1.token}`)
        .send({
          employeeId: employeeUser1.employeeId,
          templateId: testTemplate.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Employee Task Access Authorization', () => {
    it('should allow EMPLOYEE to view own tasks', async () => {
      const response = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${employeeUser1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow HR_ADMIN to view employee tasks', async () => {
      const response = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${hrAdminUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow MANAGER to view employee tasks', async () => {
      const response = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${managerUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow EMPLOYEE to update own tasks', async () => {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${employeeUser1.token}`)
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should deny EMPLOYEE from updating other employee tasks', async () => {
      // Create a task for employee2
      const workflow2 = await createTestWorkflow(
        employeeUser2.employeeId!,
        testTemplate.id,
        hrAdminUser.id
      );
      const task2 = await createTestTask(workflow2.id, employeeUser2.employeeId!);

      const response = await request(app)
        .patch(`/api/onboarding/tasks/${task2.id}`)
        .set('Authorization', `Bearer ${employeeUser1.token}`)
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow HR_ADMIN to update any task', async () => {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${hrAdminUser.token}`)
        .send({
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow MANAGER to update team member tasks', async () => {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Team Progress Authorization', () => {
    it('should allow HR_ADMIN to view all team progress', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${hrAdminUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow MANAGER to view own team progress', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${managerUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should only show MANAGER their own team members', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${managerUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify that only employee1 (who reports to managerUser) is in the results
      const teamMembers = response.body.data;
      const hasEmployee1 = teamMembers.some(
        (member: any) => member.employeeId === employeeUser1.employeeId
      );
      const hasEmployee2 = teamMembers.some(
        (member: any) => member.employeeId === employeeUser2.employeeId
      );

      expect(hasEmployee1).toBe(true);
      expect(hasEmployee2).toBe(false);
    });

    it('should deny EMPLOYEE from viewing team progress', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${employeeUser1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Unauthenticated Access', () => {
    it('should deny access without token to create templates', async () => {
      const response = await request(app)
        .post('/api/onboarding/templates')
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
          estimatedDays: 30,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should deny access without token to view templates', async () => {
      const response = await request(app).get('/api/onboarding/templates');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should deny access without token to assign workflows', async () => {
      const response = await request(app)
        .post('/api/onboarding/workflows')
        .send({
          employeeId: employeeUser1.employeeId,
          templateId: testTemplate.id,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should deny access without token to view tasks', async () => {
      const response = await request(app).get('/api/onboarding/my-tasks');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should deny access without token to update tasks', async () => {
      const response = await request(app)
        .patch(`/api/onboarding/tasks/${testTask.id}`)
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should deny access without token to view team progress', async () => {
      const response = await request(app).get('/api/onboarding/team-progress');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Invalid Token Access', () => {
    it('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toMatch(/INVALID_TOKEN|MALFORMED_TOKEN/);
    });

    it('should deny access with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', 'InvalidScheme token123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('Cross-Team Access Prevention', () => {
    it('should prevent manager from viewing other team progress', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${managerUser2.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify that manager2 cannot see employee1 (who reports to managerUser)
      const teamMembers = response.body.data;
      const hasEmployee1 = teamMembers.some(
        (member: any) => member.employeeId === employeeUser1.employeeId
      );

      expect(hasEmployee1).toBe(false);
    });

    it('should prevent employee from accessing other employee tasks', async () => {
      // Create a task for employee2
      const workflow2 = await createTestWorkflow(
        employeeUser2.employeeId!,
        testTemplate.id,
        hrAdminUser.id
      );
      const task2 = await createTestTask(workflow2.id, employeeUser2.employeeId!);

      const response = await request(app)
        .patch(`/api/onboarding/tasks/${task2.id}`)
        .set('Authorization', `Bearer ${employeeUser1.token}`)
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should allow HR_ADMIN to access manager endpoints', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${hrAdminUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow HR_ADMIN to access employee endpoints', async () => {
      const response = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${hrAdminUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow MANAGER to access HR_ADMIN only endpoints', async () => {
      const response = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
          estimatedDays: 30,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should not allow EMPLOYEE to access manager endpoints', async () => {
      const response = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${employeeUser1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});

export default describe;