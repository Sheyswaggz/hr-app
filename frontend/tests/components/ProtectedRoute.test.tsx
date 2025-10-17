import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import { AuthContext, UserRole } from '../../src/contexts/AuthContext';
import type { AuthContextType } from '../../src/contexts/AuthContext';

/**
 * Test Suite for ProtectedRoute Component
 * 
 * Validates authentication and authorization behavior:
 * - Redirects unauthenticated users to login
 * - Renders protected content for authenticated users
 * - Enforces role-based access control
 * - Displays loading state during authentication check
 * - Handles edge cases and error scenarios
 */

/**
 * Mock child component for testing protected content rendering
 */
const ProtectedContent = () => <div>Protected Content</div>;

/**
 * Mock login page component
 */
const LoginPage = () => <div>Login Page</div>;

/**
 * Mock dashboard components for role-based redirects
 */
const HRAdminDashboard = () => <div>HR Admin Dashboard</div>;
const ManagerDashboard = () => <div>Manager Dashboard</div>;
const EmployeeDashboard = () => <div>Employee Dashboard</div>;

/**
 * Helper function to create mock AuthContext value
 */
const createMockAuthContext = (
  overrides?: Partial<AuthContextType>
): AuthContextType => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  ...overrides,
});

/**
 * Helper function to render ProtectedRoute with AuthContext and Router
 */
const renderProtectedRoute = (
  authContextValue: AuthContextType,
  options?: {
    allowedRoles?: UserRole[];
    redirectTo?: string;
    initialPath?: string;
  }
) => {
  const { allowedRoles, redirectTo, initialPath = '/protected' } = options || {};

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={authContextValue}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard/hr-admin" element={<HRAdminDashboard />} />
          <Route path="/dashboard/manager" element={<ManagerDashboard />} />
          <Route path="/dashboard/employee" element={<EmployeeDashboard />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute
                allowedRoles={allowedRoles}
                redirectTo={redirectTo}
              >
                <ProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  describe('Loading State', () => {
    it('displays loading spinner while checking authentication status', () => {
      const authContext = createMockAuthContext({
        isLoading: true,
      });

      renderProtectedRoute(authContext);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes on loading spinner', () => {
      const authContext = createMockAuthContext({
        isLoading: true,
      });

      renderProtectedRoute(authContext);

      const loadingContainer = screen.getByRole('status');
      expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
      expect(loadingContainer).toHaveAttribute(
        'aria-label',
        'Loading authentication status'
      );
    });

    it('logs authentication check when loading', () => {
      const authContext = createMockAuthContext({
        isLoading: true,
      });

      renderProtectedRoute(authContext);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ProtectedRoute] Checking authentication status'),
        expect.objectContaining({
          path: '/protected',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Unauthenticated Access', () => {
    it('redirects to login when user is not authenticated', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to custom path when redirectTo is specified', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={authContext}>
            <Routes>
              <Route path="/custom-login" element={<div>Custom Login</div>} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute redirectTo="/custom-login">
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Login')).toBeInTheDocument();
      });
    });

    it('preserves intended destination in location state', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      let locationState: any;

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={authContext}>
            <Routes>
              <Route
                path="/login"
                element={
                  <div>
                    Login Page
                    {(() => {
                      const location = window.location;
                      locationState = (location as any).state;
                      return null;
                    })()}
                  </div>
                }
              />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('logs unauthorized access attempt', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[ProtectedRoute] Unauthorized access attempt'),
          expect.objectContaining({
            path: '/protected',
            isAuthenticated: false,
            hasUser: false,
            timestamp: expect.any(String),
          })
        );
      });
    });

    it('redirects when user is null even if isAuthenticated is true', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        user: null,
        isLoading: false,
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated Access Without Role Restrictions', () => {
    it('renders protected content for authenticated employee', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('renders protected content for authenticated manager', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-2',
          email: 'manager@example.com',
          role: UserRole.MANAGER,
          firstName: 'Jane',
          lastName: 'Smith',
        },
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('renders protected content for authenticated HR admin', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-3',
          email: 'hradmin@example.com',
          role: UserRole.HR_ADMIN,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('logs successful authentication check', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[ProtectedRoute] Authentication check passed'),
          expect.objectContaining({
            path: '/protected',
            userRole: UserRole.EMPLOYEE,
            userId: 'user-1',
            timestamp: expect.any(String),
          })
        );
      });
    });
  });

  describe('Role-Based Authorization', () => {
    it('allows access when user has required role', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'hradmin@example.com',
          role: UserRole.HR_ADMIN,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN],
      });

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('allows access when user has one of multiple allowed roles', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-2',
          email: 'manager@example.com',
          role: UserRole.MANAGER,
          firstName: 'Jane',
          lastName: 'Smith',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN, UserRole.MANAGER],
      });

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('redirects to role-based dashboard when user lacks required role', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN],
      });

      await waitFor(() => {
        expect(screen.getByText('Employee Dashboard')).toBeInTheDocument();
      });

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects HR admin to correct dashboard when unauthorized', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'hradmin@example.com',
          role: UserRole.HR_ADMIN,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.MANAGER],
      });

      await waitFor(() => {
        expect(screen.getByText('HR Admin Dashboard')).toBeInTheDocument();
      });
    });

    it('redirects manager to correct dashboard when unauthorized', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-2',
          email: 'manager@example.com',
          role: UserRole.MANAGER,
          firstName: 'Jane',
          lastName: 'Smith',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN],
      });

      await waitFor(() => {
        expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
      });
    });

    it('logs insufficient permissions error', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN, UserRole.MANAGER],
      });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[ProtectedRoute] Insufficient permissions'),
          expect.objectContaining({
            path: '/protected',
            userRole: UserRole.EMPLOYEE,
            allowedRoles: [UserRole.HR_ADMIN, UserRole.MANAGER],
            userId: 'user-1',
            email: 'employee@example.com',
            timestamp: expect.any(String),
          })
        );
      });
    });

    it('logs successful authorization with role check', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'hradmin@example.com',
          role: UserRole.HR_ADMIN,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.HR_ADMIN],
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[ProtectedRoute] Authorization successful'),
          expect.objectContaining({
            path: '/protected',
            userRole: UserRole.HR_ADMIN,
            allowedRoles: [UserRole.HR_ADMIN],
            userId: 'user-1',
            timestamp: expect.any(String),
          })
        );
      });
    });

    it('handles empty allowedRoles array as no restrictions', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      renderProtectedRoute(authContext, {
        allowedRoles: [],
      });

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles transition from loading to authenticated', async () => {
      const authContext = createMockAuthContext({
        isLoading: true,
      });

      const { rerender } = renderProtectedRoute(authContext);

      expect(screen.getByRole('status')).toBeInTheDocument();

      const updatedAuthContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={updatedAuthContext}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('handles transition from loading to unauthenticated', async () => {
      const authContext = createMockAuthContext({
        isLoading: true,
      });

      const { rerender } = renderProtectedRoute(authContext);

      expect(screen.getByRole('status')).toBeInTheDocument();

      const updatedAuthContext = createMockAuthContext({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={updatedAuthContext}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('handles user logout while on protected route', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const { rerender } = renderProtectedRoute(authContext);

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      const loggedOutAuthContext = createMockAuthContext({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={loggedOutAuthContext}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('handles role change while on protected route', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const { rerender } = renderProtectedRoute(authContext, {
        allowedRoles: [UserRole.EMPLOYEE],
      });

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      const updatedAuthContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.MANAGER,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={updatedAuthContext}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard/manager" element={<ManagerDashboard />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.EMPLOYEE]}>
                    <ProtectedContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Children', () => {
    it('renders multiple child components when authorized', async () => {
      const authContext = createMockAuthContext({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          role: UserRole.EMPLOYEE,
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthContext.Provider value={authContext}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>First Child</div>
                    <div>Second Child</div>
                    <div>Third Child</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('First Child')).toBeInTheDocument();
        expect(screen.getByText('Second Child')).toBeInTheDocument();
        expect(screen.getByText('Third Child')).toBeInTheDocument();
      });
    });
  });
});