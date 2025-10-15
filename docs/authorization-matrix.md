# Authorization Matrix

This document defines the authorization rules for all API endpoints in the HR application. It specifies which user roles can access each endpoint and any additional data access restrictions.

## Role Hierarchy

- **HR_ADMIN**: Full administrative access to all HR functions
- **MANAGER**: Access to team management and reporting functions
- **EMPLOYEE**: Access to personal information and self-service functions

## Authentication Endpoints

| Endpoint | Method | HR_ADMIN | MANAGER | EMPLOYEE | Notes |
|----------|--------|----------|---------|----------|-------|
| `/api/auth/register` | POST | ✓ | ✗ | ✗ | HR Admin can create new user accounts |
| `/api/auth/login` | POST | ✓ | ✓ | ✓ | Public endpoint for authentication |
| `/api/auth/logout` | POST | ✓ | ✓ | ✓ | Authenticated users can logout |
| `/api/auth/refresh` | POST | ✓ | ✓ | ✓ | Refresh access token |
| `/api/auth/me` | GET | ✓ | ✓ | ✓ | Get current user profile |

## Onboarding Endpoints

| Endpoint | Method | HR_ADMIN | MANAGER | EMPLOYEE | Notes |
|----------|--------|----------|---------|----------|-------|
| `/api/onboarding/templates` | POST | ✓ | ✗ | ✗ | HR Admin only - create onboarding templates |
| `/api/onboarding/templates` | GET | ✓ | ✓ | ✗ | HR Admin and Manager can view templates |
| `/api/onboarding/workflows` | POST | ✓ | ✗ | ✗ | HR Admin only - assign onboarding workflow to employee |
| `/api/onboarding/my-tasks` | GET | ✗ | ✗ | ✓ | Employee only - view own assigned onboarding tasks |
| `/api/onboarding/tasks/:id` | PATCH | ✗ | ✗ | ✓ | Employee only - mark own tasks as complete, upload documents |
| `/api/onboarding/team-progress` | GET | ✗ | ✓ | ✗ | Manager only - view onboarding progress for supervised team members |

## Data Access Rules

### Onboarding Module

#### Employee Access
- **Own Tasks Only**: Employees can only access onboarding tasks assigned to them
- **Task Completion**: Employees can only mark their own tasks as complete
- **Document Upload**: Employees can only upload documents for their own tasks
- **No Template Access**: Employees cannot view or create onboarding templates
- **No Team Visibility**: Employees cannot view other employees' onboarding progress

#### Manager Access
- **Team Progress Only**: Managers can only view onboarding progress for employees they directly supervise
- **Read-Only Templates**: Managers can view onboarding templates but cannot create or modify them
- **No Task Modification**: Managers cannot complete tasks on behalf of employees
- **Supervised Team Filter**: All team progress queries are automatically filtered to show only supervised employees

#### HR Admin Access
- **Full Template Control**: HR Admins can create, view, update, and delete onboarding templates
- **Workflow Assignment**: HR Admins can assign onboarding workflows to any employee
- **Organization-Wide Visibility**: HR Admins can view onboarding progress for all employees
- **No Task Completion**: HR Admins cannot complete tasks on behalf of employees (tasks must be completed by assigned employee)

### Cross-Module Rules

- **User ID Validation**: All endpoints validate that the authenticated user's ID matches the user ID in the JWT token
- **Role Verification**: User roles are verified against the database on each request to prevent privilege escalation
- **Resource Ownership**: Endpoints that access user-specific resources verify ownership before allowing access
- **Manager Hierarchy**: Manager access is restricted to direct reports only, not transitive reports

## Implementation Notes

### Middleware Stack

All protected endpoints use the following middleware stack:

1. `authenticate` - Verifies JWT token and extracts user information
2. `authorize([roles])` - Checks if user has one of the allowed roles
3. Custom authorization logic (if needed) - Additional checks for resource ownership or team membership

### Authorization Patterns

#### Role-Based Access Control (RBAC)