/**
 * Leave Service Unit Tests
 * 
 * Comprehensive test suite for LeaveService covering all business logic,
 * validation rules, error handling, and edge cases.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { PoolClient } from 'pg';
import { LeaveService } from '../../../src/services/leave.service.js';
import * as dbModule from '../../../src/db/index.js';
import * as emailServiceModule from '../../../src/services/email.service.js';
import {
  LeaveType,
  LeaveStatus,
  type LeaveRequest,
  type LeaveBalance,
  type SubmitLeaveRequest,
  type ApproveLeaveRequest,
  type RejectLeaveRequest,
  type LeaveBalanceSummary,
} from '../../../src/types/leave.js';

// Mock modules
vi.mock('../../../src/db/index.js');
vi.mock('../../../src/services/email.service.js');

describe('LeaveService', () => {
  let leaveService: LeaveService;
  let mockQueryOne: Mock;
  let mockQueryMany: Mock;
  let mockExecuteTransaction: Mock;
  let mockEmailService: {
    sendEmail: Mock;
  };

  const mockDate = new Date('2024-01-15T10:00:00Z');
  const mockEmployeeId = 'emp-123';
  const mockManagerId = 'mgr-456';
  const mockRequestId = 'req-789';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    // Setup database mocks
    mockQueryOne = vi.fn();
    mockQueryMany = vi.fn();
    mockExecuteTransaction = vi.fn();

    vi.mocked(dbModule.queryOne).mockImplementation(mockQueryOne);
    vi.mocked(dbModule.queryMany).mockImplementation(mockQueryMany);
    vi.mocked(dbModule.executeTransaction).mockImplementation(mockExecuteTransaction);

    // Setup email service mock
    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123', attempts: 1 }),
    };

    vi.mocked(emailServiceModule.getEmailService).mockReturnValue(mockEmailService as any);

    // Create service instance
    leaveService = new LeaveService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createLeaveRequest', () => {
    const validRequest: SubmitLeaveRequest = {
      employeeId: mockEmployeeId,
      leaveType: LeaveType.Annual,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-05'),
      reason: 'Family vacation',
    };

    const mockEmployee = {
      id: mockEmployeeId,
      user_id: 'user-123',
      manager_id: mockManagerId,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      job_title: 'Software Engineer',
    };

    const mockManager = {
      id: mockManagerId,
      user_id: 'user-456',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
    };

    const mockLeaveBalance = {
      id: 'bal-123',
      employee_id: mockEmployeeId,
      annual_leave_total: 20,
      annual_leave_used: 5,
      sick_leave_total: 10,
      sick_leave_used: 2,
      year: 2024,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should create leave request successfully', async () => {
      // Mock validation checks
      mockQueryMany.mockResolvedValueOnce([]); // No overlapping requests
      mockQueryOne
        .mockResolvedValueOnce(mockLeaveBalance) // Balance check
        .mockResolvedValueOnce(mockEmployee) // Employee details
        .mockResolvedValueOnce(mockManager); // Manager details

      // Mock transaction
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              leave_type: LeaveType.Annual,
              start_date: validRequest.startDate,
              end_date: validRequest.endDate,
              days_count: 5,
              reason: validRequest.reason,
              status: LeaveStatus.Pending,
              approved_by: null,
              approved_at: null,
              rejection_reason: null,
              created_at: mockDate,
              updated_at: mockDate,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      const result = await leaveService.createLeaveRequest(validRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(mockRequestId);
      expect(result.data?.status).toBe(LeaveStatus.Pending);
      expect(result.data?.daysCount).toBe(5);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockManager.email,
          subject: expect.stringContaining('Leave Request Submitted'),
        })
      );
    });

    it('should fail with insufficient balance', async () => {
      const insufficientBalance = {
        ...mockLeaveBalance,
        annual_leave_used: 18, // Only 2 days remaining
      };

      mockQueryMany.mockResolvedValueOnce([]); // No overlapping requests
      mockQueryOne.mockResolvedValueOnce(insufficientBalance); // Balance check

      const result = await leaveService.createLeaveRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient leave balance');
      expect(result.errorCode).toBe('INSUFFICIENT_BALANCE');
      expect(mockExecuteTransaction).not.toHaveBeenCalled();
    });

    it('should fail with invalid dates (end before start)', async () => {
      const invalidRequest = {
        ...validRequest,
        startDate: new Date('2024-02-05'),
        endDate: new Date('2024-02-01'),
      };

      const result = await leaveService.createLeaveRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('End date must be after start date');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with past dates', async () => {
      const pastRequest = {
        ...validRequest,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
      };

      const result = await leaveService.createLeaveRequest(pastRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Start date must be in the future');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with overlapping requests', async () => {
      const overlappingRequest = {
        id: 'req-existing',
        employee_id: mockEmployeeId,
        status: LeaveStatus.Approved,
        start_date: new Date('2024-02-03'),
        end_date: new Date('2024-02-07'),
      };

      mockQueryMany.mockResolvedValueOnce([overlappingRequest]); // Overlapping request found

      const result = await leaveService.createLeaveRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('overlaps with existing approved request');
      expect(result.errorCode).toBe('OVERLAPPING_REQUEST');
    });

    it('should fail with empty reason', async () => {
      const invalidRequest = {
        ...validRequest,
        reason: '',
      };

      const result = await leaveService.createLeaveRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reason is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with reason exceeding max length', async () => {
      const invalidRequest = {
        ...validRequest,
        reason: 'a'.repeat(501),
      };

      const result = await leaveService.createLeaveRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reason must not exceed 500 characters');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle employee not found', async () => {
      mockQueryMany.mockResolvedValueOnce([]);
      mockQueryOne
        .mockResolvedValueOnce(mockLeaveBalance)
        .mockResolvedValueOnce(null); // Employee not found

      const result = await leaveService.createLeaveRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
      expect(result.errorCode).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should create unpaid leave without balance check', async () => {
      const unpaidRequest = {
        ...validRequest,
        leaveType: LeaveType.Unpaid,
      };

      mockQueryMany.mockResolvedValueOnce([]);
      mockQueryOne
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockManager);

      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              leave_type: LeaveType.Unpaid,
              start_date: unpaidRequest.startDate,
              end_date: unpaidRequest.endDate,
              days_count: 5,
              reason: unpaidRequest.reason,
              status: LeaveStatus.Pending,
              approved_by: null,
              approved_at: null,
              rejection_reason: null,
              created_at: mockDate,
              updated_at: mockDate,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      const result = await leaveService.createLeaveRequest(unpaidRequest);

      expect(result.success).toBe(true);
      expect(result.data?.leaveType).toBe(LeaveType.Unpaid);
    });

    it('should handle email notification failure gracefully', async () => {
      mockQueryMany.mockResolvedValueOnce([]);
      mockQueryOne
        .mockResolvedValueOnce(mockLeaveBalance)
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockManager);

      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              leave_type: LeaveType.Annual,
              start_date: validRequest.startDate,
              end_date: validRequest.endDate,
              days_count: 5,
              reason: validRequest.reason,
              status: LeaveStatus.Pending,
              approved_by: null,
              approved_at: null,
              rejection_reason: null,
              created_at: mockDate,
              updated_at: mockDate,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      const result = await leaveService.createLeaveRequest(validRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getLeaveRequest', () => {
    const mockLeaveRecord = {
      id: mockRequestId,
      employee_id: mockEmployeeId,
      leave_type: LeaveType.Annual,
      start_date: new Date('2024-02-01'),
      end_date: new Date('2024-02-05'),
      days_count: 5,
      reason: 'Family vacation',
      status: LeaveStatus.Pending,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      created_at: mockDate,
      updated_at: mockDate,
    };

    it('should retrieve leave request successfully', async () => {
      mockQueryOne
        .mockResolvedValueOnce(mockLeaveRecord)
        .mockResolvedValueOnce({ id: mockEmployeeId, manager_id: mockManagerId });

      const result = await leaveService.getLeaveRequest(
        mockRequestId,
        'user-123',
        'EMPLOYEE'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(mockRequestId);
      expect(result.data?.status).toBe(LeaveStatus.Pending);
    });

    it('should fail when request not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await leaveService.getLeaveRequest(
        mockRequestId,
        'user-123',
        'EMPLOYEE'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Leave request not found');
      expect(result.errorCode).toBe('REQUEST_NOT_FOUND');
    });

    it('should fail when unauthorized employee tries to access', async () => {
      mockQueryOne
        .mockResolvedValueOnce(mockLeaveRecord)
        .mockResolvedValueOnce({ id: 'other-emp', manager_id: null });

      const result = await leaveService.getLeaveRequest(
        mockRequestId,
        'user-other',
        'EMPLOYEE'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(result.errorCode).toBe('UNAUTHORIZED');
    });

    it('should allow HR_ADMIN to access any request', async () => {
      mockQueryOne.mockResolvedValueOnce(mockLeaveRecord);

      const result = await leaveService.getLeaveRequest(
        mockRequestId,
        'user-admin',
        'HR_ADMIN'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fail with empty request ID', async () => {
      const result = await leaveService.getLeaveRequest(
        '',
        'user-123',
        'EMPLOYEE'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('getMyRequests', () => {
    it('should return employee requests', async () => {
      const mockRequests = [
        {
          id: 'req-1',
          employee_id: mockEmployeeId,
          leave_type: LeaveType.Annual,
          start_date: new Date('2024-02-01'),
          end_date: new Date('2024-02-05'),
          days_count: 5,
          reason: 'Vacation',
          status: LeaveStatus.Approved,
          approved_by: mockManagerId,
          approved_at: mockDate,
          rejection_reason: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
        {
          id: 'req-2',
          employee_id: mockEmployeeId,
          leave_type: LeaveType.Sick,
          start_date: new Date('2024-03-01'),
          end_date: new Date('2024-03-02'),
          days_count: 2,
          reason: 'Medical',
          status: LeaveStatus.Pending,
          approved_by: null,
          approved_at: null,
          rejection_reason: null,
          created_at: mockDate,
          updated_at: mockDate,
        },
      ];

      mockQueryMany.mockResolvedValueOnce(mockRequests);

      const result = await leaveService.getMyRequests(mockEmployeeId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.id).toBe('req-1');
      expect(result.data?.[1]?.id).toBe('req-2');
    });

    it('should return empty list when no requests', async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      const result = await leaveService.getMyRequests(mockEmployeeId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail with empty employee ID', async () => {
      const result = await leaveService.getMyRequests('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('getTeamRequests', () => {
    it('should return team requests for manager', async () => {
      const mockTeamRequests = [
        {
          id: 'req-1',
          employee_id: mockEmployeeId,
          leave_type: LeaveType.Annual,
          start_date: new Date('2024-02-01'),
          end_date: new Date('2024-02-05'),
          days_count: 5,
          reason: 'Vacation',
          status: LeaveStatus.Pending,
          approved_by: null,
          approved_at: null,
          rejection_reason: null,
          created_at: mockDate,
          updated_at: mockDate,
          employee_first_name: 'John',
          employee_last_name: 'Doe',
          employee_email: 'john.doe@example.com',
          employee_job_title: 'Software Engineer',
          approver_first_name: null,
          approver_last_name: null,
          approver_email: null,
        },
      ];

      mockQueryMany.mockResolvedValueOnce(mockTeamRequests);

      const result = await leaveService.getTeamRequests(mockManagerId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.employee.firstName).toBe('John');
    });

    it('should return empty list for manager with no team', async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      const result = await leaveService.getTeamRequests(mockManagerId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fail with empty manager ID', async () => {
      const result = await leaveService.getTeamRequests('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Manager ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('approveRequest', () => {
    const approveRequest: ApproveLeaveRequest = {
      requestId: mockRequestId,
      approverId: mockManagerId,
    };

    it('should approve request and update balance successfully', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                id: mockRequestId,
                employee_id: mockEmployeeId,
                leave_type: LeaveType.Annual,
                start_date: new Date('2024-02-01'),
                end_date: new Date('2024-02-05'),
                days_count: 5,
                reason: 'Vacation',
                status: LeaveStatus.Pending,
                approved_by: null,
                approved_at: null,
                rejection_reason: null,
                created_at: mockDate,
                updated_at: mockDate,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                id: mockRequestId,
                employee_id: mockEmployeeId,
                leave_type: LeaveType.Annual,
                start_date: new Date('2024-02-01'),
                end_date: new Date('2024-02-05'),
                days_count: 5,
                reason: 'Vacation',
                status: LeaveStatus.Approved,
                approved_by: mockManagerId,
                approved_at: mockDate,
                rejection_reason: null,
                created_at: mockDate,
                updated_at: mockDate,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{ id: 'bal-123' }],
            }),
        };
        return callback(mockClient as any);
      });

      mockQueryOne
        .mockResolvedValueOnce({ manager_id: mockManagerId })
        .mockResolvedValueOnce({
          id: mockEmployeeId,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
        });

      const result = await leaveService.approveRequest(approveRequest);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(LeaveStatus.Approved);
      expect(result.data?.approvedBy).toBe(mockManagerId);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('should fail when approver is not manager', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              leave_type: LeaveType.Annual,
              status: LeaveStatus.Pending,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      mockQueryOne.mockResolvedValueOnce({ manager_id: 'other-manager' });

      const result = await leaveService.approveRequest(approveRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not the employee\\'s manager');
    });

    it('should fail with invalid status transition', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              status: LeaveStatus.Approved,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      const result = await leaveService.approveRequest(approveRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it('should fail with empty request ID', async () => {
      const result = await leaveService.approveRequest({
        requestId: '',
        approverId: mockManagerId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with empty approver ID', async () => {
      const result = await leaveService.approveRequest({
        requestId: mockRequestId,
        approverId: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Approver ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('rejectRequest', () => {
    const rejectRequest: RejectLeaveRequest = {
      requestId: mockRequestId,
      approverId: mockManagerId,
      rejectionReason: 'Insufficient staffing during requested period',
    };

    it('should reject request successfully', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                id: mockRequestId,
                employee_id: mockEmployeeId,
                leave_type: LeaveType.Annual,
                status: LeaveStatus.Pending,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                id: mockRequestId,
                employee_id: mockEmployeeId,
                leave_type: LeaveType.Annual,
                start_date: new Date('2024-02-01'),
                end_date: new Date('2024-02-05'),
                days_count: 5,
                reason: 'Vacation',
                status: LeaveStatus.Rejected,
                approved_by: mockManagerId,
                approved_at: mockDate,
                rejection_reason: rejectRequest.rejectionReason,
                created_at: mockDate,
                updated_at: mockDate,
              }],
            }),
        };
        return callback(mockClient as any);
      });

      mockQueryOne
        .mockResolvedValueOnce({ manager_id: mockManagerId })
        .mockResolvedValueOnce({
          id: mockEmployeeId,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
        });

      const result = await leaveService.rejectRequest(rejectRequest);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(LeaveStatus.Rejected);
      expect(result.data?.rejectionReason).toBe(rejectRequest.rejectionReason);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('should fail with empty rejection reason', async () => {
      const result = await leaveService.rejectRequest({
        requestId: mockRequestId,
        approverId: mockManagerId,
        rejectionReason: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rejection reason is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail when approver is not manager', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              status: LeaveStatus.Pending,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      mockQueryOne.mockResolvedValueOnce({ manager_id: 'other-manager' });

      const result = await leaveService.rejectRequest(rejectRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not the employee\\'s manager');
    });

    it('should fail with invalid status transition', async () => {
      mockExecuteTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [{
              id: mockRequestId,
              employee_id: mockEmployeeId,
              status: LeaveStatus.Rejected,
            }],
          }),
        };
        return callback(mockClient as any);
      });

      const result = await leaveService.rejectRequest(rejectRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });
  });

  describe('getMyBalance', () => {
    const mockBalanceRecord = {
      id: 'bal-123',
      employee_id: mockEmployeeId,
      annual_leave_total: 20,
      annual_leave_used: 5,
      sick_leave_total: 10,
      sick_leave_used: 2,
      year: 2024,
      created_at: mockDate,
      updated_at: mockDate,
    };

    it('should return leave balance successfully', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBalanceRecord);

      const result = await leaveService.getMyBalance(mockEmployeeId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.annualLeave.total).toBe(20);
      expect(result.data?.annualLeave.used).toBe(5);
      expect(result.data?.annualLeave.remaining).toBe(15);
      expect(result.data?.sickLeave.total).toBe(10);
      expect(result.data?.sickLeave.used).toBe(2);
      expect(result.data?.sickLeave.remaining).toBe(8);
    });

    it('should fail when balance not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await leaveService.getMyBalance(mockEmployeeId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Leave balance not found');
      expect(result.errorCode).toBe('BALANCE_NOT_FOUND');
    });

    it('should fail with empty employee ID', async () => {
      const result = await leaveService.getMyBalance('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee ID is required');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should use specified year', async () => {
      mockQueryOne.mockResolvedValueOnce(mockBalanceRecord);

      const result = await leaveService.getMyBalance(mockEmployeeId, 2023);

      expect(result.success).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        [mockEmployeeId, 2023],
        expect.any(Object)
      );
    });
  });

  describe('calculateAvailableBalance', () => {
    it('should calculate correct remaining balance for annual leave', async () => {
      const balance: LeaveBalance = {
        id: 'bal-123',
        employeeId: mockEmployeeId,
        annualLeaveTotal: 20,
        annualLeaveUsed: 5,
        sickLeaveTotal: 10,
        sickLeaveUsed: 2,
        year: 2024,
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      const summary = createBalanceSummary(balance);

      expect(summary.annualLeave.remaining).toBe(15);
      expect(summary.sickLeave.remaining).toBe(8);
    });

    it('should handle zero balance correctly', async () => {
      const balance: LeaveBalance = {
        id: 'bal-123',
        employeeId: mockEmployeeId,
        annualLeaveTotal: 10,
        annualLeaveUsed: 10,
        sickLeaveTotal: 5,
        sickLeaveUsed: 5,
        year: 2024,
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      const summary = createBalanceSummary(balance);

      expect(summary.annualLeave.remaining).toBe(0);
      expect(summary.sickLeave.remaining).toBe(0);
    });

    it('should handle full balance correctly', async () => {
      const balance: LeaveBalance = {
        id: 'bal-123',
        employeeId: mockEmployeeId,
        annualLeaveTotal: 20,
        annualLeaveUsed: 0,
        sickLeaveTotal: 10,
        sickLeaveUsed: 0,
        year: 2024,
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      const summary = createBalanceSummary(balance);

      expect(summary.annualLeave.remaining).toBe(20);
      expect(summary.sickLeave.remaining).toBe(10);
    });
  });

  describe('validateLeaveRequest', () => {
    it('should validate valid request', async () => {
      const validRequest: SubmitLeaveRequest = {
        employeeId: mockEmployeeId,
        leaveType: LeaveType.Annual,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-05'),
        reason: 'Family vacation',
      };

      mockQueryMany.mockResolvedValueOnce([]);
      mockQueryOne.mockResolvedValueOnce({
        id: 'bal-123',
        employee_id: mockEmployeeId,
        annual_leave_total: 20,
        annual_leave_used: 5,
        sick_leave_total: 10,
        sick_leave_used: 2,
        year: 2024,
        created_at: mockDate,
        updated_at: mockDate,
      });

      const result = await (leaveService as any).validateLeaveRequest(validRequest, 'test-cid');

      expect(result.success).toBe(true);
    });

    it('should detect overlapping requests', async () => {
      const request: SubmitLeaveRequest = {
        employeeId: mockEmployeeId,
        leaveType: LeaveType.Annual,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-05'),
        reason: 'Vacation',
      };

      mockQueryMany.mockResolvedValueOnce([{
        id: 'req-existing',
        employee_id: mockEmployeeId,
        status: LeaveStatus.Approved,
        start_date: new Date('2024-02-03'),
        end_date: new Date('2024-02-07'),
      }]);

      const result = await (leaveService as any).validateLeaveRequest(request, 'test-cid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('overlaps');
    });
  });

  describe('checkOverlappingRequests', () => {
    it('should detect overlapping requests correctly', async () => {
      mockQueryMany.mockResolvedValueOnce([{
        id: 'req-existing',
        employee_id: mockEmployeeId,
        status: LeaveStatus.Approved,
        start_date: new Date('2024-02-03'),
        end_date: new Date('2024-02-07'),
      }]);

      const hasOverlap = await (leaveService as any).checkOverlappingRequests(
        mockEmployeeId,
        new Date('2024-02-01'),
        new Date('2024-02-05'),
        'test-cid'
      );

      expect(hasOverlap).toBe(true);
    });

    it('should return false when no overlaps', async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      const hasOverlap = await (leaveService as any).checkOverlappingRequests(
        mockEmployeeId,
        new Date('2024-02-01'),
        new Date('2024-02-05'),
        'test-cid'
      );

      expect(hasOverlap).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockQueryMany.mockRejectedValueOnce(new Error('Database error'));

      const hasOverlap = await (leaveService as any).checkOverlappingRequests(
        mockEmployeeId,
        new Date('2024-02-01'),
        new Date('2024-02-05'),
        'test-cid'
      );

      expect(hasOverlap).toBe(false);
    });
  });

  describe('updateLeaveBalance', () => {
    it('should update annual leave balance correctly', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ id: 'bal-123' }],
        }),
      } as unknown as PoolClient;

      await (leaveService as any).updateLeaveBalance(
        mockClient,
        mockEmployeeId,
        LeaveType.Annual,
        5,
        'test-cid'
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('annual_leave_used'),
        expect.arrayContaining([5, expect.any(Date), mockEmployeeId, 2024])
      );
    });

    it('should update sick leave balance correctly', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ id: 'bal-123' }],
        }),
      } as unknown as PoolClient;

      await (leaveService as any).updateLeaveBalance(
        mockClient,
        mockEmployeeId,
        LeaveType.Sick,
        3,
        'test-cid'
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('sick_leave_used'),
        expect.arrayContaining([3, expect.any(Date), mockEmployeeId, 2024])
      );
    });

    it('should skip balance update for unpaid leave', async () => {
      const mockClient = {
        query: vi.fn(),
      } as unknown as PoolClient;

      await (leaveService as any).updateLeaveBalance(
        mockClient,
        mockEmployeeId,
        LeaveType.Unpaid,
        5,
        'test-cid'
      );

      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it