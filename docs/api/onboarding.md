# Onboarding API Documentation

## Overview

The Onboarding API provides comprehensive endpoints for managing employee onboarding workflows, including template creation, workflow assignment, task management, and progress tracking. This API enables HR administrators to create structured onboarding processes, managers to monitor team progress, and employees to complete assigned tasks.

**Base URL:** `/api/onboarding`

**Authentication:** All endpoints require JWT Bearer token authentication.

**Content-Type:** `application/json` (except file upload endpoints which use `multipart/form-data`)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Template Management](#template-management)
3. [Workflow Management](#workflow-management)
4. [Employee Tasks](#employee-tasks)
5. [Progress Monitoring](#progress-monitoring)
6. [Data Models](#data-models)
7. [Error Responses](#error-responses)
8. [Workflow Diagrams](#workflow-diagrams)

---

## Authentication & Authorization

### Authentication

All API requests must include a valid JWT access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Authorization Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `HR_ADMIN` | HR Administrator | Full access to all onboarding endpoints |
| `MANAGER` | Team Manager | Read access to templates, team progress monitoring |
| `EMPLOYEE` | Employee | Access to own tasks and task completion |

### Role Hierarchy

The API implements hierarchical role-based access control:
- `HR_ADMIN` has all permissions of `MANAGER` and `EMPLOYEE`
- `MANAGER` has all permissions of `EMPLOYEE`

---

## Template Management

### Create Onboarding Template

Create a new onboarding template with multiple tasks.

**Endpoint:** `POST /api/onboarding/templates`

**Authorization:** `HR_ADMIN` only

**Request Body Schema:**

```json
{
  "type": "object",
  "required": ["name", "description", "tasks", "estimatedDays"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200,
      "description": "Template name"
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000,
      "description": "Template description"
    },
    "tasks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["title", "description", "daysUntilDue", "order", "requiresDocument"],
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200,
            "description": "Task title"
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000,
            "description": "Task description"
          },
          "daysUntilDue": {
            "type": "integer",
            "minimum": 1,
            "description": "Number of days from workflow start until task is due"
          },
          "order": {
            "type": "integer",
            "minimum": 1,
            "description": "Task order in the workflow"
          },
          "requiresDocument": {
            "type": "boolean",
            "description": "Whether task requires document upload"
          }
        }
      }
    },
    "departmentId": {
      "type": "string",
      "format": "uuid",
      "description": "Optional department identifier"
    },
    "estimatedDays": {
      "type": "integer",
      "minimum": 1,
      "description": "Estimated days to complete entire workflow"
    }
  }
}
```

**Example Request (cURL):**

```bash
curl -X POST https://api.example.com/api/onboarding/templates \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: req_12345" \
  -d '{
    "name": "Software Engineer Onboarding",
    "description": "Standard onboarding process for new software engineers",
    "tasks": [
      {
        "title": "Complete HR paperwork",
        "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
        "daysUntilDue": 1,
        "order": 1,
        "requiresDocument": true
      },
      {
        "title": "Setup development environment",
        "description": "Install required software and configure development tools",
        "daysUntilDue": 3,
        "order": 2,
        "requiresDocument": false
      },
      {
        "title": "Complete security training",
        "description": "Watch security training videos and pass the quiz",
        "daysUntilDue": 5,
        "order": 3,
        "requiresDocument": true
      }
    ],
    "departmentId": "d7f8e9a0-1234-5678-9abc-def012345678",
    "estimatedDays": 30
  }'
```

**Example Request (JavaScript):**

```javascript
const response = await fetch('https://api.example.com/api/onboarding/templates', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Correlation-ID': 'req_12345'
  },
  body: JSON.stringify({
    name: 'Software Engineer Onboarding',
    description: 'Standard onboarding process for new software engineers',
    tasks: [
      {
        title: 'Complete HR paperwork',
        description: 'Fill out tax forms, benefits enrollment, and emergency contacts',
        daysUntilDue: 1,
        order: 1,
        requiresDocument: true
      },
      {
        title: 'Setup development environment',
        description: 'Install required software and configure development tools',
        daysUntilDue: 3,
        order: 2,
        requiresDocument: false
      },
      {
        title: 'Complete security training',
        description: 'Watch security training videos and pass the quiz',
        daysUntilDue: 5,
        order: 3,
        requiresDocument: true
      }
    ],
    departmentId: 'd7f8e9a0-1234-5678-9abc-def012345678',
    estimatedDays: 30
  })
});

const data = await response.json();
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "name": "Software Engineer Onboarding",
    "description": "Standard onboarding process for new software engineers",
    "tasks": [
      {
        "id": "t1a2b3c4-5678-90ab-cdef-1234567890ab",
        "title": "Complete HR paperwork",
        "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
        "daysUntilDue": 1,
        "order": 1,
        "requiresDocument": true
      },
      {
        "id": "t2a2b3c4-5678-90ab-cdef-1234567890ab",
        "title": "Setup development environment",
        "description": "Install required software and configure development tools",
        "daysUntilDue": 3,
        "order": 2,
        "requiresDocument": false
      },
      {
        "id": "t3a2b3c4-5678-90ab-cdef-1234567890ab",
        "title": "Complete security training",
        "description": "Watch security training videos and pass the quiz",
        "daysUntilDue": 5,
        "order": 3,
        "requiresDocument": true
      }
    ],
    "departmentId": "d7f8e9a0-1234-5678-9abc-def012345678",
    "estimatedDays": 30,
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request body or validation errors |
| 400 | `VALIDATION_ERROR` | Task validation failed (title too long, invalid dates, etc.) |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | User does not have HR_ADMIN role |
| 500 | `INTERNAL_ERROR` | Server error during template creation |

---

### Get All Templates

Retrieve all onboarding templates with optional filtering and pagination.

**Endpoint:** `GET /api/onboarding/templates`

**Authorization:** `HR_ADMIN`, `MANAGER`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-indexed) |
| `limit` | integer | No | 20 | Items per page (max: 100) |
| `activeOnly` | boolean | No | false | Filter to active templates only |
| `departmentId` | string (UUID) | No | - | Filter by department |

**Example Request (cURL):**

```bash
curl -X GET "https://api.example.com/api/onboarding/templates?page=1&limit=20&activeOnly=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-Correlation-ID: req_12346"
```

**Example Request (JavaScript):**

```javascript
const params = new URLSearchParams({
  page: '1',
  limit: '20',
  activeOnly: 'true'
});

const response = await fetch(`https://api.example.com/api/onboarding/templates?${params}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Correlation-ID': 'req_12346'
  }
});

const data = await response.json();
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "name": "Software Engineer Onboarding",
      "description": "Standard onboarding process for new software engineers",
      "tasks": [
        {
          "id": "t1a2b3c4-5678-90ab-cdef-1234567890ab",
          "title": "Complete HR paperwork",
          "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
          "daysUntilDue": 1,
          "order": 1,
          "requiresDocument": true
        }
      ],
      "departmentId": "d7f8e9a0-1234-5678-9abc-def012345678",
      "estimatedDays": 30,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "timestamp": "2025-01-15T10:35:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | User does not have required role |
| 500 | `INTERNAL_ERROR` | Server error during template retrieval |

---

## Workflow Management

### Assign Workflow to Employee

Assign an onboarding workflow to a new employee based on a template.

**Endpoint:** `POST /api/onboarding/workflows`

**Authorization:** `HR_ADMIN` only

**Request Body Schema:**

```json
{
  "type": "object",
  "required": ["employeeId", "templateId"],
  "properties": {
    "employeeId": {
      "type": "string",
      "format": "uuid",
      "description": "Employee identifier"
    },
    "templateId": {
      "type": "string",
      "format": "uuid",
      "description": "Template identifier"
    },
    "targetCompletionDate": {
      "type": "string",
      "format": "date-time",
      "description": "Optional target completion date (must be future date)"
    },
    "taskOverrides": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["order"],
        "properties": {
          "order": {
            "type": "integer",
            "minimum": 1,
            "description": "Task order to override"
          },
          "dueDate": {
            "type": "string",
            "format": "date-time",
            "description": "Override due date for this task"
          },
          "title": {
            "type": "string",
            "maxLength": 200,
            "description": "Override task title"
          },
          "description": {
            "type": "string",
            "maxLength": 2000,
            "description": "Override task description"
          }
        }
      }
    }
  }
}
```

**Example Request (cURL):**

```bash
curl -X POST https://api.example.com/api/onboarding/workflows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: req_12347" \
  -d '{
    "employeeId": "e1f2g3h4-5678-90ab-cdef-1234567890ab",
    "templateId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "targetCompletionDate": "2025-02-15T00:00:00.000Z",
    "taskOverrides": [
      {
        "order": 1,
        "dueDate": "2025-01-16T17:00:00.000Z"
      }
    ]
  }'
```

**Example Request (JavaScript):**

```javascript
const response = await fetch('https://api.example.com/api/onboarding/workflows', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Correlation-ID': 'req_12347'
  },
  body: JSON.stringify({
    employeeId: 'e1f2g3h4-5678-90ab-cdef-1234567890ab',
    templateId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    targetCompletionDate: '2025-02-15T00:00:00.000Z',
    taskOverrides: [
      {
        order: 1,
        dueDate: '2025-01-16T17:00:00.000Z'
      }
    ]
  })
});

const data = await response.json();
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Workflow assigned successfully",
  "data": {
    "id": "w1x2y3z4-5678-90ab-cdef-1234567890ab",
    "employeeId": "e1f2g3h4-5678-90ab-cdef-1234567890ab",
    "templateId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "status": "IN_PROGRESS",
    "targetCompletionDate": "2025-02-15T00:00:00.000Z",
    "tasks": [
      {
        "id": "wt1a2b3c-5678-90ab-cdef-1234567890ab",
        "title": "Complete HR paperwork",
        "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
        "dueDate": "2025-01-16T17:00:00.000Z",
        "order": 1,
        "requiresDocument": true,
        "status": "PENDING",
        "completedAt": null,
        "documentUrl": null
      },
      {
        "id": "wt2a2b3c-5678-90ab-cdef-1234567890ab",
        "title": "Setup development environment",
        "description": "Install required software and configure development tools",
        "dueDate": "2025-01-18T00:00:00.000Z",
        "order": 2,
        "requiresDocument": false,
        "status": "PENDING",
        "completedAt": null,
        "documentUrl": null
      }
    ],
    "progress": {
      "totalTasks": 3,
      "completedTasks": 0,
      "percentComplete": 0
    },
    "createdAt": "2025-01-15T10:40:00.000Z",
    "updatedAt": "2025-01-15T10:40:00.000Z"
  },
  "timestamp": "2025-01-15T10:40:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid request body |
| 400 | `WORKFLOW_EXISTS` | Employee already has an active workflow |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | User does not have HR_ADMIN role |
| 404 | `EMPLOYEE_NOT_FOUND` | Employee does not exist |
| 404 | `TEMPLATE_NOT_FOUND` | Template does not exist |
| 500 | `INTERNAL_ERROR` | Server error during workflow assignment |

---

## Employee Tasks

### Get My Onboarding Tasks

Retrieve all onboarding tasks assigned to the authenticated employee.

**Endpoint:** `GET /api/onboarding/my-tasks`

**Authorization:** `HR_ADMIN`, `MANAGER`, `EMPLOYEE`

**Query Parameters:** None

**Example Request (cURL):**

```bash
curl -X GET https://api.example.com/api/onboarding/my-tasks \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-Correlation-ID: req_12348"
```

**Example Request (JavaScript):**

```javascript
const response = await fetch('https://api.example.com/api/onboarding/my-tasks', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Correlation-ID': 'req_12348'
  }
});

const data = await response.json();
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "wt1a2b3c-5678-90ab-cdef-1234567890ab",
      "workflowId": "w1x2y3z4-5678-90ab-cdef-1234567890ab",
      "title": "Complete HR paperwork",
      "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
      "dueDate": "2025-01-16T17:00:00.000Z",
      "order": 1,
      "requiresDocument": true,
      "status": "PENDING",
      "completedAt": null,
      "documentUrl": null,
      "createdAt": "2025-01-15T10:40:00.000Z",
      "updatedAt": "2025-01-15T10:40:00.000Z"
    },
    {
      "id": "wt2a2b3c-5678-90ab-cdef-1234567890ab",
      "workflowId": "w1x2y3z4-5678-90ab-cdef-1234567890ab",
      "title": "Setup development environment",
      "description": "Install required software and configure development tools",
      "dueDate": "2025-01-18T00:00:00.000Z",
      "order": 2,
      "requiresDocument": false,
      "status": "PENDING",
      "completedAt": null,
      "documentUrl": null,
      "createdAt": "2025-01-15T10:40:00.000Z",
      "updatedAt": "2025-01-15T10:40:00.000Z"
    }
  ],
  "timestamp": "2025-01-15T11:00:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 500 | `INTERNAL_ERROR` | Server error during task retrieval |

---

### Complete Onboarding Task

Mark an onboarding task as complete and optionally upload a document.

**Endpoint:** `PATCH /api/onboarding/tasks/:id`

**Authorization:** `HR_ADMIN`, `MANAGER`, `EMPLOYEE` (own tasks only)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Task identifier |

**Request Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | File | Conditional | Document file (required if task requires document) |

**File Upload Specifications:**

- **Max File Size:** 10MB
- **Allowed Types:** PDF, DOC, DOCX, JPG, PNG
- **MIME Types:** `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`, `image/png`

**Example Request (cURL):**

```bash
curl -X PATCH https://api.example.com/api/onboarding/tasks/wt1a2b3c-5678-90ab-cdef-1234567890ab \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-Correlation-ID: req_12349" \
  -F "document=@/path/to/hr_paperwork.pdf"
```

**Example Request (JavaScript with FormData):**

```javascript
const formData = new FormData();
formData.append('document', fileInput.files[0]);

const response = await fetch('https://api.example.com/api/onboarding/tasks/wt1a2b3c-5678-90ab-cdef-1234567890ab', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Correlation-ID': 'req_12349'
  },
  body: formData
});

const data = await response.json();
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Task completed successfully",
  "data": {
    "id": "wt1a2b3c-5678-90ab-cdef-1234567890ab",
    "workflowId": "w1x2y3z4-5678-90ab-cdef-1234567890ab",
    "title": "Complete HR paperwork",
    "description": "Fill out tax forms, benefits enrollment, and emergency contacts",
    "dueDate": "2025-01-16T17:00:00.000Z",
    "order": 1,
    "requiresDocument": true,
    "status": "COMPLETED",
    "completedAt": "2025-01-15T14:30:00.000Z",
    "documentUrl": "/uploads/onboarding/e1f2g3h4-5678-90ab-cdef-1234567890ab/hr_paperwork_20250115143000.pdf",
    "createdAt": "2025-01-15T10:40:00.000Z",
    "updatedAt": "2025-01-15T14:30:00.000Z"
  },
  "timestamp": "2025-01-15T14:30:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Invalid task ID |
| 400 | `DOCUMENT_REQUIRED` | Task requires document but none provided |
| 400 | `TASK_ALREADY_COMPLETED` | Task has already been completed |
| 400 | `FILE_TOO_LARGE` | Uploaded file exceeds 10MB limit |
| 400 | `INVALID_FILE_TYPE` | File type not allowed |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | User cannot complete this task (not assigned to them) |
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 500 | `INTERNAL_ERROR` | Server error during task update |

---

## Progress Monitoring

### Get Team Onboarding Progress

Retrieve onboarding progress for all team members reporting to the authenticated manager.

**Endpoint:** `GET /api/onboarding/team-progress`

**Authorization:** `HR_ADMIN` (all teams), `MANAGER` (own team only)

**Query Parameters:** None

**Example Request (cURL):**

```bash
curl -X GET https://api.example.com/api/onboarding/team-progress \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-Correlation-ID: req_12350"
```

**Example Request (JavaScript):**

```javascript
const response = await fetch('https://api.example.com/api/onboarding/team-progress', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Correlation-ID': 'req_12350'
  }
});

const data = await response.json();
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "totalEmployees": 5,
    "averageProgress": 65.5,
    "employees": [
      {
        "employeeId": "e1f2g3h4-5678-90ab-cdef-1234567890ab",
        "employeeName": "John Doe",
        "workflowId": "w1x2y3z4-5678-90ab-cdef-1234567890ab",
        "templateName": "Software Engineer Onboarding",
        "status": "IN_PROGRESS",
        "progress": {
          "totalTasks": 10,
          "completedTasks": 7,
          "percentComplete": 70
        },
        "startDate": "2025-01-15T10:40:00.000Z",
        "targetCompletionDate": "2025-02-15T00:00:00.000Z",
        "daysRemaining": 31,
        "overdueTasks": 0
      },
      {
        "employeeId": "e2f2g3h4-5678-90ab-cdef-1234567890ab",
        "employeeName": "Jane Smith",
        "workflowId": "w2x2y3z4-5678-90ab-cdef-1234567890ab",
        "templateName": "Software Engineer Onboarding",
        "status": "IN_PROGRESS",
        "progress": {
          "totalTasks": 10,
          "completedTasks": 6,
          "percentComplete": 60
        },
        "startDate": "2025-01-10T09:00:00.000Z",
        "targetCompletionDate": "2025-02-10T00:00:00.000Z",
        "daysRemaining": 26,
        "overdueTasks": 1
      }
    ],
    "summary": {
      "onTrack": 3,
      "atRisk": 1,
      "overdue": 1
    }
  },
  "timestamp": "2025-01-15T15:00:00.000Z"
}
```

**Error Responses:**

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | User does not have required role |
| 500 | `INTERNAL_ERROR` | Server error during progress retrieval |

---

## Data Models

### Task Status

| Status | Description |
|--------|-------------|
| `PENDING` | Task has not been started |
| `IN_PROGRESS` | Task is currently being worked on |
| `COMPLETED` | Task has been completed |
| `OVERDUE` | Task is past due date and not completed |

### Workflow Status

| Status | Description |
|--------|-------------|
| `NOT_STARTED` | Workflow has been assigned but not started |
| `IN_PROGRESS` | Workflow is in progress |
| `COMPLETED` | All tasks in workflow are completed |
| `CANCELLED` | Workflow has been cancelled |

### Template Object

```json
{
  "id": "string (UUID)",
  "name": "string (max 200 chars)",
  "description": "string (max 2000 chars)",
  "tasks": [
    {
      "id": "string (UUID)",
      "title": "string (max 200 chars)",
      "description": "string (max 2000 chars)",
      "daysUntilDue": "integer (min 1)",
      "order": "integer (min 1)",
      "requiresDocument": "boolean"
    }
  ],
  "departmentId": "string (UUID) | null",
  "estimatedDays": "integer (min 1)",
  "isActive": "boolean",
  "createdAt": "string (ISO 8601 datetime)",
  "updatedAt": "string (ISO 8601 datetime)"
}
```

### Workflow Object

```json
{
  "id": "string (UUID)",
  "employeeId": "string (UUID)",
  "templateId": "string (UUID)",
  "status": "NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED",
  "targetCompletionDate": "string (ISO 8601 datetime) | null",
  "tasks": [
    {
      "id": "string (UUID)",
      "workflowId": "string (UUID)",
      "title": "string (max 200 chars)",
      "description": "string (max 2000 chars)",
      "dueDate": "string (ISO 8601 datetime)",
      "order": "integer (min 1)",
      "requiresDocument": "boolean",
      "status": "PENDING | IN_PROGRESS | COMPLETED | OVERDUE",
      "completedAt": "string (ISO 8601 datetime) | null",
      "documentUrl": "string | null"
    }
  ],
  "progress": {
    "totalTasks": "integer",
    "completedTasks": "integer",
    "percentComplete": "number (0-100)"
  },
  "createdAt": "string (ISO 8601 datetime)",
  "updatedAt": "string (ISO 8601 datetime)"
}
```

### Task Object

```json
{
  "id": "string (UUID)",
  "workflowId": "string (UUID)",
  "title": "string (max 200 chars)",
  "description": "string (max 2000 chars)",
  "dueDate": "string (ISO 8601 datetime)",
  "order": "integer (min 1)",
  "requiresDocument": "boolean",
  "status": "PENDING | IN_PROGRESS | COMPLETED | OVERDUE",
  "completedAt": "string (ISO 8601 datetime) | null",
  "documentUrl": "string | null",
  "createdAt": "string (ISO 8601 datetime)",
  "updatedAt": "string (ISO 8601 datetime)"
}
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request body or parameters are invalid |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User does not have required permissions |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `INTERNAL_ERROR` | 500 | Server error occurred |

### Validation Error Response

When validation fails, the error response includes detailed validation errors:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "errors": [
      "Task title must be between 1 and 200 characters",
      "Due date must be a future date"
    ]
  },
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

## Workflow Diagrams

### Template Creation Flow

```
┌─────────────┐
│  HR Admin   │
└──────┬──────┘
       │
       │ POST /api/onboarding/templates
       │ (template data)
       ▼
┌─────────────────────────────┐
│  Onboarding API             │
│  - Validate input           │
│  - Check authorization      │
│  - Validate task data       │
└──────┬──────────────────────┘
       │
       │ Create template & tasks
       ▼
┌─────────────────────────────┐
│  Database                   │
│  - Insert template          │
│  - Insert tasks             │
└──────┬──────────────────────┘
       │
       │ Return created template
       ▼
┌─────────────┐
│  HR Admin   │
│  (Success)  │
└─────────────┘
```

### Workflow Assignment Flow

```
┌─────────────┐
│  HR Admin   │
└──────┬──────┘
       │
       │ POST /api/onboarding/workflows
       │ (employeeId, templateId)
       ▼
┌─────────────────────────────┐
│  Onboarding API             │
│  - Validate input           │
│  - Check authorization      │
│  - Verify employee exists   │
│  - Verify template exists   │
│  - Check for existing       │
│    workflow                 │
└──────┬──────────────────────┘
       │
       │ Create workflow & tasks
       ▼
┌─────────────────────────────┐
│  Database                   │
│  - Insert workflow          │
│  - Insert tasks with        │
│    calculated due dates     │
└──────┬──────────────────────┘
       │
       │ Send notification
       ▼
┌─────────────────────────────┐
│  Email Service              │
│  - Send welcome email       │
│  - Include task list        │
└──────┬──────────────────────┘
       │
       │ Return created workflow
       ▼
┌─────────────┐
│  HR Admin   │
│  (Success)  │
└─────────────┘
```

### Task Completion Flow

```
┌─────────────┐
│  Employee   │
└──────┬──────┘
       │
       │ PATCH /api/onboarding/tasks/:id
       │ (optional: document file)
       ▼
┌─────────────────────────────┐
│  Onboarding API             │
│  - Validate input           │
│  - Check authorization      │
│  - Verify task exists       │
│  - Verify task ownership    │
│  - Check if already         │
│    completed                │
└──────┬──────────────────────┘
       │
       │ If document required
       ▼
┌─────────────────────────────┐
│  File Upload Middleware     │
│  - Validate file type       │
│  - Validate file size       │
│  - Save to storage          │
└──────┬──────────────────────┘
       │
       │ Update task status
       ▼
┌─────────────────────────────┐
│  Database                   │
│  - Update task status       │
│  - Set completedAt          │
│  - Store documentUrl        │
└──────┬──────────────────────┘
       │
       │ Send notification
       ▼
┌─────────────────────────────┐
│  Email Service              │
│  - Notify HR admin          │
│  - Include task details     │
└──────┬──────────────────────┘
       │
       │ Return updated task
       ▼
┌─────────────┐
│  Employee   │
│  (Success)  │
└─────────────┘
```

### Progress Monitoring Flow

```
┌─────────────┐
│  Manager    │
└──────┬──────┘
       │
       │ GET /api/onboarding/team-progress
       ▼
┌─────────────────────────────┐
│  Onboarding API             │
│  - Check authorization      │
│  - Get manager's team       │
└──────┬──────────────────────┘
       │
       │ Query team workflows
       ▼
┌─────────────────────────────┐
│  Database                   │
│  - Get workflows for team   │
│  - Calculate progress       │
│  - Identify overdue tasks   │
└──────┬──────────────────────┘
       │
       │ Aggregate data
       ▼
┌─────────────────────────────┐
│  Onboarding API             │
│  - Calculate averages       │
│  - Categorize status        │
│  - Format response          │
└──────┬──────────────────────┘
       │
       │ Return progress data
       ▼
┌─────────────┐
│  Manager    │
│  (Success)  │
└─────────────┘
```

---

## Rate Limiting

All API endpoints are subject to rate limiting:

- **Global Rate Limit:** 100 requests per minute per IP address
- **Authenticated Rate Limit:** 1000 requests per hour per user

Rate limit information is included in response headers:

```
RateLimit-Limit: 1000
RateLimit-Remaining: 995
RateLimit-Reset: 1642262400
```

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60,
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

---

## Pagination

List endpoints support pagination with the following parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |

Pagination metadata is included in all list responses:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Request Tracing

All requests support optional correlation IDs for distributed tracing:

**Request Header:**
```
X-Correlation-ID: req_12345
```

The correlation ID is included in all log entries and can be used to trace requests across services.

---

## Support

For API support and questions:
- **Documentation:** https://docs.example.com/api/onboarding
- **Support Email:** api-support@example.com
- **Status Page:** https://status.example.com

---

**Last Updated:** 2025-01-15  
**API Version:** 1.0.0