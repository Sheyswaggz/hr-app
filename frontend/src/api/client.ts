/**
 * Axios API Client Configuration
 * 
 * Provides a configured axios instance with:
 * - Base URL from environment variables
 * - Request/response interceptors for authentication
 * - Error handling and formatting
 * - TypeScript types for API responses
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  message: string;
  code?: string;
  statusCode: number;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  timestamp?: string;
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = any> {
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Authentication token storage keys
 */
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[API Client] Failed to retrieve auth token from localStorage:', error);
    return null;
  }
}

/**
 * Remove authentication tokens from localStorage
 */
function clearAuthTokens(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('[API Client] Failed to clear auth tokens from localStorage:', error);
  }
}

/**
 * Trigger logout by clearing tokens and redirecting to login
 */
function triggerLogout(): void {
  console.warn('[API Client] Triggering logout due to authentication failure');
  clearAuthTokens();
  
  // Dispatch custom event for auth context to handle
  window.dispatchEvent(new CustomEvent('auth:logout', { 
    detail: { reason: 'token_expired' } 
  }));
  
  // Redirect to login page if not already there
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

/**
 * Format error message from axios error
 */
function formatErrorMessage(error: AxiosError<ApiErrorResponse>): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.status === 401) {
    return 'Authentication failed. Please log in again.';
  }
  
  if (error.response?.status === 403) {
    return 'You do not have permission to perform this action.';
  }
  
  if (error.response?.status === 404) {
    return 'The requested resource was not found.';
  }
  
  if (error.response?.status === 422) {
    return 'Validation failed. Please check your input.';
  }
  
  if (error.response?.status === 429) {
    return 'Too many requests. Please try again later.';
  }
  
  if (error.response?.status && error.response.status >= 500) {
    return 'A server error occurred. Please try again later.';
  }
  
  if (error.code === 'ECONNABORTED') {
    return 'Request timeout. Please check your connection and try again.';
  }
  
  if (error.code === 'ERR_NETWORK') {
    return 'Network error. Please check your internet connection.';
  }
  
  return error.message || 'An unexpected error occurred.';
}

/**
 * Create and configure axios instance
 */
function createApiClient(): AxiosInstance {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  const timeout = Number(import.meta.env.VITE_API_TIMEOUT) || 10000;
  
  console.info('[API Client] Initializing with baseURL:', baseURL);
  
  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, // Include cookies in requests
  });
  
  /**
   * Request interceptor: Add authentication token to headers
   */
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAuthToken();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log request in development mode
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[API Client] Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          data: config.data,
        });
      }
      
      return config;
    },
    (error: AxiosError) => {
      console.error('[API Client] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );
  
  /**
   * Response interceptor: Handle authentication errors and format responses
   */
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response in development mode
      if (import.meta.env.VITE_API_DEBUG === 'true') {
        console.debug('[API Client] Response:', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });
      }
      
      return response;
    },
    (error: AxiosError<ApiErrorResponse>) => {
      // Log error details
      console.error('[API Client] Response error:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });
      
      // Handle 401 Unauthorized - trigger logout
      if (error.response?.status === 401) {
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        const isRefreshRequest = error.config?.url?.includes('/auth/refresh');
        
        // Don't trigger logout for login or refresh requests
        if (!isLoginRequest && !isRefreshRequest) {
          triggerLogout();
        }
      }
      
      // Format error for consistent handling
      const formattedError: AxiosError<ApiErrorResponse> = {
        ...error,
        message: formatErrorMessage(error),
      };
      
      // Enhance error response data
      if (error.response) {
        formattedError.response = {
          ...error.response,
          data: {
            message: formatErrorMessage(error),
            code: error.response.data?.code || error.code,
            statusCode: error.response.status,
            errors: error.response.data?.errors,
            timestamp: error.response.data?.timestamp || new Date().toISOString(),
          },
        };
      }
      
      return Promise.reject(formattedError);
    }
  );
  
  return instance;
}

/**
 * Configured axios instance for API requests
 */
export const apiClient: AxiosInstance = createApiClient();

/**
 * Helper function to handle API errors consistently
 */
export function handleApiError(error: unknown): ApiErrorResponse {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    
    return {
      message: axiosError.response?.data?.message || formatErrorMessage(axiosError),
      code: axiosError.response?.data?.code || axiosError.code,
      statusCode: axiosError.response?.status || 500,
      errors: axiosError.response?.data?.errors,
      timestamp: axiosError.response?.data?.timestamp || new Date().toISOString(),
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Type-safe API request wrapper
 */
export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: any,
  config?: any
): Promise<ApiSuccessResponse<T>> {
  try {
    const response = await apiClient.request<ApiSuccessResponse<T>>({
      method,
      url,
      data,
      ...config,
    });
    
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(url: string, config?: any) => 
    apiRequest<T>('GET', url, undefined, config),
  
  post: <T = any>(url: string, data?: any, config?: any) => 
    apiRequest<T>('POST', url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: any) => 
    apiRequest<T>('PUT', url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: any) => 
    apiRequest<T>('PATCH', url, data, config),
  
  delete: <T = any>(url: string, config?: any) => 
    apiRequest<T>('DELETE', url, undefined, config),
};

/**
 * Export default client
 */
export default apiClient;