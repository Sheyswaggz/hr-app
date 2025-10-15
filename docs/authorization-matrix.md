# Authorization Matrix

This document defines the authorization rules for all API endpoints in the HR application. It specifies which user roles can access each endpoint and any additional data access restrictions.

## Role Hierarchy

The application uses a three-tier role hierarchy:

- **HR_ADMIN** (highest privilege): Full system access, can manage all resources
- **MANAGER**: Can manage team members and view team data
- **EMPLOYEE** (lowest privilege): Can access own data only

Higher-level roles inherit permissions from lower-level roles where hierarchy is applied.

## Authentication Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/auth/register` | POST | Public | N/A |
| `/api/auth/login` | POST | Public | N/A |
| `/api/auth/logout` | POST | Authenticated | N/A |
| `/api/auth/refresh` | POST | Authenticated | N/A |
| `/api/auth/me` | GET | Authenticated | Own user data only |

## User Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/users` | GET | HR_ADMIN | All users |
| `/api/users/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all users<br>MANAGER: team members only<br>EMPLOYEE: own data only |
| `/api/users` | POST | HR_ADMIN | N/A |
| `/api/users/:id` | PATCH | HR_ADMIN, EMPLOYEE | HR_ADMIN: all users<br>EMPLOYEE: own data only |
| `/api/users/:id` | DELETE | HR_ADMIN | All users |

## Employee Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/employees` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all employees<br>MANAGER: team members only |
| `/api/employees/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all employees<br>MANAGER: team members only<br>EMPLOYEE: own data only |
| `/api/employees` | POST | HR_ADMIN | N/A |
| `/api/employees/:id` | PATCH | HR_ADMIN | All employees |
| `/api/employees/:id` | DELETE | HR_ADMIN | All employees |

## Onboarding Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/onboarding/templates` | POST | HR_ADMIN | N/A |
| `/api/onboarding/templates` | GET | HR_ADMIN, MANAGER | All templates |
| `/api/onboarding/templates/:id` | GET | HR_ADMIN, MANAGER | All templates |
| `/api/onboarding/templates/:id` | PATCH | HR_ADMIN | All templates |
| `/api/onboarding/templates/:id` | DELETE | HR_ADMIN | All templates |
| `/api/onboarding/workflows` | POST | HR_ADMIN | N/A |
| `/api/onboarding/workflows` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all workflows<br>MANAGER: team members only |
| `/api/onboarding/workflows/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all workflows<br>MANAGER: team members only<br>EMPLOYEE: own workflow only |
| `/api/onboarding/my-tasks` | GET | EMPLOYEE | Own onboarding tasks only |
| `/api/onboarding/tasks/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all tasks<br>MANAGER: team members' tasks only<br>EMPLOYEE: own tasks only |
| `/api/onboarding/tasks/:id` | PATCH | EMPLOYEE | Own tasks only (task completion and document upload) |
| `/api/onboarding/team-progress` | GET | MANAGER | Team members they supervise only |

## Appraisal Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/appraisals` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all appraisals<br>MANAGER: team members only<br>EMPLOYEE: own appraisals only |
| `/api/appraisals/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all appraisals<br>MANAGER: team members only<br>EMPLOYEE: own appraisals only |
| `/api/appraisals` | POST | HR_ADMIN, MANAGER | N/A |
| `/api/appraisals/:id` | PATCH | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all appraisals<br>MANAGER: team members only<br>EMPLOYEE: own appraisals (self-assessment only) |
| `/api/appraisals/:id` | DELETE | HR_ADMIN | All appraisals |

## Leave Management Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/leave/requests` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all requests<br>MANAGER: team members only<br>EMPLOYEE: own requests only |
| `/api/leave/requests/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all requests<br>MANAGER: team members only<br>EMPLOYEE: own requests only |
| `/api/leave/requests` | POST | EMPLOYEE | N/A |
| `/api/leave/requests/:id` | PATCH | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all requests<br>MANAGER: team members (approval/rejection)<br>EMPLOYEE: own requests (cancellation only) |
| `/api/leave/requests/:id` | DELETE | HR_ADMIN, EMPLOYEE | HR_ADMIN: all requests<br>EMPLOYEE: own requests only |
| `/api/leave/balances` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all balances<br>MANAGER: team members only<br>EMPLOYEE: own balance only |
| `/api/leave/balances/:id` | GET | HR_ADMIN, MANAGER, EMPLOYEE | HR_ADMIN: all balances<br>MANAGER: team members only<br>EMPLOYEE: own balance only |
| `/api/leave/balances/:id` | PATCH | HR_ADMIN | All balances |

## Analytics Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/analytics/dashboard` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all data<br>MANAGER: team data only |
| `/api/analytics/onboarding` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all data<br>MANAGER: team data only |
| `/api/analytics/appraisals` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all data<br>MANAGER: team data only |
| `/api/analytics/leave` | GET | HR_ADMIN, MANAGER | HR_ADMIN: all data<br>MANAGER: team data only |
| `/api/analytics/export` | POST | HR_ADMIN, MANAGER | HR_ADMIN: all data<br>MANAGER: team data only |

## Health Check Endpoints

| Endpoint | Method | Allowed Roles | Data Access Rules |
|----------|--------|---------------|-------------------|
| `/api/health` | GET | Public | N/A |
| `/api/health/ready` | GET | Public | N/A |
| `/api/health/live` | GET | Public | N/A |

## Data Access Rules Summary

### Employee Data Access
- **Employees** can only access their own data (profile, tasks, appraisals, leave requests)
- **Managers** can access data for employees they directly supervise
- **HR Admins** have unrestricted access to all employee data

### Manager Supervision Rules
- Managers can only view and manage data for employees in their reporting hierarchy
- Manager-employee relationships are defined in the `employees` table via the `manager_id` foreign key
- Managers cannot access data for employees outside their team

### Onboarding Task Access
- **Employees** can only view and complete their own assigned onboarding tasks
- **Employees** can upload documents only for their own tasks
- **Managers** can view onboarding progress for their team members but cannot modify tasks
- **HR Admins** can create, view, and manage all onboarding workflows and tasks

### Document Upload Restrictions
- Only the employee assigned to a task can upload documents for that task
- Document uploads are validated for file type (PDF, DOC, DOCX, JPG, PNG) and size (max 10MB)
- Uploaded documents are associated with the specific task and employee

### Leave Request Approval
- **Employees** can create and cancel their own leave requests
- **Managers** can approve or reject leave requests for their team members
- **HR Admins** can approve, reject, or delete any leave request

### Appraisal Access
- **Employees** can complete self-assessments for their own appraisals
- **Managers** can create appraisals and provide reviews for their team members
- **HR Admins** can create, view, and manage all appraisals

## Implementation Notes

### Middleware Stack
All protected endpoints use the following middleware stack:
1. `authenticate` - Verifies JWT token and attaches user to request
2. `authorize([roles])` - Checks if user has required role
3. Route handler - Implements additional data access checks

### Data Access Enforcement
Data access rules are enforced at multiple levels:
1. **Route level**: Role-based authorization middleware
2. **Service level**: Query filters based on user role and relationships
3. **Database level**: Foreign key constraints and row-level security

### Audit Logging
All authorization decisions are logged with:
- User ID and role
- Requested resource and action
- Authorization result (granted/denied)
- Timestamp and correlation ID

### Security Considerations
- All endpoints require HTTPS in production
- Rate limiting applied to all authenticated endpoints
- CSRF protection enabled for state-changing operations
- Input validation performed before authorization checks
- SQL injection prevented through parameterized queries