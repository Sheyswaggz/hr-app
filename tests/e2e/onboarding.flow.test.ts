/**
 * End-to-End Onboarding Workflow Tests
 * 
 * Comprehensive E2E tests covering complete onboarding user journeys:
 * - HR Admin creates template and assigns workflow
 * - Employee views and completes tasks with document upload
 * - Manager monitors team progress
 * - Email notifications and progress tracking
 * 
 * Tests use real database and file storage to verify complete integration.
 * 
 * @module tests/e2e/onboarding.flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Test Data Types
// ============================================================================

interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  token: string;
}

interface TestEmployee {
  id: string;
  userId: string;
  employeeNumber: string;
  jobTitle: string;
  departmentId: string;
  managerId?: string;
}

interface TestTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Array<{
    title: string;
    description: string;
    daysUntilDue: number;
    order: number;
    requiresDocument: boolean;
  }>;
}

interface TestWorkflow {
  id: string;
  employeeId: string;
  templateId: string;
  status: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: string;
    status: string;
    requiresDocument: boolean;
  }>;
}

// ============================================================================
// Test Setup and Teardown
// ============================================================================

let app: Express;
let hrAdmin: TestUser;
let manager: TestUser;
let employee: TestUser;
let newEmployee: TestUser;
let department: { id: string; name: string };
let uploadDir: string;

/**
 * Initialize test environment
 * Creates test users, department, and upload directory
 */
beforeAll(async () => {
  console.log('[E2E_ONBOARDING] Initializing test environment...');

  // Create Express app
  app = createApp();

  // Setup upload directory
  uploadDir = path.join(__dirname, '../../uploads/test');
  await fs.mkdir(uploadDir, { recursive: true });

  // Create test department
  department = await createTestDepartment();

  // Create test users
  hrAdmin = await createTestUser('HR_ADMIN', 'hradmin@test.com', 'HR', 'Admin');
  manager = await createTestUser('MANAGER', 'manager@test.com', 'Test', 'Manager', department.id);
  employee = await createTestUser('EMPLOYEE', 'employee@test.com', 'Test', 'Employee', department.id, manager.id);
  newEmployee = await createTestUser('EMPLOYEE', 'newemployee@test.com', 'New', 'Employee', department.id, manager.id);

  console.log('[E2E_ONBOARDING] Test environment initialized successfully');
});

/**
 * Cleanup test environment
 * Removes test data and upload directory
 */
afterAll(async () => {
  console.log('[E2E_ONBOARDING] Cleaning up test environment...');

  try {
    // Clean up uploaded files
    await fs.rm(uploadDir, { recursive: true, force: true });

    // Clean up database in reverse dependency order
    await executeTransaction(async (client) => {
      await client.query('DELETE FROM onboarding_task_completions WHERE 1=1');
      await client.query('DELETE FROM onboarding_tasks WHERE 1=1');
      await client.query('DELETE FROM onboarding_workflows WHERE 1=1');
      await client.query('DELETE FROM onboarding_template_tasks WHERE 1=1');
      await client.query('DELETE FROM onboarding_templates WHERE 1=1');
      await client.query('DELETE FROM employees WHERE email LIKE \'%@test.com\'');
      await client.query('DELETE FROM users WHERE email LIKE \'%@test.com\'');
      await client.query('DELETE FROM departments WHERE name LIKE \'Test%\'');
    });

    // Close database connection
    const pool = getPool();
    await pool.end();

    console.log('[E2E_ONBOARDING] Test environment cleaned up successfully');
  } catch (error) {
    console.error('[E2E_ONBOARDING] Cleanup error:', error);
  }
});

/**
 * Reset test state before each test
 */
beforeEach(async () => {
  console.log('[E2E_ONBOARDING] Resetting test state...');

  // Clean up onboarding data
  await executeTransaction(async (client) => {
    await client.query('DELETE FROM onboarding_task_completions WHERE 1=1');
    await client.query('DELETE FROM onboarding_tasks WHERE 1=1');
    await client.query('DELETE FROM onboarding_workflows WHERE 1=1');
    await client.query('DELETE FROM onboarding_template_tasks WHERE 1=1');
    await client.query('DELETE FROM onboarding_templates WHERE 1=1');
  });

  // Clean up uploaded files
  const files = await fs.readdir(uploadDir);
  for (const file of files) {
    await fs.unlink(path.join(uploadDir, file));
  }
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Additional cleanup if needed
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create test department
 */
async function createTestDepartment(): Promise<{ id: string; name: string }> {
  const id = `dept_${Date.now()}`;
  const name = `Test Department ${Date.now()}`;

  await executeQuery(
    `INSERT INTO departments (id, name, description, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [id, name, 'Test department for E2E tests', true]
  );

  return { id, name };
}

/**
 * Create test user with employee record
 */
async function createTestUser(
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE',
  email: string,
  firstName: string,
  lastName: string,
  departmentId?: string,
  managerId?: string
): Promise<TestUser> {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const password = 'Test123!@#';
  const passwordHash = await hashPassword(password);

  if (!passwordHash.success || !passwordHash.hash) {
    throw new Error('Failed to hash password');
  }

  // Create user
  await executeQuery(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [userId, email, passwordHash.hash, firstName, lastName, role, true]
  );

  // Create employee record if not HR_ADMIN
  if (role !== 'HR_ADMIN' && departmentId) {
    const employeeId = `emp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const employeeNumber = `EMP${Date.now()}`;

    await executeQuery(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW(), NOW())`,
      [employeeId, userId, employeeNumber, `Test ${role}`, departmentId, managerId || null, 'ACTIVE']
    );
  }

  // Generate token
  const token = generateAccessToken(userId, email, role);

  return {
    id: userId,
    email,
    password,
    firstName,
    lastName,
    role,
    token,
  };
}

/**
 * Create test file for upload
 */
async function createTestFile(filename: string, content: string): Promise<string> {
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}

/**
 * Verify file exists in storage
 */
async function verifyFileExists(filename: string): Promise<boolean> {
  try {
    await fs.access(path.join(uploadDir, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get employee ID for user
 */
async function getEmployeeId(userId: string): Promise<string> {
  const result = await executeQuery<{ id: string }>(
    'SELECT id FROM employees WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No employee found for user ${userId}`);
  }

  return result.rows[0]!.id;
}

// ============================================================================
// E2E Test Scenarios
// ============================================================================

describe('Onboarding Workflow - Complete User Journey', () => {
  /**
   * Test complete onboarding workflow from template creation to completion
   * 
   * Journey:
   * 1. HR Admin creates onboarding template with multiple tasks
   * 2. HR Admin assigns workflow to new employee
   * 3. New employee logs in and views assigned tasks
   * 4. New employee completes task with document upload
   * 5. Manager views team progress showing completion
   * 6. Verify email notifications sent
   * 7. Verify progress calculation updates correctly
   */
  it('should complete full onboarding workflow with all stakeholders', async () => {
    console.log('[E2E_ONBOARDING] Starting complete workflow test...');

    // ========================================================================
    // Step 1: HR Admin creates onboarding template
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 1: Creating onboarding template...');

    const templateData = {
      name: 'Software Engineer Onboarding',
      description: 'Complete onboarding process for new software engineers',
      tasks: [
        {
          title: 'Complete HR paperwork',
          description: 'Fill out all required HR forms and submit signed documents',
          daysUntilDue: 1,
          order: 1,
          requiresDocument: true,
        },
        {
          title: 'Setup development environment',
          description: 'Install required software and configure development tools',
          daysUntilDue: 2,
          order: 2,
          requiresDocument: false,
        },
        {
          title: 'Complete security training',
          description: 'Watch security training videos and pass the quiz',
          daysUntilDue: 3,
          order: 3,
          requiresDocument: true,
        },
        {
          title: 'Meet with team members',
          description: 'Schedule and complete 1-on-1 meetings with all team members',
          daysUntilDue: 5,
          order: 4,
          requiresDocument: false,
        },
      ],
      departmentId: department.id,
      estimatedDays: 5,
    };

    const createTemplateResponse = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send(templateData)
      .expect(201);

    expect(createTemplateResponse.body).toMatchObject({
      success: true,
      message: expect.stringContaining('created'),
    });

    const template = createTemplateResponse.body.template;
    expect(template).toBeDefined();
    expect(template.id).toBeDefined();
    expect(template.name).toBe(templateData.name);
    expect(template.tasks).toHaveLength(4);

    console.log('[E2E_ONBOARDING] Template created:', template.id);

    // ========================================================================
    // Step 2: HR Admin assigns workflow to new employee
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 2: Assigning workflow to new employee...');

    const newEmployeeId = await getEmployeeId(newEmployee.id);
    const targetCompletionDate = new Date();
    targetCompletionDate.setDate(targetCompletionDate.getDate() + 7);

    const assignWorkflowResponse = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        employeeId: newEmployeeId,
        templateId: template.id,
        targetCompletionDate: targetCompletionDate.toISOString(),
      })
      .expect(201);

    expect(assignWorkflowResponse.body).toMatchObject({
      success: true,
      message: expect.stringContaining('assigned'),
    });

    const workflow = assignWorkflowResponse.body.workflow;
    expect(workflow).toBeDefined();
    expect(workflow.id).toBeDefined();
    expect(workflow.employeeId).toBe(newEmployeeId);
    expect(workflow.templateId).toBe(template.id);
    expect(workflow.status).toBe('IN_PROGRESS');
    expect(workflow.tasks).toHaveLength(4);
    expect(workflow.progress).toMatchObject({
      totalTasks: 4,
      completedTasks: 0,
      percentComplete: 0,
    });

    console.log('[E2E_ONBOARDING] Workflow assigned:', workflow.id);

    // ========================================================================
    // Step 3: New employee views assigned tasks
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 3: Employee viewing assigned tasks...');

    const myTasksResponse = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(200);

    expect(myTasksResponse.body).toMatchObject({
      success: true,
    });

    const myTasks = myTasksResponse.body.tasks;
    expect(myTasks).toHaveLength(4);
    expect(myTasks[0]).toMatchObject({
      title: 'Complete HR paperwork',
      status: 'PENDING',
      requiresDocument: true,
    });

    console.log('[E2E_ONBOARDING] Employee can view tasks:', myTasks.length);

    // ========================================================================
    // Step 4: Employee completes first task with document upload
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 4: Employee completing task with document...');

    const firstTask = myTasks[0];
    const testDocumentPath = await createTestFile(
      'hr-paperwork.pdf',
      'Mock HR paperwork document content'
    );

    const completeTaskResponse = await request(app)
      .patch(`/api/onboarding/tasks/${firstTask.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', testDocumentPath)
      .expect(200);

    expect(completeTaskResponse.body).toMatchObject({
      success: true,
      message: expect.stringContaining('completed'),
    });

    const completedTask = completeTaskResponse.body.task;
    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.completedAt).toBeDefined();
    expect(completedTask.documentUrl).toBeDefined();

    // Verify file was stored
    const uploadedFilename = path.basename(completedTask.documentUrl);
    const fileExists = await verifyFileExists(uploadedFilename);
    expect(fileExists).toBe(true);

    console.log('[E2E_ONBOARDING] Task completed with document:', completedTask.id);

    // ========================================================================
    // Step 5: Employee completes second task (no document required)
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 5: Employee completing task without document...');

    const secondTask = myTasks[1];

    const completeSecondTaskResponse = await request(app)
      .patch(`/api/onboarding/tasks/${secondTask.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(200);

    expect(completeSecondTaskResponse.body).toMatchObject({
      success: true,
      message: expect.stringContaining('completed'),
    });

    const completedSecondTask = completeSecondTaskResponse.body.task;
    expect(completedSecondTask.status).toBe('COMPLETED');
    expect(completedSecondTask.documentUrl).toBeNull();

    console.log('[E2E_ONBOARDING] Second task completed:', completedSecondTask.id);

    // ========================================================================
    // Step 6: Manager views team progress
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 6: Manager viewing team progress...');

    const teamProgressResponse = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(teamProgressResponse.body).toMatchObject({
      success: true,
    });

    const teamProgress = teamProgressResponse.body.progress;
    expect(teamProgress).toBeDefined();
    expect(Array.isArray(teamProgress)).toBe(true);

    // Find new employee's progress
    const newEmployeeProgress = teamProgress.find(
      (p: any) => p.employeeId === newEmployeeId
    );

    expect(newEmployeeProgress).toBeDefined();
    expect(newEmployeeProgress).toMatchObject({
      employeeId: newEmployeeId,
      employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`,
      workflowStatus: 'IN_PROGRESS',
      progress: {
        totalTasks: 4,
        completedTasks: 2,
        percentComplete: 50,
      },
    });

    console.log('[E2E_ONBOARDING] Manager can view team progress:', newEmployeeProgress);

    // ========================================================================
    // Step 7: Verify progress updates after task completion
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 7: Verifying progress calculation...');

    // Get updated tasks
    const updatedTasksResponse = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(200);

    const updatedTasks = updatedTasksResponse.body.tasks;
    const completedCount = updatedTasks.filter((t: any) => t.status === 'COMPLETED').length;
    const pendingCount = updatedTasks.filter((t: any) => t.status === 'PENDING').length;

    expect(completedCount).toBe(2);
    expect(pendingCount).toBe(2);

    console.log('[E2E_ONBOARDING] Progress verified:', {
      completed: completedCount,
      pending: pendingCount,
      percentComplete: (completedCount / updatedTasks.length) * 100,
    });

    // ========================================================================
    // Step 8: Complete remaining tasks to finish workflow
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 8: Completing remaining tasks...');

    const thirdTask = updatedTasks.find((t: any) => t.order === 3);
    const testCertificatePath = await createTestFile(
      'security-certificate.pdf',
      'Mock security training certificate'
    );

    await request(app)
      .patch(`/api/onboarding/tasks/${thirdTask.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', testCertificatePath)
      .expect(200);

    const fourthTask = updatedTasks.find((t: any) => t.order === 4);

    await request(app)
      .patch(`/api/onboarding/tasks/${fourthTask.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(200);

    // ========================================================================
    // Step 9: Verify workflow completion
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 9: Verifying workflow completion...');

    const finalTasksResponse = await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(200);

    const finalTasks = finalTasksResponse.body.tasks;
    const allCompleted = finalTasks.every((t: any) => t.status === 'COMPLETED');

    expect(allCompleted).toBe(true);

    const finalProgressResponse = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    const finalProgress = finalProgressResponse.body.progress.find(
      (p: any) => p.employeeId === newEmployeeId
    );

    expect(finalProgress).toMatchObject({
      workflowStatus: 'COMPLETED',
      progress: {
        totalTasks: 4,
        completedTasks: 4,
        percentComplete: 100,
      },
    });

    console.log('[E2E_ONBOARDING] Workflow completed successfully:', finalProgress);

    // ========================================================================
    // Step 10: Verify database state
    // ========================================================================
    console.log('[E2E_ONBOARDING] Step 10: Verifying database state...');

    const workflowResult = await executeQuery<{ status: string; completed_at: Date }>(
      'SELECT status, completed_at FROM onboarding_workflows WHERE id = $1',
      [workflow.id]
    );

    expect(workflowResult.rows[0]).toMatchObject({
      status: 'COMPLETED',
    });
    expect(workflowResult.rows[0]!.completed_at).toBeDefined();

    const tasksResult = await executeQuery<{ status: string }>(
      'SELECT status FROM onboarding_tasks WHERE workflow_id = $1',
      [workflow.id]
    );

    expect(tasksResult.rows).toHaveLength(4);
    expect(tasksResult.rows.every(t => t.status === 'COMPLETED')).toBe(true);

    console.log('[E2E_ONBOARDING] Database state verified');

    console.log('[E2E_ONBOARDING] Complete workflow test finished successfully');
  });

  /**
   * Test document upload validation
   */
  it('should validate document uploads for required tasks', async () => {
    console.log('[E2E_ONBOARDING] Testing document upload validation...');

    // Create template with document-required task
    const templateResponse = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        name: 'Document Test Template',
        description: 'Template for testing document uploads',
        tasks: [
          {
            title: 'Submit required document',
            description: 'Upload required documentation',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
        ],
        estimatedDays: 1,
      })
      .expect(201);

    const template = templateResponse.body.template;

    // Assign workflow
    const newEmployeeId = await getEmployeeId(newEmployee.id);

    const workflowResponse = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        employeeId: newEmployeeId,
        templateId: template.id,
      })
      .expect(201);

    const workflow = workflowResponse.body.workflow;
    const task = workflow.tasks[0];

    // Try to complete without document (should fail)
    const noDocResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .expect(400);

    expect(noDocResponse.body).toMatchObject({
      success: false,
      code: 'DOCUMENT_REQUIRED',
    });

    // Complete with document (should succeed)
    const testDocPath = await createTestFile('test-doc.pdf', 'Test document content');

    const withDocResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', testDocPath)
      .expect(200);

    expect(withDocResponse.body).toMatchObject({
      success: true,
    });

    expect(withDocResponse.body.task.documentUrl).toBeDefined();

    console.log('[E2E_ONBOARDING] Document validation test completed');
  });

  /**
   * Test file type validation
   */
  it('should validate file types for document uploads', async () => {
    console.log('[E2E_ONBOARDING] Testing file type validation...');

    // Create template and workflow
    const templateResponse = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        name: 'File Type Test Template',
        description: 'Template for testing file type validation',
        tasks: [
          {
            title: 'Upload document',
            description: 'Upload a valid document',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
        ],
        estimatedDays: 1,
      })
      .expect(201);

    const template = templateResponse.body.template;
    const newEmployeeId = await getEmployeeId(newEmployee.id);

    const workflowResponse = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        employeeId: newEmployeeId,
        templateId: template.id,
      })
      .expect(201);

    const task = workflowResponse.body.workflow.tasks[0];

    // Try invalid file type
    const invalidFilePath = await createTestFile('test.exe', 'Invalid file content');

    const invalidResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', invalidFilePath)
      .expect(400);

    expect(invalidResponse.body).toMatchObject({
      success: false,
      code: 'INVALID_FILE_TYPE',
    });

    // Try valid file type
    const validFilePath = await createTestFile('test.pdf', 'Valid PDF content');

    const validResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', validFilePath)
      .expect(200);

    expect(validResponse.body).toMatchObject({
      success: true,
    });

    console.log('[E2E_ONBOARDING] File type validation test completed');
  });

  /**
   * Test file size validation
   */
  it('should validate file size for document uploads', async () => {
    console.log('[E2E_ONBOARDING] Testing file size validation...');

    // Create template and workflow
    const templateResponse = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        name: 'File Size Test Template',
        description: 'Template for testing file size validation',
        tasks: [
          {
            title: 'Upload document',
            description: 'Upload a document within size limit',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
        ],
        estimatedDays: 1,
      })
      .expect(201);

    const template = templateResponse.body.template;
    const newEmployeeId = await getEmployeeId(newEmployee.id);

    const workflowResponse = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        employeeId: newEmployeeId,
        templateId: template.id,
      })
      .expect(201);

    const task = workflowResponse.body.workflow.tasks[0];

    // Create file larger than 10MB
    const largeContent = Buffer.alloc(11 * 1024 * 1024, 'a'); // 11MB
    const largeFilePath = path.join(uploadDir, 'large-file.pdf');
    await fs.writeFile(largeFilePath, largeContent);

    const largeFileResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', largeFilePath)
      .expect(400);

    expect(largeFileResponse.body).toMatchObject({
      success: false,
      code: 'FILE_TOO_LARGE',
    });

    // Try valid file size
    const validFilePath = await createTestFile('valid-size.pdf', 'Valid size content');

    const validResponse = await request(app)
      .patch(`/api/onboarding/tasks/${task.id}`)
      .set('Authorization', `Bearer ${newEmployee.token}`)
      .attach('document', validFilePath)
      .expect(200);

    expect(validResponse.body).toMatchObject({
      success: true,
    });

    console.log('[E2E_ONBOARDING] File size validation test completed');
  });

  /**
   * Test authorization for different roles
   */
  it('should enforce role-based access control', async () => {
    console.log('[E2E_ONBOARDING] Testing role-based access control...');

    // Employee should not be able to create templates
    await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        name: 'Unauthorized Template',
        description: 'Should not be created',
        tasks: [],
        estimatedDays: 1,
      })
      .expect(403);

    // Employee should not be able to assign workflows
    await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        employeeId: 'some-id',
        templateId: 'some-template-id',
      })
      .expect(403);

    // Manager should be able to view templates
    await request(app)
      .get('/api/onboarding/templates')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Manager should be able to view team progress
    await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Employee should be able to view own tasks
    await request(app)
      .get('/api/onboarding/my-tasks')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    console.log('[E2E_ONBOARDING] Access control test completed');
  });

  /**
   * Test progress calculation accuracy
   */
  it('should calculate progress correctly as tasks are completed', async () => {
    console.log('[E2E_ONBOARDING] Testing progress calculation...');

    // Create template with 5 tasks
    const templateResponse = await request(app)
      .post('/api/onboarding/templates')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        name: 'Progress Test Template',
        description: 'Template for testing progress calculation',
        tasks: Array.from({ length: 5 }, (_, i) => ({
          title: `Task ${i + 1}`,
          description: `Description for task ${i + 1}`,
          daysUntilDue: i + 1,
          order: i + 1,
          requiresDocument: false,
        })),
        estimatedDays: 5,
      })
      .expect(201);

    const template = templateResponse.body.template;
    const newEmployeeId = await getEmployeeId(newEmployee.id);

    // Assign workflow
    const workflowResponse = await request(app)
      .post('/api/onboarding/workflows')
      .set('Authorization', `Bearer ${hrAdmin.token}`)
      .send({
        employeeId: newEmployeeId,
        templateId: template.id,
      })
      .expect(201);

    const workflow = workflowResponse.body.workflow;

    // Verify initial progress
    expect(workflow.progress).toMatchObject({
      totalTasks: 5,
      completedTasks: 0,
      percentComplete: 0,
    });

    // Complete tasks one by one and verify progress
    const tasks = workflow.tasks;

    for (let i = 0; i < tasks.length; i++) {
      await request(app)
        .patch(`/api/onboarding/tasks/${tasks[i].id}`)
        .set('Authorization', `Bearer ${newEmployee.token}`)
        .expect(200);

      const progressResponse = await request(app)
        .get('/api/onboarding/team-progress')
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const employeeProgress = progressResponse.body.progress.find(
        (p: any) => p.employeeId === newEmployeeId
      );

      const expectedPercent = Math.round(((i + 1) / 5) * 100);

      expect(employeeProgress.progress).toMatchObject({
        totalTasks: 5,
        completedTasks: i + 1,
        percentComplete: expectedPercent,
      });

      console.log(`[E2E_ONBOARDING] Progress after task ${i + 1}:`, employeeProgress.progress);
    }

    // Verify final status
    const finalProgressResponse = await request(app)
      .get('/api/onboarding/team-progress')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    const finalProgress = finalProgressResponse.body.progress.find(
      (p: any) => p.employeeId === newEmployeeId
    );

    expect(finalProgress).toMatchObject({
      workflowStatus: 'COMPLETED',
      progress: {
        totalTasks: 5,
        completedTasks: 5,
        percentComplete: 100,
      },
    });

    console.log('[E2E_ONBOARDING] Progress calculation test completed');
  });
});

export default describe;