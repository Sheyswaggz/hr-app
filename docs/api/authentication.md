# Authentication API Documentation

## Overview

This document provides comprehensive documentation for all authentication endpoints in the HR Application. The authentication system uses JWT (JSON Web Tokens) for secure session management and implements role-based access control with three user roles: HR Admin, Manager, and Employee.

## Base URL

All authentication endpoints are prefixed with:

```
/api/auth
```

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Rate Limiting

All authentication endpoints implement rate limiting to prevent abuse:

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/register` | 3 requests | 1 hour |
| `/login` | 5 requests | 15 minutes |
| `/logout` | 20 requests | 15 minutes |
| `/refresh-token` | 10 requests | 15 minutes |
| `/request-password-reset` | 3 requests | 1 hour |
| `/reset-password` | 3 requests | 1 hour |
| All endpoints (general) | 20 requests | 15 minutes |

When rate limit is exceeded, the API returns HTTP 429 with retry information in response headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

## JWT Token Structure

### Access Token Payload

```json
{
  "userId": "uuid-v4-string",
  "email": "user@example.com",
  "role": "HR_ADMIN | MANAGER | EMPLOYEE",
  "iat": 1234567890,
  "exp": 1234654290,
  "jti": "unique-token-id"
}
```

### Refresh Token Payload

```json
{
  "userId": "uuid-v4-string",
  "email": "user@example.com",
  "role": "HR_ADMIN | MANAGER | EMPLOYEE",
  "type": "refresh",
  "iat": 1234567890,
  "exp": 1237246290,
  "jti": "unique-token-id"
}
```

### Token Expiration

- **Access Token**: 24 hours (configurable via `JWT_ACCESS_TOKEN_EXPIRY`)
- **Refresh Token**: 30 days (configurable via `JWT_REFRESH_TOKEN_EXPIRY`)

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `HR_ADMIN` | HR Administrator | Full system access including employee management, performance reviews, and system configuration |
| `MANAGER` | Manager | Access to team management, performance reviews for direct reports, and leave approval |
| `EMPLOYEE` | Employee | Basic access to personal information, leave requests, and performance review viewing |

---

## Endpoints

### 1. Register User

Create a new user account with email and password.

**Endpoint:** `POST /api/auth/register`

**Authentication Required:** No

**Rate Limit:** 3 requests per hour

#### Request Body

```json
{
  "email": "string (required)",
  "password": "string (required)",
  "passwordConfirm": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "role": "HR_ADMIN | MANAGER | EMPLOYEE (optional, defaults to EMPLOYEE)",
  "departmentId": "string (optional)",
  "managerId": "string (optional)"
}
```

#### Request Body Validation

- **email**: Valid email format, max 255 characters
- **password**: Minimum 8 characters, must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **passwordConfirm**: Must match password
- **firstName**: 1-100 characters, letters and spaces only
- **lastName**: 1-100 characters, letters and spaces only
- **role**: Must be valid UserRole enum value
- **departmentId**: Valid UUID v4 format (if provided)
- **managerId**: Valid UUID v4 format (if provided)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "User registered successfully",
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  },
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "EMPLOYEE",
    "isActive": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid request data

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**409 Conflict** - Email already exists

```json
{
  "success": false,
  "code": "EMAIL_EXISTS",
  "message": "An account with this email already exists",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many registration attempts. Please try again in 1 hour.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "REGISTRATION_ERROR",
  "message": "An error occurred during registration",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "passwordConfirm": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "EMPLOYEE"
  }'
```

#### Example Request (JavaScript)

```javascript
const response = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john.doe@example.com',
    password: 'SecurePass123!',
    passwordConfirm: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
    role: 'EMPLOYEE',
  }),
});

const data = await response.json();

if (data.success) {
  // Store tokens securely
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  
  console.log('User registered:', data.user);
} else {
  console.error('Registration failed:', data.message);
}
```

---

### 2. Login

Authenticate user with email and password, receiving JWT tokens on success.

**Endpoint:** `POST /api/auth/login`

**Authentication Required:** No

**Rate Limit:** 5 requests per 15 minutes

#### Request Body

```json
{
  "email": "string (required)",
  "password": "string (required)",
  "rememberMe": "boolean (optional, defaults to false)"
}
```

#### Request Body Validation

- **email**: Valid email format, max 255 characters
- **password**: Required, non-empty string
- **rememberMe**: Boolean value (extends refresh token expiry if true)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  },
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "EMPLOYEE",
    "isActive": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid request data

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Invalid login credentials format",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized** - Invalid credentials

```json
{
  "success": false,
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**403 Forbidden** - Account inactive

```json
{
  "success": false,
  "code": "ACCOUNT_INACTIVE",
  "message": "Your account has been deactivated. Please contact HR.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Account locked due to failed attempts

```json
{
  "success": false,
  "code": "ACCOUNT_LOCKED",
  "message": "Account locked due to too many failed login attempts",
  "lockout": {
    "lockedUntil": "2024-01-15T11:00:00.000Z",
    "remainingMinutes": 30
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many login attempts. Please try again in 15 minutes.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "LOGIN_ERROR",
  "message": "An error occurred during login",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "rememberMe": true
  }'
```

#### Example Request (JavaScript)

```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john.doe@example.com',
    password: 'SecurePass123!',
    rememberMe: true,
  }),
});

const data = await response.json();

if (data.success) {
  // Store tokens securely
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  
  console.log('Login successful:', data.user);
} else {
  console.error('Login failed:', data.message);
  
  // Handle account lockout
  if (data.lockout) {
    console.error('Account locked until:', data.lockout.lockedUntil);
  }
}
```

---

### 3. Logout

Logout user and invalidate current access token.

**Endpoint:** `POST /api/auth/logout`

**Authentication Required:** Yes (Bearer token)

**Rate Limit:** 20 requests per 15 minutes

#### Request Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

No request body required.

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Logout successful",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**401 Unauthorized** - Missing or invalid token

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized** - Token already revoked

```json
{
  "success": false,
  "code": "TOKEN_REVOKED",
  "message": "Token has been revoked",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many authentication requests. Please try again in 15 minutes.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "LOGOUT_ERROR",
  "message": "Logout failed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Example Request (JavaScript)

```javascript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('http://localhost:3000/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const data = await response.json();

if (data.success) {
  // Clear stored tokens
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  
  console.log('Logout successful');
} else {
  console.error('Logout failed:', data.message);
}
```

---

### 4. Refresh Token

Refresh access token using refresh token without requiring re-login.

**Endpoint:** `POST /api/auth/refresh-token`

**Authentication Required:** No (uses refresh token in body)

**Rate Limit:** 10 requests per 15 minutes

#### Request Body

```json
{
  "refreshToken": "string (required)"
}
```

#### Request Body Validation

- **refreshToken**: Required, non-empty JWT string

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  },
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "EMPLOYEE",
    "isActive": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid request data

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Refresh token is required",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized** - Invalid or expired refresh token

```json
{
  "success": false,
  "code": "INVALID_TOKEN",
  "message": "Invalid or expired refresh token",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized** - Token revoked

```json
{
  "success": false,
  "code": "TOKEN_REVOKED",
  "message": "Refresh token has been revoked",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many token refresh requests. Please try again in 15 minutes.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "REFRESH_ERROR",
  "message": "An error occurred during token refresh",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### Example Request (JavaScript)

```javascript
const refreshToken = localStorage.getItem('refreshToken');

const response = await fetch('http://localhost:3000/api/auth/refresh-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    refreshToken: refreshToken,
  }),
});

const data = await response.json();

if (data.success) {
  // Update stored tokens
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  
  console.log('Token refreshed successfully');
} else {
  console.error('Token refresh failed:', data.message);
  
  // If refresh token is invalid, redirect to login
  if (data.code === 'INVALID_TOKEN' || data.code === 'TOKEN_REVOKED') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
}
```

---

### 5. Request Password Reset

Request a password reset email with secure token.

**Endpoint:** `POST /api/auth/request-password-reset`

**Authentication Required:** No

**Rate Limit:** 3 requests per hour

#### Request Body

```json
{
  "email": "string (required)"
}
```

#### Request Body Validation

- **email**: Valid email format, max 255 characters

#### Success Response (200 OK)

**Note:** This endpoint always returns success to prevent email enumeration attacks, even if the email doesn't exist in the system.

```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid request data

```json
{
  "success": false,
  "code": "INVALID_REQUEST",
  "message": "Email is required",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many password reset requests. Please try again in 1 hour.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred during password reset request",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```

#### Example Request (JavaScript)

```javascript
const response = await fetch('http://localhost:3000/api/auth/request-password-reset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john.doe@example.com',
  }),
});

const data = await response.json();

if (data.success) {
  console.log('Password reset email sent (if account exists)');
  // Show success message to user
} else {
  console.error('Password reset request failed:', data.message);
}
```

#### Password Reset Email

The password reset email contains a secure token that expires after 1 hour. The email includes:

- Reset link: `https://app.example.com/reset-password?token=<secure_token>`
- Token expiration time
- Security notice about not sharing the link
- Instructions to ignore if request wasn't made by user

---

### 6. Reset Password

Reset password using the token received via email.

**Endpoint:** `POST /api/auth/reset-password`

**Authentication Required:** No (uses reset token)

**Rate Limit:** 3 requests per hour

#### Request Body

```json
{
  "token": "string (required)",
  "password": "string (required)",
  "passwordConfirm": "string (required)"
}
```

#### Request Body Validation

- **token**: Required, non-empty string (secure reset token from email)
- **password**: Minimum 8 characters, must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **passwordConfirm**: Must match password

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Password has been reset successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**400 Bad Request** - Invalid request data or validation error

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Password validation failed",
  "details": {
    "password": "Password must contain at least one uppercase letter"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized** - Invalid or expired reset token

```json
{
  "success": false,
  "code": "INVALID_TOKEN",
  "message": "Invalid or expired reset token",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many password reset requests. Please try again in 1 hour.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**500 Internal Server Error** - Server error

```json
{
  "success": false,
  "code": "RESET_ERROR",
  "message": "Password reset failed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "secure-reset-token-from-email",
    "password": "NewSecurePass123!",
    "passwordConfirm": "NewSecurePass123!"
  }'
```

#### Example Request (JavaScript)

```javascript
// Extract token from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('token');

const response = await fetch('http://localhost:3000/api/auth/reset-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: resetToken,
    password: 'NewSecurePass123!',
    passwordConfirm: 'NewSecurePass123!',
  }),
});

const data = await response.json();

if (data.success) {
  console.log('Password reset successful');
  // Redirect to login page
  window.location.href = '/login';
} else {
  console.error('Password reset failed:', data.message);
  
  // Handle expired token
  if (data.code === 'INVALID_TOKEN') {
    console.error('Reset token has expired. Please request a new one.');
  }
}
```

---

## Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 OK | Request successful |
| 201 Created | Resource created successfully (registration) |
| 400 Bad Request | Invalid request data or validation error |
| 401 Unauthorized | Authentication required or invalid credentials |
| 403 Forbidden | Account inactive or insufficient permissions |
| 404 Not Found | Resource not found |
| 409 Conflict | Resource already exists (duplicate email) |
| 429 Too Many Requests | Rate limit exceeded or account locked |
| 500 Internal Server Error | Server error |

---

## Error Response Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Specific field error message"
  },
  "lockout": {
    "lockedUntil": "2024-01-15T11:00:00.000Z",
    "remainingMinutes": 30
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_REQUEST` | Invalid request format or missing required fields |
| `EMAIL_EXISTS` | Email already registered |
| `INVALID_CREDENTIALS` | Invalid email or password |
| `ACCOUNT_INACTIVE` | User account is deactivated |
| `ACCOUNT_LOCKED` | Account locked due to failed login attempts |
| `INVALID_TOKEN` | Invalid or expired JWT token |
| `TOKEN_REVOKED` | Token has been revoked |
| `UNAUTHORIZED` | Authentication required |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |
| `REGISTRATION_ERROR` | Registration failed |
| `LOGIN_ERROR` | Login failed |
| `LOGOUT_ERROR` | Logout failed |
| `REFRESH_ERROR` | Token refresh failed |
| `RESET_ERROR` | Password reset failed |

---

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

### Account Lockout

After 5 consecutive failed login attempts, the account is locked for 30 minutes. During lockout:
- Login attempts return 429 status with lockout information
- Lockout timer resets after successful login
- Failed attempt counter resets after 15 minutes of no attempts

### Token Security

- JWT tokens signed with RS256 algorithm
- Access tokens expire after 24 hours
- Refresh tokens expire after 30 days
- Tokens include unique JTI (JWT ID) for revocation
- Revoked tokens stored in blacklist until expiration

### Password Reset Security

- Reset tokens expire after 1 hour
- Tokens are single-use only
- Tokens invalidated after successful password reset
- Email enumeration prevention (always returns success)

---

## Best Practices

### Token Storage

**Client-Side:**
- Store tokens in `localStorage` or `sessionStorage`
- Never store tokens in cookies without `httpOnly` flag
- Clear tokens on logout

**Server-Side:**
- Tokens are stateless (no server-side session storage)
- Blacklist stored in memory or Redis for revoked tokens

### Token Refresh Strategy

Implement automatic token refresh before expiration:

```javascript
// Check token expiration and refresh if needed
async function ensureValidToken() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!accessToken || !refreshToken) {
    // Redirect to login
    window.location.href = '/login';
    return null;
  }
  
  // Decode token to check expiration (without verification)
  const payload = JSON.parse(atob(accessToken.split('.')[1]));
  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  
  // Refresh if token expires in less than 5 minutes
  if (expiresAt - now < 5 * 60 * 1000) {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
      return data.tokens.accessToken;
    } else {
      // Refresh failed, redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return null;
    }
  }
  
  return accessToken;
}

// Use before making authenticated requests
const token = await ensureValidToken();
if (token) {
  // Make authenticated request
  const response = await fetch('/api/protected-resource', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

### Error Handling

Always handle authentication errors gracefully:

```javascript
async function makeAuthenticatedRequest(url, options = {}) {
  const token = await ensureValidToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.status === 401) {
    // Token invalid or expired, try refresh
    const newToken = await ensureValidToken();
    
    if (newToken) {
      // Retry request with new token
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }
  }
  
  return response;
}
```

### Rate Limit Handling

Respect rate limits and implement exponential backoff:

```javascript
async function makeRequestWithRetry(url, options = {}, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limit exceeded
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter 
        ? parseInt(retryAfter) * 1000 
        : Math.pow(2, retries) * 1000; // Exponential backoff
      
      console.warn(`Rate limit exceeded. Retrying after ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      retries++;
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## Testing

### Test Credentials

For development and testing environments, use these test accounts:

| Role | Email | Password |
|------|-------|----------|
| HR Admin | `admin@example.com` | `Admin123!` |
| Manager | `manager@example.com` | `Manager123!` |
| Employee | `employee@example.com` | `Employee123!` |

**Note:** These credentials are for testing only and should never be used in production.

### Example Test Scenarios

#### 1. Complete Authentication Flow

```javascript
// 1. Register new user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!',
    passwordConfirm: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
  }),
});

const registerData = await registerResponse.json();
console.assert(registerData.success === true);
console.assert(registerData.tokens.accessToken);

// 2. Logout
const logoutResponse = await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${registerData.tokens.accessToken}`,
  },
});

const logoutData = await logoutResponse.json();
console.assert(logoutData.success === true);

// 3. Login with same credentials
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!',
  }),
});

const loginData = await loginResponse.json();
console.assert(loginData.success === true);
console.assert(loginData.user.email === 'test@example.com');

// 4. Refresh token
const refreshResponse = await fetch('/api/auth/refresh-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: loginData.tokens.refreshToken,
  }),
});

const refreshData = await refreshResponse.json();
console.assert(refreshData.success === true);
console.assert(refreshData.tokens.accessToken !== loginData.tokens.accessToken);
```

#### 2. Password Reset Flow

```javascript
// 1. Request password reset
const resetRequestResponse = await fetch('/api/auth/request-password-reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
  }),
});

const resetRequestData = await resetRequestResponse.json();
console.assert(resetRequestData.success === true);

// 2. Reset password with token (from email)
const resetResponse = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'reset-token-from-email',
    password: 'NewTest123!',
    passwordConfirm: 'NewTest123!',
  }),
});

const resetData = await resetResponse.json();
console.assert(resetData.success === true);

// 3. Login with new password
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'NewTest123!',
  }),
});

const loginData = await loginResponse.json();
console.assert(loginData.success === true);
```

---

## Changelog

### Version 1.0.0 (2024-01-15)

- Initial release of authentication API
- User registration with email/password
- Login with JWT token generation
- Logout with token revocation
- Token refresh mechanism
- Password reset flow
- Rate limiting on all endpoints
- Account lockout after failed attempts
- Role-based access control (HR Admin, Manager, Employee)

---

## Support

For issues, questions, or feature requests related to the authentication system:

- **Email:** support@example.com
- **Documentation:** https://docs.example.com/auth
- **API Status:** https://status.example.com

---

## License

Copyright © 2024 HR Application. All rights reserved.

This API documentation is proprietary and confidential.