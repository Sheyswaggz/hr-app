/**
 * Frontend Type Definitions
 * 
 * Core TypeScript interfaces and types for the HR application frontend.
 * Defines user models, authentication responses, and role-based types.
 */

/**
 * User role enumeration
 * Defines the three primary roles in the HR system with hierarchical permissions
 */
export enum UserRole {
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

/**
 * Core user interface
 * Represents an authenticated user in the system
 */
export interface User {
  /** Unique identifier for the user */
  readonly id: string;
  
  /** User's email address (used for authentication) */
  readonly email: string;
  
  /** User's first name */
  readonly firstName: string;
  
  /** User's last name */
  readonly lastName: string;
  
  /** User's role determining access permissions */
  readonly role: UserRole;
  
  /** Timestamp when the user account was created */
  readonly createdAt: Date;
  
  /** Timestamp when the user account was last updated */
  readonly updatedAt: Date;
}

/**
 * Authentication response interface
 * Returned after successful login or token refresh
 */
export interface AuthResponse {
  /** Authenticated user information */
  readonly user: User;
  
  /** JWT access token for API authentication (short-lived) */
  readonly accessToken: string;
  
  /** JWT refresh token for obtaining new access tokens (long-lived) */
  readonly refreshToken: string;
}

/**
 * Login credentials interface
 * Used for user authentication requests
 */
export interface LoginCredentials {
  /** User's email address */
  readonly email: string;
  
  /** User's password */
  readonly password: string;
}

/**
 * Token refresh request interface
 * Used to obtain a new access token using a refresh token
 */
export interface TokenRefreshRequest {
  /** Valid refresh token */
  readonly refreshToken: string;
}

/**
 * User profile update payload
 * Allows partial updates to user information
 */
export interface UserProfileUpdate {
  /** Optional first name update */
  readonly firstName?: string;
  
  /** Optional last name update */
  readonly lastName?: string;
}

/**
 * Password change request interface
 * Used for authenticated password changes
 */
export interface PasswordChangeRequest {
  /** Current password for verification */
  readonly currentPassword: string;
  
  /** New password to set */
  readonly newPassword: string;
}

/**
 * API error response interface
 * Standardized error format from backend
 */
export interface ApiErrorResponse {
  /** Error message */
  readonly message: string;
  
  /** HTTP status code */
  readonly statusCode: number;
  
  /** Optional error code for client-side handling */
  readonly code?: string;
  
  /** Optional validation errors for form fields */
  readonly errors?: Record<string, string[]>;
}

/**
 * Pagination parameters interface
 * Used for paginated API requests
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  readonly page: number;
  
  /** Number of items per page */
  readonly limit: number;
  
  /** Optional sort field */
  readonly sortBy?: string;
  
  /** Optional sort order */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response interface
 * Wrapper for paginated API responses
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  readonly data: T[];
  
  /** Pagination metadata */
  readonly pagination: {
    /** Current page number */
    readonly page: number;
    
    /** Items per page */
    readonly limit: number;
    
    /** Total number of items */
    readonly total: number;
    
    /** Total number of pages */
    readonly totalPages: number;
    
    /** Whether there is a next page */
    readonly hasNext: boolean;
    
    /** Whether there is a previous page */
    readonly hasPrevious: boolean;
  };
}

/**
 * Type guard to check if a value is a valid UserRole
 */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    Object.values(UserRole).includes(value as UserRole)
  );
}

/**
 * Type guard to check if a value is a valid User object
 */
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    'firstName' in value &&
    'lastName' in value &&
    'role' in value &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).email === 'string' &&
    typeof (value as User).firstName === 'string' &&
    typeof (value as User).lastName === 'string' &&
    isUserRole((value as User).role)
  );
}

/**
 * Type guard to check if a value is a valid AuthResponse
 */
export function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'user' in value &&
    'accessToken' in value &&
    'refreshToken' in value &&
    isUser((value as AuthResponse).user) &&
    typeof (value as AuthResponse).accessToken === 'string' &&
    typeof (value as AuthResponse).refreshToken === 'string'
  );
}

/**
 * Utility type for role-based conditional rendering
 * Maps role to boolean for permission checks
 */
export type RolePermissions = {
  readonly [K in UserRole]: boolean;
};

/**
 * Utility type for extracting user display name
 */
export type UserDisplayName = Pick<User, 'firstName' | 'lastName'>;

/**
 * Helper function to get user's full name
 */
export function getUserFullName(user: User | UserDisplayName): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/**
 * Helper function to get user's initials
 */
export function getUserInitials(user: User | UserDisplayName): string {
  const firstInitial = user.firstName.charAt(0).toUpperCase();
  const lastInitial = user.lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
}

/**
 * Role hierarchy levels for permission comparison
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.HR_ADMIN]: 3,
  [UserRole.MANAGER]: 2,
  [UserRole.EMPLOYEE]: 1,
} as const;

/**
 * Helper function to check if a role has higher or equal permissions
 */
export function hasRolePermission(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Helper function to check if user is HR Admin
 */
export function isHRAdmin(user: User): boolean {
  return user.role === UserRole.HR_ADMIN;
}

/**
 * Helper function to check if user is Manager or higher
 */
export function isManagerOrHigher(user: User): boolean {
  return hasRolePermission(user.role, UserRole.MANAGER);
}

/**
 * Type for authentication state in context
 */
export type AuthState =
  | { readonly isAuthenticated: false; readonly user: null }
  | { readonly isAuthenticated: true; readonly user: User };

/**
 * Loading state type for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Generic async operation state
 */
export interface AsyncState<T, E = Error> {
  readonly status: LoadingState;
  readonly data: T | null;
  readonly error: E | null;
}

/**
 * Helper function to create initial async state
 */
export function createInitialAsyncState<T>(): AsyncState<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
  };
}

/**
 * Helper function to create loading async state
 */
export function createLoadingState<T>(): AsyncState<T> {
  return {
    status: 'loading',
    data: null,
    error: null,
  };
}

/**
 * Helper function to create success async state
 */
export function createSuccessState<T>(data: T): AsyncState<T> {
  return {
    status: 'success',
    data,
    error: null,
  };
}

/**
 * Helper function to create error async state
 */
export function createErrorState<T>(error: Error): AsyncState<T> {
  return {
    status: 'error',
    data: null,
    error,
  };
}