/**
 * Authentication API Service
 * 
 * Provides type-safe authentication API functions for:
 * - User login with credentials
 * - User logout
 * - Token refresh
 * - Current user retrieval
 * 
 * All functions use the configured axios client with proper error handling
 * and TypeScript types for requests and responses.
 */

import { apiClient, handleApiError, ApiSuccessResponse } from './client';

/**
 * User role enumeration matching backend
 */
export enum UserRole {
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

/**
 * User data structure
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  employeeId?: string;
  departmentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Login credentials request
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication response with tokens and user data
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Authentication token storage keys
 */
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

/**
 * Store authentication tokens in localStorage
 */
function storeAuthTokens(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    console.info('[Auth API] Tokens stored successfully');
  } catch (error) {
    console.error('[Auth API] Failed to store tokens in localStorage:', error);
    throw new Error('Failed to store authentication tokens');
  }
}

/**
 * Retrieve refresh token from localStorage
 */
function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[Auth API] Failed to retrieve refresh token from localStorage:', error);
    return null;
  }
}

/**
 * Clear authentication tokens from localStorage
 */
function clearAuthTokens(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    console.info('[Auth API] Tokens cleared successfully');
  } catch (error) {
    console.error('[Auth API] Failed to clear tokens from localStorage:', error);
  }
}

/**
 * Login user with email and password
 * 
 * @param email - User email address
 * @param password - User password
 * @returns Promise resolving to authentication response with user data and tokens
 * @throws ApiErrorResponse on authentication failure or network error
 * 
 * @example
 * ```typescript
 * try {
 *   const response = await login('user@example.com', 'password123');
 *   console.log('Logged in as:', response.user.email);
 * } catch (error) {
 *   console.error('Login failed:', error.message);
 * }
 * ```
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    console.info('[Auth API] Attempting login for email:', email);

    // Validate input
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Email is required and must be a non-empty string');
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new Error('Password is required and must be a non-empty string');
    }

    // Prepare request payload
    const credentials: LoginCredentials = {
      email: email.trim().toLowerCase(),
      password,
    };

    // Make API request
    const response = await apiClient.post<ApiSuccessResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );

    const authData = response.data.data;

    // Validate response structure
    if (!authData || !authData.user || !authData.accessToken || !authData.refreshToken) {
      console.error('[Auth API] Invalid response structure:', response.data);
      throw new Error('Invalid authentication response from server');
    }

    // Store tokens
    storeAuthTokens(authData.accessToken, authData.refreshToken);

    console.info('[Auth API] Login successful for user:', authData.user.id);

    return authData;
  } catch (error) {
    console.error('[Auth API] Login failed:', error);
    throw handleApiError(error);
  }
}

/**
 * Logout current user
 * 
 * Clears authentication tokens from localStorage and notifies the server.
 * Even if the server request fails, local tokens are cleared.
 * 
 * @returns Promise resolving when logout is complete
 * 
 * @example
 * ```typescript
 * try {
 *   await logout();
 *   console.log('Logged out successfully');
 * } catch (error) {
 *   console.error('Logout error:', error.message);
 * }
 * ```
 */
export async function logout(): Promise<void> {
  try {
    console.info('[Auth API] Attempting logout');

    // Attempt to notify server (best effort)
    try {
      await apiClient.post('/auth/logout');
      console.info('[Auth API] Server logout successful');
    } catch (serverError) {
      console.warn('[Auth API] Server logout failed, clearing local tokens anyway:', serverError);
    }

    // Always clear local tokens
    clearAuthTokens();

    // Dispatch logout event for auth context
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: { reason: 'user_initiated' }
    }));

    console.info('[Auth API] Logout complete');
  } catch (error) {
    console.error('[Auth API] Logout error:', error);
    
    // Ensure tokens are cleared even on error
    clearAuthTokens();
    
    throw handleApiError(error);
  }
}

/**
 * Refresh authentication token
 * 
 * Uses the stored refresh token to obtain a new access token.
 * Updates stored tokens with new values.
 * 
 * @returns Promise resolving to new authentication response with refreshed tokens
 * @throws ApiErrorResponse if refresh token is invalid or expired
 * 
 * @example
 * ```typescript
 * try {
 *   const response = await refreshToken();
 *   console.log('Token refreshed, expires in:', response.expiresIn);
 * } catch (error) {
 *   console.error('Token refresh failed:', error.message);
 *   // Redirect to login
 * }
 * ```
 */
export async function refreshToken(): Promise<AuthResponse> {
  try {
    console.info('[Auth API] Attempting token refresh');

    // Retrieve refresh token from storage
    const storedRefreshToken = getRefreshToken();

    if (!storedRefreshToken) {
      console.error('[Auth API] No refresh token found in storage');
      throw new Error('No refresh token available. Please log in again.');
    }

    // Prepare request payload
    const refreshRequest: RefreshTokenRequest = {
      refreshToken: storedRefreshToken,
    };

    // Make API request
    const response = await apiClient.post<ApiSuccessResponse<AuthResponse>>(
      '/auth/refresh',
      refreshRequest
    );

    const authData = response.data.data;

    // Validate response structure
    if (!authData || !authData.user || !authData.accessToken || !authData.refreshToken) {
      console.error('[Auth API] Invalid refresh response structure:', response.data);
      throw new Error('Invalid token refresh response from server');
    }

    // Store new tokens
    storeAuthTokens(authData.accessToken, authData.refreshToken);

    console.info('[Auth API] Token refresh successful for user:', authData.user.id);

    return authData;
  } catch (error) {
    console.error('[Auth API] Token refresh failed:', error);
    
    // Clear tokens on refresh failure
    clearAuthTokens();
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: { reason: 'token_refresh_failed' }
    }));
    
    throw handleApiError(error);
  }
}

/**
 * Get current authenticated user
 * 
 * Retrieves the current user's profile data from the server.
 * Requires valid authentication token.
 * 
 * @returns Promise resolving to current user data
 * @throws ApiErrorResponse if not authenticated or user not found
 * 
 * @example
 * ```typescript
 * try {
 *   const user = await getCurrentUser();
 *   console.log('Current user:', user.email, 'Role:', user.role);
 * } catch (error) {
 *   console.error('Failed to get current user:', error.message);
 * }
 * ```
 */
export async function getCurrentUser(): Promise<User> {
  try {
    console.info('[Auth API] Fetching current user');

    // Make API request
    const response = await apiClient.get<ApiSuccessResponse<User>>('/auth/me');

    const userData = response.data.data;

    // Validate response structure
    if (!userData || !userData.id || !userData.email || !userData.role) {
      console.error('[Auth API] Invalid user data structure:', response.data);
      throw new Error('Invalid user data received from server');
    }

    console.info('[Auth API] Current user retrieved:', userData.id);

    return userData;
  } catch (error) {
    console.error('[Auth API] Failed to get current user:', error);
    throw handleApiError(error);
  }
}

/**
 * Check if user is authenticated
 * 
 * Checks if authentication tokens exist in localStorage.
 * Does not validate token validity with server.
 * 
 * @returns true if tokens exist, false otherwise
 */
export function isAuthenticated(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    return !!(token && refreshToken);
  } catch (error) {
    console.error('[Auth API] Failed to check authentication status:', error);
    return false;
  }
}

/**
 * Export authentication API functions
 */
export default {
  login,
  logout,
  refreshToken,
  getCurrentUser,
  isAuthenticated,
};