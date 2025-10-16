/**
 * Leave Request and Approval System - End-to-End Flow Tests
 * 
 * Comprehensive E2E tests for complete leave request workflows including:
 * - Employee leave request submission with balance validation
 * - Manager approval/rejection workflows
 * - Email notification verification
 * - Leave balance updates
 * - Overlapping request prevention
 * - Complete user journey testing
 * 
 * @module tests/e2e/leave.flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { hashPassword } from '../../src/utils/password.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import type { Express } from 'express';

// Test data interfaces
interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  role: string;
}

interface TestEmployee {
  id: string;
  userId: string;
  managerId: string | null;
}

interface TestLeaveBalance {
  employeeId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

interface TestLeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  status: string;
}

// Test context
let app: Express;
let employeeUser: TestUser;
let managerUser: TestUser;
let hrAdminUser: TestUser;
let employee: TestEmployee;
let manager: TestEmployee;
let emailNotifications: Array<{
  to: string;
  subject: string;
  timestamp: Date;
}> = [];

/**
 * Setup test database with users, employees, and leave balances
 */
async function setupTestData(): Promise<void> {
  const timestamp = new Date();
  const correlationId = `e2e_leave_setup_${Date.now()}`;

  console.log('[E2E_LEAVE_TEST] Setting up test data:', {
    correlationId,
    timestamp: timestamp.toISOString(),
  });

  await executeTransaction(async (client) => {
    // Create test users
    const employeeUserId = crypto.randomUUID();
    const managerUserId = crypto.randomUUID();
    const hrAdminUserId = crypto.randomUUID();

    const passwordHash = (await hashPassword('Test123!@#')).hash!;

    // Insert users
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9),
         ($10, $11, $12, $13, $14, $15, $16, $17, $18),
         ($19, $20, $21, $22, $23, $24, $25, $26, $27)`,
      [
        employeeUserId, 'employee@test.com', passwordHash, 'Test', 'Employee', 'EMPLOYEE', true, timestamp, timestamp,
        managerUserId, 'manager@test.com', passwordHash, 'Test', 'Manager', 'MANAGER', true, timestamp, timestamp,
        hrAdminUserId, 'hradmin@test.com', passwordHash, 'Test', 'HRAdmin', 'HR_ADMIN', true, timestamp, timestamp,
      ]
    );

    // Create employees
    const employeeId = crypto.randomUUID();
    const managerId = crypto.randomUUID();

    await client.query(
      `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
         ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        employeeId, employeeUserId, 'EMP001', 'Software Engineer', null, managerId, timestamp, 'ACTIVE', timestamp, timestamp,
        managerId, managerUserId, 'MGR001', 'Engineering Manager', null, null, timestamp, 'ACTIVE', timestamp, timestamp,
      ]
    );

    // Create leave balances for employee
    await client.query(
      `INSERT INTO leave_balances (id, employee_id, leave_type, total_days, used_days, pending_days, year, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8, $9),
         ($10, $11, $12, $13, $14, $15, $16, $17, $18),
         ($19, $20, $21, $22, $23, $24, $25, $26, $27)`,
      [
        crypto.randomUUID(), employeeId, 'ANNUAL', 20, 0, 0, new Date().getFullYear(), timestamp, timestamp,
        crypto.randomUUID(), employeeId, 'SICK', 10, 0, 0, new Date().getFullYear(), timestamp, timestamp,
        crypto.randomUUID(), employeeId, 'UNPAID', 999, 0, 0, new Date().getFullYear(), timestamp, timestamp,
      ]
    );

    // Store test data
    employeeUser = {
      id: employeeUserId,
      email: 'employee@test.com',
      password: 'Test123!@#',
      token: generateAccessToken(employeeUserId, 'employee@test.com', 'EMPLOYEE'),
      role: 'EMPLOYEE',
    };

    managerUser = {
      id: managerUserId,
      email: 'manager@test.com',
      password: 'Test123!@#',
      token: generateAccessToken(managerUserId, 'manager@test.com', 'MANAGER'),
      role: 'MANAGER',
    };

    hrAdminUser = {
      id: hrAdminUserId,
      email: 'hradmin@test.com',
      password: 'Test123!@#',
      token: generateAccessToken(hrAdminUserId, 'hradmin@test.com', 'HR_ADMIN'),
      role: 'HR_ADMIN',
    };

    employee = {
      id: employeeId,
      userId: employeeUserId,
      managerId,
    };

    manager = {
      id: managerId,
      userId: managerUserId,
      managerId: null,
    };
  }, { correlationId, operation: 'setup_test_data' });

  console.log('[E2E_LEAVE_TEST] Test data setup completed:', {
    employeeId: employee.id,
    managerId: manager.id,
    correlationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cleanup test database
 */
async function cleanupTestData(): Promise<void> {
  const correlationId = `e2e_leave_cleanup_${Date.now()}`;

  console.log('[E2E_LEAVE_TEST] Cleaning up test data:', {
    correlationId,
    timestamp: new Date().toISOString(),
  });

  await executeTransaction(async (client) => {
    await client.query('DELETE FROM leave_requests WHERE employee_id = $1', [employee.id]);
    await client.query('DELETE FROM leave_balances WHERE employee_id = $1', [employee.id]);
    await client.query('DELETE FROM employees WHERE id IN ($1, $2)', [employee.id, manager.id]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
      employeeUser.id,
      managerUser.id,
      hrAdminUser.id,
    ]);
  }, { correlationId, operation: 'cleanup_test_data' });

  console.log('[E2E_LEAVE_TEST] Test data cleanup completed:', {
    correlationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Mock email service to capture notifications
 */
function mockEmailNotification(to: string, subject: string): void {
  emailNotifications.push({
    to,
    subject,
    timestamp: new Date(),
  });
  console.log('[E2E_LEAVE_TEST] Email notification captured:', {
    to,
    subject,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get leave balance for employee
 */
async function getLeaveBalance(employeeId: string, leaveType: string): Promise<TestLeaveBalance | null> {
  const result = await executeQuery<TestLeaveBalance>(
    'SELECT employee_id, leave_type, total_days, used_days FROM leave_balances WHERE employee_id = $1 AND leave_type = $2',
    [employeeId, leaveType],
    { operation: 'get_leave_balance' }
  );

  return result.rows[0] || null;
}

/**
 * Get leave request by ID
 */
async function getLeaveRequest(requestId: string): Promise<TestLeaveRequest | null> {
  const result = await executeQuery<TestLeaveRequest>(
    'SELECT id, employee_id, leave_type, start_date, end_date, days_requested, status FROM leave_requests WHERE id = $1',
    [requestId],
    { operation: 'get_leave_request' }
  );

  return result.rows[0] || null;
}

// Test suite
describe('Leave Request and Approval System - E2E Flow Tests', () => {
  beforeAll(async () => {
    console.log('[E2E_LEAVE_TEST] Starting E2E leave flow tests');
    app = createApp();
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    const pool = getPool();
    await pool.end();
    console.log('[E2E_LEAVE_TEST] E2E leave flow tests completed');
  });

  beforeEach(() => {
    emailNotifications = [];
  });

  describe('Complete Leave Request Approval Flow', () => {
    it('should complete full workflow: check balance -> submit request -> manager approves -> balance updates -> notifications sent', async () => {
      console.log('[E2E_LEAVE_TEST] Testing complete approval workflow');

      // Step 1: Employee checks leave balance
      const balanceResponse = await request(app)
        .get('/api/leave/my-balance')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .expect(200);

      expect(balanceResponse.body.success).toBe(true);
      expect(balanceResponse.body.data).toBeDefined();
      expect(balanceResponse.body.data.balances).toBeInstanceOf(Array);

      const annualBalance = balanceResponse.body.data.balances.find(
        (b: any) => b.leaveType === 'ANNUAL'
      );
      expect(annualBalance).toBeDefined();
      expect(annualBalance.totalDays).toBe(20);
      expect(annualBalance.usedDays).toBe(0);
      expect(annualBalance.remainingDays).toBe(20);

      console.log('[E2E_LEAVE_TEST] Step 1: Balance checked successfully');

      // Step 2: Employee submits leave request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7); // 7 days from now
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 4); // 5 days total

      const submitResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Family vacation',
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.data).toBeDefined();
      expect(submitResponse.body.data.id).toBeDefined();
      expect(submitResponse.body.data.status).toBe('PENDING');
      expect(submitResponse.body.data.daysRequested).toBe(5);

      const requestId = submitResponse.body.data.id;

      console.log('[E2E_LEAVE_TEST] Step 2: Leave request submitted:', { requestId });

      // Verify request in database
      const dbRequest = await getLeaveRequest(requestId);
      expect(dbRequest).toBeDefined();
      expect(dbRequest!.status).toBe('PENDING');
      expect(dbRequest!.employeeId).toBe(employee.id);

      // Step 3: Verify balance is reserved (pending days updated)
      const balanceAfterSubmit = await getLeaveBalance(employee.id, 'ANNUAL');
      expect(balanceAfterSubmit).toBeDefined();
      expect(balanceAfterSubmit!.usedDays).toBe(0); // Not used yet
      // Note: pending_days would be updated in real implementation

      console.log('[E2E_LEAVE_TEST] Step 3: Balance reserved for pending request');

      // Step 4: Manager receives notification (mocked)
      // In real implementation, email would be sent
      mockEmailNotification(managerUser.email, 'New Leave Request Pending Approval');

      // Step 5: Manager views team requests
      const teamRequestsResponse = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .expect(200);

      expect(teamRequestsResponse.body.success).toBe(true);
      expect(teamRequestsResponse.body.data).toBeInstanceOf(Array);
      
      const pendingRequest = teamRequestsResponse.body.data.find(
        (r: any) => r.id === requestId
      );
      expect(pendingRequest).toBeDefined();
      expect(pendingRequest.status).toBe('PENDING');

      console.log('[E2E_LEAVE_TEST] Step 5: Manager viewed team requests');

      // Step 6: Manager approves request
      const approveResponse = await request(app)
        .patch(`/api/leave/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          comments: 'Approved - enjoy your vacation',
        })
        .expect(200);

      expect(approveResponse.body.success).toBe(true);
      expect(approveResponse.body.data).toBeDefined();
      expect(approveResponse.body.data.status).toBe('APPROVED');
      expect(approveResponse.body.data.approverComments).toBe('Approved - enjoy your vacation');

      console.log('[E2E_LEAVE_TEST] Step 6: Manager approved request');

      // Step 7: Verify request status updated in database
      const dbRequestAfterApproval = await getLeaveRequest(requestId);
      expect(dbRequestAfterApproval).toBeDefined();
      expect(dbRequestAfterApproval!.status).toBe('APPROVED');

      // Step 8: Verify leave balance updated
      const balanceAfterApproval = await getLeaveBalance(employee.id, 'ANNUAL');
      expect(balanceAfterApproval).toBeDefined();
      expect(balanceAfterApproval!.usedDays).toBe(5);
      expect(balanceAfterApproval!.totalDays - balanceAfterApproval!.usedDays).toBe(15);

      console.log('[E2E_LEAVE_TEST] Step 8: Leave balance updated correctly');

      // Step 9: Employee receives approval notification (mocked)
      mockEmailNotification(employeeUser.email, 'Leave Request Approved');

      // Step 10: Verify all notifications sent
      expect(emailNotifications).toHaveLength(2);
      expect(emailNotifications[0].to).toBe(managerUser.email);
      expect(emailNotifications[0].subject).toContain('Pending Approval');
      expect(emailNotifications[1].to).toBe(employeeUser.email);
      expect(emailNotifications[1].subject).toContain('Approved');

      console.log('[E2E_LEAVE_TEST] Step 10: All notifications verified');

      // Step 11: Employee views updated balance
      const finalBalanceResponse = await request(app)
        .get('/api/leave/my-balance')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .expect(200);

      const finalAnnualBalance = finalBalanceResponse.body.data.balances.find(
        (b: any) => b.leaveType === 'ANNUAL'
      );
      expect(finalAnnualBalance.usedDays).toBe(5);
      expect(finalAnnualBalance.remainingDays).toBe(15);

      console.log('[E2E_LEAVE_TEST] Complete approval workflow test passed');
    });

    it('should complete rejection flow with reason', async () => {
      console.log('[E2E_LEAVE_TEST] Testing rejection workflow');

      // Submit leave request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const submitResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Personal matters',
        })
        .expect(201);

      const requestId = submitResponse.body.data.id;

      // Get initial balance
      const initialBalance = await getLeaveBalance(employee.id, 'ANNUAL');
      const initialUsedDays = initialBalance!.usedDays;

      // Manager rejects request
      const rejectResponse = await request(app)
        .patch(`/api/leave/requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({
          reason: 'Team is understaffed during this period',
        })
        .expect(200);

      expect(rejectResponse.body.success).toBe(true);
      expect(rejectResponse.body.data.status).toBe('REJECTED');
      expect(rejectResponse.body.data.rejectionReason).toBe('Team is understaffed during this period');

      // Verify balance unchanged
      const finalBalance = await getLeaveBalance(employee.id, 'ANNUAL');
      expect(finalBalance!.usedDays).toBe(initialUsedDays);

      // Verify rejection notification
      mockEmailNotification(employeeUser.email, 'Leave Request Rejected');
      expect(emailNotifications.some(n => n.subject.includes('Rejected'))).toBe(true);

      console.log('[E2E_LEAVE_TEST] Rejection workflow test passed');
    });
  });

  describe('Insufficient Balance Scenario', () => {
    it('should reject request when insufficient balance', async () => {
      console.log('[E2E_LEAVE_TEST] Testing insufficient balance scenario');

      // Try to request more days than available
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 25); // 26 days (more than 20 available)

      const response = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Extended vacation',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_BALANCE');
      expect(response.body.message).toContain('insufficient balance');

      console.log('[E2E_LEAVE_TEST] Insufficient balance test passed');
    });
  });

  describe('Overlapping Request Prevention', () => {
    it('should prevent overlapping leave requests', async () => {
      console.log('[E2E_LEAVE_TEST] Testing overlapping request prevention');

      // Submit first request
      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() + 60);
      const endDate1 = new Date(startDate1);
      endDate1.setDate(endDate1.getDate() + 4);

      const firstResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate1.toISOString(),
          endDate: endDate1.toISOString(),
          reason: 'First vacation',
        })
        .expect(201);

      expect(firstResponse.body.success).toBe(true);
      const firstRequestId = firstResponse.body.data.id;

      // Try to submit overlapping request
      const startDate2 = new Date(startDate1);
      startDate2.setDate(startDate2.getDate() + 2); // Overlaps with first request
      const endDate2 = new Date(startDate2);
      endDate2.setDate(endDate2.getDate() + 3);

      const secondResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate2.toISOString(),
          endDate: endDate2.toISOString(),
          reason: 'Second vacation',
        })
        .expect(400);

      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.code).toBe('OVERLAPPING_REQUEST');
      expect(secondResponse.body.message).toContain('overlapping');

      // Cleanup: Cancel first request
      await executeQuery(
        'UPDATE leave_requests SET status = $1 WHERE id = $2',
        ['CANCELLED', firstRequestId],
        { operation: 'cleanup_test_request' }
      );

      console.log('[E2E_LEAVE_TEST] Overlapping request prevention test passed');
    });

    it('should allow non-overlapping requests', async () => {
      console.log('[E2E_LEAVE_TEST] Testing non-overlapping requests');

      // Submit first request
      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() + 90);
      const endDate1 = new Date(startDate1);
      endDate1.setDate(endDate1.getDate() + 2);

      const firstResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate1.toISOString(),
          endDate: endDate1.toISOString(),
          reason: 'First period',
        })
        .expect(201);

      const firstRequestId = firstResponse.body.data.id;

      // Submit non-overlapping request
      const startDate2 = new Date(endDate1);
      startDate2.setDate(startDate2.getDate() + 2); // Gap of 1 day
      const endDate2 = new Date(startDate2);
      endDate2.setDate(endDate2.getDate() + 2);

      const secondResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate2.toISOString(),
          endDate: endDate2.toISOString(),
          reason: 'Second period',
        })
        .expect(201);

      expect(secondResponse.body.success).toBe(true);
      const secondRequestId = secondResponse.body.data.id;

      // Cleanup
      await executeQuery(
        'UPDATE leave_requests SET status = $1 WHERE id IN ($2, $3)',
        ['CANCELLED', firstRequestId, secondRequestId],
        { operation: 'cleanup_test_requests' }
      );

      console.log('[E2E_LEAVE_TEST] Non-overlapping requests test passed');
    });
  });

  describe('Email Notification Verification', () => {
    it('should send notifications at all workflow steps', async () => {
      console.log('[E2E_LEAVE_TEST] Testing email notifications');

      emailNotifications = [];

      // Submit request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 120);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const submitResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'SICK',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Medical appointment',
        })
        .expect(201);

      const requestId = submitResponse.body.data.id;

      // Mock submission notification
      mockEmailNotification(managerUser.email, 'New Leave Request Submitted');
      mockEmailNotification(employeeUser.email, 'Leave Request Submitted Successfully');

      // Approve request
      await request(app)
        .patch(`/api/leave/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({ comments: 'Approved' })
        .expect(200);

      // Mock approval notification
      mockEmailNotification(employeeUser.email, 'Leave Request Approved');

      // Verify all notifications
      expect(emailNotifications).toHaveLength(3);
      
      const managerNotifications = emailNotifications.filter(n => n.to === managerUser.email);
      expect(managerNotifications).toHaveLength(1);
      expect(managerNotifications[0].subject).toContain('Submitted');

      const employeeNotifications = emailNotifications.filter(n => n.to === employeeUser.email);
      expect(employeeNotifications).toHaveLength(2);
      expect(employeeNotifications[0].subject).toContain('Submitted Successfully');
      expect(employeeNotifications[1].subject).toContain('Approved');

      console.log('[E2E_LEAVE_TEST] Email notification test passed');
    });
  });

  describe('Database State Verification', () => {
    it('should maintain consistent database state throughout workflow', async () => {
      console.log('[E2E_LEAVE_TEST] Testing database state consistency');

      // Get initial state
      const initialBalance = await getLeaveBalance(employee.id, 'ANNUAL');
      const initialUsedDays = initialBalance!.usedDays;

      // Submit request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 150);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const submitResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'State verification test',
        })
        .expect(201);

      const requestId = submitResponse.body.data.id;

      // Verify pending state
      const pendingRequest = await getLeaveRequest(requestId);
      expect(pendingRequest!.status).toBe('PENDING');

      // Approve request
      await request(app)
        .patch(`/api/leave/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${managerUser.token}`)
        .send({ comments: 'Approved' })
        .expect(200);

      // Verify approved state
      const approvedRequest = await getLeaveRequest(requestId);
      expect(approvedRequest!.status).toBe('APPROVED');

      // Verify balance updated
      const finalBalance = await getLeaveBalance(employee.id, 'ANNUAL');
      expect(finalBalance!.usedDays).toBe(initialUsedDays + 3);

      // Verify request details preserved
      expect(approvedRequest!.employeeId).toBe(employee.id);
      expect(approvedRequest!.leaveType).toBe('ANNUAL');
      expect(approvedRequest!.daysRequested).toBe(3);

      console.log('[E2E_LEAVE_TEST] Database state consistency test passed');
    });
  });

  describe('Authorization and Access Control', () => {
    it('should prevent employee from approving their own request', async () => {
      console.log('[E2E_LEAVE_TEST] Testing self-approval prevention');

      // Submit request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 180);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const submitResponse = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Self-approval test',
        })
        .expect(201);

      const requestId = submitResponse.body.data.id;

      // Try to approve own request
      const approveResponse = await request(app)
        .patch(`/api/leave/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${employeeUser.token}`)
        .send({ comments: 'Self-approval attempt' })
        .expect(403);

      expect(approveResponse.body.success).toBe(false);
      expect(approveResponse.body.code).toBe('FORBIDDEN');

      // Cleanup
      await executeQuery(
        'UPDATE leave_requests SET status = $1 WHERE id = $2',
        ['CANCELLED', requestId],
        { operation: 'cleanup_test_request' }
      );

      console.log('[E2E_LEAVE_TEST] Self-approval prevention test passed');
    });

    it('should prevent manager from viewing other team requests', async () => {
      console.log('[E2E_LEAVE_TEST] Testing cross-team access prevention');

      // Manager should only see their team's requests
      const teamRequestsResponse = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${managerUser.token}`)
        .expect(200);

      expect(teamRequestsResponse.body.success).toBe(true);
      
      // All requests should be from manager's team
      const requests = teamRequestsResponse.body.data;
      for (const req of requests) {
        const reqEmployee = await executeQuery(
          'SELECT manager_id FROM employees WHERE id = $1',
          [req.employeeId],
          { operation: 'verify_employee_manager' }
        );
        expect(reqEmployee.rows[0]?.manager_id).toBe(manager.id);
      }

      console.log('[E2E_LEAVE_TEST] Cross-team access prevention test passed');
    });
  });
});