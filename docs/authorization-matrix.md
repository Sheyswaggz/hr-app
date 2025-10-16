# Authorization Matrix

This document defines the authorization rules for all API endpoints in the HR Management Application. It specifies which user roles can access which endpoints and what data access restrictions apply.

## Role Hierarchy

The application uses a three-tier role hierarchy:

1. **HR_ADMIN** (highest privilege)
   - Full access to all system features
   - Can manage all users, employees, and organizational data
   - Can override most business rules when necessary

2. **MANAGER** (middle privilege)
   - Can manage their direct reports
   - Can approve/reject requests from team members
   - Can view team-level reports and analytics

3. **EMPLOYEE** (base privilege)
   - Can manage their own data
   - Can submit requests requiring approval
   - Can view their own records and history

## Authorization Rules

### Authentication Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/auth/register` | POST | Public | N/A |
| `/api/auth/login` | POST | Public | N/A |
| `/api/auth/logout` | POST | Authenticated | N/A |
| `/api/auth/refresh` | POST | Authenticated | N/A |
| `/api/auth/me` | GET | Authenticated | Own profile only |

### User Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/users` | GET | HR_ADMIN | All users |
| `/api/users/:id` | GET | HR_ADMIN, Owner | HR_ADMIN: all users; Owner: own profile only |
| `/api/users` | POST | HR_ADMIN | N/A |
| `/api/users/:id` | PATCH | HR_ADMIN, Owner | HR_ADMIN: all users; Owner: own profile only (limited fields) |
| `/api/users/:id` | DELETE | HR_ADMIN | All users |

### Employee Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/employees` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all employees; MANAGER: team members only |
| `/api/employees/:id` | GET | HR_ADMIN, MANAGER, Owner | HR_ADMIN: all employees; MANAGER: team members; Owner: own record |
| `/api/employees` | POST | HR_ADMIN | N/A |
| `/api/employees/:id` | PATCH | HR_ADMIN | All employees |
| `/api/employees/:id` | DELETE | HR_ADMIN | All employees |

### Onboarding Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/onboarding/templates` | GET | HR_ADMIN, MANAGER | All templates |
| `/api/onboarding/templates/:id` | GET | HR_ADMIN, MANAGER | All templates |
| `/api/onboarding/templates` | POST | HR_ADMIN | N/A |
| `/api/onboarding/templates/:id` | PATCH | HR_ADMIN | All templates |
| `/api/onboarding/templates/:id` | DELETE | HR_ADMIN | All templates |
| `/api/onboarding/workflows` | POST | HR_ADMIN, MANAGER | N/A |
| `/api/onboarding/workflows/:id` | GET | HR_ADMIN, MANAGER, Assignee | HR_ADMIN/MANAGER: all workflows; Assignee: assigned workflows only |
| `/api/onboarding/my-tasks` | GET | EMPLOYEE | Own tasks only |
| `/api/onboarding/tasks/:id` | GET | HR_ADMIN, MANAGER, Assignee | HR_ADMIN/MANAGER: all tasks; Assignee: assigned tasks only |
| `/api/onboarding/tasks/:id` | PATCH | HR_ADMIN, MANAGER, Assignee | HR_ADMIN/MANAGER: all tasks; Assignee: can only update status/notes |
| `/api/onboarding/team-progress` | GET | MANAGER | Team members only |

### Appraisal Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/appraisals` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all appraisals; MANAGER: team appraisals only |
| `/api/appraisals/:id` | GET | HR_ADMIN, MANAGER, Owner | HR_ADMIN: all; MANAGER: team only; Owner: own appraisal |
| `/api/appraisals` | POST | HR_ADMIN, MANAGER | Can create for team members only |
| `/api/appraisals/:id/self-assessment` | PATCH | Owner | Own appraisal only |
| `/api/appraisals/:id/manager-review` | PATCH | MANAGER | Team member appraisals only |
| `/api/appraisals/:id/submit` | PATCH | Owner, MANAGER | Owner: submit self-assessment; MANAGER: submit review |
| `/api/appraisals/my-appraisals` | GET | EMPLOYEE | Own appraisals only |

### Leave Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/leave/requests` | POST | EMPLOYEE | N/A |
| `/api/leave/requests/:id` | GET | EMPLOYEE, MANAGER | EMPLOYEE: own requests only; MANAGER: team requests only |
| `/api/leave/my-requests` | GET | EMPLOYEE | Own requests only |
| `/api/leave/team-requests` | GET | MANAGER | Team member requests only |
| `/api/leave/requests/:id/approve` | PATCH | MANAGER | Team member requests only |
| `/api/leave/requests/:id/reject` | PATCH | MANAGER | Team member requests only |
| `/api/leave/my-balance` | GET | EMPLOYEE | Own balance only |

## Data Access Rules

### Employee Data Access

- **HR_ADMIN**: Can access all employee records without restriction
- **MANAGER**: Can only access records of direct reports (employees where manager_id matches the manager's user_id)
- **EMPLOYEE**: Can only access their own employee record

### Leave Request Access

- **EMPLOYEE**: Can only view and create their own leave requests
- **MANAGER**: Can view and approve/reject leave requests from team members (employees where manager_id matches the manager's user_id)
- **HR_ADMIN**: Can view all leave requests (read-only, cannot approve/reject)

### Leave Balance Access

- **EMPLOYEE**: Can only view their own leave balance
- **MANAGER**: Can view leave balances of team members
- **HR_ADMIN**: Can view all leave balances

### Appraisal Access

- **EMPLOYEE**: Can view and submit self-assessments for their own appraisals
- **MANAGER**: Can view, create, and submit reviews for team member appraisals
- **HR_ADMIN**: Can view all appraisals and override any restrictions

### Onboarding Task Access

- **EMPLOYEE**: Can view and update tasks assigned to them
- **MANAGER**: Can view and manage all tasks for team members
- **HR_ADMIN**: Can view and manage all onboarding tasks

## Authorization Implementation

### Middleware Chain

All protected endpoints use the following middleware chain:

1. `authenticate` - Verifies JWT token and attaches user to request
2. `authorize([roles])` - Checks if user has required role
3. Route handler - Implements business logic with data access checks

### Data Access Validation

In addition to role-based authorization, route handlers must implement data access validation: