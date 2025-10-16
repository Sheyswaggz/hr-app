/**
 * Leave Authorization Integration Tests
 * 
 * Comprehensive test suite verifying role-based access control for leave management endpoints.
 * Tests authorization rules for employees, managers, and HR admins across all leave operations.
 * 
 * Test Coverage:
 * - Employee can create leave requests
 * - Employee can view own requests only
 * - Manager can view team requests only
 * - Manager can approve/reject team member requests only
 * - Employee cannot approve/reject requests
 * - Manager cannot approve requests for employees outside their team
 * - HR Admin has full access to all operations
 * 
 * @module tests/integration/leave.authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { type Application } from 'express';
import { createApp } from '../../src/app.js';
import { getPool, executeQuery, executeTransaction } from '../../src/db/index.js';
import { hashPassword } from '../../src/utils/password.js';
import { generateAccessToken } from '../../src/utils/jwt.js';
import crypto from 'crypto';

/**
 * Test user data structure
 */
interface TestUser {
  id: string;
  userId: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN';
  token: string;
  employeeId: string;
  managerId?: string;
}

/**
 * Test leave request data structure
 */
interface TestLeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

describe('Leave Authorization Integration Tests', () => {
  let app: Application;
  let employee1: TestUser;
  let employee2: TestUser;
  let manager1: TestUser;
  let manager2: TestUser;
  let hrAdmin: TestUser;
  let leaveRequest1: TestLeaveRequest;
  let leaveRequest2: TestLeaveRequest;

  /**
   * Setup test application and database
   */
  beforeAll(async () => {
    console.log('[LEAVE_AUTH_TEST] Setting up test environment');
    
    // Create Express application
    app = createApp();

    // Ensure database connection
    const pool = getPool();
    await pool.query('SELECT 1');

    console.log('[LEAVE_AUTH_TEST] Test environment setup complete');
  });

  /**
   * Cleanup test data and close connections
   */
  afterAll(async () => {
    console.log('[LEAVE_AUTH_TEST] Cleaning up test environment');

    try {
      // Clean up test data
      await executeQuery(
        `DELETE FROM leave_requests WHERE employee_id IN (
          SELECT id FROM employees WHERE user_id IN (
            SELECT id FROM users WHERE email LIKE '%@test-leave-auth.com'
          )
        )`,
        [],
        { operation: 'cleanup_leave_requests' }
      );

      await executeQuery(
        `DELETE FROM leave_balances WHERE employee_id IN (
          SELECT id FROM employees WHERE user_id IN (
            SELECT id FROM users WHERE email LIKE '%@test-leave-auth.com'
          )
        )`,
        [],
        { operation: 'cleanup_leave_balances' }
      );

      await executeQuery(
        `DELETE FROM employees WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE '%@test-leave-auth.com'
        )`,
        [],
        { operation: 'cleanup_employees' }
      );

      await executeQuery(
        `DELETE FROM users WHERE email LIKE '%@test-leave-auth.com'`,
        [],
        { operation: 'cleanup_users' }
      );

      console.log('[LEAVE_AUTH_TEST] Test data cleaned up successfully');
    } catch (error) {
      console.error('[LEAVE_AUTH_TEST] Cleanup error:', error);
    }
  });

  /**
   * Setup test users and leave requests before each test
   */
  beforeEach(async () => {
    console.log('[LEAVE_AUTH_TEST] Setting up test data');

    const timestamp = new Date();
    const passwordHash = (await hashPassword('Test123!@#')).hash!;

    await executeTransaction(async (client) => {
      // Create Manager 1
      const manager1UserId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          manager1UserId,
          'manager1@test-leave-auth.com',
          passwordHash,
          'Manager',
          'One',
          'MANAGER',
          true,
          timestamp,
          timestamp,
        ]
      );

      const manager1EmployeeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          manager1EmployeeId,
          manager1UserId,
          'MGR001',
          'Team Manager',
          'dept-1',
          timestamp,
          'ACTIVE',
          timestamp,
          timestamp,
        ]
      );

      manager1 = {
        id: manager1UserId,
        userId: manager1UserId,
        email: 'manager1@test-leave-auth.com',
        role: 'MANAGER',
        token: generateAccessToken(manager1UserId, 'manager1@test-leave-auth.com', 'MANAGER'),
        employeeId: manager1EmployeeId,
      };

      // Create Manager 2
      const manager2UserId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          manager2UserId,
          'manager2@test-leave-auth.com',
          passwordHash,
          'Manager',
          'Two',
          'MANAGER',
          true,
          timestamp,
          timestamp,
        ]
      );

      const manager2EmployeeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          manager2EmployeeId,
          manager2UserId,
          'MGR002',
          'Team Manager',
          'dept-2',
          timestamp,
          'ACTIVE',
          timestamp,
          timestamp,
        ]
      );

      manager2 = {
        id: manager2UserId,
        userId: manager2UserId,
        email: 'manager2@test-leave-auth.com',
        role: 'MANAGER',
        token: generateAccessToken(manager2UserId, 'manager2@test-leave-auth.com', 'MANAGER'),
        employeeId: manager2EmployeeId,
      };

      // Create Employee 1 (reports to Manager 1)
      const employee1UserId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          employee1UserId,
          'employee1@test-leave-auth.com',
          passwordHash,
          'Employee',
          'One',
          'EMPLOYEE',
          true,
          timestamp,
          timestamp,
        ]
      );

      const employee1EmployeeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          employee1EmployeeId,
          employee1UserId,
          'EMP001',
          'Software Engineer',
          'dept-1',
          manager1EmployeeId,
          timestamp,
          'ACTIVE',
          timestamp,
          timestamp,
        ]
      );

      employee1 = {
        id: employee1UserId,
        userId: employee1UserId,
        email: 'employee1@test-leave-auth.com',
        role: 'EMPLOYEE',
        token: generateAccessToken(employee1UserId, 'employee1@test-leave-auth.com', 'EMPLOYEE'),
        employeeId: employee1EmployeeId,
        managerId: manager1EmployeeId,
      };

      // Create Employee 2 (reports to Manager 2)
      const employee2UserId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          employee2UserId,
          'employee2@test-leave-auth.com',
          passwordHash,
          'Employee',
          'Two',
          'EMPLOYEE',
          true,
          timestamp,
          timestamp,
        ]
      );

      const employee2EmployeeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, manager_id, hire_date, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          employee2EmployeeId,
          employee2UserId,
          'EMP002',
          'Software Engineer',
          'dept-2',
          manager2EmployeeId,
          timestamp,
          'ACTIVE',
          timestamp,
          timestamp,
        ]
      );

      employee2 = {
        id: employee2UserId,
        userId: employee2UserId,
        email: 'employee2@test-leave-auth.com',
        role: 'EMPLOYEE',
        token: generateAccessToken(employee2UserId, 'employee2@test-leave-auth.com', 'EMPLOYEE'),
        employeeId: employee2EmployeeId,
        managerId: manager2EmployeeId,
      };

      // Create HR Admin
      const hrAdminUserId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          hrAdminUserId,
          'hradmin@test-leave-auth.com',
          passwordHash,
          'HR',
          'Admin',
          'HR_ADMIN',
          true,
          timestamp,
          timestamp,
        ]
      );

      const hrAdminEmployeeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO employees (id, user_id, employee_number, job_title, department_id, hire_date, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          hrAdminEmployeeId,
          hrAdminUserId,
          'HR001',
          'HR Administrator',
          'dept-hr',
          timestamp,
          'ACTIVE',
          timestamp,
          timestamp,
        ]
      );

      hrAdmin = {
        id: hrAdminUserId,
        userId: hrAdminUserId,
        email: 'hradmin@test-leave-auth.com',
        role: 'HR_ADMIN',
        token: generateAccessToken(hrAdminUserId, 'hradmin@test-leave-auth.com', 'HR_ADMIN'),
        employeeId: hrAdminEmployeeId,
      };

      // Create leave balances
      await client.query(
        `INSERT INTO leave_balances (id, employee_id, leave_type, total_days, used_days, pending_days, year, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          employee1EmployeeId,
          'ANNUAL',
          20,
          0,
          0,
          new Date().getFullYear(),
          timestamp,
          timestamp,
        ]
      );

      await client.query(
        `INSERT INTO leave_balances (id, employee_id, leave_type, total_days, used_days, pending_days, year, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          employee2EmployeeId,
          'ANNUAL',
          20,
          0,
          0,
          new Date().getFullYear(),
          timestamp,
          timestamp,
        ]
      );

      // Create leave request for Employee 1
      const leaveRequest1Id = crypto.randomUUID();
      const startDate1 = new Date();
      startDate1.setDate(startDate1.getDate() + 7);
      const endDate1 = new Date(startDate1);
      endDate1.setDate(endDate1.getDate() + 4);

      await client.query(
        `INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days_count, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          leaveRequest1Id,
          employee1EmployeeId,
          'ANNUAL',
          startDate1,
          endDate1,
          5,
          'Vacation',
          'PENDING',
          timestamp,
          timestamp,
        ]
      );

      leaveRequest1 = {
        id: leaveRequest1Id,
        employeeId: employee1EmployeeId,
        leaveType: 'ANNUAL',
        startDate: startDate1,
        endDate: endDate1,
        status: 'PENDING',
      };

      // Create leave request for Employee 2
      const leaveRequest2Id = crypto.randomUUID();
      const startDate2 = new Date();
      startDate2.setDate(startDate2.getDate() + 14);
      const endDate2 = new Date(startDate2);
      endDate2.setDate(endDate2.getDate() + 2);

      await client.query(
        `INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days_count, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          leaveRequest2Id,
          employee2EmployeeId,
          'ANNUAL',
          startDate2,
          endDate2,
          3,
          'Personal',
          'PENDING',
          timestamp,
          timestamp,
        ]
      );

      leaveRequest2 = {
        id: leaveRequest2Id,
        employeeId: employee2EmployeeId,
        leaveType: 'ANNUAL',
        startDate: startDate2,
        endDate: endDate2,
        status: 'PENDING',
      };
    });

    console.log('[LEAVE_AUTH_TEST] Test data setup complete');
  });

  describe('POST /api/leave/requests - Create Leave Request', () => {
    it('should allow employee to create leave request', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${employee1.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Family vacation',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.employeeId).toBe(employee1.employeeId);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should allow manager to create leave request', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Conference',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should allow HR admin to create leave request', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app)
        .post('/api/leave/requests')
        .set('Authorization', `Bearer ${hrAdmin.token}`)
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Personal',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request(app)
        .post('/api/leave/requests')
        .send({
          leaveType: 'ANNUAL',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leave/my-requests - View Own Requests', () => {
    it('should allow employee to view own requests', async () => {
      const response = await request(app)
        .get('/api/leave/my-requests')
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Should only see own requests
      const ownRequests = response.body.data.filter(
        (req: any) => req.employeeId === employee1.employeeId
      );
      expect(ownRequests.length).toBe(response.body.data.length);
    });

    it('should not show other employees requests', async () => {
      const response = await request(app)
        .get('/api/leave/my-requests')
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(200);
      
      // Should not contain Employee 2's requests
      const otherRequests = response.body.data.filter(
        (req: any) => req.employeeId === employee2.employeeId
      );
      expect(otherRequests.length).toBe(0);
    });

    it('should allow manager to view own requests', async () => {
      const response = await request(app)
        .get('/api/leave/my-requests')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/leave/team-requests - View Team Requests', () => {
    it('should allow manager to view team member requests', async () => {
      const response = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Should see Employee 1's request (team member)
      const teamRequests = response.body.data.filter(
        (req: any) => req.employeeId === employee1.employeeId
      );
      expect(teamRequests.length).toBeGreaterThan(0);
    });

    it('should not show requests from other teams', async () => {
      const response = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      
      // Should not contain Employee 2's requests (different team)
      const otherTeamRequests = response.body.data.filter(
        (req: any) => req.employeeId === employee2.employeeId
      );
      expect(otherTeamRequests.length).toBe(0);
    });

    it('should reject employee access to team requests', async () => {
      const response = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow HR admin to view all team requests', async () => {
      const response = await request(app)
        .get('/api/leave/team-requests')
        .set('Authorization', `Bearer ${hrAdmin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/leave/requests/:id/approve - Approve Request', () => {
    it('should allow manager to approve team member request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest1.id}/approve`)
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          comments: 'Approved',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should reject manager approving request from other team', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/approve`)
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          comments: 'Approved',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should reject employee approving any request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest1.id}/approve`)
        .set('Authorization', `Bearer ${employee1.token}`)
        .send({
          comments: 'Approved',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow HR admin to approve any request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/approve`)
        .set('Authorization', `Bearer ${hrAdmin.token}`)
        .send({
          comments: 'Approved by HR',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/leave/requests/:id/reject - Reject Request', () => {
    it('should allow manager to reject team member request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest1.id}/reject`)
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          reason: 'Insufficient coverage',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REJECTED');
    });

    it('should reject manager rejecting request from other team', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/reject`)
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          reason: 'Not authorized',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should reject employee rejecting any request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest1.id}/reject`)
        .set('Authorization', `Bearer ${employee1.token}`)
        .send({
          reason: 'Cannot reject',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should allow HR admin to reject any request', async () => {
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/reject`)
        .set('Authorization', `Bearer ${hrAdmin.token}`)
        .send({
          reason: 'Policy violation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/leave/requests/:id - View Specific Request', () => {
    it('should allow employee to view own request', async () => {
      const response = await request(app)
        .get(`/api/leave/requests/${leaveRequest1.id}`)
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(leaveRequest1.id);
    });

    it('should reject employee viewing other employee request', async () => {
      const response = await request(app)
        .get(`/api/leave/requests/${leaveRequest2.id}`)
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow manager to view team member request', async () => {
      const response = await request(app)
        .get(`/api/leave/requests/${leaveRequest1.id}`)
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject manager viewing request from other team', async () => {
      const response = await request(app)
        .get(`/api/leave/requests/${leaveRequest2.id}`)
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should allow HR admin to view any request', async () => {
      const response = await request(app)
        .get(`/api/leave/requests/${leaveRequest1.id}`)
        .set('Authorization', `Bearer ${hrAdmin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/leave/my-balance - View Leave Balance', () => {
    it('should allow employee to view own balance', async () => {
      const response = await request(app)
        .get('/api/leave/my-balance')
        .set('Authorization', `Bearer ${employee1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.employeeId).toBe(employee1.employeeId);
    });

    it('should allow manager to view own balance', async () => {
      const response = await request(app)
        .get('/api/leave/my-balance')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject unauthenticated access', async () => {
      const response = await request(app)
        .get('/api/leave/my-balance');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Cross-Team Authorization Boundaries', () => {
    it('should enforce strict team boundaries for managers', async () => {
      // Manager 1 tries to approve Manager 2's team member request
      const response = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/approve`)
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({
          comments: 'Cross-team approval attempt',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('team');
    });

    it('should allow HR admin to cross team boundaries', async () => {
      // HR Admin can approve any team's requests
      const response1 = await request(app)
        .patch(`/api/leave/requests/${leaveRequest1.id}/approve`)
        .set('Authorization', `Bearer ${hrAdmin.token}`)
        .send({
          comments: 'HR approval',
        });

      expect(response1.status).toBe(200);

      // Reset for next test
      await executeQuery(
        `UPDATE leave_requests SET status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = $1`,
        [leaveRequest1.id]
      );

      const response2 = await request(app)
        .patch(`/api/leave/requests/${leaveRequest2.id}/approve`)
        .set('Authorization', `Bearer ${hrAdmin.token}`)
        .send({
          comments: 'HR approval',
        });

      expect(response2.status).toBe(200);
    });
  });

  describe('Role Hierarchy Enforcement', () => {
    it('should enforce employee cannot access manager endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/leave/team-requests' },
        { method: 'patch', path: `/api/leave/requests/${leaveRequest1.id}/approve` },
        { method: 'patch', path: `/api/leave/requests/${leaveRequest1.id}/reject` },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${employee1.token}`)
          .send({ reason: 'Test', comments: 'Test' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('FORBIDDEN');
      }
    });

    it('should allow manager to access employee endpoints', async () => {
      const response = await request(app)
        .get('/api/leave/my-requests')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow HR admin full access', async () => {
      const endpoints = [
        { method: 'get', path: '/api/leave/my-requests' },
        { method: 'get', path: '/api/leave/team-requests' },
        { method: 'get', path: '/api/leave/my-balance' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${hrAdmin.token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
});

export default describe;