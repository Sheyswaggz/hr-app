import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { UserRole } from '../contexts/AuthContext';

/**
 * Lazy-loaded page components for code splitting and optimized bundle size
 * Each dashboard is loaded only when needed, reducing initial bundle size
 */
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardLayout = lazy(() => import('../layouts/DashboardLayout'));
const HRAdminDashboard = lazy(() => import('../pages/HRAdminDashboard'));
const ManagerDashboard = lazy(() => import('../pages/ManagerDashboard'));
const EmployeeDashboard = lazy(() => import('../pages/EmployeeDashboard'));

/**
 * Loading fallback component displayed during lazy component loading
 * Provides consistent loading experience across all route transitions
 * 
 * @component
 */
const RouteLoadingFallback: React.FC = () => {
  console.log('[Routes] Loading route component', {
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
      aria-label="Loading page content"
    >
      <CircularProgress
        size={60}
        thickness={4}
        aria-label="Loading"
      />
    </Box>
  );
};

/**
 * Application Routes Component
 * 
 * Defines the complete routing structure for the HR application with:
 * - Public routes (login)
 * - Protected routes with authentication
 * - Role-based dashboard routing
 * - Lazy loading for optimal performance
 * - Proper loading states and error boundaries
 * 
 * Route Structure:
 * - / -> Redirects to /dashboard
 * - /login -> Public login page
 * - /dashboard -> Protected dashboard layout with nested role-based routes
 *   - /dashboard/hr-admin -> HR Admin dashboard (HR_ADMIN only)
 *   - /dashboard/manager -> Manager dashboard (MANAGER only)
 *   - /dashboard/employee -> Employee dashboard (EMPLOYEE only)
 * 
 * Security Features:
 * - All dashboard routes protected by authentication
 * - Role-based access control enforced at route level
 * - Automatic redirect to login for unauthenticated users
 * - Automatic redirect to appropriate dashboard for unauthorized role access
 * 
 * Performance Optimizations:
 * - Lazy loading of all page components
 * - Code splitting by route
 * - Suspense boundaries for loading states
 * - Optimized bundle size through dynamic imports
 * 
 * @component
 * @example
 * ```tsx
 * import { BrowserRouter } from 'react-router-dom';
 * import { AppRoutes } from './routes';
 * 
 * function App() {
 *   return (
 *     <BrowserRouter>
 *       <AppRoutes />
 *     </BrowserRouter>
 *   );
 * }
 * ```
 */
export const AppRoutes: React.FC = () => {
  console.log('[Routes] Rendering application routes', {
    timestamp: new Date().toISOString(),
  });

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Root redirect - sends users to dashboard */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Public login route - accessible to all users */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* Protected dashboard routes with role-based access */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* HR Admin Dashboard - restricted to HR_ADMIN role */}
          <Route
            path="hr-admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.HR_ADMIN]}>
                <HRAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Manager Dashboard - restricted to MANAGER role */}
          <Route
            path="manager"
            element={
              <ProtectedRoute allowedRoles={[UserRole.MANAGER]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Employee Dashboard - restricted to EMPLOYEE role */}
          <Route
            path="employee"
            element={
              <ProtectedRoute allowedRoles={[UserRole.EMPLOYEE]}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default dashboard route - redirects to role-specific dashboard */}
          <Route
            index
            element={<RoleBasedDashboardRedirect />}
          />
        </Route>

        {/* Catch-all route for 404 - redirects to dashboard */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </Suspense>
  );
};

/**
 * Role-Based Dashboard Redirect Component
 * 
 * Automatically redirects authenticated users to their role-specific dashboard.
 * This component is used as the index route for /dashboard to provide
 * seamless navigation based on user role.
 * 
 * Redirect Logic:
 * - HR_ADMIN -> /dashboard/hr-admin
 * - MANAGER -> /dashboard/manager
 * - EMPLOYEE -> /dashboard/employee
 * - Unknown role -> /login (with error state)
 * 
 * @component
 */
const RoleBasedDashboardRedirect: React.FC = () => {
  const { user } = useAuth();

  console.log('[RoleBasedDashboardRedirect] Determining dashboard redirect', {
    userRole: user?.role,
    userId: user?.id,
    timestamp: new Date().toISOString(),
  });

  if (!user) {
    console.error('[RoleBasedDashboardRedirect] No user found, redirecting to login', {
      timestamp: new Date().toISOString(),
    });
    return <Navigate to="/login" replace />;
  }

  const dashboardPath = getDashboardPathForRole(user.role);

  console.log('[RoleBasedDashboardRedirect] Redirecting to role-specific dashboard', {
    userRole: user.role,
    dashboardPath,
    userId: user.id,
    timestamp: new Date().toISOString(),
  });

  return <Navigate to={dashboardPath} replace />;
};

/**
 * Determines the appropriate dashboard path based on user role
 * 
 * @param {UserRole} role - User's role
 * @returns {string} Dashboard path for the role
 */
function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case UserRole.HR_ADMIN:
      return '/dashboard/hr-admin';
    case UserRole.MANAGER:
      return '/dashboard/manager';
    case UserRole.EMPLOYEE:
      return '/dashboard/employee';
    default:
      console.error('[getDashboardPathForRole] Unknown user role', {
        role,
        timestamp: new Date().toISOString(),
      });
      return '/login';
  }
}

/**
 * Import useAuth hook for role-based redirect component
 * Placed after component definitions to avoid circular dependency issues
 */
import { useAuth } from '../contexts/AuthContext';

export default AppRoutes;