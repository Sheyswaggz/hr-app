/**
 * Leave Management Type Definitions
 * 
 * Comprehensive type system for leave request and approval workflow.
 * Includes leave requests, leave balances, leave types, and validation utilities.
 * 
 * @module types/leave
 */

import type { BaseEntity } from './index.js';

/**
 * Leave type enumeration
 * 
 * Defines the types of leave that can be requested by employees.
 */
export enum LeaveType {
  /**
   * Annual vacation leave
   */
  Annual = 'annual',

  /**
   * Sick leave for medical reasons
   */
  Sick = 'sick',

  /**
   * Unpaid leave
   */
  Unpaid = 'unpaid',

  /**
   * Other types of leave (bereavement, jury duty, etc.)
   */
  Other = 'other',
}

/**
 * Leave request status enumeration
 * 
 * Defines the workflow states for leave requests.
 */
export enum LeaveStatus {
  /**
   * Request is pending manager approval
   */
  Pending = 'pending',

  /**
   * Request has been approved by manager
   */
  Approved = 'approved',

  /**
   * Request has been rejected by manager
   */
  Rejected = 'rejected',
}

/**
 * Leave request entity interface
 * 
 * Represents an employee's leave request with all associated metadata.
 */
export interface LeaveRequest extends BaseEntity {
  /**
   * Employee requesting leave
   */
  employeeId: string;

  /**
   * Type of leave being requested
   */
  leaveType: LeaveType;

  /**
   * Leave start date (inclusive)
   */
  startDate: Date;

  /**
   * Leave end date (inclusive)
   */
  endDate: Date;

  /**
   * Number of days requested (calculated from date range)
   */
  daysCount: number;

  /**
   * Reason for leave request (max 500 characters)
   */
  reason: string;

  /**
   * Current status of the leave request
   */
  status: LeaveStatus;

  /**
   * Manager who approved/rejected the request
   */
  approvedBy?: string;

  /**
   * Timestamp when request was approved/rejected
   */
  approvedAt?: Date;

  /**
   * Reason for rejection (required if status is rejected)
   */
  rejectionReason?: string;
}

/**
 * Leave balance entity interface
 * 
 * Tracks an employee's leave balance for a specific year.
 */
export interface LeaveBalance extends BaseEntity {
  /**
   * Employee identifier
   */
  employeeId: string;

  /**
   * Total annual leave days allocated
   */
  annualLeaveTotal: number;

  /**
   * Annual leave days used (approved requests)
   */
  annualLeaveUsed: number;

  /**
   * Total sick leave days allocated
   */
  sickLeaveTotal: number;

  /**
   * Sick leave days used (approved requests)
   */
  sickLeaveUsed: number;

  /**
   * Year this balance applies to
   */
  year: number;
}

/**
 * Leave request submission data
 * 
 * Data required to submit a new leave request.
 */
export interface SubmitLeaveRequest {
  /**
   * Employee submitting the request
   */
  employeeId: string;

  /**
   * Type of leave
   */
  leaveType: LeaveType;

  /**
   * Leave start date
   */
  startDate: Date;

  /**
   * Leave end date
   */
  endDate: Date;

  /**
   * Reason for leave (max 500 characters)
   */
  reason: string;
}

/**
 * Leave request approval data
 * 
 * Data required to approve a leave request.
 */
export interface ApproveLeaveRequest {
  /**
   * Leave request identifier
   */
  requestId: string;

  /**
   * Manager approving the request
   */
  approverId: string;
}

/**
 * Leave request rejection data
 * 
 * Data required to reject a leave request.
 */
export interface RejectLeaveRequest {
  /**
   * Leave request identifier
   */
  requestId: string;

  /**
   * Manager rejecting the request
   */
  approverId: string;

  /**
   * Reason for rejection (max 500 characters)
   */
  rejectionReason: string;
}

/**
 * Leave balance summary
 * 
 * Summary of an employee's leave balance with remaining days.
 */
export interface LeaveBalanceSummary {
  /**
   * Employee identifier
   */
  employeeId: string;

  /**
   * Year this balance applies to
   */
  year: number;

  /**
   * Annual leave allocation
   */
  annualLeave: {
    /**
     * Total days allocated
     */
    total: number;

    /**
     * Days used (approved requests)
     */
    used: number;

    /**
     * Days remaining
     */
    remaining: number;
  };

  /**
   * Sick leave allocation
   */
  sickLeave: {
    /**
     * Total days allocated
     */
    total: number;

    /**
     * Days used (approved requests)
     */
    used: number;

    /**
     * Days remaining
     */
    remaining: number;
  };
}

/**
 * Leave request with employee details
 * 
 * Extended leave request with employee information for display.
 */
export interface LeaveRequestWithEmployee extends LeaveRequest {
  /**
   * Employee information
   */
  employee: {
    /**
     * Employee ID
     */
    id: string;

    /**
     * Employee first name
     */
    firstName: string;

    /**
     * Employee last name
     */
    lastName: string;

    /**
     * Employee email
     */
    email: string;

    /**
     * Employee job title
     */
    jobTitle?: string;
  };

  /**
   * Approver information (if approved/rejected)
   */
  approver?: {
    /**
     * Approver ID
     */
    id: string;

    /**
     * Approver first name
     */
    firstName: string;

    /**
     * Approver last name
     */
    lastName: string;

    /**
     * Approver email
     */
    email: string;
  };
}

/**
 * Leave validation result
 * 
 * Result of leave request validation with errors.
 */
export interface LeaveValidationResult {
  /**
   * Whether validation passed
   */
  isValid: boolean;

  /**
   * Array of validation errors
   */
  errors: string[];
}

/**
 * Type guard to check if a value is a valid LeaveType
 * 
 * @param value - Value to check
 * @returns True if value is a valid LeaveType
 */
export function isLeaveType(value: unknown): value is LeaveType {
  return (
    typeof value === 'string' &&
    Object.values(LeaveType).includes(value as LeaveType)
  );
}

/**
 * Type guard to check if a value is a valid LeaveStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid LeaveStatus
 */
export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return (
    typeof value === 'string' &&
    Object.values(LeaveStatus).includes(value as LeaveStatus)
  );
}

/**
 * Type guard to check if a value is a valid LeaveRequest
 * 
 * @param value - Value to check
 * @returns True if value is a valid LeaveRequest
 */
export function isLeaveRequest(value: unknown): value is LeaveRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const request = value as Record<string, unknown>;

  return (
    typeof request.id === 'string' &&
    typeof request.employeeId === 'string' &&
    isLeaveType(request.leaveType) &&
    request.startDate instanceof Date &&
    request.endDate instanceof Date &&
    typeof request.daysCount === 'number' &&
    typeof request.reason === 'string' &&
    isLeaveStatus(request.status) &&
    (request.approvedBy === undefined || typeof request.approvedBy === 'string') &&
    (request.approvedAt === undefined || request.approvedAt instanceof Date) &&
    (request.rejectionReason === undefined || typeof request.rejectionReason === 'string') &&
    request.createdAt instanceof Date &&
    request.updatedAt instanceof Date
  );
}

/**
 * Type guard to check if a value is a valid LeaveBalance
 * 
 * @param value - Value to check
 * @returns True if value is a valid LeaveBalance
 */
export function isLeaveBalance(value: unknown): value is LeaveBalance {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const balance = value as Record<string, unknown>;

  return (
    typeof balance.id === 'string' &&
    typeof balance.employeeId === 'string' &&
    typeof balance.annualLeaveTotal === 'number' &&
    typeof balance.annualLeaveUsed === 'number' &&
    typeof balance.sickLeaveTotal === 'number' &&
    typeof balance.sickLeaveUsed === 'number' &&
    typeof balance.year === 'number' &&
    balance.createdAt instanceof Date &&
    balance.updatedAt instanceof Date
  );
}

/**
 * Validate leave request dates
 * 
 * Validates that leave dates are valid and in the correct order.
 * 
 * @param startDate - Leave start date
 * @param endDate - Leave end date
 * @returns Validation result with errors
 */
export function validateLeaveDates(
  startDate: Date,
  endDate: Date
): LeaveValidationResult {
  const errors: string[] = [];

  // Validate date types
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    errors.push('Start date must be a valid date');
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    errors.push('End date must be a valid date');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate date order
  if (startDate > endDate) {
    errors.push('Start date must be before or equal to end date');
  }

  // Validate dates are not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate < today) {
    errors.push('Start date cannot be in the past');
  }

  // Validate date range is reasonable (max 365 days)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    errors.push('Leave period cannot exceed 365 days');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate leave reason
 * 
 * Validates that leave reason meets requirements.
 * 
 * @param reason - Leave reason text
 * @returns Validation result with errors
 */
export function validateLeaveReason(reason: string): LeaveValidationResult {
  const errors: string[] = [];

  if (typeof reason !== 'string') {
    errors.push('Reason must be a string');
    return { isValid: false, errors };
  }

  const trimmed = reason.trim();

  if (trimmed.length === 0) {
    errors.push('Reason is required');
  }

  if (trimmed.length > 500) {
    errors.push('Reason must not exceed 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate rejection reason
 * 
 * Validates that rejection reason meets requirements.
 * 
 * @param reason - Rejection reason text
 * @returns Validation result with errors
 */
export function validateRejectionReason(reason: string): LeaveValidationResult {
  const errors: string[] = [];

  if (typeof reason !== 'string') {
    errors.push('Rejection reason must be a string');
    return { isValid: false, errors };
  }

  const trimmed = reason.trim();

  if (trimmed.length === 0) {
    errors.push('Rejection reason is required');
  }

  if (trimmed.length > 500) {
    errors.push('Rejection reason must not exceed 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate days count from date range
 * 
 * Calculates the number of days between start and end dates (inclusive).
 * For MVP, counts all days including weekends and holidays.
 * 
 * @param startDate - Leave start date
 * @param endDate - Leave end date
 * @returns Number of days in the range
 */
export function calculateDaysCount(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Reset time to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Add 1 to include both start and end dates
  return diffDays + 1;
}

/**
 * Calculate remaining leave balance
 * 
 * Calculates remaining leave days for a specific leave type.
 * 
 * @param balance - Leave balance record
 * @param leaveType - Type of leave
 * @returns Remaining days for the leave type
 */
export function calculateRemainingBalance(
  balance: LeaveBalance,
  leaveType: LeaveType
): number {
  switch (leaveType) {
    case LeaveType.Annual:
      return Math.max(0, balance.annualLeaveTotal - balance.annualLeaveUsed);
    case LeaveType.Sick:
      return Math.max(0, balance.sickLeaveTotal - balance.sickLeaveUsed);
    case LeaveType.Unpaid:
    case LeaveType.Other:
      // Unpaid and other leave types have no balance limit
      return Infinity;
    default:
      return 0;
  }
}

/**
 * Check if employee has sufficient leave balance
 * 
 * Validates that employee has enough leave days for the request.
 * 
 * @param balance - Leave balance record
 * @param leaveType - Type of leave
 * @param daysRequested - Number of days requested
 * @returns True if sufficient balance exists
 */
export function hasSufficientBalance(
  balance: LeaveBalance,
  leaveType: LeaveType,
  daysRequested: number
): boolean {
  const remaining = calculateRemainingBalance(balance, leaveType);
  return remaining >= daysRequested;
}

/**
 * Validate leave request status transition
 * 
 * Validates that a status transition is allowed.
 * 
 * @param currentStatus - Current leave request status
 * @param newStatus - New status to transition to
 * @returns Validation result with errors
 */
export function validateStatusTransition(
  currentStatus: LeaveStatus,
  newStatus: LeaveStatus
): LeaveValidationResult {
  const errors: string[] = [];

  // Define valid transitions
  const validTransitions: Record<LeaveStatus, LeaveStatus[]> = {
    [LeaveStatus.Pending]: [LeaveStatus.Approved, LeaveStatus.Rejected],
    [LeaveStatus.Approved]: [], // No transitions from approved
    [LeaveStatus.Rejected]: [], // No transitions from rejected
  };

  const allowedTransitions = validTransitions[currentStatus];

  if (!allowedTransitions.includes(newStatus)) {
    errors.push(
      `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
      `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none'}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create leave balance summary
 * 
 * Creates a summary of leave balance with calculated remaining days.
 * 
 * @param balance - Leave balance record
 * @returns Leave balance summary
 */
export function createBalanceSummary(balance: LeaveBalance): LeaveBalanceSummary {
  return {
    employeeId: balance.employeeId,
    year: balance.year,
    annualLeave: {
      total: balance.annualLeaveTotal,
      used: balance.annualLeaveUsed,
      remaining: Math.max(0, balance.annualLeaveTotal - balance.annualLeaveUsed),
    },
    sickLeave: {
      total: balance.sickLeaveTotal,
      used: balance.sickLeaveUsed,
      remaining: Math.max(0, balance.sickLeaveTotal - balance.sickLeaveUsed),
    },
  };
}

/**
 * Utility type for creating new leave requests
 */
export type CreateLeaveRequestPayload = Omit<
  LeaveRequest,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'approvedBy' | 'approvedAt' | 'rejectionReason'
>;

/**
 * Utility type for updating leave requests
 */
export type UpdateLeaveRequestPayload = Partial<
  Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'employeeId'>
>;

/**
 * Utility type for creating leave balances
 */
export type CreateLeaveBalancePayload = Omit<
  LeaveBalance,
  'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Utility type for updating leave balances
 */
export type UpdateLeaveBalancePayload = Partial<
  Omit<LeaveBalance, 'id' | 'createdAt' | 'updatedAt' | 'employeeId' | 'year'>
>;