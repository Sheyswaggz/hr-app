import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * User role enumeration matching backend UserRole
 */
export enum UserRole {
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

/**
 * User object structure returned from authentication
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

/**
 * JWT token payload structure
 */
interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Login response from backend API
 */
interface LoginResponse {
  success: boolean;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: User;
}

/**
 * Authentication context value interface
 */
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

/**
 * AuthProvider component props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Storage keys for tokens
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'hr_app_access_token',
  REFRESH_TOKEN: 'hr_app_refresh_token',
} as const;

/**
 * API base URL from environment variables
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Authentication context
 * 
 * Provides global authentication state and methods throughout the application.
 * Must be used within AuthProvider component tree.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Custom hook to access authentication context
 * 
 * @throws {Error} If used outside of AuthProvider
 * @returns {AuthContextValue} Authentication context value
 * 
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 * 
 * if (isAuthenticated) {
 *   return <div>Welcome, {user?.firstName}!</div>;
 * }
 * ```
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Decodes JWT token payload without verification
 * 
 * @param {string} token - JWT token to decode
 * @returns {TokenPayload | null} Decoded token payload or null if invalid
 */
const decodeToken = (token: string): TokenPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) {
      console.error('[AuthContext] Invalid token format: missing payload segment');
      return null;
    }
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload) as TokenPayload;
    
    if (!payload.userId || !payload.email || !payload.role || !payload.exp) {
      console.error('[AuthContext] Invalid token payload: missing required fields', {
        hasUserId: !!payload.userId,
        hasEmail: !!payload.email,
        hasRole: !!payload.role,
        hasExp: !!payload.exp,
      });
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[AuthContext] Failed to decode token:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenLength: token.length,
    });
    return null;
  }
};

/**
 * Checks if JWT token is expired
 * 
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired or invalid
 */
const isTokenExpired = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload) {
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const isExpired = payload.exp < currentTime;
  
  if (isExpired && import.meta.env.DEV) {
    console.warn('[AuthContext] Token expired:', {
      expiredAt: new Date(payload.exp * 1000).toISOString(),
      currentTime: new Date(currentTime * 1000).toISOString(),
    });
  }
  
  return isExpired;
};

/**
 * Extracts user information from JWT token
 * 
 * @param {string} token - JWT access token
 * @returns {User | null} User object or null if token is invalid
 */
const getUserFromToken = (token: string): User | null => {
  const payload = decodeToken(token);
  if (!payload) {
    return null;
  }
  
  return {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    firstName: '',
    lastName: '',
  };
};

/**
 * Authentication Provider Component
 * 
 * Manages global authentication state including:
 * - User authentication status
 * - JWT token storage and refresh
 * - Login/logout operations
 * - Automatic token refresh on mount
 * - Token expiration handling
 * 
 * @component
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Loads user from stored access token on component mount
   * Validates token and refreshes if expired
   */
  const loadUserFromToken = useCallback(async (): Promise<void> => {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (!accessToken) {
        console.log('[AuthContext] No access token found in storage');
        setIsLoading(false);
        return;
      }

      if (isTokenExpired(accessToken)) {
        console.log('[AuthContext] Access token expired, attempting refresh');
        await refreshToken();
        return;
      }

      const userData = getUserFromToken(accessToken);
      if (userData) {
        console.log('[AuthContext] User loaded from token:', {
          userId: userData.id,
          email: userData.email,
          role: userData.role,
        });
        setUser(userData);
      } else {
        console.error('[AuthContext] Failed to extract user from token');
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
    } catch (error) {
      console.error('[AuthContext] Error loading user from token:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Authenticates user with email and password
   * 
   * @param {string} email - User email address
   * @param {string} password - User password
   * @throws {Error} If login fails or credentials are invalid
   * 
   * @example
   * ```tsx
   * try {
   *   await login('user@example.com', 'password123');
   *   navigate('/dashboard');
   * } catch (error) {
   *   setError('Invalid credentials');
   * }
   * ```
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      console.log('[AuthContext] Attempting login:', { email });
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        console.error('[AuthContext] Login failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData.message || `Login failed: ${response.statusText}`);
      }

      const data: LoginResponse = await response.json();
      
      if (!data.tokens?.accessToken || !data.tokens?.refreshToken || !data.user) {
        console.error('[AuthContext] Invalid login response:', {
          hasTokens: !!data.tokens,
          hasAccessToken: !!data.tokens?.accessToken,
          hasRefreshToken: !!data.tokens?.refreshToken,
          hasUser: !!data.user,
        });
        throw new Error('Invalid response from server');
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.tokens.refreshToken);
      
      setUser(data.user);
      
      console.log('[AuthContext] Login successful:', {
        userId: data.user.id,
        email: data.user.email,
        role: data.user.role,
      });
    } catch (error) {
      console.error('[AuthContext] Login error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logs out current user and clears authentication state
   * 
   * @example
   * ```tsx
   * const handleLogout = async () => {
   *   await logout();
   *   navigate('/login');
   * };
   * ```
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log('[AuthContext] Logging out user:', { userId: user?.id });
      
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (accessToken) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.warn('[AuthContext] Logout API call failed (continuing with local logout):', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      setUser(null);
      
      console.log('[AuthContext] Logout successful');
    } catch (error) {
      console.error('[AuthContext] Logout error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }, [user?.id]);

  /**
   * Refreshes access token using refresh token
   * 
   * @throws {Error} If refresh fails or refresh token is invalid
   * 
   * @example
   * ```tsx
   * try {
   *   await refreshToken();
   * } catch (error) {
   *   // Redirect to login
   *   navigate('/login');
   * }
   * ```
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!storedRefreshToken) {
        console.error('[AuthContext] No refresh token available');
        throw new Error('No refresh token available');
      }

      if (isTokenExpired(storedRefreshToken)) {
        console.error('[AuthContext] Refresh token expired');
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        setUser(null);
        throw new Error('Refresh token expired');
      }

      console.log('[AuthContext] Refreshing access token');

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }));
        console.error('[AuthContext] Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        setUser(null);
        
        throw new Error(errorData.message || 'Token refresh failed');
      }

      const data: { accessToken: string; refreshToken: string } = await response.json();
      
      if (!data.accessToken || !data.refreshToken) {
        console.error('[AuthContext] Invalid refresh response:', {
          hasAccessToken: !!data.accessToken,
          hasRefreshToken: !!data.refreshToken,
        });
        throw new Error('Invalid refresh response');
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);

      const userData = getUserFromToken(data.accessToken);
      if (userData) {
        setUser(userData);
        console.log('[AuthContext] Token refresh successful:', {
          userId: userData.id,
          email: userData.email,
        });
      } else {
        throw new Error('Failed to extract user from refreshed token');
      }
    } catch (error) {
      console.error('[AuthContext] Token refresh error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }, []);

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  const contextValue: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;