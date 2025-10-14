# Authentication API Documentation

## Overview

The Authentication API provides secure user authentication and authorization services for the HR application. It implements JWT-based authentication with role-based access control (RBAC), supporting three user roles: HR Admin, Manager, and Employee.

**Base URL:** `/api/auth`

**Authentication:** Most endpoints are public (registration, login). Protected endpoints require a valid JWT token in the `Authorization` header.

**Rate Limiting:** All endpoints are rate-limited to prevent abuse. See individual endpoint documentation for specific limits.

---

## Table of Contents

- [Authentication Flow](#authentication-flow)
- [JWT Token Structure](#jwt-token-structure)
- [Error Responses](#error-responses)
- [Endpoints](#endpoints)
  - [Register User](#register-user)
  - [Login](#login)
  - [Logout](#logout)
  - [Refresh Token](#refresh-token)
  - [Request Password Reset](#request-password-reset)
  - [Reset Password](#reset-password)
  - [Health Check](#health-check)
- [Rate Limiting](#rate-limiting)
- [Security Considerations](#security-considerations)
- [Code Examples](#code-examples)

---

## Authentication Flow

1. **Registration:** User creates an account with email, password, and profile information
2. **Login:** User authenticates with email and password, receives access and refresh tokens
3. **Access Protected Resources:** Client includes access token in `Authorization` header
4. **Token Refresh:** When access token expires, use refresh token to obtain new tokens
5. **Logout:** Client invalidates refresh token to end session

---

## JWT Token Structure

### Access Token

Access tokens are short-lived (default: 1 hour) and used to authenticate API requests.

**Payload Structure:**