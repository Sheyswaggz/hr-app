import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';

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
 * Storage keys for tokens (kept for compatibility with auth.ts)
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

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
  
  if (isExpired) {
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
      // Check if user is authenticated using auth API
      if (!authApi.isAuthenticated()) {
        console.log('[AuthContext] No authentication tokens found in storage');
        setIsLoading(false);
        return;
      }

      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (!accessToken) {
        console.log('[AuthContext] No access token found in storage');
        setIsLoading(false);
        return;
      }

      if (isTokenExpired(accessToken)) {
        console.log('[AuthContext] Access token expired, attempting refresh');
        try {
          await refreshToken();
        } catch (refreshError) {
          console.error('[AuthContext] Failed to refresh token on load');
          setIsLoading(false);
        }
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
      
      // Use the auth API service which properly handles the response
      const authResponse = await authApi.login(email, password);
      
      setUser(authResponse.user);
      
      console.log('[AuthContext] Login successful:', {
        userId: authResponse.user.id,
        email: authResponse.user.email,
        role: authResponse.user.role,
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
      
      // Use the auth API service
      await authApi.logout();
      
      setUser(null);
      
      console.log('[AuthContext] Logout successful');
    } catch (error) {
      console.error('[AuthContext] Logout error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Even on error, clear the user state
      setUser(null);
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
      console.log('[AuthContext] Refreshing access token');

      // Use the auth API service
      const authResponse = await authApi.refreshToken();

      setUser(authResponse.user);
      
      console.log('[AuthContext] Token refresh successful:', {
        userId: authResponse.user.id,
        email: authResponse.user.email,
      });
    } catch (error) {
      console.error('[AuthContext] Token refresh error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      setUser(null);
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