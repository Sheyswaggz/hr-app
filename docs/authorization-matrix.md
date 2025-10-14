# Authorization Matrix

## Overview

This document defines the role-based access control (RBAC) permissions for the HR Application. It specifies which user roles can access which endpoints and what operations they can perform on different resources.

**Last Updated:** 2025-10-12  
**Version:** 1.0.0

## User Roles

The system supports three distinct user roles with hierarchical permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| **HR Admin** | Full system administrator with unrestricted access to all features and data | Highest |
| **Manager** | Team lead with access to team management, performance reviews, and leave approvals for direct reports | Medium |
| **Employee** | Standard user with access to personal information and self-service features | Basic |

## Permission Levels

- ✅ **Full Access**: Can perform all CRUD operations (Create, Read, Update, Delete)
- 📖 **Read Only**: Can view data but cannot modify
- 🔒 **Restricted**: Can only access own data or data of direct reports
- ❌ **No Access**: Cannot access the endpoint or resource

## Authentication Endpoints

All authentication endpoints are publicly accessible (no authentication required).

| Endpoint | Method | HR Admin | Manager | Employee | Public | Description |
|----------|--------|----------|---------|----------|--------|-------------|
| `/api/auth/register` | POST | ✅ | ✅ | ✅ | ✅ | User registration |
| `/api/auth/login` | POST | ✅ | ✅ | ✅ | ✅ | User login |
| `/api/auth/logout` | POST | ✅ | ✅ | ✅ | ✅ | User logout |
| `/api/auth/refresh` | POST | ✅ | ✅ | ✅ | ✅ | Token refresh |
| `/api/auth/forgot-password` | POST | ✅ | ✅ | ✅ | ✅ | Password reset request |
| `/api/auth/reset-password` | POST | ✅ | ✅ | ✅ | ✅ | Password reset confirmation |
| `/api/auth/verify-email` | POST | ✅ | ✅ | ✅ | ✅ | Email verification |

## User Management Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/users` | GET | ✅ | 📖 | 🔒 | List all users | **HR Admin**: All users<br>**Manager**: Direct reports only<br>**Employee**: Own profile only |
| `/api/users/:id` | GET | ✅ | 🔒 | 🔒 | Get user by ID | **HR Admin**: Any user<br>**Manager**: Self or direct reports<br>**Employee**: Self only |
| `/api/users` | POST | ✅ | ❌ | ❌ | Create new user | HR Admin only |
| `/api/users/:id` | PUT | ✅ | 🔒 | 🔒 | Update user | **HR Admin**: Any user<br>**Manager**: Self only<br>**Employee**: Self only (limited fields) |
| `/api/users/:id` | DELETE | ✅ | ❌ | ❌ | Delete user | HR Admin only |
| `/api/users/:id/role` | PATCH | ✅ | ❌ | ❌ | Update user role | HR Admin only |
| `/api/users/:id/activate` | PATCH | ✅ | ❌ | ❌ | Activate user account | HR Admin only |
| `/api/users/:id/deactivate` | PATCH | ✅ | ❌ | ❌ | Deactivate user account | HR Admin only |

## Employee Management Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/employees` | GET | ✅ | 📖 | 🔒 | List all employees | **HR Admin**: All employees<br>**Manager**: Direct reports only<br>**Employee**: Own record only |
| `/api/employees/:id` | GET | ✅ | 🔒 | 🔒 | Get employee by ID | **HR Admin**: Any employee<br>**Manager**: Self or direct reports<br>**Employee**: Self only |
| `/api/employees` | POST | ✅ | ❌ | ❌ | Create employee record | HR Admin only |
| `/api/employees/:id` | PUT | ✅ | 🔒 | 🔒 | Update employee record | **HR Admin**: Any employee<br>**Manager**: Limited fields for direct reports<br>**Employee**: Limited personal fields only |
| `/api/employees/:id` | DELETE | ✅ | ❌ | ❌ | Delete employee record | HR Admin only |
| `/api/employees/:id/status` | PATCH | ✅ | ❌ | ❌ | Update employment status | HR Admin only |
| `/api/employees/:id/manager` | PATCH | ✅ | ❌ | ❌ | Assign/change manager | HR Admin only |
| `/api/employees/:id/department` | PATCH | ✅ | ❌ | ❌ | Change department | HR Admin only |

## Department Management Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/departments` | GET | ✅ | 📖 | 📖 | List all departments | All authenticated users can view |
| `/api/departments/:id` | GET | ✅ | 📖 | 📖 | Get department by ID | All authenticated users can view |
| `/api/departments` | POST | ✅ | ❌ | ❌ | Create department | HR Admin only |
| `/api/departments/:id` | PUT | ✅ | ❌ | ❌ | Update department | HR Admin only |
| `/api/departments/:id` | DELETE | ✅ | ❌ | ❌ | Delete department | HR Admin only |
| `/api/departments/:id/head` | PATCH | ✅ | ❌ | ❌ | Assign department head | HR Admin only |

## Performance Review Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/reviews` | GET | ✅ | 🔒 | 🔒 | List performance reviews | **HR Admin**: All reviews<br>**Manager**: Reviews for direct reports<br>**Employee**: Own reviews only |
| `/api/reviews/:id` | GET | ✅ | 🔒 | 🔒 | Get review by ID | **HR Admin**: Any review<br>**Manager**: Reviews for direct reports<br>**Employee**: Own reviews only |
| `/api/reviews` | POST | ✅ | 🔒 | ❌ | Create performance review | **HR Admin**: For any employee<br>**Manager**: For direct reports only |
| `/api/reviews/:id` | PUT | ✅ | 🔒 | ❌ | Update review | **HR Admin**: Any review<br>**Manager**: Own reviews for direct reports (before submission) |
| `/api/reviews/:id` | DELETE | ✅ | 🔒 | ❌ | Delete review | **HR Admin**: Any review<br>**Manager**: Own draft reviews only |
| `/api/reviews/:id/submit` | PATCH | ✅ | 🔒 | ❌ | Submit review | **HR Admin**: Any review<br>**Manager**: Own reviews for direct reports |
| `/api/reviews/:id/approve` | PATCH | ✅ | ❌ | ❌ | Approve review | HR Admin only |

## Leave Request Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/leave-requests` | GET | ✅ | 🔒 | 🔒 | List leave requests | **HR Admin**: All requests<br>**Manager**: Direct reports' requests<br>**Employee**: Own requests only |
| `/api/leave-requests/:id` | GET | ✅ | 🔒 | 🔒 | Get leave request by ID | **HR Admin**: Any request<br>**Manager**: Direct reports' requests<br>**Employee**: Own requests only |
| `/api/leave-requests` | POST | ✅ | ✅ | ✅ | Create leave request | All authenticated users can create for themselves |
| `/api/leave-requests/:id` | PUT | ✅ | 🔒 | 🔒 | Update leave request | **HR Admin**: Any request<br>**Manager**: Own requests<br>**Employee**: Own pending requests only |
| `/api/leave-requests/:id` | DELETE | ✅ | 🔒 | 🔒 | Delete leave request | **HR Admin**: Any request<br>**Manager**: Own requests<br>**Employee**: Own pending requests only |
| `/api/leave-requests/:id/approve` | PATCH | ✅ | 🔒 | ❌ | Approve leave request | **HR Admin**: Any request<br>**Manager**: Direct reports' requests only |
| `/api/leave-requests/:id/reject` | PATCH | ✅ | 🔒 | ❌ | Reject leave request | **HR Admin**: Any request<br>**Manager**: Direct reports' requests only |
| `/api/leave-requests/:id/cancel` | PATCH | ✅ | 🔒 | 🔒 | Cancel leave request | **HR Admin**: Any request<br>**Manager**: Own requests<br>**Employee**: Own approved/pending requests |

## Leave Balance Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/leave-balances` | GET | ✅ | 🔒 | 🔒 | List leave balances | **HR Admin**: All balances<br>**Manager**: Direct reports' balances<br>**Employee**: Own balance only |
| `/api/leave-balances/:id` | GET | ✅ | 🔒 | 🔒 | Get leave balance by ID | **HR Admin**: Any balance<br>**Manager**: Direct reports' balances<br>**Employee**: Own balance only |
| `/api/leave-balances/:employeeId` | GET | ✅ | 🔒 | 🔒 | Get balance by employee | **HR Admin**: Any employee<br>**Manager**: Direct reports only<br>**Employee**: Self only |
| `/api/leave-balances` | POST | ✅ | ❌ | ❌ | Create leave balance | HR Admin only |
| `/api/leave-balances/:id` | PUT | ✅ | ❌ | ❌ | Update leave balance | HR Admin only |
| `/api/leave-balances/:id/adjust` | PATCH | ✅ | ❌ | ❌ | Adjust leave balance | HR Admin only |

## Onboarding Task Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/onboarding-tasks` | GET | ✅ | 🔒 | 🔒 | List onboarding tasks | **HR Admin**: All tasks<br>**Manager**: Direct reports' tasks<br>**Employee**: Own tasks only |
| `/api/onboarding-tasks/:id` | GET | ✅ | 🔒 | 🔒 | Get task by ID | **HR Admin**: Any task<br>**Manager**: Direct reports' tasks<br>**Employee**: Own tasks only |
| `/api/onboarding-tasks` | POST | ✅ | 🔒 | ❌ | Create onboarding task | **HR Admin**: For any employee<br>**Manager**: For direct reports only |
| `/api/onboarding-tasks/:id` | PUT | ✅ | 🔒 | 🔒 | Update task | **HR Admin**: Any task<br>**Manager**: Direct reports' tasks<br>**Employee**: Own tasks (limited fields) |
| `/api/onboarding-tasks/:id` | DELETE | ✅ | 🔒 | ❌ | Delete task | **HR Admin**: Any task<br>**Manager**: Direct reports' tasks |
| `/api/onboarding-tasks/:id/complete` | PATCH | ✅ | 🔒 | 🔒 | Mark task as complete | **HR Admin**: Any task<br>**Manager**: Direct reports' tasks<br>**Employee**: Own tasks only |

## Profile & Self-Service Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Description | Data Access Rules |
|----------|--------|----------|---------|----------|-------------|-------------------|
| `/api/profile` | GET | ✅ | ✅ | ✅ | Get own profile | All authenticated users |
| `/api/profile` | PUT | ✅ | ✅ | ✅ | Update own profile | All authenticated users (limited fields) |
| `/api/profile/password` | PATCH | ✅ | ✅ | ✅ | Change own password | All authenticated users |
| `/api/profile/avatar` | POST | ✅ | ✅ | ✅ | Upload profile picture | All authenticated users |
| `/api/profile/preferences` | PUT | ✅ | ✅ | ✅ | Update preferences | All authenticated users |

## System & Health Endpoints

| Endpoint | Method | HR Admin | Manager | Employee | Public | Description |
|----------|--------|----------|---------|----------|--------|-------------|
| `/api/health` | GET | ✅ | ✅ | ✅ | ✅ | System health check |
| `/api/version` | GET | ✅ | ✅ | ✅ | ✅ | API version info |
| `/api/metrics` | GET | ✅ | ❌ | ❌ | ❌ | System metrics (HR Admin only) |

## Data Access Rules

### General Principles

1. **Principle of Least Privilege**: Users can only access data necessary for their role
2. **Hierarchical Access**: HR Admins > Managers > Employees
3. **Self-Service**: All users can view and update their own information (with field restrictions)
4. **Manager Scope**: Managers can only access data for their direct reports
5. **Audit Trail**: All data modifications are logged with user ID and timestamp

### Field-Level Restrictions

#### Employee Self-Update (Limited Fields)
Employees can only update these fields on their own profile:
- Phone number
- Emergency contact information
- Address
- Profile picture
- Preferences

Employees **cannot** update:
- Employee number
- Job title
- Department
- Manager
- Hire date
- Employment status
- Salary information

#### Manager Update (Limited Fields)
Managers can update these fields for direct reports:
- Job title (with approval workflow)
- Performance notes
- Task assignments
- Leave request approvals

Managers **cannot** update:
- Employee number
- Department
- Manager assignment
- Hire date
- Employment status
- Salary information

### Special Cases and Exceptions

#### 1. Cross-Department Access
- **Rule**: Managers can only access their direct reports, even if in different departments
- **Exception**: HR Admins have cross-department access

#### 2. Former Employees
- **Rule**: Terminated/Resigned employees lose system access immediately
- **Exception**: HR Admins can view historical data for compliance

#### 3. Probation Period
- **Rule**: Employees on probation have same access as active employees
- **Exception**: Some features may be restricted based on business rules

#### 4. Leave Approval Chain
- **Rule**: Leave requests require manager approval
- **Exception**: HR Admins can approve any leave request, bypassing manager

#### 5. Performance Review Visibility
- **Rule**: Employees can view their own completed reviews
- **Exception**: Draft and in-progress reviews are hidden from employees until submitted

#### 6. Sensitive Data
The following data is restricted to HR Admin only:
- Salary and compensation information
- Disciplinary records
- Background check results
- Social security numbers
- Bank account details
- Medical information

#### 7. Bulk Operations
- **Rule**: Bulk operations (import/export) are HR Admin only
- **Exception**: Managers can export their team's data in limited format

#### 8. Historical Data
- **Rule**: Users can view historical data within their access scope
- **Exception**: Data older than 7 years may be archived (HR Admin access only)

## Authorization Implementation

### Middleware Chain

All protected endpoints use the following middleware chain: