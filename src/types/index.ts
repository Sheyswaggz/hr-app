/**
 * Central type definitions for the HR application
 * 
 * This module exports core TypeScript interfaces, types, and enums used throughout
 * the application. It provides type safety for user roles, authentication, and
 * common entity structures.
 * 
 * @module types
 */

/**
 * User role enumeration
 * 
 * Defines the three primary roles in the HR application with strict type safety.
 * These roles are used for authorization and access control throughout the system.
 */
export enum UserRole {
  /**
   * HR Administrator - Full system access including employee management,
   * performance reviews, and system configuration
   */
  HRAdmin = 'HR_ADMIN',

  /**
   * Manager - Access to team management, performance reviews for direct reports,
   * and leave approval capabilities
   */
  Manager = 'MANAGER',

  /**
   * Employee - Basic access to personal information, leave requests,
   * and performance review viewing
   */
  Employee = 'EMPLOYEE',
}

/**
 * Base entity interface with common fields
 * 
 * All domain entities should extend this interface to ensure consistent
 * identification and audit trail capabilities.
 */
export interface BaseEntity {
  /**
   * Unique identifier for the entity
   */
  readonly id: string;

  /**
   * Timestamp when the entity was created
   */
  readonly createdAt: Date;

  /**
   * Timestamp when the entity was last updated
   */
  readonly updatedAt: Date;
}

/**
 * User entity interface
 * 
 * Represents a user in the HR system with authentication and profile information.
 */
export interface User extends BaseEntity {
  /**
   * User's email address (used for authentication)
   */
  email: string;

  /**
   * User's first name
   */
  firstName: string;

  /**
   * User's last name
   */
  lastName: string;

  /**
   * User's role in the system
   */
  role: UserRole;

  /**
   * Whether the user account is active
   */
  isActive: boolean;

  /**
   * Optional department identifier
   */
  departmentId?: string;

  /**
   * Optional manager identifier (for employees and managers)
   */
  managerId?: string;
}

/**
 * Authentication token payload
 * 
 * Represents the decoded JWT token payload used for authentication.
 */
export interface AuthTokenPayload {
  /**
   * User identifier
   */
  userId: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * User's role
   */
  role: UserRole;

  /**
   * Token issued at timestamp (Unix epoch)
   */
  iat: number;

  /**
   * Token expiration timestamp (Unix epoch)
   */
  exp: number;
}

/**
 * Department entity interface
 * 
 * Represents an organizational department within the company.
 */
export interface Department extends BaseEntity {
  /**
   * Department name
   */
  name: string;

  /**
   * Department description
   */
  description: string;

  /**
   * Department head user identifier
   */
  headId?: string;

  /**
   * Whether the department is active
   */
  isActive: boolean;
}

/**
 * Employee entity interface
 * 
 * Represents detailed employee information extending the base User.
 */
export interface Employee extends BaseEntity {
  /**
   * Associated user identifier
   */
  userId: string;

  /**
   * Employee number (unique identifier for HR purposes)
   */
  employeeNumber: string;

  /**
   * Job title
   */
  jobTitle: string;

  /**
   * Department identifier
   */
  departmentId: string;

  /**
   * Manager identifier
   */
  managerId?: string;

  /**
   * Date of hire
   */
  hireDate: Date;

  /**
   * Employment status
   */
  status: EmploymentStatus;

  /**
   * Work location
   */
  location?: string;

  /**
   * Phone number
   */
  phoneNumber?: string;
}

/**
 * Employment status enumeration
 * 
 * Defines possible employment statuses for employees.
 */
export enum EmploymentStatus {
  /**
   * Active full-time employee
   */
  Active = 'ACTIVE',

  /**
   * Employee on leave
   */
  OnLeave = 'ON_LEAVE',

  /**
   * Employee on probation period
   */
  Probation = 'PROBATION',

  /**
   * Terminated employee
   */
  Terminated = 'TERMINATED',

  /**
   * Resigned employee
   */
  Resigned = 'RESIGNED',
}

/**
 * Performance review entity interface
 * 
 * Represents a performance review record for an employee.
 */
export interface PerformanceReview extends BaseEntity {
  /**
   * Employee being reviewed
   */
  employeeId: string;

  /**
   * Reviewer (manager) identifier
   */
  reviewerId: string;

  /**
   * Review period start date
   */
  periodStart: Date;

  /**
   * Review period end date
   */
  periodEnd: Date;

  /**
   * Overall rating (1-5 scale)
   */
  rating?: number;

  /**
   * Review status
   */
  status: ReviewStatus;

  /**
   * Review comments
   */
  comments?: string;

  /**
   * Date when review was submitted
   */
  submittedAt?: Date;
}

/**
 * Review status enumeration
 * 
 * Defines the workflow states for performance reviews.
 */
export enum ReviewStatus {
  /**
   * Review has been created but not started
   */
  Draft = 'DRAFT',

  /**
   * Review is in progress
   */
  InProgress = 'IN_PROGRESS',

  /**
   * Review has been submitted for approval
   */
  Submitted = 'SUBMITTED',

  /**
   * Review has been approved
   */
  Approved = 'APPROVED',

  /**
   * Review has been completed
   */
  Completed = 'COMPLETED',
}

/**
 * Leave request entity interface
 * 
 * Represents an employee's leave/time-off request.
 */
export interface LeaveRequest extends BaseEntity {
  /**
   * Employee requesting leave
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
   * Number of days requested
   */
  daysRequested: number;

  /**
   * Reason for leave
   */
  reason?: string;

  /**
   * Leave request status
   */
  status: LeaveRequestStatus;

  /**
   * Approver (manager) identifier
   */
  approverId?: string;

  /**
   * Date when request was approved/rejected
   */
  reviewedAt?: Date;

  /**
   * Approver's comments
   */
  approverComments?: string;
}

/**
 * Leave type enumeration
 * 
 * Defines the types of leave that can be requested.
 */
export enum LeaveType {
  /**
   * Annual vacation leave
   */
  Vacation = 'VACATION',

  /**
   * Sick leave
   */
  Sick = 'SICK',

  /**
   * Personal leave
   */
  Personal = 'PERSONAL',

  /**
   * Maternity leave
   */
  Maternity = 'MATERNITY',

  /**
   * Paternity leave
   */
  Paternity = 'PATERNITY',

  /**
   * Unpaid leave
   */
  Unpaid = 'UNPAID',

  /**
   * Other types of leave
   */
  Other = 'OTHER',
}

/**
 * Leave request status enumeration
 * 
 * Defines the workflow states for leave requests.
 */
export enum LeaveRequestStatus {
  /**
   * Request is pending approval
   */
  Pending = 'PENDING',

  /**
   * Request has been approved
   */
  Approved = 'APPROVED',

  /**
   * Request has been rejected
   */
  Rejected = 'REJECTED',

  /**
   * Request has been cancelled by employee
   */
  Cancelled = 'CANCELLED',
}

/**
 * Pagination parameters interface
 * 
 * Standard pagination parameters for list queries.
 */
export interface PaginationParams {
  /**
   * Page number (1-indexed)
   */
  page: number;

  /**
   * Number of items per page
   */
  limit: number;

  /**
   * Optional sort field
   */
  sortBy?: string;

  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response interface
 * 
 * Standard structure for paginated API responses.
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for current page
   */
  data: T[];

  /**
   * Pagination metadata
   */
  pagination: {
    /**
     * Current page number
     */
    page: number;

    /**
     * Items per page
     */
    limit: number;

    /**
     * Total number of items
     */
    total: number;

    /**
     * Total number of pages
     */
    totalPages: number;

    /**
     * Whether there is a next page
     */
    hasNext: boolean;

    /**
     * Whether there is a previous page
     */
    hasPrev: boolean;
  };
}

/**
 * API error response interface
 * 
 * Standard structure for error responses from the API.
 */
export interface ApiErrorResponse {
  /**
   * Error code for programmatic handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;

  /**
   * Timestamp when error occurred
   */
  timestamp: Date;

  /**
   * Request path that caused the error
   */
  path?: string;
}

/**
 * Validation error details interface
 * 
 * Structure for field-level validation errors.
 */
export interface ValidationError {
  /**
   * Field name that failed validation
   */
  field: string;

  /**
   * Validation error message
   */
  message: string;

  /**
   * Validation rule that failed
   */
  rule?: string;

  /**
   * Value that failed validation
   */
  value?: unknown;
}

/**
 * Type guard to check if a value is a valid UserRole
 * 
 * @param value - Value to check
 * @returns True if value is a valid UserRole
 */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    Object.values(UserRole).includes(value as UserRole)
  );
}

/**
 * Type guard to check if a value is a valid EmploymentStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid EmploymentStatus
 */
export function isEmploymentStatus(value: unknown): value is EmploymentStatus {
  return (
    typeof value === 'string' &&
    Object.values(EmploymentStatus).includes(value as EmploymentStatus)
  );
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
 * Type guard to check if a value is a valid LeaveRequestStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid LeaveRequestStatus
 */
export function isLeaveRequestStatus(
  value: unknown
): value is LeaveRequestStatus {
  return (
    typeof value === 'string' &&
    Object.values(LeaveRequestStatus).includes(value as LeaveRequestStatus)
  );
}

/**
 * Type guard to check if a value is a valid ReviewStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid ReviewStatus
 */
export function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === 'string' &&
    Object.values(ReviewStatus).includes(value as ReviewStatus)
  );
}

/**
 * Utility type for creating partial updates
 * 
 * Makes all properties optional except id and audit fields
 */
export type UpdatePayload<T extends BaseEntity> = Partial<
  Omit<T, 'id' | 'createdAt' | 'updatedAt'>
>;

/**
 * Utility type for creating new entities
 * 
 * Omits id and audit fields which are set by the system
 */
export type CreatePayload<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Utility type for nullable fields
 * 
 * Makes specified keys nullable
 */
export type Nullable<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

/**
 * Utility type for required fields
 * 
 * Makes specified keys required (removes optional modifier)
 */
export type RequiredFields<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};