import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth, UserRole } from '../contexts/AuthContext';

/**
 * Props for ProtectedRoute component
 */
interface ProtectedRouteProps {
  /**
   * Child components to render when authorized
   */
  children: React.ReactNode;

  /**
   * Optional array of allowed user roles
   * If not provided, only authentication is checked
   */
  allowedRoles?: UserRole[];

  /**
   * Optional redirect path when unauthorized
   * Defaults to '/login'
   */
  redirectTo?: string;
}

/**
 * Protected Route Component
 * 
 * Wraps routes that require authentication and optional role-based authorization.
 * Handles the following scenarios:
 * - Redirects unauthenticated users to login page
 * - Shows loading spinner while checking authentication status
 * - Validates user role against allowed roles if specified
 * - Renders children if all authorization checks pass
 * - Preserves intended destination in location state for post-login redirect
 * 
 * @component
 * @example
 * ```tsx
 * // Protect route with authentication only
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * } />
 * 
 * // Protect route with role-based access
 * <Route path="/admin" element={
 *   <ProtectedRoute allowedRoles={[UserRole.HR_ADMIN]}>
 *     <AdminPanel />
 *   </ProtectedRoute>
 * } />
 * 
 * // Multiple allowed roles
 * <Route path="/reports" element={
 *   <ProtectedRoute allowedRoles={[UserRole.HR_ADMIN, UserRole.MANAGER]}>
 *     <Reports />
 *   </ProtectedRoute>
 * } />
 * ```
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectTo = '/login',
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  /**
   * Show loading spinner while authentication state is being determined
   * This prevents flash of unauthorized content or premature redirects
   */
  if (isLoading) {
    console.log('[ProtectedRoute] Checking authentication status', {
      path: location.pathname,
      timestamp: new Date().toISOString(),
    });

    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        role="status"
        aria-live="polite"
        aria-label="Loading authentication status"
      >
        <CircularProgress
          size={60}
          thickness={4}
          aria-label="Loading"
        />
      </Box>
    );
  }

  /**
   * Redirect to login if user is not authenticated
   * Preserve the intended destination in location state for post-login redirect
   */
  if (!isAuthenticated || !user) {
    console.warn('[ProtectedRoute] Unauthorized access attempt - redirecting to login', {
      path: location.pathname,
      isAuthenticated,
      hasUser: !!user,
      timestamp: new Date().toISOString(),
    });

    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  /**
   * Check role-based authorization if allowedRoles is specified
   * User must have one of the allowed roles to access the route
   */
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRequiredRole = allowedRoles.includes(user.role);

    if (!hasRequiredRole) {
      console.error('[ProtectedRoute] Insufficient permissions - role not authorized', {
        path: location.pathname,
        userRole: user.role,
        allowedRoles,
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      });

      /**
       * Redirect to appropriate dashboard based on user's actual role
       * This provides better UX than showing a generic "forbidden" page
       */
      const roleBasedRedirect = getRoleBasedRedirect(user.role);

      return (
        <Navigate
          to={roleBasedRedirect}
          state={{ 
            from: location,
            error: 'You do not have permission to access this page',
          }}
          replace
        />
      );
    }

    console.log('[ProtectedRoute] Authorization successful', {
      path: location.pathname,
      userRole: user.role,
      allowedRoles,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log('[ProtectedRoute] Authentication check passed (no role restrictions)', {
      path: location.pathname,
      userRole: user.role,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * All authorization checks passed - render protected content
   */
  return <>{children}</>;
};

/**
 * Determines the appropriate redirect path based on user role
 * 
 * @param {UserRole} role - User's role
 * @returns {string} Redirect path for the user's role
 */
function getRoleBasedRedirect(role: UserRole): string {
  switch (role) {
    case UserRole.HR_ADMIN:
      return '/dashboard/hr-admin';
    case UserRole.MANAGER:
      return '/dashboard/manager';
    case UserRole.EMPLOYEE:
      return '/dashboard/employee';
    default:
      console.error('[ProtectedRoute] Unknown user role, redirecting to login', {
        role,
        timestamp: new Date().toISOString(),
      });
      return '/login';
  }
}

export default ProtectedRoute;