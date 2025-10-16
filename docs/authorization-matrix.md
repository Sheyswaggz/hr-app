# Authorization Matrix

This document defines the role-based access control (RBAC) matrix for the HR Management Application. It specifies which roles can access which endpoints and what operations they can perform.

## Role Hierarchy

- **HR_ADMIN**: Highest privilege level, full system access
- **MANAGER**: Mid-level privilege, can manage team members
- **EMPLOYEE**: Base privilege level, can access own resources

## Authentication Endpoints

| Endpoint | Method | HR_ADMIN | MANAGER | EMPLOYEE | Notes |
|----------|--------|----------|---------|----------|-------|
| `/api/auth/register` | POST | ✅ | ❌ | ❌ | HR Admin can create new users |
| `/api/auth/login` | POST | ✅ | ✅ | ✅ | Public endpoint for all users |
| `/api/auth/logout` | POST | ✅ | ✅ | ✅ | Authenticated users can logout |
| `/api/auth/me` | GET | ✅ | ✅ | ✅ | Get current user profile |
| `/api/auth/refresh` | POST | ✅ | ✅ | ✅ | Refresh authentication token |

## Onboarding Endpoints

| Endpoint | Method | HR_ADMIN | MANAGER | EMPLOYEE | Notes |
|----------|--------|----------|---------|----------|-------|
| `/api/onboarding/tasks` | GET | ✅ | ✅ | ✅ | Employees see own tasks, Managers see team tasks, HR sees all |
| `/api/onboarding/tasks` | POST | ✅ | ✅ | ❌ | Create onboarding task for team member |
| `/api/onboarding/tasks/:id` | GET | ✅ | ✅ | ✅ | View specific task (with ownership rules) |
| `/api/onboarding/tasks/:id` | PATCH | ✅ | ✅ | ✅ | Update task (employees can update own tasks) |
| `/api/onboarding/tasks/:id` | DELETE | ✅ | ✅ | ❌ | Delete onboarding task |
| `/api/onboarding/tasks/:id/complete` | POST | ✅ | ✅ | ✅ | Mark task as complete (employees can complete own tasks) |
| `/api/onboarding/templates` | GET | ✅ | ✅ | ❌ | View onboarding templates |
| `/api/onboarding/templates` | POST | ✅ | ❌ | ❌ | Create onboarding template |
| `/api/onboarding/templates/:id` | GET | ✅ | ✅ | ❌ | View specific template |
| `/api/onboarding/templates/:id` | PATCH | ✅ | ❌ | ❌ | Update template |
| `/api/onboarding/templates/:id` | DELETE | ✅ | ❌ | ❌ | Delete template |

## Appraisal Endpoints

| Endpoint | Method | HR_ADMIN | MANAGER | EMPLOYEE | Notes |
|----------|--------|----------|---------|----------|-------|
| `/api/appraisals` | POST | ❌ | ✅ | ❌ | Manager initiates appraisal cycle for team members |
| `/api/appraisals/:id` | GET | ✅ | ✅ (team only) | ✅ (own only) | Employee can view own appraisals, Manager can view team appraisals, HR Admin can view all |
| `/api/appraisals/my-appraisals` | GET | ❌ | ❌ | ✅ | Employee views their appraisal history |
| `/api/appraisals/team` | GET | ❌ | ✅ | ❌ | Manager views team appraisals |
| `/api/appraisals` | GET | ✅ | ❌ | ❌ | HR Admin views all appraisals |
| `/api/appraisals/:id/self-assessment` | PATCH | ❌ | ❌ | ✅ (own only) | Employee submits self-assessment for own appraisal |
| `/api/appraisals/:id/review` | PATCH | ❌ | ✅ (team only) | ❌ | Manager submits review feedback and rating for team member |
| `/api/appraisals/:id/goals` | PATCH | ✅ | ✅ (team only) | ✅ (own only) | Manager or Employee can update goals based on ownership |

## Data Access Rules

### Onboarding Tasks
- **Employees**: Can only view and update their own onboarding tasks
- **Managers**: Can view and manage tasks for their direct reports
- **HR Admins**: Can view and manage all onboarding tasks across the organization

### Onboarding Templates
- **Employees**: No access to templates
- **Managers**: Can view templates to understand onboarding workflows
- **HR Admins**: Full CRUD access to templates

### Appraisals
- **Employees**: Can only access their own appraisals, submit self-assessments, and update their own goals
- **Managers**: Can only initiate appraisal cycles for and review team members they directly supervise, can update goals for team members
- **HR Admins**: Can view all appraisals across the organization for reporting and oversight purposes

## Authorization Implementation

The authorization is implemented using middleware in `src/middleware/authorize.ts`:

- `authorize(roles)`: Generic authorization middleware that checks if user has one of the specified roles
- `requireHRAdmin`: Shorthand for HR Admin only access
- `requireManager`: Shorthand for Manager or HR Admin access (using hierarchy)
- `requireEmployee`: Shorthand for any authenticated user
- `createOwnerOrElevatedMiddleware`: Custom middleware for resource ownership checks

## Special Authorization Cases

### Resource Ownership
Some endpoints require additional ownership checks beyond role-based access:

1. **Own Resource Access**: Employees can access their own resources (tasks, appraisals)
2. **Team Resource Access**: Managers can access resources for their direct reports
3. **Elevated Access**: HR Admins can access all resources regardless of ownership

### Appraisal Workflow Authorization
The appraisal system enforces specific workflow-based authorization:

1. **Cycle Initiation**: Only Managers can initiate appraisal cycles for their team members
2. **Self-Assessment**: Only the Employee being appraised can submit self-assessment
3. **Manager Review**: Only the assigned Manager can submit review and rating
4. **Goal Management**: Both Manager and Employee can update goals based on ownership context
5. **Status Transitions**: Enforced through state machine validation (draft → submitted → completed)

## Security Considerations

1. **Authentication Required**: All endpoints except `/api/auth/login` and `/api/auth/register` require valid JWT authentication
2. **Role Validation**: Roles are validated against the user's JWT token claims
3. **Resource Ownership**: Additional checks ensure users can only access resources they own or manage
4. **Audit Logging**: All authorization attempts (success and failure) are logged with correlation IDs
5. **Input Validation**: All inputs are validated before authorization checks to prevent injection attacks
6. **SQL Injection Prevention**: Parameterized queries used throughout to prevent SQL injection
7. **Data Isolation**: Database queries include role-based filtering to ensure data isolation

## Error Responses

Authorization failures return standardized error responses: