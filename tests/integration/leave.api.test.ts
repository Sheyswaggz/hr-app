/**
 * Leave API Integration Tests
 * 
 * Comprehensive integration test suite for leave management API endpoints.
 * Tests all leave-related operations including request submission, approval/rejection,
 * balance tracking, and authorization checks.
 * 
 * Test Coverage:
 * - Leave request submission with validation
 * - Leave request approval/rejection workflow
 * - Leave balance retrieval and updates
 * - Authorization and access control
 * - Overlapping request detection
 * - Database state verification
 * 
 * @module tests/integration/leave.api
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';
import type { Express } from 'express';
import type { Pool } from 'pg';

/**
 * Test user data structure
 */
interface TestUser {
  id: string;
  userId: string;
  email: string;
  role: string;
  token: string;
  employeeId: string;
  managerId?: string;
}

/**
 * Test leave request data
 */
interface TestLeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  status: string;
  reason?: string;
}

// Test application and database instances
let app: Express;
let pool: Pool;

// Test users
let employee: TestUser;
let manager: TestUser;
let hrAdmin: TestUser;
let otherEmployee: TestUser;

// Test data cleanup tracking
const createdUserIds: string[] = [];
const createdEmployeeIds: string[] = [];
const createdLeaveRequestIds: string[] = [];

/**
 * Setup test database and application before all tests
 */
beforeAll(async () => {
  console.log('[LEAVE_API_TEST] Setting up test environment...');

  // Initialize application
  app = createApp();
  pool = getPool();

  // Verify database connection
  const healthCheck = await executeQuery('SELECT 1 as health', [], {
    correlationId: 'test_setup',
    operation: 'health_check',
  });

  if (healthCheck.rowCount === 0) {
    throw new Error('Database connection failed');
  }

  console.log('[LEAVE_API_TEST] Test environment setup complete');
});

/**
 * Cleanup test database after all tests
 */
afterAll(async () => {
  console.log('[LEAVE_API_TEST] Cleaning up test environment...');

  try {
    // Clean up in reverse order of dependencies
    if (createdLeaveRequestIds.length > 0) {
      await executeQuery(
        'DELETE FROM leave_requests WHERE id = ANY($1)',
        [createdLeaveRequestIds],
        { correlationId: 'test_cleanup', operation: 'delete_leave_requests' }
      );
    }

    if (createdEmployeeIds.length > 0) {
      await executeQuery(
        'DELETE FROM leave_balances WHERE employee_id = ANY($1)',
        [createdEmployeeIds],
        { correlationId: 'test_cleanup', operation: 'delete_leave_balances' }
      );

      await executeQuery(
        'DELETE FROM employees WHERE id = ANY($1)',
        [createdEmployeeIds],
        { correlationId: 'test_cleanup', operation: 'delete_employees' }
      );
    }

    if (createdUserIds.length > 0) {
      await executeQuery(
        'DELETE FROM users WHERE id = ANY($1)',
        [createdUserIds],
        { correlationId: 'test_cleanup', operation: 'delete_users' }
      );
    }

    console.log('[LEAVE_API_TEST] Test environment cleanup complete');
  } catch (error) {
    console.error('[LEAVE_API_TEST] Cleanup error:', error);
  }
});

/**
 * Setup test users before each test
 */
beforeEach(async () => {
  console.log('[LEAVE_API_TEST] Setting up test users...');

  const timestamp = new Date();
  const passwordHash = (await hashPassword('Test123!@#')).hash!;

  // Create test users in transaction
  await executeTransaction(async (client) => {
    // Create HR Admin user
    const hrAdminUserId = `test-user-hr-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [hrAdminUserId, `hr-${Date.now()}@test.com`, passwordHash, 'HR', 'Admin', 'HR_ADMIN', true, timestamp, timestamp]
    );
    createdUserIds.push(hrAdminUserId);

    const hrAdminEmployeeId = `test-emp-hr-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [hrAdminEmployeeId, hrAdminUserId, `EMP-HR-${Date.now()}`, 'HR Manager', 'dept-1', timestamp, 'ACTIVE', timestamp, timestamp]
    );
    createdEmployeeIds.push(hrAdminEmployeeId);

    hrAdmin = {
      id: hrAdminUserId,
      userId: hrAdminUserId,
      email: `hr-${Date.now()}@test.com`,
      role: 'HR_ADMIN',
      token: generateAccessToken(hrAdminUserId, `hr-${Date.now()}@test.com`, 'HR_ADMIN'),
      employeeId: hrAdminEmployeeId,
    };

    // Create Manager user
    const managerUserId = `test-user-mgr-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [managerUserId, `manager-${Date.now()}@test.com`, passwordHash, 'Test', 'Manager', 'MANAGER', true, timestamp, timestamp]
    );
    createdUserIds.push(managerUserId);

    const managerEmployeeId = `test-emp-mgr-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [managerEmployeeId, managerUserId, `EMP-MGR-${Date.now()}`, 'Team Manager', 'dept-1', timestamp, 'ACTIVE', timestamp, timestamp]
    );
    createdEmployeeIds.push(managerEmployeeId);

    manager = {
      id: managerUserId,
      userId: managerUserId,
      email: `manager-${Date.now()}@test.com`,
      role: 'MANAGER',
      token: generateAccessToken(managerUserId, `manager-${Date.now()}@test.com`, 'MANAGER'),
      employeeId: managerEmployeeId,
      managerId: managerEmployeeId,
    };

    // Create Employee user (reports to manager)
    const employeeUserId = `test-user-emp-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [employeeUserId, `employee-${Date.now()}@test.com`, passwordHash, 'Test', 'Employee', 'EMPLOYEE', true, timestamp, timestamp]
    );
    createdUserIds.push(employeeUserId);

    const employeeId = `test-emp-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [employeeId, employeeUserId, `EMP-${Date.now()}`, 'Software Engineer', 'dept-1', managerEmployeeId, timestamp, 'ACTIVE', timestamp, timestamp]
    );
    createdEmployeeIds.push(employeeId);

    employee = {
      id: employeeUserId,
      userId: employeeUserId,
      email: `employee-${Date.now()}@test.com`,
      role: 'EMPLOYEE',
      token: generateAccessToken(employeeUserId, `employee-${Date.now()}@test.com`, 'EMPLOYEE'),
      employeeId: employeeId,
      managerId: managerEmployeeId,
    };

    // Create another Employee user (different team)
    const otherEmployeeUserId = `test-user-other-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherEmployeeUserId, `other-${Date.now()}@test.com`, passwordHash, 'Other', 'Employee', 'EMPLOYEE', true, timestamp, timestamp]
    );
    createdUserIds.push(otherEmployeeUserId);

    const otherEmployeeId = `test-emp-other-${Date.now()}-${Math.random()}`;
    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherEmployeeId, otherEmployeeUserId, `EMP-OTHER-${Date.now()}`, 'Designer', 'dept-2', timestamp, 'ACTIVE', timestamp, timestamp]
    );
    createdEmployeeIds.push(otherEmployeeId);

    otherEmployee = {
      id: otherEmployeeUserId,
      userId: otherEmployeeUserId,
      email: `other-${Date.now()}@test.com`,
      role: 'EMPLOYEE',
      token: generateAccessToken(otherEmployeeUserId, `other-${Date.now()}@test.com`, 'EMPLOYEE'),
      employeeId: otherEmployeeId,
    };

    // Create leave balances for employees
    await client.query(
      `INSERT INTO leave_balances (id, employee_id, leave_type, total_days, used_days, pending_days, created_at, updated_at)
       VALUES 
         ($1, $2, 'ANNUAL', 20, 0, 0, $3, $4),
         ($5, $6, 'SICK', 10, 0, 0, $7, $8),
         ($9, $10, 'ANNUAL', 20, 0, 0, $11, $12),
         ($13, $14, 'SICK', 10, 0, 0, $15, $16)`,
      [
        `bal-${employeeId}-annual`, employeeId, timestamp, timestamp,
        `bal-${employeeId}-sick`, employeeId, timestamp, timestamp,
        `bal-${otherEmployeeId}-annual`, otherEmployeeId, timestamp, timestamp,
        `bal-${otherEmployeeId}-sick`, otherEmployeeId, timestamp, timestamp,
      ]
    );
  }, { correlationId: 'test_setup', operation: 'create_test_users' });

  console.log('[LEAVE_API_TEST] Test users setup complete');
});

/**
 * Cleanup test data after each test
 */
afterEach(async () => {
  console.log('[LEAVE_API_TEST] Cleaning up test data...');

  // Clean up leave requests created in this test
  if (createdLeaveRequestIds.length > 0) {
    await executeQuery(
      'DELETE FROM leave_requests WHERE id = ANY($1)',
      [createdLeaveRequestIds],
      { correlationId: 'test_cleanup', operation: 'delete_test_leave_requests' }
    );
    createdLeaveRequestIds.length = 0;
  }

  // Reset leave balances
  if (createdEmployeeIds.length > 0) {
    await executeQuery(
      'UPDATE leave_balances SET used_days = 0, pending_days = 0 WHERE employee_id = ANY($1)',
      [createdEmployeeIds],
      { correlationId: 'test_cleanup', operation: 'reset_leave_balances' }
    );
  }

  console.log('[LEAVE_API_TEST] Test data cleanup complete');
});

/**
 * Test suite: POST /api/leave/requests - Leave request submission
 */
describe('POST /api/leave/requests', () => {
  it('should successfully submit leave request as Employee', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Family vacation',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('submitted'),
    });

    expect(response.body.data).toMatchObject({
      id: expect.any(String),
      employeeId: employee.employeeId,
      leaveType: 'ANNUAL',
      status: 'PENDING',
      daysRequested: 5,
    });

    createdLeaveRequestIds.push(response.body.data.id);

    // Verify database state
    const dbRequest = await executeQuery(
      'SELECT * FROM leave_requests WHERE id = $1',
      [response.body.data.id],
      { correlationId: 'test_verify', operation: 'verify_leave_request' }
    );

    expect(dbRequest.rows[0]).toMatchObject({
      employee_id: employee.employeeId,
      leave_type: 'ANNUAL',
      status: 'PENDING',
      days_requested: 5,
    });

    // Verify balance update (pending days)
    const balance = await executeQuery(
      'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type = $2',
      [employee.employeeId, 'ANNUAL'],
      { correlationId: 'test_verify', operation: 'verify_balance' }
    );

    expect(balance.rows[0]).toMatchObject({
      pending_days: 5,
    });
  });

  it('should reject leave request with insufficient balance', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 25); // 26 days, more than available

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Extended vacation',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'INSUFFICIENT_BALANCE',
      message: expect.stringContaining('balance'),
    });
  });

  it('should reject leave request with invalid dates (end before start)', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() - 2);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Invalid dates',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('date'),
    });
  });

  it('should reject leave request with past dates', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Past dates',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('future'),
    });
  });

  it('should reject overlapping leave requests', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    // Submit first request
    const firstResponse = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'First request',
      })
      .expect(201);

    createdLeaveRequestIds.push(firstResponse.body.data.id);

    // Try to submit overlapping request
    const overlapStart = new Date(startDate);
    overlapStart.setDate(overlapStart.getDate() + 2);
    const overlapEnd = new Date(overlapStart);
    overlapEnd.setDate(overlapEnd.getDate() + 3);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: overlapStart.toISOString(),
        endDate: overlapEnd.toISOString(),
        reason: 'Overlapping request',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'OVERLAPPING_REQUEST',
      message: expect.stringContaining('overlap'),
    });
  });

  it('should reject request with reason exceeding 500 characters', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const longReason = 'A'.repeat(501);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: longReason,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('500'),
    });
  });
});

/**
 * Test suite: GET /api/leave/requests/:id - Get leave request by ID
 */
describe('GET /api/leave/requests/:id', () => {
  let testRequestId: string;

  beforeEach(async () => {
    // Create a test leave request
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Test request',
      });

    testRequestId = response.body.data.id;
    createdLeaveRequestIds.push(testRequestId);
  });

  it('should retrieve leave request as owner', async () => {
    const response = await request(app)
      .get(`/api/leave/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: testRequestId,
        employeeId: employee.employeeId,
        leaveType: 'ANNUAL',
        status: 'PENDING',
      },
    });
  });

  it('should retrieve leave request as manager', async () => {
    const response = await request(app)
      .get(`/api/leave/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: testRequestId,
        employeeId: employee.employeeId,
      },
    });
  });

  it('should return 403 for unauthorized employee', async () => {
    const response = await request(app)
      .get(`/api/leave/requests/${testRequestId}`)
      .set('Authorization', `Bearer ${otherEmployee.token}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });

  it('should return 404 for non-existent request', async () => {
    const response = await request(app)
      .get('/api/leave/requests/non-existent-id')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
    });
  });
});

/**
 * Test suite: GET /api/leave/my-requests - Get employee's leave requests
 */
describe('GET /api/leave/my-requests', () => {
  beforeEach(async () => {
    // Create multiple test leave requests
    const requests = [
      { days: 5, status: 'PENDING' },
      { days: 3, status: 'APPROVED' },
      { days: 2, status: 'REJECTED' },
    ];

    for (const req of requests) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7 + requests.indexOf(req) * 10);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + req.days - 1);

      const response = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employee.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: `Test request ${req.status}`,
        });

      const requestId = response.body.data.id;
      createdLeaveRequestIds.push(requestId);

      // Update status if not pending
      if (req.status !== 'PENDING') {
        await executeQuery(
          'UPDATE leave_requests SET status = $1 WHERE id = $2',
          [req.status, requestId],
          { correlationId: 'test_setup', operation: 'update_request_status' }
        );
      }
    }
  });

  it('should retrieve all employee leave requests', async () => {
    const response = await request(app)
      .get('/api/leave/my-requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ status: 'PENDING' }),
        expect.objectContaining({ status: 'APPROVED' }),
        expect.objectContaining({ status: 'REJECTED' }),
      ]),
    });

    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get('/api/leave/my-requests?page=1&limit=2')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Array),
      pagination: {
        page: 1,
        limit: 2,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });

    expect(response.body.data.length).toBeLessThanOrEqual(2);
  });
});

/**
 * Test suite: GET /api/leave/team-requests - Get team leave requests
 */
describe('GET /api/leave/team-requests', () => {
  it('should retrieve team leave requests as Manager', async () => {
    const response = await request(app)
      .get('/api/leave/team-requests')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Array),
    });
  });

  it('should return 403 for Employee role', async () => {
    const response = await request(app)
      .get('/api/leave/team-requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });
});

/**
 * Test suite: PATCH /api/leave/requests/:id/approve - Approve leave request
 */
describe('PATCH /api/leave/requests/:id/approve', () => {
  let testRequestId: string;

  beforeEach(async () => {
    // Create a test leave request
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Test approval',
      });

    testRequestId = response.body.data.id;
    createdLeaveRequestIds.push(testRequestId);
  });

  it('should approve leave request as Manager', async () => {
    const response = await request(app)
      .patch(`/api/leave/requests/${testRequestId}/approve`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        comments: 'Approved for vacation',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('approved'),
      data: {
        id: testRequestId,
        status: 'APPROVED',
      },
    });

    // Verify database state
    const dbRequest = await executeQuery(
      'SELECT * FROM leave_requests WHERE id = $1',
      [testRequestId],
      { correlationId: 'test_verify', operation: 'verify_approval' }
    );

    expect(dbRequest.rows[0]).toMatchObject({
      status: 'APPROVED',
      approver_id: manager.employeeId,
    });

    // Verify balance update
    const balance = await executeQuery(
      'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type = $2',
      [employee.employeeId, 'ANNUAL'],
      { correlationId: 'test_verify', operation: 'verify_balance_update' }
    );

    expect(balance.rows[0]).toMatchObject({
      used_days: 5,
      pending_days: 0,
    });
  });

  it('should return 403 for non-team member manager', async () => {
    // Create another manager
    const timestamp = new Date();
    const passwordHash = (await hashPassword('Test123!@#')).hash!;

    const otherManagerUserId = `test-user-mgr2-${Date.now()}-${Math.random()}`;
    await executeQuery(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherManagerUserId, `manager2-${Date.now()}@test.com`, passwordHash, 'Other', 'Manager', 'MANAGER', true, timestamp, timestamp],
      { correlationId: 'test_setup', operation: 'create_other_manager' }
    );
    createdUserIds.push(otherManagerUserId);

    const otherManagerEmployeeId = `test-emp-mgr2-${Date.now()}-${Math.random()}`;
    await executeQuery(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherManagerEmployeeId, otherManagerUserId, `EMP-MGR2-${Date.now()}`, 'Other Manager', 'dept-2', timestamp, 'ACTIVE', timestamp, timestamp],
      { correlationId: 'test_setup', operation: 'create_other_manager_employee' }
    );
    createdEmployeeIds.push(otherManagerEmployeeId);

    const otherManagerToken = generateAccessToken(otherManagerUserId, `manager2-${Date.now()}@test.com`, 'MANAGER');

    const response = await request(app)
      .patch(`/api/leave/requests/${testRequestId}/approve`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({
        comments: 'Trying to approve',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });
});

/**
 * Test suite: PATCH /api/leave/requests/:id/reject - Reject leave request
 */
describe('PATCH /api/leave/requests/:id/reject', () => {
  let testRequestId: string;

  beforeEach(async () => {
    // Create a test leave request
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const response = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Test rejection',
      });

    testRequestId = response.body.data.id;
    createdLeaveRequestIds.push(testRequestId);
  });

  it('should reject leave request with reason as Manager', async () => {
    const response = await request(app)
      .patch(`/api/leave/requests/${testRequestId}/reject`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        reason: 'Insufficient staffing during this period',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: expect.stringContaining('rejected'),
      data: {
        id: testRequestId,
        status: 'REJECTED',
      },
    });

    // Verify database state
    const dbRequest = await executeQuery(
      'SELECT * FROM leave_requests WHERE id = $1',
      [testRequestId],
      { correlationId: 'test_verify', operation: 'verify_rejection' }
    );

    expect(dbRequest.rows[0]).toMatchObject({
      status: 'REJECTED',
      approver_id: manager.employeeId,
      rejection_reason: 'Insufficient staffing during this period',
    });

    // Verify balance update (pending days should be released)
    const balance = await executeQuery(
      'SELECT * FROM leave_balances WHERE employee_id = $1 AND leave_type = $2',
      [employee.employeeId, 'ANNUAL'],
      { correlationId: 'test_verify', operation: 'verify_balance_release' }
    );

    expect(balance.rows[0]).toMatchObject({
      pending_days: 0,
    });
  });

  it('should return 400 when rejection reason is missing', async () => {
    const response = await request(app)
      .patch(`/api/leave/requests/${testRequestId}/reject`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('reason'),
    });
  });

  it('should return 403 for non-team member manager', async () => {
    // Create another manager
    const timestamp = new Date();
    const passwordHash = (await hashPassword('Test123!@#')).hash!;

    const otherManagerUserId = `test-user-mgr3-${Date.now()}-${Math.random()}`;
    await executeQuery(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherManagerUserId, `manager3-${Date.now()}@test.com`, passwordHash, 'Third', 'Manager', 'MANAGER', true, timestamp, timestamp],
      { correlationId: 'test_setup', operation: 'create_third_manager' }
    );
    createdUserIds.push(otherManagerUserId);

    const otherManagerEmployeeId = `test-emp-mgr3-${Date.now()}-${Math.random()}`;
    await executeQuery(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [otherManagerEmployeeId, otherManagerUserId, `EMP-MGR3-${Date.now()}`, 'Third Manager', 'dept-3', timestamp, 'ACTIVE', timestamp, timestamp],
      { correlationId: 'test_setup', operation: 'create_third_manager_employee' }
    );
    createdEmployeeIds.push(otherManagerEmployeeId);

    const otherManagerToken = generateAccessToken(otherManagerUserId, `manager3-${Date.now()}@test.com`, 'MANAGER');

    const response = await request(app)
      .patch(`/api/leave/requests/${testRequestId}/reject`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({
        reason: 'Trying to reject',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
    });
  });
});

/**
 * Test suite: GET /api/leave/my-balance - Get leave balance
 */
describe('GET /api/leave/my-balance', () => {
  it('should retrieve leave balance as Employee', async () => {
    const response = await request(app)
      .get('/api/leave/my-balance')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        employeeId: employee.employeeId,
        balances: expect.arrayContaining([
          expect.objectContaining({
            leaveType: 'ANNUAL',
            totalDays: 20,
            usedDays: expect.any(Number),
            remainingDays: expect.any(Number),
            pendingDays: expect.any(Number),
          }),
          expect.objectContaining({
            leaveType: 'SICK',
            totalDays: 10,
            usedDays: expect.any(Number),
            remainingDays: expect.any(Number),
            pendingDays: expect.any(Number),
          }),
        ]),
        lastUpdated: expect.any(String),
      },
    });

    // Verify balance calculation
    const annualBalance = response.body.data.balances.find((b: any) => b.leaveType === 'ANNUAL');
    expect(annualBalance.remainingDays).toBe(
      annualBalance.totalDays - annualBalance.usedDays - annualBalance.pendingDays
    );
  });

  it('should show correct balance after leave approval', async () => {
    // Submit and approve a leave request
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4);

    const submitResponse = await request(app)
      .post('/api/leave/requests')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        leaveType: 'ANNUAL',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: 'Balance test',
      });

    const requestId = submitResponse.body.data.id;
    createdLeaveRequestIds.push(requestId);

    await request(app)
      .patch(`/api/leave/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        comments: 'Approved',
      });

    // Check balance
    const response = await request(app)
      .get('/api/leave/my-balance')
      .set('Authorization', `Bearer ${employee.token}`)
      .expect(200);

    const annualBalance = response.body.data.balances.find((b: any) => b.leaveType === 'ANNUAL');
    expect(annualBalance).toMatchObject({
      usedDays: 5,
      pendingDays: 0,
      remainingDays: 15,
    });
  });
});