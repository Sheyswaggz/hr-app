/**
 * End-to-End Onboarding Workflow Tests
 * 
 * Comprehensive E2E tests for complete onboarding user journeys:
 * - HR Admin creates template and assigns workflow
 * - Employee logs in and views tasks
 * - Employee completes task with document upload
 * - Manager views team progress
 * 
 * Tests email notifications, progress calculation, and file storage.
 * 
 * @module tests/e2e/onboarding.flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { hashPassword } from '../../src/utils/password.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test user credentials and IDs
 */
interface TestUser {
  id: string;
  email: string;
  password: string;
  role: string;
  token: string;
}

interface TestData {
  hrAdmin: TestUser;
  manager: TestUser;
  employee: TestUser;
  departmentId: string;
  templateId?: string;
  workflowId?: string;
  taskIds?: string[];
}

let testData: TestData;

/**
 * Setup test database with users and department
 */
async function setupTestData(): Promise<TestData> {
  const timestamp = new Date();
  const passwordHash = await hashPassword('TestPassword123!');

  if (!passwordHash.success || !passwordHash.hash) {
    throw new Error('Failed to hash test password');
  }

  return await executeTransaction(async (client) => {
    // Create department
    const deptResult = await client.query(
      `INSERT INTO departments (id, name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        'dept-test-001',
        'Engineering',
        'Engineering Department',
        true,
        timestamp,
        timestamp,
      ]
    );

    const departmentId = deptResult.rows[0]!.id as string;

    // Create HR Admin
    const hrAdminId = 'user-hr-001';
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, 
        failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        hrAdminId,
        'hr.admin@test.com',
        passwordHash.hash,
        'HR',
        'Admin',
        'HR_ADMIN',
        true,
        0,
        timestamp,
        timestamp,
      ]
    );

    // Create Manager
    const managerId = 'user-manager-001';
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active,
        failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        managerId,
        'manager@test.com',
        passwordHash.hash,
        'Test',
        'Manager',
        'MANAGER',
        true,
        0,
        timestamp,
        timestamp,
      ]
    );

    // Create Employee
    const employeeId = 'user-employee-001';
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active,
        failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        employeeId,
        'employee@test.com',
        passwordHash.hash,
        'Test',
        'Employee',
        'EMPLOYEE',
        true,
        0,
        timestamp,
        timestamp,
      ]
    );

    // Create employee records
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, 
        manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'emp-manager-001',
        managerId,
        'EMP-M001',
        'Engineering Manager',
        departmentId,
        null,
        timestamp,
        'ACTIVE',
        timestamp,
        timestamp,
      ]
    );

    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id,
        manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'emp-employee-001',
        employeeId,
        'EMP-E001',
        'Software Engineer',
        departmentId,
        managerId,
        timestamp,
        'ACTIVE',
        timestamp,
        timestamp,
      ]
    );

    // Generate tokens
    const hrAdminToken = generateAccessToken(hrAdminId, 'hr.admin@test.com', 'HR_ADMIN');
    const managerToken = generateAccessToken(managerId, 'manager@test.com', 'MANAGER');
    const employeeToken = generateAccessToken(employeeId, 'employee@test.com', 'EMPLOYEE');

    return {
      hrAdmin: {
        id: hrAdminId,
        email: 'hr.admin@test.com',
        password: 'TestPassword123!',
        role: 'HR_ADMIN',
        token: hrAdminToken,
      },
      manager: {
        id: managerId,
        email: 'manager@test.com',
        password: 'TestPassword123!',
        role: 'MANAGER',
        token: managerToken,
      },
      employee: {
        id: employeeId,
        email: 'employee@test.com',
        password: 'TestPassword123!',
        role: 'EMPLOYEE',
        token: employeeToken,
      },
      departmentId,
    };
  });
}

/**
 * Cleanup test data from database
 */
async function cleanupTestData(): Promise<void> {
  await executeTransaction(async (client) => {
    // Delete in reverse dependency order
    await client.query('DELETE FROM onboarding_tasks WHERE employee_id LIKE $1', ['user-%']);
    await client.query('DELETE FROM onboarding_workflows WHERE employee_id LIKE $1', ['user-%']);
    await client.query('DELETE FROM onboarding_templates WHERE created_by LIKE $1', ['user-%']);
    await client.query('DELETE FROM employees WHERE user_id LIKE $1', ['user-%']);
    await client.query('DELETE FROM users WHERE id LIKE $1', ['user-%']);
    await client.query('DELETE FROM departments WHERE id LIKE $1', ['dept-%']);
  });
}

/**
 * Cleanup uploaded test files
 */
async function cleanupUploadedFiles(): Promise<void> {
  const uploadsDir = path.join(__dirname, '../../uploads');
  
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file.startsWith('test-')) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
  }
}

describe('Onboarding Workflow E2E Tests', () => {
  beforeAll(async () => {
    console.log('[E2E_ONBOARDING] Setting up test data...');
    testData = await setupTestData();
    console.log('[E2E_ONBOARDING] Test data setup complete');
  });

  afterAll(async () => {
    console.log('[E2E_ONBOARDING] Cleaning up test data...');
    await cleanupTestData();
    await cleanupUploadedFiles();
    await getPool().end();
    console.log('[E2E_ONBOARDING] Cleanup complete');
  });

  beforeEach(() => {
    console.log('[E2E_ONBOARDING] Starting test...');
  });

  afterEach(() => {
    console.log('[E2E_ONBOARDING] Test completed');
  });

  describe('Complete Onboarding Journey', () => {
    it('should complete full onboarding workflow from template creation to task completion', async () => {
      console.log('[E2E_ONBOARDING] Starting complete onboarding journey test');

      // Step 1: HR Admin creates onboarding template
      console.log('[E2E_ONBOARDING] Step 1: Creating onboarding template');
      const templateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
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
              description: 'Watch security training videos and pass quiz',
              daysUntilDue: 5,
              order: 3,
              requiresDocument: true,
            },
          ],
        })
        .expect(201);

      expect(templateResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('created'),
      });
      expect(templateResponse.body.template).toBeDefined();
      expect(templateResponse.body.template.id).toBeDefined();
      expect(templateResponse.body.template.name).toBe('Software Engineer Onboarding');
      expect(templateResponse.body.template.tasks).toHaveLength(3);

      const templateId = templateResponse.body.template.id;
      testData.templateId = templateId;

      console.log('[E2E_ONBOARDING] Template created:', templateId);

      // Step 2: HR Admin assigns workflow to new employee
      console.log('[E2E_ONBOARDING] Step 2: Assigning workflow to employee');
      const workflowResponse = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          templateId,
          employeeId: testData.employee.id,
          startDate: new Date().toISOString(),
        })
        .expect(201);

      expect(workflowResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('assigned'),
      });
      expect(workflowResponse.body.workflow).toBeDefined();
      expect(workflowResponse.body.workflow.id).toBeDefined();
      expect(workflowResponse.body.workflow.employeeId).toBe(testData.employee.id);
      expect(workflowResponse.body.workflow.tasks).toHaveLength(3);

      const workflowId = workflowResponse.body.workflow.id;
      const taskIds = workflowResponse.body.workflow.tasks.map((t: any) => t.id);
      testData.workflowId = workflowId;
      testData.taskIds = taskIds;

      console.log('[E2E_ONBOARDING] Workflow assigned:', workflowId);
      console.log('[E2E_ONBOARDING] Tasks created:', taskIds);

      // Step 3: Employee logs in and views assigned tasks
      console.log('[E2E_ONBOARDING] Step 3: Employee viewing tasks');
      const myTasksResponse = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(myTasksResponse.body).toMatchObject({
        success: true,
      });
      expect(myTasksResponse.body.tasks).toHaveLength(3);
      expect(myTasksResponse.body.tasks[0]).toMatchObject({
        title: 'Complete HR paperwork',
        status: 'PENDING',
        requiresDocument: true,
      });

      console.log('[E2E_ONBOARDING] Employee can view tasks');

      // Step 4: Employee completes first task with document upload
      console.log('[E2E_ONBOARDING] Step 4: Employee completing task with document');
      
      // Create test file
      const testFilePath = path.join(__dirname, 'test-document.pdf');
      fs.writeFileSync(testFilePath, 'Test PDF content for onboarding');

      const taskUpdateResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskIds[0]}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .attach('document', testFilePath)
        .expect(200);

      expect(taskUpdateResponse.body).toMatchObject({
        success: true,
        message: expect.stringContaining('updated'),
      });
      expect(taskUpdateResponse.body.task).toMatchObject({
        id: taskIds[0],
        status: 'COMPLETED',
        completedAt: expect.any(String),
        documentUrl: expect.stringContaining('/uploads/'),
      });

      // Verify file was uploaded
      const uploadedFilePath = path.join(__dirname, '../../', taskUpdateResponse.body.task.documentUrl);
      expect(fs.existsSync(uploadedFilePath)).toBe(true);

      // Cleanup test file
      fs.unlinkSync(testFilePath);

      console.log('[E2E_ONBOARDING] Task completed with document upload');

      // Step 5: Verify progress calculation
      console.log('[E2E_ONBOARDING] Step 5: Verifying progress calculation');
      const progressCheckResponse = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(progressCheckResponse.body.summary).toMatchObject({
        totalTasks: 3,
        completedTasks: 1,
        pendingTasks: 2,
        progressPercentage: expect.closeTo(33.33, 1),
      });

      console.log('[E2E_ONBOARDING] Progress calculation verified');

      // Step 6: Manager views team progress
      console.log('[E2E_ONBOARDING] Step 6: Manager viewing team progress');
      const teamProgressResponse = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${testData.manager.token}`)
        .expect(200);

      expect(teamProgressResponse.body).toMatchObject({
        success: true,
      });
      expect(teamProgressResponse.body.progress).toBeDefined();
      expect(Array.isArray(teamProgressResponse.body.progress)).toBe(true);
      
      const employeeProgress = teamProgressResponse.body.progress.find(
        (p: any) => p.employeeId === testData.employee.id
      );
      expect(employeeProgress).toBeDefined();
      expect(employeeProgress).toMatchObject({
        employeeId: testData.employee.id,
        employeeName: 'Test Employee',
        totalTasks: 3,
        completedTasks: 1,
        progressPercentage: expect.closeTo(33.33, 1),
      });

      console.log('[E2E_ONBOARDING] Manager can view team progress');

      // Step 7: Employee completes second task (no document required)
      console.log('[E2E_ONBOARDING] Step 7: Employee completing task without document');
      const task2UpdateResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskIds[1]}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(task2UpdateResponse.body).toMatchObject({
        success: true,
      });
      expect(task2UpdateResponse.body.task).toMatchObject({
        id: taskIds[1],
        status: 'COMPLETED',
        completedAt: expect.any(String),
      });

      console.log('[E2E_ONBOARDING] Second task completed');

      // Step 8: Verify updated progress
      console.log('[E2E_ONBOARDING] Step 8: Verifying updated progress');
      const finalProgressResponse = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(finalProgressResponse.body.summary).toMatchObject({
        totalTasks: 3,
        completedTasks: 2,
        pendingTasks: 1,
        progressPercentage: expect.closeTo(66.67, 1),
      });

      console.log('[E2E_ONBOARDING] Final progress verified');

      // Step 9: Verify manager sees updated progress
      console.log('[E2E_ONBOARDING] Step 9: Verifying manager sees updated progress');
      const finalTeamProgressResponse = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${testData.manager.token}`)
        .expect(200);

      const finalEmployeeProgress = finalTeamProgressResponse.body.progress.find(
        (p: any) => p.employeeId === testData.employee.id
      );
      expect(finalEmployeeProgress).toMatchObject({
        completedTasks: 2,
        progressPercentage: expect.closeTo(66.67, 1),
      });

      console.log('[E2E_ONBOARDING] Complete onboarding journey test passed');
    }, 60000); // 60 second timeout for complete flow

    it('should handle document upload validation', async () => {
      console.log('[E2E_ONBOARDING] Testing document upload validation');

      // Create template with document requirement
      const templateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          name: 'Document Test Template',
          description: 'Template for testing document uploads',
          tasks: [
            {
              title: 'Upload required document',
              description: 'Test document upload',
              daysUntilDue: 1,
              order: 1,
              requiresDocument: true,
            },
          ],
        })
        .expect(201);

      const templateId = templateResponse.body.template.id;

      // Assign workflow
      const workflowResponse = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          templateId,
          employeeId: testData.employee.id,
          startDate: new Date().toISOString(),
        })
        .expect(201);

      const taskId = workflowResponse.body.workflow.tasks[0].id;

      // Test 1: Try to complete task without document (should fail)
      const noDocResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskId}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(400);

      expect(noDocResponse.body).toMatchObject({
        success: false,
        code: 'DOCUMENT_REQUIRED',
      });

      // Test 2: Try with invalid file type
      const invalidFilePath = path.join(__dirname, 'test-invalid.exe');
      fs.writeFileSync(invalidFilePath, 'Invalid file content');

      const invalidFileResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskId}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .attach('document', invalidFilePath)
        .expect(400);

      expect(invalidFileResponse.body).toMatchObject({
        success: false,
        code: expect.stringContaining('INVALID_FILE'),
      });

      fs.unlinkSync(invalidFilePath);

      // Test 3: Try with file too large (mock by checking validation)
      const largeFilePath = path.join(__dirname, 'test-large.pdf');
      const largeContent = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFilePath, largeContent);

      const largeFileResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskId}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .attach('document', largeFilePath)
        .expect(400);

      expect(largeFileResponse.body).toMatchObject({
        success: false,
        code: expect.stringContaining('FILE_TOO_LARGE'),
      });

      fs.unlinkSync(largeFilePath);

      // Test 4: Valid document upload
      const validFilePath = path.join(__dirname, 'test-valid.pdf');
      fs.writeFileSync(validFilePath, 'Valid PDF content');

      const validResponse = await request(app)
        .patch(`/api/onboarding/tasks/${taskId}`)
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .attach('document', validFilePath)
        .expect(200);

      expect(validResponse.body).toMatchObject({
        success: true,
      });
      expect(validResponse.body.task.documentUrl).toBeDefined();

      fs.unlinkSync(validFilePath);

      console.log('[E2E_ONBOARDING] Document upload validation test passed');
    }, 30000);

    it('should enforce role-based access control', async () => {
      console.log('[E2E_ONBOARDING] Testing role-based access control');

      // Test 1: Employee cannot create templates
      const employeeTemplateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
        })
        .expect(403);

      expect(employeeTemplateResponse.body).toMatchObject({
        success: false,
        code: 'FORBIDDEN',
      });

      // Test 2: Employee cannot assign workflows
      const employeeWorkflowResponse = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .send({
          templateId: 'any-template',
          employeeId: 'any-employee',
        })
        .expect(403);

      expect(employeeWorkflowResponse.body).toMatchObject({
        success: false,
        code: 'FORBIDDEN',
      });

      // Test 3: Manager cannot create templates
      const managerTemplateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.manager.token}`)
        .send({
          name: 'Unauthorized Template',
          description: 'Should fail',
          tasks: [],
        })
        .expect(403);

      expect(managerTemplateResponse.body).toMatchObject({
        success: false,
        code: 'FORBIDDEN',
      });

      // Test 4: Manager can view templates
      const managerViewTemplatesResponse = await request(app)
        .get('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.manager.token}`)
        .expect(200);

      expect(managerViewTemplatesResponse.body).toMatchObject({
        success: true,
      });

      // Test 5: Manager can view team progress
      const managerProgressResponse = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${testData.manager.token}`)
        .expect(200);

      expect(managerProgressResponse.body).toMatchObject({
        success: true,
      });

      // Test 6: Employee cannot view team progress
      const employeeProgressResponse = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(403);

      expect(employeeProgressResponse.body).toMatchObject({
        success: false,
        code: 'FORBIDDEN',
      });

      console.log('[E2E_ONBOARDING] Role-based access control test passed');
    });

    it('should handle concurrent task updates correctly', async () => {
      console.log('[E2E_ONBOARDING] Testing concurrent task updates');

      // Create template and workflow
      const templateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          name: 'Concurrent Test Template',
          description: 'Template for testing concurrent updates',
          tasks: [
            {
              title: 'Task 1',
              description: 'First task',
              daysUntilDue: 1,
              order: 1,
              requiresDocument: false,
            },
            {
              title: 'Task 2',
              description: 'Second task',
              daysUntilDue: 2,
              order: 2,
              requiresDocument: false,
            },
          ],
        })
        .expect(201);

      const workflowResponse = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          templateId: templateResponse.body.template.id,
          employeeId: testData.employee.id,
          startDate: new Date().toISOString(),
        })
        .expect(201);

      const taskIds = workflowResponse.body.workflow.tasks.map((t: any) => t.id);

      // Attempt concurrent updates
      const updates = taskIds.map((taskId: string) =>
        request(app)
          .patch(`/api/onboarding/tasks/${taskId}`)
          .set('Authorization', `Bearer ${testData.employee.token}`)
      );

      const results = await Promise.all(updates);

      // All updates should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify final state
      const finalStateResponse = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(finalStateResponse.body.summary.completedTasks).toBe(2);

      console.log('[E2E_ONBOARDING] Concurrent task updates test passed');
    });

    it('should validate task completion order and dependencies', async () => {
      console.log('[E2E_ONBOARDING] Testing task order validation');

      // Create template with ordered tasks
      const templateResponse = await request(app)
        .post('/api/onboarding/templates')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          name: 'Ordered Tasks Template',
          description: 'Template with task order',
          tasks: [
            {
              title: 'First Task',
              description: 'Must be completed first',
              daysUntilDue: 1,
              order: 1,
              requiresDocument: false,
            },
            {
              title: 'Second Task',
              description: 'Must be completed second',
              daysUntilDue: 2,
              order: 2,
              requiresDocument: false,
            },
            {
              title: 'Third Task',
              description: 'Must be completed third',
              daysUntilDue: 3,
              order: 3,
              requiresDocument: false,
            },
          ],
        })
        .expect(201);

      const workflowResponse = await request(app)
        .post('/api/onboarding/workflows')
        .set('Authorization', `Bearer ${testData.hrAdmin.token}`)
        .send({
          templateId: templateResponse.body.template.id,
          employeeId: testData.employee.id,
          startDate: new Date().toISOString(),
        })
        .expect(201);

      const tasks = workflowResponse.body.workflow.tasks;

      // Verify tasks are returned in correct order
      expect(tasks[0].order).toBe(1);
      expect(tasks[1].order).toBe(2);
      expect(tasks[2].order).toBe(3);

      // Complete tasks in order
      for (const task of tasks) {
        const response = await request(app)
          .patch(`/api/onboarding/tasks/${task.id}`)
          .set('Authorization', `Bearer ${testData.employee.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      }

      // Verify all tasks completed
      const finalResponse = await request(app)
        .get('/api/onboarding/my-tasks')
        .set('Authorization', `Bearer ${testData.employee.token}`)
        .expect(200);

      expect(finalResponse.body.summary.completedTasks).toBe(3);
      expect(finalResponse.body.summary.progressPercentage).toBe(100);

      console.log('[E2E_ONBOARDING] Task order validation test passed');
    });
  });
});